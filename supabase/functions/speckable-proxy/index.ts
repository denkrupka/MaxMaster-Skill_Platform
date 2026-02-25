import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BASE = 'https://www.speckable.pl'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

// ═══ PAGE CACHE — avoid re-fetching the same URL via ScraperAPI ═══
const PAGE_CACHE = new Map<string, { html: string; ts: number }>()
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes
const CACHE_MAX = 50 // max entries

function getCachedPage(url: string): string | null {
  const entry = PAGE_CACHE.get(url)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL_MS) { PAGE_CACHE.delete(url); return null }
  return entry.html
}

function setCachedPage(url: string, html: string): void {
  // Evict oldest if full
  if (PAGE_CACHE.size >= CACHE_MAX) {
    let oldestKey = '', oldestTs = Infinity
    for (const [k, v] of PAGE_CACHE) { if (v.ts < oldestTs) { oldestTs = v.ts; oldestKey = k } }
    if (oldestKey) PAGE_CACHE.delete(oldestKey)
  }
  PAGE_CACHE.set(url, { html, ts: Date.now() })
}

// ═══ ScraperAPI: bypass Cloudflare WAF directly from edge function ═══
const SCRAPER_API_KEY = Deno.env.get('SCRAPER_API_KEY') || ''

// Legacy relay (JDM.pl hosting blocked by nginx from cloud IPs — not used)
const RELAY_URL = Deno.env.get('SPECKABLE_RELAY_URL') || ''
const RELAY_KEY = Deno.env.get('SPECKABLE_RELAY_KEY') || ''

// ═══ COOKIE JAR ═══
type CookieJar = Record<string, string>

function parseCookiesFromHeaders(headers: Headers, jar: CookieJar): void {
  const setCookies = (headers as any).getSetCookie?.() || []
  for (const h of setCookies) {
    const parts = h.split(';')[0].split('=')
    const name = parts[0].trim()
    const value = parts.slice(1).join('=').trim()
    if (name) jar[name] = value
  }
  if (setCookies.length === 0) {
    const raw = headers.get('set-cookie') || ''
    if (raw) {
      for (const segment of raw.split(/,(?=\s*\w+=)/)) {
        const parts = segment.split(';')[0].split('=')
        const name = parts[0].trim()
        const value = parts.slice(1).join('=').trim()
        if (name) jar[name] = value
      }
    }
  }
}

function cookieString(jar: CookieJar): string {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ')
}

// ═══ FETCH HELPERS ═══
function makeHeaders(jar?: CookieJar, extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = {
    'User-Agent': UA,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pl-PL,pl;q=0.9',
    ...(extra || {}),
  }
  if (jar && Object.keys(jar).length) h['Cookie'] = cookieString(jar)
  return h
}

// Fetch a page via ScraperAPI (bypasses Cloudflare from any IP)
async function viaScraperAPI(url: string, method = 'GET', postBody?: string, cookies?: string): Promise<{ status: number; body: string }> {
  if (method === 'GET') {
    // Always use query-param API for GET (JSON API returns 404 for GET)
    const params = new URLSearchParams({
      api_key: SCRAPER_API_KEY,
      url,
    })
    // Pass cookies via ScraperAPI's header_ prefix
    if (cookies) {
      params.set('header_Cookie', cookies)
    }
    const resp = await fetch('https://api.scraperapi.com?' + params.toString(), {
      headers: { 'Accept-Language': 'pl-PL,pl;q=0.9' },
    })
    return { status: resp.status, body: await resp.text() }
  } else {
    // POST via ScraperAPI JSON API
    const postHeaders: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept-Language': 'pl-PL,pl;q=0.9',
    }
    if (cookies) postHeaders['Cookie'] = cookies
    const payload = {
      apiKey: SCRAPER_API_KEY,
      url,
      method: 'POST',
      body: postBody || '',
      headers: postHeaders,
    }
    const resp = await fetch('https://api.scraperapi.com/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return { status: resp.status, body: await resp.text() }
  }
}

async function fetchPage(url: string, jar: CookieJar, retries = 3): Promise<string> {
  const fullUrl = url.startsWith('http') ? url : BASE + url
  const errors: string[] = []

  // Check cache first
  const cached = getCachedPage(fullUrl)
  if (cached) {
    console.log(`[fetchPage] Cache HIT for ${fullUrl} (${cached.length} bytes)`)
    return cached
  }

  // Strategy 1: Try ScraperAPI first (if configured)
  if (SCRAPER_API_KEY) {
    try {
      const cookieStr = Object.keys(jar).length > 0 ? cookieString(jar) : undefined
      console.log(`[fetchPage] Trying ScraperAPI for ${fullUrl}${cookieStr ? ' (with cookies)' : ''}`)
      const r = await viaScraperAPI(fullUrl, 'GET', undefined, cookieStr)
      console.log(`[fetchPage] ScraperAPI → ${r.status}, ${r.body.length} bytes`)
      if (r.status >= 200 && r.status < 400 && r.body.length > 500) {
        // Verify it's not a Cloudflare challenge page
        if (!r.body.includes('cf-browser-verification') && !r.body.includes('challenge-platform')) {
          setCachedPage(fullUrl, r.body)
          return r.body
        }
        errors.push(`ScraperAPI: Cloudflare challenge (${r.body.length}b)`)
      } else {
        errors.push(`ScraperAPI: HTTP ${r.status} (${r.body.length}b)`)
      }
    } catch (e: any) {
      errors.push(`ScraperAPI: ${e.message}`)
      console.log(`[fetchPage] ScraperAPI error: ${e.message}`)
    }
  }

  // Strategy 2: Direct fetch with retries (fallback or primary if no ScraperAPI)
  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, 800 * attempt))
    }
    try {
      const headers: Record<string, string> = {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pl-PL,pl;q=0.9',
      }
      if (jar && Object.keys(jar).length) headers['Cookie'] = cookieString(jar)
      if (attempt > 0) headers['Referer'] = BASE + '/'
      const res = await fetch(fullUrl, { headers, redirect: 'follow' })
      parseCookiesFromHeaders(res.headers, jar)
      const body = await res.text()
      console.log(`[fetchPage] Direct attempt ${attempt + 1} → ${res.status}, ${body.length} bytes`)

      if (res.ok && body.length > 500) {
        if (body.includes('cf-browser-verification') || body.includes('challenge-platform')) {
          errors.push(`Direct[${attempt + 1}]: Cloudflare challenge`)
          continue
        }
        setCachedPage(fullUrl, body)
        return body
      }
      errors.push(`Direct[${attempt + 1}]: HTTP ${res.status} (${body.length}b)`)
      if (res.status === 403 || res.status >= 500) continue
    } catch (e: any) {
      errors.push(`Direct[${attempt + 1}]: ${e.message}`)
      console.log(`[fetchPage] Direct error: ${e.message}`)
    }
  }

  throw new Error(errors.join(' → '))
}

