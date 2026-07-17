import { TestBed } from '@angular/core/testing';
import { IssuanceStartService } from './issuance-start.service';
import { IssuanceStartSessionStore } from './issuance-start-session.store';
import { ExternalNavigator } from '../../core/services/external-navigator.service';
import { IssuanceStartSession } from './issuance-start-session.model';

describe('IssuanceStartService', () => {
  let service: IssuanceStartService;
  let sessionStore: jest.Mocked<IssuanceStartSessionStore>;
  let navigator: jest.Mocked<ExternalNavigator>;

  const aSession: IssuanceStartSession = { id: 'abc123', tenant: 'cgcom', state: 'iniciada' };

  beforeEach(() => {
    sessionStore = { create: jest.fn() } as unknown as jest.Mocked<IssuanceStartSessionStore>;
    navigator = { redirect: jest.fn() } as unknown as jest.Mocked<ExternalNavigator>;

    TestBed.configureTestingModule({
      providers: [
        IssuanceStartService,
        { provide: IssuanceStartSessionStore, useValue: sessionStore },
        { provide: ExternalNavigator, useValue: navigator },
      ],
    });
    service = TestBed.inject(IssuanceStartService);
  });

  it('happy path: creates a session and navigates via ExternalNavigator (AC-02)', () => {
    sessionStore.create.mockReturnValue(aSession);

    service.start('cgcom');

    expect(sessionStore.create).toHaveBeenCalledWith('cgcom');
    expect(navigator.redirect).toHaveBeenCalledTimes(1);
    expect(service.cannotContinueReason()).toBeNull();
  });

  it('double-submit guard: a second activation before completion does not create a second session or navigate again (EC-02)', () => {
    sessionStore.create.mockReturnValue(aSession);

    service.start('cgcom');
    service.start('cgcom');

    expect(sessionStore.create).toHaveBeenCalledTimes(1);
    expect(navigator.redirect).toHaveBeenCalledTimes(1);
  });

  it('forces the fail-closed state without navigating when session creation returns null (ES-03)', () => {
    sessionStore.create.mockReturnValue(null);

    service.start('cgcom');

    expect(navigator.redirect).not.toHaveBeenCalled();
    expect(service.cannotContinueReason()).not.toBeNull();
  });

  it('retry() clears the failure reason (AC-06)', () => {
    sessionStore.create.mockReturnValue(null);
    service.start('cgcom');
    expect(service.cannotContinueReason()).not.toBeNull();

    service.retry();

    expect(service.cannotContinueReason()).toBeNull();
  });
});
