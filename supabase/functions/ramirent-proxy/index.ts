import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BASE = 'https://ramirent.pl'
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
function makeHeaders(jar?: CookieJar): Record<string, string> {
  const h: Record<string, string> = {
    'User-Agent': UA,
    'Accept': 'text/html,application/xhtml+xml,*/*',
    'Accept-Language': 'pl-PL,pl;q=0.9',
    'Referer': BASE + '/',
  }
  if (jar && Object.keys(jar).length) h['Cookie'] = cookieString(jar)
  return h
}

async function fetchHTML(path: string, jar?: CookieJar): Promise<string> {
  const url = path.startsWith('http') ? path : BASE + path
  const res = await fetch(url, { headers: makeHeaders(jar), redirect: 'follow' })
  if (jar) parseCookiesFromHeaders(res.headers, jar)
  return res.text()
}

async function fetchAJAX(path: string, jar?: CookieJar): Promise<Response> {
  const url = path.startsWith('http') ? path : BASE + path
  // Append ?xhr=true as the site expects
  const ajaxUrl = url.includes('?') ? url + '&xhr=true' : url + '?xhr=true'
  const headers: Record<string, string> = {
    ...makeHeaders(jar),
    'Accept': '*/*',
    'X-Requested-With': 'XMLHttpRequest',
  }
  const res = await fetch(ajaxUrl, { headers, redirect: 'follow' })
  if (jar) parseCookiesFromHeaders(res.headers, jar)
  return res
}

async function fetchJSON(path: string, jar?: CookieJar): Promise<any> {
  const res = await fetchAJAX(path, jar)
  return res.json()
}

// ═══ PARSERS ═══

// Parse top-level categories from /wynajem page
// Uses c-category-box links with href /wynajem/wg-produktu/{slug}
function parseCategories(html: string): Array<{ slug: string; name: string; image: string }> {
  const cats: Array<{ slug: string; name: string; image: string }> = []
  const seen = new Set<string>()

  // c-category-box links in the "wg-produktu" tab
  const boxRe = /<a[^>]+href="([^"]*\/wynajem\/wg-produktu\/[^"]*)"[^>]*class="[^"]*c-category-box[^"]*"[^>]*>([\s\S]*?)<\/a>/gi
  let m
  while ((m = boxRe.exec(html)) !== null) {
    const href = m[1]
    if (seen.has(href)) continue
    seen.add(href)
    const titleM = m[2].match(/c-category-box__title[^>]*>([^<]+)/i)
    const title = titleM ? titleM[1].trim() : ''
    const imgM = m[2].match(/<img[^>]+src="([^"]+)"/i)
    const img = imgM ? (imgM[1].startsWith('http') ? imgM[1] : BASE + imgM[1]) : ''
    if (title) cats.push({ slug: href, name: title, image: img })
  }

  // Also try: class before href
  if (!cats.length) {
    const boxRe2 = /<a[^>]+class="[^"]*c-category-box[^"]*"[^>]+href="([^"]*\/wynajem\/wg-produktu\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
    while ((m = boxRe2.exec(html)) !== null) {
      const href = m[1]
      if (seen.has(href)) continue
      seen.add(href)
      const titleM = m[2].match(/c-category-box__title[^>]*>([^<]+)/i)
      const title = titleM ? titleM[1].trim() : ''
      const imgM = m[2].match(/<img[^>]+src="([^"]+)"/i)
      const img = imgM ? (imgM[1].startsWith('http') ? imgM[1] : BASE + imgM[1]) : ''
      if (title) cats.push({ slug: href, name: title, image: img })
    }
  }

  // Hardcoded fallback
  if (!cats.length) {
    return [
      { slug: '/wynajem/wg-produktu/lekki-sprzet-budowlany', name: 'Lekki sprzęt budowlany', image: '' },
      { slug: '/wynajem/wg-produktu/ciezki-sprzet-budowlany', name: 'Ciężki sprzęt budowlany', image: '' },
      { slug: '/wynajem/wg-produktu/podnosniki', name: 'Podnośniki', image: '' },
      { slug: '/wynajem/wg-produktu/zasilanie-i-ogrzewanie', name: 'Zasilanie i ogrzewanie', image: '' },
      { slug: '/wynajem/wg-produktu/ogrodzenia-i-podpory-stropowe', name: 'Ogrodzenia i podpory stropowe', image: '' },
      { slug: '/wynajem/wg-produktu/kontenery', name: 'Kontenery', image: '' },
      { slug: '/wynajem/wg-produktu/rusztowania-i-uslugi', name: 'Rusztowania i usługi', image: '' },
      { slug: '/wynajem/wg-produktu/podesty-i-dzwigi-budowlane', name: 'Podesty i dźwigi budowlane', image: '' },
    ]
  }

  return cats
}