async function postForm(url: string, body: string, jar: CookieJar, referer?: string): Promise<string> {
  const fullUrl = url.startsWith('http') ? url : BASE + url

  if (SCRAPER_API_KEY) {
    const cookieStr = Object.keys(jar).length > 0 ? cookieString(jar) : undefined
    const r = await viaScraperAPI(fullUrl, 'POST', body, cookieStr)
    console.log(`[postForm] ScraperAPI POST ${fullUrl} → ${r.status}, ${r.body.length} bytes`)
    return r.body
  }

  // Direct (works only from non-blocked IPs)
  const headers: Record<string, string> = {
    'User-Agent': UA,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pl-PL,pl;q=0.9',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Referer': referer || BASE + '/pl/login',
  }
  if (jar && Object.keys(jar).length) headers['Cookie'] = cookieString(jar)
  const res = await fetch(fullUrl, {
    method: 'POST',
    headers,
    body,
    redirect: 'follow',
  })
  parseCookiesFromHeaders(res.headers, jar)
  return res.text()
}

// ═══ HTML HELPERS (regex, no cheerio) ═══
function absUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('http')) return url
  if (url.startsWith('//')) return 'https:' + url
  if (url.startsWith('/')) return BASE + url
  return url
}

function parsePrice(html: string): number | null {
  // Match price like: <span class="price">123<span class="decimal">,45</span></span>
  // or: 123,45 or 123.45
  const m = html.match(/<[^>]*class="[^"]*price[^"]*"[^>]*>([\s\S]*?)<\/[^>]*>/i)
  if (!m) return null
  const inner = m[1]
  // Extract whole part (digits before decimal span) and decimal part
  const whole = inner.replace(/<[^>]*>.*?<\/[^>]*>/g, '').replace(/[^\d]/g, '')
  const decMatch = inner.match(/<[^>]*class="[^"]*decimal[^"]*"[^>]*>([^<]*)</)
  const dec = decMatch ? decMatch[1].replace(/[^\d]/g, '') : ''
  if (!whole && !dec) return null
  return parseFloat((whole || '0') + '.' + (dec || '00'))
}

function parsePriceFromText(text: string): number | null {
  const m = text.replace(/\s/g, '').match(/(\d[\d\s]*)[,.](\d{2})/)
  if (!m) return null
  return parseFloat(m[1].replace(/\s/g, '') + '.' + m[2])
}

function extractJsonLd(html: string): any[] {
  const results: any[] = []
  const re = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    try { results.push(JSON.parse(m[1])) } catch { /* skip */ }
  }
  return results
}

function stripHtml(html: string): string {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n))).replace(/\s+/g, ' ').trim()
}

// ═══ PARSERS ═══

