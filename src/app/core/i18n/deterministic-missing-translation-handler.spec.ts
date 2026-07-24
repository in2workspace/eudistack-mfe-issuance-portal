import { MissingTranslationHandlerParams, TranslateService } from '@ngx-translate/core';
import { DeterministicMissingTranslationHandler } from './deterministic-missing-translation-handler';

describe('DeterministicMissingTranslationHandler', () => {
  let handler: DeterministicMissingTranslationHandler;

  beforeEach(() => {
    handler = new DeterministicMissingTranslationHandler();
  });

  function paramsWith(defaultLang: string, translations: Record<string, unknown>): MissingTranslationHandlerParams {
    return {
      key: 'issuanceInfo.missing.key',
      translateService: {
        defaultLang,
        translations,
      } as unknown as TranslateService,
    };
  }

  it('falls back to the default-language translation when present (EC-03)', () => {
    const params = paramsWith('es', {
      es: { 'issuanceInfo.missing.key': 'Texto por defecto' },
    });

    expect(handler.handle(params)).toBe('Texto por defecto');
  });

  it('falls back to the raw key when the default-language translation is absent', () => {
    const params = paramsWith('es', { es: {} });

    expect(handler.handle(params)).toBe('issuanceInfo.missing.key');
  });

  it('falls back to the raw key when the default-language catalog itself is missing', () => {
    const params = paramsWith('es', {});

    expect(handler.handle(params)).toBe('issuanceInfo.missing.key');
  });

  it('never returns undefined, null or an empty string', () => {
    const cases = [
      paramsWith('es', { es: {} }),
      paramsWith('es', { es: { 'issuanceInfo.missing.key': '' } }),
      paramsWith('es', {}),
    ];

    for (const params of cases) {
      const result = handler.handle(params);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      expect(result.length).toBeGreaterThan(0);
    }
  });
});
