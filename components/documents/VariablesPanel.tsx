import React, { useState, useEffect } from 'react'
import { Editor } from '@tiptap/react'

interface Variable {
  name: string
  value: string
  description?: string
}

interface VariablesPanelProps {
  editor: Editor | null
  content: string
  onClose: () => void
}

const VariablesPanel: React.FC<VariablesPanelProps> = ({ editor, content, onClose }) => {
  const [variables, setVariables] = useState<Variable[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    // Extract all {{variable}} from content
    const matches = [...new Set(content.match(/\{\{(\w+)\}\}/g) || [])]
    const extracted = matches.map(m => {
      const name = m.replace(/\{\{|\}\}/g, '')
      return { name, value: '', description: '' }
    })
    
    // Load saved values from localStorage
    const saved = JSON.parse(localStorage.getItem('doc_variables') || '{}')
    const merged = extracted.map(v => ({
      ...v,
      value: saved[v.name] || ''
    }))
    setVariables(merged)
  }, [content])

  const updateValue = (name: string, value: string) => {
    setVariables(prev => prev.map(v => v.name === name ? { ...v, value } : v))
    const saved = JSON.parse(localStorage.getItem('doc_variables') || '{}')
    saved[name] = value
    localStorage.setItem('doc_variables', JSON.stringify(saved))
  }

  const insertVariable = (name: string) => {
    if (!editor) return
    editor.chain().focus().insertContent(`{{${name}}}`).run()
  }

  const filtered = variables.filter(v => v.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="w-80 flex-shrink-0">
      <div className="bg-white rounded-xl border shadow-sm sticky top-32 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Zmienne dokumentu</h3>
            <p className="text-xs text-gray-400 mt-0.5">{variables.length} zmiennych</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-gray-100">
          <input
            type="text"
            placeholder="Szukaj zmiennej..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Variables list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-6 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-gray-200 mx-auto mb-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
              </svg>
              <p className="text-xs text-gray-400">
                {search ? 'Nie znaleziono zmiennej' : 'Brak zmiennych {{}} w dokumencie'}
              </p>
            </div>
          ) : (
            <div className="p-3 space-y-3">
              {filtered.map(v => (
                <div key={v.name} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                      {`{{${v.name}}}`}
                    </span>
                    <button
                      onClick={() => insertVariable(v.name)}
                      title="Wstaw do tekstu"
                      className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                      </svg>
                      Wstaw
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder={`Wartość dla ${v.name}...`}
                    value={v.value}
                    onChange={e => updateValue(v.name, e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <p className="text-xs text-gray-400">Zaznacz miejsce w tekście i kliknij "Wstaw" aby dodać zmienną</p>
        </div>
      </div>
    </div>
  )
}

export default VariablesPanel
