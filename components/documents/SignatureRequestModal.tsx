import React, { useState, useEffect } from 'react'

interface Signer {
  name: string
  email: string
  phone: string
  position?: string
}

interface PartySigner {
  partyIndex: number
  partyName: string
  partyRole: string
  signers: Signer[]
}

interface Props {
  isOpen: boolean
  onClose: () => void
  documentId: string
  onSent?: () => void
  supabase: any
  parties?: { party1?: any; party2?: any }
}

const SignatureRequestModal: React.FC<Props> = ({ isOpen, onClose, documentId, onSent, supabase, parties }) => {
  const buildDefaultParties = (): PartySigner[] => {
    const result: PartySigner[] = []
    
    if (parties?.party1) {
      const p1 = parties.party1
      result.push({
        partyIndex: 0,
        partyName: p1.name || 'Strona 1',
        partyRole: 'ZAMAWIAJĄCY',
        signers: p1.contact_person
          ? [{ name: p1.contact_person || '', email: p1.email || '', phone: p1.phone || '', position: p1.contact_position || '' }]
          : [{ name: '', email: '', phone: '', position: '' }]
      })
    } else {
      result.push({ partyIndex: 0, partyName: 'Strona 1', partyRole: 'ZAMAWIAJĄCY', signers: [{ name: '', email: '', phone: '', position: '' }] })
    }
    
    if (parties?.party2) {
      const p2 = parties.party2
      result.push({
        partyIndex: 1,
        partyName: p2.name || 'Strona 2',
        partyRole: 'WYKONAWCA',
        signers: p2.contact_person
          ? [{ name: p2.contact_person || '', email: p2.email || '', phone: p2.phone || '', position: p2.contact_position || '' }]
          : [{ name: '', email: '', phone: '', position: '' }]
      })
    } else {
      result.push({ partyIndex: 1, partyName: 'Strona 2', partyRole: 'WYKONAWCA', signers: [{ name: '', email: '', phone: '', position: '' }] })
    }
    
    return result
  }

  const [partySigners, setPartySigners] = useState<PartySigner[]>(buildDefaultParties())
  const [message, setMessage] = useState('Szanowny/a,\n\nPrzesyłam do podpisu dokument.\n\nProszę o podpisanie dokumentu w terminie wskazanym poniżej.\n\nPozdrawiam')
  const [subject, setSubject] = useState('Prośba o podpis dokumentu')
  const [expiresAt, setExpiresAt] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().split('T')[0]
  })
  const [sending, setSending] = useState(false)

  // Signer templates
  const [signerTemplates, setSignerTemplates] = useState<{name: string, emails: string}[]>([])
  const [templateName, setTemplateName] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('signer_templates')
    if (saved) setSignerTemplates(JSON.parse(saved))
  }, [])

  useEffect(() => {
    setPartySigners(buildDefaultParties())
  }, [parties])

  const saveTemplate = () => {
    if (!templateName.trim()) return
    const allEmails = partySigners.flatMap(p => p.signers.filter(s => s.email).map(s => s.email)).join(', ')
    if (!allEmails) return
    const newTemplates = [...signerTemplates, { name: templateName, emails: allEmails }]
    setSignerTemplates(newTemplates)
    localStorage.setItem('signer_templates', JSON.stringify(newTemplates))
    setTemplateName('')
  }

  const removeTemplate = (idx: number) => {
    const newTemplates = signerTemplates.filter((_, i) => i !== idx)
    setSignerTemplates(newTemplates)
    localStorage.setItem('signer_templates', JSON.stringify(newTemplates))
  }

  const addSigner = (partyIdx: number) => {
    setPartySigners(prev => prev.map((p, i) => i === partyIdx
      ? { ...p, signers: [...p.signers, { name: '', email: '', phone: '', position: '' }] }
      : p
    ))
  }

  const removeSigner = (partyIdx: number, signerIdx: number) => {
    setPartySigners(prev => prev.map((p, i) => i === partyIdx
      ? { ...p, signers: p.signers.filter((_, j) => j !== signerIdx) }
      : p
    ))
  }

  const updateSigner = (partyIdx: number, signerIdx: number, field: keyof Signer, value: string) => {
    setPartySigners(prev => prev.map((p, i) => i === partyIdx
      ? { ...p, signers: p.signers.map((s, j) => j === signerIdx ? { ...s, [field]: value } : s) }
      : p
    ))
  }

  const handleSend = async () => {
    const allSigners = partySigners.flatMap(p =>
      p.signers
        .filter(s => s.email)
        .map(s => ({ ...s, partyName: p.partyName, partyRole: p.partyRole }))
    )
    if (allSigners.length === 0) {
      alert('Dodaj przynajmniej jednego podpisującego z adresem e-mail')
      return
    }
    setSending(true)
    for (const signer of allSigners) {
      try {
        await supabase.functions.invoke('send-signature-request', {
          body: {
            document_id: documentId,
            signer_email: signer.email,
            signer_name: signer.name || signer.email.split('@')[0],
            signer_position: signer.position,
            party_name: signer.partyName,
            party_role: signer.partyRole,
            message,
            subject,
            expires_at: expiresAt
          }
        })
      } catch {}
    }
    setSending(false)
    onSent?.()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
          <h3 className="font-semibold text-gray-900">Podpis</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body - scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Party blocks */}
          {partySigners.map((party, partyIdx) => (
            <div key={partyIdx} className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-800 text-sm">{party.partyName}</span>
                  <span className="ml-2 text-xs text-gray-500 uppercase tracking-wide">{party.partyRole}</span>
                </div>
                <button
                  onClick={() => addSigner(partyIdx)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  + Dodaj osobę
                </button>
              </div>
              <div className="divide-y divide-gray-100">
                {party.signers.map((signer, signerIdx) => (
                  <div key={signerIdx} className="px-4 py-3 space-y-2">
                    <div className="flex gap-2">
                      <input
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Imię i nazwisko"
                        value={signer.name}
                        onChange={e => updateSigner(partyIdx, signerIdx, 'name', e.target.value)}
                      />
                      <input
                        className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Stanowisko"
                        value={signer.position || ''}
                        onChange={e => updateSigner(partyIdx, signerIdx, 'position', e.target.value)}
                      />
                      {party.signers.length > 1 && (
                        <button onClick={() => removeSigner(partyIdx, signerIdx)} className="text-red-400 hover:text-red-600 px-1">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Email *"
                        value={signer.email}
                        onChange={e => updateSigner(partyIdx, signerIdx, 'email', e.target.value)}
                      />
                      <input
                        type="tel"
                        className="w-36 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="+48 XXX XXX XXX"
                        value={signer.phone}
                        onChange={e => {
                          const v = e.target.value.replace(/[^0-9+\s-]/g, '')
                          updateSigner(partyIdx, signerIdx, 'phone', v.slice(0, 15))
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Templates */}
          {signerTemplates.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Szablony:</p>
              <div className="flex gap-1 flex-wrap">
                {signerTemplates.map((t, i) => (
                  <div key={i} className="flex items-center gap-0.5">
                    <button onClick={() => {
                      const emails = t.emails.split(',').map(e => e.trim())
                      setPartySigners(prev => prev.map((p, idx) => ({
                        ...p,
                        signers: emails.slice(idx * Math.ceil(emails.length / prev.length), (idx + 1) * Math.ceil(emails.length / prev.length))
                          .map(email => ({ name: '', email, phone: '', position: '' }))
                      })).map(p => p.signers.length === 0 ? { ...p, signers: [{ name: '', email: '', phone: '', position: '' }] } : p))
                    }} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100">{t.name}</button>
                    <button onClick={() => removeTemplate(i)} className="text-gray-400 hover:text-red-500">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Save template */}
          <div className="flex gap-2">
            <input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Nazwa szablonu..."
              className="flex-1 border rounded-lg px-3 py-1.5 text-xs" />
            <button onClick={saveTemplate} className="text-xs px-3 py-1.5 border rounded-lg hover:bg-gray-50">Zapisz szablon</button>
          </div>

          {/* Email subject */}
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Temat e-maila</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={subject}
              onChange={e => setSubject(e.target.value)}
            />
          </div>

          {/* Message */}
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Treść wiadomości</label>
            <textarea
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={4}
              value={message}
              onChange={e => setMessage(e.target.value)}
            />
          </div>

          {/* Expiry */}
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Termin podpisu</label>
            <input
              type="date"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">
            Anuluj
          </button>
          <button onClick={handleSend} disabled={sending} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {sending ? 'Wysyłam...' : 'Podpis'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SignatureRequestModal
