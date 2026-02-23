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
  const headers: Record<string, string> = {
    ...makeHeaders(jar),
    'Accept': '*/*',
    'X-Requested-With': 'XMLHttpRequest',
  }
  const res = await fetch(url, { headers, redirect: 'follow' })
  if (jar) parseCookiesFromHeaders(res.headers, jar)
  return res
}

async function fetchJSON(path: string, jar?: CookieJar): Promise<any> {
  const res = await fetchAJAX(path, jar)
  return res.json()
}

// ═══ REGEX HTML PARSERS ═══

function parseCategories(html: string): Array<{ slug: string; name: string; image: string }> {
  const cats: Array<{ slug: string; name: string; image: string }> = []
  const seen = new Set<string>()

  // Category box links: <a class="c-category-box" href="/wynajem/...">
  const boxRe = /<a[^>]+class="[^"]*c-category-box[^"]*"[^>]+href="([^"]*\/wynajem\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
  let m
  while ((m = boxRe.exec(html)) !== null) {
    const href = m[1]
    if (seen.has(href)) continue
    seen.add(href)
    const titleM = m[2].match(/c-category-box__title[^>]*>([^<]+)/i)
    const title = titleM ? titleM[1].trim() : m[2].replace(/<[^>]*>/g, '').trim()
    const imgM = m[2].match(/<img[^>]+src="([^"]+)"/i)
    const img = imgM ? (imgM[1].startsWith('http') ? imgM[1] : BASE + imgM[1]) : ''
    if (title) cats.push({ slug: href, name: title, image: img })
  }

  // Category tile links as fallback
  if (!cats.length) {
    const tileRe = /<a[^>]+class="[^"]*c-category-tile[^"]*"[^>]+href="([^"]*\/wynajem\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
    while ((m = tileRe.exec(html)) !== null) {
      const href = m[1]
      if (seen.has(href)) continue
      seen.add(href)
      const titleM = m[2].match(/(?:title|h[23])[^>]*>([^<]+)/i)
      const title = titleM ? titleM[1].trim() : m[2].replace(/<[^>]*>/g, '').trim()
      const imgM = m[2].match(/<img[^>]+src="([^"]+)"/i)
      const img = imgM ? (imgM[1].startsWith('http') ? imgM[1] : BASE + imgM[1]) : ''
      if (title && title.length < 120) cats.push({ slug: href, name: title, image: img })
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

function parseSubcategories(html: string, currentSlug?: string): Array<{ slug: string; name: string; image: string }> {
  const subs: Array<{ slug: string; name: string; image: string }> = []
  const seen = new Set<string>()
  const normCurrent = currentSlug?.replace(/\/$/, '') || ''

  // Links within main content area pointing to /wynajem/
  const linkRe = /<a[^>]+href="([^"]*\/wynajem\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
  let m
  while ((m = linkRe.exec(html)) !== null) {
    // Skip if in header/footer/nav (check 300 chars before)
    const before = html.substring(Math.max(0, m.index - 300), m.index)
    if (/(?:c-header|c-footer|<header|<footer|<nav)/i.test(before)) continue

    const href = m[1]
    const normHref = href.replace(/\/$/, '')
    // Skip current page (self-reference)
    if (normCurrent && normHref === normCurrent) continue
    if (seen.has(href)) continue
    seen.add(href)

    const titleM = m[2].match(/(?:title|h[23]|font-bold)[^>]*>([^<]+)/i)
    const title = titleM ? titleM[1].trim() : m[2].replace(/<[^>]*>/g, ' ').trim().split('\n')[0].trim()
    const imgM = m[2].match(/<img[^>]+src="([^"]+)"/i) || m[2].match(/<source[^>]+srcset="([^"]+)"/i)
    const img = imgM ? (imgM[1].startsWith('http') ? imgM[1] : BASE + imgM[1]) : ''

    if (title && title.length > 1 && title.length < 120) {
      subs.push({ slug: href, name: title, image: img })
    }
  }

  // If we have the current slug, prefer only child links
  if (normCurrent && subs.length > 0) {
    const children = subs.filter(s => s.slug.replace(/\/$/, '').startsWith(normCurrent + '/'))
    if (children.length > 0) return children
  }

  return subs
}