// Parse c-product-card items on category pages (/wynajem/wg-produktu/{cat})
// These are subcategory OR product-group tiles with images
function parseProductCards(html: string): Array<{ slug: string; name: string; image: string }> {
  const items: Array<{ slug: string; name: string; image: string }> = []
  const seen = new Set<string>()

  // c-product-card links: <a href="/wynajem/..." class="c-product-card">
  const re = /<a[^>]+href="([^"]*\/wynajem\/[^"]*)"[^>]*class="[^"]*c-product-card[^"]*"[^>]*>([\s\S]*?)<\/a>/gi
  let m
  while ((m = re.exec(html)) !== null) {
    const href = m[1]
    if (seen.has(href)) continue
    seen.add(href)
    const titleM = m[2].match(/c-product-card__title[^>]*>([^<]+)/i)
    const title = titleM ? titleM[1].trim() : ''
    const imgM = m[2].match(/<img[^>]+src="([^"]+)"/i) || m[2].match(/<source[^>]+srcset="([^"]+)"/i)
    const img = imgM ? (imgM[1].startsWith('http') ? imgM[1] : BASE + imgM[1]) : ''
    if (title) items.push({ slug: href, name: title, image: img })
  }

  // Also try: class before href
  if (!items.length) {
    const re2 = /<a[^>]+class="[^"]*c-product-card[^"]*"[^>]+href="([^"]*\/wynajem\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
    while ((m = re2.exec(html)) !== null) {
      const href = m[1]
      if (seen.has(href)) continue
      seen.add(href)
      const titleM = m[2].match(/c-product-card__title[^>]*>([^<]+)/i)
      const title = titleM ? titleM[1].trim() : ''
      const imgM = m[2].match(/<img[^>]+src="([^"]+)"/i)
      const img = imgM ? (imgM[1].startsWith('http') ? imgM[1] : BASE + imgM[1]) : ''
      if (title) items.push({ slug: href, name: title, image: img })
    }
  }

  return items
}

// Parse p-equipments-list-box items on subcategory pages
// These are product group links with images and breadcrumbs
function parseEquipmentListBoxes(html: string): Array<{ slug: string; name: string; image: string; breadcrumb?: string }> {
  const items: Array<{ slug: string; name: string; image: string; breadcrumb?: string }> = []
  const seen = new Set<string>()

  const re = /<a[^>]+href="([^"]*\/wynajem\/[^"]*)"[^>]*class="[^"]*p-equipments-list-box[^"]*"[^>]*>([\s\S]*?)<\/a>/gi
  let m
  while ((m = re.exec(html)) !== null) {
    const href = m[1]
    if (seen.has(href)) continue
    seen.add(href)
    const titleM = m[2].match(/p-equipments-list-box__title[^>]*>([^<]+)/i)
    const title = titleM ? titleM[1].trim() : ''
    const imgM = m[2].match(/<img[^>]+src="([^"]+)"/i)
    const img = imgM ? (imgM[1].startsWith('http') ? imgM[1] : BASE + imgM[1]) : ''
    const bcM = m[2].match(/p-equipments-list-box__breadcrumb[^>]*>([^<]+)/i)
    const breadcrumb = bcM ? bcM[1].trim() : undefined
    if (title) items.push({ slug: href, name: title, image: img, breadcrumb })
  }

  // Also try with class before href
  if (!items.length) {
    const re2 = /<a[^>]+class="[^"]*p-equipments-list-box[^"]*"[^>]+href="([^"]*\/wynajem\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
    while ((m = re2.exec(html)) !== null) {
      const href = m[1]
      if (seen.has(href)) continue
      seen.add(href)
      const titleM = m[2].match(/p-equipments-list-box__title[^>]*>([^<]+)/i)
      const title = titleM ? titleM[1].trim() : ''
      const imgM = m[2].match(/<img[^>]+src="([^"]+)"/i)
      const img = imgM ? (imgM[1].startsWith('http') ? imgM[1] : BASE + imgM[1]) : ''
      if (title) items.push({ slug: href, name: title, image: img })
    }
  }

  return items
}

