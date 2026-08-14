import { TestBed } from '@angular/core/testing';
import { IdentificationRedirectService } from './identification-redirect.service';
import { IssuanceStartSessionStore } from '../issuance-start/issuance-start-session.store';
import { TenantPortalConfigSource } from '../../core/config/tenant-portal-config.source';
import { ExternalNavigator } from '../../core/services/external-navigator.service';
import { CannotContinueReason } from '../issuance-start/cannot-continue-reason';
import { IssuanceStartSession } from '../issuance-start/issuance-start-session.model';

describe('IdentificationRedirectService', () => {
  let service: IdentificationRedirectService;
  let sessionStore: jest.Mocked<Pick<IssuanceStartSessionStore, 'read' | 'update'>>;
  let configSource: jest.Mocked<Pick<TenantPortalConfigSource, 'read'>>;
  let externalNavigator: jest.Mocked<ExternalNavigator>;

  const activeSession: IssuanceStartSession = { id: 'abc123', tenant: 'cgcom', state: 'iniciada' };

  beforeEach(() => {
    sessionStore = { read: jest.fn(), update: jest.fn() };
    configSource = { read: jest.fn() };
    externalNavigator = { redirect: jest.fn() } as unknown as jest.Mocked<ExternalNavigator>;

    TestBed.configureTestingModule({
      providers: [
        IdentificationRedirectService,
        { provide: IssuanceStartSessionStore, useValue: sessionStore },
        { provide: TenantPortalConfigSource, useValue: configSource },
        { provide: ExternalNavigator, useValue: externalNavigator },
      ],
    });
    service = TestBed.inject(IdentificationRedirectService);
  });

  function withValidConfig(): void {
    configSource.read.mockReturnValue({
      identificationUrl: '/cert/?method=certificate',
      identificationCorrelationMode: 'same_context',
    });
  }

  it('happy path: seals "redirigida" with a fresh correlation token and expiry, then navigates (AC-01, AC-02)', () => {
    sessionStore.read.mockReturnValue(activeSession);
    sessionStore.update.mockReturnValue(true);
    withValidConfig();

    const reason = service.redirectToIdentification();

    expect(reason).toBeNull();
    expect(sessionStore.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'abc123',
        tenant: 'cgcom',
        state: 'redirigida',
        redirectedMethod: 'certificate',
        correlationToken: expect.any(String),
        redirectedAt: expect.any(Number),
        expiresAt: expect.any(Number),
      }),
    );
    expect(externalNavigator.redirect).toHaveBeenCalledWith('/cert/?method=certificate');
  });

  it('EC-05: reuses whatever start session is already active in this context — it never creates one', () => {
    sessionStore.read.mockReturnValue(activeSession);
    sessionStore.update.mockReturnValue(true);
    withValidConfig();

    service.redirectToIdentification();

    expect(sessionStore.update).toHaveBeenCalledWith(expect.objectContaining({ id: activeSession.id }));
  });

  it('ES-07: without a start session in the context, does not navigate and returns StartSessionAbsent', () => {
    sessionStore.read.mockReturnValue(null);
    withValidConfig();

    const reason = service.redirectToIdentification();

    expect(reason).toBe(CannotContinueReason.StartSessionAbsent);
    expect(externalNavigator.redirect).not.toHaveBeenCalled();
    expect(sessionStore.update).not.toHaveBeenCalled();
  });

  it('ES-01/ES-02: with an invalid or absent tenant config, does not navigate and returns IdentificationConfigInvalid, without a default destination', () => {
    sessionStore.read.mockReturnValue(activeSession);
    configSource.read.mockReturnValue(null);

    const reason = service.redirectToIdentification();

    expect(reason).toBe(CannotContinueReason.IdentificationConfigInvalid);
    expect(externalNavigator.redirect).not.toHaveBeenCalled();
    expect(sessionStore.update).not.toHaveBeenCalled();
  });

  it('ES-05: aborts without navigating when sealing the session fails (fail-closed — a later return would not be correlatable)', () => {
    sessionStore.read.mockReturnValue(activeSession);
    sessionStore.update.mockReturnValue(false);
    withValidConfig();

    const reason = service.redirectToIdentification();

    expect(reason).toBe(CannotContinueReason.Unknown);
    expect(externalNavigator.redirect).not.toHaveBeenCalled();
  });

  it('double-activation guard: a second call while a redirect is in flight is a no-op', () => {
    sessionStore.read.mockReturnValue(activeSession);
    sessionStore.update.mockReturnValue(true);
    withValidConfig();

    service.redirectToIdentification();
    const secondCall = service.redirectToIdentification();

    expect(secondCall).toBeNull();
    expect(externalNavigator.redirect).toHaveBeenCalledTimes(1);
  });
});
