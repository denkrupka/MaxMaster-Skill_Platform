import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'

const RFQPage: React.FC = () => {
  const [requests, setRequests] = useState<any[]>([])
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  // New RFQ form
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [contractors, setContractors] = useState([{ email: '', name: '' }])
  const [items, setItems] = useState([{ name: '', unit: 'szt', qty: 1, notes: '' }])
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadRequests() }, [])

  const loadRequests = async () => {
    setLoading(true)
    const { data } = await supabase.from('rfq_requests').select('*, rfq_responses(id)').order('created_at', { ascending: false })
    setRequests(data || [])
    setLoading(false)
  }

  const handleCreate = async () => {
    if (!title.trim()) return
    setSaving(true)
    const { data: rfq } = await supabase.from('rfq_requests').insert({ title, description, deadline: deadline || null, items, status: 'sent' }).select('id').single()
    if (rfq?.id) {
      // Send to contractors via EF
      for (const c of contractors.filter(c => c.email)) {
        const { data: resp } = await supabase.from('rfq_responses').insert({ rfq_id: rfq.id, contractor_email: c.email, contractor_name: c.name }).select('token').single()
        if (resp?.token) {
          await supabase.functions.invoke('send-rfq', { body: { rfq_id: rfq.id, token: resp.token, contractor_email: c.email, contractor_name: c.name, title, description, deadline, items } }).catch(() => {})
        }
      }
      setShowNew(false)
      setTitle(''); setDescription(''); setDeadline(''); setContractors([{ email: '', name: '' }]); setItems([{ name: '', unit: 'szt', qty: 1, notes: '' }])
      loadRequests()
    }
    setSaving(false)
  }

  const statusColor: Record<string, string> = { draft: 'bg-gray-100 text-gray-600', sent: 'bg-blue-100 text-blue-700', closed: 'bg-green-100 text-green-700' }
  const statusLabel: Record<string, string> = { draft: 'Szkic', sent: 'Wysłano', closed: 'Zamknięto' }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Zapytania ofertowe (RFQ)</h1>
          <p className="text-sm text-gray-500 mt-0.5">Wysyłaj zapytania do wielu podwykonawców jednocześnie</p>
        </div>
        <button onClick={() => setShowNew(true)} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
          + Nowe zapytanie
        </button>
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" /></div> : (
        <div className="space-y-3">
          {requests.length === 0 && <div className="text-center py-16 text-gray-400"><p className="text-4xl mb-3">📋</p><p>Brak zapytań ofertowych</p><p className="text-sm mt-1">Utwórz pierwsze zapytanie i wyślij do podwykonawców</p></div>}
          {requests.map(r => (
            <div key={r.id} onClick={() => navigate(`/rfq/${r.id}`)} className="bg-white border rounded-2xl p-4 hover:shadow-md cursor-pointer transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{r.title}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(r.created_at).toLocaleDateString("pl-PL")} • {r.rfq_responses?.length || 0} odpowiedzi</p>
                </div>
                <div className="flex items-center gap-3">
                  {r.deadline && <span className="text-xs text-gray-500">do {new Date(r.deadline).toLocaleDateString("pl-PL")}</span>}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[r.status] || "bg-gray-100"}`}>{statusLabel[r.status] || r.status}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New RFQ Modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white">
              <h3 className="font-semibold">Nowe zapytanie ofertowe</h3>
              <button onClick={() => setShowNew(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Tytuł zapytania *</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="np. Zapytanie na roboty dekarskie" className="w-full border rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Opis</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Szczegóły zakresu prac..." className="w-full border rounded-xl px-3 py-2 text-sm resize-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Termin składania ofert</label>
                <input value={deadline} onChange={e => setDeadline(e.target.value)} type="date" className="w-full border rounded-xl px-3 py-2 text-sm" />
              </div>

              {/* Pozycje */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-700">Pozycje</label>
                  <button onClick={() => setItems(p => [...p, { name: '', unit: 'szt', qty: 1, notes: '' }])} className="text-xs text-blue-600">+ Dodaj</button>
                </div>
                {items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 mb-2">
                    <input value={item.name} onChange={e => setItems(p => p.map((x, j) => j===i?{...x,name:e.target.value}:x))} placeholder="Nazwa pozycji" className="col-span-5 border rounded-lg px-2 py-1.5 text-xs" />
                    <input value={item.qty} onChange={e => setItems(p => p.map((x, j) => j===i?{...x,qty:Number(e.target.value)}:x))} type="number" placeholder="Ilość" className="col-span-2 border rounded-lg px-2 py-1.5 text-xs" />
                    <select value={item.unit} onChange={e => setItems(p => p.map((x, j) => j===i?{...x,unit:e.target.value}:x))} className="col-span-2 border rounded-lg px-1 py-1.5 text-xs">
                      <option>szt</option><option>m</option><option>m²</option><option>m³</option><option>kg</option><option>h</option>
                    </select>
                    <input value={item.notes} onChange={e => setItems(p => p.map((x, j) => j===i?{...x,notes:e.target.value}:x))} placeholder="Uwagi" className="col-span-3 border rounded-lg px-2 py-1.5 text-xs" />
                  </div>
                ))}
              </div>

              {/* Podwykonawcy */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-700">Podwykonawcy</label>
                  <button onClick={() => setContractors(p => [...p, { email: '', name: '' }])} className="text-xs text-blue-600">+ Dodaj</button>
                </div>
                {contractors.map((c, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2 mb-2">
                    <input value={c.name} onChange={e => setContractors(p => p.map((x, j) => j===i?{...x,name:e.target.value}:x))} placeholder="Nazwa firmy" className="border rounded-lg px-2 py-1.5 text-xs" />
                    <input value={c.email} onChange={e => setContractors(p => p.map((x, j) => j===i?{...x,email:e.target.value}:x))} placeholder="email@firma.pl" className="border rounded-lg px-2 py-1.5 text-xs" />
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowNew(false)} className="flex-1 border rounded-xl py-2.5 text-sm text-gray-600">Anuluj</button>
                <button onClick={handleCreate} disabled={saving || !title} className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50">
                  {saving ? 'Wysyłam...' : 'Wyślij zapytanie'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RFQPage
