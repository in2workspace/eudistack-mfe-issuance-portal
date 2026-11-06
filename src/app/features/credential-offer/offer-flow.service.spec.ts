import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Observable, of, Subject, throwError } from 'rxjs';
import { ApiProblemError, NETWORK_ERROR } from '../../core/api/api-problem.error';
import { Journey, JourneyApi, Offer, PortalConfig } from '../../core/api/generated/journey';
import { PortalConfigService } from '../../core/config/portal-config.service';
import { JourneyIssuanceStore } from '../../core/journey/journey-issuance.store';
import { JourneyNavigator } from '../../core/journey/journey-navigator';
import { SESSION_ACTIONS } from '../../core/session/session-actions';
import { CredentialOfferService } from './credential-offer.service';
import { OfferFlowService } from './offer-flow.service';

const WALLET = 'https://wallet.sandbox.dev.eudistack.net';
const OFFER_URI = 'https://sandbox.dev.eudistack.net/issuer/credential-offer/abc';
const IN_TEN_MINUTES = () => new Date(Date.now() + 600_000).toISOString();

function ticketOffer(ticket = 'Zk3q9Xw2'): Offer {
  return {
    credential_offer_uri: `openid-credential-offer://?credential_offer_uri=${encodeURIComponent(OFFER_URI)}`,
    expires_at: IN_TEN_MINUTES(),
    onboarding_url: `${WALLET}/t/${ticket}`,
    onboarding_expires_at: IN_TEN_MINUTES(),
  };
}

function plainOffer(): Offer {
  return {
    credential_offer_uri: `openid-credential-offer://?credential_offer_uri=${encodeURIComponent(OFFER_URI)}`,
    expires_at: IN_TEN_MINUTES(),
  };
}

function problem(type: string, status: number): Observable<never> {
  return throwError(() => new ApiProblemError(type, status, type));
}

/** Pantalla mínima que provee el flujo, como la de QR. */
@Component({ template: '', providers: [OfferFlowService] })
class HostComponent {
  readonly flow = inject(OfferFlowService);
}

