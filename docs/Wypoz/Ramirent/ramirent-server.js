/**
 * Ramirent.pl Proxy v1 — Wypożyczalnia sprzętu budowlanego
 *
 * Site is server-rendered HTML (not JSON API) — we scrape pages.
 *
 * Auth:  POST /konto  form-urlencoded {account_login, account_password, account_mode:"login"}
 *        X-Requested-With: XMLHttpRequest  → Set-Cookie (session)
 * User:  GET /ajax/init  → JSON {account:{client_id, client_login, ...}}
 * Place: POST /ajax/setSessionPlace  {placeId:N}
 *
 * Pages:
 *   /wynajem/wg-produktu/{cat}            → category (subcategory tiles)
 *   /wynajem/wg-produktu/{cat}/{sub}      → subcategory (group tiles)
 *   /wynajem/{group-slug}                 → group page (full-page HTML + AJAX detail)
 *   /produkt/{id}/{slug}                  → individual product modal
 *
 * Prices: brutto + netto / dzień (day). Some groups have NO price → "Skontaktuj się".
 */

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const fs = require('fs');
const pathMod = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3003;
const BASE = 'https://ramirent.pl';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';

app.use(cors());
app.use(express.json());

// ═══ COOKIE JAR ═══
class CookieJar {
  constructor() { this.cookies = new Map(); }
  addFromHeaders(headers) {
    const sc = headers.raw?.()?.['set-cookie'] || [];
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

// ═══ SESSIONS ═══
const SESSIONS_FILE = pathMod.join(__dirname, '.ramirent-sessions.json');
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
async function fetchHTML(urlPath, jar) {
  const url = urlPath.startsWith('http') ? urlPath : BASE + urlPath;
  const headers = {
    'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,*/*',
    'Accept-Language': 'pl-PL,pl;q=0.9', 'Referer': BASE + '/',
  };
  if (jar) headers['Cookie'] = jar.toString();
  const res = await fetch(url, { headers, timeout: 25000, redirect: 'follow' });
  if (jar) jar.addFromHeaders(res.headers);
  const text = await res.text();
  return text;
}

async function fetchAJAX(urlPath, jar) {
  const url = BASE + urlPath;
  const headers = {
    'User-Agent': UA, 'Accept': '*/*',
    'Accept-Language': 'pl-PL,pl;q=0.9', 'Referer': BASE + '/',
    'X-Requested-With': 'XMLHttpRequest',
  };
  if (jar) headers['Cookie'] = jar.toString();
  const res = await fetch(url, { headers, timeout: 25000 });
  if (jar) jar.addFromHeaders(res.headers);
  return res;
}

async function fetchJSON(urlPath, jar) {
  const res = await fetchAJAX(urlPath, jar);
  return res.json();
}

// ═══ HTML PARSERS ═══

function parseCategories(html) {
  const $ = cheerio.load(html);
  const cats = [];

  // Category boxes in nav dropdown
  $('a.c-category-box').each(function () {
    const href = $(this).attr('href') || '';
    const title = $(this).find('.c-category-box__title').text().trim();
    const img = $(this).find('img').attr('src') || '';
    if (href.includes('/wynajem/')) {
      cats.push({ slug: href, name: title, image: img ? BASE + img : '' });
    }
  });

  // Category tiles in content area
  if (!cats.length) {
    $('a.c-category-tile, a[class*="category"]').each(function () {
      const href = $(this).attr('href') || '';
      const title = $(this).find('[class*="title"]').text().trim() || $(this).text().trim();
      const img = $(this).find('img').attr('src') || '';
      if (href.includes('/wynajem/')) {
        cats.push({ slug: href, name: title, image: img ? BASE + img : '' });
      }
    });
  }

  return cats;
}

function parseSubcategories(html) {
  const $ = cheerio.load(html);
  const subs = [];

  // Subcategory tiles with images
  $('a[href*="/wynajem/"]').each(function () {
    const href = $(this).attr('href') || '';
    const cls = $(this).attr('class') || '';
    // Skip nav links, only tiles in content
    if (cls.includes('category-box') && !cls.includes('header')) return;
    if (cls.includes('c-category-tile') || cls.includes('c-product-tile') ||
        $(this).parents('.p-equipments-list, .p-category, [class*="content"], main').length) {
      const title = $(this).find('[class*="title"], h2, h3').text().trim() || $(this).text().trim().split('\n')[0].trim();
      const img = $(this).find('img').attr('src') || $(this).find('source').attr('srcset') || '';
      if (title && href.includes('/wynajem/') && title.length < 120) {
        subs.push({
          slug: href, name: title,
          image: img ? (img.startsWith('http') ? img : BASE + img) : '',
        });
      }
    }
  });

  // Deduplicate
  const seen = new Set();
  return subs.filter(s => { if (seen.has(s.slug)) return false; seen.add(s.slug); return true; });
}

function parseGroupPage(html, url) {
  const $ = cheerio.load(html);
  const result = {};

  // Title
  result.title = $('h1').first().text().trim();

  // Product code
  const codeEl = $('span.text-primary.font-bold').first();
  result.code = codeEl.text().trim();

  // Breadcrumb
  const crumbs = [];
  $('a[href*="/wynajem/"]').each(function () {
    const cls = $(this).attr('class') || '';
    if (cls.includes('breadcrumb') || $(this).parents('[class*="breadcrumb"]').length) {
      crumbs.push({ slug: $(this).attr('href'), name: $(this).text().trim() });
    }
  });
  result.breadcrumb = crumbs;

  // Description
  const descEl = $('[class*="description"] p, [class*="description"]').first();
  result.description = descEl.text().trim().substring(0, 500);

  // JSON-LD price
  $('script[type="application/ld+json"]').each(function () {
    try {
      const ld = JSON.parse($(this).html());
      if (ld.offers) {
        result.priceBrutto = parseFloat(ld.offers.price) || null;
        result.currency = ld.offers.priceCurrency || 'PLN';
      }
      if (ld.brand) result.brand = ld.brand.name || '';
      if (ld.image) result.image = ld.image;
    } catch (e) { }
  });

  // Gallery images
  result.images = [];
  $('[data-jsGalleryItems*="slide"] img, [data-jsGalleryItems*="slide"] source').each(function () {
    const src = $(this).attr('src') || $(this).attr('srcset') || '';
    if (src && !result.images.includes(src)) {
      result.images.push(src.startsWith('http') ? src : BASE + src);
    }
  });

  // AJAX load URL for detail
  const ajaxLoad = $('[data-jsLoad]').attr('data-jsLoad') || '';
  result.detailUrl = ajaxLoad;

  // Models (individual machines in this group)
  result.models = [];
  $('.c-product-card').each(function () {
    const codeVal = $(this).find('.jsAddToCompare').attr('value') || '';
    const href = $(this).find('a[href*="/produkt/"]').attr('href') || '';
    const title = $(this).find('.c-product-card__title').text().trim();
    const img = $(this).find('img').attr('src') || '';
    const badge = $(this).find('img[src*="badge_product"]').attr('src') || '';
    let badgeName = '';
    if (badge.includes('ramigreen')) badgeName = 'RamiGreen';
    else if (badge.includes('premium')) badgeName = 'Premium';

    if (title) {
      result.models.push({
        code: codeVal, slug: href, name: title,
        image: img ? (img.startsWith('http') ? img : BASE + img) : '',
        badge: badgeName,
      });
    }
  });

  return result;
}

function parseProductDetail(html) {
  const $ = cheerio.load(html);
  const p = {};

  // Price
  const priceTax = $('[class*="jsPriceSumTax"]');
  const priceNet = $('[class*="jsPriceSumNet"]');
  p.priceBrutto = parseFloat(priceTax.attr('data-price')) || null;
  p.priceNetto = parseFloat(priceNet.attr('data-price')) || null;

  // If no data-price, try text
  if (!p.priceBrutto) {
    const priceText = $('[class*="meta-info"] .font-14.font-bold').first().text().trim();
    const m = priceText.match(/([\d,]+)\s*zł/);
    if (m) p.priceBrutto = parseFloat(m[1].replace(',', '.'));
  }
  if (!p.priceNetto) {
    const netText = $('[class*="meta-info"] .text-light').first().text().trim();
    const m = netText.match(/([\d,]+)\s*zł/);
    if (m) p.priceNetto = parseFloat(m[1].replace(',', '.'));
  }

  // Also try standalone price text patterns
  if (!p.priceBrutto) {
    const allText = html;
    const m = allText.match(/data-price="([\d.]+)"/);
    if (m) p.priceBrutto = parseFloat(m[1]);
  }

  // Period info
  const periodLabel = $('[class*="meta-info"] .font-bold.text-light').first().text().trim();
  p.priceUnit = periodLabel.replace(/^\/\s*/, '') || 'Dzień';

  // Availability
  p.available = $('[class*="jsPlaceStatus"]').text().trim();
  p.place = $('[class*="jsPlaceLabel"]').text().trim();
  p.placeId = parseInt($('#jsPlaceId').val()) || null;
  p.groupId = parseInt($('[data-group_id]').attr('data-group_id')) || null;

  // Date
  p.dateFrom = $('#jsDateData').attr('data-from') || '';
  p.days = parseInt($('#jsDateData').attr('data-days')) || 1;

  // Insurance
  const cascoMatch = html.match(/RamiCasco\s*([\d%]+)/);
  p.ramiCasco = cascoMatch ? cascoMatch[1] : '';

  // Price type info
  p.priceType = '';
  if (html.includes('Katalogowa cena')) p.priceType = 'Katalogowa';
  if (html.includes('Indywidualna cena') || html.includes('indywidualn')) p.priceType = 'Indywidualna';

  // Billing info
  const billingMatch = html.match(/Dni fakturowane:\s*([^<]+)/);
  p.billing = billingMatch ? billingMatch[1].trim() : '';

  // No price → contact needed
  p.contactOnly = !p.priceBrutto && !p.priceNetto;

  return p;
}

// Parse individual /produkt/ page (model detail)
function parseProductPage(html, $) {
  const p = {};

  // Title
  p.title = $('h1, .p-product__title, [class*="product"] h2').first().text().trim()
    || $('title').text().replace(/\s*\|.*$/, '').trim();

  // Code
  const codeEl = $('span.text-primary.font-bold, [class*="product-code"]').first();
  p.code = codeEl.text().trim();

  // Description
  p.description = $('[class*="description"] p, [class*="description"]').first().text().trim().substring(0, 500);

  // Images
  p.images = [];
  $('[data-jsGalleryItems*="slide"] img, [data-jsGalleryItems*="slide"] source, .p-product img').each(function () {
    const src = $(this).attr('src') || $(this).attr('srcset') || '';
    if (src && !p.images.includes(src)) {
      p.images.push(src.startsWith('http') ? src : BASE + src);
    }
  });
  p.image = p.images[0] || '';

  // JSON-LD
  $('script[type="application/ld+json"]').each(function () {
    try {
      const ld = JSON.parse($(this).html());
      if (ld.offers) {
        p.priceBrutto = parseFloat(ld.offers.price) || null;
        p.currency = ld.offers.priceCurrency || 'PLN';
      }
      if (ld.brand) p.brand = (typeof ld.brand === 'string') ? ld.brand : ld.brand.name || '';
      if (ld.image && !p.image) p.image = ld.image;
    } catch (e) {}
  });

  // AJAX detail load URL
  p.detailUrl = $('[data-jsLoad]').attr('data-jsLoad') || '';

  // Try parsing inline price/detail from the same HTML
  const detail = parseProductDetail(html);
  Object.assign(p, { ...detail, title: p.title || detail.title });

  // Parameters/specs table
  p.specs = [];
  $('dt, [class*="param-name"]').each(function () {
    const name = $(this).text().trim();
    const val = $(this).next('dd, [class*="param-value"]').text().trim();
    if (name && val) p.specs.push({ name, value: val });
  });

  // Models (if this product page also has variant cards)
  p.models = [];
  $('.c-product-card').each(function () {
    const codeVal = $(this).find('.jsAddToCompare').attr('value') || '';
    const href = $(this).find('a[href*="/produkt/"]').attr('href') || '';
    const title = $(this).find('.c-product-card__title').text().trim();
    const img = $(this).find('img').attr('src') || '';
    if (title) {
      p.models.push({
        code: codeVal, slug: href, name: title,
        image: img ? (img.startsWith('http') ? img : BASE + img) : '',
        badge: '',
      });
    }
  });

  // Related from group link
  const groupLink = $('a[href*="/wynajem/"]').filter(function () {
    return $(this).text().includes('Wróć') || $(this).text().includes('grupa');
  }).attr('href') || '';
  p.groupSlug = groupLink;

  p.contactOnly = !p.priceBrutto && !p.priceNetto;
  return p;
}

// ═══ LOGIN ═══
async function doLogin(email, password) {
  const jar = new CookieJar();

  // Step 1: Visit homepage for cookies
  console.log('[AUTH] Step 1: Homepage...');
  const homeRes = await fetch(BASE + '/', {
    headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*' }, redirect: 'follow',
  });
  jar.addFromHeaders(homeRes.headers);
  console.log(`[AUTH]   Cookies: ${jar.size}`);

  // Step 2: POST login via AJAX
  console.log('[AUTH] Step 2: POST /konto...');
  const body = `account_login=${encodeURIComponent(email)}&account_password=${encodeURIComponent(password)}&account_mode=login`;
  const loginRes = await fetch(BASE + '/konto?basket=1', {
    method: 'POST',
    headers: {
      'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': '*/*', 'Origin': BASE, 'Referer': BASE + '/konto?basket=1',
      'X-Requested-With': 'XMLHttpRequest', 'Cookie': jar.toString(),
    },
    body, redirect: 'manual',
  });
  jar.addFromHeaders(loginRes.headers);
  console.log(`[AUTH]   Status: ${loginRes.status}, Cookies: ${jar.size}`);

  // Step 3: Get user info
  console.log('[AUTH] Step 3: GET /ajax/init...');
  const initRes = await fetchJSON('/ajax/init', jar);
  const acct = initRes.account || {};
  console.log(`[AUTH]   client_id: ${acct.client_id}, login: ${acct.client_login}`);

  if (!acct.client_id) throw new Error('Login failed — no client_id');

  return { jar, account: acct };
}

async function refreshSession(session) {
  if (!session?.email || !session?.password) return false;
  console.log(`[REFRESH] Re-logging ${session.email}...`);
  try {
    const { jar, account } = await doLogin(session.email, session.password);
    session.jar = jar;
    session.clientId = account.client_id;
    session.lastRefresh = Date.now();
    saveSessions();
    console.log('[REFRESH] ✓ OK');
    return true;
  } catch (e) {
    console.log(`[REFRESH] ✗ ${e.message}`);
    return false;
  }
}

async function refreshAllSessions(force = false) {
  for (const [, s] of sessions) {
    if (!s.password) continue;
    const age = Date.now() - (s.lastRefresh || s.loginTime || 0);
    if (force || age > 3600000) await refreshSession(s);
  }
}
setInterval(() => refreshAllSessions(), 3600000);

// ═══ ROUTES ═══

app.get('/', (req, res) => {
  res.json({ status: 'ok', proxy: 'Ramirent.pl Proxy v1', port: PORT, sessions: sessions.size });
});

// Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email + password' });
  console.log(`\n[AUTH] === Login: ${email} ===`);
  try {
    const { jar, account } = await doLogin(email, password);
    const sid = crypto.randomBytes(16).toString('hex');
    sessions.set(sid, {
      jar, email, password,
      clientId: account.client_id, clientLogin: account.client_login,
      clientType: account.client_type,
      loginTime: Date.now(), lastUsed: Date.now(), lastRefresh: Date.now(),
    });
    saveSessions();
    console.log(`[AUTH] === ✓ SUCCESS (sid: ${sid.substring(0, 8)}...) ===\n`);
    res.json({
      success: true, sid,
      clientId: account.client_id, email: account.client_login,
      clientType: account.client_type,
    });
  } catch (e) {
    console.error(`[AUTH ERROR] ${e.message}`);
    res.status(401).json({ error: e.message });
  }
});

