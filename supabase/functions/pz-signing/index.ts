/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * pz-signing Edge Function
 *
 * Integrates with CPA sandbox (Cyfrowa Piaskownica Administracji)
 * which wraps the Profil Zaufany SOAP service as REST.
 *
 * API discovered from CPA portal:
 *   Base:  https://api-cpa.gov.pl/mc-profil-zaufany/1.0
 *   Token: https://cpa.gov.pl/token  (client_credentials)
 *   Auth:  Authorization: Bearer <token>
 *
 * Underlying PZ operations (from tpSigning WSDL):
 *   addDocumentToSigning  → POST /addDocumentToSigning
 *   getSignedDocument     → GET  /getSignedDocument?id=<signing_id>
 *   verifySignedDocument  → POST /verifySignedDocument
 *
 * Actions:
 *   init     → get CPA token → create signing session → return redirect URL
 *   callback → fetch signed document → mark signature_token as used
 *   status   → check if document has been signed
 */

const CPA_TOKEN_URL   = 'https://cpa.gov.pl/token'
const CPA_BASE_URL    = 'https://api-cpa.gov.pl/mc-profil-zaufany/1.0'
const CPA_CLIENT_ID     = Deno.env.get('PZ_CLIENT_ID')     || 'zzAxz3ZlYfP_FfBxgR0vgvQltUMa'
const CPA_CLIENT_SECRET = Deno.env.get('PZ_CLIENT_SECRET') || 'xXJSvgIhUp9XpwsfBzFK7NnQrQYa'
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY       = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

/**
 * Get an OAuth2 Bearer token from CPA gateway via client_credentials.
 * CPA uses WSO2 API Manager — token lives 3600s.
 */
