import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useParams, useNavigate } from 'react-router-dom'

const RFQDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [rfq, setRfq] = useState<any>(null)
  const [responses, setResponses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)

  useEffect(() => { if (id) load() }, [id])

  const load = async () => {
    setLoading(true)
    const { data: r } = await supabase.from('rfq_requests').select('*').eq('id', id).single()
    const { data: resps } = await supabase.from('rfq_responses').select('*').eq('rfq_id', id).order('total_price', { ascending: true })
    setRfq(r)
    setResponses(resps || [])
    setLoading(false)
  }

  const handleChoose = async (responseId: string) => {
    await supabase.from('rfq_responses').update({ status: 'chosen' }).eq('id', responseId)
    await supabase.from('rfq_responses').update({ status: 'rejected' }).eq('rfq_id', id).neq('id', responseId)
    await supabase.from('rfq_requests').update({ status: 'closed' }).eq('id', id)
    load()
  }

  const handleClose = async () => {
    setClosing(true)
    await supabase.from('rfq_requests').update({ status: 'closed' }).eq('id', id)
    setClosing(false)
    load()
  }

  const fmt = (n: number) => n ? new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(n) : '—'

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" /></div>
  if (!rfq) return <div className="text-center py-20 text-gray-400">Zapytanie nie znalezione</div>

  const responded = responses.filter(r => r.status === 'responded' || r.status === 'chosen')
  const pending = responses.filter(r => r.status === 'pending')
  const chosen = responses.find(r => r.status === 'chosen')
  const minPrice = responded.length ? Math.min(...responded.map(r => r.total_price || Infinity)) : 0

  // All items across all responses for comparison header
  const allItems: string[] = rfq.items?.map((i: any) => i.name) || []

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/rfq')} className="text-gray-400 hover:text-gray-700">←</button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{rfq.title}</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(rfq.created_at).toLocaleDateString('pl-PL')}
            {rfq.deadline && ` · Termin: ${new Date(rfq.deadline).toLocaleDateString('pl-PL')}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${rfq.status === 'closed' ? 'bg-green-100 text-green-700' : rfq.status === 'sent' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
            {rfq.status === 'closed' ? 'Zamknięto' : rfq.status === 'sent' ? 'Oczekuje' : rfq.status}
          </span>
          {rfq.status !== 'closed' && <button onClick={handleClose} disabled={closing} className="px-3 py-1.5 border rounded-lg text-xs text-gray-600 hover:bg-gray-50">Zamknij zapytanie</button>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border rounded-2xl p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{responses.length}</p>
          <p className="text-xs text-gray-400 mt-1">Wysłano</p>
        </div>
        <div className="bg-white border rounded-2xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{responded.length}</p>
          <p className="text-xs text-gray-400 mt-1">Odpowiedzi</p>
        </div>
        <div className="bg-white border rounded-2xl p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{minPrice ? fmt(minPrice) : '—'}</p>
          <p className="text-xs text-gray-400 mt-1">Najlepsza cena</p>
        </div>
      </div>

      {/* Comparison table */}
      {responded.length > 0 && (
        <div className="bg-white border rounded-2xl overflow-hidden mb-6">
          <div className="px-5 py-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-900">Porównanie ofert</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 min-w-[160px]">Pozycja</th>
                  {responded.map(r => (
                    <th key={r.id} className={`px-4 py-3 text-center text-xs font-medium min-w-[140px] ${r.status === 'chosen' ? 'text-green-700 bg-green-50' : r.total_price === minPrice ? 'text-blue-700' : 'text-gray-500'}`}>
                      <div>{r.contractor_name || r.contractor_email}</div>
                      <div className={`text-base font-bold mt-0.5 ${r.status === 'chosen' ? 'text-green-700' : r.total_price === minPrice ? 'text-blue-700' : 'text-gray-700'}`}>{fmt(r.total_price)}</div>
                      {r.valid_until && <div className="text-xs font-normal text-gray-400 mt-0.5">ważna do {new Date(r.valid_until).toLocaleDateString('pl-PL')}</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allItems.map((itemName, idx) => (
                  <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700 font-medium">
                      {itemName}
                      {rfq.items?.[idx] && <span className="text-xs text-gray-400 ml-1">({rfq.items[idx].qty} {rfq.items[idx].unit})</span>}
                    </td>
                    {responded.map(r => {
                      const item = r.items?.find((i: any) => i.name === itemName)
                      return (
                        <td key={r.id} className={`px-4 py-3 text-center ${r.status === 'chosen' ? 'bg-green-50' : ''}`}>
                          {item ? (
                            <div>
                              <div className="font-medium">{item.unit_price ? `${item.unit_price} PLN/szt` : '—'}</div>
                              {item.total ? <div className="text-xs text-gray-400">{fmt(item.total)}</div> : null}
                            </div>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                {/* Notes row */}
                <tr className="border-b bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-400 font-medium">Uwagi</td>
                  {responded.map(r => (
                    <td key={r.id} className={`px-4 py-3 text-center text-xs text-gray-500 ${r.status === 'chosen' ? 'bg-green-50' : ''}`}>{r.notes || '—'}</td>
                  ))}
                </tr>
                {/* Action row */}
                {rfq.status !== 'closed' && (
                  <tr>
                    <td className="px-4 py-3 text-xs text-gray-400">Wybierz</td>
                    {responded.map(r => (
                      <td key={r.id} className={`px-4 py-3 text-center ${r.status === 'chosen' ? 'bg-green-50' : ''}`}>
                        {r.status === 'chosen'
                          ? <span className="text-green-600 font-medium text-xs">Wybrano</span>
                          : <button onClick={() => handleChoose(r.id)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700">Wybierz</button>
                        }
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <div className="bg-white border rounded-2xl p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Oczekujące ({pending.length})</h3>
          <div className="space-y-2">
            {pending.map(r => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm text-gray-700">{r.contractor_name || r.contractor_email}</p>
                  <p className="text-xs text-gray-400">{r.contractor_email}</p>
                </div>
                <span className="text-xs text-gray-400">Nie odpowiedział</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default RFQDetailPage