function parseListPage(html: string, requestedPath: string): any {
  // Title from <h1> or <title>
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  let title = h1Match ? stripHtml(h1Match[1]) : ''
  if (!title) {
    const titleMatch = html.match(/<title>([^<]*)<\/title>/i)
    if (titleMatch) title = titleMatch[1].replace(/\s*[\|–—].*$/, '').trim()
  }

  // Breadcrumb
  const breadcrumb: Array<{ name: string; slug: string }> = []
  const bcMatch = html.match(/<ol[^>]*class="[^"]*breadcrumb[^"]*"[^>]*>([\s\S]*?)<\/ol>/i)
  if (bcMatch) {
    const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi
    let li: RegExpExecArray | null
    while ((li = liRe.exec(bcMatch[1])) !== null) {
      const aMatch = li[1].match(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i)
      if (aMatch) {
        const name = stripHtml(aMatch[2]).split('\n')[0].trim()
        if (name && name.length < 100) breadcrumb.push({ name, slug: aMatch[1] })
      } else {
        const name = stripHtml(li[1]).split('\n')[0].trim()
        if (name && name.length < 100) breadcrumb.push({ name, slug: '' })
      }
    }
  }

  // Check if root
  const norm = (requestedPath || '/').replace(/\/$/, '')
  const isRoot = !norm || norm === '/' || norm === '/pl/list'

  // Products — only from the product-list-container (after H1), NOT from
  // the "featured/tags-browser" section that shows the same products on every page.
  const products: any[] = []
  const pSeen = new Set<string>()
  if (!isRoot) {
    // Isolate the actual category product listing section
    const plcStart = html.indexOf('product-list-container')
    const productHtml = plcStart > 0 ? html.substring(plcStart) : html

    // Match insTable cards (category/search listing) — each card is ~18KB
    const cardRe = /<[^>]*class="[^"]*ins-v-product-thumbnail[^"]*insTable[^"]*"[^>]*>([\s\S]*?)(?=<[^>]*class="[^"]*ins-v-product-thumbnail[^"]*insTable|$)/gi
    let card: RegExpExecArray | null
    while ((card = cardRe.exec(productHtml)) !== null) {
      const block = card[0]
      // Extract product URL
      const hrefMatch = block.match(/<a[^>]*href="(\/pl\/product\/[^"]+)"[^>]*>/i)
      if (!hrefMatch) continue
      const slug = hrefMatch[1]
      if (pSeen.has(slug)) continue
      pSeen.add(slug)

      // Name: from .product-name div, then .heading, then img alt
      let name = ''
      const pnameMatch = block.match(/<[^>]*class="[^"]*product-name[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
      if (pnameMatch) {
        const txt = stripHtml(pnameMatch[1])
        if (txt && !txt.startsWith('{{')) name = txt
      }
      if (!name) {
        const headingMatch = block.match(/<[^>]*class="[^"]*heading[^"]*"[^>]*>([\s\S]*?)<\/[^>]*>/i)
        if (headingMatch) {
          const txt = stripHtml(headingMatch[1])
          if (txt && !txt.startsWith('{{')) name = txt
        }
      }
      if (!name) {
        const altMatch = block.match(/<img[^>]*alt="([^"]+)"[^>]*>/i)
        if (altMatch && !altMatch[1].startsWith('{{') && altMatch[1].length > 5) name = altMatch[1]
      }
      if (!name) continue

      // Image: from product-photo container, then general img
      let image = ''
      const photoMatch = block.match(/<[^>]*class="[^"]*product-photo[^"]*"[^>]*>[\s\S]*?<img[^>]*(?:src|data-src)="([^"]*(?:media\/cache|assets)[^"]*)"[^>]*>/i)
      if (photoMatch) {
        image = absUrl(photoMatch[1])
      } else {
        const imgMatch = block.match(/<img[^>]*(?:src|data-src)="([^"]*(?:media\/cache|assets\/default\/photos)[^"]*)"[^>]*>/i)
        if (imgMatch) image = absUrl(imgMatch[1])
      }

      // Symbol (SKU): from .symbol div, or first <strong> with numeric content
      let symbol = ''
      const symMatch = block.match(/<[^>]*class="[^"]*symbol[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
      if (symMatch) {
        // Extract text, removing "Symbol:" prefix
        symbol = stripHtml(symMatch[1]).replace(/^Symbol:\s*/i, '').trim()
      }
      if (!symbol) {
        const strongMatch = block.match(/<strong[^>]*>(\d[\d.]*)<\/strong>/i)
        if (strongMatch) symbol = strongMatch[1].trim()
      }

      // Price netto
      const priceNetBlock = block.match(/<[^>]*class="[^"]*price-net[^"]*"[^>]*>([\s\S]*?)<\/[^>]*>/i)
      let priceNetto: number | null = null
      if (priceNetBlock) {
        priceNetto = parsePrice(priceNetBlock[1])
        if (priceNetto === null) priceNetto = parsePriceFromText(stripHtml(priceNetBlock[1]))
      }
      // Fallback: first <strong> with a decimal number (price value)
      if (priceNetto === null) {
        const priceStrong = block.match(/<strong[^>]*>(\d+\.\d{2,4})<\/strong>/i)
        if (priceStrong) priceNetto = parseFloat(priceStrong[1])
      }

      // Stock
      const stockMatch = block.match(/<[^>]*class="[^"]*in-stock[^"]*"[^>]*>([^<]*)<\/[^>]*>/i)
      const stock = stockMatch ? stockMatch[1].trim() : ''

      products.push({
        slug, name, image, symbol,
        priceNetto, currency: 'PLN', stock,
        price: priceNetto != null ? priceNetto.toFixed(2).replace('.', ',') + ' PLN netto' : '',
      })
    }
  }

  // Always parse categories (even when products exist — needed for tree navigation)
  const catBySlug = new Map<string, { slug: string; name: string; image: string; price: string }>()
  const catLinkRe = /<a[^>]*href="(\/pl\/list\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
  let catLink: RegExpExecArray | null
  while ((catLink = catLinkRe.exec(html)) !== null) {
    const slug = catLink[1]
    const inner = catLink[2]
    // Name: from .name span or text
    const nameSpan = inner.match(/<[^>]*class="[^"]*name[^"]*"[^>]*>([^<]*)<\/[^>]*>/i)
    let name = nameSpan ? nameSpan[1].trim() : stripHtml(inner).split('\n')[0].trim()
    if (!name || name.length < 2 || name.length > 120) continue
    // Image
    const imgMatch = inner.match(/<img[^>]*(?:src|data-src)="([^"]*)"[^>]*>/i)
    const image = imgMatch ? absUrl(imgMatch[1]) : ''
    const existing = catBySlug.get(slug)
    if (!existing || (!existing.image && image)) {
      catBySlug.set(slug, { slug, name, image, price: '' })
    }
  }
  let categories = Array.from(catBySlug.values())

  // Filter categories: only show DIRECT children of current path (not all descendants)
  let filteredCategories: typeof categories = []
  const parentDepth = norm.split('/').filter(Boolean).length  // e.g. /pl/list/kable-i-przewody → 3
  if (isRoot) {
    const topLevel = categories.filter(c => c.slug.split('/').filter(Boolean).length === 3)
    filteredCategories = topLevel
  } else {
    filteredCategories = categories.filter(c => {
      if (!c.slug.startsWith(norm + '/') || c.slug === norm + '/') return false
      // Only direct children: exactly one more path segment than parent
      return c.slug.split('/').filter(Boolean).length === parentDepth + 1
    })
  }

  if (products.length > 0) {
    return { title, breadcrumb, items: products, hasProducts: true, categories: filteredCategories }
  }

  return { title, breadcrumb, items: filteredCategories, hasProducts: false, categories: [] }
}

