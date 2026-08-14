import { TestBed } from '@angular/core/testing';
import { IdentificationReturnService } from './identification-return.service';
import { IssuanceStartSessionStore } from '../issuance-start/issuance-start-session.store';
import { TenantPortalConfigSource } from '../../core/config/tenant-portal-config.source';
import { CannotContinueReason } from '../issuance-start/cannot-continue-reason';
import { IssuanceStartSession } from '../issuance-start/issuance-start-session.model';

describe('IdentificationReturnService', () => {
  let service: IdentificationReturnService;
  let sessionStore: jest.Mocked<Pick<IssuanceStartSessionStore, 'read' | 'update'>>;
  let configSource: jest.Mocked<Pick<TenantPortalConfigSource, 'read'>>;

  const redirectedSession: IssuanceStartSession = {
    id: 'abc123',
    tenant: 'cgcom',
    state: 'redirigida',
    redirectedAt: Date.now() - 1000,
    expiresAt: Date.now() + 800_000,
    correlationToken: 'expected-token',
    redirectedMethod: 'certificate',
  };

  const cgcomLocation = { hostname: 'cgcom.eudistack.net', search: '?identified=1' };

  beforeEach(() => {
    sessionStore = { read: jest.fn(), update: jest.fn() };
    configSource = { read: jest.fn() };

    TestBed.configureTestingModule({
      providers: [
        IdentificationReturnService,
        { provide: IssuanceStartSessionStore, useValue: sessionStore },
        { provide: TenantPortalConfigSource, useValue: configSource },
        // NFR-S-164-03: no HttpClient is provided — a fake that throws on
        // any use, so the test fails if the evaluation path ever reaches
        // out over the network.
        { provide: 'HttpClient', useValue: { get: () => { throw new Error('must not use HttpClient'); } } },
      ],
    });
    service = TestBed.inject(IdentificationReturnService);
  });

  function withSameContextConfig(): void {
    configSource.read.mockReturnValue({
      identificationUrl: '/cert/',
      identificationCorrelationMode: 'same_context',
    });
  }

  it('initial state is out_of_scope before handleReturn() is ever invoked (AD-7)', () => {
    expect(service.outcome()).toBe('out_of_scope');
    expect(service.session()).toBeNull();
  });

  it('AC-03: a correlated return resumes the flow and seals consumedAt/retomada exactly once', () => {
    sessionStore.read.mockReturnValue(redirectedSession);
    sessionStore.update.mockReturnValue(true);
    withSameContextConfig();

    service.handleReturn(cgcomLocation);

    expect(service.outcome()).toBe('correlated');
    expect(service.session()?.state).toBe('retomada');
    expect(service.session()?.consumedAt).toBeDefined();
    expect(sessionStore.update).toHaveBeenCalledTimes(1);
    expect(sessionStore.update).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'retomada', consumedAt: expect.any(Number) }),
    );
  });

  it('AC-05: a session already sealed as "retomada" (a genuine second physical return) is rejected as already consumed', () => {
    const alreadyConsumed: IssuanceStartSession = {
      ...redirectedSession,
      state: 'retomada',
      consumedAt: Date.now() - 10,
    };
    sessionStore.read.mockReturnValue(alreadyConsumed);
    withSameContextConfig();

    service.handleReturn(cgcomLocation);

    expect(service.outcome()).toBe('rejected');
    expect(service.reason()).toBe(CannotContinueReason.ReturnAlreadyConsumed);
    expect(sessionStore.update).not.toHaveBeenCalled();
  });

  it('EC-01: same_context mode without an echoed reference still completes the round-trip', () => {
    sessionStore.read.mockReturnValue(redirectedSession);
    sessionStore.update.mockReturnValue(true);
    withSameContextConfig();

    service.handleReturn({ hostname: 'cgcom.eudistack.net', search: '?identified=1' });

    expect(service.outcome()).toBe('correlated');
  });

  it('EC-02: re-evaluating the same return in the current document load is idempotent and does not re-consume', () => {
    sessionStore.read.mockReturnValue(redirectedSession);
    sessionStore.update.mockReturnValue(true);
    withSameContextConfig();

    service.handleReturn(cgcomLocation);
    const firstOutcome = service.outcome();
    const firstSession = service.session();
    service.handleReturn(cgcomLocation);

    expect(service.outcome()).toBe(firstOutcome);
    expect(service.session()).toBe(firstSession);
    expect(sessionStore.update).toHaveBeenCalledTimes(1);
  });

  it('EC-05: does not double-consume when invoked from more than one consumer for the same load (guard + app.component)', () => {
    sessionStore.read.mockReturnValue(redirectedSession);
    sessionStore.update.mockReturnValue(true);
    withSameContextConfig();

    // Simula dos consumidores llamando handleReturn() para la misma carga.
    service.handleReturn(cgcomLocation);
    service.handleReturn(cgcomLocation);
    service.handleReturn(cgcomLocation);

    expect(sessionStore.update).toHaveBeenCalledTimes(1);
  });

  it('EC-04 (documented residual risk): a fresh evaluation with a not-yet-consumed session correlates normally — consumption is local to this context, not shared across duplicated tabs', () => {
    sessionStore.read.mockReturnValue(redirectedSession);
    sessionStore.update.mockReturnValue(true);
    withSameContextConfig();

    service.handleReturn(cgcomLocation);

    expect(service.outcome()).toBe('correlated');
  });

  it('NFR-S-164-03: the evaluation is fully synchronous — outcome() reflects the result immediately, no await required', () => {
    sessionStore.read.mockReturnValue(redirectedSession);
    sessionStore.update.mockReturnValue(true);
    withSameContextConfig();

    service.handleReturn(cgcomLocation);

    // Sin ningún await/microtask entre medias: si fuera asíncrono, esto
    // seguiría en 'out_of_scope' en este mismo turno.
    expect(service.outcome()).not.toBe('out_of_scope');
  });

  it('rejects with IdentificationConfigInvalid when the tenant config cannot be resolved, without ever reading validateIdentificationReturn\'s own reasons', () => {
    sessionStore.read.mockReturnValue(redirectedSession);
    configSource.read.mockReturnValue(null);

    service.handleReturn(cgcomLocation);

    expect(service.outcome()).toBe('rejected');
    expect(service.reason()).toBe(CannotContinueReason.IdentificationConfigInvalid);
  });

  it('/code-review F1 (AC-05, fail-closed): does not publish "correlated" when sealing consumedAt fails to persist', () => {
    sessionStore.read.mockReturnValue(redirectedSession);
    sessionStore.update.mockReturnValue(false);
    withSameContextConfig();

    service.handleReturn(cgcomLocation);

    expect(service.outcome()).toBe('rejected');
    expect(service.reason()).toBe(CannotContinueReason.Unknown);
    // La sesión sin consumir se sigue publicando para que el aviso pueda
    // referenciarla, pero NUNCA con estado 'retomada'/consumedAt sellado.
    expect(service.session()).toBe(redirectedSession);
  });

  describe('reset() — /code-review F2', () => {
    it('returns to the initial out_of_scope state and allows a fresh evaluation', () => {
      sessionStore.read.mockReturnValue(redirectedSession);
      sessionStore.update.mockReturnValue(true);
      withSameContextConfig();
      service.handleReturn(cgcomLocation);
      expect(service.outcome()).toBe('correlated');

      service.reset();

      expect(service.outcome()).toBe('out_of_scope');
      expect(service.session()).toBeNull();
      expect(service.reason()).toBeNull();
    });

    it('after reset(), a rejected outcome no longer blocks out-of-scope methods reaching user-data via the guard', () => {
      sessionStore.read.mockReturnValue(null); // sin sesión → rechazo
      withSameContextConfig();
      service.handleReturn(cgcomLocation);
      expect(service.outcome()).toBe('rejected');

      service.reset();

      // Tras el reset, sin una nueva llamada a handleReturn() (p.ej. el
      // titular eligió un método fuera de alcance, que no pasa por esta
      // rama), el outcome vuelve a out_of_scope — el guard lo permite (AC-08).
      expect(service.outcome()).toBe('out_of_scope');
    });
  });
});