describe('OfferFlowService', () => {
  let journeyApi: { getJourney: jest.Mock; confirmAndIssue: jest.Mock; newOffer: jest.Mock; withdrawJourney: jest.Mock };
  let discardTokens: jest.Mock;
  let toSessionExpired: jest.Mock;
  let navigate: jest.SpyInstance;
  let walletUrl: string | undefined;
  let store: JourneyIssuanceStore;
  let presenter: CredentialOfferService;

  beforeEach(() => {
    walletUrl = WALLET;
    journeyApi = { getJourney: jest.fn(), confirmAndIssue: jest.fn(), newOffer: jest.fn(), withdrawJourney: jest.fn() };
    discardTokens = jest.fn();
    toSessionExpired = jest.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: JourneyApi, useValue: journeyApi },
        { provide: JourneyNavigator, useValue: { toSessionExpired } },
        { provide: SESSION_ACTIONS, useValue: { restartLogin: jest.fn(), discardTokens } },
        { provide: PortalConfigService, useValue: { config: () => ({ wallet_url: walletUrl }) as PortalConfig } },
      ],
    });
    navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    store = TestBed.inject(JourneyIssuanceStore);
    presenter = TestBed.inject(CredentialOfferService);
  });

  afterEach(() => presenter.cancelPendingWork());

  function flow(): OfferFlowService {
    return TestBed.createComponent(HostComponent).componentInstance.flow;
  }

  function journey(overrides: Partial<Journey> = {}): Observable<Journey> {
    return of({ state: 'in_progress', step: 'entitlement_confirmed', ...overrides });
  }

  describe('coming from Datos', () => {
    beforeEach(() => store.confirm('maria@example.org'));

    it('AC-01, AC-02: confirms with only the email and presents the onboarding address as it comes', async () => {
      const offer = ticketOffer();
      journeyApi.confirmAndIssue.mockReturnValue(of(offer));

      await flow().enter();

      expect(journeyApi.confirmAndIssue).toHaveBeenCalledWith({ email: 'maria@example.org' });
      expect(journeyApi.newOffer).not.toHaveBeenCalled();
      expect(presenter.status()).toBe('ready');
      expect(presenter.address()?.url).toBe(offer.onboarding_url);
      expect(store.pendingCall()).toBeNull();
    });

    it('AC-04: without onboarding_url presents the wallet address built with the offer', async () => {
      journeyApi.confirmAndIssue.mockReturnValue(of(plainOffer()));

      await flow().enter();

      expect(presenter.address()?.url).toBe(
        `${WALLET}/protocol/callback?credential_offer_uri=${encodeURIComponent(OFFER_URI)}`,
      );
    });

    it('shows QR (generando) while the confirmation runs', () => {
      journeyApi.confirmAndIssue.mockReturnValue(new Subject<Offer>());

      void flow().enter();

      expect(presenter.status()).toBe('loading');
    });

    it.each([
      ['issuance_rejected', 502, 'issuance-failed'],
      ['issuance_unavailable', 503, 'issuance-failed'],
      [NETWORK_ERROR, 0, 'issuance-failed'],
      ['onboarding_unavailable', 503, 'onboarding-unavailable'],
    ])('ES-01, AC-08: %s goes to the %s case and keeps the confirmation to repeat it', async (type, status, reason) => {
      journeyApi.confirmAndIssue.mockReturnValue(problem(type, status));

      await flow().enter();

      expect(navigate).toHaveBeenCalledWith(['/', 'error', reason]);
      expect(store.pendingCall()).toBe('confirmation');
      expect(store.email()).toBe('maria@example.org');
      expect(presenter.address()).toBeNull();
    });

    it('AC-09: with onboarding_unavailable never presents an address', async () => {
      journeyApi.confirmAndIssue.mockReturnValue(problem('onboarding_unavailable', 503));

      await flow().enter();

      expect(presenter.address()).toBeNull();
      expect(presenter.status()).toBe('loading');
    });

    it.each(['email_required', 'email_invalid'])('ES-04: %s goes back to Datos with the email marked', async (type) => {
      journeyApi.confirmAndIssue.mockReturnValue(problem(type, 400));

      await flow().enter();

      expect(store.emailRejected()).toBe(true);
      expect(store.pendingCall()).toBeNull();
      expect(navigate).toHaveBeenCalledWith(['/', 'user-data']);
    });

    it('AC-07: offer_not_renewable forgets the email and goes to the not renewable case', async () => {
      journeyApi.confirmAndIssue.mockReturnValue(problem('offer_not_renewable', 409));

      await flow().enter();

      expect(store.email()).toBeNull();
      expect(navigate).toHaveBeenCalledWith(['/', 'error', 'offer-not-renewable']);
    });

    it.each([
      ['journey_closed', 410],
      ['step_not_allowed', 409],
      ['unauthenticated', 401],
    ])('ES-06: %s is left to the journey interceptor or the login', async (type, status) => {
      journeyApi.confirmAndIssue.mockReturnValue(problem(type, status));

      await flow().enter();

      expect(navigate).not.toHaveBeenCalled();
      expect(journeyApi.getJourney).not.toHaveBeenCalled();
    });

    it('ES-03: with no wallet_url and no onboarding_url goes to the issuance case, without QR', async () => {
      walletUrl = undefined;
      journeyApi.confirmAndIssue.mockReturnValue(of(plainOffer()));

      await flow().enter();

      expect(presenter.address()).toBeNull();
      expect(navigate).toHaveBeenCalledWith(['/', 'error', 'issuance-failed']);
    });

    it('does not present or navigate once the holder has left QR', async () => {
      const response = new Subject<Offer>();
      journeyApi.confirmAndIssue.mockReturnValue(response);
      const fixture = TestBed.createComponent(HostComponent);
      const entering = fixture.componentInstance.flow.enter();

      fixture.destroy();
      response.next(ticketOffer());
      response.complete();
      await entering;

      expect(presenter.address()).toBeNull();
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('repeating the call that failed (EC-04)', () => {
    it('AC-08: after a failed confirmation, entering QR again repeats the confirmation with the same email', async () => {
      store.confirm('maria@example.org');
      journeyApi.confirmAndIssue.mockReturnValueOnce(problem('onboarding_unavailable', 503)).mockReturnValueOnce(of(ticketOffer()));
      await flow().enter();

      await flow().enter();

      expect(journeyApi.confirmAndIssue).toHaveBeenNthCalledWith(2, { email: 'maria@example.org' });
      expect(journeyApi.newOffer).not.toHaveBeenCalled();
      expect(presenter.status()).toBe('ready');
    });

    it('AC-08: after a failed new code, entering QR again asks for a new code, not a confirmation', async () => {
      store.confirm('maria@example.org');
      store.offerReceived();
      journeyApi.newOffer.mockReturnValueOnce(problem('onboarding_unavailable', 503)).mockReturnValueOnce(of(ticketOffer('new')));
      await flow().newCode();

      await flow().enter();

      expect(journeyApi.newOffer).toHaveBeenCalledTimes(2);
      expect(journeyApi.confirmAndIssue).not.toHaveBeenCalled();
      expect(presenter.address()?.url).toBe(`${WALLET}/t/new`);
    });
  });

  describe('new code (AC-06)', () => {
    it('asks POST /journey/offers and presents the new address', async () => {
      journeyApi.newOffer.mockReturnValue(of(ticketOffer('new')));

      await flow().newCode();

      expect(journeyApi.newOffer).toHaveBeenCalledTimes(1);
      expect(presenter.address()?.url).toBe(`${WALLET}/t/new`);
      expect(store.pendingCall()).toBeNull();
    });

    it('AC-07: offer_not_renewable goes to the not renewable case', async () => {
      journeyApi.newOffer.mockReturnValue(problem('offer_not_renewable', 409));

      await flow().newCode();

      expect(navigate).toHaveBeenCalledWith(['/', 'error', 'offer-not-renewable']);
    });

    it('ES-02: step_not_allowed presents again the offer the service still holds, without the error screen', async () => {
      const current = ticketOffer('current');
      journeyApi.newOffer.mockReturnValue(problem('step_not_allowed', 409));
      journeyApi.getJourney.mockReturnValue(journey({ state: 'completed', step: 'offer_obtained', offer: current }));

      await flow().newCode();

      expect(presenter.status()).toBe('ready');
      expect(presenter.address()?.url).toBe(current.onboarding_url);
      expect(store.pendingCall()).toBeNull();
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('entering QR with nothing pending', () => {
    it('EC-02: after a reload, presents the offer GET /journey gives, without asking for another', async () => {
      const current = ticketOffer('current');
      journeyApi.getJourney.mockReturnValue(journey({ state: 'completed', step: 'offer_obtained', offer: current }));

      await flow().enter();

      expect(presenter.address()?.url).toBe(current.onboarding_url);
      expect(journeyApi.confirmAndIssue).not.toHaveBeenCalled();
      expect(journeyApi.newOffer).not.toHaveBeenCalled();
    });

    it('EC-02: an offer already expired is presented expired', async () => {
      journeyApi.getJourney.mockReturnValue(
        journey({ step: 'offer_obtained', offer: { ...ticketOffer(), onboarding_expires_at: new Date(Date.now() - 1000).toISOString() } }),
      );

      await flow().enter();

      expect(presenter.status()).toBe('expired');
    });

    it('EC-03: without an offer and without the email in memory, goes back to Datos and does not confirm', async () => {
      journeyApi.getJourney.mockReturnValue(journey());

      await flow().enter();

      expect(navigate).toHaveBeenCalledWith(['/', 'user-data'], { replaceUrl: true });
      expect(journeyApi.confirmAndIssue).not.toHaveBeenCalled();
    });

    it('without an offer but with the email in memory, confirms', async () => {
      store.confirm('maria@example.org');
      store.offerReceived();
      journeyApi.getJourney.mockReturnValue(journey());
      journeyApi.confirmAndIssue.mockReturnValue(of(ticketOffer()));

      await flow().enter();

      expect(journeyApi.confirmAndIssue).toHaveBeenCalledWith({ email: 'maria@example.org' });
    });

    it('a 410 from GET /journey goes to the session expired case', async () => {
      journeyApi.getJourney.mockReturnValue(problem('journey_closed', 410));

      await flow().enter();

      expect(toSessionExpired).toHaveBeenCalledTimes(1);
    });

    it('another failure of GET /journey goes to Inicio', async () => {
      journeyApi.getJourney.mockReturnValue(problem(NETWORK_ERROR, 0));

      await flow().enter();

      expect(navigate).toHaveBeenCalledWith(['/']);
    });
  });

  describe('He terminado (AC-15)', () => {
    beforeEach(() => store.confirm('maria@example.org'));

    it('ends the journey, forgets the email, discards the tokens and goes to Inicio', async () => {
      journeyApi.withdrawJourney.mockReturnValue(journey({ state: 'completed', step: 'offer_obtained' }));

      await flow().finish();

      expect(journeyApi.withdrawJourney).toHaveBeenCalledTimes(1);
      expect(store.email()).toBeNull();
      expect(discardTokens).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith(['/']);
    });

    it('ES-05: if the withdrawal fails, discards the tokens and goes to Inicio anyway', async () => {
      journeyApi.withdrawJourney.mockReturnValue(problem(NETWORK_ERROR, 0));

      await flow().finish();

      expect(discardTokens).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith(['/']);
    });

    it('ES-05: with a 410 leaves the navigation to the journey interceptor', async () => {
      journeyApi.withdrawJourney.mockReturnValue(problem('journey_closed', 410));

      await flow().finish();

      expect(store.email()).toBeNull();
      expect(navigate).not.toHaveBeenCalled();
    });

    it('stops the countdown', async () => {
      journeyApi.withdrawJourney.mockReturnValue(journey());
      const cancel = jest.spyOn(presenter, 'cancelPendingWork');

      await flow().finish();

      expect(cancel).toHaveBeenCalled();
    });
  });
});
