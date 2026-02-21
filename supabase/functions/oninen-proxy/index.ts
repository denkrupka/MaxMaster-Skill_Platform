import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BASE = 'https://onninen.pl'
const API = BASE + '/api'
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
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'pl-PL,pl;q=0.9',
    'Origin': BASE,
    'Referer': BASE + '/',
  }
  if (jar && Object.keys(jar).length) h['Cookie'] = cookieString(jar)
  return h
}

async function apiGet(path: string, jar?: CookieJar): Promise<any> {
  const url = path.startsWith('http') ? path : API + path
  const res = await fetch(url, { headers: makeHeaders(jar), redirect: 'follow' })
  if (jar) parseCookiesFromHeaders(res.headers, jar)
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  return res.json()
}

async function apiPost(path: string, body: any, jar?: CookieJar): Promise<{ data: any; headers: Headers }> {
  const url = path.startsWith('http') ? path : API + path
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...makeHeaders(jar), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    redirect: 'manual',
  })
  if (jar) parseCookiesFromHeaders(res.headers, jar)
  const data = await res.json().catch(() => null)
  return { data, headers: res.headers }
}

// ═══ 2FA PENDING STATE (stored in DB as temporary integration record) ═══
// Edge functions are stateless — in-memory maps don't persist between calls.
// We store pending 2FA state in wholesaler_integrations with is_active=false
// and a special credentials.pending_2fa=true flag.

async function savePending2fa(
  supabaseAdmin: any,
  tempId: string,
  jar: CookieJar,
  username: string,
  password: string,
  companyId: string,
  wholesalerId: string,
  wholesalerName: string,
  branza: string,
  existingIntegrationId?: string,
): Promise<string> {
  const credentialsData = {
    pending_2fa: true,
    temp_id: tempId,
    username,
    password,
    cookies: jar,
    created_at: new Date().toISOString(),
  }

  if (existingIntegrationId) {
    await supabaseAdmin
      .from('wholesaler_integrations')
      .update({ credentials: credentialsData, is_active: false })
      .eq('id', existingIntegrationId)
    return existingIntegrationId
  }

  const { data: inserted, error } = await supabaseAdmin
    .from('wholesaler_integrations')
    .insert({
      company_id: companyId,
      wholesaler_id: wholesalerId,
      wholesaler_name: wholesalerName,
      branza,
      credentials: credentialsData,
      is_active: false,
    })
    .select('id')
    .single()

  if (error) throw new Error('Failed to save 2FA state: ' + error.message)
  return inserted.id
}

