/**
 * REST API Server (Q4 2026 #6 — REST API for external tool integration).
 * Dependency-free Node http server exposing the suite's core operations:
 * health, templates (list/get), generation (validate + score), and webhooks.
 * Run with: node api-server.js [port]
 */

const http = require('http');

const DEFAULTS = { port: process.env.PORT || 3210, host: '127.0.0.1' };
const PORT = parseInt(process.argv[2] || DEFAULTS.port, 10);

/** Minimal in-memory template catalog (mirrors plugins/marketplace/catalog.json). */
let TEMPLATES = [
  { id: 't1', name: 'Quick Tooltip', category: 'ux', body: '// @grant none\nconsole.log("tooltip");' },
  { id: 't2', name: 'Banner Injector', category: 'ux', body: '// @grant GM_addStyle\n/* inject banner */' },
  { id: 't3', name: 'Data Scraper', category: 'automation', body: '// @grant GM_xmlhttpRequest\n/* fetch + parse */' }
];

function sendJson(res, status, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); }
    });
  });
}

/** Lightweight script validator: score based on presence of key blocks. */
function validateScript(source) {
  const text = String(source || '');
  const checks = {
    hasMetadata: /==UserScript==/.test(text),
    hasGrant: /@grant/.test(text),
    hasMatch: /@match/.test(text),
    hasMain: /\b\(function\s*\(\)|\(\(\)\s*=>/.test(text),
    usesStrict: /['"]use strict['"]/.test(text)
  };
  const score = Math.round(
    (Object.values(checks).filter(Boolean).length / Object.keys(checks).length) * 100
  );
  return { checks, score };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + req.headers.host);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  // CORS for cross-origin tooling
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  try {
    if (req.method === 'GET' && path === '/health') {
      return sendJson(res, 200, { status: 'ok', uptime: process.uptime(), version: '1.0.0', ts: Date.now() });
    }

    if (req.method === 'GET' && path === '/api/templates') {
      return sendJson(res, 200, { templates: TEMPLATES.map(t => ({ id: t.id, name: t.name, category: t.category })) });
    }

    if (req.method === 'GET' && /^\/api\/templates\/[\w-]+$/.test(path)) {
      const id = path.split('/').pop();
      const t = TEMPLATES.find(x => x.id === id);
      if (!t) return sendJson(res, 404, { error: 'template not found' });
      return sendJson(res, 200, t);
    }

    if (req.method === 'POST' && path === '/api/validate') {
      const body = await readBody(req);
      return sendJson(res, 200, validateScript(body.source));
    }

    if (req.method === 'POST' && path === '/api/webhooks') {
      const body = await readBody(req);
      return sendJson(res, 200, { received: true, event: body.event || 'unknown', ts: Date.now() });
    }

    sendJson(res, 404, { error: 'not found', path });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
});

if (require.main === module) {
  server.listen(PORT, DEFAULTS.host, () => {
    console.log('[api-server] listening on http://' + DEFAULTS.host + ':' + PORT);
  });
}

module.exports = { server, validateScript, TEMPLATES };