import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BASE = 'https://www.tim.pl'
const GQL = BASE + '/api/v1/graphql'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'

// ═══ COOKIE JAR (simple Record-based) ═══
type CookieJar = Record<string, string>

function parseCookiesFromHeaders(headers: Headers, jar: CookieJar): void {
  // Deno supports getSetCookie() on Headers
  const setCookies = (headers as any).getSetCookie?.() || []
  for (const h of setCookies) {
    const parts = h.split(';')[0].split('=')
    const name = parts[0].trim()
    const value = parts.slice(1).join('=').trim()
    if (name) jar[name] = value
  }
  // Fallback: parse from raw set-cookie header
  if (setCookies.length === 0) {
    const raw = headers.get('set-cookie') || ''
    if (raw) {
      // May contain multiple cookies comma-separated (non-standard) or single
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
    'Accept': '*/*',
    'Accept-Language': 'pl-PL,pl;q=0.9',
    'Origin': BASE,
    'Referer': BASE + '/',
  }
  if (jar && Object.keys(jar).length) h['Cookie'] = cookieString(jar)
  return h
}

async function fetchPage(path: string, jar?: CookieJar): Promise<string> {
  const url = path.startsWith('http') ? path : BASE + path
  const headers = { ...makeHeaders(jar), 'Accept': 'text/html,*/*' }
  const res = await fetch(url, { headers, redirect: 'follow' })
  if (jar) parseCookiesFromHeaders(res.headers, jar)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

async function gqlPost(operationName: string, query: string, variables: Record<string, any>, jar?: CookieJar): Promise<any> {
  const headers: Record<string, string> = { ...makeHeaders(jar), 'Content-Type': 'application/json' }
  const url = operationName ? `${GQL}?ton=${operationName}` : GQL
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ operationName: operationName || undefined, query, variables }),
  })
  if (jar) parseCookiesFromHeaders(res.headers, jar)
  const data = await res.json()
  if (data.errors) throw new Error(data.errors.map((e: any) => e.message).join('; '))
  return data.data
}

