import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useParams, useNavigate } from 'react-router-dom'

// ── Signing method map ──────────────────────────────────────────────
const SIGNING_METHOD_LABELS: Record<string, string> = {
  pz: 'Profil Zaufany',
  kaligraficzny: 'Podpis odręczny',
  email: 'Podpis e-mail',
  sms: 'Podpis SMS',
}

function getMethodLabel(method?: string | null): string {
  if (!method) return 'Podpis elektroniczny'
  return SIGNING_METHOD_LABELS[method] || 'Podpis elektroniczny'
}

// ── Token formatter: UUID → "A3F2-9B1C" ────────────────────────────
function formatVerificationToken(token?: string | null): string {
  if (!token) return '—'
  const clean = token.replace(/-/g, '').slice(0, 8).toUpperCase()
  return `${clean.slice(0, 4)}-${clean.slice(4, 8)}`
}

// ── Date/time formatter: ISO → "22 marca 2026, 14:35" ──────────────
function formatDateTime(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// ── Signing mode label ─────────────────────────────────────────────
function getModeLabel(mode?: string | null): string {
  if (mode === 'sequential') return 'Sekwencyjny'
  if (mode === 'parallel') return 'Równoległy'
  return mode || '—'
}

// ── Method badge color ──────────────────────────────────────────────
function getMethodBadgeStyle(method?: string | null) {
  switch (method) {
    case 'pz':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200'
    case 'kaligraficzny':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'email':
      return 'bg-sky-50 text-sky-700 border-sky-200'
    case 'sms':
      return 'bg-violet-50 text-violet-700 border-violet-200'
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200'
  }
}

// ── Main component ──────────────────────────────────────────────────
const DocumentCertificatePage: React.FC = () => {
  const { id, token } = useParams<{ id?: string; token?: string }>()
  const navigate = useNavigate()
  const [doc, setDoc] = useState<any>(null)
  const [requests, setRequests] = useState<any[]>([])
  const [tokens, setTokens] = useState<Record<string, any>>({}) // request_id → token row
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        let documentId = id

        // If we have a token (from /sign/:token/certificate), resolve document ID
        if (!documentId && token) {
          const { data: tokenData } = await supabase
            .from('signature_tokens')
            .select('request_id')
            .eq('token', token)
            .single()

          if (tokenData?.request_id) {
            const { data: reqData } = await supabase
              .from('signature_requests')
              .select('document_id')
              .eq('id', tokenData.request_id)
              .single()
            documentId = reqData?.document_id
          }
        }

        if (!documentId) {
          setLoading(false)
          return
        }

        // Fetch document + signature requests
        const [{ data: d }, { data: r }] = await Promise.all([
          supabase.from('documents').select('*').eq('id', documentId).single(),
          supabase.from('signature_requests').select('*').eq('document_id', documentId).order('signing_order', { ascending: true }),
        ])

        setDoc(d)
        setRequests(r || [])

        // Fetch signature tokens for each request
        if (r && r.length > 0) {
          const requestIds = r.map((req: any) => req.id)
          const { data: tokenRows } = await supabase
            .from('signature_tokens')
            .select('*')
            .in('request_id', requestIds)

          if (tokenRows) {
            const tokenMap: Record<string, any> = {}
            tokenRows.forEach((t: any) => {
              tokenMap[t.request_id] = t
            })
            setTokens(tokenMap)
          }
        }
      } catch (err) {
        console.error('Error loading certificate data:', err)
      }
      setLoading(false)
    }

    if (id || token) loadData()
  }, [id, token])

  const allSigned = requests.length > 0 && requests.every((r) => r.status === 'signed')
  const signedCount = requests.filter((r) => r.status === 'signed').length

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
          <p className="text-sm text-slate-400">Ładowanie certyfikatu...</p>
        </div>
      </div>
    )

  if (!doc)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-lg font-medium text-slate-700">Nie znaleziono dokumentu</p>
          <button onClick={() => navigate(-1)} className="mt-3 text-sm text-indigo-600 hover:underline">
            Powrót
          </button>
        </div>
      </div>
    )

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 print:bg-white print:py-0">
      {/* Toolbar */}
      <div className="max-w-2xl mx-auto mb-4 flex items-center justify-between no-print">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Powrot
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
          </svg>
          Drukuj
        </button>
      </div>

      {/* Certificate Card */}
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden print:shadow-none print:border print:rounded-none">
        {/* ─── Header ─── */}
        <div className="bg-gradient-to-br from-indigo-600 via-blue-600 to-blue-700 px-8 py-7">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-indigo-200 text-[11px] font-semibold uppercase tracking-[0.2em] mb-2">MaxMaster</p>
              <h1 className="text-white text-xl font-bold leading-tight">Certyfikat podpisu<br />elektronicznego</h1>
            </div>
            <div className="w-14 h-14 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="white" className="w-7 h-7">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
            </div>
          </div>
        </div>

        {/* ─── Status Bar ─── */}
        <div className={`px-8 py-3 flex items-center gap-3 border-b ${
          allSigned
            ? 'bg-emerald-50 border-emerald-100'
            : 'bg-blue-50 border-blue-100'
        }`}>
          <div className={`w-2 h-2 rounded-full animate-pulse ${allSigned ? 'bg-emerald-500' : 'bg-blue-500'}`} />
          <p className={`text-sm font-medium ${allSigned ? 'text-emerald-700' : 'text-blue-700'}`}>
            {allSigned
              ? 'Dokument podpisany przez wszystkich sygnatariuszy'
              : `Podpisano ${signedCount} z ${requests.length} sygnatariuszy`}
          </p>
          <span className={`ml-auto text-xs font-semibold px-2.5 py-0.5 rounded-full ${
            allSigned ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {allSigned ? 'Zakonczone' : 'W trakcie'}
          </span>
        </div>

        {/* ─── Document Info Grid ─── */}
        <div className="px-8 py-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900 mb-1">{doc.name || 'Dokument'}</h2>
          {doc.number && <p className="text-sm text-slate-400 mb-5">Nr: {doc.number}</p>}

          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider mb-1">ID dokumentu</p>
              <p className="font-mono text-sm text-slate-700 font-medium">{doc.id?.slice(0, 8).toUpperCase()}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider mb-1">Data utworzenia</p>
              <p className="text-sm text-slate-700">{formatDate(doc.created_at)}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider mb-1">Tryb podpisu</p>
              <p className="text-sm text-slate-700 capitalize">{doc.signing_mode || '—'}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider mb-1">Liczba sygnatariuszy</p>
              <p className="text-sm text-slate-700">{requests.length}</p>
            </div>
          </div>
        </div>

        {/* ─── Signatories ─── */}
        {requests.length > 0 && (
          <div className="px-8 py-6 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-[0.15em] mb-5">
              Sygnatariusze
            </h3>
            <div className="space-y-0">
              {requests.map((r, i) => {
                const tokenRow = tokens[r.id]
                const isSigned = r.status === 'signed'
                const signingMethod = tokenRow?.metadata?.signing_method || (r.signature_method && !r.signature_method.includes(',') ? r.signature_method : null)
                const signedTime = r.signed_at || tokenRow?.used_at

                return (
                  <div
                    key={r.id}
                    className={`relative py-4 ${i < requests.length - 1 ? 'border-b border-slate-100' : ''}`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Avatar circle */}
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 mt-0.5 ${
                        isSigned
                          ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-200'
                          : 'bg-slate-100 text-slate-400 ring-2 ring-slate-200'
                      }`}>
                        {isSigned ? (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        ) : (
                          <span>{i + 1}</span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {r.signer_name || r.recipient_name || '—'}
                          </p>
                          {/* Method badge */}
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${getMethodBadgeStyle(signingMethod)}`}>
                            {getMethodLabel(signingMethod)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{r.signer_email || r.recipient_email}</p>

                        {/* Signed details row */}
                        {isSigned && (
                          <div className="flex items-center gap-4 mt-2 flex-wrap">
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 text-slate-400">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                              </svg>
                              <span>{formatDateTime(signedTime)}</span>
                            </div>
                            {tokenRow?.token && (
                              <div className="flex items-center gap-1.5 text-xs">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 text-slate-400">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0 1 19.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 0 0 4.5 10.5a48.667 48.667 0 0 0-6 0c1.318 3.773 3.516 7.196 6.354 9.864l.246-.244a48.7 48.7 0 0 0 2.064-9.231M12 3c2.392 0 4.744.175 7.043.513C20.22 6.158 21 9.044 21 12" />
                                </svg>
                                <span className="font-mono font-medium text-slate-600">
                                  {formatVerificationToken(tokenRow.token)}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Pending status */}
                        {!isSigned && (
                          <p className="text-xs text-slate-400 mt-2 italic">Oczekuje na podpis</p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ─── Verification Note ─── */}
        <div className="px-8 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-start gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-slate-400 mt-0.5 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Niniejszy certyfikat potwierdza autentycznosc podpisow elektronicznych zlozonych na dokumencie.
              Kazdy podpis jest powiazany z unikalnym tokenem weryfikacyjnym. Certyfikat wygenerowany automatycznie przez system MaxMaster.
            </p>
          </div>
        </div>

        {/* ─── Footer ─── */}
        <div className="px-8 py-5 bg-slate-50 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-slate-400 font-medium">Wygenerowano przez MaxMaster</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {new Date().toLocaleDateString('pl-PL', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-slate-500">maxmaster.info</p>
            <p className="text-[11px] text-slate-400">System zarzadzania budowa</p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  )
}

export default DocumentCertificatePage
