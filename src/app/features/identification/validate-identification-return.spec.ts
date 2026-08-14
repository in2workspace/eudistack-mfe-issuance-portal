import { validateIdentificationReturn } from './validate-identification-return';
import { CannotContinueReason } from '../issuance-start/cannot-continue-reason';
import { IssuanceStartSession } from '../issuance-start/issuance-start-session.model';
import { TenantIdentificationConfig } from './tenant-identification-config.model';

describe('validateIdentificationReturn', () => {
  const now = 1_000_000;
  const sameContextConfig: TenantIdentificationConfig = { url: '/cert/', correlationMode: 'same_context' };
  const echoConfig: TenantIdentificationConfig = {
    url: '/cert/',
    correlationMode: 'echo',
    correlationParam: 'state',
  };

  const redirectedSession: IssuanceStartSession = {
    id: 'abc123',
    tenant: 'cgcom',
    state: 'redirigida',
    redirectedAt: now - 1000,
    expiresAt: now + 800_000,
    correlationToken: 'expected-token',
    redirectedMethod: 'certificate',
  };

  function paramsWith(entries: Record<string, string> = {}): URLSearchParams {
    return new URLSearchParams(entries);
  }

  it('happy path (same_context): a valid, non-expired, non-consumed session for the current tenant correlates (AC-03)', () => {
    const decision = validateIdentificationReturn({
      session: redirectedSession,
      params: paramsWith(),
      config: sameContextConfig,
      currentTenant: 'cgcom',
      now,
    });

    expect(decision).toEqual({ outcome: 'correlated', session: redirectedSession });
  });

  it('happy path (echo): a matching correlation reference correlates (EC-01 counterpart)', () => {
    const decision = validateIdentificationReturn({
      session: redirectedSession,
      params: paramsWith({ state: 'expected-token' }),
      config: echoConfig,
      currentTenant: 'cgcom',
      now,
    });

    expect(decision).toEqual({ outcome: 'correlated', session: redirectedSession });
  });

  it('rejects when there is no session in this context (AC-04)', () => {
    const decision = validateIdentificationReturn({
      session: null,
      params: paramsWith(),
      config: sameContextConfig,
      currentTenant: 'cgcom',
      now,
    });

    expect(decision).toEqual({ outcome: 'rejected', reason: CannotContinueReason.NotCorrelated });
  });

  it('rejects when the session state is not "redirigida" (AC-04)', () => {
    const session: IssuanceStartSession = { ...redirectedSession, state: 'iniciada' };

    const decision = validateIdentificationReturn({
      session,
      params: paramsWith(),
      config: sameContextConfig,
      currentTenant: 'cgcom',
      now,
    });

    expect(decision).toEqual({ outcome: 'rejected', reason: CannotContinueReason.NotCorrelated });
  });

  it('rejects when redirectedMethod is not "certificate" (AC-04, defensive)', () => {
    const session = { ...redirectedSession, redirectedMethod: undefined } as unknown as IssuanceStartSession;

    const decision = validateIdentificationReturn({
      session,
      params: paramsWith(),
      config: sameContextConfig,
      currentTenant: 'cgcom',
      now,
    });

    expect(decision).toEqual({ outcome: 'rejected', reason: CannotContinueReason.NotCorrelated });
  });

  it('rejects a second return with the same reference — already consumed (AC-05)', () => {
    const consumed: IssuanceStartSession = { ...redirectedSession, state: 'retomada', consumedAt: now - 10 };

    const decision = validateIdentificationReturn({
      session: consumed,
      params: paramsWith(),
      config: sameContextConfig,
      currentTenant: 'cgcom',
      now,
    });

    expect(decision).toEqual({ outcome: 'rejected', reason: CannotContinueReason.ReturnAlreadyConsumed });
  });

  it('rejects an expired session by caducidad (ES-03)', () => {
    const expired: IssuanceStartSession = { ...redirectedSession, expiresAt: now - 1 };

    const decision = validateIdentificationReturn({
      session: expired,
      params: paramsWith(),
      config: sameContextConfig,
      currentTenant: 'cgcom',
      now,
    });

    expect(decision).toEqual({ outcome: 'rejected', reason: CannotContinueReason.StartSessionExpired });
  });

  it('rejects when the session belongs to a different tenant (AC-07)', () => {
    const decision = validateIdentificationReturn({
      session: redirectedSession,
      params: paramsWith(),
      config: sameContextConfig,
      currentTenant: 'kpmg',
      now,
    });

    expect(decision).toEqual({ outcome: 'rejected', reason: CannotContinueReason.NotCorrelated });
  });

  it('echo mode: rejects when the reference is absent — never accepted "for compatibility" (ES-04)', () => {
    const decision = validateIdentificationReturn({
      session: redirectedSession,
      params: paramsWith(),
      config: echoConfig,
      currentTenant: 'cgcom',
      now,
    });

    expect(decision).toEqual({ outcome: 'rejected', reason: CannotContinueReason.NotCorrelated });
  });

  it('echo mode: rejects when the reference does not match the session correlationToken (ES-04)', () => {
    const decision = validateIdentificationReturn({
      session: redirectedSession,
      params: paramsWith({ state: 'someone-elses-token' }),
      config: echoConfig,
      currentTenant: 'cgcom',
      now,
    });

    expect(decision).toEqual({ outcome: 'rejected', reason: CannotContinueReason.NotCorrelated });
  });
});
