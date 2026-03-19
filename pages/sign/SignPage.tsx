import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

type Step = 'phone' | 'otp' | 'document' | 'signed' | 'expired'

const SignPage: React.FC = () => {
  const { token } = useParams<{ token: string }>()
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [doc, setDoc] = useState<any>(null)
  const [signerName, setSignerName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

  if (step === 'expired') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">⚠️</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Link wygasl</h2>
        <p className="text-sm text-gray-500">Ten link jest niewazny lub uzytkownik juz podpisal. Skontaktuj sie z nadawca.</p>
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
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center"><span className="text-white text-xs font-bold">MM</span></div>
            <span className="font-semibold text-gray-900">MaxMaster</span>
          </div>
          <p className="text-sm text-gray-500">{signerName ? `Dzien dobry, ${signerName}! ` : ''}Przeslano Ci dokument do podpisu.</p>
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
            <div className="mb-3"><h2 className="font-semibold text-gray-900">{docTitle}</h2><p className="text-xs text-gray-500">Przeczytaj dokument przed podpisaniem</p></div>
            <div className="border rounded-xl max-h-96 overflow-y-auto mb-4 prose prose-sm max-w-none p-4" dangerouslySetInnerHTML={{ __html: docContent || '<p class="text-gray-400 text-center py-8">Tresc dokumentu niedostepna</p>' }} />
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
