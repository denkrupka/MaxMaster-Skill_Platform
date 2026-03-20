import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

type Step = 'phone' | 'otp' | 'document' | 'signed' | 'expired'

const SignPage: React.FC = () => {
  const { token } = useParams<{ token: string }>()
  const [companyBranding, setCompanyBranding] = useState<{name?: string; logo_url?: string; color?: string} | null>(null)
  const [showPreview, setShowPreview] = useState(true)
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [doc, setDoc] = useState<any>(null)
  const [signerName, setSignerName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [suggestMode, setSuggestMode] = useState(false)
  const [suggestions, setSuggestions] = useState<Array<{original:string;suggested:string;comment:string}>>([])
  const [selectedForSuggest, setSelectedForSuggest] = useState('')
  const [suggestText, setSuggestText] = useState('')
  const [suggestComment, setSuggestComment] = useState('')
  const [showSuggestBox, setShowSuggestBox] = useState(false)
  const [suggestionsSent, setSuggestionsSent] = useState(false)

  useEffect(() => { if (token) validateToken() }, [token])

  const validateToken = async () => {
    const { data } = await supabase
      .from('signature_tokens')
      .select('*, signature_requests(signer_name, signer_phone, documents(name, content, document_templates(name, content)))')
      .eq('token', token!)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .single()
    if (!data) { setStep('expired'); return }
    const req = data.signature_requests as any
    setDoc(req?.documents)
    setSignerName(req?.signer_name || '')
    if (req?.signer_phone) setPhone(req.signer_phone)

    // Load company branding for whitelabel
    if (req?.documents?.company_id) {
      const { data: company } = await supabase
        .from('company_settings')
        .select('company_name, logo_url, primary_color')
        .eq('company_id', req.documents.company_id)
        .single()
      if (company) setCompanyBranding({ name: company.company_name, logo_url: company.logo_url, color: company.primary_color })
    }
  }

  const handleSendOtp = async () => {
    if (!phone.trim()) return
    setLoading(true); setError('')
    const cleanPhone = phone.replace(/\s/g, '')
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    await supabase.from('signature_tokens')
      .update({ metadata: { otp: code, otp_phone: cleanPhone, otp_expires: Date.now() + 600000 } })
      .eq('token', token!)
    const { error: smsErr } = await supabase.functions.invoke('send-sms', {
      body: { to: cleanPhone, message: `MaxMaster: Kod weryfikacyjny: ${code}. Wazny 10 minut.` }
    })
    if (smsErr) { setError('Blad wysylania SMS.'); setLoading(false); return }
    setStep('otp'); setLoading(false)
  }

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return
    setLoading(true); setError('')
    const { data } = await supabase.from('signature_tokens').select('metadata').eq('token', token!).single()
    const meta = (data?.metadata as any)
    if (!meta?.otp || meta.otp !== otp) { setError('Nieprawidlowy kod.'); setLoading(false); return }
    if (meta.otp_expires < Date.now()) { setError('Kod wygasl. Wyslij nowy.'); setLoading(false); return }
    setStep('document'); setLoading(false)
  }

  const handleSign = async () => {
    setLoading(true)
    const { error: signErr } = await supabase.functions.invoke('process-signature', { body: { token, signed: true, phone } })
    if (signErr) { setError('Blad podpisywania.'); setLoading(false); return }
    setStep('signed'); setLoading(false)
  }

  const docContent = (() => {
    if (!doc) return ''
    if (doc.content) return typeof doc.content === 'string' ? doc.content : ''
    if (doc.document_templates?.content) {
      const c = doc.document_templates.content
      return Array.isArray(c) ? c.map((s: any) => `<h2>${s.title||''}</h2><p>${s.body||''}</p>`).join('') : String(c)
    }
    return ''
  })()

  const docTitle = doc?.name || doc?.document_templates?.name || 'Dokument'

  // Preview screen before signing
  if (showPreview && doc) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          {companyBranding && (
            <div className="flex items-center gap-3 mb-6">
              {companyBranding.logo_url ? (
                <img src={companyBranding.logo_url} alt={companyBranding.name || 'Logo'} className="w-10 h-10 rounded-lg object-contain" />
              ) : (
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: companyBranding.color || '#2563eb' }}>
                  <span className="text-white text-sm font-bold">{(companyBranding.name || 'MM').slice(0, 2).toUpperCase()}</span>
                </div>
              )}
              <span className="font-semibold text-gray-900">{companyBranding.name || 'MaxMaster'}</span>
            </div>
          )}
          <div className="bg-white rounded-2xl p-6 mb-4 shadow-sm border">
            <h2 className="text-lg font-bold text-gray-900 mb-1">{docTitle}</h2>
            <p className="text-sm text-gray-500 mb-4">Przejrzyj dokument przed podpisaniem</p>
            <div className="border rounded-xl p-4 max-h-96 overflow-y-auto bg-gray-50 text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: docContent || '<p class="text-gray-400">Brak treści dokumentu</p>' }}
            />
          </div>
          <button onClick={() => setShowPreview(false)} className="w-full bg-blue-600 text-white rounded-2xl py-4 font-semibold shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
            Przejdź do podpisania
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
          </button>
        </div>
      </div>
    )
  }

  if (step === 'expired') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-red-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Nie można załadować dokumentu</h2>
        <p className="text-sm text-gray-500 mb-6">Link do podpisu jest nieprawidłowy lub wygasł. Skontaktuj się z nadawcą dokumentu.</p>
        <p className="text-xs text-gray-400 font-mono bg-gray-50 rounded-lg px-3 py-2">Token nie został znaleziony lub jest nieaktywny</p>
      </div>
    </div>
  )

  if (step === 'signed') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Dokument podpisany!</h2>
        <p className="text-gray-500 mb-2">Dokument <strong>{docTitle}</strong> zostal pomyslnie podpisany.</p>
        <p className="text-xs text-gray-400">Kopia zostanie wyslana na Twoj e-mail.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md">
        <div className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-3 mb-3">
            {companyBranding?.logo_url ? (
              <img src={companyBranding.logo_url} alt={companyBranding.name || 'Logo'} className="w-8 h-8 rounded-lg object-contain" />
            ) : (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: companyBranding?.color || '#2563eb' }}>
                <span className="text-white text-xs font-bold">{(companyBranding?.name || 'MM').slice(0, 2).toUpperCase()}</span>
              </div>
            )}
            <span className="font-semibold text-gray-900">{companyBranding?.name || 'MaxMaster'}</span>
          </div>
          <p className="text-sm text-gray-500 mb-4">{signerName ? `Dzien dobry, ${signerName}! ` : ''}Przeslano Ci dokument do podpisu.</p>
          {/* Step progress */}
          <div className="flex items-center gap-0">
            {[
              { num: 1, label: 'Telefon', key: 'phone' },
              { num: 2, label: 'Weryfikacja', key: 'otp' },
              { num: 3, label: 'Podpis', key: 'document' },
            ].map((s, i) => {
              const stepIdx = { phone: 0, otp: 1, document: 2 }[step as string] ?? 0;
              const isDone = i < stepIdx;
              const isActive = i === stepIdx;
              return (
                <React.Fragment key={s.key}>
                  <div className="flex flex-col items-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${isDone ? 'bg-blue-600 text-white' : isActive ? 'bg-blue-600 text-white ring-2 ring-blue-200' : 'bg-gray-100 text-gray-400'}`}>
                      {isDone ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                      ) : s.num}
                    </div>
                    <span className={`text-[10px] mt-1 font-medium ${isActive ? 'text-blue-600' : isDone ? 'text-blue-400' : 'text-gray-400'}`}>{s.label}</span>
                  </div>
                  {i < 2 && <div className={`flex-1 h-0.5 mx-1 mb-4 transition-colors ${isDone ? 'bg-blue-600' : 'bg-gray-200'}`} />}
                </React.Fragment>
              );
            })}
          </div>
        </div>
        <div className="p-6">
          {step === 'phone' && <>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Weryfikacja tozsamosci</h2>
            <p className="text-sm text-gray-500 mb-4">Podaj numer telefonu, aby otrzymac kod SMS.</p>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+48 600 000 000"
              className="w-full border rounded-xl px-4 py-3 text-sm mb-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              onKeyDown={e => e.key === 'Enter' && handleSendOtp()} />
            {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
            <button onClick={handleSendOtp} disabled={loading || !phone.trim()} className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Wysylanie...' : 'Wyslij kod SMS'}
            </button>
          </>}

          {step === 'otp' && <>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Wprowadz kod</h2>
            <p className="text-sm text-gray-500 mb-4">Wyslalismy 6-cyfrowy kod na <strong>{phone}</strong>.</p>
            <input type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g,'').slice(0,6))}
              placeholder="000000" maxLength={6}
              className="w-full border rounded-xl px-4 py-3 text-2xl text-center font-mono tracking-widest mb-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              onKeyDown={e => e.key === 'Enter' && otp.length === 6 && handleVerifyOtp()} />
            {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
            <button onClick={handleVerifyOtp} disabled={loading || otp.length !== 6} className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 mb-2">
              {loading ? 'Weryfikuje...' : 'Weryfikuj'}
            </button>
            <button onClick={() => { setStep('phone'); setOtp(''); setError('') }} className="w-full text-sm text-gray-400 hover:text-gray-600">Zmien numer</button>
          </>}

          {step === 'document' && <>
            <div className="mb-3 flex items-center justify-between">
              <div><h2 className="font-semibold text-gray-900">{docTitle}</h2><p className="text-xs text-gray-500">Przeczytaj dokument przed podpisaniem</p></div>
              <button onClick={() => setSuggestMode(v => !v)} className={`text-xs px-2 py-1 rounded-lg border ${suggestMode ? 'bg-blue-50 border-blue-300 text-blue-700' : 'text-gray-500 border-gray-200'}`}>
                {suggestMode ? 'Tryb sugestii ON' : 'Tryb sugestii'}
              </button>
            </div>
            <div className="border rounded-xl max-h-96 overflow-y-auto mb-3"
              onMouseUp={() => {
                if (!suggestMode) return
                const sel = window.getSelection()?.toString().trim()
                if (sel && sel.length > 0) { setSelectedForSuggest(sel); setShowSuggestBox(true) }
              }}
            >
              <div className="prose prose-sm max-w-none p-4" dangerouslySetInnerHTML={{ __html: docContent || '<p class="text-gray-400 text-center py-8">Tresc dokumentu niedostepna</p>' }} />
            </div>
            {showSuggestBox && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-3">
                <p className="text-xs text-gray-500 mb-1">Wybrany tekst: <em>"{selectedForSuggest.slice(0,60)}"</em></p>
                <input value={suggestText} onChange={e => setSuggestText(e.target.value)} placeholder="Proponowana zmiana..." className="w-full border rounded px-2 py-1.5 text-xs mb-1" />
                <input value={suggestComment} onChange={e => setSuggestComment(e.target.value)} placeholder="Komentarz (opcjonalnie)..." className="w-full border rounded px-2 py-1.5 text-xs mb-2" />
                <div className="flex gap-2">
                  <button onClick={() => {
                    if (!suggestText.trim()) return
                    setSuggestions(p => [...p, {original: selectedForSuggest, suggested: suggestText, comment: suggestComment}])
                    setSuggestText(''); setSuggestComment(''); setSelectedForSuggest(''); setShowSuggestBox(false)
                  }} className="bg-yellow-500 text-white px-3 py-1 rounded text-xs">Dodaj sugestię</button>
                  <button onClick={() => setShowSuggestBox(false)} className="px-3 py-1 rounded text-xs border">Anuluj</button>
                </div>
              </div>
            )}
            {suggestions.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-3 mb-3">
                <p className="text-xs font-medium text-gray-700 mb-2">Twoje sugestie ({suggestions.length}):</p>
                {suggestions.map((s,i) => (
                  <div key={i} className="text-xs bg-white border rounded p-2 mb-1">
                    <span className="text-red-500 line-through">{s.original.slice(0,40)}</span>
                    <span className="mx-1 text-gray-400">→</span>
                    <span className="text-green-600">{s.suggested.slice(0,40)}</span>
                    {s.comment && <span className="text-gray-400 ml-1">({s.comment})</span>}
                  </div>
                ))}
                {!suggestionsSent ? (
                  <button onClick={async () => {
                    await supabase.from('document_comments').insert(
                      suggestions.map(s => ({ document_id: doc?.id || null, author_name: signerName || phone, content: `SUGESTIA: zmień "${s.original.slice(0,50)}" na "${s.suggested}"${s.comment ? '. Komentarz: '+s.comment : ''}`, field_key: 'suggestion', created_at: new Date().toISOString() }))
                    )
                    setSuggestionsSent(true)
                  }} className="mt-2 w-full text-xs bg-blue-600 text-white py-1.5 rounded-lg hover:bg-blue-700">
                    Wyślij sugestie do weryfikacji
                  </button>
                ) : (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                    Sugestie wysłane do weryfikacji
                  </p>
                )}
              </div>
            )}
            {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
            <p className="text-xs text-gray-500 mb-3">Klikajac "Podpisz" potwierdzasz zapoznanie sie z trescia i wyrazasz zgode na podpisanie elektroniczne.</p>
            <button onClick={handleSign} disabled={loading} className="w-full bg-green-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
              {loading ? 'Podpisuje...' : 'Podpisz dokument'}
            </button>
          </>}
        </div>
      </div>
    </div>
  )
}

export default SignPage