app.get('/api/session', (req, res) => {
  const s = getSession(req);
  if (!s) return res.json({ authenticated: false });
  res.json({ authenticated: true, clientId: s.clientId, email: s.clientLogin, clientType: s.clientType });
});

app.post('/api/logout', (req, res) => {
  const sid = req.body.sid || req.query.sid || '';
  if (sid) sessions.delete(sid);
  saveSessions();
  res.json({ success: true });
});

// ═══ CATEGORIES ═══
// Top-level: scrape from the main nav
let catCache = null, catCacheTime = 0;
app.get('/api/categories', async (req, res) => {
  if (catCache && Date.now() - catCacheTime < 3600000) return res.json(catCache);
  const session = getSession(req);
  try {
    const html = await fetchHTML('/wynajem', session?.jar);
    const cats = parseCategories(html);
    // Hardcoded fallback if parsing fails
    const result = cats.length ? cats : [
      { slug: '/wynajem/wg-produktu/lekki-sprzet-budowlany', name: 'Lekki sprzęt budowlany', image: '' },
      { slug: '/wynajem/wg-produktu/ciezki-sprzet-budowlany', name: 'Ciężki sprzęt budowlany', image: '' },
      { slug: '/wynajem/wg-produktu/podnosniki', name: 'Podnośniki', image: '' },
      { slug: '/wynajem/wg-produktu/zasilanie-i-ogrzewanie', name: 'Zasilanie i ogrzewanie', image: '' },
      { slug: '/wynajem/wg-produktu/ogrodzenia-i-podpory-stropowe', name: 'Ogrodzenia i podpory stropowe', image: '' },
      { slug: '/wynajem/wg-produktu/kontenery', name: 'Kontenery', image: '' },
      { slug: '/wynajem/wg-produktu/rusztowania-i-uslugi', name: 'Rusztowania i usługi', image: '' },
      { slug: '/wynajem/wg-produktu/podesty-i-dzwigi-budowlane', name: 'Podesty i dźwigi budowlane', image: '' },
    ];
    catCache = { categories: result, total: result.length };
    catCacheTime = Date.now();
    console.log(`[CATEGORIES] ${result.length} parsed`);
    res.json(catCache);
  } catch (e) { res.status(500).json({ error: e.message, categories: [] }); }
});

