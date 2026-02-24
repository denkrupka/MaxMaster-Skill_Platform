/**
 * AtutRental.com.pl Proxy v4
 *
 * Fixed bugs:
 *  1. Category images: irs_category_img in /themes/ path (not /uploads/)
 *     → isGoodImage now accepts ANY png/jpg, only rejects known junk
 *  2. Product carousel: data-lazy-bg is ON .carousel--big--rent__item
 *     → selector changed from descendant to same-element match
 *  3. Description: first cheerio match was CSS in <style> tag
 *     → now only searches within <p>, <div>, <span> tags
 */

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const app = express();
const PORT = 3004;
const BASE = 'https://www.atutrental.com.pl';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

app.use(cors());
app.use(express.json());

async function fetchHTML(p) {
  const url = p.startsWith('http') ? p : BASE + p;
  console.log(`[FETCH] ${url}`);
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*', 'Accept-Language': 'pl-PL,pl;q=0.9' },
    timeout: 25000, redirect: 'follow',
  });
  return r.text();
}

function isProductPage(html) {
  return html.includes('product__aside__rental') || html.includes('product_rent__right_box');
}

// ═══ IMAGE FILTER ═══
// Accept any .png/.jpg/.webp, reject only known junk patterns
const JUNK = [
  'shopping-cart', 'logo-footer', 'autograph', 'Mockup', 'discount',
  'appstore', 'googleplay', 'white-pin', 'phone.png', 'email.png',
  'Grupa-83', 'koparka', 'building', 'calendar', 'profesional',
  'van.png', 'van-white', 'slash.png', 'tiny-logo', 'map.png',
  'koparka-white', 'building-white'
];

function isGoodImage(url) {
  if (!url) return false;
  if (url.endsWith('.svg')) return false;
  if (JUNK.some(j => url.includes(j))) return false;
  return true;
}

