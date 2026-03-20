import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useParams } from 'react-router-dom'

const ClientPortalPage: React.FC = () => {
  const { token } = useParams<{ token: string }>()
  const [portalData, setPortalData] = useState<any>(null)
  const [project, setProject] = useState<any>(null)
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { if (token) loadPortal() }, [token])

  const loadPortal = async () => {
    setLoading(true)
    const { data: pt } = await supabase.from('client_portal_tokens').select('*').eq('token', token).eq('active', true).single()
    if (!pt) { setError('Link jest nieważny lub wygasł'); setLoading(false); return }
    setPortalData(pt)

    // Load project
    if (pt.project_id) {
      const { data: proj } = await supabase.from('projects').select('*').eq('id', pt.project_id).single()
      setProject(proj)
      // Load project documents
      const { data: docs } = await supabase.from('documents').select('id,name,status,created_at').eq('project_id', pt.project_id).order('created_at', { ascending: false }).limit(10)
      setDocuments(docs || [])
    }
    setLoading(false)
  }

  const statusColor: Record<string, string> = { draft: 'bg-gray-100 text-gray-600', sent: 'bg-blue-100 text-blue-700', signed: 'bg-green-100 text-green-700', completed: 'bg-green-100 text-green-700', expired: 'bg-red-100 text-red-600' }
  const statusLabel: Record<string, string> = { draft: 'Szkic', sent: 'Wysłano', client_signed: 'Podpisano', completed: 'Zakończono', expired: 'Wygasło' }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" /></div>
  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-orange-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Link wygasł</h2>
        <p className="text-sm text-gray-500">{error}</p>
        <p className="text-xs text-gray-400 mt-3">Skontaktuj się z nadawcą, aby otrzymać nowy link dostępu.</p>
      </div>
    </div>
  )

  const progress = project?.progress || 0

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl p-6 mb-4 shadow-sm text-center">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mx-auto mb-3">M</div>
          <h1 className="text-xl font-bold text-gray-900">{project?.name || portalData?.label || 'Projekt'}</h1>
          <p className="text-sm text-gray-400 mt-1">Portal klienta · MaxMaster</p>
        </div>

        {/* Progress */}
        {project && (
          <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Postęp realizacji</h3>
              <span className="text-lg font-bold text-blue-600">{progress}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 mb-3">
              <div className="h-3 bg-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {project.start_date && <div><p className="text-xs text-gray-400">Rozpoczęcie</p><p className="font-medium">{new Date(project.start_date).toLocaleDateString('pl-PL')}</p></div>}
              {project.end_date && <div><p className="text-xs text-gray-400">Planowane zakończenie</p><p className="font-medium">{new Date(project.end_date).toLocaleDateString('pl-PL')}</p></div>}
              {project.budget && <div><p className="text-xs text-gray-400">Budżet</p><p className="font-medium">{new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(project.budget)}</p></div>}
              {project.status && <div><p className="text-xs text-gray-400">Status</p><p className="font-medium capitalize">{project.status}</p></div>}
            </div>
          </div>
        )}

        {/* Documents */}
        {documents.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4">Dokumenty</h3>
            <div className="space-y-2">
              {documents.map(doc => (
                <div key={doc.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                    <p className="text-xs text-gray-400">{new Date(doc.created_at).toLocaleDateString('pl-PL')}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[doc.status] || 'bg-gray-100 text-gray-600'}`}>{statusLabel[doc.status] || doc.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">MaxMaster · System zarządzania budową</p>
      </div>
    </div>
  )
}

export default ClientPortalPage