function parseProductPage(html: string): any {
  const p: any = {}

  // JSON-LD
  const jsonLdList = extractJsonLd(html)
  for (const j of jsonLdList) {
    if (j['@type'] === 'Product') {
      p.title = j.name || ''
      p.sku = j.sku || ''
      p.ean = j.gtin13 || ''
      p.brand = j.brand || ''
      if (j.offers) {
        p.priceGross = parseFloat(j.offers.price) || null
        p.currency = j.offers.priceCurrency || 'PLN'
      }
      if (j.description) {
        p.description = stripHtml(j.description).substring(0, 2000)
      }
    }
  }

  // HTML description (formatted)
  // Try productDescription div first, then esp_column_description, then JSON-LD HTML
  const sanitizeHtml = (raw: string) => raw
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/\s+on\w+="[^"]*"/gi, '')
    .replace(/javascript:/gi, '')
    .substring(0, 8000)

  const descRe1 = /<div[^>]*class="[^"]*productDescription[^"]*"[^>]*>([\s\S]*?)<\/div>/i
  const descRe2 = /<div[^>]*class="[^"]*esp_column_description[^"]*"[^>]*>([\s\S]*?)(?=<\/div>\s*<!\-\-\- SELLASIST HTML END|\Z)/i
  const descMatch = descRe1.exec(html) || descRe2.exec(html)
  if (descMatch) {
    p.descriptionHtml = sanitizeHtml(descMatch[1])
  } else {
    // Fallback: JSON-LD description often contains HTML on Speckable
    for (const j of jsonLdList) {
      if (j['@type'] === 'Product' && j.description && /<[a-z]/i.test(j.description)) {
        p.descriptionHtml = sanitizeHtml(j.description)
        break
      }
    }
  }

  // Technical specifications (Dane techniczne)
  const specItems: Array<{ name: string; value: string }> = []
  const techRe = /<h2[^>]*>[^<]*Dane techniczne[^<]*<\/h2>([\s\S]*?)(?=<\/div>\s*<\/div>\s*<\/div>|<div[^>]*class="[^"]*tab-position)/i
  const techMatch = techRe.exec(html)
  if (techMatch) {
    const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi
    let liM: RegExpExecArray | null
    while ((liM = liRe.exec(techMatch[1])) !== null) {
      const kvMatch = liM[1].match(/^\s*([^:<]+):\s*<b>\s*([^<]*)<\/b>/i)
        || liM[1].match(/^\s*([^:<]+):\s*<strong>\s*([^<]*)<\/strong>/i)
      if (kvMatch) {
        specItems.push({ name: stripHtml(kvMatch[1]).trim(), value: stripHtml(kvMatch[2]).trim() })
      }
    }
  }
  if (specItems.length > 0) p.specification = specItems

  if (!p.title) {
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
    if (h1Match) p.title = stripHtml(h1Match[1])
  }

  // Images
  p.images = [] as string[]
  const imgSeen = new Set<string>()
  // Photo-item links (full-size images)
  const photoLinkRe = /<[^>]*class="[^"]*photo-item[^"]*"[^>]*>[\s\S]*?<a[^>]*(?:href|data-mfp-src)="([^"]*)"[^>]*>/gi
  let plm: RegExpExecArray | null
  while ((plm = photoLinkRe.exec(html)) !== null) {
    const href = plm[1]
    if (href && !imgSeen.has(href)) { imgSeen.add(href); p.images.push(absUrl(href)) }
  }
  // Fallback: photo-item img tags
  if (p.images.length === 0) {
    const photoImgRe = /<[^>]*class="[^"]*(?:photo-item|photo-container)[^"]*"[^>]*>[\s\S]*?<img[^>]*(?:src|data-src)="([^"]*)"[^>]*>/gi
    let pim: RegExpExecArray | null
    while ((pim = photoImgRe.exec(html)) !== null) {
      const src = pim[1]
      if (src && !src.includes('blank.gif') && !imgSeen.has(src)) { imgSeen.add(src); p.images.push(absUrl(src)) }
    }
  }
  // Fallback: any product img
  if (p.images.length === 0) {
    const anyImgRe = /<img[^>]*class="[^"]*photo[^"]*"[^>]*(?:src|data-src)="([^"]*)"[^>]*>/gi
    let aim: RegExpExecArray | null
    while ((aim = anyImgRe.exec(html)) !== null) {
      const src = aim[1]
      if (src && !src.includes('blank.gif') && !imgSeen.has(src)) { imgSeen.add(src); p.images.push(absUrl(src)) }
    }
  }

  // Prices from HTML
  const priceBlock = html.match(/<[^>]*class="[^"]*product-price[^"]*"[^>]*>([\s\S]*?)<\/[^>]*>/i)
  if (priceBlock) {
    const netBlock = priceBlock[1].match(/<[^>]*class="[^"]*price-net[^"]*"[^>]*>([\s\S]*?)<\/[^>]*>/i)
    const grossBlock = priceBlock[1].match(/<[^>]*class="[^"]*price-gross[^"]*"[^>]*>([\s\S]*?)<\/[^>]*>/i)
    if (netBlock) {
      const net = parsePrice(netBlock[1]) ?? parsePriceFromText(stripHtml(netBlock[1]))
      if (net != null) p.priceNetto = net
    }
    if (grossBlock) {
      const gross = parsePrice(grossBlock[1]) ?? parsePriceFromText(stripHtml(grossBlock[1]))
      if (gross != null) p.priceGross = gross
    }
  }

  // Stock
  p.stock = ''
  p.stockExternal = ''
  // In-stock element near availability-high icon
  const stockMatch = html.match(/<[^>]*class="[^"]*in-stock[^"]*"[^>]*>([^<]*)<\/[^>]*>/i)
  if (stockMatch) p.stock = stockMatch[1].trim()
  // External stock
  const extMatch = html.match(/<[^>]*class="[^"]*in-stock-external[^"]*"[^>]*>([\s\S]*?)<\/[^>]*>/i)
  if (extMatch) {
    const inner = extMatch[1]
    const inStockInner = inner.match(/<[^>]*class="[^"]*in-stock[^"]*"[^>]*>([^<]*)</)
    p.stockExternal = inStockInner ? inStockInner[1].trim() : stripHtml(inner).replace(/[^0-9]/g, '').trim()
  }

  // Unit
  const unitMatch = html.match(/<[^>]*class="[^"]*unit[^"]*"[^>]*>([^<]*)<\/[^>]*>/i)
  p.unit = unitMatch ? unitMatch[1].trim() : 'szt'

  // Breadcrumb
  p.breadcrumb = [] as Array<{ name: string; slug: string }>
  const bcMatch = html.match(/<ol[^>]*class="[^"]*breadcrumb[^"]*"[^>]*>([\s\S]*?)<\/ol>/i)
  if (bcMatch) {
    const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi
    let li: RegExpExecArray | null
    while ((li = liRe.exec(bcMatch[1])) !== null) {
      const aMatch = li[1].match(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i)
      if (aMatch) {
        const name = stripHtml(aMatch[2]).split('\n')[0].trim()
        if (name && name.length < 100) p.breadcrumb.push({ name, slug: aMatch[1] })
      }
    }
  }

  // Related products
  p.related = [] as any[]
  const relCardRe = /<[^>]*class="[^"]*ins-v-product-thumbnail[^"]*"[^>]*>([\s\S]*?)(?=<[^>]*class="[^"]*ins-v-product-thumbnail|$)/gi
  let relCard: RegExpExecArray | null
  while ((relCard = relCardRe.exec(html)) !== null) {
    const block = relCard[0]
    const hrefMatch = block.match(/<a[^>]*href="(\/pl\/product\/[^"]+)"[^>]*>/i)
    if (!hrefMatch) continue
    const slug = hrefMatch[1]
    const headingMatch = block.match(/<[^>]*class="[^"]*heading[^"]*"[^>]*>([\s\S]*?)<\/[^>]*>/i)
    const name = headingMatch ? stripHtml(headingMatch[1]) : ''
    const imgMatch = block.match(/<img[^>]*class="[^"]*photo[^"]*"[^>]*(?:src|data-src)="([^"]*)"[^>]*>/i)
    const image = imgMatch ? absUrl(imgMatch[1]) : ''
    const priceNetBlock = block.match(/<[^>]*class="[^"]*price-net[^"]*"[^>]*>([\s\S]*?)<\/[^>]*>/i)
    let pn: number | null = null
    if (priceNetBlock) pn = parsePrice(priceNetBlock[1]) ?? parsePriceFromText(stripHtml(priceNetBlock[1]))
    if (name) {
      p.related.push({ slug, name, image, priceNetto: pn, price: pn != null ? pn.toFixed(2).replace('.', ',') + ' PLN netto' : '' })
    }
  }

  return p
}

