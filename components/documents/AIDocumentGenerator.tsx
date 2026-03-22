import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Props {
  onClose: () => void
  onCreated: (id: string) => void
}

const CONTRACT_TYPES = [
  { value: 'umowa_o_roboty', label: 'Umowa o roboty budowlane' },
  { value: 'umowa_zlecenie', label: 'Umowa zlecenie' },
  { value: 'umowa_o_dzielo', label: 'Umowa o dzieło' },
  { value: 'umowa_najmu', label: 'Umowa najmu' },
  { value: 'protokol_odbioru', label: 'Protokół odbioru' },
  { value: 'aneks', label: 'Aneks do umowy' },
]

interface PartyInput {
  name: string
  nip: string
  address: string
  phone: string
  email: string
}

const emptyParty = (): PartyInput => ({ name: '', nip: '', address: '', phone: '', email: '' })

export const AIDocumentGenerator: React.FC<Props> = ({ onClose, onCreated }) => {
  const [contractType, setContractType] = useState('umowa_o_roboty')
  const [description, setDescription] = useState('')
  const [aiParties, setAiParties] = useState<PartyInput[]>([emptyParty(), emptyParty()])
  const [amount, setAmount] = useState('')
  const [deadline, setDeadline] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const updateParty = (idx: number, field: keyof PartyInput, value: string) => {
    setAiParties(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p))
  }

  const handleGenerate = async () => {
    if (!description.trim()) { setError('Opisz zakres prac'); return }
    setLoading(true)
    setError('')
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('generate-document-ai', {
        body: {
          contractType,
          description,
          party1: { nip: aiParties[0]?.nip, name: aiParties[0]?.name },
          party2: { name: aiParties[1]?.name },
          parties: aiParties,
          amount,
          deadline,
        }
      })
      if (fnErr) throw fnErr
      if (data?.document_id) onCreated(data.document_id)
    } catch (e: any) {
      setError(e.message || 'Błąd generowania')
    }
    setLoading(false)
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">Typ dokumentu</label>
        <select value={contractType} onChange={e => setContractType(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500">
          {CONTRACT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">Opis zakresu prac *</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
          placeholder="np. Remont dachu budynku mieszkalnego przy ul. Kwiatowej 5, wymiana pokrycia dachowego 200m², obróbki blacharskie..."
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 resize-none" />
      </div>
      {aiParties.map((party, idx) => (
        <div key={idx} className="border rounded-lg p-3 bg-gray-50 relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-700 uppercase">Strona {idx + 1}</span>
            {aiParties.length > 1 && (
              <button onClick={() => setAiParties(p => p.filter((_, i) => i !== idx))} className="text-xs text-red-400 hover:text-red-600">×</button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">NIP</label>
              <input value={party.nip} onChange={e => updateParty(idx, 'nip', e.target.value)} placeholder="000-000-00-00" className="w-full border rounded-lg px-2 py-1.5 text-xs" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">Nazwa</label>
              <input value={party.name} onChange={e => updateParty(idx, 'name', e.target.value)} placeholder="ABC Sp. z o.o." className="w-full border rounded-lg px-2 py-1.5 text-xs" />
            </div>
          </div>
        </div>
      ))}
      <button onClick={() => setAiParties(p => [...p, emptyParty()])} className="w-full py-1.5 border-2 border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600">
        + Dodaj stronę
      </button>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Wartość (PLN)</label>
          <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="50 000" type="number" className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Termin realizacji</label>
          <input value={deadline} onChange={e => setDeadline(e.target.value)} type="date" className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">Anuluj</button>
        <button onClick={handleGenerate} disabled={loading} className="flex-1 bg-purple-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
          {loading ? ' Generuję...' : ' Generuj dokument'}
        </button>
      </div>
    </div>
  )
}
