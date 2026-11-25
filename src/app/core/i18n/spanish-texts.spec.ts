import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Catalog = { [key: string]: string | Catalog };

/** Todos los valores del catálogo, también los de claves anidadas, con su clave. */
function values(catalog: Catalog, prefix = ''): [string, string][] {
  return Object.entries(catalog).flatMap(([key, value]) =>
    typeof value === 'string' ? [[`${prefix}${key}`, value] as [string, string]] : values(value, `${prefix}${key}.`),
  );
}

describe('Spanish texts (AD-12, AC-12)', () => {
  const es = JSON.parse(readFileSync(join(__dirname, '../../../assets/i18n/es.json'), 'utf-8')) as Catalog;

  it('has texts to check', () => {
    expect(values(es).length).toBeGreaterThan(100);
  });

  it.each(['wallet', 'móvil'])('no value of es.json contains «%s», in any case', (word) => {
    const found = values(es)
      .filter(([, value]) => value.toLowerCase().includes(word))
      .map(([key]) => key);

    expect(found).toEqual([]);
  });
});
