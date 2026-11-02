import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Plantillas de todas las pantallas de `features/`. */
function templates(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return templates(path);
    }
    return name.endsWith('.component.html') ? [path] : [];
  });
}

describe('Screens', () => {
  it('AC-08: no screen paints its own header, the common one comes from AppComponent', () => {
    const found = templates(__dirname);

    expect(found.length).toBeGreaterThan(0);
    for (const template of found) {
      expect({ template, header: readFileSync(template, 'utf-8').includes('<header') }).toEqual({ template, header: false });
    }
  });
});