// ═══ SESSION MANAGEMENT ═══
const SESSION_FRESH_MS = 30 * 60 * 1000

// ═══ ScraperAPI with keep_headers — extracts Set-Cookie for login flow ═══
function splitHttpResponse(raw: string): { headerStr: string; body: string } {
  // ScraperAPI keep_headers returns: "HTTP/1.1 200 OK\r\nHeader: val\r\n\r\n<body>"
  let idx = raw.indexOf('\r\n\r\n')
  if (idx !== -1 && idx < 4000) return { headerStr: raw.substring(0, idx), body: raw.substring(idx + 4) }
  idx = raw.indexOf('\n\n')
  if (idx !== -1 && idx < 4000) return { headerStr: raw.substring(0, idx), body: raw.substring(idx + 2) }
  return { headerStr: '', body: raw }
}

function extractSetCookiesFromRaw(headerStr: string, jar: CookieJar): void {
  for (const line of headerStr.split(/\r?\n/)) {
    const m = line.match(/^set-cookie:\s*(.+)/i)
    if (m) {
      const parts = m[1].split(';')[0].split('=')
      const name = parts[0].trim()
      const value = parts.slice(1).join('=').trim()
      if (name && !name.startsWith('__cf')) jar[name] = value
    }
  }
}

async function scraperAPIGetWithCookies(url: string, jar: CookieJar): Promise<string> {
  const fullUrl = url.startsWith('http') ? url : BASE + url
  const cookieStr = Object.keys(jar).length > 0 ? cookieString(jar) : undefined

  // Use query-param API with keep_headers=true (JSON API doesn't support it)
  const params = new URLSearchParams({
    api_key: SCRAPER_API_KEY,
    url: fullUrl,
    keep_headers: 'true',
  })
  // Pass cookies via ScraperAPI header_ prefix
  const fetchHeaders: Record<string, string> = { 'Accept-Language': 'pl-PL,pl;q=0.9' }
  if (cookieStr) {
    params.set('header_Cookie', cookieStr)
  }

  const resp = await fetch('https://api.scraperapi.com?' + params.toString(), {
    headers: fetchHeaders,
  })
  const raw = await resp.text()
  console.log(`[scraperGET] ${fullUrl} → HTTP ${resp.status}, rawLen=${raw.length}, first100=${raw.substring(0, 100).replace(/\n/g, '\\n')}`)

  const { headerStr, body } = splitHttpResponse(raw)

  if (headerStr && headerStr.includes(':')) {
    extractSetCookiesFromRaw(headerStr, jar)
    console.log(`[scraperGET] Headers parsed, cookies=[${Object.keys(jar).join(',')}], bodyLen=${body.length}`)
    return body
  }

  // keep_headers might not have separated — try to extract cookies from ScraperAPI response headers directly
  const scRaw = resp.headers.get('set-cookie') || ''
  if (scRaw) {
    console.log(`[scraperGET] ScraperAPI resp set-cookie: ${scRaw.substring(0, 200)}`)
    parseCookiesFromHeaders(resp.headers, jar)
  }

  console.log(`[scraperGET] No header split found, returning raw as body, cookies=[${Object.keys(jar).join(',')}]`)
  return raw
}

async function scraperAPIPostWithCookies(url: string, formBody: string, jar: CookieJar): Promise<string> {
  const fullUrl = url.startsWith('http') ? url : BASE + url
  const cookieStr = Object.keys(jar).length > 0 ? cookieString(jar) : undefined

  const hdrs: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept-Language': 'pl-PL,pl;q=0.9',
    'Referer': BASE + '/pl/login',
  }
  if (cookieStr) hdrs['Cookie'] = cookieStr

  const payload = {
    apiKey: SCRAPER_API_KEY,
    url: fullUrl,
    method: 'POST',
    body: formBody,
    headers: hdrs,
  }

  const resp = await fetch('https://api.scraperapi.com/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const raw = await resp.text()
  console.log(`[scraperPOST] ${fullUrl} → HTTP ${resp.status}, rawLen=${raw.length}, first100=${raw.substring(0, 100).replace(/\n/g, '\\n')}`)

  // Try to extract cookies from ScraperAPI response headers
  parseCookiesFromHeaders(resp.headers, jar)

  return raw
}

