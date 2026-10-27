// Generates the issuance portal API clients from api/ (openapitools.json).
//
// openapi-generator-cli looks for openapitools.json and resolves #{cwd} from
// process.env.PWD before process.cwd(). In Git Bash with MSYS_NO_PATHCONV=1,
// which is how the eudistack-platform-dev Makefile builds the MFEs, PWD stays
// as a POSIX path (/c/Users/...) that Node reads as C:\c\Users\..., so the
// CLI misses the config and falls back to the Java generator. PWD is set to
// the real working directory here. The CLI is the one in node_modules, never
// one fetched by npx (see local-bin.mjs).
//
// Usage: npm run api:generate
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { localBin } from './local-bin.mjs';

// openapi-generator never deletes files: start from an empty folder so a
// client or operation removed from a contract stops compiling (AC-07).
rmSync('src/app/core/api/generated', { recursive: true, force: true });

const result = spawnSync(localBin('openapi-generator-cli'), ['generate'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, PWD: process.cwd() },
});

process.exit(result.status ?? 1);