// Parse product detail page (/wynajem/{product-slug})
// Uses p-equipments-item structure
function parseProductPage(html: string) {
  const result: Record<string, any> = {}

  // Title
  const h1M = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  result.title = h1M ? h1M[1].replace(/<[^>]*>/g, '').trim() : ''

  // Product code from text-primary font-bold
  const codeM = html.match(/text-primary\s+font-bold[^>]*>([^<]+)/i)
  result.code = codeM ? codeM[1].trim() : ''

  // Group ID from #jsPlaceBtn data-group_id
  const groupIdM = html.match(/data-group_id="(\d+)"/i) || html.match(/jsPlaceBtn[^>]+data-group_id="(\d+)"/i)
  result.groupId = groupIdM ? groupIdM[1] : ''

  // Description
  result.description = ''
  const descM = html.match(/class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
  if (descM) {
    result.description = descM[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 1000)
  }
  if (!result.description) {
    const metaM = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)
    if (metaM) result.description = metaM[1].trim()
  }
  if (!result.description) {
    const ogM = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i)
    if (ogM) result.description = ogM[1].trim()
  }

  // JSON-LD for price and brand
  const ldRe = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  let ldm
  while ((ldm = ldRe.exec(html)) !== null) {
    try {
      const ld = JSON.parse(ldm[1])
      if (ld.offers) {
        result.priceBrutto = parseFloat(ld.offers.price) || null
      }
      if (ld.brand) result.brand = ld.brand.name || ''
      if (ld.image) result.image = ld.image
    } catch { /* skip */ }
  }

  // Gallery images from p-equipments-item-gallery__item
  result.images = []
  const galleryRe = /p-equipments-item-gallery__item[^>]*>[\s\S]*?<(?:img|source)[^>]+(?:src|srcset)="([^"]+)"/gi
  let gm
  while ((gm = galleryRe.exec(html)) !== null) {
    const src = gm[1].startsWith('http') ? gm[1] : BASE + gm[1]
    if (!result.images.includes(src)) result.images.push(src)
  }
  // Fallback: data-jsGalleryItems
  if (!result.images.length) {
    const galleryRe2 = /data-jsGalleryItems[^>]*>[\s\S]*?<(?:img|source)[^>]+(?:src|srcset)="([^"]+)"/gi
    while ((gm = galleryRe2.exec(html)) !== null) {
      const src = gm[1].startsWith('http') ? gm[1] : BASE + gm[1]
      if (!result.images.includes(src)) result.images.push(src)
    }
  }
  // og:image fallback
  if (!result.images.length && !result.image) {
    const ogImgM = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)
    if (ogImgM) result.image = ogImgM[1]
  }

  // AJAX detail URL (data-jsLoad)
  const ajaxM = html.match(/data-jsLoad="([^"]+)"/i)
  result.detailUrl = ajaxM ? ajaxM[1] : ''

  // Models (c-product-card items within this product page)
  result.models = []
  // Match cards linking to /produkt/ or /wynajem/
  const cardRe = /<a[^>]+href="([^"]*\/(?:produkt|wynajem)\/[^"]*)"[^>]*class="[^"]*c-product-card[^"]*"[^>]*>([\s\S]*?)<\/a>/gi
  let crm
  while ((crm = cardRe.exec(html)) !== null) {
    const titleM = crm[2].match(/c-product-card__title[^>]*>([^<]+)/i)
    const imgM = crm[2].match(/<img[^>]+src="([^"]+)"/i)
    if (titleM) {
      result.models.push({
        code: '',
        slug: crm[1],
        name: titleM[1].trim(),
        image: imgM ? (imgM[1].startsWith('http') ? imgM[1] : BASE + imgM[1]) : '',
      })
    }
  }
  // Also try class before href
  if (!result.models.length) {
    const cardRe2 = /<a[^>]+class="[^"]*c-product-card[^"]*"[^>]+href="([^"]*\/(?:produkt|wynajem)\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
    while ((crm = cardRe2.exec(html)) !== null) {
      const titleM = crm[2].match(/c-product-card__title[^>]*>([^<]+)/i)
      const imgM = crm[2].match(/<img[^>]+src="([^"]+)"/i)
      if (titleM) {
        result.models.push({
          code: '',
          slug: crm[1],
          name: titleM[1].trim(),
          image: imgM ? (imgM[1].startsWith('http') ? imgM[1] : BASE + imgM[1]) : '',
        })
      }
    }
  }

  // Parameters / specs
  result.parameters = []
  // Method 1: c-product-spec classes
  const specRe = /c-product-spec__(?:label|name)[^>]*>([^<]+)[\s\S]*?c-product-spec__value[^>]*>([^<]+)/gi
  let specM
  while ((specM = specRe.exec(html)) !== null) {
    const name = specM[1].trim()
    const value = specM[2].trim()
    if (name && value) result.parameters.push({ name, value })
  }
  // Method 2: c-equipment-specification-table <tr> rows
  if (!result.parameters.length) {
    const specTableM = html.match(/c-equipment-specification-table[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i)
    if (specTableM) {
      const trRe = /<tr[^>]*>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi
      let trM
      while ((trM = trRe.exec(specTableM[1])) !== null) {
        const name = trM[1].replace(/<[^>]+>/g, '').trim()
        const value = trM[2].replace(/<[^>]+>/g, '').trim()
        if (name && value && name.length < 80 && value.length < 80) result.parameters.push({ name, value })
      }
    }
  }
  // Method 3: any table rows as fallback
  if (!result.parameters.length) {
    const trRe = /<tr[^>]*>[\s\S]*?<t[hd][^>]*>([\s\S]*?)<\/t[hd]>[\s\S]*?<t[hd][^>]*>([\s\S]*?)<\/t[hd]>[\s\S]*?<\/tr>/gi
    let trM
    while ((trM = trRe.exec(html)) !== null) {
      const name = trM[1].replace(/<[^>]+>/g, '').trim()
      const value = trM[2].replace(/<[^>]+>/g, '').trim()
      if (name && value && name.length < 80 && value.length < 80) result.parameters.push({ name, value })
    }
  }

  result.contactOnly = !result.priceBrutto && !result.priceNetto
  return result
}

