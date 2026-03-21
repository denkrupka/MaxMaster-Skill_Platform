import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

interface Signer {
  id: string
  name: string
  position: string
  email: string
  phone: string
  sendEmail: boolean
  sendSms: boolean
  status: 'pending' | 'sent' | 'signed' | 'error'
}

const defaultEmailTemplate = (docTitle: string) => `Dzień dobry,

Przesyłamy do podpisu dokument: ${docTitle}.

Prosimy o zapoznanie się z treścią i złożenie podpisu elektronicznego klikając poniższy przycisk.

Z poważaniem,
Zespół MaxMaster`

const defaultSmsTemplate = (docTitle: string) => `MaxMaster: Dokument "${docTitle}" czeka na Twój podpis. Kliknij link w e-mailu lub zadzwoń do nas.`

const DocumentSignPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [doc, setDoc] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [signers, setSigners] = useState<Signer[]>([])
  const [emailBody, setEmailBody] = useState('')
  const [smsText, setSmsText] = useState('')
  const [signMethod, setSignMethod] = useState<{ email: boolean; sms: boolean }>({ email: true, sms: false })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [showSmsEdit, setShowSmsEdit] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    if (id) loadDocument()
  }, [id])

  const loadDocument = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('documents')
      .select('*, contractors(*), projects(*, clients(*))')
      .eq('id', id!)
      .single()
    if (data) {
      setDoc(data)
      const title = data.name || data.document_templates?.name || 'Dokument'
      setEmailBody(defaultEmailTemplate(title))
      setSmsText(defaultSmsTemplate(title))
      // Auto-populate from contractor
      if (data.contractors) {
        const c = data.contractors
        const initialSigner: Signer = {
          id: crypto.randomUUID(),
          name: c.contact_person || c.name || '',
          position: c.contact_position || 'Przedstawiciel',
          email: c.email || '',
          phone: c.phone || '',
          sendEmail: true,
          sendSms: false,
          status: 'pending'
        }
        if (initialSigner.email || initialSigner.phone) {
          setSigners([initialSigner])
        }
      }
    }
    setLoading(false)
  }

  const addSigner = () => {
    setSigners(prev => [...prev, {
      id: crypto.randomUUID(), name: '', position: '', email: '', phone: '', sendEmail: true, sendSms: false, status: 'pending'
    }])
  }

  const addSelf = () => {
    if (!user) return
    const already = signers.some(s => s.email === user.email)
    if (already) return
    setSigners(prev => [...prev, {
      id: crypto.randomUUID(), name: user.user_metadata?.full_name || user.email, position: 'Właściciel',
      email: user.email, phone: '', sendEmail: true, sendSms: false, status: 'pending'
    }])
  }

  const updateSigner = (id: string, field: keyof Signer, value: any) => {
    setSigners(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  const removeSigner = (id: string) => setSigners(prev => prev.filter(s => s.id !== id))

  const handleSend = async () => {
    if (signers.length === 0) return
    setSending(true)
    for (const signer of signers) {
      if (!signer.email && !signer.phone) continue
      try {
        await supabase.functions.invoke('send-signature-request', {
          body: {
            document_id: id,
            signers: [{
              name: signer.name,
              email: signer.email,
              phone: signer.phone,
              send_email: signer.sendEmail && signMethod.email,
              send_sms: signer.sendSms || signMethod.sms,
            }],
            email_body: emailBody,
            sms_text: smsText,
          }
        })
        setSigners(prev => prev.map(s => s.id === signer.id ? { ...s, status: 'sent' } : s))
      } catch {
        setSigners(prev => prev.map(s => s.id === signer.id ? { ...s, status: 'error' } : s))
      }
    }
    setSending(false)
    setSent(true)
  }

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>

  const docTitle = doc?.name || doc?.document_templates?.name || 'Dokument'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(`/construction/dms/${id}`)} className="text-gray-500 hover:text-gray-800 text-sm">← Powrót</button>
          <div className="w-px h-5 bg-gray-200" />
          <h1 className="text-sm font-semibold text-gray-900">Podpis</h1>
          <span className="text-sm text-gray-500 truncate">{docTitle}</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Success banner */}
        {sent && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-green-800">Dokument wysłany do podpisu!</p>
              <p className="text-sm text-green-600">Otrzymasz powiadomienie gdy wszystkie strony podpiszą.</p>
            </div>
            <button onClick={() => navigate(`/construction/dms/${id}`)} className="text-sm text-green-700 underline">Wróć do dokumentu</button>
          </div>
        )}

        {/* Sign method */}
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Metoda podpisu</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'email', label: 'Podpis e-mail', desc: 'Link w e-mailu', available: true },
              { key: 'sms', label: 'Podpis SMS', desc: 'Kod SMS', available: true },
              { key: 'zaufany', label: 'Profil Zaufany', desc: 'Wkrótce', available: false },
              { key: 'qes', label: 'Podpis kwalifikowany', desc: 'Wkrótce', available: false },
            ].map(m => (
              <button
                key={m.key}
                disabled={!m.available}
                onClick={() => m.available && setSignMethod(prev => ({ ...prev, [m.key]: !prev[m.key as 'email'|'sms'] }))}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  !m.available ? 'opacity-40 cursor-not-allowed bg-gray-50 border-gray-200' :
                  signMethod[m.key as 'email'|'sms'] ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">{m.label}</span>
                  {m.available && <div className={`w-4 h-4 rounded-full border-2 ${signMethod[m.key as 'email'|'sms'] ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`} />}
                  {!m.available && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Wkrótce</span>}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{m.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Signers */}
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Odbiorcy ({signers.length})</h2>
            <div className="flex gap-2">
              <button onClick={addSelf} className="text-xs border px-3 py-1.5 rounded-lg hover:bg-gray-50 text-gray-700">+ Dodaj siebie</button>
              <button onClick={addSigner} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">+ Dodaj odbiorcę</button>
            </div>
          </div>

          {signers.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">Brak odbiorców. Dodaj osoby do podpisu.</p>
          )}

          <div className="space-y-4">
            {signers.map((s, i) => (
              <div key={s.id} className={`border rounded-xl p-4 ${s.status === 'sent' ? 'border-green-200 bg-green-50' : s.status === 'error' ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-500 uppercase">Odbiorca {i+1}</span>
                  <div className="flex items-center gap-2">
                    {s.status === 'sent' && <span className="text-xs text-green-600 font-medium">Wysłano</span>}
                    {s.status === 'error' && <span className="text-xs text-red-600 font-medium">Błąd</span>}
                    <button onClick={() => removeSigner(s.id)} className="text-xs text-gray-400 hover:text-red-500">Usuń</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Imię i nazwisko</label>
                    <input value={s.name} onChange={e => updateSigner(s.id, 'name', e.target.value)} placeholder="Jan Kowalski" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Stanowisko</label>
                    <input value={s.position} onChange={e => updateSigner(s.id, 'position', e.target.value)} placeholder="Dyrektor" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">E-mail</label>
                    <input type="email" value={s.email} onChange={e => updateSigner(s.id, 'email', e.target.value)} placeholder="jan@firma.pl" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Telefon</label>
                    <input value={s.phone} onChange={e => updateSigner(s.id, 'phone', e.target.value)} placeholder="+48 600 000 000" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                  </div>
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={s.sendEmail} onChange={e => updateSigner(s.id, 'sendEmail', e.target.checked)} className="rounded" />
                    Wyślij e-mail
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={s.sendSms} onChange={e => updateSigner(s.id, 'sendSms', e.target.checked)} className="rounded" />
                    Wyślij SMS
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>



        {/* SMS template */}
        {(signMethod.sms || signers.some(s => s.sendSms)) && (
          <div className="bg-white rounded-xl border p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Treść SMS</h2>
            <textarea value={smsText} onChange={e => setSmsText(e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-3 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            <p className="text-xs text-gray-400 mt-1">{smsText.length}/160 znaków</p>
          </div>
        )}

        {/* Send button */}
        <div className="flex justify-end gap-3 pb-8">
          <button onClick={() => navigate(`/construction/dms/${id}`)} className="px-5 py-2.5 border rounded-xl text-sm hover:bg-gray-50">Anuluj</button>
          <button onClick={handleSend} disabled={sending || signers.length === 0 || sent} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {sending ? 'Wysyłanie...' : sent ? 'Wysłano!' : `Wyślij do ${signers.length} ${signers.length === 1 ? 'osoby' : 'osób'}`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DocumentSignPage
