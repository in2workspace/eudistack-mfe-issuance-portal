import { TestBed } from '@angular/core/testing';
import { JourneyIssuanceStore } from './journey-issuance.store';

describe('JourneyIssuanceStore', () => {
  let store: JourneyIssuanceStore;

  beforeEach(() => {
    store = TestBed.inject(JourneyIssuanceStore);
  });

  it('starts with nothing to call', () => {
    expect(store.pending()).toBeNull();
  });

  it('EUD-358: holds no email, the verified one lives in the service', () => {
    expect('email' in store).toBe(false);
    expect('confirm' in store).toBe(false);
  });

  it('with the email verified, asks for the confirmation of the request', () => {
    store.requestConfirmation('r1');

    expect(store.pending()).toEqual({ call: 'confirmation', requestId: 'r1' });
  });

  it('a new code asks for a new offer of the request', () => {
    store.requestConfirmation('r1');

    store.requestNewOffer('r2');

    expect(store.pending()).toEqual({ call: 'offers', requestId: 'r2' });
  });

  it('an offer received leaves nothing to call', () => {
    store.requestConfirmation('r1');

    store.offerReceived();

    expect(store.pending()).toBeNull();
  });

  it('NFR-1: clearing forgets everything', () => {
    store.requestNewOffer('r1');

    store.clear();

    expect(store.pending()).toBeNull();
  });
});
