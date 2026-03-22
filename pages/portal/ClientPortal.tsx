import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const ClientPortal: React.FC = () => {
  const { token } = useParams<{ token: string }>()
  const [project, setProject] = useState<any>(null)
  const [documents, setDocuments] = useState<any[]>([])
  const [company, setCompany] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { if (token) loadPortal() }, [token])

  const loadPortal = async () => {
    setLoading(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('get_portal_data', { portal_token: token })

      if (rpcError) {
        console.error('Portal RPC error:', rpcError)
        // If RPC fails, try direct token lookup as fallback
        const { data: tokenData, error: tokenErr } = await supabase
          .from('client_portal_tokens')
          .select('*, projects(*), companies(*)')
          .eq('token', token)
          .eq('active', true)
          .single()

        if (tokenErr || !tokenData) {
          console.error('Direct token lookup also failed:', tokenErr)
          setError('Link jest nieważny lub wygasł')
          setLoading(false)
          return
        }

        // Check expiration
        if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
          setError('Link jest nieważny lub wygasł')
          setLoading(false)
          return
        }

        setProject(tokenData.projects)
        setCompany(tokenData.companies)
        // Load documents for the project
        if (tokenData.project_id) {
          const { data: docs } = await supabase
            .from('documents')
            .select('id, name, status, created_at')
            .eq('project_id', tokenData.project_id)
            .in('status', ['sent', 'client_signed', 'completed'])
          setDocuments(docs || [])
        }
        setLoading(false)
        return
      }

      if (!data || data.error) {
        console.error('Portal data error:', data?.error)
        setError('Link jest nieważny lub wygasł')
        setLoading(false)
        return
      }

      setProject(data.project)
      setCompany(data.company)
      setDocuments(data.documents || [])
    } catch (err) {
      console.error('ClientPortal loadPortal error:', err)
      setError('Wystąpił błąd podczas ładowania portalu')
    }
    setLoading(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center"><p className="text-2xl mb-2"></p><p className="text-gray-600">{error}</p></div>
    </div>
  )

  const primaryColor = company?.primary_color || '#2563eb'
  const statusLabel: Record<string, string> = { sent: 'Wysłano', client_signed: 'Podpisano', completed: 'Zakończono', draft: 'Szkic' }
  const statusColor: Record<string, string> = { sent: 'bg-blue-100 text-blue-700', client_signed: 'bg-orange-100 text-orange-700', completed: 'bg-green-100 text-green-700', draft: 'bg-gray-100 text-gray-600' }

  const projectStages = [
    { label: 'Planowanie', done: true },
    { label: 'Przygotowanie', done: project?.status !== 'planning' },
    { label: 'Realizacja', done: project?.status === 'completed' || project?.status === 'in_progress' },
    { label: 'Odbiór', done: project?.status === 'completed' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div style={{ backgroundColor: primaryColor }} className="text-white">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center gap-4 mb-6">
            {company?.logo_url ? (
              <img src={company.logo_url} alt="Logo" className="w-12 h-12 rounded-xl bg-white p-1 object-contain" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-xl font-bold">
                {company?.name?.[0] || 'M'}
              </div>
            )}
            <div>
              <p className="text-white/70 text-sm">Portal klienta</p>
              <p className="font-semibold">{company?.name || 'MaxMaster'}</p>
            </div>
          </div>
          <h1 className="text-2xl font-bold">{project?.name || 'Projekt'}</h1>
          {project?.address && <p className="text-white/80 text-sm mt-1">📍 {project.address}</p>}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Progress timeline */}
        <div className="bg-white rounded-2xl border p-6">
          <h2 className="font-semibold text-gray-900 mb-5">Postęp projektu</h2>
          <div className="flex items-center">
            {projectStages.map((stage, i) => (
              <React.Fragment key={stage.label}>
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 ${stage.done ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-200 text-gray-400'}`}>
                    {stage.done ? '✓' : i + 1}
                  </div>
                  <span className={`text-xs mt-1 font-medium ${stage.done ? 'text-green-600' : 'text-gray-400'}`}>{stage.label}</span>
                </div>
                {i < projectStages.length - 1 && <div className={`h-0.5 flex-1 mb-4 ${stage.done ? 'bg-green-400' : 'bg-gray-200'}`} />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Project details */}
        {(project?.start_date || project?.end_date || project?.budget) && (
          <div className="bg-white rounded-2xl border p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Szczegóły projektu</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {project.start_date && <div><p className="text-gray-500 text-xs">Data rozpoczęcia</p><p className="font-medium">{new Date(project.start_date).toLocaleDateString('pl-PL')}</p></div>}
              {project.end_date && <div><p className="text-gray-500 text-xs">Planowane zakończenie</p><p className="font-medium">{new Date(project.end_date).toLocaleDateString('pl-PL')}</p></div>}
              {project.budget && <div><p className="text-gray-500 text-xs">Budżet</p><p className="font-medium">{Number(project.budget).toLocaleString('pl-PL')} PLN</p></div>}
              {project.description && <div className="col-span-2"><p className="text-gray-500 text-xs">Opis</p><p>{project.description}</p></div>}
            </div>
          </div>
        )}

        {/* Documents */}
        <div className="bg-white rounded-2xl border p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Dokumenty ({documents.length})</h2>
          {documents.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Brak dokumentów do wyświetlenia</p>}
          <div className="space-y-2">
            {documents.map(d => (
              <div key={d.id} className="flex items-center justify-between p-3 border rounded-xl hover:bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-900">{d.name}</p>
                  <p className="text-xs text-gray-400">{new Date(d.created_at).toLocaleDateString('pl-PL')}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[d.status] || 'bg-gray-100 text-gray-600'}`}>
                  {statusLabel[d.status] || d.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400">Powered by MaxMaster • {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}

export default ClientPortal