// Parse AJAX detail response (pricing, availability)
function parseAjaxDetail(html: string) {
  const p: Record<string, any> = {}

  // Price from data-price attributes
  const priceTaxM = html.match(/jsPriceSumTax[^>]+data-price="([^"]+)"/i)
  const priceNetM = html.match(/jsPriceSumNet[^>]+data-price="([^"]+)"/i)
  p.priceBrutto = priceTaxM ? parseFloat(priceTaxM[1]) : null
  p.priceNetto = priceNetM ? parseFloat(priceNetM[1]) : null

  // Fallback: text prices
  if (!p.priceBrutto) {
    const m = html.match(/font-14\s+font-bold[^>]*>([^<]*[\d,]+[^<]*zł)/i)
    if (m) {
      const pm = m[1].match(/([\d,]+)\s*zł/)
      if (pm) p.priceBrutto = parseFloat(pm[1].replace(',', '.'))
    }
  }
  if (!p.priceNetto) {
    const m = html.match(/text-light[^>]*>([^<]*[\d,]+[^<]*zł[^<]*netto)/i)
    if (m) {
      const pm = m[1].match(/([\d,]+)\s*zł/)
      if (pm) p.priceNetto = parseFloat(pm[1].replace(',', '.'))
    }
  }

  // data-price fallback
  if (!p.priceBrutto) {
    const m = html.match(/data-price="([\d.]+)"/)
    if (m) p.priceBrutto = parseFloat(m[1])
  }

  // Price unit
  const unitM = html.match(/font-bold\s+text-light[^>]*>\/\s*([^<]+)/i)
  p.priceUnit = unitM ? unitM[1].trim() : 'Dzień'

  // Availability
  const availM = html.match(/jsPlaceStatus[^>]*>([^<]+)/i)
  p.available = availM ? availM[1].trim() : ''
  const placeM = html.match(/jsPlaceLabel[^>]*>([^<]+)/i)
  p.place = placeM ? placeM[1].trim() : ''

  p.contactOnly = !p.priceBrutto && !p.priceNetto
  return p
}

