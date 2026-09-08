import { createServer } from 'http';
import { lookupBooking } from '../src/lib/lookup';
import { formatBooking, type FormatStyle } from '../src/lib/format';

// Local helper app: runs on an employee's own PC, drives their own real Chrome install to look
// up a Vietjet booking (fast + reliable — no cloud Chromium, no datacenter IP, no timeout
// budget). The web UI at soi.ihns.vn detects this server via GET /health and, when present,
// calls POST /lookup directly instead of going through the Vercel serverless path. This does
// NOT replace the Vercel path — it's an additional, faster route that only exists when an
// employee has this agent running locally; everyone else keeps using the existing cloud path.
const PORT = 17345;

// Only these origins are allowed to call this local server (checked against the request's
// Origin header). Keeps this from being callable by an arbitrary page a user happens to have
// open while the agent is running.
const ALLOWED_ORIGINS = new Set([
  'https://soi.ihns.vn',
  'http://localhost:3000',
  'http://localhost:3311',
]);

const STYLES: FormatStyle[] = ['en', 'vi-short', 'en-long'];

function setCors(req: import('http').IncomingMessage, res: import('http').ServerResponse) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Chrome's Private Network Access check: an https page calling http://127.0.0.1 sends this
  // preflight header and requires the explicit opt-in below, or the request is blocked.
  if (req.headers['access-control-request-private-network']) {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
}

function readBody(req: import('http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === 'POST' && req.url === '/lookup') {
    try {
      const body = JSON.parse(await readBody(req));
      const { code, lastName, firstName } = body;
      if (!code || !lastName || !firstName) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Thiếu mã đặt chỗ, họ hoặc tên.' }));
        return;
      }

      const result = await lookupBooking(String(code).trim(), String(lastName).trim(), String(firstName).trim());

      if (!result.status) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: result.message || 'Không tìm thấy đặt chỗ.' }));
        return;
      }

      const formats = Object.fromEntries(STYLES.map((style) => [style, formatBooking(result.reservation, style)]));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ formats }));
    } catch (err) {
      console.error('[agent] lookup failed:', err);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Tra cứu thất bại. Vui lòng thử lại.' }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Vietjet lookup agent running at http://127.0.0.1:${PORT}`);
  console.log('Giữ cửa sổ này mở khi dùng trang tra cứu vé. Đóng cửa sổ để tắt.');
});
