// ═══════════════════════════════════════════════════════════
//  Speckable.pl — B2B proxy  (Node.js, port 3005)
//  Manual login, serves portal HTML
// ═══════════════════════════════════════════════════════════
const http      = require('http');
const https     = require('https');
const fs        = require('fs');
const nodePath  = require('path');
const { URL }   = require('url');
const cheerio   = require('cheerio');

const PORT    = 3005;
const BASE    = 'https://www.speckable.pl';
const EMAIL   = 'biuro@maxmaster.info';
const PASS    = 'FUCK00den00kazap!';

// ─── Cookie jar ─────────────────────────────────────────
let cookieJar = {};
let loggedIn  = false;
let loginBusy = false;

function mergeCookies(setCookieHeaders) {
  if (!setCookieHeaders) return;
  const arr = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  for (const raw of arr) {
    const m = raw.match(/^([^=]+)=([^;]*)/);
    if (m) cookieJar[m[1].trim()] = m[2].trim();
  }
}

function cookieString() {
  return Object.entries(cookieJar).map(([k,v]) => `${k}=${v}`).join('; ');
}

// ─── HTTPS fetch with cookie jar ────────────────────────
function fetchUrl(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const reqOpts = {
      hostname: u.hostname, port: 443,
      path: u.pathname + u.search,
      method: opts.method || 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pl-PL,pl;q=0.9',
        'Cookie': cookieString(),
        ...(opts.headers || {})
      }
    };
    if (opts.body) {
      reqOpts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      reqOpts.headers['Content-Length'] = Buffer.byteLength(opts.body);
    }
    const req = https.request(reqOpts, res => {
      mergeCookies(res.headers['set-cookie']);
      if ([301,302,303,307].includes(res.statusCode)) {
        const loc = res.headers.location;
        const redir = loc.startsWith('http') ? loc : BASE + loc;
        res.resume();
        return fetchUrl(redir, { method: 'GET' }).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

// ─── Login ──────────────────────────────────────────────
async function login() {
  if (loggedIn || loginBusy) return loggedIn;
  loginBusy = true;
  try {
    console.log('[AUTH] Pobieranie strony logowania...');
    const page = await fetchUrl(BASE + '/pl/login');
    const $ = cheerio.load(page.body);
    const token = $('input[name="login[_token]"]').val();

    if (!token) {
      if (page.body.includes('/pl/logout') || page.body.includes('Wyloguj')) {
        console.log('[AUTH] Już zalogowano');
        loggedIn = true; return true;
      }
      console.error('[AUTH] Brak tokena CSRF'); return false;
    }

    console.log('[AUTH] Logowanie...');
    const formData = [
      `login[_token]=${encodeURIComponent(token)}`,
      `login[referer]=${encodeURIComponent(BASE + '/')}`,
      `login[email]=${encodeURIComponent(EMAIL)}`,
      `login[password]=${encodeURIComponent(PASS)}`
    ].join('&');

    const resp = await fetchUrl(BASE + '/pl/login', {
      method: 'POST', body: formData,
      headers: { 'Referer': BASE + '/pl/login' }
    });

    if (resp.body.includes('/pl/logout') || resp.body.includes('Wyloguj') || resp.body.includes('Moje konto')) {
      console.log('[AUTH] ✅ Zalogowano:', EMAIL);
      loggedIn = true; return true;
    }
    console.error('[AUTH] ❌ Logowanie nieudane'); return false;
  } catch (e) {
    console.error('[AUTH] Błąd:', e.message); return false;
  } finally { loginBusy = false; }
}

// ═══ HTML PARSERS ═══════════════════════════════════════

function parseListPage(html, requestedPath) {
  const $ = cheerio.load(html);

  const title = $('h1').first().text().trim()
    || $('title').text().replace(/\s*[\|–—].*$/, '').trim();

  // Breadcrumb
  const breadcrumb = [];
  $('ol.breadcrumb > li').each(function () {
    const a = $(this).find('> a, > span > a').first();
    const href = a.attr('href') || '';
    let name = a.length
      ? a.clone().children('ul,div,.sub').remove().end().text().trim().split('\n')[0].trim()
      : '';
    if (!name) name = $(this).clone().children('ul,div,.sub').remove().end().text().trim().split('\n')[0].trim();
    if (name && name.length < 100) breadcrumb.push({ name, slug: href });
  });

  // Products
  const products = [];
  const pSeen = new Set();
  $('[class*="ins-v-product-thumbnail"]').each(function () {
    const el = $(this);
    const aTag = el.find('a.product-url, a[href*="/pl/product/"]').first();
    const href = aTag.attr('href') || '';
    if (!href || pSeen.has(href)) return;
    pSeen.add(href);
    const name = el.find('.heading, a.heading').first().text().trim() || el.find('img.photo').attr('alt') || '';
    if (!name) return;
    const imgEl = el.find('img.photo');
    const image = imgEl.attr('src') || imgEl.attr('data-src') || '';
    const symbol = el.find('strong').first().text().trim() || '';
    let priceNetto = null, currency = 'PLN';
    const priceDiv = el.find('.product-price').first();
    if (priceDiv.length) { priceNetto = parsePrice(priceDiv.find('.price-net .price').first()); }
    const stockEl = el.find('.in-stock');
    const stock = stockEl.length ? stockEl.first().text().trim() : '';
    products.push({
      slug: href, name, image: absUrl(image), symbol,
      priceNetto, currency, stock,
      price: priceNetto != null ? priceNetto.toFixed(2).replace('.', ',') + ' PLN netto' : ''
    });
  });
  if (products.length > 0) {
    console.log(`[LIST] ${products.length} produktów`);
    return { title, breadcrumb, items: products, hasProducts: true };
  }

  // Categories (prefer entries WITH images)
  const catBySlug = new Map();
  $('a[href*="/pl/list/"]').each(function () {
    const href = $(this).attr('href') || '';
    if (!href.startsWith('/pl/list/')) return;
    const name = $(this).find('.name, span.name').text().trim()
      || $(this).text().trim().split('\n')[0].trim();
    if (!name || name.length < 2 || name.length > 120) return;
    const imgEl = $(this).find('img');
    const image = imgEl.attr('src') || imgEl.attr('data-src') || '';
    const existing = catBySlug.get(href);
    if (!existing || (!existing.image && image)) {
      catBySlug.set(href, { slug: href, name, image: absUrl(image), price: '' });
    }
  });
  const categories = Array.from(catBySlug.values());

  // Filter by level
  const norm = (requestedPath || '/').replace(/\/$/, '');
  if (categories.length > 30) {
    if (!norm || norm === '/' || norm === '/pl/list') {
      const topLevel = categories.filter(c => c.slug.split('/').filter(Boolean).length === 3);
      if (topLevel.length > 0) {
        console.log(`[LIST] ${topLevel.length} kategorii głównych`);
        return { title: title || 'Katalog produktów', breadcrumb, items: topLevel, hasProducts: false };
      }
    } else {
      const children = categories.filter(c => c.slug.startsWith(norm + '/') && c.slug !== norm + '/');
      if (children.length > 0) {
        console.log(`[LIST] ${children.length} podkategorii`);
        return { title, breadcrumb, items: children, hasProducts: false };
      }
    }
  }
  console.log(`[LIST] ${categories.length} kategorii`);
  return { title, breadcrumb, items: categories, hasProducts: false };
}

function parseProductPage(html) {
  const $ = cheerio.load(html);
  const p = {};

  // JSON-LD
  $('script[type="application/ld+json"]').each(function () {
    try {
      const j = JSON.parse($(this).html());
      if (j['@type'] === 'Product') {
        p.title = j.name || '';
        p.sku = j.sku || '';
        p.ean = j.gtin13 || '';
        p.brand = j.brand || '';
        if (j.offers) { p.priceGross = parseFloat(j.offers.price) || null; p.currency = j.offers.priceCurrency || 'PLN'; }
        if (j.description) { const d$ = cheerio.load(j.description); p.description = d$.text().trim().substring(0, 2000); }
      }
    } catch {}
  });
  if (!p.title) p.title = $('h1').first().text().trim();

  // Images
  p.images = [];
  const imgSeen = new Set();
  $('.photo-item a').each(function () {
    const href = $(this).attr('href') || $(this).attr('data-mfp-src') || '';
    if (href && !imgSeen.has(href)) { imgSeen.add(href); p.images.push(absUrl(href)); }
  });
  if (p.images.length === 0) {
    $('.photo-item img, .photo-container img').each(function () {
      const src = $(this).attr('src') || $(this).attr('data-src') || '';
      if (src && !src.includes('blank.gif') && !imgSeen.has(src)) { imgSeen.add(src); p.images.push(absUrl(src)); }
    });
  }

  // Prices
  const mainPrice = $('[class*="product-price"]').not('script').first();
  if (mainPrice.length) {
    const net = parsePrice(mainPrice.find('.price-net .price').first());
    const gross = parsePrice(mainPrice.find('.price-gross .price').first());
    if (net != null) p.priceNetto = net;
    if (gross != null) p.priceGross = gross;
  }

  // Stock
  p.stock = ''; p.stockExternal = '';
  const stockArea = $('img[src*="availability-high"]').first().parent();
  if (stockArea.length) p.stock = stockArea.find('.in-stock').first().text().trim();
  const extArea = $('[class*="in-stock-external"]').first();
  if (extArea.length) {
    const v = extArea.find('.in-stock').text().trim() || extArea.text().replace(/[^0-9]/g,'').trim();
    if (v) p.stockExternal = v;
  }

  // Unit
  p.unit = $('.ins-v-unit-selector.in-product .unit').first().text().trim() || 'szt';

  // Breadcrumb
  p.breadcrumb = [];
  $('ol.breadcrumb > li').each(function () {
    const a = $(this).find('> a, > span > a').first();
    const href = a.attr('href') || '';
    let name = a.length ? a.clone().children('ul,div,.sub').remove().end().text().trim().split('\n')[0].trim() : '';
    if (!name) name = $(this).clone().children('ul,div,.sub').remove().end().text().trim().split('\n')[0].trim();
    if (name && name.length < 100) p.breadcrumb.push({ name, slug: href });
  });

  // Related
  p.related = [];
  $('[class*="ins-v-product-thumbnail"]').each(function () {
    const aTag = $(this).find('a[href*="/pl/product/"]').first();
    const href = aTag.attr('href') || '';
    if (!href) return;
    const name = $(this).find('.heading, a.heading').first().text().trim();
    const imgEl = $(this).find('img.photo');
    const image = imgEl.attr('src') || imgEl.attr('data-src') || '';
    const pd = $(this).find('.product-price').first();
    const pn = parsePrice(pd.find('.price-net .price').first());
    if (name) p.related.push({ slug: href, name, image: absUrl(image), priceNetto: pn, price: pn != null ? pn.toFixed(2).replace('.',',')+' PLN netto' : '' });
  });

  console.log(`[PRODUCT] "${p.title}" | ${p.images.length} zdjęć | netto=${p.priceNetto} | stan=${p.stock}`);
  return p;
}

// ─── Helpers ────────────────────────────────────────────
function parsePrice(el) {
  if (!el || !el.length) return null;
  const whole = el.clone().children().remove().end().text().replace(/[^\d]/g, '');
  const dec = el.find('.decimal').text().replace(/[^\d]/g, '') || '00';
  if (!whole && !dec) return null;
  return parseFloat((whole || '0') + '.' + dec);
}
function absUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('/')) return BASE + url;
  return url;
}

// ═══ PORTAL HTML (embedded) ═════════════════════════════
function portalHTML() {
  // Try external file first, fall back to embedded
  try {
    const extPath = nodePath.join(__dirname, 'speckable-portal.html');
    if (fs.existsSync(extPath)) return fs.readFileSync(extPath, 'utf8');
  } catch {}
  return EMBEDDED_PORTAL;
}

// ═══ HTTP SERVER ════════════════════════════════════════
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // ── Portal HTML ──
  if (path === '/' || path === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(portalHTML());
  }

  // ── Status (no auto-login) ──
  if (path === '/api/status') {
    return json(res, { loggedIn });
  }

  // ── Manual login ──
  if (path === '/api/login') {
    cookieJar = {};
    loggedIn = false;
    const ok = await login();
    return json(res, { loggedIn: ok });
  }

  // ── Logout ──
  if (path === '/api/logout') {
    cookieJar = {}; loggedIn = false;
    console.log('[AUTH] Wylogowano');
    return json(res, { loggedIn: false });
  }

  // ── Pages (require login) ──
  if (path === '/api/page') {
    if (!loggedIn) return json(res, { error: 'Nie zalogowano. Kliknij przycisk logowania.' }, 401);
    let pagePath = url.searchParams.get('path') || '/';
    if (pagePath === '/pl/list' || pagePath === '/pl/list/') pagePath = '/';
    const fullUrl = BASE + pagePath;
    console.log(`[FETCH] ${fullUrl}`);
    try {
      let resp = await fetchUrl(fullUrl);
      if (resp.body.includes('name="login[_token]"') && !resp.body.includes('/pl/logout')) {
        console.log('[FETCH] Sesja wygasła, ponowne logowanie...');
        loggedIn = false;
        await login();
        resp = await fetchUrl(fullUrl);
      }
      return parsePage(res, pagePath, resp.body);
    } catch (e) {
      console.error('[FETCH] Błąd:', e.message);
      return json(res, { error: e.message }, 500);
    }
  }

  // ── Search (require login) ──
  if (path === '/api/search') {
    if (!loggedIn) return json(res, { error: 'Nie zalogowano.' }, 401);
    const q = url.searchParams.get('q') || '';
    const searchUrl = BASE + `/pl/query/${encodeURIComponent(q)}?availability=all`;
    console.log(`[SEARCH] ${q}`);
    try {
      const resp = await fetchUrl(searchUrl);
      return parsePage(res, `/pl/query/${q}`, resp.body);
    } catch (e) { return json(res, { error: e.message }, 500); }
  }

  // ── Image proxy ──
  if (path === '/api/img') {
    const imgUrl = url.searchParams.get('url');
    if (!imgUrl) { res.writeHead(400); return res.end(); }
    try {
      const u = new URL(imgUrl);
      const imgReq = https.request({
        hostname: u.hostname, path: u.pathname + u.search,
        headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': cookieString() }
      }, imgRes => {
        res.writeHead(imgRes.statusCode, {
          'Content-Type': imgRes.headers['content-type'] || 'image/jpeg',
          'Cache-Control': 'public, max-age=86400'
        });
        imgRes.pipe(res);
      });
      imgReq.on('error', () => { res.writeHead(502); res.end(); });
      imgReq.end();
    } catch { res.writeHead(400); res.end(); }
    return;
  }

  res.writeHead(404); res.end('Not found');
});

function parsePage(res, pagePath, html) {
  if (pagePath.includes('/pl/product/')) return json(res, { type: 'product', data: parseProductPage(html) });
  return json(res, { type: 'list', data: parseListPage(html, pagePath) });
}
function json(res, data, code = 200) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

server.listen(PORT, () => {
  console.log(`\n  ╔════════════════════════════════════════════╗`);
  console.log(`  ║  Speckable.pl proxy  →  http://localhost:${PORT}  ║`);
  console.log(`  ╚════════════════════════════════════════════╝`);
  console.log(`  Otwórz http://localhost:${PORT} w przeglądarce`);
  console.log(`  Kliknij "Zaloguj" na stronie, aby się zalogować\n`);
});