// ═══ PAGE TYPE DETECTION ═══
// Based on HAR analysis:
// - /wynajem/wg-produktu/{cat} → category (has c-product-card tiles)
// - /wynajem/wg-produktu/{cat}/{subcat} → subcategory (has p-equipments-list-box items)
// - /wynajem/{product-slug} → product detail (has p-equipments-item)
function detectPageType(path: string, html: string): 'category' | 'product' {
  // URL-based: /wynajem/wg-produktu/ or /wynajem/wg-zastosowania/ → category/subcategory
  if (path.includes('/wg-produktu/') || path.includes('/wg-zastosowania/')) {
    return 'category'
  }
  // HTML-based: p-equipments-item → product detail page
  if (html.includes('p-equipments-item')) {
    return 'product'
  }
  // HTML-based: p-equipments-list-box → listing page
  if (html.includes('p-equipments-list-box')) {
    return 'category'
  }
  // Fallback: if has c-product-card it's a listing
  if (html.includes('c-product-card')) {
    return 'category'
  }
  // Default: treat as product (try to parse)
  return 'product'
}

// ═══ SESSION REFRESH ═══
const SESSION_FRESH_MS = 30 * 60 * 1000

async function getIntegrationSession(
  supabaseAdmin: any,
  integrationId: string
): Promise<{ jar: CookieJar; integration: any }> {
  const { data: integration, error } = await supabaseAdmin
    .from('wholesaler_integrations')
    .select('*')
    .eq('id', integrationId)
    .single()

  if (error || !integration) throw new Error('Integration not found')

  const creds = integration.credentials || {}
  const jar: CookieJar = creds.cookies || {}

  // If cookies are fresh, reuse
  if (Object.keys(jar).length > 0 && creds.last_refresh) {
    const age = Date.now() - new Date(creds.last_refresh).getTime()
    if (age < SESSION_FRESH_MS) {
      return { jar, integration }
    }
  }

  // Test cookies by fetching /ajax/init
  if (Object.keys(jar).length > 0) {
    try {
      const initData = await fetchJSON('/ajax/init', jar)
      if (initData?.account?.client_id) {
        await supabaseAdmin
          .from('wholesaler_integrations')
          .update({ credentials: { ...creds, last_refresh: new Date().toISOString() } })
          .eq('id', integrationId)
        return { jar, integration }
      }
    } catch { /* cookies stale */ }
  }

  // Auto-refresh: re-login
  if (creds.username && creds.password) {
    try {
      const freshJar = await doLogin(creds.username, creds.password)
      await supabaseAdmin
        .from('wholesaler_integrations')
        .update({
          credentials: { ...creds, cookies: freshJar, last_refresh: new Date().toISOString() },
        })
        .eq('id', integrationId)
      return { jar: freshJar, integration }
    } catch { /* login failed */ }
  }

  return { jar: {}, integration }
}

