// Path of a binary installed in this repo's node_modules. Never npx: when the
// package is missing, npx downloads whatever the registry publishes under
// that name (openapi-generator-cli resolves to a dependency-confusion
// placeholder, not to @openapitools/openapi-generator-cli).
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function localBin(name) {
  const bin = join('node_modules', '.bin', process.platform === 'win32' ? `${name}.cmd` : name);
  if (!existsSync(bin)) {
    console.error(`${bin} not found. Run npm ci first.`);
    process.exit(1);
  }
  return bin;
}
