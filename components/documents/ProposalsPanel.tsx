import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

interface Proposal {
  id: string
  proposed_by_name: string
  proposed_by_email: string
  diff_summary: string
  original_content: string
  proposed_content: string
  status: 'pending' | 'approved' | 'rejected' | 'partial'
  review_notes: string | null
  created_at: string
}

interface Props {
  documentId: string
  onClose: () => void
}

const ProposalsPanel: React.FC<Props> = ({ documentId, onClose }) => {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})
  const [processing, setProcessing] = useState<string | null>(null)

  const loadProposals = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('document_change_proposals')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
    setProposals(data || [])
    setLoading(false)
  }, [documentId])

  useEffect(() => {
    loadProposals()
  }, [loadProposals])

  const reviewProposal = async (id: string, status: 'approved' | 'rejected') => {
    setProcessing(id)
    await supabase
      .from('document_change_proposals')
      .update({
        status,
        review_notes: reviewNotes[id] || null,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', id)
    await loadProposals()
    setProcessing(null)
  }

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Oczekuje' },
      approved: { bg: 'bg-green-100', text: 'text-green-800', label: 'Zaakceptowano' },
      rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Odrzucono' },
      partial: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Czesciowo' },
    }
    const s = map[status] || map.pending
    return <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${s.bg} ${s.text}`}>{s.label}</span>
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch { return iso }
  }

  return (
    <div className="fixed right-0 top-0 h-full w-80 max-w-[90vw] z-50 shadow-xl md:relative md:shadow-none md:h-auto flex-shrink-0">
      <div className="bg-white rounded-xl border shadow-sm h-full md:h-auto md:sticky md:top-32 flex flex-col max-h-screen">
        <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0">
          <h3 className="font-semibold text-sm">Propozycje zmian</h3>
          <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">x</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="px-4 py-6 text-sm text-gray-400 text-center">Ladowanie...</div>
          )}

          {!loading && proposals.length === 0 && (
            <div className="px-4 py-6 text-sm text-gray-400 text-center">
              Brak propozycji zmian
            </div>
          )}

          {!loading && proposals.map(p => (
            <div key={p.id} className="px-4 py-3 border-b border-gray-100 last:border-b-0">
              <div className="flex items-start justify-between mb-1.5">
                <div>
                  <span className="text-xs font-medium text-gray-900">{p.proposed_by_name}</span>
                  {p.proposed_by_email && (
                    <span className="text-[10px] text-gray-400 ml-1">{p.proposed_by_email}</span>
                  )}
                </div>
                {statusBadge(p.status)}
              </div>

              <div className="text-xs text-gray-500 mb-2">{formatDate(p.created_at)}</div>

              {p.diff_summary && (
                <div className="text-xs text-gray-700 bg-gray-50 rounded-lg p-2.5 mb-2 leading-relaxed">
                  {p.diff_summary}
                </div>
              )}

              {p.original_content && p.proposed_content && (
                <details className="mb-2">
                  <summary className="text-[10px] text-gray-400 cursor-pointer hover:text-gray-600">
                    Podglad zmian
                  </summary>
                  <div className="mt-1.5 grid grid-cols-1 gap-1.5 text-[10px]">
                    <div className="p-2 bg-red-50 border border-red-200 rounded max-h-28 overflow-auto">
                      <div className="font-medium text-red-700 mb-0.5">Oryginal</div>
                      <div className="text-red-900 whitespace-pre-wrap">{p.original_content}</div>
                    </div>
                    <div className="p-2 bg-green-50 border border-green-200 rounded max-h-28 overflow-auto">
                      <div className="font-medium text-green-700 mb-0.5">Proponowane</div>
                      <div className="text-green-900 whitespace-pre-wrap">{p.proposed_content}</div>
                    </div>
                  </div>
                </details>
              )}

              {p.status === 'pending' && (
                <div className="space-y-1.5 mt-2">
                  <textarea
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Komentarz do decyzji (opcjonalnie)..."
                    rows={2}
                    value={reviewNotes[p.id] || ''}
                    onChange={e => setReviewNotes(prev => ({ ...prev, [p.id]: e.target.value }))}
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => reviewProposal(p.id, 'approved')}
                      disabled={processing === p.id}
                      className="flex-1 px-2.5 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
                    >
                      {processing === p.id ? 'Zapisywanie...' : 'Zaakceptuj'}
                    </button>
                    <button
                      onClick={() => reviewProposal(p.id, 'rejected')}
                      disabled={processing === p.id}
                      className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      Odrzuc
                    </button>
                  </div>
                </div>
              )}

              {p.status !== 'pending' && p.review_notes && (
                <div className="text-[10px] text-gray-400 mt-1.5 italic">
                  Komentarz: {p.review_notes}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ProposalsPanel
