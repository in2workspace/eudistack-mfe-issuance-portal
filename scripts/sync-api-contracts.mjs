// Copies the issuance portal service contracts from eudistack-platform-dev,
// where they are maintained with each feature, into api/. The clients are
// generated from api/ at build time (design.md AD-2).
//
// Usage: npm run api:sync [-- <path to eudistack-platform-dev>]
import { copyFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const platformDev = resolve(process.argv[2] ?? '../eudistack-platform-dev');
const features = join(platformDev, 'docs', 'features');

const contracts = {
  'journey.openapi.yaml': 'EUD-262-servicio-portal-emision',
  'identification.openapi.yaml': 'EUD-260-identificacion-titular',
  'authentic-source.openapi.yaml': 'EUD-261-fuente-autentica',
};

for (const [target, feature] of Object.entries(contracts)) {
  const source = join(features, feature, 'annex', 'openapi.yaml');
  if (!existsSync(source)) {
    console.error(`Contract not found: ${source}`);
    process.exit(1);
  }
  copyFileSync(source, join('api', target));
  console.log(`api/${target} <- ${feature}`);
}
