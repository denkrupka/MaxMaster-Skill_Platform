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
        <button onClick={() => setShowNew(true)} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
          + Nowy wpis
        </button>
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" /></div> : (
        <div className="space-y-4">
          {entries.length === 0 && <div className="text-center py-16 text-gray-400"><p className="text-4xl mb-3">📔</p><p>Brak wpisów</p><p className="text-sm mt-1">Dodaj pierwszy wpis do dziennika budowy</p></div>}
          {entries.map(e => (
            <div key={e.id} className="bg-white border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-gray-900">{new Date(e.entry_date).toLocaleDateString('pl-PL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  {e.weather && <span>🌤 {e.weather}</span>}
                  {e.temperature != null && <span>{e.temperature}°C</span>}
                  {e.workers_count > 0 && <span>👷 {e.workers_count} os.</span>}
                </div>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{e.work_description}</p>
              {e.equipment && <p className="text-xs text-gray-500 mt-2">🔧 Sprzęt: {e.equipment}</p>}
              {e.notes && <p className="text-xs text-gray-500 mt-1">📝 Uwagi: {e.notes}</p>}
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
              <button onClick={() => setShowNew(false)} className="text-gray-400 text-xl">✕</button>
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
