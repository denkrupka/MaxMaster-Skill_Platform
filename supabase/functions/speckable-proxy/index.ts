import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BASE = 'https://www.speckable.pl'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'

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

async function fetchPage(url: string, jar: CookieJar): Promise<string> {
  const fullUrl = url.startsWith('http') ? url : BASE + url
  const res = await fetch(fullUrl, { headers: makeHeaders(jar), redirect: 'follow' })
  parseCookiesFromHeaders(res.headers, jar)
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  return res.text()
}

async function postForm(url: string, body: string, jar: CookieJar): Promise<string> {
  const fullUrl = url.startsWith('http') ? url : BASE + url
  const res = await fetch(fullUrl, {
    method: 'POST',
    headers: {
      ...makeHeaders(jar),
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': BASE + '/pl/login',
    },
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

  // Products (product cards with ins-v-product-thumbnail class)
  const products: any[] = []
  const pSeen = new Set<string>()
  if (!isRoot) {
    const cardRe = /<[^>]*class="[^"]*ins-v-product-thumbnail[^"]*"[^>]*>([\s\S]*?)(?=<[^>]*class="[^"]*ins-v-product-thumbnail|$)/gi
    let card: RegExpExecArray | null
    while ((card = cardRe.exec(html)) !== null) {
      const block = card[0]
      // Extract product URL
      const hrefMatch = block.match(/<a[^>]*href="(\/pl\/product\/[^"]+)"[^>]*>/i)
      if (!hrefMatch) continue
      const slug = hrefMatch[1]
      if (pSeen.has(slug)) continue
      pSeen.add(slug)

      // Name: from .heading or img alt
      const headingMatch = block.match(/<[^>]*class="[^"]*heading[^"]*"[^>]*>([\s\S]*?)<\/[^>]*>/i)
      let name = headingMatch ? stripHtml(headingMatch[1]) : ''
      if (!name) {
        const altMatch = block.match(/<img[^>]*class="[^"]*photo[^"]*"[^>]*alt="([^"]*)"[^>]*>/i)
        if (altMatch) name = altMatch[1]
      }
      if (!name) continue

      // Image
      const imgMatch = block.match(/<img[^>]*class="[^"]*photo[^"]*"[^>]*(?:src|data-src)="([^"]*)"[^>]*>/i)
        || block.match(/<img[^>]*(?:src|data-src)="([^"]*)"[^>]*class="[^"]*photo[^"]*"[^>]*>/i)
      const image = imgMatch ? absUrl(imgMatch[1]) : ''

      // Symbol (SKU) from <strong>
      const strongMatch = block.match(/<strong[^>]*>([^<]+)<\/strong>/i)
      const symbol = strongMatch ? strongMatch[1].trim() : ''

      // Price netto
      const priceNetBlock = block.match(/<[^>]*class="[^"]*price-net[^"]*"[^>]*>([\s\S]*?)<\/[^>]*>/i)
      let priceNetto: number | null = null
      if (priceNetBlock) {
        priceNetto = parsePrice(priceNetBlock[1])
        if (priceNetto === null) priceNetto = parsePriceFromText(stripHtml(priceNetBlock[1]))
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

  if (products.length > 0) {
    return { title, breadcrumb, items: products, hasProducts: true }
  }

  // Categories: links with href="/pl/list/..."
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

  // Filter by level
  if (categories.length > 30) {
    if (isRoot) {
      const topLevel = categories.filter(c => c.slug.split('/').filter(Boolean).length === 3)
      if (topLevel.length > 0) {
        return { title: title || 'Katalog produktów', breadcrumb, items: topLevel, hasProducts: false }
      }
    } else {
      const children = categories.filter(c => c.slug.startsWith(norm + '/') && c.slug !== norm + '/')
      if (children.length > 0) {
        return { title, breadcrumb, items: children, hasProducts: false }
      }
    }
  }

  return { title, breadcrumb, items: categories, hasProducts: false }
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

async function doLogin(username: string, password: string, jar: CookieJar): Promise<boolean> {
  // Step 1: Fetch login page to get CSRF token
  const loginHtml = await fetchPage('/pl/login', jar)

  // Check if already logged in
  if (loginHtml.includes('/pl/logout') || loginHtml.includes('Wyloguj')) {
    return true
  }

  // Extract CSRF token
  const tokenMatch = loginHtml.match(/name="login\[_token\]"\s*value="([^"]+)"/i)
    || loginHtml.match(/value="([^"]+)"\s*name="login\[_token\]"/i)
  if (!tokenMatch) {
    throw new Error('Nie znaleziono tokena CSRF na stronie logowania')
  }
  const token = tokenMatch[1]

  // Step 2: POST login form
  const formData = [
    `login[_token]=${encodeURIComponent(token)}`,
    `login[referer]=${encodeURIComponent(BASE + '/')}`,
    `login[email]=${encodeURIComponent(username)}`,
    `login[password]=${encodeURIComponent(password)}`,
  ].join('&')

  const responseHtml = await postForm('/pl/login', formData, jar)

  // Step 3: Verify success
  if (responseHtml.includes('/pl/logout') || responseHtml.includes('Wyloguj') || responseHtml.includes('Moje konto')) {
    return true
  }

  throw new Error('Niepoprawne dane logowania')
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
        if (!username || !password) return errorResponse('Username + password required')

        const jar: CookieJar = {}
        await doLogin(username, password, jar)

        const credentialsData = {
          username,
          password,
          cookies: jar,
          last_refresh: new Date().toISOString(),
        }

        let integrationId: string
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

          if (insertErr) throw new Error('Failed to save integration: ' + insertErr.message)
          integrationId = inserted.id
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

      // ═══ CATEGORIES ═══
      case 'categories': {
        const { integrationId } = body
        let jar: CookieJar = {}

        if (integrationId) {
          try {
            const session = await getIntegrationSession(supabaseAdmin, integrationId)
            jar = session.jar
          } catch { /* anonymous */ }
        }

        // Fetch the root list page for categories
        const html = await fetchPage('/', jar)

        // Parse category links href="/pl/list/..."
        const catBySlug = new Map<string, { slug: string; name: string; image: string }>()
        const catLinkRe = /<a[^>]*href="(\/pl\/list\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
        let catLink: RegExpExecArray | null
        while ((catLink = catLinkRe.exec(html)) !== null) {
          const slug = catLink[1]
          const inner = catLink[2]
          const nameSpan = inner.match(/<[^>]*class="[^"]*name[^"]*"[^>]*>([^<]*)<\/[^>]*>/i)
          let name = nameSpan ? nameSpan[1].trim() : stripHtml(inner).split('\n')[0].trim()
          if (!name || name.length < 2 || name.length > 120) continue
          const imgMatch = inner.match(/<img[^>]*(?:src|data-src)="([^"]*)"[^>]*>/i)
          const image = imgMatch ? absUrl(imgMatch[1]) : ''
          const existing = catBySlug.get(slug)
          if (!existing || (!existing.image && image)) {
            catBySlug.set(slug, { slug, name, image })
          }
        }

        // Build 3-level tree
        const allCats = Array.from(catBySlug.values())
        const mainCats: Array<{ slug: string; name: string; image: string }> = []
        const subMap: Record<string, Array<{ slug: string; name: string; image: string }>> = {}
        const ssubMap: Record<string, Array<{ slug: string; name: string; image: string }>> = {}

        for (const c of allCats) {
          const parts = c.slug.split('/').filter(Boolean)
          if (parts.length === 3) {
            // Top-level: /pl/list/xxx
            if (!mainCats.find(m => m.slug === c.slug)) mainCats.push(c)
          } else if (parts.length === 4) {
            // Sub-level: /pl/list/xxx/yyy
            const parent = '/' + parts.slice(0, 3).join('/')
            if (!subMap[parent]) subMap[parent] = []
            if (!subMap[parent].find(s => s.slug === c.slug)) subMap[parent].push(c)
          } else if (parts.length === 5) {
            // Sub-sub-level: /pl/list/xxx/yyy/zzz
            const parent = '/' + parts.slice(0, 4).join('/')
            if (!ssubMap[parent]) ssubMap[parent] = []
            if (!ssubMap[parent].find(s => s.slug === c.slug)) ssubMap[parent].push(c)
          }
        }

        const tree = mainCats.map(c => ({
          name: c.name,
          slug: c.slug,
          image: c.image,
          subcategories: (subMap[c.slug] || []).map(s => ({
            name: s.name,
            slug: s.slug,
            image: s.image,
            subcategories: ssubMap[s.slug] || [],
          })),
        }))

        return json({ categories: tree, total: tree.length })
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

        const pagePath = cat.startsWith('/') ? cat : '/' + cat
        const html = await fetchPage(pagePath, jar)

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
                const products = (data.items || []).filter((i: any) => data.hasProducts || !i.slug?.includes('/pl/product/'))
                return json({ products: data.hasProducts ? data.items : [], categories: data.hasProducts ? [] : data.items, page, totalPages: 1, totalProducts: data.items.length, hasProducts: data.hasProducts, title: data.title })
              }
            } catch { /* ignore */ }
          }
        }

        const data = parseListPage(html, pagePath)
        return json({
          products: data.hasProducts ? data.items : [],
          categories: data.hasProducts ? [] : data.items,
          page,
          totalPages: 1,
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
        const html = await fetchPage(searchUrl, jar)
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
        const html = await fetchPage(productPath, jar)
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
