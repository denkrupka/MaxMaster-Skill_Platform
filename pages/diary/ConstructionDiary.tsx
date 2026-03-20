import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useParams } from 'react-router-dom'

const ConstructionDiary: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>()
  const [entries, setEntries] = useState<any[]>([])
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(true)

  // Form
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0])
  const [weather, setWeather] = useState('')
  const [temperature, setTemperature] = useState('')
  const [workDesc, setWorkDesc] = useState('')
  const [workersCount, setWorkersCount] = useState('')
  const [equipment, setEquipment] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const WEATHER_OPTIONS = ['Słonecznie', 'Pochmurno', 'Deszczowo', 'Śnieg', 'Mróz', 'Wietrzno', 'Mgła']

  useEffect(() => { loadEntries() }, [projectId])

  const loadEntries = async () => {
    setLoading(true)
    let q = supabase.from('construction_diary').select('*').order('entry_date', { ascending: false })
    if (projectId) q = q.eq('project_id', projectId)
    const { data } = await q
    setEntries(data || [])
    setLoading(false)
  }

  const handleSave = async () => {
    if (!workDesc.trim()) return
    setSaving(true)
    const { data: user } = await supabase.auth.getUser()
    await supabase.from('construction_diary').insert({
      project_id: projectId || null,
      entry_date: entryDate,
      weather,
      temperature: temperature ? Number(temperature) : null,
      work_description: workDesc,
      workers_count: workersCount ? Number(workersCount) : 0,
      equipment: equipment || null,
      notes: notes || null,
      author_name: user.user?.email || 'Autor',
    })
    setShowNew(false)
    setWorkDesc(''); setWeather(''); setTemperature(''); setWorkersCount(''); setEquipment(''); setNotes('')
    loadEntries()
    setSaving(false)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dziennik budowy</h1>
          <p className="text-sm text-gray-500 mt-0.5">Elektroniczny dziennik prowadzenia robót</p>
        </div>
        <button onClick={() => setShowNew(true)} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nowy wpis
        </button>
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" /></div> : (
        <div className="space-y-4">
          {entries.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <div className="flex justify-center mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-gray-300">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                </svg>
              </div>
              <p>Brak wpisów</p>
              <p className="text-sm mt-1">Dodaj pierwszy wpis do dziennika budowy</p>
            </div>
          )}
          {entries.map(e => (
            <div key={e.id} className="bg-white border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-gray-900">{new Date(e.entry_date).toLocaleDateString('pl-PL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  {e.weather && (
                    <span className="flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.332-7.257 3 3 0 0 0-3.758-3.848 5.25 5.25 0 0 0-10.233 2.33A4.502 4.502 0 0 0 2.25 15Z" />
                      </svg>
                      {e.weather}
                    </span>
                  )}
                  {e.temperature != null && <span>{e.temperature}°C</span>}
                  {e.workers_count > 0 && (
                    <span className="flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                      </svg>
                      {e.workers_count} os.
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{e.work_description}</p>
              {e.equipment && (
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" />
                  </svg>
                  Sprzęt: {e.equipment}
                </p>
              )}
              {e.notes && (
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                  Uwagi: {e.notes}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-3 pt-3 border-t">Autor: {e.author_name}</p>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white">
              <h3 className="font-semibold">Nowy wpis do dziennika</h3>
              <button onClick={() => setShowNew(false)} className="text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Data</label>
                <input value={entryDate} onChange={e => setEntryDate(e.target.value)} type="date" className="w-full border rounded-xl px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Pogoda</label>
                  <select value={weather} onChange={e => setWeather(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm">
                    <option value="">— wybierz —</option>
                    {WEATHER_OPTIONS.map(w => <option key={w}>{w}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Temperatura (°C)</label>
                  <input value={temperature} onChange={e => setTemperature(e.target.value)} type="number" placeholder="np. 15" className="w-full border rounded-xl px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Opis wykonanych prac *</label>
                <textarea value={workDesc} onChange={e => setWorkDesc(e.target.value)} rows={4} placeholder="Opisz co było wykonywane tego dnia..." className="w-full border rounded-xl px-3 py-2 text-sm resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Liczba pracowników</label>
                  <input value={workersCount} onChange={e => setWorkersCount(e.target.value)} type="number" placeholder="0" className="w-full border rounded-xl px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Sprzęt</label>
                  <input value={equipment} onChange={e => setEquipment(e.target.value)} placeholder="koparka, rusztowanie..." className="w-full border rounded-xl px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Uwagi / Problemy</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Opóźnienia, problemy, decyzje..." className="w-full border rounded-xl px-3 py-2 text-sm resize-none" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowNew(false)} className="flex-1 border rounded-xl py-2.5 text-sm text-gray-600">Anuluj</button>
                <button onClick={handleSave} disabled={saving || !workDesc} className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50">
                  {saving ? 'Zapisuję...' : 'Zapisz wpis'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ConstructionDiary