async function loadPending2fa(
  supabaseAdmin: any,
  tempId: string,
): Promise<{ integration: any; jar: CookieJar; username: string; password: string } | null> {
  // Find by temp_id in credentials
  const { data: rows } = await supabaseAdmin
    .from('wholesaler_integrations')
    .select('*')
    .eq('is_active', false)
    .filter('credentials->>pending_2fa', 'eq', 'true')
    .filter('credentials->>temp_id', 'eq', tempId)

  if (!rows || rows.length === 0) return null
  const integration = rows[0]
  const creds = integration.credentials || {}

  // Check TTL (10 min)
  const age = Date.now() - new Date(creds.created_at).getTime()
  if (age > 10 * 60 * 1000) {
    // Expired — delete
    await supabaseAdmin.from('wholesaler_integrations').delete().eq('id', integration.id)
    return null
  }

  return {
    integration,
    jar: creds.cookies || {},
    username: creds.username || '',
    password: creds.password || '',
  }
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

  // If cookies exist and were refreshed recently, reuse
  if (Object.keys(jar).length > 0 && creds.last_refresh) {
    const age = Date.now() - new Date(creds.last_refresh).getTime()
    if (age < SESSION_FRESH_MS) {
      return { jar, integration }
    }
  }

  // Verify cookies still work by hitting a lightweight endpoint
  if (Object.keys(jar).length > 0) {
    try {
      const test = await apiGet('/groups?grouptype=categories', jar)
      if (test && !test.error) {
        await supabaseAdmin
          .from('wholesaler_integrations')
          .update({
            credentials: { ...creds, last_refresh: new Date().toISOString() },
          })
          .eq('id', integrationId)
        return { jar, integration }
      }
    } catch { /* cookies stale */ }
  }

  // Auto-refresh: re-login
  if (creds.username && creds.password) {
    const freshJar: CookieJar = {}
    const { data: loginData } = await apiPost('/login', {
      userName: creds.username,
      password: creds.password,
    }, freshJar)

    if (loginData?.needs2fa || loginData?.error) {
      // Can't auto-refresh with 2FA — return empty
      return { jar: {}, integration }
    }

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

// ═══ PRODUCT MAPPER (shared between products + search) ═══
function mapProduct(p: any) {
  const priceItems = p.price?.items || []
  const priceEnd = priceItems[0]?.priceend ?? null
  const priceCatalog = priceItems[0]?.pricecatalog ?? null

  const avail = p.avail || {}
  const brands = p.brand || []
  const brandName = Array.isArray(brands) && brands.length > 0 ? (brands[0].name || '') : ''

  return {
    name: p.name || '',
    sku: p.index || p.catalogindex || '',
    slug: p.slug || '',
    url: p.slug ? `${BASE}/product/${p.slug}` : '',
    image: p.imagemd || p.imageth || '',
    priceEnd: priceEnd != null ? parseFloat(String(priceEnd)) : null,
    priceCatalog: priceCatalog != null ? parseFloat(String(priceCatalog)) : null,
    stock: avail.quantitydc ?? null,
    stockLocal: avail.quantitylc ?? null,
    dotStatus: avail.dotstatus ?? null,
    availDescription: avail.description || '',
    brand: brandName,
    unit: p.unit || 'szt',
    deliveryTime: p.bestdel?.delivery || '',
  }
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

    const authRequired = ['login', 'login2fa', 'resend2fa', 'logout']
    if (authRequired.includes(action) && !userId) {
      return errorResponse('Authentication required', 401)
    }

    switch (action) {
      // ═══ LOGIN ═══
      case 'login': {
        const { username, password, companyId, wholesalerId, wholesalerName, branza, existingIntegrationId } = body
        if (!username || !password) return errorResponse('Username + password required')

        const jar: CookieJar = {}

        const { data: loginData } = await apiPost('/login', {
          userName: username,
          password,
        }, jar)

        // Check for login error (Onninen returns status: "noaccess")
        if (loginData?.status === 'noaccess') {
          throw new Error(loginData.message || 'Niepoprawne dane logowania')
        }

        // Check for 2FA requirement (Onninen returns type2fa > 0 or status: "2fa"/"sms")
        if (loginData?.type2fa > 0 || loginData?.status === '2fa' || loginData?.status === 'sms' || loginData?.needs2fa) {
          const tempId = crypto.randomUUID()
          await savePending2fa(supabaseAdmin, tempId, jar, username, password, companyId, wholesalerId, wholesalerName, branza, existingIntegrationId)
          return json({
            needs2fa: true,
            tempId,
            message: loginData?.message || 'Kod SMS został wysłany na Twój numer telefonu',
          })
        }

        // Check for other errors
        if (loginData?.error || loginData?.errors) {
          const errMsg = loginData.error || (Array.isArray(loginData.errors) ? loginData.errors.join('; ') : String(loginData.errors))
          throw new Error(errMsg)
        }

        // If status is not "ok" or "success", and not recognized — still might be error
        if (loginData?.status && loginData.status !== 'ok' && loginData.status !== 'success' && loginData.status !== 'logged') {
          if (loginData.message) {
            const tempId = crypto.randomUUID()
            await savePending2fa(supabaseAdmin, tempId, jar, username, password, companyId, wholesalerId, wholesalerName, branza, existingIntegrationId)
            return json({
              needs2fa: true,
              tempId,
              message: loginData.message,
            })
          }
        }

        // Login success — save to DB
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

      // ═══ LOGIN 2FA ═══
      case 'login2fa': {
        const { tempId, code2fa, companyId, wholesalerId, wholesalerName, branza, existingIntegrationId } = body
        if (!tempId || !code2fa) return errorResponse('tempId + code2fa required')

        const pending = await loadPending2fa(supabaseAdmin, tempId)
        if (!pending) return errorResponse('Sesja 2FA wygasła. Zaloguj się ponownie.', 410)

        const { data: loginData } = await apiPost('/login', {
          userName: pending.username,
          password: pending.password,
          code2Fa: code2fa,
          rememberWorkstation: true,
          step: 1,
        }, pending.jar)

        // Check for errors
        if (loginData?.status === 'noaccess') {
          throw new Error(loginData.message || 'Błąd weryfikacji')
        }

        if (loginData?.error || loginData?.errors) {
          const errMsg = loginData.error || (Array.isArray(loginData.errors) ? loginData.errors.join('; ') : String(loginData.errors))
          throw new Error(errMsg)
        }

        // If still needs 2FA (wrong code), keep pending
        if (loginData?.type2fa > 0 || loginData?.status === '2fa' || loginData?.status === 'sms' || loginData?.needs2fa) {
          return json({
            needs2fa: true,
            tempId,
            message: loginData?.message || 'Nieprawidłowy kod. Spróbuj ponownie.',
          })
        }

        // 2FA success — update the same record to active with real credentials
        const credentialsData = {
          username: pending.username,
          password: pending.password,
          cookies: pending.jar,
          last_refresh: new Date().toISOString(),
        }

        await supabaseAdmin
          .from('wholesaler_integrations')
          .update({ credentials: credentialsData, is_active: true })
          .eq('id', pending.integration.id)

        return json({
          success: true,
          integrationId: pending.integration.id,
          username: pending.username,
        })
      }

      // ═══ RESEND 2FA ═══
      case 'resend2fa': {
        const { tempId } = body
        if (!tempId) return errorResponse('tempId required')

        const pending = await loadPending2fa(supabaseAdmin, tempId)
        if (!pending) return errorResponse('Sesja 2FA wygasła. Zaloguj się ponownie.', 410)

        await apiPost('/login', { sendAgainType: true }, pending.jar)

        return json({ success: true, message: 'Kod SMS wysłany ponownie' })
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

        const data = await apiGet('/groups?grouptype=categories', jar)

        // Onninen returns nested tree: {categories: [{slug, name, size, children: [...]}]}
        function mapCat(c: any): any {
          return {
            name: c.name || '',
            slug: c.slug || '',
            image: c.imageurl || '',
            count: c.size || 0,
            subcategories: (c.children || []).map(mapCat),
          }
        }

        const categories = (data?.categories || []).map(mapCat)
        return json({ categories, total: categories.length })
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

        // Onninen uses 0-indexed pages, frontend uses 1-indexed
        const slug = cat.startsWith('/') ? cat : '/' + cat
        const apiPage = Math.max(0, page - 1)
        const data = await apiGet(`/search?query=${encodeURIComponent(slug)}&page=${apiPage}`, jar)

        // Products are nested: data.items[0].items[]
        const wrapper = (data?.items || [])[0] || {}
        const rawProducts: any[] = wrapper.items || []

        const products = rawProducts.map((p: any) => mapProduct(p))

        const totalProducts = data?.total || wrapper.total || products.length
        const lastPage = data?.lastpage ?? 0
        const totalPages = lastPage + 1 // lastpage is 0-indexed

        return json({ products, page, totalPages, totalProducts, source: Object.keys(jar).length > 0 ? 'personal' : 'public' })
      }

      // ═══ SEARCH ═══
      case 'search': {
        const { integrationId, q, page = 1 } = body
        if (!q) return errorResponse('Missing q')

        let jar: CookieJar = {}
        if (integrationId) {
          try {
            const session = await getIntegrationSession(supabaseAdmin, integrationId)
            jar = session.jar
          } catch { /* anonymous */ }
        }

        const apiPage = Math.max(0, page - 1)
        const data = await apiGet(`/search?query=${encodeURIComponent(q.trim())}&page=${apiPage}`, jar)

        // Products are nested: data.items[0].items[]
        const wrapper = (data?.items || [])[0] || {}
        const rawProducts: any[] = wrapper.items || []

        const products = rawProducts.map((p: any) => mapProduct(p))

        const totalProducts = data?.total || wrapper.total || products.length

        return json({ products, query: q, total: totalProducts, source: Object.keys(jar).length > 0 ? 'personal' : 'public' })
      }

      // ═══ PRODUCT DETAIL ═══
      case 'product': {
        const { integrationId, slug: productSlug } = body
        if (!productSlug) return errorResponse('Missing slug')

        let jar: CookieJar = {}
        if (integrationId) {
          try {
            const session = await getIntegrationSession(supabaseAdmin, integrationId)
            jar = session.jar
          } catch { /* anonymous */ }
        }

        const data = await apiGet(`/card?slug=${encodeURIComponent(productSlug)}`, jar)

        // Product data is in data.card, with ext for extended info
        const p = data?.card || {}
        const ext = p.ext || {}

        const priceItems = p.price?.items || []
        const priceEnd = priceItems[0]?.priceend ?? null
        const priceCatalog = priceItems[0]?.pricecatalog ?? null

        const avail = p.avail || {}

        const brands = p.brand || []
        const brandName = Array.isArray(brands) && brands.length > 0 ? brands[0].name || '' : ''

        // Attributes from ext.attributes
        const rawAttrs = ext.attributes || []
        const specs = rawAttrs.map((a: any) => ({ name: a.name || '', value: String(a.value ?? '') }))

        // Images from ext.images
        const extImages = (ext.images || []).map((img: any) => img.imageurl || img.imageurl_m || '')

        // Category path from data.categorypath
        const catPath = (data?.categorypath || []).map((c: any) => c.name).join(' > ')

        // Description from ext
        const description = ext.description || ext.descriptionsales || ''

        // EAN from ext.barcodes
        const barcodes = ext.barcodes || []
        const ean = barcodes.length > 0 ? (barcodes[0].value || barcodes[0]) : ''

        const product = {
          name: p.name || '',
          sku: p.index || p.catalogindex || '',
          slug: productSlug,
          url: `${BASE}/product/${p.slug || productSlug}`,
          image: extImages[0] || p.imagemd || p.imageth || '',
          images: extImages,
          priceEnd: priceEnd != null ? parseFloat(String(priceEnd)) : null,
          priceCatalog: priceCatalog != null ? parseFloat(String(priceCatalog)) : null,
          stock: avail.quantitydc ?? null,
          stockLocal: avail.quantitylc ?? null,
          dotStatus: avail.dotstatus ?? null,
          availDescription: avail.description || '',
          brand: brandName,
          unit: p.unit || 'szt',
          ean: typeof ean === 'string' ? ean : '',
          description,
          specs,
          deliveryTime: p.bestdel?.delivery || '',
          deliveryCost: p.bestdel?.cost || '',
          category: catPath,
        }

        return json({ product, source: Object.keys(jar).length > 0 ? 'personal' : 'public' })
      }

      default:
        return errorResponse(`Unknown action: ${action}`)
    }
  } catch (error) {
    const msg = (error as Error).message || String(error)
    const stack = (error as Error).stack || ''
    console.error('oninen-proxy error:', msg, stack)
    return new Response(
      JSON.stringify({ error: msg, _stack: stack.split('\n').slice(0, 3).join(' | ') }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
