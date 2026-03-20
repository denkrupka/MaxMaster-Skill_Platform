import React, { useEffect, useState } from 'react'

interface AnalyticsData {
  total_documents: number
  draft_count: number
  sent_count: number
  signed_count: number
  expired_count: number
  overdue_count: number
}

interface Props { supabase: any; companyId: string }

const DocumentAnalytics: React.FC<Props> = ({ supabase, companyId }) => {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [signStats, setSignStats] = useState({ avg_hours: 0, completion_rate: 0, total: 0, completed: 0 })

  useEffect(() => {
    const load = async () => {
      const { data: docs } = await supabase.from('documents')
        .select('status, expires_at').eq('company_id', companyId)
      if (!docs) { setLoading(false); return }
      const now = new Date()
      setData({
        total_documents: docs.length,
        draft_count: docs.filter((d: any) => d.status === 'draft').length,
        sent_count: docs.filter((d: any) => d.status === 'sent').length,
        signed_count: docs.filter((d: any) => d.status === 'signed').length,
        expired_count: docs.filter((d: any) => d.status === 'expired').length,
        overdue_count: docs.filter((d: any) => d.expires_at && new Date(d.expires_at) < now && !['signed','withdrawn','expired'].includes(d.status)).length,
      })
      setLoading(false)
    }
    load()
  }, [companyId])

  useEffect(() => {
    supabase.from('signature_requests').select('created_at, signed_at, status').then(({ data: reqData }: any) => {
      if (!reqData?.length) return
      const completed = reqData.filter((r: any) => r.status === 'signed' && r.signed_at)
      const avgMs = completed.length
        ? completed.reduce((s: number, r: any) => s + (new Date(r.signed_at).getTime() - new Date(r.created_at).getTime()), 0) / completed.length
        : 0
      setSignStats({
        avg_hours: Math.round(avgMs / 3600000),
        completion_rate: Math.round((completed.length / reqData.length) * 100),
        total: reqData.length,
        completed: completed.length
      })
    })
  }, [companyId])

  if (loading) return <div className="animate-pulse h-32 bg-gray-100 rounded-xl" />
  if (!data) return null

  const cards = [
    { label: 'Wszystkie', value: data.total_documents, color: 'bg-blue-50 text-blue-700' },
    { label: 'Szkice', value: data.draft_count, color: 'bg-gray-50 text-gray-600' },
    { label: 'Wysłane', value: data.sent_count, color: 'bg-blue-50 text-blue-700' },
    { label: 'Podpisane', value: data.signed_count, color: 'bg-green-50 text-green-700' },
    { label: 'Wygasłe', value: data.expired_count, color: 'bg-orange-50 text-orange-700' },
    { label: 'Przeterminowane', value: data.overdue_count, color: 'bg-red-50 text-red-700' },
  ]

  return (
    <>
    <div className="grid grid-cols-3 gap-3 mb-6 sm:grid-cols-6">
      {cards.map(c => (
        <div key={c.label} className={`rounded-xl p-3 text-center ${c.color}`}>
          <div className="text-2xl font-bold">{c.value}</div>
          <div className="text-xs mt-1">{c.label}</div>
        </div>
      ))}
    </div>
      {/* Signature stats */}
      {signStats.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-blue-700">{signStats.avg_hours}h</div>
            <div className="text-xs mt-1 text-blue-600">Śr. czas podpisu</div>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-green-700">{signStats.completion_rate}%</div>
            <div className="text-xs mt-1 text-green-600">Skuteczność</div>
          </div>
          <div className="bg-purple-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-purple-700">{signStats.completed}</div>
            <div className="text-xs mt-1 text-purple-600">Podpisane</div>
          </div>
          <div className="bg-orange-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-orange-700">{signStats.total - signStats.completed}</div>
            <div className="text-xs mt-1 text-orange-600">Oczekujące</div>
          </div>
        </div>
      )}
    </>
  )
}

export default DocumentAnalytics