// Extract best image from element
function extractImage($, el) {
  // 1. data-lazy-bg on element itself
  let bg = el.attr('data-lazy-bg');
  if (bg && isGoodImage(bg)) return bg;

  // 2. data-lazy-bg on any child
  let found = '';
  el.find('[data-lazy-bg]').each(function () {
    const b = $(this).attr('data-lazy-bg');
    if (!found && b && isGoodImage(b)) found = b;
  });
  if (found) return found;

  // 3. style background-image
  const tryStyle = (s) => {
    const m = (s || '').match(/background-image:\s*url\(['"]?(https?:\/\/[^'")\s]+)/);
    return m && isGoodImage(m[1]) ? m[1] : '';
  };
  found = tryStyle(el.attr('style'));
  if (found) return found;
  el.find('[style*="background-image"]').each(function () {
    if (!found) found = tryStyle($(this).attr('style'));
  });
  if (found) return found;

  // 4. <img> src
  const img = el.find('img');
  if (img.length) {
    const src = img.attr('src') || img.attr('data-lazy') || '';
    if (isGoodImage(src)) return src;
  }
  return '';
}

// ═══ BREADCRUMB ═══
function parseBreadcrumb($) {
  const bc = [];
  $('.bread-crums a').each(function () {
    const href = $(this).attr('href') || '';
    const name = $(this).text().trim();
    if (!name || name.includes('Strona główna')) return;
    try { bc.push({ slug: new URL(href).pathname, name }); } catch {}
  });
  return bc;
}

// ═══ LIST PAGE ═══
function parseListPage(html, requestedSlug) {
  const $ = cheerio.load(html);
  const title = $('h1').first().text().trim() || $('title').text().replace(/\s*[\|–—].*$/, '').trim();
  const breadcrumb = parseBreadcrumb($);

  const skipTexts = new Set([
    'Wynajem', 'Sprzedaż', 'Bobcat', 'Serwis', 'O firmie', 'Kontakt', 'BLOG',
    'Dlaczego Atut Rental?', 'Aplikacja ATUTGO', 'Dlaczego wynajem?',
    'Pytania i odpowiedzi', 'Warunki najmu', 'Do pobrania',
    'więcej wyników', 'szukaj', 'zobacz', '0',
    'Serwis na budowie', 'Przeglądy okresowe', 'Oryginalne części zamienne',
    'Gruntowne remonty maszyn', 'O nas', 'Aktualności', 'Historia',
    'Nasze realizacje', 'Działalność społeczna', 'PSBW', 'Kariera',
  ]);
  const skipPaths = ['dlaczego', 'pytania', 'warunki', 'pobrania', 'aplikacja', 'firma', 'kontakt', 'serwis/', 'blog', 'sprzedaz', 'bobcat', 'koszyk', 'wyniki'];

  // ─── STRATEGY 1: Product cards with prices ("zł") ───
  const products = [];
  const pSeen = new Set();

  $('a[href*="/wynajem/"]').each(function () {
    const fullText = $(this).text();
    if (!fullText.includes('zł')) return;
    const href = $(this).attr('href') || '';
    let pathname; try { pathname = new URL(href).pathname; } catch { return; }
    if (pSeen.has(pathname)) return;
    pSeen.add(pathname);

    const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);
    const name = lines[0] || '';
    if (!name || name.length < 3 || name.length > 120) return;

    let priceNetto = null, priceBrutto = null;
    const nm = fullText.match(/([\d]+[,.]?[\d]*)\s*zł\s*[\s\n]*netto/);
    const bm = fullText.match(/([\d]+[,.]?[\d]*)\s*zł\s*[\s\n]*brutto/);
    if (nm) priceNetto = parseFloat(nm[1].replace(',', '.'));
    if (bm) priceBrutto = parseFloat(bm[1].replace(',', '.'));

    const specs = [];
    $(this).find('strong, b').each(function () {
      const v = $(this).text().trim();
      if (v && !v.includes('zł') && v !== 'zobacz' && v.length < 50) specs.push(v);
    });

    const img = extractImage($, $(this));
    products.push({
      slug: pathname, name, image: img,
      priceNetto, priceBrutto, priceUnit: 'DOBA', specs,
      price: priceNetto ? priceNetto.toFixed(2).replace('.', ',') + ' zł netto' : ''
    });
  });

  if (products.length > 0) {
    console.log(`[LIST] ${products.length} products`);
    return { title, breadcrumb, items: products, hasProducts: true };
  }

  // ─── STRATEGY 2: Category tiles ───
  const allLinks = [];
  $('a[href*="/wynajem/"]').each(function () {
    if ($(this).parents('header, footer, nav, [class*="header__menu"], [class*="footer"], [class*="search_active"], aside, [class*="sidebar"], [class*="aside"]').length) return;
    const href = $(this).attr('href') || '';
    let pathname; try { pathname = new URL(href).pathname; } catch { return; }
    if (!pathname.startsWith('/wynajem/')) return;
    const text = $(this).text().trim().split('\n')[0].trim();
    if (!text || text.length < 2 || text.length > 120) return;
    if (skipTexts.has(text)) return;
    if (skipPaths.some(s => pathname.includes(s))) return;
    if (pathname === requestedSlug) return;

    const img = extractImage($, $(this));
    allLinks.push({ slug: pathname, name: text, image: img, price: '' });
  });

  // Dedup: prefer entry WITH image over entry without
  const bySlug = new Map();
  for (const l of allLinks) {
    const existing = bySlug.get(l.slug);
    if (!existing || (!existing.image && l.image)) {
      bySlug.set(l.slug, l);
    }
  }
  let items = Array.from(bySlug.values());

  if (items.length > 30) {
    const slug = (requestedSlug || '/wynajem/').replace(/\/$/, '');
    if (slug === '/wynajem') {
      items = items.filter(i => i.slug.replace(/\/$/, '').split('/').filter(Boolean).length === 2);
    } else {
      const ch = items.filter(i => i.slug.startsWith(slug + '/') && i.slug !== slug + '/');
      if (ch.length > 0) items = ch;
    }
  }

  console.log(`[LIST] ${items.length} categories`);
  return { title, breadcrumb, items, hasProducts: false };
}

// ═══ PRODUCT PAGE ═══
function parseProductPage(html) {
  const $ = cheerio.load(html);
  const p = {};
  p.title = $('h1').first().text().trim() || $('title').text().replace(/\s*[\|–—].*$/, '').trim();
  p.productId = $('h1').attr('data-irs') || '';
  p.breadcrumb = parseBreadcrumb($);

  // ─── Prices ───
  p.priceNetto = null; p.priceBrutto = null; p.priceUnit = 'DOBA';
  const net = $('.product__aside__rental--net');
  if (net.length) {
    const t = net.find('.product__aside__rental__price').text().replace(/\s/g, '');
    const m = t.match(/([\d,\.]+)/); if (m) p.priceNetto = parseFloat(m[1].replace(',', '.'));
    const u = net.find('.product__aside__rental__type').text().replace(/&nbsp;/g, ' ').trim().replace(/^netto\/?/i, '').trim();
    if (u) p.priceUnit = u;
  }
  const gross = $('.product__aside__rental--gross');
  if (gross.length) {
    const t = gross.find('.product__aside__rental__price').text().replace(/\s/g, '');
    const m = t.match(/([\d,\.]+)/); if (m) p.priceBrutto = parseFloat(m[1].replace(',', '.'));
  }

  // ─── Images (FIXED: data-lazy-bg ON carousel element, not child) ───
  p.images = [];

  // FIX: match data-lazy-bg ON elements whose class contains carousel item
  // The actual HTML: <div class="carousel--big--rent__item ..." data-lazy-bg="URL">
  $('[class*="carousel--big--rent__item"][data-lazy-bg]').each(function () {
    const bg = $(this).attr('data-lazy-bg');
    if (bg && isGoodImage(bg) && !p.images.includes(bg)) p.images.push(bg);
  });
  $('[class*="carousel--small--rent__item"][data-lazy-bg]').each(function () {
    const bg = $(this).attr('data-lazy-bg');
    if (bg && isGoodImage(bg) && !p.images.includes(bg)) p.images.push(bg);
  });

  // og:image fallback
  const ogImg = $('meta[property="og:image"]').attr('content') || '';
  if (ogImg && isGoodImage(ogImg) && !p.images.includes(ogImg)) {
    if (p.images.length === 0) p.images.push(ogImg);
  }

  // Last resort: any data-lazy-bg with product ID prefix
  if (p.images.length === 0 && p.productId) {
    $('[data-lazy-bg]').each(function () {
      const bg = $(this).attr('data-lazy-bg');
      if (bg && bg.includes(p.productId + '_') && isGoodImage(bg) && !p.images.includes(bg)) p.images.push(bg);
    });
  }

  // Absolute last: any data-lazy-bg with /uploads/ that's not junk
  if (p.images.length === 0) {
    $('[data-lazy-bg]').each(function () {
      const bg = $(this).attr('data-lazy-bg');
      if (bg && isGoodImage(bg) && (bg.includes('/uploads/') || bg.includes('irs_category_img')) && !p.images.includes(bg))
        p.images.push(bg);
    });
  }

  p.image = p.images[0] || '';

  // ─── Brand (smalltext is a CHILD span inside the header <p>) ───
  p.brand = '';
  $('p[class*="product_rent__header"], div[class*="product_rent__header"]').each(function () {
    if ($(this).text().toLowerCase().includes('producent')) {
      const child = $(this).find('[class*="product_rent__smalltext"]');
      if (child.length) { p.brand = child.text().trim(); return false; }
      const m = $(this).text().match(/Producent[:\s]+(.+)/i);
      if (m) { p.brand = m[1].trim(); return false; }
    }
  });

  // ─── Description (FIXED: only search <p>/<div> tags, skip <style>) ───
  p.description = '';
  // Method 1: <p class="product_rent__text"> — the canonical location
  $('p[class*="product_rent__text"], div[class*="product_rent__text"]').each(function () {
    const t = $(this).text().trim();
    if (t && t.length > 5 && !p.description) p.description = t;
  });
  // Method 2: text after OPIS PRODUKTU header
  if (!p.description) {
    $('p[class*="product_rent__header"]').each(function () {
      if ($(this).text().toLowerCase().includes('opis')) {
        const next = $(this).next('p, div, span');
        if (next.length) {
          const t = next.text().trim();
          if (t.length > 5) p.description = t;
        }
      }
    });
  }

  // ─── Parameters ───
  p.params = [];
  const pts = [];
  $('[class*="product_rent__right_box__description__text"]').each(function () { pts.push($(this).text().trim()); });
  for (let i = 0; i < pts.length - 1; i += 2) {
    const n = pts[i].replace(/:$/, '').trim(), v = pts[i + 1].trim();
    if (n && v) p.params.push({ name: n, value: v });
  }

  // ─── Ribbon ───
  p.ribbon = $('.product__aside__ribbon__text').text().trim();

  // ─── Similar ───
  p.similar = [];
  $('a[class*="rent_like"]').each(function () {
    const href = $(this).attr('href') || '';
    if (!href.includes('/wynajem/')) return;
    const name = $(this).find('[class*="rent_like__text"]').text().trim();
    const img = extractImage($, $(this));
    if (name) { try { p.similar.push({ slug: new URL(href).pathname, name, image: img }); } catch {} }
  });

  p.contactOnly = !p.priceNetto && !p.priceBrutto;
  return p;
}

// ═══ ROUTES ═══
app.get('/', (req, res) => res.json({ status: 'ok', proxy: 'AtutRental.com.pl Proxy v4', port: PORT }));

app.get('/api/browse', async (req, res) => {
  const slug = req.query.slug || '/wynajem/';
  const path = slug.startsWith('/') ? slug : '/' + slug;
  try {
    const html = await fetchHTML(path);
    if (isProductPage(html)) {
      const product = parseProductPage(html);
      console.log(`[PRODUCT] ${product.title} | imgs=${product.images.length} | desc=${product.description ? '✓' : '✗'} | ${product.priceNetto || '?'} netto`);
      res.json({ type: 'product', product });
    } else {
      const list = parseListPage(html, path);
      const wi = list.items.filter(i => i.image).length;
      console.log(`[LIST] ${list.title} → ${list.items.length} items (${wi} imgs, products=${!!list.hasProducts})`);
      res.json({ type: 'list', ...list });
    }
  } catch (e) {
    console.error(`[ERROR] ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`\n  AtutRental.com.pl Proxy v4 → http://localhost:${PORT}\n`));