// ═══ LOGIN FLOW ═══
async function doLogin(email: string, password: string): Promise<CookieJar> {
  const jar: CookieJar = {}
  await fetchHTML('/', jar)
  const body = `account_login=${encodeURIComponent(email)}&account_password=${encodeURIComponent(password)}&account_mode=login`
  const loginRes = await fetch(BASE + '/konto?basket=1', {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': '*/*',
      'Origin': BASE,
      'Referer': BASE + '/konto?basket=1',
      'X-Requested-With': 'XMLHttpRequest',
      'Cookie': cookieString(jar),
    },
    body,
    redirect: 'manual',
  })
  parseCookiesFromHeaders(loginRes.headers, jar)

  const initData = await fetchJSON('/ajax/init', jar)
  const acct = initData?.account || {}
  if (!acct.client_id) throw new Error('Login failed — niepoprawne dane logowania')
  return jar
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
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

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

    switch (action) {
      // ═══ LOGIN ═══
      case 'login': {
        const { username, password, companyId, wholesalerId, wholesalerName, branza, existingIntegrationId } = body
        if (!username || !password) return errorResponse('Email + hasło wymagane')

        const jar = await doLogin(username, password)
        const initData = await fetchJSON('/ajax/init', jar)
        const acct = initData?.account || {}

        const credentialsData = {
          username, password, cookies: jar,
          clientId: acct.client_id, clientLogin: acct.client_login,
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
              company_id: companyId, wholesaler_id: wholesalerId,
              wholesaler_name: wholesalerName, branza,
              credentials: credentialsData, is_active: true,
            })
            .select('id').single()
          if (insertErr) throw new Error('Failed to save: ' + insertErr.message)
          integrationId = inserted.id
        }

        return json({ success: true, integrationId, username: acct.client_login || username, clientId: acct.client_id })
      }

      // ═══ LOGOUT ═══
      case 'logout': {
        const { integrationId } = body
        if (!integrationId) return errorResponse('integrationId required')
        await supabaseAdmin.from('wholesaler_integrations').delete().eq('id', integrationId)
        return json({ success: true })
      }

      // ═══ SESSION CHECK ═══
      case 'session': {
        const { integrationId } = body
        if (!integrationId) return json({ authenticated: false })
        try {
          const { jar } = await getIntegrationSession(supabaseAdmin, integrationId)
          if (Object.keys(jar).length === 0) return json({ authenticated: false })
          const initData = await fetchJSON('/ajax/init', jar)
          const acct = initData?.account || {}
          return json({ authenticated: !!acct.client_id, clientId: acct.client_id, email: acct.client_login })
        } catch {
          return json({ authenticated: false })
        }
      }

      // ═══ CATEGORIES ═══
      case 'categories': {
        const { integrationId } = body
        let jar: CookieJar = {}
        if (integrationId) {
          try { jar = (await getIntegrationSession(supabaseAdmin, integrationId)).jar } catch { /* anon */ }
        }
        const html = await fetchHTML('/wynajem', jar)
        const categories = parseCategories(html)
        return json({ categories, total: categories.length })
      }

      // ═══ BROWSE ═══
      case 'browse': {
        const { integrationId, slug } = body
        if (!slug) return errorResponse('Missing slug')

        let jar: CookieJar = {}
        if (integrationId) {
          try { jar = (await getIntegrationSession(supabaseAdmin, integrationId)).jar } catch { /* anon */ }
        }

        const path = slug.startsWith('/') ? slug : '/' + slug
        const html = await fetchHTML(path, jar)
        const pageType = detectPageType(path, html)

        if (pageType === 'category') {
          // Try to find items using both methods
          const productCards = parseProductCards(html)
          const equipmentBoxes = parseEquipmentListBoxes(html)

          // Use whichever found results (equipmentBoxes are deeper subcategories/products)
          const items = equipmentBoxes.length > 0 ? equipmentBoxes : productCards

          const h1M = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
          const title = h1M ? h1M[1].replace(/<[^>]*>/g, '').trim() : ''

          return json({ type: 'category', title, items })
        } else {
          // Product detail page
          const group = parseProductPage(html)

          // Fetch AJAX detail for prices/availability
          const detailUrl = group.detailUrl || path
          try {
            const detailRes = await fetchAJAX(detailUrl, jar)
            const detailHtml = await detailRes.text()
            if (detailHtml.length > 50) {
              const detail = parseAjaxDetail(detailHtml)
              Object.assign(group, detail)
            }
          } catch { /* skip */ }

          return json({ type: 'group', group })
        }
      }

      // ═══ PRODUCT DETAIL ═══
      case 'product': {
        const { integrationId, slug } = body
        if (!slug) return errorResponse('Missing slug')

        let jar: CookieJar = {}
        if (integrationId) {
          try { jar = (await getIntegrationSession(supabaseAdmin, integrationId)).jar } catch { /* anon */ }
        }

        const path = slug.startsWith('/') ? slug : '/' + slug
        const html = await fetchHTML(path, jar)
        const group = parseProductPage(html)

        // AJAX detail for prices
        const detailUrl = group.detailUrl || path
        try {
          const detailRes = await fetchAJAX(detailUrl, jar)
          const detailHtml = await detailRes.text()
          if (detailHtml.length > 50) {
            const detail = parseAjaxDetail(detailHtml)
            Object.assign(group, detail)
          }
        } catch { /* skip */ }

        // Related products
        if (group.groupId) {
          try {
            const connRes = await fetchAJAX(`/ajax/groupsConnections/${group.groupId}`, jar)
            const connHtml = await connRes.text()
            if (connHtml.length > 50) {
              group.related = []
              const cardRe = /<a[^>]+href="([^"]*\/wynajem\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
              let rm
              while ((rm = cardRe.exec(connHtml)) !== null) {
                const titleM = rm[2].match(/c-product-card__title[^>]*>([^<]+)/i) || rm[2].match(/p-equipments-list-box__title[^>]*>([^<]+)/i)
                const imgM = rm[2].match(/<img[^>]+src="([^"]+)"/i)
                if (titleM) {
                  group.related.push({
                    slug: rm[1],
                    name: titleM[1].trim(),
                    image: imgM ? (imgM[1].startsWith('http') ? imgM[1] : BASE + imgM[1]) : '',
                  })
                }
              }
            }
          } catch { /* skip */ }
        }

        return json({ product: group })
      }

      // ═══ SEARCH ═══
      case 'search': {
        const { integrationId, q } = body
        if (!q) return errorResponse('Missing q')

        let jar: CookieJar = {}
        if (integrationId) {
          try { jar = (await getIntegrationSession(supabaseAdmin, integrationId)).jar } catch { /* anon */ }
        }

        // Use XHR search — returns JSON { items: [{name, href, breadcrumb, img}] }
        try {
          const searchRes = await fetchAJAX(`/wyszukiwarka?str=${encodeURIComponent(q)}`, jar)
          const searchData = await searchRes.json()
          const products = (searchData.items || []).map((item: any) => ({
            slug: item.href,
            name: item.name,
            image: item.img ? (item.img.startsWith('http') ? item.img : BASE + item.img) : '',
            breadcrumb: item.breadcrumb,
          }))
          return json({ products, query: q, total: products.length })
        } catch {
          // Fallback: fetch HTML search results
          const html = await fetchHTML(`/wyszukiwarka?str=${encodeURIComponent(q)}`, jar)
          const boxes = parseEquipmentListBoxes(html)
          return json({ products: boxes, query: q, total: boxes.length })
        }
      }

      default:
        return errorResponse(`Unknown action: ${action}`)
    }
  } catch (error) {
    const msg = (error as Error).message || String(error)
    console.error('ramirent-proxy error:', msg)
    return new Response(
      JSON.stringify({ error: msg }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
