// Mock of the issuance portal service API for local development, until the
// real service has every endpoint (GET /config comes with EUD-276).
//
// Prism serves one contract per process, so this starts one Prism per module
// and a small proxy on MOCK_API_PORT (4000) that sends each path under
// /issuance-portal/api/v1 to the Prism of its module.
//
// Usage: npm run mock:api
import { spawn } from 'node:child_process';
import { createServer, request } from 'node:http';

const BASE_PATH = '/issuance-portal/api/v1';
const PORT = Number(process.env.MOCK_API_PORT ?? 4000);

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
  const target = moduleFor(path);
  if (!target) {
    res.writeHead(404, { 'content-type': 'application/problem+json' });
    res.end(JSON.stringify({ type: 'not_found', title: 'Not found', status: 404 }));
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
    res.writeHead(502, { 'content-type': 'application/problem+json' });
    res.end(JSON.stringify({ type: 'mock_unavailable', title: 'Mock not ready', status: 502 }));
  });
  req.pipe(upstream);
});

proxy.listen(PORT, () => console.log(`Issuance portal API mock on http://localhost:${PORT}${BASE_PATH}`));

function stop() {
  proxy.close();
  children.forEach((child) => child.kill());
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