async function doLogin(username: string, password: string, jar: CookieJar): Promise<boolean> {
  // Cloudflare blocks direct fetch from edge functions, so we use ScraperAPI
  // with keep_headers=true to extract Set-Cookie and maintain session for CSRF.
  try {
    // Step 0: Visit homepage to get initial session cookies
    try {
      await scraperAPIGetWithCookies('/', jar)
    } catch (e: any) {
      console.log('[doLogin] Homepage fetch failed (ok):', e.message)
    }

    // Step 1: Fetch login page to get CSRF token + session cookie
    const loginHtml = await scraperAPIGetWithCookies('/pl/login', jar)

    // Check if already logged in
    if (loginHtml.includes('/pl/logout') || loginHtml.includes('Wyloguj')) {
      return true
    }

    // Extract CSRF token
    const tokenMatch = loginHtml.match(/name="login\[_token\]"\s*value="([^"]+)"/i)
      || loginHtml.match(/value="([^"]+)"\s*name="login\[_token\]"/i)
      || loginHtml.match(/login\[_token\][^>]*value="([^"]+)"/i)
    if (!tokenMatch) {
      const title = (loginHtml.match(/<title>([^<]*)<\/title>/i) || [])[1] || ''
      throw new Error(`Nie udało się pobrać formularza logowania (title: ${title}, len: ${loginHtml.length})`)
    }
    const token = tokenMatch[1]
    console.log(`[doLogin] CSRF token found, cookies before POST: [${Object.keys(jar).join(',')}]`)

    // Step 2: POST login form with session cookies
    const formData = [
      `login[_token]=${encodeURIComponent(token)}`,
      `login[referer]=${encodeURIComponent(BASE + '/')}`,
      `login[email]=${encodeURIComponent(username)}`,
      `login[password]=${encodeURIComponent(password)}`,
    ].join('&')

    const responseHtml = await scraperAPIPostWithCookies('/pl/login', formData, jar)

    // Step 3: Verify success
    const hasLogout = responseHtml.includes('/pl/logout') || responseHtml.includes('Wyloguj')
    const hasAccount = responseHtml.includes('Moje konto') || responseHtml.includes('my-account')
    const hasLoginForm = responseHtml.includes('login[_token]')
    const cookieCount = Object.keys(jar).length

    console.log(`[doLogin] Result: hasLogout=${hasLogout}, hasAccount=${hasAccount}, hasLoginForm=${hasLoginForm}, cookies=${cookieCount}, bodyLen=${responseHtml.length}`)
    console.log(`[doLogin] Title: ${(responseHtml.match(/<title>([^<]*)<\/title>/i) || [])[1] || '(none)'}`)

    if (hasLogout || hasAccount) {
      return true
    }

    // Check for specific error messages in the response
    if (responseHtml.includes('Nieprawidłowy') || responseHtml.includes('nieprawidłow') || responseHtml.includes('Invalid') || responseHtml.includes('Błędny')) {
      throw new Error('Niepoprawny email lub hasło')
    }

    // If we have cookies and no login form, login might have succeeded (redirected to non-standard page)
    if (cookieCount > 0 && !hasLoginForm) {
      console.log('[doLogin] No explicit logout link but have cookies and no login form — assuming success')
      return true
    }

    // Include diagnostic info in error
    const titleSnippet = (responseHtml.match(/<title>([^<]*)<\/title>/i) || [])[1] || ''
    const bodySnippet = responseHtml.substring(0, 500).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 200)
    throw new Error(`Logowanie nie powiodło się. [cookies:${cookieCount}, form:${hasLoginForm}, len:${responseHtml.length}, title:${titleSnippet}] ${bodySnippet}`)
  } catch (e: any) {
    console.log('[speckable] Login failed:', e.message)
    throw e
  }
}

async function isSessionValid(jar: CookieJar): Promise<boolean> {
  if (Object.keys(jar).length === 0) return false
  try {
    const html = await fetchPage('/pl/login', jar)
    // If we see logout link, session is valid
    if (html.includes('/pl/logout') || html.includes('Wyloguj')) return true
    // If we see login form token, session expired
    if (html.includes('login[_token]')) return false
    return false
  } catch {
    return false
  }
}

async function getIntegrationSession(
  supabaseAdmin: any,
  integrationId: string,
): Promise<{ jar: CookieJar; integration: any }> {
  const { data: integration, error } = await supabaseAdmin
    .from('wholesaler_integrations')
    .select('*')
    .eq('id', integrationId)
    .single()

  if (error || !integration) throw new Error('Integration not found')

  const creds = integration.credentials || {}
  let jar: CookieJar = creds.cookies || {}

  // If cookies exist and were refreshed recently, reuse
  if (Object.keys(jar).length > 0 && creds.last_refresh) {
    const age = Date.now() - new Date(creds.last_refresh).getTime()
    if (age < SESSION_FRESH_MS) {
      return { jar, integration }
    }
  }

  // Verify cookies still work
  if (Object.keys(jar).length > 0) {
    const valid = await isSessionValid(jar)
    if (valid) {
      await supabaseAdmin
        .from('wholesaler_integrations')
        .update({
          credentials: { ...creds, last_refresh: new Date().toISOString() },
        })
        .eq('id', integrationId)
      return { jar, integration }
    }
  }

  // Auto-refresh: re-login
  if (creds.username && creds.password) {
    const freshJar: CookieJar = {}
    try {
      await doLogin(creds.username, creds.password, freshJar)
      await supabaseAdmin
        .from('wholesaler_integrations')
        .update({
          credentials: {
            ...creds,
            cookies: freshJar,
            last_refresh: new Date().toISOString(),
          },
        })
        .eq('id', integrationId)
      return { jar: freshJar, integration }
    } catch {
      return { jar: {}, integration }
    }
  }

  return { jar: {}, integration }
}

// ═══ RESPONSE HELPERS ═══
function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

function errorResponse(message: string, status = 400): Response {
  return json({ error: message }, status)
}

