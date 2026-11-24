// Quick browser preview: `npm run web`.
// The deployed API sends no CORS headers, so browsers block calls to it from
// localhost. This forwards /api/* to it with those headers, then starts Expo web.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { Readable } from 'node:stream';

const API = 'https://tandemweb.vercel.app';
const PORT = 3001;
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, range',
};

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return res.writeHead(204, CORS).end();
  if (!req.url.startsWith('/api/')) return res.writeHead(404, CORS).end();
  try {
    const upstream = await fetch(API + req.url, {
      method: req.method,
      headers: Object.fromEntries(['content-type', 'range'].filter((h) => req.headers[h]).map((h) => [h, req.headers[h]])),
      body: req.method === 'POST' ? Buffer.concat(await req.toArray()) : undefined,
    });
    const headers = { ...CORS };
    // Not content-length: fetch has already decompressed the body.
    for (const h of ['content-type', 'content-range', 'accept-ranges']) {
      if (upstream.headers.has(h)) headers[h] = upstream.headers.get(h);
    }
    res.writeHead(upstream.status, headers);
    if (upstream.body) Readable.fromWeb(upstream.body).pipe(res);
    else res.end();
  } catch (err) {
    res.writeHead(502, CORS).end(String(err));
  }
}).listen(PORT, () => {
  const expo = spawn(process.execPath, ['node_modules/expo/bin/cli', 'start', '--web', ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, EXPO_PUBLIC_API_URL: `http://localhost:${PORT}` },
  });
  expo.on('exit', (code) => process.exit(code ?? 0));
});