function extractSku(url: string): string {
  const m = (url || '').match(/\/p\/([^\s?#]+)/)
  return m ? m[1] : ''
}

// Regex-based JSON-LD extraction (no cheerio)
function extractJsonLd(html: string): any[] {
  const results: any[] = []
  const re = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    try { results.push(JSON.parse(m[1])) } catch { /* skip malformed */ }
  }
  return results
}

// Regex-based link extraction for categories (no cheerio)
function extractLinks(html: string): Array<{ href: string; text: string }> {
  const links: Array<{ href: string; text: string }> = []
  const re = /<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const href = m[1]
    const text = m[2].replace(/<[^>]*>/g, '').trim().replace(/\s+/g, ' ')
    if (href && text) links.push({ href, text })
  }
  return links
}

// Extract pagination links
function extractMaxPage(html: string): number {
  let maxPage = 1
  const re = /[?&]page=(\d+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const pg = parseInt(m[1])
    if (pg > maxPage) maxPage = pg
  }
  return maxPage
}

// ═══ GQL QUERIES ═══
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
}`

// ═══ AUTH FLOW (4-step TIM login) ═══
async function doLogin(username: string, password: string): Promise<{ jar: CookieJar; formKey: string; gqlWorks: boolean; customerEmail: string }> {
  const jar: CookieJar = {}

  // Step 1: Homepage cookies
  const homeRes = await fetch(BASE + '/', {
    headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*' },
    redirect: 'follow',
  })
  parseCookiesFromHeaders(homeRes.headers, jar)

  let formKey = jar['form_key'] || ''
  if (!formKey) {
    const html = await homeRes.text()
    const fkMatch = html.match(/form_key['":\s]+['"]([a-zA-Z0-9]{8,32})['"]/)
    if (fkMatch) formKey = fkMatch[1]
    else {
      const nfkMatch = html.match(/formKey['":\s]+['"]([a-zA-Z0-9]{8,32})['"]/)
      if (nfkMatch) formKey = nfkMatch[1]
    }
  }

  if (!formKey) {
    // Generate random form_key
    const buf = new Uint8Array(12)
    crypto.getRandomValues(buf)
    formKey = Array.from(buf).map(b => b.toString(36)).join('').substring(0, 16)
  }

  // Step 2: POST /nuxt-api/auth/login
  const loginRes = await fetch(BASE + '/nuxt-api/auth/login?farv=2', {
    method: 'POST',
    headers: {
      'User-Agent': UA, 'Content-Type': 'application/json',
      'Accept': 'application/json', 'Origin': BASE, 'Referer': BASE + '/',
      'Cookie': cookieString(jar),
    },
    body: JSON.stringify({
      username: encodeURIComponent(username),
      password: encodeURIComponent(password),
      form_key: formKey, rememberme: true,
    }),
    redirect: 'manual',
  })
  parseCookiesFromHeaders(loginRes.headers, jar)

  const loginData = await loginRes.json().catch(() => null)

  if (loginData?.login?.content?.formKey) {
    formKey = loginData.login.content.formKey
    jar['form_key'] = formKey
  }
  if (loginData?.formKey || loginData?.form_key) {
    formKey = loginData.formKey || loginData.form_key
    jar['form_key'] = formKey
  }

  // Check for login errors
  const notifications = loginData?.login?.notifications || loginData?.login?.content?.notifications || []
  if (Array.isArray(notifications) && notifications.length) {
    const errMsgs = notifications.filter((n: any) => n.type === 'error').map((n: any) => n.text || n.message).join('; ')
    if (errMsgs) throw new Error(errMsgs)
  }

  // Step 3: POST /nuxt-api/auth/customer
  const custRes = await fetch(BASE + '/nuxt-api/auth/customer', {
    method: 'POST',
    headers: {
      'User-Agent': UA, 'Accept': 'application/json',
      'Content-Type': 'application/json', 'Origin': BASE,
      'Cookie': cookieString(jar),
    },
    body: '{}',
  })
  parseCookiesFromHeaders(custRes.headers, jar)

  const custData = await custRes.json().catch(() => null)
  const customerEmail = custData?.customer?.email || custData?.email || ''

  if (custData?.formKey || custData?.form_key) {
    formKey = custData.formKey || custData.form_key
    jar['form_key'] = formKey
  }

  // Step 4: Test GraphQL
  let gqlWorks = false
  try {
    const data = await gqlPost('multiplePricesAndStocks', Q_PRICES, { skuList: ['0001-00001-08602'] }, jar)
    const products = data?.productsArea?.products?.edges || []
    if (products.length) gqlWorks = true
  } catch { /* GQL not available */ }

  return { jar, formKey, gqlWorks, customerEmail }
}

// Fetch personal prices via GQL in batches
async function fetchPersonalPrices(skuList: string[], jar: CookieJar): Promise<Map<string, any>> {
  const prices = new Map<string, any>()
  for (let i = 0; i < skuList.length; i += 20) {
    const batch = skuList.slice(i, i + 20)
    try {
      const data = await gqlPost('multiplePricesAndStocks', Q_PRICES, { skuList: batch }, jar)
      const edges = data?.productsArea?.products?.edges || []
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
          })
        }
      }
    } catch { /* batch error, continue */ }
  }
  return prices
}

// ═══ Helper: load integration from DB, refresh cookies if stale ═══
const SESSION_FRESH_MS = 30 * 60 * 1000 // 30 min — skip GQL test if refreshed recently

async function getIntegrationSession(
  supabaseAdmin: any,
  integrationId: string
): Promise<{ jar: CookieJar; gqlWorks: boolean; integration: any }> {
  const { data: integration, error } = await supabaseAdmin
    .from('wholesaler_integrations')
    .select('*')
    .eq('id', integrationId)
    .single()

  if (error || !integration) throw new Error('Integration not found')

  const creds = integration.credentials || {}
  let jar: CookieJar = creds.cookies || {}
  let gqlWorks = creds.gql_works || false

  // If cookies exist and were refreshed recently, skip the GQL test
  if (Object.keys(jar).length > 0 && creds.last_refresh) {
    const age = Date.now() - new Date(creds.last_refresh).getTime()
    if (age < SESSION_FRESH_MS) {
      return { jar, gqlWorks, integration }
    }
  }

  // Cookies exist but old — verify with a GQL test
  if (Object.keys(jar).length > 0) {
    try {
      const data = await gqlPost('multiplePricesAndStocks', Q_PRICES, { skuList: ['0001-00001-08602'] }, jar)
      if (data?.productsArea?.products?.edges?.length) {
        // Update last_refresh so subsequent calls skip the test
        await supabaseAdmin
          .from('wholesaler_integrations')
          .update({
            credentials: { ...creds, gql_works: true, last_refresh: new Date().toISOString() },
          })
          .eq('id', integrationId)
        return { jar, gqlWorks: true, integration }
      }
    } catch { /* cookies stale, need refresh */ }
  }

  // Auto-refresh: re-login using stored credentials
  if (creds.username && creds.password) {
    const result = await doLogin(creds.username, creds.password)
    jar = result.jar
    gqlWorks = result.gqlWorks

    // Save refreshed cookies to DB
    await supabaseAdmin
      .from('wholesaler_integrations')
      .update({
        credentials: {
          ...creds,
          cookies: jar,
          gql_works: gqlWorks,
          last_refresh: new Date().toISOString(),
        },
      })
      .eq('id', integrationId)

    return { jar, gqlWorks, integration }
  }

  // No credentials to refresh with — return empty session
  return { jar: {}, gqlWorks: false, integration }
}

// ═══ RESPONSE HELPER ═══
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

    // Verify user JWT (soft — some actions work without auth)
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

    // Actions that modify data require authentication
    const authRequired = ['login', 'logout']
    if (authRequired.includes(action) && !userId) {
      return errorResponse('Authentication required', 401)
    }

    switch (action) {
      // ═══ LOGIN ═══
      case 'login': {
        const { username, password, companyId, wholesalerId, wholesalerName, branza, existingIntegrationId } = body

        if (!username || !password) return errorResponse('Username + password required')

        // Perform TIM login
        const result = await doLogin(username, password)

        const credentialsData = {
          username: result.customerEmail || username,
          password,
          cookies: result.jar,
          gql_works: result.gqlWorks,
          last_refresh: new Date().toISOString(),
        }

        // Upsert integration record
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

        const success = result.gqlWorks || Object.keys(result.jar).length > 3
        return json({
          success,
          integrationId,
          username: result.customerEmail || username,
          gqlEnabled: result.gqlWorks,
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
          const { jar, gqlWorks, integration } = await getIntegrationSession(supabaseAdmin, integrationId)
          const hasCookies = Object.keys(jar).length > 0
          return json({
            authenticated: hasCookies,
            username: integration.credentials?.username,
            gqlWorks,
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
          } catch { /* use anonymous */ }
        }

        const html = await fetchPage('/', jar)
        const links = extractLinks(html)

        const skip = new Set(['centrum-pomocy', 'kategorie', 'producenci', 'promocje', 'strefa-nowosci', 'strefa-porad', 'centrum-uslug', 'kontakt', 'najnowsze-produkty', 'strefa-dla-przemyslu', 'outlet', 'koszyk-rwd', 'warunki-i-koszty-dostawy', 'regulamin-opinii', 'mapa-serwisu', 'zostan-sprzedawca', 'mapa_serwisu', 'zostan_sprzedawca', 'mapa-serwisu.html', 'zostan-sprzedawca.html'])
        const skipNames = new Set(['Mapa serwisu', 'Zostań sprzedawcą', 'Warunki i koszty dostawy', 'Regulamin opinii', 'Centrum pomocy', 'Kontakt', 'Koszyk'])

        const mainCats: Array<{ name: string; slug: string }> = []
        const subMap: Record<string, Array<{ name: string; slug: string }>> = {}
        const ssubMap: Record<string, Array<{ name: string; slug: string }>> = {}

        for (const { href, text } of links) {
          if (!href.startsWith('/') || href === '/' || !text || text.length < 2 || text.length > 80) continue
          if (href.includes('.') || href.includes('?') || href.startsWith('/_')) continue
          const parts = href.split('/').filter(Boolean)

          if (parts.length === 1 && !skip.has(parts[0]) && !skipNames.has(text) && !mainCats.find(c => c.slug === href)) {
            mainCats.push({ name: text, slug: href })
          } else if (parts.length === 2) {
            const p = '/' + parts[0]
            if (!subMap[p]) subMap[p] = []
            if (!subMap[p].find(c => c.slug === href)) subMap[p].push({ name: text, slug: href })
          } else if (parts.length === 3) {
            const p = '/' + parts[0] + '/' + parts[1]
            if (!ssubMap[p]) ssubMap[p] = []
            if (!ssubMap[p].find(c => c.slug === href)) ssubMap[p].push({ name: text, slug: href })
          }
        }

        const tree = mainCats
          .filter(c => !skip.has(c.slug.replace('/', '')) && !skipNames.has(c.name))
          .map(c => ({
            ...c,
            subcategories: (subMap[c.slug] || []).map(s => ({
              ...s,
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
        let gqlWorks = false
        if (integrationId) {
          try {
            const session = await getIntegrationSession(supabaseAdmin, integrationId)
            jar = session.jar
            gqlWorks = session.gqlWorks
          } catch { /* anonymous */ }
        }

        const pagePath = (cat.startsWith('/') ? cat : '/' + cat) + (page > 1 ? `?page=${page}` : '')
        const html = await fetchPage(pagePath, jar)
        const jsonLdList = extractJsonLd(html)

        let products: any[] = []
        for (const ld of jsonLdList) {
          if (ld['@type'] === 'ItemList' && ld.itemListElement) {
            products = ld.itemListElement.map((item: any) => {
              const p = item.item || item
              return {
                name: p.name || '',
                sku: extractSku(p.url || ''),
                url: p.url || '',
                image: Array.isArray(p.image) ? p.image[0] : (p.image || ''),
                price: p.offers?.price ? parseFloat(p.offers.price) : null,
                rating: p.aggregateRating?.ratingValue || null,
              }
            })
            break
          }
        }

        // HTML fallback: extract product links when JSON-LD is missing
        if (products.length === 0) {
          const seen = new Set<string>()
          const linkRe = /<a\s[^>]*href="(\/p\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
          let lm: RegExpExecArray | null
          while ((lm = linkRe.exec(html)) !== null) {
            const href = lm[1]
            const psku = extractSku(href)
            if (!psku || seen.has(psku)) continue
            seen.add(psku)
            const text = lm[2].replace(/<[^>]*>/g, '').trim().replace(/\s+/g, ' ')
            if (text.length < 3 || text.length > 200) continue
            products.push({ name: text, sku: psku, url: BASE + href, image: '', price: null })
          }
        }

        // Fetch personal prices via GraphQL
        const skuList = products.map((p: any) => p.sku).filter(Boolean)
        let source = 'public'

        if (gqlWorks && skuList.length) {
          const personalPrices = await fetchPersonalPrices(skuList, jar)
          if (personalPrices.size) {
            source = 'personal'
            for (const p of products) {
              const pp = personalPrices.get(p.sku)
              if (pp) {
                p.publicPrice = p.price
                p.price = pp.netValue
                p.grossPrice = pp.grossValue
                p.stock = pp.stock
                p.unit = pp.unit
                p.stockColor = pp.stockColor
                p.shippingText = pp.shippingText
              }
            }
          }
        }

        const totalPages = extractMaxPage(html)

        return json({ products, page, totalPages, totalProducts: products.length, source })
      }

      // ═══ PRODUCT DETAIL ═══
      case 'product': {
        const { integrationId, url, sku: inputSku } = body
        const sku = inputSku || extractSku(url || '')
        if (!url && !sku) return errorResponse('Need url or sku')

        let jar: CookieJar = {}
        let gqlWorks = false
        if (integrationId) {
          try {
            const session = await getIntegrationSession(supabaseAdmin, integrationId)
            jar = session.jar
            gqlWorks = session.gqlWorks
          } catch { /* anonymous */ }
        }

        let product: any = {}
        let source = 'public'

        if (url) {
          const html = await fetchPage(url, jar)
          const jsonLdList = extractJsonLd(html)

          let ldProduct: any = null
          for (const ld of jsonLdList) {
            if (ld['@type'] === 'Product') { ldProduct = ld; break }
          }

          // NUXT data extraction via regex
          let manufacturer = '', ref_num = '', ean = '', series = '', description = ''
          const nuxtMatch = html.match(/<script\s+id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
          if (nuxtMatch) {
            const raw = nuxtMatch[1]
            const ex = (pat: RegExp) => { const m = raw.match(pat); return m ? m[1] : '' }
            manufacturer = ex(/"manufacturer_name"[^"]*?"([^"]{2,60})"/) || ex(/"manufacturer"[^}]*?"name"[^"]*?"([^"]{2,60})"/)
            ref_num = ex(/"ref_num"[^"]*?"([^"]+)"/)
            ean = ex(/"ean"[^"]*?"(\d{8,16})"/)
            series = ex(/"series_name"[^"]*?"([^"]+)"/) || ex(/"series"[^}]*?"name"[^"]*?"([^"]+)"/)
          }

          // Manufacturer fallback from JSON-LD
          if (!manufacturer && ldProduct?.brand?.name) {
            manufacturer = ldProduct.brand.name
          }
          if (!manufacturer && ldProduct?.manufacturer?.name) {
            manufacturer = ldProduct.manufacturer.name
          }

          // EAN fallback from JSON-LD
          if (!ean && ldProduct?.gtin13) ean = ldProduct.gtin13

          // Description: try product description div first, then meta, then JSON-LD
          const descDiv = html.match(/<div[^>]*class="[^"]*product-description[^"]*"[^>]*>([\s\S]*?)<\/div>/)
            || html.match(/<div[^>]*class="[^"]*description[^"]*"[^>]*data-v-[^>]*>([\s\S]*?)<\/div>/)
            || html.match(/<div[^>]*id="product-description"[^>]*>([\s\S]*?)<\/div>/)
          const metaDesc = html.match(/<meta\s+name="description"\s+content="([^"]*)"/)
            || html.match(/<meta\s+content="([^"]*)"\s+name="description"/)
          if (descDiv && descDiv[1].trim().length > 20) {
            description = descDiv[1].trim()
          } else if (ldProduct?.description && ldProduct.description.length > 20) {
            description = ldProduct.description
          } else if (metaDesc && metaDesc[1].length > 20) {
            description = metaDesc[1]
          } else {
            description = ldProduct?.description || metaDesc?.[1] || ''
          }

          // Technical specs from JSON-LD additionalProperty
          let specs: Array<{ name: string; value: string }> = []
          if (ldProduct?.additionalProperty && Array.isArray(ldProduct.additionalProperty)) {
            specs = ldProduct.additionalProperty
              .filter((p: any) => p?.name && p?.value != null)
              .map((p: any) => ({ name: p.name, value: String(p.value) }))
          }

          // Breadcrumb from JSON-LD
          let breadcrumb = ''
          for (const ld of jsonLdList) {
            if (ld['@type'] === 'BreadcrumbList') {
              breadcrumb = ld.itemListElement.map((b: any) => b.name).join(' > ')
            }
          }

          // Product name from JSON-LD or <h1>
          let name = ldProduct?.name || ''
          if (!name) {
            const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)
            if (h1Match) name = h1Match[1].replace(/<[^>]*>/g, '').trim()
          }

          // Image: JSON-LD image (handles ImageObject with contentUrl) → og:image
          let image = ''
          if (ldProduct?.image) {
            const imgEntry = Array.isArray(ldProduct.image) ? ldProduct.image[0] : ldProduct.image
            if (typeof imgEntry === 'string') {
              image = imgEntry
            } else if (imgEntry?.contentUrl) {
              image = imgEntry.contentUrl
            } else if (imgEntry?.url) {
              image = imgEntry.url
            }
          }
          if (!image) {
            const ogImg = html.match(/<meta\s+[^>]*property="og:image"[^>]*content="([^"]*)"/)
              || html.match(/<meta\s+content="([^"]*)"[^>]*property="og:image"/)
            if (ogImg) image = ogImg[1]
          }

          product = {
            sku: sku || extractSku(url),
            name,
            price: ldProduct?.offers?.price ? parseFloat(ldProduct.offers.price) : null,
            image,
            url, manufacturer, ref_num, ean, series, description,
            specs,
            mpn: ldProduct?.mpn || '',
            color: ldProduct?.color || '',
            material: ldProduct?.material || '',
            rating: ldProduct?.aggregateRating?.ratingValue || null,
            reviewCount: ldProduct?.aggregateRating?.reviewCount || null,
            breadcrumb,
          }
        }

        // Personal price via GQL
        const targetSku = sku || product.sku
        if (gqlWorks && targetSku) {
          const personalPrices = await fetchPersonalPrices([targetSku], jar)
          const pp = personalPrices.get(targetSku)
          if (pp) {
            product.publicPrice = product.price
            product.price = pp.netValue
            product.grossPrice = pp.grossValue
            product.stock_qty = pp.stock
            product.unit = pp.unit
            product.stockColor = pp.stockColor
            product.shippingText = pp.shippingText
            source = 'personal'
          }
        }

        return json({ product, source })
      }

      // ═══ SEARCH (via REST API rwd/search/) ═══
      case 'search': {
        const { integrationId, q, page = 1, limit = 24 } = body
        if (!q) return errorResponse('Missing q')

        let jar: CookieJar = {}
        let gqlWorks = false
        if (integrationId) {
          try {
            const session = await getIntegrationSession(supabaseAdmin, integrationId)
            jar = session.jar
            gqlWorks = session.gqlWorks
          } catch (sessErr) {
            console.error('tim-proxy search: session load failed:', (sessErr as Error).message)
          }
        }

        // If no session cookies, pre-fetch TIM homepage to get WAF/session cookies
        // This is critical: TIM blocks /rwd/search/ requests without valid session cookies
        if (Object.keys(jar).length === 0) {
          try {
            const homeRes = await fetch(BASE + '/', {
              headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*' },
              redirect: 'follow',
            })
            parseCookiesFromHeaders(homeRes.headers, jar)
            // Consume body to free connection
            await homeRes.text()
          } catch (e) {
            console.error('tim-proxy search: homepage prefetch failed:', (e as Error).message)
          }
        }

        // Search via /rwd/search/ REST API with retries
        const searchParams = new URLSearchParams({
          q: q.trim(),
          p: String(page),
          limit: String(limit),
        })

        let searchData: any = null
        const maxRetries = 3

        for (let attempt = 0; attempt < maxRetries; attempt++) {
          if (attempt > 0) {
            await new Promise(r => setTimeout(r, 1000 * attempt))
          }
          try {
            const searchUrl = `${BASE}/rwd/search/?${searchParams}`
            const hdrs: Record<string, string> = {
              ...makeHeaders(jar),
              'Accept': 'application/json, text/javascript, */*; q=0.01',
              'X-Requested-With': 'XMLHttpRequest',
              'Sec-Fetch-Dest': 'empty',
              'Sec-Fetch-Mode': 'cors',
              'Sec-Fetch-Site': 'same-origin',
            }
            const res = await fetch(searchUrl, { headers: hdrs, redirect: 'follow' })
            parseCookiesFromHeaders(res.headers, jar)

            if (res.status === 503 || res.status === 429) {
              console.error(`tim-proxy search: TIM ${res.status}, attempt ${attempt + 1}/${maxRetries}`)
              await res.text() // consume body
              continue
            }

            const txt = await res.text()
            try {
              searchData = JSON.parse(txt)
              break
            } catch {
              console.error(`tim-proxy search: non-JSON (${res.status}), attempt ${attempt + 1}`)
              // On last attempt, try Fact-Finder fallback below
            }
          } catch (e) {
            console.error(`tim-proxy search: fetch error attempt ${attempt + 1}:`, (e as Error).message)
          }
        }

        // Fallback: try Fact-Finder search API (may work from some edge locations)
        if (!searchData) {
          try {
            const ffUrl = `https://timsa.fact-finder.pl/FACT-Finder/Search.ff?channel=TIM-2025&query=${encodeURIComponent(q.trim())}&page=${page}&productsPerPage=${limit}&format=JSON`
            const ffRes = await fetch(ffUrl, {
              headers: { 'Accept': 'application/json', 'Origin': BASE, 'Referer': BASE + '/' },
            })
            if (ffRes.ok) {
              const ffData = await ffRes.json()
              // Fact-Finder returns records in searchResult.records
              const records = ffData?.searchResult?.records || []
              if (records.length > 0) {
                searchData = {
                  product: records.map((r: any) => ({
                    _source: {
                      name: r.record?.Name || r.record?.name || '',
                      sku: r.record?.ProductNumber || r.record?.sku || r.id || '',
                      productLink: r.record?.Deeplink || r.record?.deeplink || '',
                      imageLink: r.record?.ImageUrl || r.record?.image || '',
                      price: r.record?.Price ? parseFloat(r.record.Price) : null,
                      manufacturer: r.record?.Manufacturer || r.record?.manufacturer || '',
                    }
                  })),
                  total: ffData?.searchResult?.resultCount || records.length,
                }
              }
            } else {
              console.error('tim-proxy search: Fact-Finder returned', ffRes.status)
            }
          } catch (ffErr) {
            console.error('tim-proxy search: Fact-Finder fallback failed:', (ffErr as Error).message)
          }
        }

        if (!searchData) {
          return json({ products: [], query: q, total: 0, source: 'public', debug: 'All search methods failed (rwd + fact-finder)' })
        }
        const rawProducts = searchData?.product || []
        const totalProducts = searchData?.total || 0

        let products: any[] = rawProducts.map((item: any) => {
          const s = item._source || item
          const imgPath = s.imageLink || ''
          return {
            name: s.name || '',
            sku: s.sku || item._id || '',
            url: s.productLink ? BASE + s.productLink : '',
            image: imgPath ? (imgPath.startsWith('http') ? imgPath : BASE + imgPath) : '',
            price: s.price || null,
            publicPrice: s.price || null,
            manufacturer: s.manufacturer || '',
            stock: s.stock ?? null,
            ean: s.ean || '',
          }
        })

        // Enrich with personal prices via GraphQL
        let source = 'public'
        const skuList = products.map((p: any) => p.sku).filter(Boolean)
        if (gqlWorks && skuList.length) {
          const pp = await fetchPersonalPrices(skuList, jar)
          if (pp.size) {
            source = 'personal'
            for (const p of products) {
              const price = pp.get(p.sku)
              if (price) {
                p.publicPrice = p.price
                p.price = price.netValue
                p.stock = price.stock
                p.unit = price.unit
                p.stockColor = price.stockColor
                p.shippingText = price.shippingText
              }
            }
          }
        }

        return json({ products, query: q, total: totalProducts, source })
      }

      default:
        return errorResponse(`Unknown action: ${action}`)
    }
  } catch (error) {
    const msg = (error as Error).message || String(error)
    const stack = (error as Error).stack || ''
    console.error('tim-proxy error:', msg, stack)
    return new Response(
      JSON.stringify({ error: msg, _stack: stack.split('\n').slice(0, 3).join(' | ') }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
