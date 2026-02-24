/**
 * Onninen.pl Proxy v2 — with 2FA support
 * 
 * Auth flow:
 *   1. POST /api/login {userName, password}
 *      → status:"ok"                         → no 2FA, done
 *      → code2falength:6                     → 2FA required, SMS sent
 *   2. POST /api/login {code2Fa, rememberWorkstation:true, step:1}
 *      → status:"ok"                         → 2FA verified, done
 *   3. POST /api/login {sendAgainType:true}   → resend SMS
 */

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const fs = require('fs');
const pathMod = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3002;
const BASE = 'https://onninen.pl';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';

app.use(cors());
app.use(express.json());

// ═══ COOKIE JAR ═══
class CookieJar {
  constructor() { this.cookies = new Map(); }
  addFromHeaders(headers) {
    const sc = headers.raw()['set-cookie'] || [];
    for (const h of sc) {
      const parts = h.split(';')[0].split('=');
      const name = parts[0].trim();
      const value = parts.slice(1).join('=').trim();
      if (name) this.cookies.set(name, value);
    }
  }
  toString() { return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; '); }
  get size() { return this.cookies.size; }
}

// ═══ PERSISTENT SESSIONS ═══
const SESSIONS_FILE = pathMod.join(__dirname, '.onninen-sessions.json');
const sessions = new Map();

function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
      for (const [sid, s] of Object.entries(data)) {
        const jar = new CookieJar();
        if (s._cookies) for (const [k, v] of Object.entries(s._cookies)) jar.cookies.set(k, v);
        sessions.set(sid, { ...s, jar, _cookies: undefined });
      }
      console.log(`[SESSIONS] Loaded ${sessions.size} from disk`);
    }
  } catch (e) { console.log('[SESSIONS] Load error:', e.message); }
}

function saveSessions() {
  try {
    const data = {};
    for (const [sid, s] of sessions) {
      data[sid] = { ...s, jar: undefined, _cookies: Object.fromEntries(s.jar.cookies) };
    }
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2));
  } catch (e) { console.log('[SESSIONS] Save error:', e.message); }
}

function getSession(req) {
  const sid = req.query.sid || req.headers['x-session-id'] || '';
  const s = sid ? sessions.get(sid) : null;
  if (s) s.lastUsed = Date.now();
  return s;
}

setInterval(() => saveSessions(), 300000);

