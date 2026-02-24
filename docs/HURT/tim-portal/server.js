/**
 * TIM.pl Proxy v6
 * 
 * Auth flow from HAR analysis:
 * 1. GET homepage → collect cookies + extract form_key
 * 2. POST /nuxt-api/auth/login?farv=2 → session cookies
 * 3. POST /nuxt-api/auth/customer → verify login
 * 4. GraphQL /api/v1/graphql with cookies → personal prices
 * 
 * Key GQL operations:
 *   multiplePricesAndStocks(skuList) → personal netValue/grossValue
 *   multipleProductsStock(skuList) → stock qty/availability
 *   categoriesListingMultipleFurtherPrices(skuList) → discount%
 */

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const crypto = require('crypto');

const app = express();
const PORT = 3001;
const BASE = 'https://www.tim.pl';
const GQL = BASE + '/api/v1/graphql';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';

app.use(cors());
app.use(express.json());

// ═══ COOKIE JAR ═══
class CookieJar {
  constructor() { this.cookies = new Map(); }
  
  // Parse set-cookie headers and store
  addFromHeaders(headers) {
    const sc = headers.raw()['set-cookie'] || [];
    for (const h of sc) {
      const parts = h.split(';')[0].split('=');
      const name = parts[0].trim();
      const value = parts.slice(1).join('=').trim();
      if (name) this.cookies.set(name, value);
    }
  }
  
  // Get Cookie header string
  toString() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
  
  get(name) { return this.cookies.get(name); }
  set(name, value) { this.cookies.set(name, value); }
  get size() { return this.cookies.size; }
}

// ═══ SESSIONS (persistent to disk) ═══
const fs = require('fs');
const path = require('path');
const SESSIONS_FILE = path.join(__dirname, '.tim-sessions.json');
const SESSION_TTL = Infinity; // never expire

const sessions = new Map();

// Load sessions from disk on startup
function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
      for (const [sid, s] of Object.entries(data)) {
        const jar = new CookieJar();
        if (s._cookies) for (const [k, v] of Object.entries(s._cookies)) jar.set(k, v);
        sessions.set(sid, { ...s, jar, _cookies: undefined });
      }
      console.log(`[SESSIONS] Loaded ${sessions.size} from disk`);
    }
  } catch(e) { console.log('[SESSIONS] Load error:', e.message); }
}

function saveSessions() {
  try {
    const data = {};
    for (const [sid, s] of sessions) {
      data[sid] = {
        ...s,
        jar: undefined,
        _cookies: s.jar ? Object.fromEntries(s.jar.cookies) : {},
      };
    }
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2));
  } catch(e) { console.log('[SESSIONS] Save error:', e.message); }
}

function getSession(req) {
  const sid = req.query.sid || req.headers['x-session-id'] || '';
  const s = sid ? sessions.get(sid) : null;
  if (s) s.lastUsed = Date.now();
  return s;
}

// Proactive refresh: re-login ALL sessions to keep cookies alive
async function refreshAllSessions(forceAll = false) {
  for (const [sid, s] of sessions) {
    if (!s.password || !s.username) continue;
    const age = Date.now() - (s.lastRefresh || s.loginTime || 0);
    if (forceAll || age > 2 * 3600000) {
      console.log(`[AUTO-REFRESH] Refreshing ${s.username}...`);
      await refreshSession(s);
    }
  }
}

// Save every 5 min + proactive refresh every 2 hours
setInterval(() => saveSessions(), 300000);
setInterval(() => refreshAllSessions(), 2 * 3600000);

// ═══ FETCH HELPERS ═══
function makeHeaders(session) {
  const h = {
    'User-Agent': UA,
    'Accept': '*/*',
    'Accept-Language': 'pl-PL,pl;q=0.9',
    'Origin': BASE,
    'Referer': BASE + '/',
  };
  if (session?.jar) h['Cookie'] = session.jar.toString();
  return h;
}

