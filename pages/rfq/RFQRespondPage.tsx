import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useParams } from 'react-router-dom'

const RFQRespondPage: React.FC = () => {
  const { token } = useParams<{ token: string }>()
  const [rfq, setRfq] = useState<any>(null)
  const [response, setResponse] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [totalPrice, setTotalPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [validUntil, setValidUntil] = useState('')

  useEffect(() => {
    if (token) loadRFQ()
  }, [token])

  const loadRFQ = async () => {
    setLoading(true)
    const { data: resp } = await supabase.from('rfq_responses').select('*, rfq_requests(*)').eq('token', token).single()
    if (resp) {
      setResponse(resp)
      setRfq(resp.rfq_requests)
      if (resp.status === 'responded') setDone(true)
      // Init prices from items
      const items = resp.rfq_requests?.items || []
      const init: Record<string, number> = {}
      items.forEach((it: any, i: number) => { init[i] = 0 })
      setPrices(init)
    }
    setLoading(false)
  }

  const calcTotal = () => {
    const items = rfq?.items || []
    return items.reduce((sum: number, it: any, i: number) => sum + (prices[i] || 0) * it.qty, 0).toFixed(2)
  }

  const handleSubmit = async () => {
    if (!response?.id) return
    setSaving(true)
    const items = rfq?.items || []
    const itemsWithPrices = items.map((it: any, i: number) => ({ ...it, unit_price: prices[i] || 0, total: (prices[i] || 0) * it.qty }))
    await supabase.from('rfq_responses').update({
      status: 'responded',
      items: itemsWithPrices,
      total_price: totalPrice ? parseFloat(totalPrice) : parseFloat(calcTotal()),
      notes,
      valid_until: validUntil || null,
      responded_at: new Date().toISOString()
    }).eq('token', token)
    setDone(true)
    setSaving(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" /></div>
  if (!rfq) return <div className="min-h-screen flex items-center justify-center text-gray-400">Zapytanie nie znalezione</div>

  if (done) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl p-10 text-center shadow-lg max-w-md">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Dziękujemy za ofertę!</h2>
        <p className="text-gray-500 text-sm">Twoja oferta została przesłana. Skontaktujemy się wkrótce.</p>
      </div>
    </div>
  )

  const items = rfq?.items || []

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-bold">M</div>
            <div>
              <p className="text-xs text-gray-400">MaxMaster</p>
              <h1 className="font-bold text-gray-900">{rfq.title}</h1>
            </div>
          </div>
          {rfq.description && <p className="text-sm text-gray-600 mb-3">{rfq.description}</p>}
          {rfq.deadline && <p className="text-xs text-orange-600 font-medium">⏰ Termin składania ofert: {new Date(rfq.deadline).toLocaleDateString('pl-PL')}</p>}
        </div>

        {/* Items */}
        <div className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
          <h3 className="font-semibold mb-4">Pozycje do wyceny</h3>
          <div className="space-y-3">
            {items.map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{item.name}</p>
                  <p className="text-xs text-gray-400">{item.qty} {item.unit}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={prices[i] || ''}
                    onChange={e => setPrices(p => ({ ...p, [i]: parseFloat(e.target.value) || 0 }))}
                    placeholder="Cena jedn."
                    className="w-28 border rounded-lg px-2 py-1.5 text-sm text-right"
                  />
                  <span className="text-xs text-gray-400">PLN/{item.unit}</span>
                </div>
                <div className="w-20 text-right text-sm font-medium text-gray-700">
                  {((prices[i] || 0) * item.qty).toFixed(2)} PLN
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t flex items-center justify-between">
            <span className="font-semibold">Łącznie (auto):</span>
            <span className="font-bold text-blue-700 text-lg">{calcTotal()} PLN</span>
          </div>
          <div className="mt-3">
            <label className="text-xs text-gray-500 mb-1 block">Cena całkowita (opcjonalnie — nadpisuje auto)</label>
            <input value={totalPrice} onChange={e => setTotalPrice(e.target.value)} type="number" placeholder={calcTotal()} className="w-full border rounded-xl px-3 py-2 text-sm" />
          </div>
        </div>

        {/* Extra fields */}
        <div className="bg-white rounded-2xl p-6 mb-4 shadow-sm space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Oferta ważna do</label>
            <input value={validUntil} onChange={e => setValidUntil(e.target.value)} type="date" className="w-full border rounded-xl px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Uwagi / warunki</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Warunki płatności, termin realizacji, dodatkowe informacje..." className="w-full border rounded-xl px-3 py-2 text-sm resize-none" />
          </div>
        </div>

        <button onClick={handleSubmit} disabled={saving} className="w-full bg-blue-600 text-white rounded-2xl py-4 font-semibold text-base disabled:opacity-50 shadow-lg">
          {saving ? 'Wysyłam...' : 'Wyślij ofertę'}
        </button>

        <p className="text-center text-xs text-gray-400 mt-4">MaxMaster · System zarządzania budową</p>
      </div>
    </div>
  )
}

export default RFQRespondPage