// ═══ FETCH HELPERS ═══
async function apiGet(apiPath, session) {
  const url = BASE + apiPath;
  const headers = {
    'User-Agent': UA, 'Accept': 'application/json',
    'Accept-Language': 'pl-PL,pl;q=0.9', 'Referer': BASE + '/',
  };
  if (session?.jar) headers['Cookie'] = session.jar.toString();
  const res = await fetch(url, { headers, timeout: 20000 });
  if (session?.jar) session.jar.addFromHeaders(res.headers);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function apiPost(apiPath, body, jar) {
  const res = await fetch(BASE + apiPath, {
    method: 'POST',
    headers: {
      'User-Agent': UA, 'Content-Type': 'application/json',
      'Accept': 'application/json', 'Origin': BASE,
      'Referer': BASE + '/zaloguj-sie', 'Cookie': jar.toString(),
    },
    body: JSON.stringify(body),
  });
  jar.addFromHeaders(res.headers);
  return res.json();
}

// ═══ LOGIN ═══

const pending2fa = new Map(); // tempId → {jar, username, password}

async function completeLogin(jar, username, password) {
  console.log('[AUTH] Getting user info...');
  const headers = {
    'User-Agent': UA, 'Accept': 'application/json', 'Referer': BASE + '/',
    'Cookie': jar.toString(),
  };
  const userRes = await fetch(
    BASE + '/api/userinfo?query=user,availableCustomers,salesman,storelc,pricetype', { headers }
  );
  jar.addFromHeaders(userRes.headers);

  const userData = await userRes.json();
  const user = userData.user || {};
  const customer = userData.currentCustomer || {};
  console.log(`[AUTH]   User: ${user.name} (${user.email}), Customer: ${customer.nameShort}`);

  const sid = crypto.randomBytes(16).toString('hex');
  sessions.set(sid, {
    jar, username, password,
    userName: user.name, userEmail: user.email,
    customerName: customer.nameShort, customerId: customer.idEx,
    priceType: userData.pricetype?.name || 'netto',
    loginTime: Date.now(), lastUsed: Date.now(), lastRefresh: Date.now(),
  });
  saveSessions();

  console.log(`[AUTH] === ✓ SUCCESS (sid: ${sid.substring(0, 8)}...) ===\n`);
  return {
    success: true, sid,
    user: user.name, email: user.email,
    customer: customer.nameShort, customerId: customer.idEx,
    priceType: userData.pricetype?.name,
    warning: customer.warning || null,
  };
}

async function refreshSession(session) {
  if (!session?.username || !session?.password) return false;
  console.log(`[REFRESH] Re-logging ${session.username}...`);
  try {
    // Reuse cookies (rememberWorkstation may skip 2FA)
    const jar = new CookieJar();
    for (const [k, v] of session.jar.cookies) jar.cookies.set(k, v);

    const d = await apiPost('/api/login', { userName: session.username, password: session.password }, jar);

    if (d.status === 'ok') {
      const headers = {
        'User-Agent': UA, 'Accept': 'application/json', 'Referer': BASE + '/',
        'Cookie': jar.toString(),
      };
      await fetch(BASE + '/api/userinfo?query=user,storelc,pricetype', { headers });
      session.jar = jar;
      session.lastRefresh = Date.now();
      saveSessions();
      console.log('[REFRESH] ✓ OK');
      return true;
    }
    console.log('[REFRESH] ⚠ 2FA needed, keeping old cookies');
    return false;
  } catch (e) {
    console.log(`[REFRESH] ✗ ${e.message}`);
    return false;
  }
}

async function refreshAllSessions(force = false) {
  for (const [, s] of sessions) {
    if (!s.password) continue;
    const age = Date.now() - (s.lastRefresh || s.loginTime || 0);
    if (force || age > 2 * 3600000) await refreshSession(s);
  }
}

setInterval(() => refreshAllSessions(), 2 * 3600000);

async function apiGetAuth(apiPath, session) {
  try {
    return await apiGet(apiPath, session);
  } catch (e) {
    if (session?.password && (e.message.includes('401') || e.message.includes('403'))) {
      const ok = await refreshSession(session);
      if (ok) return await apiGet(apiPath, session);
    }
    throw e;
  }
}

// ═══ ROUTES ═══

app.get('/', (req, res) => {
  res.json({ status: 'ok', proxy: 'Onninen.pl Proxy v2', port: PORT, sessions: sessions.size });
});

// Unified login: handles credentials, 2FA code, and resend
app.post('/api/login', async (req, res) => {
  const { username, password, code2fa, tempId, resend } = req.body;

  // ── Resend SMS ──
  if (resend && tempId) {
    const p = pending2fa.get(tempId);
    if (!p) return res.status(400).json({ error: 'Сесія закінчилась, увійдіть знову' });
    try {
      const d = await apiPost('/api/login', { sendAgainType: true }, p.jar);
      return res.json({ needs2fa: true, tempId, message: d.message || 'SMS надіслано', wait: d.secondwait || 120 });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── Submit 2FA code ──
  if (code2fa && tempId) {
    const p = pending2fa.get(tempId);
    if (!p) return res.status(400).json({ error: 'Сесія закінчилась, увійдіть знову' });
    console.log(`[AUTH] 2FA code: ${code2fa}`);
    try {
      const d = await apiPost('/api/login', { code2Fa: code2fa, rememberWorkstation: true, step: 1 }, p.jar);
      if (d.status !== 'ok') return res.json({ needs2fa: true, tempId, error: d.message || 'Невірний код' });
      pending2fa.delete(tempId);
      return res.json(await completeLogin(p.jar, p.username, p.password));
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── Step 1: Credentials ──
  if (!username || !password) return res.status(400).json({ error: 'Username + password' });
  console.log(`\n[AUTH] === Login: ${username} ===`);

  try {
    const jar = new CookieJar();
    const homeRes = await fetch(BASE + '/', {
      headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*' }, redirect: 'follow',
    });
    jar.addFromHeaders(homeRes.headers);

    const d = await apiPost('/api/login', { userName: username, password }, jar);
    console.log(`[AUTH]   Response: ${JSON.stringify(d)}`);

    // Case A: No 2FA
    if (d.status === 'ok') {
      return res.json(await completeLogin(jar, username, password));
    }

    // Case B: 2FA required
    if (d.code2falength || d.desc2faheader) {
      const tid = crypto.randomBytes(12).toString('hex');
      pending2fa.set(tid, { jar, username, password });
      setTimeout(() => pending2fa.delete(tid), 600000);
      console.log(`[AUTH]   ⚠ 2FA required! tempId: ${tid.substring(0, 8)}...`);
      return res.json({
        needs2fa: true, tempId: tid,
        message: d.message || 'Введіть код з SMS',
        codeLength: d.code2falength || 6,
        wait: d.secondwait || 120,
      });
    }

    // Case C: Error
    return res.status(401).json({ error: d.message || 'Login failed' });
  } catch (e) {
    console.error(`[AUTH ERROR] ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/session', (req, res) => {
  const s = getSession(req);
  if (!s) return res.json({ authenticated: false });
  res.json({
    authenticated: true, user: s.userName, email: s.userEmail,
    customer: s.customerName, customerId: s.customerId, priceType: s.priceType,
  });
});

app.post('/api/logout', (req, res) => {
  const sid = req.body.sid || req.query.sid || '';
  if (sid) sessions.delete(sid);
  saveSessions();
  res.json({ success: true });
});

let catCache = null, catCacheTime = 0;
app.get('/api/categories', async (req, res) => {
  if (catCache && Date.now() - catCacheTime < 3600000) return res.json(catCache);
  const session = getSession(req);
  try {
    const d = await apiGet('/api/groups?grouptype=categories', session);
    catCache = { categories: d.categories || [], total: (d.categories || []).length };
    catCacheTime = Date.now();
    res.json(catCache);
  } catch (e) { res.status(500).json({ error: e.message, categories: [] }); }
});

app.get('/api/products', async (req, res) => {
  const query = req.query.q || req.query.cat || '';
  const page = parseInt(req.query.page) || 0;
  const session = getSession(req);
  if (!query) return res.status(400).json({ error: 'Missing q or cat' });
  try {
    const slug = query.startsWith('/') ? query : '/' + query;
    let apiPath = `/api/search?query=${encodeURIComponent(slug)}`;
    if (page > 0) apiPath += `&page=${page}`;
    const d = session ? await apiGetAuth(apiPath, session) : await apiGet(apiPath, null);
    const section = (d.items || [])[0] || {};
    const products = (section.items || []).map(p => mapProduct(p));
    const isAuth = session && products.some(p => p.priceEnd != null);
    res.json({ products, total: d.total || 0, page, lastPage: d.lastpage || 0, title: section.title || '', source: isAuth ? 'personal' : 'public' });
  } catch (e) { res.status(500).json({ error: e.message, products: [] }); }
});

app.get('/api/product', async (req, res) => {
  const slug = req.query.slug || '';
  const session = getSession(req);
  if (!slug) return res.status(400).json({ error: 'Missing slug' });
  try {
    const d = session
      ? await apiGetAuth(`/api/card?slug=${encodeURIComponent(slug)}`, session)
      : await apiGet(`/api/card?slug=${encodeURIComponent(slug)}`, null);
    const card = d.card || {};
    const product = mapProduct(card);
    product.categories = (card.categories || []).map(c => c.name).filter(Boolean);
    product.breadcrumb = product.categories.join(' › ');
    product.unit = card.unit || '';
    product.delivery = card.bestdel || null;
    product.variants = card.ext?.variants?.[0]?.items?.map(v => ({ id: v.id, slug: v.slug, name: v.name, active: v.active })) || [];
    res.json({ product, source: session && product.priceEnd != null ? 'personal' : 'public' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/search', async (req, res) => {
  const q = req.query.q || '';
  const page = parseInt(req.query.page) || 0;
  const session = getSession(req);
  if (!q) return res.status(400).json({ error: 'Missing q' });
  try {
    let apiPath = `/api/search?query=${encodeURIComponent(q)}`;
    if (page > 0) apiPath += `&page=${page}`;
    const d = session ? await apiGetAuth(apiPath, session) : await apiGet(apiPath, null);
    const allItems = [];
    for (const section of (d.items || [])) for (const item of (section.items || [])) allItems.push(mapProduct(item));
    res.json({ products: allItems, total: d.total || 0, page, lastPage: d.lastpage || 0 });
  } catch (e) { res.status(500).json({ error: e.message, products: [] }); }
});

app.get('/api/debug', async (req, res) => {
  const session = getSession(req);
  const result = { hasSession: !!session, cookies: session?.jar?.size || 0 };
  if (session) {
    try { const u = await apiGetAuth('/api/userinfo?query=user,storelc,pricetype', session); result.user = u.user?.name; result.loggedIn = u.user?.loggedin; result.priceType = u.pricetype; } catch (e) { result.userError = e.message; }
    try { const d = await apiGetAuth('/api/search?query=/Kable-i-przewody/Przewody-instalacyjne', session); const items = (d.items?.[0]?.items || []).slice(0, 2); result.testProducts = items.map(p => ({ name: p.name, priceCatalog: p.price?.items?.[0]?.pricecatalog, priceEnd: p.price?.items?.[0]?.priceend, discount: p.price?.items?.[0]?.discount })); } catch (e) { result.searchError = e.message; }
  }
  res.json(result);
});

function mapProduct(p) {
  if (!p) return {};
  const pi = p.price?.items?.[0] || {};
  const tiers = (p.price?.items || []).map(t => ({ quantity: t.quantity, priceEnd: t.priceend, priceCatalog: t.pricecatalog, discount: t.discount }));
  return {
    id: p.id, slug: p.slug || '', index: p.index || '', catalogIndex: p.catalogindex || '',
    name: p.name || '', image: p.imagemd || p.imageth || '', imageTh: p.imageth || '',
    rating: p.rating || 0, currency: p.currency || 'PLN', unit: p.unit || '',
    priceCatalog: pi.pricecatalog || null, priceEnd: pi.priceend || null, discount: pi.discount || null,
    vat: p.price?.vat || 23, priceType: p.price?.pricetypename || '', priceTiers: tiers,
    stock: p.avail?.quantitydc || 0, stockLocal: p.avail?.quantitylc || 0,
    stockStatus: p.avail?.description || '', dotStatus: p.avail?.dotstatus,
    minQty: p.avail?.quantitymin || 1, modulo: p.avail?.quantitymodulo || 1, packages: p.packages || [],
    brand: p.brand?.[0]?.name || '', series: p.series?.[0]?.name || '', group: p.group || '',
  };
}

app.listen(PORT, async () => {
  loadSessions();
  if (sessions.size) { console.log('[STARTUP] Refreshing...'); await refreshAllSessions(true); }
  console.log(`
╔══════════════════════════════════════════════════════╗
║  Onninen.pl Proxy v2  (2FA support)                  ║
║  http://localhost:${PORT}                             ║
║                                                      ║
║  Login: credentials → [2FA SMS code] → session       ║
║  Auto-refresh with rememberWorkstation cookies       ║
╚══════════════════════════════════════════════════════╝
  `);
});
