import React, { useState, useEffect } from 'react'
import { Editor } from '@tiptap/react'

interface Variable {
  name: string
  label: string
  value: string
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
    const matches = [...new Set(content.match(/\{\{(\w+)\}\}/g) || [])]
    const labels: Record<string, string> = JSON.parse(localStorage.getItem('doc_variable_labels') || '{}')
    const saved: Record<string, string> = JSON.parse(localStorage.getItem('doc_variables') || '{}')
    
    const extracted = matches.map(m => {
      const name = m.replace(/\{\{|\}\}/g, '')
      return {
        name,
        label: labels[name] || '',
        value: saved[name] || ''
      }
    })
    setVariables(extracted)
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

  const filtered = variables.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.label.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fixed right-0 top-0 h-full w-80 max-w-[90vw] bg-white border-l border-gray-200 flex flex-col z-50 shadow-xl md:relative md:shadow-none">
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

      <div className="px-3 py-2 border-b border-gray-100">
        <input type="text" placeholder="Szukaj zmiennej..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-xs text-gray-400">{search ? 'Nie znaleziono' : 'Brak zmiennych {{}} w dokumencie'}</p>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {filtered.map(v => (
              <div key={v.name} className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-start justify-between mb-2 gap-2">
                  <div className="min-w-0">
                    {v.label && (
                      <p className="text-xs font-medium text-gray-800 mb-0.5 truncate">{v.label}</p>
                    )}
                    <span className="text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md">
                      {`{{${v.name}}}`}
                    </span>
                  </div>
                  <button
                    onClick={() => insertVariable(v.name)}
                    className="flex-shrink-0 flex items-center gap-1 text-xs px-2 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                    </svg>
                    Wstaw
                  </button>
                </div>
                <input type="text"
                  placeholder={v.label ? `Wartość: ${v.label}` : `Wartość dla {{${v.name}}}...`}
                  value={v.value}
                  onChange={e => updateValue(v.name, e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
        <p className="text-xs text-gray-400">Zaznacz miejsce w tekście i kliknij "Wstaw"</p>
      </div>
    </div>
  )
}

export default VariablesPanel
