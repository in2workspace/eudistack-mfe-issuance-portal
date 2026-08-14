import { ISSUANCE_START_SESSION_TTL_MS, isIssuanceStartSessionExpired } from './issuance-start-session.expiry';
import { IssuanceStartSession } from './issuance-start-session.model';

describe('isIssuanceStartSessionExpired', () => {
  const redirectedAt = 0;
  const session: IssuanceStartSession = {
    id: 'abc123',
    tenant: 'cgcom',
    state: 'redirigida',
    redirectedAt,
    expiresAt: redirectedAt + ISSUANCE_START_SESSION_TTL_MS,
    correlationToken: 'token',
    redirectedMethod: 'certificate',
  };

  it('TTL is exactly 15 minutes (900s), absolute (NFR-S-164-01)', () => {
    expect(ISSUANCE_START_SESSION_TTL_MS).toBe(15 * 60 * 1000);
  });

  it('accepts at t = 899s (ES-03, NFR-S-164-01 boundary)', () => {
    expect(isIssuanceStartSessionExpired(session, redirectedAt + 899_000)).toBe(false);
  });

  it('rejects at t = 901s (ES-03, NFR-S-164-01 boundary)', () => {
    expect(isIssuanceStartSessionExpired(session, redirectedAt + 901_000)).toBe(true);
  });

  it('does not renew on repeated checks — same absolute deadline every time (no sliding window)', () => {
    isIssuanceStartSessionExpired(session, redirectedAt + 500_000);
    isIssuanceStartSessionExpired(session, redirectedAt + 800_000);

    expect(isIssuanceStartSessionExpired(session, redirectedAt + 899_000)).toBe(false);
    expect(isIssuanceStartSessionExpired(session, redirectedAt + 901_000)).toBe(true);
  });

  it('a session that never reached "redirigida" (no expiresAt) is treated as expired — no window is open yet', () => {
    const neverRedirected: IssuanceStartSession = { id: 'abc123', tenant: 'cgcom', state: 'iniciada' };

    expect(isIssuanceStartSessionExpired(neverRedirected, Date.now())).toBe(true);
  });
});
