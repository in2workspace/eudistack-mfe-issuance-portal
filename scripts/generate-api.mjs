// Generates the issuance portal API clients from api/ (openapitools.json).
//
// openapi-generator-cli looks for openapitools.json and resolves #{cwd} from
// process.env.PWD before process.cwd(). In Git Bash with MSYS_NO_PATHCONV=1,
// which is how the eudistack-platform-dev Makefile builds the MFEs, PWD stays
// as a POSIX path (/c/Users/...) that Node reads as C:\c\Users\..., so the
// CLI misses the config and falls back to the Java generator. PWD is set to
// the real working directory here.
//
// Usage: npm run api:generate
import { spawnSync } from 'node:child_process';

const result = spawnSync('npx', ['openapi-generator-cli', 'generate'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, PWD: process.cwd() },
});

process.exit(result.status ?? 1);
