// Mock of the issuance portal service API for local development, until the
// real service has every endpoint (GET /config comes with EUD-276).
//
// Prism serves one contract per process, so this starts one Prism per module
// and a small proxy on MOCK_API_PORT (4000) that sends each path under
// /issuance-portal/api/v1 to the Prism of its module.
//
// Prism makes up values from the schemas, which leaves the portal without a
// usable brand or language. GET /config is answered instead, like the real
// service, by the tenant of the host: mock/portal-config.<tenant>.json, or
// 503 config_unavailable when the tenant has no file. MOCK_API_CONFIG forces
// one file for every tenant, or 503 with MOCK_API_CONFIG=unavailable.
//
// Usage: npm run mock:api
//        MOCK_API_CONFIG=unavailable npm run mock:api
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createServer, request } from 'node:http';
import { localBin } from './local-bin.mjs';

const BASE_PATH = '/issuance-portal/api/v1';
const PORT = Number(process.env.MOCK_API_PORT ?? 4000);
const CONFIG = process.env.MOCK_API_CONFIG;
const TENANT_PATTERN = /^[a-z0-9-]+$/;

function sendJson(res, status, contentType, body) {
  res.writeHead(status, { 'content-type': contentType });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

/** Same rule as the service: X-Tenant when nginx sends it, otherwise the first segment of the host. */
function tenantOf(req) {
  const header = req.headers['x-tenant'];
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '');
  const tenant = (typeof header === 'string' && header) || host.split('.')[0];
  return TENANT_PATTERN.test(tenant) ? tenant : null;
}

function sendConfig(req, res) {
  const tenant = tenantOf(req);
  const file = CONFIG ?? (tenant ? `mock/portal-config.${tenant}.json` : null);
  if (!file || file === 'unavailable' || !existsSync(file)) {
    sendJson(res, 503, 'application/problem+json', { type: 'config_unavailable', title: 'Config unavailable', status: 503 });
    return;
  }
  // Read on every request, so the file can be edited without restarting.
  sendJson(res, 200, 'application/json', readFileSync(file, 'utf-8'));
}

const modules = [
  { contract: 'api/journey.openapi.yaml', port: 4010, prefixes: ['config', 'journey', 'incidents'] },
  { contract: 'api/authentic-source.openapi.yaml', port: 4012, prefixes: ['entitlement'] },
];

const children = modules.map(({ contract, port }) =>
  spawn(localBin('prism'), ['mock', contract, '--port', String(port), '--host', '127.0.0.1'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  }),
);

function moduleFor(path) {
  const segment = path.split('/')[1]?.split('?')[0];
  return modules.find((m) => m.prefixes.includes(segment));
}

const proxy = createServer((req, res) => {
  const url = req.url ?? '/';
  const path = url.startsWith(BASE_PATH) ? url.slice(BASE_PATH.length) || '/' : url;
  if (req.method === 'GET' && path.split('?')[0] === '/config') {
    sendConfig(req, res);
    return;
  }
  const target = moduleFor(path);
  if (!target) {
    sendJson(res, 404, 'application/problem+json', { type: 'not_found', title: 'Not found', status: 404 });
    return;
  }
  const upstream = request(
    { host: '127.0.0.1', port: target.port, method: req.method, path, headers: req.headers },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );
  upstream.on('error', () => {
    sendJson(res, 502, 'application/problem+json', { type: 'mock_unavailable', title: 'Mock not ready', status: 502 });
  });
  req.pipe(upstream);
});

proxy.listen(PORT, () =>
  console.log(`Issuance portal API mock on http://localhost:${PORT}${BASE_PATH} (GET /config: ${CONFIG ?? 'mock/portal-config.<tenant>.json'})`),
);

function stop() {
  proxy.close();
  children.forEach((child) => child.kill());
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
