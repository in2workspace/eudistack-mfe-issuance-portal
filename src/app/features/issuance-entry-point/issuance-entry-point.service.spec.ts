import { TestBed } from '@angular/core/testing';
import { TenantPortalConfigSource } from '../../core/config/tenant-portal-config.source';
import { CannotContinueReason } from '../issuance-start/cannot-continue-reason';
import type { IssuanceStartSession } from '../issuance-start/issuance-start-session.model';
import { IssuanceStartSessionStore } from '../issuance-start/issuance-start-session.store';
import { IssuanceEntryPointService } from './issuance-entry-point.service';
import { StartConfiguredEntryPointService } from './start-configured-entry-point.service';

type SourceOverrides = {
  tenantId?: string | null;
  entryPoint?: unknown;
  hasConfig?: boolean;
};

function setup(overrides: SourceOverrides = {}) {
  const hasConfig = overrides.hasConfig ?? overrides.entryPoint !== undefined;

  const source: Pick<TenantPortalConfigSource, 'read' | 'currentTenant'> = {
    read: jest.fn(() =>
      hasConfig ? { entryPoint: overrides.entryPoint } : null,
    ),
    currentTenant: jest.fn(() => overrides.tenantId ?? 'cgcom'),
  };

  const store: Pick<IssuanceStartSessionStore, 'read' | 'create'> = {
    read: jest.fn<IssuanceStartSession | null, []>(() => null),
    create: jest.fn(),
  };

  const dispatcher = { start: jest.fn(async () => ({ ok: true as const })) };

  TestBed.configureTestingModule({
    providers: [
      IssuanceEntryPointService,
      { provide: TenantPortalConfigSource, useValue: source },
      { provide: IssuanceStartSessionStore, useValue: store },
      { provide: StartConfiguredEntryPointService, useValue: dispatcher },
    ],
  });

  return {
    service: TestBed.inject(IssuanceEntryPointService),
    dispatcher,
    source,
    store,
  };
}

describe('IssuanceEntryPointService', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('AC-05: evaluar el arranque más de una vez arranca el punto de entrada una sola vez, con resultado idéntico', async () => {
    const { service, dispatcher } = setup({ entryPoint: 'WITH_VALIDATION' });
    const session: IssuanceStartSession = {
      id: 's1',
      tenant: 'cgcom',
      state: 'started',
    };

    await service.start({ correlated: true, session });
    const first = service.status();
    await service.start({ correlated: true, session });
    const second = service.status();

    expect(first).toBe('started');
    expect(second).toBe('started');
    expect(dispatcher.start).toHaveBeenCalledTimes(1); // idempotente por sesión
    expect(dispatcher.start).toHaveBeenCalledWith('WITH_VALIDATION');
  });

  it('EC-01: sin IssuanceStartSession, resuelve el tenant desde la fuente de config y arranca igualmente', async () => {
    const { service, dispatcher, source } = setup({
      tenantId: 'cgcom',
      entryPoint: 'WITH_VALIDATION',
    });

    await service.start({ correlated: true, session: null });

    expect(service.status()).toBe('started');
    expect(service.cannotContinueReason()).toBeNull();
    expect(source.currentTenant).toHaveBeenCalled();
    expect(dispatcher.start).toHaveBeenCalledTimes(1);
  });

  it('ES-03: un retorno no correlacionado rechaza el arranque y fuerza CannotContinueReason', async () => {
    const { service, dispatcher } = setup({ entryPoint: 'WITH_VALIDATION' });

    await service.start({
      correlated: false,
      session: { id: 's1', tenant: 'cgcom', state: 'started' },
    });

    expect(service.status()).toBe('cannot_continue');
    expect(service.cannotContinueReason()).toBe(
      CannotContinueReason.NotCorrelated,
    );
    expect(dispatcher.start).not.toHaveBeenCalled();
  });

  it('ES-02: configuración de tenant ausente → cannot_continue (ConfigAbsent), sin arrancar', async () => {
    const { service, dispatcher } = setup({ hasConfig: false, tenantId: 'cgcom' });

    await service.start({ correlated: true, session: null });

    expect(service.status()).toBe('cannot_continue');
    expect(service.cannotContinueReason()).toBe(CannotContinueReason.ConfigAbsent);
    expect(dispatcher.start).not.toHaveBeenCalled();
  });

  it('ES-01: entryPoint inválido en config → cannot_continue (EntryPointInvalid), sin arrancar', async () => {
    const { service, dispatcher } = setup({ entryPoint: 'BOGUS', tenantId: 'cgcom' });

    await service.start({ correlated: true, session: null });

    expect(service.status()).toBe('cannot_continue');
    expect(service.cannotContinueReason()).toBe(
      CannotContinueReason.EntryPointInvalid,
    );
    expect(dispatcher.start).not.toHaveBeenCalled();
  });
});
