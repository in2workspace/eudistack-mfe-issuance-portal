import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { IssuanceStartService } from './issuance-start.service';
import { IssuanceStartSessionStore } from './issuance-start-session.store';
import { CannotContinueReason } from './cannot-continue-reason';

describe('IssuanceStartService', () => {
  let service: IssuanceStartService;
  let sessionStore: jest.Mocked<IssuanceStartSessionStore>;
  let router: jest.Mocked<Router>;

  beforeEach(() => {
    sessionStore = { create: jest.fn(), read: jest.fn() } as unknown as jest.Mocked<IssuanceStartSessionStore>;
    router = { navigate: jest.fn() } as unknown as jest.Mocked<Router>;

    TestBed.configureTestingModule({
      providers: [
        IssuanceStartService,
        { provide: IssuanceStartSessionStore, useValue: sessionStore },
        { provide: Router, useValue: router },
      ],
    });
    service = TestBed.inject(IssuanceStartService);
  });

  it('happy path: creates a session and navigates to the identification method screen (AC-02)', () => {
    sessionStore.create.mockReturnValue(true);

    service.start('cgcom');

    expect(sessionStore.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenant: 'cgcom', state: 'iniciada', id: expect.any(String) }),
    );
    expect(router.navigate).toHaveBeenCalledWith(['/portal/identify']);
    expect(service.cannotContinueReason()).toBeNull();
  });

  it('double-submit guard: a second activation before completion does not create a second session or navigate again (EC-02)', () => {
    sessionStore.create.mockReturnValue(true);

    service.start('cgcom');
    service.start('cgcom');

    expect(sessionStore.create).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledTimes(1);
  });

  it('forces the fail-closed state without navigating when session persistence fails (ES-03)', () => {
    sessionStore.create.mockReturnValue(false);

    service.start('cgcom');

    expect(router.navigate).not.toHaveBeenCalled();
    expect(service.cannotContinueReason()).toBe(CannotContinueReason.Unknown);
  });

  it('retry() clears the failure reason (AC-06)', () => {
    sessionStore.create.mockReturnValue(false);
    service.start('cgcom');
    expect(service.cannotContinueReason()).not.toBeNull();

    service.retry();

    expect(service.cannotContinueReason()).toBeNull();
  });
});
