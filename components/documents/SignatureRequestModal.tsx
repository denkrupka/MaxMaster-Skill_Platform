import React, { useState, useEffect } from 'react'

interface Props {
  isOpen: boolean
  onClose: () => void
  documentId: string
  onSent?: () => void
  supabase: any
}

const SignatureRequestModal: React.FC<Props> = ({ isOpen, onClose, documentId, onSent, supabase }) => {
  const [signers, setSigners] = useState('')
  const [signerName, setSignerName] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  // Signer templates
  const [signerTemplates, setSignerTemplates] = useState<{name: string, emails: string}[]>([])
  const [templateName, setTemplateName] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('signer_templates')
    if (saved) setSignerTemplates(JSON.parse(saved))
  }, [])

  const saveTemplate = () => {
    if (!templateName.trim() || !signers.trim()) return
    const newTemplates = [...signerTemplates, { name: templateName, emails: signers }]
    setSignerTemplates(newTemplates)
    localStorage.setItem('signer_templates', JSON.stringify(newTemplates))
    setTemplateName('')
  }

  const loadTemplate = (emails: string) => setSigners(emails)

  const removeTemplate = (idx: number) => {
    const newTemplates = signerTemplates.filter((_, i) => i !== idx)
    setSignerTemplates(newTemplates)
    localStorage.setItem('signer_templates', JSON.stringify(newTemplates))
  }

  const handleSend = async () => {
    if (!signers.trim()) return
    setSending(true)
    const emails = signers.split(',').map(e => e.trim()).filter(Boolean)
    for (const email of emails) {
      try {
        await supabase.functions.invoke('send-signature-request', {
          body: {
            document_id: documentId,
            signer_email: email,
            signer_name: signerName || email.split('@')[0],
            message
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Wyślij do podpisu</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Imię i nazwisko</label>
            <input value={signerName} onChange={e => setSignerName(e.target.value)} placeholder="Jan Kowalski"
              className="w-full border rounded-xl px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Email (oddziel przecinkiem dla wielu)</label>
            <input value={signers} onChange={e => setSigners(e.target.value)} placeholder="jan@firma.pl, anna@firma.pl"
              className="w-full border rounded-xl px-3 py-2 text-sm" />
            {signerTemplates.length > 0 && (
              <div className="flex gap-1 flex-wrap mt-2">
                {signerTemplates.map((t, i) => (
                  <div key={i} className="flex items-center gap-0.5">
                    <button onClick={() => loadTemplate(t.emails)} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100">{t.name}</button>
                    <button onClick={() => removeTemplate(i)} className="text-gray-400 hover:text-red-500">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 mt-2">
              <input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Nazwa szablonu..."
                className="flex-1 border rounded-lg px-2 py-1 text-xs" onKeyDown={e => e.key === 'Enter' && saveTemplate()} />
              <button onClick={saveTemplate} disabled={!templateName.trim() || !signers.trim()}
                className="text-xs px-2 py-1 border rounded-lg hover:bg-gray-50 disabled:opacity-40">Zapisz</button>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Wiadomość (opcjonalnie)</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Wiadomość dla podpisującego..."
              className="w-full border rounded-xl px-3 py-2 text-sm resize-none" />
          </div>
        </div>
        <div className="px-6 py-4 border-t flex gap-3">
          <button onClick={onClose} className="flex-1 border rounded-xl py-2.5 text-sm text-gray-600 hover:bg-gray-50">Anuluj</button>
          <button onClick={handleSend} disabled={sending || !signers.trim()}
            className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50 hover:bg-blue-700">
            {sending ? 'Wysyłam...' : 'Wyślij do podpisu'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SignatureRequestModal
