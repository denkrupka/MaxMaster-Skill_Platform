import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { renderWithTrackChanges } from '../../utils/trackChanges'

interface Proposal {
  id: string
  proposed_by_name: string
  proposed_by_email: string
  diff_summary: string
  original_content: string
  proposed_content: string
  patches: any[] | null
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
  const [expanded, setExpanded] = useState<string | null>(null)
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
      partial: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Częściowo' },
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
    <div className="fixed right-0 top-0 h-full w-[420px] max-w-[90vw] z-50 shadow-xl md:relative md:shadow-none md:h-auto flex-shrink-0">
      <div className="bg-white rounded-xl border shadow-sm h-full md:h-auto md:sticky md:top-32 flex flex-col max-h-screen">
        <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0">
          <h3 className="font-semibold text-sm">Propozycje zmian</h3>
          <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="px-4 py-6 text-sm text-gray-400 text-center">Ładowanie...</div>
          )}

          {!loading && proposals.length === 0 && (
            <div className="px-4 py-6 text-sm text-gray-400 text-center">
              Brak propozycji zmian
            </div>
          )}

          {!loading && proposals.map(p => (
            <div key={p.id} className="border-b border-gray-100 last:border-b-0">
              {/* Header */}
              <div className="px-4 py-3 flex items-start justify-between">
                <div>
                  <span className="text-xs font-medium text-gray-900">{p.proposed_by_name}</span>
                  {p.proposed_by_email && (
                    <span className="text-[10px] text-gray-400 ml-1">{p.proposed_by_email}</span>
                  )}
                  <div className="text-xs text-gray-400 mt-0.5">{formatDate(p.created_at)}</div>
                </div>
                <div className="flex items-center gap-2">
                  {statusBadge(p.status)}
                </div>
              </div>

              {/* Summary */}
              {p.diff_summary && (
                <div className="px-4 pb-2">
                  <div className="text-xs text-gray-700 bg-gray-50 rounded-lg p-2.5 leading-relaxed">
                    {p.diff_summary}
                  </div>
                </div>
              )}

              {/* Track Changes toggle */}
              {p.original_content && p.proposed_content && (
                <div className="px-4 pb-2">
                  <button
                    onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {expanded === p.id ? '▾ Zwiń podgląd zmian' : '▸ Podgląd zmian (Track Changes)'}
                  </button>
                </div>
              )}

              {/* Inline diff view — Word-style track changes */}
              {expanded === p.id && p.original_content && p.proposed_content && (
                <div className="px-4 pb-3">
                  <div className="border border-gray-200 rounded-lg p-3 bg-white text-sm leading-relaxed max-h-80 overflow-y-auto">
                    {/* Legend */}
                    <div className="text-[10px] text-gray-500 mb-2 flex gap-3 pb-2 border-b border-gray-100">
                      <span>
                        <ins style={{ background: '#d4edda', textDecoration: 'underline', padding: '0 3px', color: '#155724', borderRadius: 2, fontSize: '10px' }}>Dodano</ins>
                      </span>
                      <span>
                        <del style={{ background: '#f8d7da', textDecoration: 'line-through', padding: '0 3px', color: '#721c24', borderRadius: 2, fontSize: '10px' }}>Usunięto</del>
                      </span>
                    </div>
                    <div
                      dangerouslySetInnerHTML={{
                        __html: renderWithTrackChanges(
                          p.original_content,
                          p.proposed_content,
                          p.patches || null,
                          p.proposed_by_name
                        )
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Review actions */}
              {p.status === 'pending' && (
                <div className="px-4 pb-3 space-y-1.5">
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
                      {processing === p.id ? 'Zapisywanie...' : '✓ Zaakceptuj zmiany'}
                    </button>
                    <button
                      onClick={() => reviewProposal(p.id, 'rejected')}
                      disabled={processing === p.id}
                      className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      ✕ Odrzuć
                    </button>
                  </div>
                </div>
              )}

              {p.status !== 'pending' && p.review_notes && (
                <div className="px-4 pb-3 text-[10px] text-gray-400 italic">
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
