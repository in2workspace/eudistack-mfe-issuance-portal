import { resolveCredentialOfferConfig, CredentialOfferConfigSource } from './resolve-credential-offer-config';

function sourceReturning(
  value: { credentialOfferUrl?: unknown; credentialOfferLinkBase?: unknown } | null,
): CredentialOfferConfigSource {
  return { read: () => value };
}

describe('resolveCredentialOfferConfig', () => {
  it('config ausente (source.read devuelve null) resuelve config_absent sin llamar a validate con un default (ES-02)', () => {
    const result = resolveCredentialOfferConfig('cgcom', sourceReturning(null));

    expect(result).toEqual({ ok: false, reason: 'config_absent' });
  });

  it('campos no definidos en absoluto resuelven config_absent (ES-02)', () => {
    const result = resolveCredentialOfferConfig('cgcom', sourceReturning({}));

    expect(result).toEqual({ ok: false, reason: 'config_absent' });
  });

  it('allow-list rechaza un host absoluto en credentialOfferUrl (NFR-S-163-02)', () => {
    const result = resolveCredentialOfferConfig(
      'cgcom',
      sourceReturning({ credentialOfferUrl: 'https://evil.example/bootstrap', credentialOfferLinkBase: '/wallet/protocol/callback' }),
    );

    expect(result).toEqual({ ok: false, reason: 'endpoint_invalid' });
  });

  it('allow-list rechaza un host absoluto en credentialOfferLinkBase (NFR-S-163-02)', () => {
    const result = resolveCredentialOfferConfig(
      'cgcom',
      sourceReturning({ credentialOfferUrl: '/issuance-portal/api/bootstrap', credentialOfferLinkBase: 'https://evil.example/callback' }),
    );

    expect(result).toEqual({ ok: false, reason: 'endpoint_invalid' });
  });

  it('config válida (ruta same-origin en ambos campos) resuelve ok con el config tipado', () => {
    const result = resolveCredentialOfferConfig(
      'cgcom',
      sourceReturning({ credentialOfferUrl: '/issuance-portal/api/bootstrap', credentialOfferLinkBase: '/wallet/protocol/callback' }),
    );

    expect(result).toEqual({
      ok: true,
      config: { endpoint: '/issuance-portal/api/bootstrap', walletInvocationBase: '/wallet/protocol/callback' },
    });
  });

  it('allow-list rechaza el bypass vía tabulador en credentialOfferUrl (auditoría EUD-163, F1)', () => {
    const result = resolveCredentialOfferConfig(
      'cgcom',
      sourceReturning({ credentialOfferUrl: '/\t/evil.example/bootstrap', credentialOfferLinkBase: '/wallet/protocol/callback' }),
    );

    expect(result).toEqual({ ok: false, reason: 'endpoint_invalid' });
  });

  it('config válida con el esquema openid-credential-offer:// como base también resuelve ok', () => {
    const result = resolveCredentialOfferConfig(
      'cgcom',
      sourceReturning({ credentialOfferUrl: '/issuance-portal/api/bootstrap', credentialOfferLinkBase: 'openid-credential-offer://' }),
    );

    expect(result.ok).toBe(true);
  });
});