// ═══ MAIN HANDLER ═══
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // Verify user JWT (soft)
    const authHeader = req.headers.get('Authorization')
    let userId: string | null = null
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      try {
        const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token)
        if (!authError && userData?.user) userId = userData.user.id
      } catch { /* auth optional */ }
    }

    const body = await req.json()
    const { action } = body

    const authRequired = ['login', 'logout']
    if (authRequired.includes(action) && !userId) {
      return errorResponse('Authentication required', 401)
    }

    switch (action) {
      // ═══ LOGIN ═══
      case 'login': {
        const { username, password, companyId, wholesalerId, wholesalerName, branza, existingIntegrationId } = body
        if (!username || !password) return json({ success: false, error: 'Podaj login i hasło' })

        const jar: CookieJar = {}
        try {
          await doLogin(username, password, jar)
        } catch (loginErr: any) {
          // Return 200 with error field so Supabase client shows the actual message
          // (not generic "Edge Function returned a non-2xx status code")
          return json({ success: false, error: loginErr.message || 'Błąd logowania' })
        }

        const credentialsData = {
          username,
          password,
          cookies: jar,
          last_refresh: new Date().toISOString(),
        }

        let integrationId: string
        try {
          if (existingIntegrationId) {
            await supabaseAdmin
              .from('wholesaler_integrations')
              .update({ credentials: credentialsData, is_active: true })
              .eq('id', existingIntegrationId)
            integrationId = existingIntegrationId
          } else {
            const { data: inserted, error: insertErr } = await supabaseAdmin
              .from('wholesaler_integrations')
              .insert({
                company_id: companyId,
                wholesaler_id: wholesalerId,
                wholesaler_name: wholesalerName,
                branza,
                credentials: credentialsData,
                is_active: true,
              })
              .select('id')
              .single()

            if (insertErr) return json({ success: false, error: 'Nie udało się zapisać integracji: ' + insertErr.message })
            integrationId = inserted.id
          }
        } catch (dbErr: any) {
          return json({ success: false, error: 'Błąd zapisu: ' + (dbErr.message || dbErr) })
        }

        return json({
          success: true,
          integrationId,
          username,
        })
      }

      // ═══ LOGOUT ═══
      case 'logout': {
        const { integrationId } = body
        if (!integrationId) return errorResponse('integrationId required')

        await supabaseAdmin
          .from('wholesaler_integrations')
          .delete()
          .eq('id', integrationId)

        return json({ success: true })
      }

      // ═══ SESSION CHECK ═══
      case 'session': {
        const { integrationId } = body
        if (!integrationId) return json({ authenticated: false })

        try {
          const { jar, integration } = await getIntegrationSession(supabaseAdmin, integrationId)
          const hasCookies = Object.keys(jar).length > 0
          return json({
            authenticated: hasCookies,
            username: integration.credentials?.username,
          })
        } catch {
          return json({ authenticated: false })
        }
      }

      // ═══ VALIDATE SESSION ═══
      case 'validate-session': {
        const { integrationId } = body
        if (!integrationId) return json({ valid: false })
        try {
          const { jar } = await getIntegrationSession(supabaseAdmin, integrationId)
          if (Object.keys(jar).length === 0) return json({ valid: false, reason: 'no_cookies' })
          // Fetch a test page and check for net prices / logged-in indicators
          const testHtml = await fetchPage('/pl/list/narzedzia', jar)
          const hasLogout = testHtml.includes('/pl/logout') || testHtml.includes('Wyloguj')
          const hasNetPrices = testHtml.includes('price-net')
          return json({ valid: hasLogout || hasNetPrices, hasLogout, hasNetPrices })
        } catch (e: any) {
          return json({ valid: false, error: e.message })
        }
      }

      // ═══ DEBUG: Test connectivity to Speckable.pl ═══
      case 'debug': {
        const results: Record<string, any> = {
          scraperApiKeySet: !!SCRAPER_API_KEY,
          scraperApiKeyPrefix: SCRAPER_API_KEY ? SCRAPER_API_KEY.slice(0, 8) + '...' : '(not set)',
          timestamp: new Date().toISOString(),
          tests: {},
        }

        // Test 1: Direct fetch
        try {
          const t0 = Date.now()
          const directResp = await fetch(BASE + '/pl/list/narzedzia', {
            headers: { 'User-Agent': UA, 'Accept-Language': 'pl-PL,pl;q=0.9' },
          })
          const directBody = await directResp.text()
          results.tests.directFetch = {
            status: directResp.status,
            bodyLength: directBody.length,
            hasProducts: directBody.includes('ins-v-product-thumbnail'),
            hasCloudflareChallenge: directBody.includes('cf-browser-verification') || directBody.includes('challenge-platform'),
            isLoginPage: directBody.includes('login[_token]'),
            titleMatch: directBody.match(/<title>([^<]+)/)?.[1]?.slice(0, 80) || '',
            timeMs: Date.now() - t0,
          }
        } catch (e: any) {
          results.tests.directFetch = { error: e.message }
        }

        // Test 2: ScraperAPI (if key is set)
        if (SCRAPER_API_KEY) {
          try {
            const t0 = Date.now()
            const scraperResult = await viaScraperAPI(BASE + '/pl/list/narzedzia')
            results.tests.scraperApi = {
              status: scraperResult.status,
              bodyLength: scraperResult.body.length,
              hasProducts: scraperResult.body.includes('ins-v-product-thumbnail'),
              hasCloudflareChallenge: scraperResult.body.includes('cf-browser-verification') || scraperResult.body.includes('challenge-platform'),
              titleMatch: scraperResult.body.match(/<title>([^<]+)/)?.[1]?.slice(0, 80) || '',
              timeMs: Date.now() - t0,
            }
          } catch (e: any) {
            results.tests.scraperApi = { error: e.message }
          }
        }

        // Test 3: ScraperAPI account status
        if (SCRAPER_API_KEY) {
          try {
            const accountResp = await fetch(`https://api.scraperapi.com/account?api_key=${SCRAPER_API_KEY}`)
            results.tests.scraperApiAccount = await accountResp.json()
          } catch (e: any) {
            results.tests.scraperApiAccount = { error: e.message }
          }
        }

        return json(results)
      }

      // ═══ CATEGORIES ═══
      case 'categories': {
        // Return static categories instantly — fetching the 2.5MB homepage via
        // ScraperAPI is too slow (30-80s) and unreliable. Categories rarely change.
        // When user clicks a category, subcategories come from the products response.
        const staticCategories = [
          { name: 'Kable i przewody', slug: '/pl/list/kable-i-przewody', image: '', subcategories: [] },
          { name: 'Kable ze złączami', slug: '/pl/list/kable-ze-zlaczami', image: '', subcategories: [] },
          { name: 'Organizacja kabli', slug: '/pl/list/organizacja-kabli', image: '', subcategories: [] },
          { name: 'Sieci światłowodowe', slug: '/pl/list/sieci-swiatlowodowe', image: '', subcategories: [] },
          { name: 'Szafy RACK i wyposażenie', slug: '/pl/list/szafy-rack-i-wyposazenie', image: '', subcategories: [] },
          { name: 'Aparatura modułowa', slug: '/pl/list/aparatura-modulowa', image: '', subcategories: [] },
          { name: 'Puszki instalacyjne i rozdzielnice', slug: '/pl/list/puszki-instalacyjne-i-rozdzielnice', image: '', subcategories: [] },
          { name: 'Ochrona odgromowa', slug: '/pl/list/ochrona-odgromowa', image: '', subcategories: [] },
          { name: 'Gniazda i łączniki', slug: '/pl/list/gniazda-i-laczniki', image: '', subcategories: [] },
          { name: 'Przedłużacze i listwy zasilające', slug: '/pl/list/przedluzacze-i-listwy-zasilajace', image: '', subcategories: [] },
          { name: 'Wtyki, gniazda i przejściówki', slug: '/pl/list/wtyki-gniazda-i-przejsciowki', image: '', subcategories: [] },
          { name: 'Oświetlenie', slug: '/pl/list/oswietlenie', image: '', subcategories: [] },
          { name: 'Fotowoltaika', slug: '/pl/list/fotowoltaika', image: '', subcategories: [] },
          { name: 'Zasilanie i energia', slug: '/pl/list/zasilanie-i-energia', image: '', subcategories: [] },
          { name: 'Urządzenia', slug: '/pl/list/urzadzenia', image: '', subcategories: [] },
          { name: 'Narzędzia', slug: '/pl/list/narzedzia', image: '', subcategories: [] },
          { name: 'Elektronarzędzia', slug: '/pl/list/elektronarzedzia', image: '', subcategories: [] },
          { name: 'Mierniki i testery', slug: '/pl/list/mierniki-i-testery', image: '', subcategories: [] },
          { name: 'Odzież ochronna i BHP', slug: '/pl/list/odziez-ochronna-i-bhp', image: '', subcategories: [] },
          { name: 'Chemia techniczna', slug: '/pl/list/chemia-techniczna', image: '', subcategories: [] },
        ]
        return json({ categories: staticCategories, total: staticCategories.length })
      }

      // ═══ PRODUCTS ═══
      case 'products': {
        const { integrationId, cat, page = 1 } = body
        if (!cat) return errorResponse('Missing cat')

        let jar: CookieJar = {}
        if (integrationId) {
          try {
            const session = await getIntegrationSession(supabaseAdmin, integrationId)
            jar = session.jar
          } catch { /* anonymous */ }
        }

        let pagePath = cat.startsWith('/') ? cat : '/' + cat
        if (page > 1) pagePath += (pagePath.includes('?') ? '&' : '?') + `page=${page}`
        let html: string
        try {
          html = await fetchPage(pagePath, jar)
        } catch (fetchErr: any) {
          console.log('[products] fetchPage failed:', fetchErr.message)
          return json({
            products: [],
            categories: [],
            page,
            totalPages: 0,
            totalProducts: 0,
            hasProducts: false,
            title: '',
            error: `Strona Speckable.pl jest tymczasowo niedostępna. (${fetchErr.message})`,
          })
        }

        // Check if session expired mid-request
        if (html.includes('login[_token]') && !html.includes('/pl/logout')) {
          // Try to re-login
          if (integrationId) {
            try {
              const { data: integ } = await supabaseAdmin.from('wholesaler_integrations').select('*').eq('id', integrationId).single()
              if (integ?.credentials?.username && integ?.credentials?.password) {
                await doLogin(integ.credentials.username, integ.credentials.password, jar)
                await supabaseAdmin.from('wholesaler_integrations').update({ credentials: { ...integ.credentials, cookies: jar, last_refresh: new Date().toISOString() } }).eq('id', integrationId)
                const retryHtml = await fetchPage(pagePath, jar)
                const data = parseListPage(retryHtml, pagePath)
                const ITEMS_PER_PAGE = 24
                const retryHasMore = data.hasProducts && data.items.length >= ITEMS_PER_PAGE
                return json({ products: data.hasProducts ? data.items : [], categories: data.hasProducts ? (data.categories || []) : data.items, page, totalPages: retryHasMore ? page + 1 : page, totalProducts: data.items.length, hasProducts: data.hasProducts, title: data.title })
              }
            } catch { /* ignore */ }
          }
        }

        const data = parseListPage(html, pagePath)
        const ITEMS_PER_PAGE = 24
        const hasMore = data.hasProducts && data.items.length >= ITEMS_PER_PAGE
        return json({
          products: data.hasProducts ? data.items : [],
          categories: data.hasProducts ? (data.categories || []) : data.items,
          page,
          totalPages: hasMore ? page + 1 : page,
          totalProducts: data.items.length,
          hasProducts: data.hasProducts,
          title: data.title,
        })
      }

      // ═══ SEARCH ═══
      case 'search': {
        const { integrationId, q } = body
        if (!q) return errorResponse('Missing q')

        let jar: CookieJar = {}
        if (integrationId) {
          try {
            const session = await getIntegrationSession(supabaseAdmin, integrationId)
            jar = session.jar
          } catch { /* anonymous */ }
        }

        const searchUrl = `/pl/query/${encodeURIComponent(q.trim())}?availability=all`
        let html: string
        try {
          html = await fetchPage(searchUrl, jar)
        } catch (fetchErr: any) {
          console.log('[search] fetchPage failed:', fetchErr.message)
          return json({ products: [], query: q, total: 0, hasProducts: false, error: `Strona Speckable.pl jest tymczasowo niedostępna. (${fetchErr.message})` })
        }
        const data = parseListPage(html, `/pl/query/${q}`)

        const products = data.items || []
        return json({ products, query: q, total: products.length, hasProducts: data.hasProducts })
      }

      // ═══ PRODUCT DETAIL ═══
      case 'product': {
        const { integrationId, slug } = body
        if (!slug) return errorResponse('Missing slug')

        let jar: CookieJar = {}
        if (integrationId) {
          try {
            const session = await getIntegrationSession(supabaseAdmin, integrationId)
            jar = session.jar
          } catch { /* anonymous */ }
        }

        const productPath = slug.startsWith('/') ? slug : '/pl/product/' + slug
        let html: string
        try {
          html = await fetchPage(productPath, jar)
        } catch (fetchErr: any) {
          console.log('[product] fetchPage failed:', fetchErr.message)
          return json({ product: null, error: `Strona Speckable.pl jest tymczasowo niedostępna. (${fetchErr.message})` })
        }
        const p = parseProductPage(html)

        const product = {
          name: p.title || '',
          sku: p.sku || '',
          ean: p.ean || '',
          brand: p.brand || '',
          priceNetto: p.priceNetto ?? null,
          priceGross: p.priceGross ?? null,
          currency: p.currency || 'PLN',
          stock: p.stock || '',
          stockExternal: p.stockExternal || '',
          unit: p.unit || 'szt',
          image: p.images?.[0] || '',
          images: p.images || [],
          description: p.description || '',
          descriptionHtml: p.descriptionHtml || '',
          specification: p.specification || [],
          breadcrumb: (p.breadcrumb || []).map((b: any) => b.name).join(' > '),
          url: BASE + productPath,
          related: p.related || [],
        }

        return json({ product })
      }

      default:
        return errorResponse(`Unknown action: ${action}`)
    }
  } catch (error) {
    const msg = (error as Error).message || String(error)
    const stack = (error as Error).stack || ''
    console.error('speckable-proxy error:', msg, stack)
    return new Response(
      JSON.stringify({ error: msg, _stack: stack.split('\n').slice(0, 3).join(' | ') }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