// ═══ SUBCATEGORIES (browse into a category) ═══
app.get('/api/browse', async (req, res) => {
  const slug = req.query.slug || '';
  if (!slug) return res.status(400).json({ error: 'Missing slug' });
  const session = getSession(req);
  try {
    const path = slug.startsWith('/') ? slug : '/' + slug;
    console.log(`[BROWSE] ${path}`);
    const html = await fetchHTML(path, session?.jar);
    const $ = cheerio.load(html);

    // Check if this is a GROUP page (has product models) or category page (has subcategory tiles)
    const hasModels = $('.c-product-card').length > 0;
    const hasDetailLoad = $('[data-jsLoad]').length > 0;

    if (hasModels || hasDetailLoad) {
      // This is a product GROUP page — parse it fully
      const group = parseGroupPage(html, path);

      // Try to load AJAX detail for prices
      const detailUrl = group.detailUrl || path;
      try {
        const detailRes = await fetchAJAX(detailUrl, session?.jar);
        const detailHtml = await detailRes.text();
        if (detailHtml.length > 100) {
          const detail = parseProductDetail(detailHtml);
          Object.assign(group, detail);
        }
      } catch (e) { console.log(`[BROWSE] Detail AJAX failed: ${e.message}`); }

      res.json({ type: 'group', group });
    } else if (path.startsWith('/produkt/')) {
      // Individual product/model page
      const product = parseProductPage(html, $);

      // Try AJAX detail if available
      if (product.detailUrl) {
        try {
          const detailRes = await fetchAJAX(product.detailUrl, session?.jar);
          const detailHtml = await detailRes.text();
          if (detailHtml.length > 100) {
            const detail = parseProductDetail(detailHtml);
            // Merge but keep product title
            const title = product.title;
            Object.assign(product, detail);
            product.title = title;
          }
        } catch (e) { console.log(`[BROWSE] Product detail AJAX failed: ${e.message}`); }
      }

      console.log(`[BROWSE] Product: ${product.title} → ${product.priceBrutto || 'no price'}`);
      res.json({ type: 'group', group: product });
    } else {
      // Category page — extract subcategory tiles
      const subs = [];

      // Method 1: tiles with images
      $('a[href*="/wynajem/"]').each(function () {
        const href = $(this).attr('href') || '';
        const cls = $(this).attr('class') || '';
        // Skip header nav links
        if ($(this).parents('header, nav, .c-header, .c-footer, footer').length) return;
        const title = $(this).find('[class*="title"], h2, h3, .font-bold').first().text().trim()
          || $(this).text().trim().split('\n')[0].trim();
        const img = $(this).find('img').attr('src') || $(this).find('source').attr('srcset') || '';
        if (title && title.length < 120 && href.includes('/wynajem/')) {
          subs.push({
            slug: href, name: title,
            image: img ? (img.startsWith('http') ? img : BASE + img) : '',
          });
        }
      });

      // Deduplicate
      const seen = new Set();
      const uniqueSubs = subs.filter(s => {
        if (seen.has(s.slug)) return false; seen.add(s.slug); return true;
      });

      // Page title
      const title = $('h1').first().text().trim() || $('title').text().replace('| Ramirent.pl', '').trim();

      console.log(`[BROWSE] Category: ${title} → ${uniqueSubs.length} items`);
      res.json({ type: 'category', title, items: uniqueSubs });
    }
  } catch (e) {
    console.error(`[BROWSE ERROR] ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

// ═══ PRODUCT DETAIL ═══
app.get('/api/product', async (req, res) => {
  const slug = req.query.slug || '';
  if (!slug) return res.status(400).json({ error: 'Missing slug' });
  const session = getSession(req);
  try {
    const path = slug.startsWith('/') ? slug : '/' + slug;
    console.log(`[PRODUCT] ${path}`);

    // Full page load
    const html = await fetchHTML(path, session?.jar);
    const group = parseGroupPage(html, path);

    // AJAX detail for prices
    const detailUrl = group.detailUrl || path;
    try {
      const detailRes = await fetchAJAX(detailUrl, session?.jar);
      const detailHtml = await detailRes.text();
      if (detailHtml.length > 100) {
        const detail = parseProductDetail(detailHtml);
        Object.assign(group, detail);
      }
    } catch (e) { console.log(`[PRODUCT] Detail AJAX failed: ${e.message}`); }

    // Related products
    try {
      if (group.groupId) {
        const connRes = await fetchAJAX(`/ajax/groupsConnections/${group.groupId}`, session?.jar);
        const connHtml = await connRes.text();
        if (connHtml.length > 100) {
          const $c = cheerio.load(connHtml);
          group.related = [];
          $c('a[href*="/wynajem/"]').each(function () {
            const href = $c(this).attr('href') || '';
            const title = $c(this).find('.c-product-card__title').text().trim();
            const img = $c(this).find('img').attr('src') || '';
            if (title) {
              group.related.push({
                slug: href, name: title,
                image: img ? (img.startsWith('http') ? img : BASE + img) : '',
              });
            }
          });
        }
      }
    } catch (e) { /* ignore */ }

    res.json({ product: group });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══ SET PLACE (branch) ═══
app.post('/api/setPlace', async (req, res) => {
  const { placeId } = req.body;
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });
  if (!placeId) return res.status(400).json({ error: 'Missing placeId' });
  try {
    const r = await fetch(BASE + '/ajax/setSessionPlace', {
      method: 'POST',
      headers: {
        'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest', 'Cookie': session.jar.toString(),
        'Referer': BASE + '/',
      },
      body: `placeId=${placeId}`,
    });
    session.jar.addFromHeaders(r.headers);
    saveSessions();
    res.json({ success: true, placeId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══ DEBUG ═══
app.get('/api/debug', async (req, res) => {
  const session = getSession(req);
  const result = { hasSession: !!session, cookies: session?.jar?.size || 0 };
  if (session) {
    try {
      const init = await fetchJSON('/ajax/init', session.jar);
      result.account = init.account;
      result.basketCount = init.basketCount;
    } catch (e) { result.error = e.message; }
  }
  res.json(result);
});

// ═══ START ═══
app.listen(PORT, async () => {
  loadSessions();
  if (sessions.size) { console.log('[STARTUP] Refreshing...'); await refreshAllSessions(true); }
  console.log(`
╔══════════════════════════════════════════════════════════╗
║  Ramirent.pl Proxy v1  (Wypożyczalnia sprzętu)           ║
║  http://localhost:${PORT}                                  ║
║                                                          ║
║  POST /api/login      {email, password}                  ║
║  GET  /api/categories                                    ║
║  GET  /api/browse     ?slug=/wynajem/...&sid=...         ║
║  GET  /api/product    ?slug=/wynajem/...&sid=...         ║
║  POST /api/setPlace   {placeId}&sid=...                  ║
║  GET  /api/debug      ?sid=...                           ║
╚══════════════════════════════════════════════════════════╝
  `);
});
