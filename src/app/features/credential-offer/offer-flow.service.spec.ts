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

  afterEach(() => presenter.reset());

  function flow(): OfferFlowService {
    return TestBed.createComponent(HostComponent).componentInstance.flow;
  }

  function journey(overrides: Partial<Journey> = {}): Observable<Journey> {
    return of({ state: 'in_progress', step: 'entitlement_confirmed', ...overrides });
  }

  describe('with the confirmation pending', () => {
    beforeEach(() => store.requestConfirmation());

    it('AC-02: confirms with no body and presents the onboarding address as it comes', async () => {
      const offer = ticketOffer();
      journeyApi.confirmAndIssue.mockReturnValue(of(offer));

      await flow().enter();

      expect(journeyApi.confirmAndIssue).toHaveBeenCalledWith();
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
      expect(presenter.address()).toBeNull();
    });

    it('AC-09: with onboarding_unavailable never presents an address', async () => {
      journeyApi.confirmAndIssue.mockReturnValue(problem('onboarding_unavailable', 503));

      await flow().enter();

      expect(presenter.address()).toBeNull();
      expect(presenter.status()).toBe('loading');
    });

    it('AC-07, W4: offer_not_renewable forgets the pending call, discards the tokens and goes to the not renewable case', async () => {
      journeyApi.confirmAndIssue.mockReturnValue(problem('offer_not_renewable', 409));

      await flow().enter();

      expect(store.pendingCall()).toBeNull();
      expect(discardTokens).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith(['/', 'error', 'offer-not-renewable']);
    });

    it.each([
      ['journey_closed', 410],
      ['unauthenticated', 401],
    ])('ES-06: %s is left to the journey interceptor or the login', async (type, status) => {
      journeyApi.confirmAndIssue.mockReturnValue(problem(type, status));

      await flow().enter();

      expect(navigate).not.toHaveBeenCalled();
      expect(journeyApi.getJourney).not.toHaveBeenCalled();
    });

    it('W2: step_not_allowed on a repeated confirmation presents the offer the service already holds', async () => {
      const current = ticketOffer('current');
      journeyApi.confirmAndIssue.mockReturnValue(problem('step_not_allowed', 409));
      journeyApi.getJourney.mockReturnValue(journey({ state: 'completed', step: 'offer_obtained', offer: current }));

      await flow().enter();

      expect(presenter.address()?.url).toBe(current.onboarding_url);
      expect(store.pendingCall()).toBeNull();
      expect(navigate).not.toHaveBeenCalled();
    });

    it('W2: step_not_allowed with no offer and the step in QR goes to the issuance case instead of waiting forever', async () => {
      journeyApi.confirmAndIssue.mockReturnValue(problem('step_not_allowed', 409));
      journeyApi.getJourney.mockReturnValue(journey({ state: 'completed', step: 'offer_obtained' }));

      await flow().enter();

      expect(navigate).toHaveBeenCalledWith(['/', 'error', 'issuance-failed']);
    });

    it('W2: step_not_allowed with the step elsewhere is left to the journey interceptor', async () => {
      journeyApi.confirmAndIssue.mockReturnValue(problem('step_not_allowed', 409));
      journeyApi.getJourney.mockReturnValue(journey({ step: 'identified' }));

      await flow().enter();

      expect(navigate).not.toHaveBeenCalled();
    });

    it('ES-03: with no wallet_url and no onboarding_url goes to the issuance case, without QR', async () => {
      walletUrl = undefined;
      journeyApi.confirmAndIssue.mockReturnValue(of(plainOffer()));

      await flow().enter();

      expect(presenter.address()).toBeNull();
      expect(navigate).toHaveBeenCalledWith(['/', 'error', 'issuance-failed']);
    });

    it('B1, ES-03: an onboarding address outside the tenant wallet goes to the issuance case, without QR', async () => {
      journeyApi.confirmAndIssue.mockReturnValue(of({ ...ticketOffer(), onboarding_url: 'javascript:alert(document.domain)' }));

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
    it('AC-08, EC-05: after a failed confirmation, entering QR again repeats the confirmation with no body', async () => {
      store.requestConfirmation();
      journeyApi.confirmAndIssue.mockReturnValueOnce(problem('onboarding_unavailable', 503)).mockReturnValueOnce(of(ticketOffer()));
      await flow().enter();

      await flow().enter();

      expect(journeyApi.confirmAndIssue).toHaveBeenNthCalledWith(2);
      expect(journeyApi.newOffer).not.toHaveBeenCalled();
      expect(presenter.status()).toBe('ready');
    });

    it('AC-08: after a failed new code, entering QR again asks for a new code, not a confirmation', async () => {
      store.offerReceived();
      presenter.present({ url: `${WALLET}/t/old`, expiresAt: Date.now() - 1000 });
      journeyApi.newOffer.mockReturnValueOnce(problem('onboarding_unavailable', 503)).mockReturnValueOnce(of(ticketOffer('new')));
      await flow().newCode();

      await flow().enter();

      expect(journeyApi.newOffer).toHaveBeenCalledTimes(2);
      expect(journeyApi.confirmAndIssue).not.toHaveBeenCalled();
      expect(presenter.address()?.url).toBe(`${WALLET}/t/new`);
    });
  });

  describe('new code (AC-06)', () => {
    beforeEach(() => presenter.present({ url: `${WALLET}/t/old`, expiresAt: Date.now() - 1000 }));

    it('EC-07: a second click while the new code is being generated asks for no other', async () => {
      journeyApi.newOffer.mockReturnValue(new Subject<Offer>());
      const flowUnderTest = flow();

      void flowUnderTest.newCode();
      await flowUnderTest.newCode();

      expect(journeyApi.newOffer).toHaveBeenCalledTimes(1);
    });

    it('EC-07: asks for nothing while the code is still valid', async () => {
      presenter.present({ url: `${WALLET}/t/current`, expiresAt: Date.now() + 60_000 });

      await flow().newCode();

      expect(journeyApi.newOffer).not.toHaveBeenCalled();
    });

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

    const verification = (verified: boolean): Journey['email_verification'] => ({
      email: 'maria@example.org',
      verified,
      resend_available_at: IN_TEN_MINUTES(),
      sends_left: 2,
    });

    it('AC-02, AC-09: without an offer and with the email verified, confirms with no body and keeps the call to repeat it', async () => {
      const offer = ticketOffer();
      journeyApi.getJourney.mockReturnValue(journey({ step: 'email_verified', email_verification: verification(true) }));
      journeyApi.confirmAndIssue.mockReturnValue(of(offer));

      await flow().enter();

      expect(journeyApi.confirmAndIssue).toHaveBeenCalledWith();
      expect(presenter.address()?.url).toBe(offer.onboarding_url);
    });

    it('AC-09: after reloading with the email verified, a failed confirmation is repeated', async () => {
      journeyApi.getJourney.mockReturnValue(journey({ step: 'email_verified', email_verification: verification(true) }));
      journeyApi.confirmAndIssue.mockReturnValue(problem('onboarding_unavailable', 503));

      await flow().enter();

      expect(store.pendingCall()).toBe('confirmation');
      expect(navigate).toHaveBeenCalledWith(['/', 'error', 'onboarding-unavailable']);
    });

    it('AC-09: without an offer and without a code sent, goes back to Datos and does not confirm', async () => {
      journeyApi.getJourney.mockReturnValue(journey());

      await flow().enter();

      expect(navigate).toHaveBeenCalledWith(['/', 'user-data'], { replaceUrl: true });
      expect(journeyApi.confirmAndIssue).not.toHaveBeenCalled();
    });

    it('AC-09: without an offer and with the code pending, goes to Verificar correo and does not confirm', async () => {
      journeyApi.getJourney.mockReturnValue(journey({ email_verification: verification(false) }));

      await flow().enter();

      expect(navigate).toHaveBeenCalledWith(['/', 'verify-email'], { replaceUrl: true });
      expect(journeyApi.confirmAndIssue).not.toHaveBeenCalled();
    });

    it('AC-07: a new code asked after verifying (step email_verified, not verified) goes to Verificar correo', async () => {
      journeyApi.getJourney.mockReturnValue(journey({ step: 'email_verified', email_verification: verification(false) }));

      await flow().enter();

      expect(navigate).toHaveBeenCalledWith(['/', 'verify-email'], { replaceUrl: true });
      expect(journeyApi.confirmAndIssue).not.toHaveBeenCalled();
    });

    it('a completed journey with no offer goes to the issuance case instead of waiting forever', async () => {
      journeyApi.getJourney.mockReturnValue(journey({ state: 'completed', step: 'offer_obtained' }));

      await flow().enter();

      expect(navigate).toHaveBeenCalledWith(['/', 'error', 'issuance-failed'], { replaceUrl: true });
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
    beforeEach(() => store.requestConfirmation());

    it('ends the journey, forgets the pending call, discards the tokens and goes to Inicio', async () => {
      journeyApi.withdrawJourney.mockReturnValue(journey({ state: 'completed', step: 'offer_obtained' }));

      await flow().finish();

      expect(journeyApi.withdrawJourney).toHaveBeenCalledTimes(1);
      expect(store.pendingCall()).toBeNull();
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

      expect(store.pendingCall()).toBeNull();
      expect(navigate).not.toHaveBeenCalled();
    });

    it('W5: forgets the address with the ticket and stops the countdown', async () => {
      journeyApi.withdrawJourney.mockReturnValue(journey());
      presenter.present({ url: `${WALLET}/t/abc`, expiresAt: Date.now() + 60_000 });

      await flow().finish();

      expect(presenter.address()).toBeNull();
    });
  });
});
