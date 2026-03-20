import React, { useState, useEffect } from 'react'

interface VarDef {
  id: string
  key: string
  label: string
}

const DocumentVariablesSettings: React.FC = () => {
  const [vars, setVars] = useState<VarDef[]>([])
  const [newKey, setNewKey] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('doc_variable_defs') || '[]')
    setVars(stored)
  }, [])

  const save = (updated: VarDef[]) => {
    localStorage.setItem('doc_variable_defs', JSON.stringify(updated))
    // Sync labels for VariablesPanel
    const labels: Record<string, string> = {}
    updated.forEach(v => { labels[v.key] = v.label })
    localStorage.setItem('doc_variable_labels', JSON.stringify(labels))
    setVars(updated)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const addVar = () => {
    if (!newKey.trim()) return
    const key = newKey.trim().replace(/[^a-zA-Z0-9_]/g, '_')
    if (vars.find(v => v.key === key)) return
    save([...vars, { id: Date.now().toString(), key, label: newLabel.trim() || key }])
    setNewKey('')
    setNewLabel('')
  }

  const deleteVar = (id: string) => save(vars.filter(v => v.id !== id))

  const updateVar = (id: string, field: 'key' | 'label', val: string) => {
    save(vars.map(v => v.id === id ? { ...v, [field]: val } : v))
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Zmienne dokumentów</h3>
        <p className="text-sm text-gray-500">
          Zdefiniuj zmienne używane w szablonach dokumentów. Każda zmienna ma symbol (np. <code className="bg-gray-100 px-1 rounded text-xs font-mono">{"{{annex_number}}"}</code>) i czytelną nazwę.
        </p>
      </div>

      {/* Dodaj nową */}
      <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200">
        <p className="text-xs font-medium text-gray-700 mb-3">Dodaj zmienną</p>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Symbol (bez nawiasów)</label>
            <input type="text" placeholder="np. annex_number"
              value={newKey} onChange={e => setNewKey(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              onKeyDown={e => e.key === 'Enter' && addVar()} />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Nazwa czytelna</label>
            <input type="text" placeholder="np. Numer aneksu"
              value={newLabel} onChange={e => setNewLabel(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              onKeyDown={e => e.key === 'Enter' && addVar()} />
          </div>
          <button onClick={addVar}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex-shrink-0">
            Dodaj
          </button>
        </div>
      </div>

      {/* Lista */}
      {vars.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">Brak zdefiniowanych zmiennych</p>
          <p className="text-xs mt-1">Dodaj zmienne aby były widoczne z nazwą w panelu edytora</p>
        </div>
      ) : (
        <div className="space-y-2">
          {vars.map(v => (
            <div key={v.id} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl">
              <span className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded-md flex-shrink-0 min-w-[120px]">
                {`{{${v.key}}}`}
              </span>
              <input type="text" value={v.label}
                onChange={e => updateVar(v.id, 'label', e.target.value)}
                placeholder="Nazwa czytelna..."
                className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              <button onClick={() => deleteVar(v.id)}
                className="text-gray-300 hover:text-red-400 p-1 rounded-lg hover:bg-red-50 flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {saved && (
        <div className="fixed bottom-6 right-6 bg-green-600 text-white text-sm px-4 py-2 rounded-xl shadow-lg">
          Zapisano
        </div>
      )}
    </div>
  )
}

export default DocumentVariablesSettings
