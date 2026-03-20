import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useParams, useNavigate } from 'react-router-dom'

const DocumentCertificatePage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [doc, setDoc] = useState<any>(null)
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([
      supabase.from('documents').select('*').eq('id', id).single(),
      supabase.from('signature_requests').select('*').eq('document_id', id).order('created_at')
    ]).then(([{ data: d }, { data: r }]) => {
      setDoc(d)
      setRequests(r || [])
      setLoading(false)
    })
  }, [id])

  const allSigned = requests.length > 0 && requests.every(r => r.status === 'signed')
  const signedCount = requests.filter(r => r.status === 'signed').length

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4">
      {/* Toolbar */}
      <div className="max-w-2xl mx-auto mb-4 flex items-center justify-between no-print">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Powrót
        </button>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
            </svg>
            Drukuj
          </button>
        </div>
      </div>

      {/* Certificate */}
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden print:shadow-none print:border print:rounded-none">
        {/* Header */}
        <div className={`px-8 py-6 ${allSigned ? 'bg-gradient-to-r from-green-600 to-green-700' : 'bg-gradient-to-r from-blue-600 to-blue-700'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/70 text-xs font-medium uppercase tracking-widest mb-1">MaxMaster</p>
              <h1 className="text-white text-xl font-bold">Certyfikat podpisu elektronicznego</h1>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="white" className="w-7 h-7">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Status banner */}
        <div className={`px-8 py-3 flex items-center gap-3 ${allSigned ? 'bg-green-50 border-b border-green-100' : 'bg-blue-50 border-b border-blue-100'}`}>
          <div className={`w-2 h-2 rounded-full ${allSigned ? 'bg-green-500' : 'bg-blue-500'} animate-pulse`} />
          <p className={`text-sm font-medium ${allSigned ? 'text-green-700' : 'text-blue-700'}`}>
            {allSigned ? 'Dokument podpisany przez wszystkich sygnatariuszy' : `Podpisano przez ${signedCount} z ${requests.length} sygnatariuszy`}
          </p>
        </div>

        {/* Document info */}
        <div className="px-8 py-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{doc?.name || 'Dokument'}</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">ID dokumentu</p>
              <p className="font-mono text-gray-700 text-xs">{doc?.id?.slice(0, 8).toUpperCase()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Data utworzenia</p>
              <p className="text-gray-700">{doc?.created_at ? new Date(doc.created_at).toLocaleDateString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Typ</p>
              <p className="text-gray-700 capitalize">{doc?.document_type || 'Dokument'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Status</p>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${allSigned ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                {allSigned ? 'Zakończono' : 'W trakcie'}
              </span>
            </div>
          </div>
        </div>

        {/* Signatories */}
        {requests.length > 0 && (
          <div className="px-8 py-6 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Sygnatariusze</h3>
            <div className="space-y-3">
              {requests.map((r, i) => (
                <div key={r.id} className="flex items-center justify-between py-3 border-b last:border-0 border-gray-50">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${r.status === 'signed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{r.signer_name || r.signer_email}</p>
                      <p className="text-xs text-gray-400">{r.signer_email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {r.status === 'signed' ? (
                      <>
                        <div className="flex items-center gap-1 text-green-600">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                          <span className="text-xs font-medium">Podpisano</span>
                        </div>
                        {r.signed_at && <p className="text-xs text-gray-400 mt-0.5">{new Date(r.signed_at).toLocaleDateString('pl-PL')}</p>}
                      </>
                    ) : (
                      <span className="text-xs text-gray-400">Oczekuje</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-8 py-5 bg-gray-50 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">Wygenerowano przez MaxMaster</p>
            <p className="text-xs text-gray-400">{new Date().toLocaleDateString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-gray-500">maxmaster.info</p>
            <p className="text-xs text-gray-400">System zarządzania budową</p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>
    </div>
  )
}

export default DocumentCertificatePage
