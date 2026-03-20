import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const DocumentCertificatePage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const [doc, setDoc] = useState<any>(null)
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (id) load() }, [id])

  const load = async () => {
    const [{ data: docData }, { data: reqData }] = await Promise.all([
      supabase.from('documents').select('*, document_templates(name), contractors(name), projects(name)').eq('id', id!).single(),
      supabase.from('signature_requests').select('*').eq('document_id', id!).order('created_at')
    ])
    setDoc(docData); setRequests(reqData || [])
    setLoading(false)
  }

  const statusColor = (s: string) => s === 'signed' ? 'bg-green-100 text-green-700' : s === 'pending' ? 'bg-yellow-100 text-yellow-700' : s === 'sent' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
  const statusLabel = (s: string) => s === 'signed' ? 'Podpisano' : s === 'pending' ? 'Oczekuje' : s === 'sent' ? 'Wysłano' : s

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>

  const docTitle = doc?.name || doc?.document_templates?.name || 'Dokument'
  const allSigned = requests.length > 0 && requests.every(r => r.status === 'signed')

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Certificate card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Header banner */}
          <div className={`px-8 py-6 ${allSigned ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-blue-600 to-blue-700'}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              </div>
              <div>
                <p className="text-white/80 text-xs font-medium uppercase tracking-wider">Certyfikat podpisu elektronicznego</p>
                <h1 className="text-white font-bold text-lg">{docTitle}</h1>
              </div>
            </div>
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${allSigned ? 'bg-white/20 text-white' : 'bg-white/20 text-white'}`}>
              {allSigned ? '✓ Podpisany przez wszystkie strony' : `${requests.filter(r=>r.status==='signed').length}/${requests.length} podpisów`}
            </div>
          </div>

          {/* Document info */}
          <div className="px-8 py-5 border-b bg-gray-50">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Dokument</p>
                <p className="text-sm font-medium text-gray-900">{docTitle}</p>
              </div>
              {doc?.contractors?.name && <div>
                <p className="text-xs text-gray-500 mb-0.5">Kontrahent</p>
                <p className="text-sm font-medium text-gray-900">{doc.contractors.name}</p>
              </div>}
              {doc?.projects?.name && <div>
                <p className="text-xs text-gray-500 mb-0.5">Projekt</p>
                <p className="text-sm font-medium text-gray-900">{doc.projects.name}</p>
              </div>}
              {doc?.created_at && <div>
                <p className="text-xs text-gray-500 mb-0.5">Data dokumentu</p>
                <p className="text-sm font-medium text-gray-900">{new Date(doc.created_at).toLocaleDateString('pl-PL')}</p>
              </div>}
            </div>
          </div>

          {/* Signatures list */}
          <div className="px-8 py-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Lista podpisujących</h3>
            {requests.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Brak podpisów</p>}
            <div className="space-y-4">
              {requests.map((r, i) => (
                <div key={r.id} className="flex items-start gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${r.status==='signed' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                    {r.status === 'signed' ? '✓' : (i+1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-gray-900 text-sm">{r.signer_name || r.signer_email}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(r.status)}`}>{statusLabel(r.status)}</span>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-500 flex-wrap">
                      {r.signer_email && <span>{r.signer_email}</span>}
                      {r.signed_at && <span>Podpisano: {new Date(r.signed_at).toLocaleString('pl-PL')}</span>}
                      {r.signature_method && <span>Metoda: {r.signature_method}</span>}
                    </div>
                    {r.signature_code && (
                      <div className="mt-2 flex items-center gap-2">
                        <p className="text-xs text-gray-400">Kod podpisu:</p>
                        <code className="text-xs bg-white border px-2 py-0.5 rounded font-mono text-gray-700">{r.signature_code}</code>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-4 bg-gray-50 border-t">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">Wygenerowano przez MaxMaster</p>
                <p className="text-xs text-gray-400">ID dokumentu: {id?.slice(0,8)}...</p>
              </div>
              <button onClick={() => {
                const style = document.createElement('style')
                style.innerHTML = '@media print { .no-print { display: none !important; } }'
                document.head.appendChild(style)
                window.print()
                setTimeout(() => document.head.removeChild(style), 1000)
              }} className="text-xs text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 no-print">
                Drukuj / PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DocumentCertificatePage
