// Mock of the issuance portal service API for local development, until the
// real service has every endpoint (GET /config comes with EUD-276).
//
// Prism serves one contract per process, so this starts one Prism per module
// and a small proxy on MOCK_API_PORT (4000) that sends each path under
// /issuance-portal/api/v1 to the Prism of its module.
//
// Prism makes up values from the schemas, which leaves the portal without a
// usable brand or language. GET /config is answered instead from
// MOCK_API_CONFIG (mock/portal-config.cgcom.json by default), or with 503
// config_unavailable when MOCK_API_CONFIG=unavailable.
//
// Usage: npm run mock:api
//        MOCK_API_CONFIG=unavailable npm run mock:api
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer, request } from 'node:http';

const BASE_PATH = '/issuance-portal/api/v1';
const PORT = Number(process.env.MOCK_API_PORT ?? 4000);
const CONFIG = process.env.MOCK_API_CONFIG ?? 'mock/portal-config.cgcom.json';

function sendJson(res, status, contentType, body) {
  res.writeHead(status, { 'content-type': contentType });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function sendConfig(res) {
  if (CONFIG === 'unavailable') {
    sendJson(res, 503, 'application/problem+json', { type: 'config_unavailable', title: 'Config unavailable', status: 503 });
    return;
  }
  // Read on every request, so the file can be edited without restarting.
  sendJson(res, 200, 'application/json', readFileSync(CONFIG, 'utf-8'));
}

const modules = [
  { contract: 'api/journey.openapi.yaml', port: 4010, prefixes: ['config', 'journey', 'incidents'] },
  { contract: 'api/identification.openapi.yaml', port: 4011, prefixes: ['identification'] },
  { contract: 'api/authentic-source.openapi.yaml', port: 4012, prefixes: ['entitlement'] },
];

const children = modules.map(({ contract, port }) =>
  spawn('npx', ['prism', 'mock', contract, '--port', String(port), '--host', '127.0.0.1'], {
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
    sendConfig(res);
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
  console.log(`Issuance portal API mock on http://localhost:${PORT}${BASE_PATH} (GET /config: ${CONFIG})`),
);

function stop() {
  proxy.close();
  children.forEach((child) => child.kill());
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
