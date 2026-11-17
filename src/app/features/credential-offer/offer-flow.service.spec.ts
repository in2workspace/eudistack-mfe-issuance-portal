import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Observable, of, Subject, throwError } from 'rxjs';
import { ApiProblemError, NETWORK_ERROR } from '../../core/api/api-problem.error';
import { Journey, JourneyApi, JourneyRequest, Offer, PortalConfig } from '../../core/api/generated/journey';
import { PortalConfigService } from '../../core/config/portal-config.service';
import { JourneyIssuanceStore } from '../../core/journey/journey-issuance.store';
import { JourneyNavigator } from '../../core/journey/journey-navigator';
import { SESSION_ACTIONS } from '../../core/session/session-actions';
import { CredentialOfferService } from './credential-offer.service';
import { OfferFlowService } from './offer-flow.service';

const WALLET = 'https://wallet.sandbox.dev.eudistack.net';
const OFFER_URI = 'https://sandbox.dev.eudistack.net/issuer/credential-offer/abc';
const IN_TEN_MINUTES = () => new Date(Date.now() + 600_000).toISOString();
/** La solicitud de la ruta de QR. */
const RID = 'r2';

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
  let journeyApi: { getJourney: jest.Mock; confirmAndIssue: jest.Mock; newOffer: jest.Mock; declareRequestSaved: jest.Mock };
  let discardTokens: jest.Mock;
  let toSessionExpired: jest.Mock;
  let navigate: jest.SpyInstance;
  let walletUrl: string | undefined;
  let store: JourneyIssuanceStore;
  let presenter: CredentialOfferService;

  beforeEach(() => {
    walletUrl = WALLET;
    journeyApi = { getJourney: jest.fn(), confirmAndIssue: jest.fn(), newOffer: jest.fn(), declareRequestSaved: jest.fn() };
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

  const verification = (verified: boolean): Journey['email_verification'] => ({
    email: 'maria@example.org',
    verified,
    resend_available_at: IN_TEN_MINUTES(),
    sends_left: 2,
  });

  /** `GET /journey` con el correo verificado y las solicitudes dadas; sin el correo verificado con `verified: false`. */
  function journey(requests: JourneyRequest[] = [], overrides: Partial<Journey> = {}): Observable<Journey> {
    return of({
      state: 'in_progress',
      step: 'email_verified',
      email_verification: verification(true),
      requests,
      ...overrides,
    });
  }

  const other: JourneyRequest = { id: 'r1', status: 'available' };

  describe('with the confirmation pending', () => {
    beforeEach(() => store.requestConfirmation(RID));

    it('AC-02: confirms the request and presents the onboarding address as it comes', async () => {
      const offer = ticketOffer();
      journeyApi.confirmAndIssue.mockReturnValue(of(offer));

      await flow().enter(RID);

      expect(journeyApi.confirmAndIssue).toHaveBeenCalledWith({ request_id: RID });
      expect(journeyApi.newOffer).not.toHaveBeenCalled();
      expect(presenter.status()).toBe('ready');
      expect(presenter.address()?.url).toBe(offer.onboarding_url);
      expect(store.pending()).toBeNull();
    });

    it('AC-04: without onboarding_url presents the wallet address built with the offer', async () => {
      journeyApi.confirmAndIssue.mockReturnValue(of(plainOffer()));

      await flow().enter(RID);

      expect(presenter.address()?.url).toBe(
        `${WALLET}/protocol/callback?credential_offer_uri=${encodeURIComponent(OFFER_URI)}`,
      );
    });

    it('shows QR (generando) while the confirmation runs', () => {
      journeyApi.confirmAndIssue.mockReturnValue(new Subject<Offer>());

      void flow().enter(RID);

      expect(presenter.status()).toBe('loading');
    });

    it.each([
      ['issuance_rejected', 502, 'issuance-failed'],
      ['issuance_unavailable', 503, 'issuance-failed'],
      [NETWORK_ERROR, 0, 'issuance-failed'],
      ['onboarding_unavailable', 503, 'onboarding-unavailable'],
    ])('ES-01, AC-08: %s goes to the %s case and keeps the confirmation to repeat it', async (type, status, reason) => {
      journeyApi.confirmAndIssue.mockReturnValue(problem(type, status));

      await flow().enter(RID);

      expect(navigate).toHaveBeenCalledWith(['/', 'error', reason]);
      expect(store.pending()).toEqual({ call: 'confirmation', requestId: RID });
      expect(presenter.address()).toBeNull();
    });

    it('AC-09: with onboarding_unavailable never presents an address', async () => {
      journeyApi.confirmAndIssue.mockReturnValue(problem('onboarding_unavailable', 503));

      await flow().enter(RID);

      expect(presenter.address()).toBeNull();
      expect(presenter.status()).toBe('loading');
    });

    it('AC-08: request_saved on the confirmation forgets the pending call and shows it is already saved, keeping the tokens', async () => {
      journeyApi.confirmAndIssue.mockReturnValue(problem('request_saved', 409));

      await flow().enter(RID);

      expect(store.pending()).toBeNull();
      expect(discardTokens).not.toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith(['/', 'error', 'request-saved']);
    });

    it.each([
      ['journey_closed', 410],
      ['unauthenticated', 401],
    ])('ES-06: %s is left to the journey interceptor or the login', async (type, status) => {
      journeyApi.confirmAndIssue.mockReturnValue(problem(type, status));

      await flow().enter(RID);

      expect(navigate).not.toHaveBeenCalled();
      expect(journeyApi.getJourney).not.toHaveBeenCalled();
    });

    it('W2: step_not_allowed on a repeated confirmation presents the offer the service already holds', async () => {
      const current = ticketOffer('current');
      journeyApi.confirmAndIssue.mockReturnValue(problem('step_not_allowed', 409));
      journeyApi.getJourney.mockReturnValue(
        journey([{ id: RID, status: 'in_offer', offer: current }], { state: 'completed', step: 'offer_obtained' }),
      );

      await flow().enter(RID);

      expect(presenter.address()?.url).toBe(current.onboarding_url);
      expect(store.pending()).toBeNull();
      expect(navigate).not.toHaveBeenCalled();
    });

    it('W2: step_not_allowed with the step elsewhere is left to the journey interceptor', async () => {
      journeyApi.confirmAndIssue.mockReturnValue(problem('step_not_allowed', 409));
      journeyApi.getJourney.mockReturnValue(journey([], { step: 'identified', email_verification: undefined }));

      await flow().enter(RID);

      expect(navigate).not.toHaveBeenCalled();
    });

    it('ES-03: with no wallet_url and no onboarding_url goes to the issuance case, without QR', async () => {
      walletUrl = undefined;
      journeyApi.confirmAndIssue.mockReturnValue(of(plainOffer()));

      await flow().enter(RID);

      expect(presenter.address()).toBeNull();
      expect(navigate).toHaveBeenCalledWith(['/', 'error', 'issuance-failed']);
    });

    it('B1, ES-03: an onboarding address outside the tenant wallet goes to the issuance case, without QR', async () => {
      journeyApi.confirmAndIssue.mockReturnValue(of({ ...ticketOffer(), onboarding_url: 'javascript:alert(document.domain)' }));

      await flow().enter(RID);

      expect(presenter.address()).toBeNull();
      expect(navigate).toHaveBeenCalledWith(['/', 'error', 'issuance-failed']);
    });

    it('does not present or navigate once the holder has left QR', async () => {
      const response = new Subject<Offer>();
      journeyApi.confirmAndIssue.mockReturnValue(response);
      const fixture = TestBed.createComponent(HostComponent);
      const entering = fixture.componentInstance.flow.enter(RID);

      fixture.destroy();
      response.next(ticketOffer());
      response.complete();
      await entering;

      expect(presenter.address()).toBeNull();
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('repeating the call that failed (EC-04)', () => {
    it('AC-08, EC-05: after a failed confirmation, entering QR again repeats the confirmation of the same request', async () => {
      store.requestConfirmation(RID);
      journeyApi.confirmAndIssue.mockReturnValueOnce(problem('onboarding_unavailable', 503)).mockReturnValueOnce(of(ticketOffer()));
      await flow().enter(RID);

      await flow().enter(RID);

      expect(journeyApi.confirmAndIssue).toHaveBeenNthCalledWith(2, { request_id: RID });
      expect(journeyApi.newOffer).not.toHaveBeenCalled();
      expect(presenter.status()).toBe('ready');
    });

    it('AC-08: after a failed new code, entering QR again asks for a new code, not a confirmation', async () => {
      store.offerReceived();
      presenter.present({ url: `${WALLET}/t/old`, expiresAt: Date.now() - 1000 });
      journeyApi.newOffer.mockReturnValueOnce(problem('onboarding_unavailable', 503)).mockReturnValueOnce(of(ticketOffer('new')));
      await flow().newCode(RID);

      await flow().enter(RID);

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

      void flowUnderTest.newCode(RID);
      await flowUnderTest.newCode(RID);

      expect(journeyApi.newOffer).toHaveBeenCalledTimes(1);
    });

    it('EC-07: asks for nothing while the code is still valid', async () => {
      presenter.present({ url: `${WALLET}/t/current`, expiresAt: Date.now() + 60_000 });

      await flow().newCode(RID);

      expect(journeyApi.newOffer).not.toHaveBeenCalled();
    });

    it('asks POST /journey/offers and presents the new address', async () => {
      journeyApi.newOffer.mockReturnValue(of(ticketOffer('new')));

      await flow().newCode(RID);

      expect(journeyApi.newOffer).toHaveBeenCalledTimes(1);
      expect(presenter.address()?.url).toBe(`${WALLET}/t/new`);
      expect(store.pending()).toBeNull();
    });

    it('AC-08: request_saved on a new code shows it is already saved, keeping the tokens', async () => {
      journeyApi.newOffer.mockReturnValue(problem('request_saved', 409));

      await flow().newCode(RID);

      expect(navigate).toHaveBeenCalledWith(['/', 'error', 'request-saved']);
      expect(discardTokens).not.toHaveBeenCalled();
    });

    it('ES-02: step_not_allowed presents again the offer the service still holds, without the error screen', async () => {
      const current = ticketOffer('current');
      journeyApi.newOffer.mockReturnValue(problem('step_not_allowed', 409));
      journeyApi.getJourney.mockReturnValue(
        journey([{ id: RID, status: 'in_offer', offer: current }], { state: 'completed', step: 'offer_obtained' }),
      );

      await flow().newCode(RID);

      expect(presenter.status()).toBe('ready');
      expect(presenter.address()?.url).toBe(current.onboarding_url);
      expect(store.pending()).toBeNull();
      expect(navigate).not.toHaveBeenCalled();
    });

    it('asks the new code for the request of the route, not for another one', async () => {
      journeyApi.newOffer.mockReturnValue(of(ticketOffer('new')));

      await flow().newCode(RID);

      expect(journeyApi.newOffer).toHaveBeenCalledWith({ request_id: RID });
    });
  });

  describe('entering QR with nothing pending', () => {
    const inOffer = (offer?: Offer): JourneyRequest[] => [other, { id: RID, status: 'in_offer', offer }];

    it('EC-02, EC-06: after a reload, presents the offer of the request GET /journey gives, without asking for another', async () => {
      const current = ticketOffer('current');
      journeyApi.getJourney.mockReturnValue(journey(inOffer(current), { state: 'completed', step: 'offer_obtained' }));

      await flow().enter(RID);

      expect(presenter.address()?.url).toBe(current.onboarding_url);
      expect(journeyApi.confirmAndIssue).not.toHaveBeenCalled();
      expect(journeyApi.newOffer).not.toHaveBeenCalled();
    });

    it('EC-02: an offer already expired is presented expired', async () => {
      const expired = { ...ticketOffer(), onboarding_expires_at: new Date(Date.now() - 1000).toISOString() };
      journeyApi.getJourney.mockReturnValue(journey(inOffer(expired), { state: 'completed', step: 'offer_obtained' }));

      await flow().enter(RID);

      expect(presenter.status()).toBe('expired');
    });

    it('presents the offer of the request of the route, not the one of another request', async () => {
      const mine = ticketOffer('mine');
      journeyApi.getJourney.mockReturnValue(
        journey(
          [
            { id: 'r1', status: 'in_offer', offer: ticketOffer('other') },
            { id: RID, status: 'in_offer', offer: mine },
          ],
          { state: 'completed', step: 'offer_obtained' },
        ),
      );

      await flow().enter(RID);

      expect(presenter.address()?.url).toBe(mine.onboarding_url);
    });

    it('AC-02, AC-09: with the request available and the email verified, confirms that request and keeps the call to repeat it', async () => {
      const offer = ticketOffer();
      journeyApi.getJourney.mockReturnValue(journey([other, { id: RID, status: 'available' }]));
      journeyApi.confirmAndIssue.mockReturnValue(of(offer));

      await flow().enter(RID);

      expect(journeyApi.confirmAndIssue).toHaveBeenCalledWith({ request_id: RID });
      expect(presenter.address()?.url).toBe(offer.onboarding_url);
    });

    it('AC-09: after reloading with the request available, a failed confirmation is repeated for the same request', async () => {
      journeyApi.getJourney.mockReturnValue(journey([{ id: RID, status: 'available' }]));
      journeyApi.confirmAndIssue.mockReturnValue(problem('onboarding_unavailable', 503));

      await flow().enter(RID);

      expect(store.pending()).toEqual({ call: 'confirmation', requestId: RID });
      expect(navigate).toHaveBeenCalledWith(['/', 'error', 'onboarding-unavailable']);
    });

    it('a pending call of another request does not decide this one', async () => {
      store.requestConfirmation('r1');
      journeyApi.getJourney.mockReturnValue(
        journey([
          { id: 'r1', status: 'available' },
          { id: RID, status: 'available' },
        ]),
      );
      journeyApi.confirmAndIssue.mockReturnValue(of(ticketOffer()));

      await flow().enter(RID);

      expect(journeyApi.confirmAndIssue).toHaveBeenCalledTimes(1);
      expect(journeyApi.confirmAndIssue).toHaveBeenCalledWith({ request_id: RID });
    });

    it('EC-07: a request in the process with no offer (the onboarding failed) asks for a new offer, not a confirmation', async () => {
      journeyApi.getJourney.mockReturnValue(journey(inOffer(), { state: 'completed', step: 'offer_obtained' }));
      journeyApi.newOffer.mockReturnValue(of(ticketOffer('new')));

      await flow().enter(RID);

      expect(journeyApi.newOffer).toHaveBeenCalledWith({ request_id: RID });
      expect(journeyApi.confirmAndIssue).not.toHaveBeenCalled();
      expect(presenter.address()?.url).toBe(`${WALLET}/t/new`);
    });

    it('AC-09: without the email verified, goes to Correo and does not confirm', async () => {
      journeyApi.getJourney.mockReturnValue(
        journey([{ id: RID, status: 'available' }], { step: 'entitlement_confirmed', email_verification: undefined }),
      );

      await flow().enter(RID);

      expect(navigate).toHaveBeenCalledWith(['/', 'email'], { replaceUrl: true });
      expect(journeyApi.confirmAndIssue).not.toHaveBeenCalled();
    });

    it('AC-07: a new code asked after verifying (not verified again) goes to Correo and does not confirm', async () => {
      journeyApi.getJourney.mockReturnValue(
        journey([{ id: RID, status: 'available' }], { email_verification: verification(false) }),
      );

      await flow().enter(RID);

      expect(navigate).toHaveBeenCalledWith(['/', 'email'], { replaceUrl: true });
      expect(journeyApi.confirmAndIssue).not.toHaveBeenCalled();
    });

    it.each<[string, JourneyRequest[]]>([
      ['a request that is not of the journey', [other, { id: 'r3', status: 'saved' }]],
      ['a request saved', [{ id: RID, status: 'saved' }]],
      ['a request not available', [{ id: RID, status: 'not_available', not_available_reason: 'under_review' }]],
    ])('EC-07: %s goes to the step GET /journey says and confirms nothing', async (_name, requests) => {
      journeyApi.getJourney.mockReturnValue(journey(requests, { state: 'completed', step: 'offer_obtained' }));

      await flow().enter(RID);

      expect(navigate).toHaveBeenCalledWith(['/', 'requests'], { replaceUrl: true });
      expect(journeyApi.confirmAndIssue).not.toHaveBeenCalled();
      expect(journeyApi.newOffer).not.toHaveBeenCalled();
    });

    it('a 410 from GET /journey goes to the session expired case', async () => {
      journeyApi.getJourney.mockReturnValue(problem('journey_closed', 410));

      await flow().enter(RID);

      expect(toSessionExpired).toHaveBeenCalledTimes(1);
    });

    it('another failure of GET /journey goes to Inicio', async () => {
      journeyApi.getJourney.mockReturnValue(problem(NETWORK_ERROR, 0));

      await flow().enter(RID);

      expect(navigate).toHaveBeenCalledWith(['/']);
    });
  });

  describe('Ya lo he guardado (AD-10, AC-05, AC-14)', () => {
    beforeEach(() => store.requestConfirmation(RID));

    it('declares the request of the route saved, with no body, and goes to Solicitudes if any request is pending', async () => {
      journeyApi.declareRequestSaved.mockReturnValue(of(undefined));
      journeyApi.getJourney.mockReturnValue(
        journey([{ id: RID, status: 'saved' }, other], { state: 'completed', step: 'offer_obtained' }),
      );

      expect(await flow().declareSaved(RID)).toBe(true);

      expect(journeyApi.declareRequestSaved).toHaveBeenCalledWith(RID);
      expect(navigate).toHaveBeenCalledWith(['/', 'requests']);
      expect(store.pending()).toBeNull();
      expect(discardTokens).not.toHaveBeenCalled();
    });

    it('AC-09: with no request pending goes to Final', async () => {
      journeyApi.declareRequestSaved.mockReturnValue(of(undefined));
      journeyApi.getJourney.mockReturnValue(
        journey(
          [
            { id: RID, status: 'saved' },
            { id: 'r1', status: 'not_available', not_available_reason: 'under_review' },
          ],
          { state: 'completed', step: 'offer_obtained' },
        ),
      );

      await flow().declareSaved(RID);

      expect(navigate).toHaveBeenCalledWith(['/', 'done']);
    });

    it('a request in the process still counts as pending', async () => {
      journeyApi.declareRequestSaved.mockReturnValue(of(undefined));
      journeyApi.getJourney.mockReturnValue(
        journey([{ id: RID, status: 'saved' }, { id: 'r1', status: 'in_offer', offer: ticketOffer() }]),
      );

      await flow().declareSaved(RID);

      expect(navigate).toHaveBeenCalledWith(['/', 'requests']);
    });

    it('W5: forgets the address with the ticket and stops the countdown once it has gone on', async () => {
      journeyApi.declareRequestSaved.mockReturnValue(of(undefined));
      journeyApi.getJourney.mockReturnValue(journey([{ id: RID, status: 'saved' }]));
      presenter.present({ url: `${WALLET}/t/abc`, expiresAt: Date.now() + 60_000 });

      await flow().declareSaved(RID);

      expect(presenter.address()).toBeNull();
    });

    it.each([
      ['step_not_allowed', 409],
      ['journey_closed', 410],
    ])('AC-14, ES-08: %s is left to the journey interceptor: no navigation here, and the call is not repeated', async (type, status) => {
      journeyApi.declareRequestSaved.mockReturnValue(problem(type, status));

      expect(await flow().declareSaved(RID)).toBe(false);

      expect(navigate).not.toHaveBeenCalled();
      expect(journeyApi.getJourney).not.toHaveBeenCalled();
    });

    it('another failure leaves the holder in QR, able to press it again', async () => {
      journeyApi.declareRequestSaved.mockReturnValue(problem(NETWORK_ERROR, 0));

      expect(await flow().declareSaved(RID)).toBe(false);

      expect(navigate).not.toHaveBeenCalled();
    });

    it('a failure of GET /journey after the 204 is left to the usual handling: 410 expires the session', async () => {
      journeyApi.declareRequestSaved.mockReturnValue(of(undefined));
      journeyApi.getJourney.mockReturnValue(problem('journey_closed', 410));

      await flow().declareSaved(RID);

      expect(toSessionExpired).toHaveBeenCalledTimes(1);
    });
  });
});
