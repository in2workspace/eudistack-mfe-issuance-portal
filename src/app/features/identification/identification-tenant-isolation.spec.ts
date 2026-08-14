import { validateIdentificationReturn } from './validate-identification-return';
import { CannotContinueReason } from '../issuance-start/cannot-continue-reason';
import { IssuanceStartSession } from '../issuance-start/issuance-start-session.model';
import { TenantIdentificationConfig } from './tenant-identification-config.model';

/**
 * Riesgo dedicado R-2 (probabilidad baja, impacto alto): un retorno cuya
 * sesión de arranque pertenece a un tenant distinto del tenant actual no
 * debe retomar el flujo con la configuración de NINGUNO de los dos
 * tenants (AC-07). Test aislado a propósito, no mezclado con el resto del
 * gate — es el control de aislamiento por tenant.
 */
describe('Identification tenant isolation (R-2, AC-07)', () => {
  const now = 1_000_000;
  const config: TenantIdentificationConfig = { url: '/cert/', correlationMode: 'same_context' };

  const sessionFromCgcom: IssuanceStartSession = {
    id: 'abc123',
    tenant: 'cgcom',
    state: 'redirigida',
    redirectedAt: now - 1000,
    expiresAt: now + 800_000,
    correlationToken: 'token',
    redirectedMethod: 'certificate',
  };

  it('rejects a return evaluated against a different tenant than the one that owns the session', () => {
    const decision = validateIdentificationReturn({
      session: sessionFromCgcom,
      params: new URLSearchParams(),
      config,
      currentTenant: 'kpmg',
      now,
    });

    expect(decision).toEqual({ outcome: 'rejected', reason: CannotContinueReason.NotCorrelated });
  });

  it('does not resume the flow with either tenant\'s configuration — it simply rejects (no partial success)', () => {
    const decision = validateIdentificationReturn({
      session: sessionFromCgcom,
      params: new URLSearchParams(),
      config,
      currentTenant: 'sandbox',
      now,
    });

    expect(decision.outcome).toBe('rejected');
    expect('session' in decision).toBe(false);
  });

  it('accepts when the session tenant and the current tenant genuinely match (control — not the isolation case)', () => {
    const decision = validateIdentificationReturn({
      session: sessionFromCgcom,
      params: new URLSearchParams(),
      config,
      currentTenant: 'cgcom',
      now,
    });

    expect(decision.outcome).toBe('correlated');
  });
});