async function fetchPage(path, session) {
  const url = path.startsWith('http') ? path : BASE + path;
  const headers = makeHeaders(session);
  headers['Accept'] = 'text/html,*/*';
  const res = await fetch(url, { headers, redirect: 'follow', timeout: 20000 });
  if (session?.jar) session.jar.addFromHeaders(res.headers);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function gqlPost(operationName, query, variables, session) {
  const headers = makeHeaders(session);
  headers['Content-Type'] = 'application/json';
  
  const url = operationName ? `${GQL}?ton=${operationName}` : GQL;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ operationName: operationName || undefined, query, variables }),
    timeout: 15000,
  });
  if (session?.jar) session.jar.addFromHeaders(res.headers);
  const data = await res.json();
  if (data.errors) throw new Error(data.errors.map(e => e.message).join('; '));
  return data.data;
}

function extractSku(url) {
  const m = (url || '').match(/\/p\/([^\s?#]+)/);
  return m ? m[1] : '';
}

function extractJsonLd(html) {
  const $ = cheerio.load(html);
  const r = [];
  $('script[type="application/ld+json"]').each(function() {
    try { r.push(JSON.parse($(this).html())); } catch(e) {}
  });
  return r;
}

// ═══ GQL QUERIES (from HAR) ═══

// Auto-refresh: re-login if GQL fails
async function refreshSession(session) {
  if (!session?.username || !session?.password) return false;
  console.log(`[REFRESH] Re-logging ${session.username}...`);
  
  try {
    const jar = new CookieJar();
    
    // Step 1: Homepage cookies
    const homeRes = await fetch(BASE + '/', {
      headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*' },
      redirect: 'follow',
    });
    jar.addFromHeaders(homeRes.headers);
    
    let formKey = jar.get('form_key') || crypto.randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
    
    // Step 2: Login
    const loginRes = await fetch(BASE + '/nuxt-api/auth/login?farv=2', {
      method: 'POST',
      headers: {
        'User-Agent': UA, 'Content-Type': 'application/json',
        'Accept': 'application/json', 'Origin': BASE, 'Referer': BASE + '/',
        'Cookie': jar.toString(),
      },
      body: JSON.stringify({
        username: encodeURIComponent(session.username),
        password: encodeURIComponent(session.password),
        form_key: formKey, rememberme: true,
      }),
      redirect: 'manual',
    });
    jar.addFromHeaders(loginRes.headers);
    
    const loginData = await loginRes.json().catch(() => null);
    if (loginData?.login?.content?.formKey) {
      formKey = loginData.login.content.formKey;
      jar.set('form_key', formKey);
    }
    
    // Step 3: Customer
    const custRes = await fetch(BASE + '/nuxt-api/auth/customer', {
      method: 'POST',
      headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Content-Type': 'application/json', 'Origin': BASE, 'Cookie': jar.toString() },
      body: '{}',
    });
    jar.addFromHeaders(custRes.headers);
    
    // Step 4: Test
    const testSession = { jar };
    const data = await gqlPost('multiplePricesAndStocks', Q_PRICES, { skuList: ['0001-00001-08602'] }, testSession);
    if (data?.productsArea?.products?.edges?.length) {
      session.jar = jar;
      session.formKey = formKey;
      session.gqlWorks = true;
      session.lastRefresh = Date.now();
      saveSessions();
      console.log('[REFRESH] ✓ Session refreshed!');
      return true;
    }
  } catch(e) {
    console.log(`[REFRESH] ✗ Failed: ${e.message}`);
  }
  return false;
}

// Wrapper: try GQL, auto-refresh on any failure
async function gqlWithRefresh(opName, query, variables, session) {
  try {
    return await gqlPost(opName, query, variables, session);
  } catch(e) {
    if (session?.password) {
      console.log(`[GQL] Error "${e.message.substring(0,60)}", auto-refreshing...`);
      const ok = await refreshSession(session);
      if (ok) return await gqlPost(opName, query, variables, session);
    }
    throw e;
  }
}

const Q_PRICES = `query multiplePricesAndStocks($skuList: [String]) {
  productsArea {
    products(sku_list: $skuList) {
      edges {
        node {
          sku
          price {
            currencyCode
            taxes { value taxRate }
            netValue
            grossValue
            taxValue
          }
          stock {
            availability { central shippingColor shippingText stockColor }
            qty
            unit
          }
        }
      }
    }
  }
}`;

const Q_FURTHER_PRICES = `query categoriesListingMultipleFurtherPrices($skuList: [String]) {
  productsArea {
    products(sku_list: $skuList) {
      edges {
        node {
          sku
          discountPercent
          price {
            currencyCode
            taxes { value taxRate }
            netValue
            grossValue
            taxValue
          }
          manufacturerPrice {
            currencyCode
            taxes { value taxRate }
            netValue
            grossValue
            taxValue
          }
        }
      }
    }
  }
}`;

const Q_CUSTOMER = `query { customerArea { recentlyViewedProductList(limit: 1) } }`;

// ═══ STATUS ═══
app.get('/', (req, res) => {
  res.json({ status: 'ok', proxy: 'TIM.pl Proxy v6', sessions: sessions.size });
});

// ═══ LOGIN ═══
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username + password required' });
  
  console.log(`\n[AUTH] === Login: ${username} ===`);
  const jar = new CookieJar();
  
  try {
    // Step 1: Get homepage cookies
    console.log('[AUTH] Step 1: Fetching homepage for cookies...');
    const homeRes = await fetch(BASE + '/', {
      headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*' },
      redirect: 'follow',
    });
    jar.addFromHeaders(homeRes.headers);
    console.log(`[AUTH]   Cookies: ${jar.size} (${jar.toString().substring(0, 100)}...)`);
    
    // Extract form_key from cookies or generate one
    let formKey = jar.get('form_key') || '';
    
    if (!formKey) {
      // Try to get form_key from HTML/NUXT data
      const html = await homeRes.text();
      const fkMatch = html.match(/form_key['":\s]+['"]([a-zA-Z0-9]{8,32})['"]/);
      if (fkMatch) {
        formKey = fkMatch[1];
        console.log(`[AUTH]   form_key from HTML: ${formKey}`);
      } else {
        const nfkMatch = html.match(/formKey['":\s]+['"]([a-zA-Z0-9]{8,32})['"]/);
        if (nfkMatch) {
          formKey = nfkMatch[1];
          console.log(`[AUTH]   formKey from NUXT: ${formKey}`);
        }
      }
    } else {
      console.log(`[AUTH]   form_key from cookie: ${formKey}`);
    }
    
    // Generate random form_key if not found
    if (!formKey) {
      formKey = crypto.randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
      console.log(`[AUTH]   form_key generated: ${formKey}`);
    }
    
    // Step 2: POST /nuxt-api/auth/login
    console.log('[AUTH] Step 2: POST /nuxt-api/auth/login...');
    const loginBody = JSON.stringify({
      username: encodeURIComponent(username),
      password: encodeURIComponent(password),
      form_key: formKey,
      rememberme: true,
    });
    
    const loginRes = await fetch(BASE + '/nuxt-api/auth/login?farv=2', {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': BASE,
        'Referer': BASE + '/',
        'Cookie': jar.toString(),
      },
      body: loginBody,
      redirect: 'manual',
    });
    
    jar.addFromHeaders(loginRes.headers);
    
    const loginData = await loginRes.json().catch(() => null);
    console.log(`[AUTH]   Status: ${loginRes.status}`);
    console.log(`[AUTH]   Response: ${JSON.stringify(loginData).substring(0, 300)}`);
    console.log(`[AUTH]   Cookies now: ${jar.size}`);
    
    // Extract form_key from login response
    if (loginData?.formKey || loginData?.form_key) {
      formKey = loginData.formKey || loginData.form_key;
      jar.set('form_key', formKey);
      console.log(`[AUTH]   Updated form_key from response: ${formKey}`);
    }
    if (loginData?.login?.content?.formKey) {
      formKey = loginData.login.content.formKey;
      jar.set('form_key', formKey);
      console.log(`[AUTH]   Updated form_key from login.content: ${formKey}`);
    }
    
    // Check for login errors
    const notifications = loginData?.login?.notifications || loginData?.login?.content?.notifications || [];
    if (Array.isArray(notifications) && notifications.length) {
      const errMsgs = notifications.filter(n => n.type === 'error').map(n => n.text || n.message).join('; ');
      if (errMsgs) {
        console.log(`[AUTH]   ✗ Login error: ${errMsgs}`);
        return res.status(401).json({ error: errMsgs });
      }
    }
    
    // Check token
    const token = loginData?.login?.content?.token || '';
    if (token) console.log(`[AUTH]   Token received: ${token.substring(0, 20)}...`);
    
    // Step 3: POST /nuxt-api/auth/customer to get customer data
    console.log('[AUTH] Step 3: GET customer data...');
    const custRes = await fetch(BASE + '/nuxt-api/auth/customer', {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Origin': BASE,
        'Referer': BASE + '/',
        'Cookie': jar.toString(),
      },
      body: '{}',
    });
    jar.addFromHeaders(custRes.headers);
    
    const custData = await custRes.json().catch(() => null);
    const customerEmail = custData?.customer?.email || custData?.email || '';
    const isLoggedIn = custData?.is_logged_in || custData?.customer?.is_logged_in || false;
    console.log(`[AUTH]   Customer: ${customerEmail}, logged_in: ${isLoggedIn}`);
    console.log(`[AUTH]   Cookies now: ${jar.size} (${jar.toString().substring(0, 100)}...)`);
    
    // Extract formKey from customer response
    if (custData?.formKey || custData?.form_key) {
      formKey = custData.formKey || custData.form_key;
      jar.set('form_key', formKey);
      console.log(`[AUTH]   formKey from customer: ${formKey}`);
    }
    
    // Step 4: Test GraphQL with cookies
    console.log('[AUTH] Step 4: Test GraphQL...');
    let gqlWorks = false;
    let testPrice = null;
    
    try {
      const testSession = { jar };
      const data = await gqlPost('multiplePricesAndStocks', Q_PRICES, { skuList: ['0001-00001-08602'] }, testSession);
      const products = data?.productsArea?.products?.edges || [];
      if (products.length) {
        const node = products[0].node;
        testPrice = node.price?.netValue;
        gqlWorks = true;
        console.log(`[AUTH]   ✓ GQL works! Test SKU 08602: ${testPrice} ${node.price?.currencyCode} (stock: ${node.stock?.qty} ${node.stock?.unit})`);
      }
    } catch(e) {
      console.log(`[AUTH]   ✗ GQL test: ${e.message}`);
    }
    
    // Create session
    const sid = crypto.randomBytes(16).toString('hex');
    sessions.set(sid, {
      jar, formKey, username: customerEmail || username,
      password, // stored for auto-refresh
      loginTime: Date.now(), lastUsed: Date.now(),
      gqlWorks, isLoggedIn: !!isLoggedIn || gqlWorks,
    });
    
    saveSessions();
    
    const success = gqlWorks || isLoggedIn || jar.size > 3;
    console.log(`[AUTH] === Result: ${success ? '✓ SUCCESS' : '? PARTIAL'} (sid: ${sid.substring(0, 8)}..., gql: ${gqlWorks}) ===\n`);
    
    res.json({
      success,
      sid,
      username: customerEmail || username,
      gqlEnabled: gqlWorks,
      isLoggedIn: !!isLoggedIn,
      testPrice: testPrice,
      cookieCount: jar.size,
    });
    
  } catch(e) {
    console.error(`[AUTH ERROR] ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

// ═══ SESSION STATUS ═══
app.get('/api/session', (req, res) => {
  const s = getSession(req);
  if (!s) return res.json({ authenticated: false });
  res.json({ authenticated: true, username: s.username, gqlWorks: s.gqlWorks, isLoggedIn: s.isLoggedIn });
});

// ═══ LOGOUT ═══
app.post('/api/logout', (req, res) => {
  const sid = req.body.sid || req.query.sid || '';
  if (sid) sessions.delete(sid);
  saveSessions();
  res.json({ success: true });
});

// ═══ BATCH PRICES via GQL ═══
async function fetchPersonalPrices(skuList, session) {
  if (!session?.gqlWorks || !skuList.length) return new Map();
  
  const prices = new Map();
  // Batch in groups of 20
  for (let i = 0; i < skuList.length; i += 20) {
    const batch = skuList.slice(i, i + 20);
    try {
      const data = await gqlWithRefresh('multiplePricesAndStocks', Q_PRICES, { skuList: batch }, session);
      const edges = data?.productsArea?.products?.edges || [];
      for (const { node } of edges) {
        if (node.sku && node.price) {
          prices.set(node.sku, {
            netValue: node.price.netValue,
            grossValue: node.price.grossValue,
            currency: node.price.currencyCode || 'PLN',
            stock: node.stock?.qty,
            unit: node.stock?.unit,
            stockColor: node.stock?.availability?.stockColor,
            shippingText: node.stock?.availability?.shippingText,
          });
        }
      }
    } catch(e) {
      console.log(`[PRICES GQL] Batch error: ${e.message}`);
    }
  }
  return prices;
}

// ═══ CATEGORIES ═══
let catCache = null, catCacheTime = 0;

app.get('/api/categories', async (req, res) => {
  if (catCache && Date.now() - catCacheTime < 3600000) return res.json(catCache);
  const session = getSession(req);
  
  try {
    const html = await fetchPage('/', session);
    const $ = cheerio.load(html);
    const skip = new Set(['centrum-pomocy','kategorie','producenci','promocje','strefa-nowosci','strefa-porad','centrum-uslug','kontakt','najnowsze-produkty','strefa-dla-przemyslu','outlet','koszyk-rwd']);
    
    const mainCats = [], subMap = {}, ssubMap = {};
    $('a[href]').each(function() {
      const href = $(this).attr('href') || '';
      const text = $(this).text().trim().replace(/\s+/g, ' ');
      if (!href.startsWith('/') || href === '/' || !text || text.length < 2 || text.length > 80) return;
      if (href.includes('.') || href.includes('?') || href.startsWith('/_')) return;
      const parts = href.split('/').filter(Boolean);
      if (parts.length === 1 && !skip.has(parts[0]) && !mainCats.find(c => c.slug === href)) mainCats.push({ name: text, slug: href });
      else if (parts.length === 2) { const p = '/' + parts[0]; if (!subMap[p]) subMap[p] = []; if (!subMap[p].find(c => c.slug === href)) subMap[p].push({ name: text, slug: href }); }
      else if (parts.length === 3) { const p = '/' + parts[0] + '/' + parts[1]; if (!ssubMap[p]) ssubMap[p] = []; if (!ssubMap[p].find(c => c.slug === href)) ssubMap[p].push({ name: text, slug: href }); }
    });
    
    const tree = mainCats.filter(c => !skip.has(c.slug.replace('/', ''))).map(c => ({
      ...c, subcategories: (subMap[c.slug] || []).map(s => ({ ...s, subcategories: ssubMap[s.slug] || [] })),
    }));
    
    catCache = { categories: tree, total: tree.length };
    catCacheTime = Date.now();
    console.log(`[CATEGORIES] ${tree.length}`);
    res.json(catCache);
  } catch(e) {
    res.status(500).json({ error: e.message, categories: [] });
  }
});

// ═══ PRODUCTS ═══
app.get('/api/products', async (req, res) => {
  const cat = req.query.cat || '';
  const page = parseInt(req.query.p) || 1;
  const session = getSession(req);
  if (!cat) return res.status(400).json({ error: 'Missing cat' });
  
  try {
    const path = (cat.startsWith('/') ? cat : '/' + cat) + (page > 1 ? `?page=${page}` : '');
    const html = await fetchPage(path, session);
    const jsonLdList = extractJsonLd(html);
    
    let products = [];
    for (const ld of jsonLdList) {
      if (ld['@type'] === 'ItemList' && ld.itemListElement) {
        products = ld.itemListElement.map(item => {
          const p = item.item || item;
          return {
            name: p.name || '', sku: extractSku(p.url || ''), url: p.url || '',
            image: Array.isArray(p.image) ? p.image[0] : (p.image || ''),
            price: p.offers?.price ? parseFloat(p.offers.price) : null,
            rating: p.aggregateRating?.ratingValue || null,
          };
        });
        break;
      }
    }
    
    // Fetch personal prices via GraphQL
    const skuList = products.map(p => p.sku).filter(Boolean);
    let source = 'public';
    
    if (session?.gqlWorks && skuList.length) {
      const personalPrices = await fetchPersonalPrices(skuList, session);
      if (personalPrices.size) {
        source = 'personal';
        for (const p of products) {
          const pp = personalPrices.get(p.sku);
          if (pp) {
            p.publicPrice = p.price;
            p.price = pp.netValue;
            p.grossPrice = pp.grossValue;
            p.stock = pp.stock;
            p.unit = pp.unit;
            p.stockColor = pp.stockColor;
            p.shippingText = pp.shippingText;
          }
        }
        console.log(`[PRODUCTS] ${cat} p${page}: ${products.length} items, ${personalPrices.size} personal prices`);
      }
    }
    
    // Pagination
    const $ = cheerio.load(html);
    let totalPages = page;
    $('a[href]').each(function() {
      const m = ($(this).attr('href') || '').match(/[?&]page=(\d+)/);
      if (m) { const pg = parseInt(m[1]); if (pg > totalPages) totalPages = pg; }
    });
    
    res.json({ products, page, totalPages, totalProducts: products.length, source });
  } catch(e) {
    res.status(500).json({ error: e.message, products: [] });
  }
});

// ═══ PRODUCT DETAIL ═══
app.get('/api/product', async (req, res) => {
  const url = req.query.url || '';
  const sku = req.query.sku || extractSku(url);
  const session = getSession(req);
  if (!url && !sku) return res.status(400).json({ error: 'Need url or sku' });
  
  try {
    let product = {};
    let source = 'public';
    
    // Scrape product page for base data
    if (url) {
      const html = await fetchPage(url, session);
      const $ = cheerio.load(html);
      const jsonLdList = extractJsonLd(html);
      
      let ldProduct = null;
      for (const ld of jsonLdList) {
        if (ld['@type'] === 'Product') { ldProduct = ld; break; }
      }
      
      // NUXT data extraction
      let nuxt = {};
      $('script#__NUXT_DATA__').each(function() {
        try {
          const raw = $(this).html() || '';
          const ex = (pat) => { const m = raw.match(pat); return m ? m[1] : ''; };
          nuxt.manufacturer = ex(/"manufacturer_name"[^"]*?"([^"]{2,60})"/) || ex(/"manufacturer"[^}]*?"name"[^"]*?"([^"]{2,60})"/);
          nuxt.ref_num = ex(/"ref_num"[^"]*?"([^"]+)"/);
          nuxt.ean = ex(/"ean"[^"]*?"(\d{8,16})"/);
          nuxt.series = ex(/"series_name"[^"]*?"([^"]+)"/) || ex(/"series"[^}]*?"name"[^"]*?"([^"]+)"/);
        } catch(e) {}
      });
      
      let breadcrumb = '';
      for (const ld of jsonLdList) {
        if (ld['@type'] === 'BreadcrumbList') breadcrumb = ld.itemListElement.map(b => b.name).join(' › ');
      }
      
      product = {
        sku: sku || extractSku(url),
        name: ldProduct?.name || $('h1').first().text().trim(),
        price: ldProduct?.offers?.price ? parseFloat(ldProduct.offers.price) : null,
        image: ldProduct?.image ? (Array.isArray(ldProduct.image) ? ldProduct.image[0] : ldProduct.image) : '',
        url, manufacturer: nuxt.manufacturer || '', ref_num: nuxt.ref_num || '',
        ean: nuxt.ean || '', series: nuxt.series || '',
        rating: ldProduct?.aggregateRating?.ratingValue || null,
        reviewCount: ldProduct?.aggregateRating?.reviewCount || null,
        breadcrumb, attributes: [],
      };
    }
    
    // Get personal price + stock via GQL
    const targetSku = sku || product.sku;
    if (session?.gqlWorks && targetSku) {
      const personalPrices = await fetchPersonalPrices([targetSku], session);
      const pp = personalPrices.get(targetSku);
      if (pp) {
        product.publicPrice = product.price;
        product.price = pp.netValue;
        product.grossPrice = pp.grossValue;
        product.stock_qty = pp.stock;
        product.unit = pp.unit;
        product.stockColor = pp.stockColor;
        product.shippingText = pp.shippingText;
        source = 'personal';
      }
    }
    
    res.json({ product, source });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══ SEARCH ═══
app.get('/api/search', async (req, res) => {
  const q = req.query.q || '';
  const session = getSession(req);
  if (!q) return res.status(400).json({ error: 'Missing q' });
  
  try {
    const html = await fetchPage(`/catalogsearch/result/?q=${encodeURIComponent(q)}`, session);
    const jsonLdList = extractJsonLd(html);
    
    let products = [];
    for (const ld of jsonLdList) {
      if (ld['@type'] === 'ItemList' && ld.itemListElement) {
        products = ld.itemListElement.map(item => {
          const p = item.item || item;
          return {
            name: p.name || '', sku: extractSku(p.url || ''), url: p.url || '',
            image: Array.isArray(p.image) ? p.image[0] : (p.image || ''),
            price: p.offers?.price ? parseFloat(p.offers.price) : null,
          };
        });
        break;
      }
    }
    
    // Get personal prices
    let source = 'public';
    const skuList = products.map(p => p.sku).filter(Boolean);
    if (session?.gqlWorks && skuList.length) {
      const pp = await fetchPersonalPrices(skuList, session);
      if (pp.size) {
        source = 'personal';
        for (const p of products) {
          const price = pp.get(p.sku);
          if (price) { p.publicPrice = p.price; p.price = price.netValue; }
        }
      }
    }
    
    res.json({ products, query: q, total: products.length, source });
  } catch(e) {
    res.status(500).json({ error: e.message, products: [] });
  }
});

// ═══ DEBUG ═══
app.get('/api/debug-auth', async (req, res) => {
  const session = getSession(req);
  const sku = req.query.sku || '0001-00001-08602';
  
  const result = {
    hasSession: !!session,
    cookieCount: session?.jar?.size || 0,
    gqlWorks: session?.gqlWorks || false,
    isLoggedIn: session?.isLoggedIn || false,
    username: session?.username || '',
  };
  
  // Test GQL price
  if (session) {
    try {
      const data = await gqlPost('multiplePricesAndStocks', Q_PRICES, { skuList: [sku] }, session);
      const edges = data?.productsArea?.products?.edges || [];
      if (edges.length) {
        const node = edges[0].node;
        result.gqlPrice = {
          sku: node.sku,
          netValue: node.price?.netValue,
          grossValue: node.price?.grossValue,
          currency: node.price?.currencyCode,
          stock: node.stock?.qty,
          unit: node.stock?.unit,
        };
      }
    } catch(e) { result.gqlError = e.message; }
    
    // Also test discount prices
    try {
      const data = await gqlPost('categoriesListingMultipleFurtherPrices', Q_FURTHER_PRICES, { skuList: [sku] }, session);
      const edges = data?.productsArea?.products?.edges || [];
      if (edges.length) {
        const node = edges[0].node;
        result.gqlDiscount = {
          sku: node.sku,
          discountPercent: node.discountPercent,
          netValue: node.price?.netValue,
          manufacturerNetValue: node.manufacturerPrice?.netValue,
        };
      }
    } catch(e) { result.gqlDiscountError = e.message; }
  }
  
  // Compare with public price
  try {
    const html = await fetchPage(`/catalogsearch/result/?q=${sku}`, null);
    const lds = extractJsonLd(html);
    for (const ld of lds) {
      if (ld['@type'] === 'ItemList' && ld.itemListElement?.[0]) {
        const p = ld.itemListElement[0].item || ld.itemListElement[0];
        result.publicPrice = p.offers?.price;
        result.publicName = p.name;
      }
    }
  } catch(e) { result.publicError = e.message; }
  
  res.json(result);
});

app.listen(PORT, async () => {
  loadSessions();
  
  // Refresh all sessions on startup
  if (sessions.size) {
    console.log('[STARTUP] Refreshing saved sessions...');
    await refreshAllSessions(true);
  }
  
  console.log(`
╔═══════════════════════════════════════════════════════╗
║  TIM.pl Proxy v6 — HAR-based Auth                     ║
║  http://localhost:${PORT}                               ║
║                                                       ║
║  Auth: /nuxt-api/auth/login → cookies → GraphQL       ║
║  Prices: multiplePricesAndStocks → personal netValue  ║
║                                                       ║
║  POST /api/login     {username, password}             ║
║  GET  /api/products  ?cat=...&sid=...                 ║
║  GET  /api/product   ?url=...&sid=...                 ║
║  GET  /api/search    ?q=...&sid=...                   ║
║  GET  /api/debug-auth ?sid=...&sku=...                ║
╚═══════════════════════════════════════════════════════╝
  `);
});
