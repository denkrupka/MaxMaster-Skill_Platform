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

// ═══ 2FA PENDING STATE (in-memory, 10min TTL) ═══
interface PendingLogin {
  jar: CookieJar
  username: string
  password: string
  createdAt: number
}
const pending2fa = new Map<string, PendingLogin>()
const PENDING_TTL = 10 * 60 * 1000

function cleanPending() {
  const now = Date.now()
  for (const [id, p] of pending2fa) {
    if (now - p.createdAt > PENDING_TTL) pending2fa.delete(id)
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

        cleanPending()
        const jar: CookieJar = {}

        const { data: loginData } = await apiPost('/login', {
          userName: username,
          password,
        }, jar)

        // Check for 2FA requirement
        if (loginData?.needs2fa || loginData?.twoFactorRequired || loginData?.step === 'sms') {
          const tempId = crypto.randomUUID()
          pending2fa.set(tempId, { jar, username, password, createdAt: Date.now() })
          return json({
            needs2fa: true,
            tempId,
            message: loginData?.message || 'Kod SMS został wysłany na Twój numer telefonu',
          })
        }

        // Check for login error
        if (loginData?.error || loginData?.errors) {
          const errMsg = loginData.error || (Array.isArray(loginData.errors) ? loginData.errors.join('; ') : String(loginData.errors))
          throw new Error(errMsg)
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

        cleanPending()
        const pending = pending2fa.get(tempId)
        if (!pending) return errorResponse('2FA session expired. Please login again.', 410)

        const { data: loginData } = await apiPost('/login', {
          code2Fa: code2fa,
          rememberWorkstation: true,
          step: 1,
        }, pending.jar)

        if (loginData?.error || loginData?.errors) {
          const errMsg = loginData.error || (Array.isArray(loginData.errors) ? loginData.errors.join('; ') : String(loginData.errors))
          throw new Error(errMsg)
        }

        // If still needs 2FA (wrong code), keep pending
        if (loginData?.needs2fa || loginData?.twoFactorRequired) {
          return json({
            needs2fa: true,
            tempId,
            message: 'Nieprawidłowy kod. Spróbuj ponownie.',
          })
        }

        // 2FA success — save to DB
        const credentialsData = {
          username: pending.username,
          password: pending.password,
          cookies: pending.jar,
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

        pending2fa.delete(tempId)

        return json({
          success: true,
          integrationId,
          username: pending.username,
        })
      }

      // ═══ RESEND 2FA ═══
      case 'resend2fa': {
        const { tempId } = body
        if (!tempId) return errorResponse('tempId required')

        const pending = pending2fa.get(tempId)
        if (!pending) return errorResponse('2FA session expired. Please login again.', 410)

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

        // Onninen returns flat list of categories with parentId
        // Build a tree structure
        const items: any[] = Array.isArray(data) ? data : (data?.items || data?.groups || data?.categories || [])

        interface CatNode {
          id: string
          name: string
          slug: string
          parentId?: string
          subcategories: CatNode[]
        }

        const nodeMap = new Map<string, CatNode>()
        const roots: CatNode[] = []

        for (const item of items) {
          const node: CatNode = {
            id: item.id || item.groupId || '',
            name: item.name || item.title || '',
            slug: item.slug || item.urlSlug || item.url || item.id || '',
            parentId: item.parentId || item.parentGroupId || null,
            subcategories: [],
          }
          nodeMap.set(node.id, node)
        }

        for (const node of nodeMap.values()) {
          if (node.parentId && nodeMap.has(node.parentId)) {
            nodeMap.get(node.parentId)!.subcategories.push(node)
          } else {
            roots.push(node)
          }
        }

        return json({ categories: roots, total: roots.length })
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

        const slug = cat.startsWith('/') ? cat.substring(1) : cat
        const data = await apiGet(`/search?query=/${slug}&page=${page}`, jar)

        const rawProducts = data?.products || data?.items || data?.results || []
        const products = rawProducts.map((p: any) => {
          const priceItems = p.price?.items || p.prices || []
          const priceEnd = priceItems[0]?.priceend ?? priceItems[0]?.priceEnd ?? p.priceEnd ?? p.price?.priceEnd ?? null
          const priceCatalog = priceItems[0]?.pricecatalog ?? priceItems[0]?.priceCatalog ?? p.priceCatalog ?? p.price?.priceCatalog ?? null

          const avail = p.avail || p.availability || {}
          const stockDc = avail.quantitydc ?? avail.quantityDc ?? avail.quantity ?? null
          const stockLocal = avail.quantitylocal ?? avail.quantityLocal ?? null

          const brands = p.brand || p.brands || []
          const brandName = Array.isArray(brands) && brands.length > 0
            ? (brands[0].name || brands[0])
            : (typeof brands === 'string' ? brands : '')

          return {
            name: p.name || p.title || '',
            sku: p.sku || p.productCode || p.code || '',
            slug: p.slug || p.urlSlug || '',
            url: p.slug ? `${BASE}/product/${p.slug}` : (p.url || ''),
            image: p.image || p.imageUrl || (p.images && p.images[0]) || '',
            priceEnd: priceEnd != null ? parseFloat(String(priceEnd)) : null,
            priceCatalog: priceCatalog != null ? parseFloat(String(priceCatalog)) : null,
            stock: stockDc,
            stockLocal,
            brand: brandName,
            unit: p.unit || p.salesUnit || 'szt',
            deliveryTime: p.deliveryTime || avail.deliveryText || '',
          }
        })

        const totalPages = data?.totalPages || data?.pagination?.totalPages || Math.ceil((data?.total || data?.totalCount || 0) / 24) || 1
        const totalProducts = data?.total || data?.totalCount || products.length

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

        const data = await apiGet(`/search?query=${encodeURIComponent(q.trim())}&page=${page}`, jar)

        const rawProducts = data?.products || data?.items || data?.results || []
        const products = rawProducts.map((p: any) => {
          const priceItems = p.price?.items || p.prices || []
          const priceEnd = priceItems[0]?.priceend ?? priceItems[0]?.priceEnd ?? p.priceEnd ?? p.price?.priceEnd ?? null
          const priceCatalog = priceItems[0]?.pricecatalog ?? priceItems[0]?.priceCatalog ?? p.priceCatalog ?? p.price?.priceCatalog ?? null

          const avail = p.avail || p.availability || {}
          const stockDc = avail.quantitydc ?? avail.quantityDc ?? avail.quantity ?? null
          const stockLocal = avail.quantitylocal ?? avail.quantityLocal ?? null

          const brands = p.brand || p.brands || []
          const brandName = Array.isArray(brands) && brands.length > 0
            ? (brands[0].name || brands[0])
            : (typeof brands === 'string' ? brands : '')

          return {
            name: p.name || p.title || '',
            sku: p.sku || p.productCode || p.code || '',
            slug: p.slug || p.urlSlug || '',
            url: p.slug ? `${BASE}/product/${p.slug}` : (p.url || ''),
            image: p.image || p.imageUrl || (p.images && p.images[0]) || '',
            priceEnd: priceEnd != null ? parseFloat(String(priceEnd)) : null,
            priceCatalog: priceCatalog != null ? parseFloat(String(priceCatalog)) : null,
            stock: stockDc,
            stockLocal,
            brand: brandName,
            unit: p.unit || p.salesUnit || 'szt',
            deliveryTime: p.deliveryTime || avail.deliveryText || '',
          }
        })

        const totalProducts = data?.total || data?.totalCount || products.length

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

        const p = data?.product || data || {}
        const priceItems = p.price?.items || p.prices || []
        const priceEnd = priceItems[0]?.priceend ?? priceItems[0]?.priceEnd ?? p.priceEnd ?? null
        const priceCatalog = priceItems[0]?.pricecatalog ?? priceItems[0]?.priceCatalog ?? p.priceCatalog ?? null

        const avail = p.avail || p.availability || {}
        const stockDc = avail.quantitydc ?? avail.quantityDc ?? avail.quantity ?? null
        const stockLocal = avail.quantitylocal ?? avail.quantityLocal ?? null

        const brands = p.brand || p.brands || []
        const brandName = Array.isArray(brands) && brands.length > 0
          ? (brands[0].name || brands[0])
          : (typeof brands === 'string' ? brands : '')

        // Extract specs/attributes
        const rawSpecs = p.attributes || p.specs || p.parameters || p.technicalData || []
        const specs = Array.isArray(rawSpecs)
          ? rawSpecs.map((s: any) => ({ name: s.name || s.label || '', value: String(s.value ?? '') }))
          : []

        const product = {
          name: p.name || p.title || '',
          sku: p.sku || p.productCode || p.code || '',
          slug: productSlug,
          url: `${BASE}/product/${productSlug}`,
          image: p.image || p.imageUrl || (p.images && p.images[0]) || '',
          images: p.images || [],
          priceEnd: priceEnd != null ? parseFloat(String(priceEnd)) : null,
          priceCatalog: priceCatalog != null ? parseFloat(String(priceCatalog)) : null,
          stock: stockDc,
          stockLocal,
          brand: brandName,
          unit: p.unit || p.salesUnit || 'szt',
          ean: p.ean || p.gtin || '',
          description: p.description || p.shortDescription || '',
          specs,
          deliveryTime: p.deliveryTime || avail.deliveryText || '',
          category: p.category || p.breadcrumb || '',
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
