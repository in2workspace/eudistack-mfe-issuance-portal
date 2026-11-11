import { TestBed } from '@angular/core/testing';
import { JourneyIssuanceStore } from './journey-issuance.store';

describe('JourneyIssuanceStore', () => {
  let store: JourneyIssuanceStore;

  beforeEach(() => {
    store = TestBed.inject(JourneyIssuanceStore);
  });

  it('starts empty', () => {
    expect(store.email()).toBeNull();
    expect(store.pendingCall()).toBeNull();
    expect(store.emailRejected()).toBe(false);
  });

  it('confirming keeps the email and asks for the confirmation', () => {
    store.rejectEmail();

    store.confirm('maria@example.org');

    expect(store.email()).toBe('maria@example.org');
    expect(store.pendingCall()).toBe('confirmation');
    expect(store.emailRejected()).toBe(false);
  });

  it('a new code keeps the email and asks for a new offer', () => {
    store.confirm('maria@example.org');

    store.requestNewOffer();

    expect(store.email()).toBe('maria@example.org');
    expect(store.pendingCall()).toBe('offers');
  });

  it('an offer received leaves nothing to call', () => {
    store.confirm('maria@example.org');

    store.offerReceived();

    expect(store.pendingCall()).toBeNull();
  });

  it('a rejected email is marked and leaves nothing to call', () => {
    store.confirm('maria@example.org');

    store.rejectEmail();

    expect(store.emailRejected()).toBe(true);
    expect(store.pendingCall()).toBeNull();
  });

  it('NFR-1: clearing forgets everything', () => {
    store.confirm('maria@example.org');
    store.rejectEmail();

    store.clear();

    expect(store.email()).toBeNull();
    expect(store.pendingCall()).toBeNull();
    expect(store.emailRejected()).toBe(false);
  });
});