async function getCpaToken(): Promise<string> {
  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     CPA_CLIENT_ID,
    client_secret: CPA_CLIENT_SECRET,
  })

  const res = await fetch(CPA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`CPA token error ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  const token = data.access_token
  if (!token) throw new Error('CPA: no access_token in response: ' + JSON.stringify(data).slice(0, 200))
  return token
}

/**
 * Call CPA PZ API.
 * Tries multiple path variants because exact REST mapping of SOAP ops is undocumented.
 */
async function cpaPZ(
  method: 'GET' | 'POST',
  pathVariants: string[],
  bearerToken: string,
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: unknown; usedPath: string }> {
  for (const path of pathVariants) {
    const url = `${CPA_BASE_URL}${path}`
    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const text = await res.text()
    let data: unknown
    try { data = JSON.parse(text) } catch { data = text }

    // 404 "No matching resource" means wrong path — try next variant
    if (res.status === 404) {
      const msg = typeof data === 'object' && data !== null ? (data as Record<string, string>).description ?? '' : ''
      if (msg.includes('No matching resource')) continue
    }

    return { ok: res.ok, status: res.status, data, usedPath: path }
  }

  // All paths returned 404
  return {
    ok: false,
    status: 404,
    data: { error: 'endpoint_not_found', message: 'All CPA path variants returned 404. Exact REST mapping unknown — needs CPA portal verification.' },
    usedPath: pathVariants[pathVariants.length - 1],
  }
}

// ─── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { action, token, signingId } = await req.json()

    if (!token) return json({ error: 'token is required' }, 400)

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

    // Load signature request
    const { data: sigToken, error: tokenErr } = await supabase
      .from('signature_tokens')
      .select('*, signature_requests(*, documents(id, name, number, data, template_id, document_templates(name, type, content)))')
      .eq('token', token)
      .single()

    if (tokenErr || !sigToken) {
      return json({ error: 'Invalid or expired signing token' }, 404)
    }

    // ── ACTION: init ──────────────────────────────────────────────────────────
    if (action === 'init') {
      let cpaToken: string
      try {
        cpaToken = await getCpaToken()
      } catch (e) {
        return json({
          error: 'cpa_token_failed',
          message: String(e),
          hint: 'CPA gateway może być tymczasowo niedostępne lub credentials są nieaktywne.',
        }, 502)
      }

      // Build a minimal XML document for signing (XAdES-compatible)
      const docId     = sigToken.signature_requests?.document_id || sigToken.request_id
      const docName   = sigToken.signature_requests?.documents?.name || 'Dokument'
      const docNumber = sigToken.signature_requests?.documents?.number || ''

      const xmlDoc = `<?xml version="1.0" encoding="UTF-8"?>
<SigningRequest>
  <DocumentId>${docId}</DocumentId>
  <DocumentName>${docName}</DocumentName>
  <DocumentNumber>${docNumber}</DocumentNumber>
  <Token>${token}</Token>
  <Timestamp>${new Date().toISOString()}</Timestamp>
</SigningRequest>`

      const xmlBase64 = btoa(unescape(encodeURIComponent(xmlDoc)))

      const successUrl = `${req.headers.get('origin') || 'https://maxmaster.info'}/#/sign/${token}?pz_status=success`
      const failureUrl = `${req.headers.get('origin') || 'https://maxmaster.info'}/#/sign/${token}?pz_status=failure`

      // Try all known path variants for addDocumentToSigning
      const result = await cpaPZ(
        'POST',
        [
          '/addDocumentToSigning',
          '/documents/signing',
          '/signing/add',
          '/sign',
          '/document/add',
        ],
        cpaToken,
        {
          doc:        xmlBase64,
          successURL: successUrl,
          failureURL: failureUrl,
          additionalInfo: `MaxMaster — ${docName}`,
        },
      )

      // Store CPA token for reuse in callback (lives 3600s)
      await supabase
        .from('signature_tokens')
        .update({ metadata: { cpa_token: cpaToken, cpa_init_at: Date.now() } })
        .eq('token', token)

      if (!result.ok) {
        const errData = result.data as Record<string, unknown>
        // endpoint_not_found = known limitation; return info for UI
        if ((errData?.error as string) === 'endpoint_not_found') {
          return json({
            error: 'pz_endpoints_not_mapped',
            message: 'Dokładne ścieżki REST API CPA nie są jeszcze zmapowane. Potrzebna weryfikacja w portalu CPA.',
            cpa_base: CPA_BASE_URL,
            cpa_token_ok: true,
          }, 503)
        }
        return json({ error: 'cpa_api_error', status: result.status, data: result.data, usedPath: result.usedPath }, 502)
      }

      // Extract redirect URL from response
      let redirectUrl: string | null = null
      const d = result.data as Record<string, unknown>

      if (typeof d === 'string' && d.startsWith('http')) {
        redirectUrl = d
      } else if (d?.redirectUrl) {
        redirectUrl = d.redirectUrl as string
      } else if (d?.url) {
        redirectUrl = d.url as string
      } else if (d?.signingUrl) {
        redirectUrl = d.signingUrl as string
      } else if (d?.addDocumentToSigningReturn) {
        redirectUrl = d.addDocumentToSigningReturn as string
      }

      if (!redirectUrl) {
        return json({ error: 'no_redirect_url', raw: d }, 502)
      }

      return json({ ok: true, redirectUrl })
    }

    // ── ACTION: callback ──────────────────────────────────────────────────────
    if (action === 'callback') {
      if (!signingId) return json({ error: 'signingId is required for callback' }, 400)

      // Get stored CPA token from metadata, or get fresh one
      let cpaToken: string
      const metadata = sigToken.metadata as Record<string, unknown> | null
      const storedToken   = metadata?.cpa_token as string | undefined
      const storedTokenAt = metadata?.cpa_init_at as number | undefined

      const tokenAge = storedTokenAt ? (Date.now() - storedTokenAt) / 1000 : 9999
      if (storedToken && tokenAge < 3500) {
        cpaToken = storedToken
      } else {
        cpaToken = await getCpaToken()
      }

      // Fetch signed document
      const result = await cpaPZ(
        'GET',
        [
          `/getSignedDocument?id=${encodeURIComponent(signingId)}`,
          `/documents/signed/${encodeURIComponent(signingId)}`,
          `/signing/${encodeURIComponent(signingId)}`,
        ],
        cpaToken,
      )

      if (!result.ok) {
        return json({ error: 'get_signed_failed', status: result.status, data: result.data }, 502)
      }

      // Mark signature token as used
      const ip = req.headers.get('x-forwarded-for') || 'unknown'
      const ua = req.headers.get('user-agent') || 'unknown'

      await supabase.from('signature_tokens').update({
        used_at:        new Date().toISOString(),
        ip_address:     ip,
        user_agent:     ua,
        signature_data: { type: 'profil_zaufany', signing_id: signingId, signed_doc: result.data },
      }).eq('token', token)

      // Mark signature request as signed
      await supabase.from('signature_requests').update({
        status:    'signed',
        signed_at: new Date().toISOString(),
      }).eq('id', sigToken.request_id)

      return json({ ok: true, signed: true })
    }

    // ── ACTION: status ────────────────────────────────────────────────────────
    if (action === 'status') {
      return json({
        used:       !!sigToken.used_at,
        method:     'profil_zaufany',
        signed_at:  sigToken.used_at,
      })
    }

    return json({ error: `Unknown action: ${action}` }, 400)
  } catch (err) {
    console.error('pz-signing error:', err)
    return json({ error: 'internal_error', message: String(err) }, 500)
  }
})