function parseGroupPage(html: string) {
  const result: Record<string, any> = {}

  // Title
  const h1M = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  result.title = h1M ? h1M[1].replace(/<[^>]*>/g, '').trim() : ''

  // Product code
  const codeM = html.match(/text-primary\s+font-bold[^>]*>([^<]+)/i)
  result.code = codeM ? codeM[1].trim() : ''

  // Description — try multiple selectors
  result.description = ''
  // Method 1: class containing "description"
  const descM = html.match(/class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
  if (descM) {
    result.description = descM[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 1000)
  }
  // Method 2: meta description
  if (!result.description) {
    const metaM = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)
    if (metaM) result.description = metaM[1].trim()
  }
  // Method 3: og:description
  if (!result.description) {
    const ogM = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i)
    if (ogM) result.description = ogM[1].trim()
  }

  // Parameters / specs
  result.parameters = []
  const specRe = /c-product-spec__(?:label|name)[^>]*>([^<]+)[\s\S]*?c-product-spec__value[^>]*>([^<]+)/gi
  let specM
  while ((specM = specRe.exec(html)) !== null) {
    const name = specM[1].trim()
    const value = specM[2].trim()
    if (name && value) result.parameters.push({ name, value })
  }
  // Fallback: table rows with th/td
  if (result.parameters.length === 0) {
    const trRe = /<tr[^>]*>\s*<t[hd][^>]*>([^<]+)<\/t[hd]>\s*<t[hd][^>]*>([^<]+)<\/t[hd]>\s*<\/tr>/gi
    let trM
    while ((trM = trRe.exec(html)) !== null) {
      const name = trM[1].trim()
      const value = trM[2].trim()
      if (name && value && name.length < 80 && value.length < 80) result.parameters.push({ name, value })
    }
  }

  // JSON-LD price
  const ldRe = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  let ldm
  while ((ldm = ldRe.exec(html)) !== null) {
    try {
      const ld = JSON.parse(ldm[1])
      if (ld.offers) {
        result.priceBrutto = parseFloat(ld.offers.price) || null
        result.currency = ld.offers.priceCurrency || 'PLN'
      }
      if (ld.brand) result.brand = ld.brand.name || ''
      if (ld.image) result.image = ld.image
    } catch { /* skip */ }
  }

  // Gallery images
  result.images = []
  const galleryRe = /data-jsGalleryItems[^>]*>[\s\S]*?<(?:img|source)[^>]+(?:src|srcset)="([^"]+)"/gi
  let gm
  while ((gm = galleryRe.exec(html)) !== null) {
    const src = gm[1].startsWith('http') ? gm[1] : BASE + gm[1]
    if (!result.images.includes(src)) result.images.push(src)
  }

  // AJAX detail URL
  const ajaxM = html.match(/data-jsLoad="([^"]+)"/i)
  result.detailUrl = ajaxM ? ajaxM[1] : ''

  // Models (product cards)
  result.models = []
  const cardRe = /c-product-card[^>]*>([\s\S]*?)<\/(?:div|article)>\s*(?=<(?:div|article)[^>]*c-product-card|$)/gi
  let crm
  while ((crm = cardRe.exec(html)) !== null) {
    const codeValM = crm[1].match(/jsAddToCompare[^>]+value="([^"]+)"/i)
    const hrefM = crm[1].match(/href="([^"]*\/produkt\/[^"]*)"/)
    const titleM = crm[1].match(/c-product-card__title[^>]*>([^<]+)/i)
    const imgM = crm[1].match(/<img[^>]+src="([^"]+)"/i)

    if (titleM) {
      result.models.push({
        code: codeValM ? codeValM[1] : '',
        slug: hrefM ? hrefM[1] : '',
        name: titleM[1].trim(),
        image: imgM ? (imgM[1].startsWith('http') ? imgM[1] : BASE + imgM[1]) : '',
      })
    }
  }

  result.contactOnly = !result.priceBrutto && !result.priceNetto
  return result
}

