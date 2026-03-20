import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'

interface FinancialStats {
  total_documents: number
  pending_signature: number
  completed: number
  overdue: number
  monthly_value: number
}

const FinancialDashboard: React.FC = () => {
  const [stats, setStats] = useState<FinancialStats>({ total_documents: 0, pending_signature: 0, completed: 0, overdue: 0, monthly_value: 0 })
  const [recentDocs, setRecentDocs] = useState<any[]>([])
  const [pendingDocs, setPendingDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const { data: docs } = await supabase.from('documents').select('id, name, status, created_at, updated_at, expires_at').order('created_at', { ascending: false }).limit(50)
    if (docs) {
      const now = new Date()
      const thisMonth = docs.filter(d => new Date(d.created_at).getMonth() === now.getMonth())
      const pending = docs.filter(d => d.status === 'sent' || d.status === 'client_signed')
      const completed = docs.filter(d => d.status === 'completed')
      const overdue = docs.filter(d => d.expires_at && new Date(d.expires_at) < now && d.status !== 'completed')
      setStats({ total_documents: docs.length, pending_signature: pending.length, completed: completed.length, overdue: overdue.length, monthly_value: thisMonth.length })
      setRecentDocs(docs.slice(0, 5))
      setPendingDocs(pending.slice(0, 8))
    }
    setLoading(false)
  }

  const statusColor: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    sent: 'bg-blue-100 text-blue-700',
    viewed: 'bg-yellow-100 text-yellow-700',
    client_signed: 'bg-orange-100 text-orange-700',
    completed: 'bg-green-100 text-green-700',
  }

  const statusLabel: Record<string, string> = {
    draft: 'Szkic', sent: 'Wysłano', viewed: 'Odczytano', client_signed: 'Podpisano', completed: 'Zakończono'
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" /></div>

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard finansowy</h1>
          <p className="text-sm text-gray-500 mt-0.5">Przegląd dokumentów i umów</p>
        </div>
        <button onClick={() => navigate('/construction/dms')} className="text-sm text-blue-600 hover:underline">← Dokumenty</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Wszystkie dokumenty', value: stats.total_documents, color: 'bg-blue-50', textColor: 'text-blue-700', icon: '📄' },
          { label: 'Oczekuje na podpis', value: stats.pending_signature, color: 'bg-orange-50', textColor: 'text-orange-700', icon: '✍️' },
          { label: 'Zakończone', value: stats.completed, color: 'bg-green-50', textColor: 'text-green-700', icon: '✅' },
          { label: 'Przeterminowane', value: stats.overdue, color: 'bg-red-50', textColor: 'text-red-700', icon: '⚠️' },
        ].map(s => (
          <div key={s.label} className={`${s.color} rounded-2xl p-5`}>
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className={`text-3xl font-bold ${s.textColor}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending signatures */}
        <div className="bg-white rounded-2xl border p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Oczekuje na podpis ({pendingDocs.length})</h2>
          {pendingDocs.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Brak dokumentów oczekujących</p>}
          <div className="space-y-2">
            {pendingDocs.map(d => (
              <div key={d.id} onClick={() => navigate(`/construction/dms/${d.id}`)} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl cursor-pointer border">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{d.name}</p>
                  <p className="text-xs text-gray-400">{new Date(d.created_at).toLocaleDateString('pl-PL')}</p>
                </div>
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[d.status] || 'bg-gray-100'}`}>
                  {statusLabel[d.status] || d.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent documents */}
        <div className="bg-white rounded-2xl border p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Ostatnie dokumenty</h2>
          <div className="space-y-2">
            {recentDocs.map(d => (
              <div key={d.id} onClick={() => navigate(`/construction/dms/${d.id}`)} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl cursor-pointer border">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{d.name}</p>
                  <p className="text-xs text-gray-400">{new Date(d.created_at).toLocaleDateString('pl-PL')}</p>
                </div>
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[d.status] || 'bg-gray-100'}`}>
                  {statusLabel[d.status] || d.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default FinancialDashboard