function parseProductDetail(html: string) {
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

  // Step 1: Visit homepage for cookies
  await fetchHTML('/', jar)

  // Step 2: POST /konto with AJAX header
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

  // Step 3: Verify via /ajax/init
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

        // Get user info
        const initData = await fetchJSON('/ajax/init', jar)
        const acct = initData?.account || {}

        // Save to DB
        const credentialsData = {
          username,
          password,
          cookies: jar,
          clientId: acct.client_id,
          clientLogin: acct.client_login,
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

          if (insertErr) throw new Error('Failed to save: ' + insertErr.message)
          integrationId = inserted.id
        }

        return json({
          success: true,
          integrationId,
          username: acct.client_login || username,
          clientId: acct.client_id,
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

        // Check if this is a product/group page with models
        const hasModels = html.includes('c-product-card')
        const hasDetailLoad = html.includes('data-jsLoad')

        // First check for subcategories — if they exist, this is a category page even if product cards are present
        const subs = parseSubcategories(html, path)
        const hasChildCategories = subs.length > 0

        if ((hasModels || hasDetailLoad) && !hasChildCategories) {
          const group = parseGroupPage(html)

          // Try AJAX detail for prices
          const detailUrl = group.detailUrl || path
          try {
            const detailRes = await fetchAJAX(detailUrl, jar)
            const detailHtml = await detailRes.text()
            if (detailHtml.length > 100) {
              const detail = parseProductDetail(detailHtml)
              Object.assign(group, detail)
            }
          } catch { /* skip */ }

          return json({ type: 'group', group })
        } else if (hasChildCategories) {
          // Category page with subcategories
          const h1M = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
          const title = h1M ? h1M[1].replace(/<[^>]*>/g, '').trim() : ''
          return json({ type: 'category', title, items: subs })
        } else if (path.startsWith('/produkt/')) {
          // Individual product page
          const group = parseGroupPage(html)
          if (group.detailUrl) {
            try {
              const detailRes = await fetchAJAX(group.detailUrl, jar)
              const detailHtml = await detailRes.text()
              if (detailHtml.length > 100) {
                const detail = parseProductDetail(detailHtml)
                const title = group.title
                Object.assign(group, detail)
                group.title = title
              }
            } catch { /* skip */ }
          }
          return json({ type: 'group', group })
        } else {
          // Category page (no subcategories found, no product cards)
          const fallbackSubs = parseSubcategories(html, path)
          const h1M = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
          const title = h1M ? h1M[1].replace(/<[^>]*>/g, '').trim() : ''
          return json({ type: 'category', title, items: fallbackSubs })
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
        const group = parseGroupPage(html)

        // AJAX detail for prices
        const detailUrl = group.detailUrl || path
        try {
          const detailRes = await fetchAJAX(detailUrl, jar)
          const detailHtml = await detailRes.text()
          if (detailHtml.length > 100) {
            const detail = parseProductDetail(detailHtml)
            Object.assign(group, detail)
          }
        } catch { /* skip */ }

        // Related products
        if (group.groupId) {
          try {
            const connRes = await fetchAJAX(`/ajax/groupsConnections/${group.groupId}`, jar)
            const connHtml = await connRes.text()
            if (connHtml.length > 100) {
              group.related = []
              const cardRe = /<a[^>]+href="([^"]*\/wynajem\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
              let rm
              while ((rm = cardRe.exec(connHtml)) !== null) {
                const titleM = rm[2].match(/c-product-card__title[^>]*>([^<]+)/i)
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

        // Ramirent site search
        const html = await fetchHTML(`/szukaj?q=${encodeURIComponent(q)}`, jar)
        const subs = parseSubcategories(html)
        return json({ products: subs, query: q, total: subs.length })
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
