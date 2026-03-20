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

export const AIDocumentGenerator: React.FC<Props> = ({ onClose, onCreated }) => {
  const [contractType, setContractType] = useState('umowa_o_roboty')
  const [description, setDescription] = useState('')
  const [party1NIP, setParty1NIP] = useState('')
  const [party1Name, setParty1Name] = useState('')
  const [party2Name, setParty2Name] = useState('')
  const [amount, setAmount] = useState('')
  const [deadline, setDeadline] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    if (!description.trim()) { setError('Opisz zakres prac'); return }
    setLoading(true)
    setError('')
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('generate-document-ai', {
        body: {
          contractType,
          description,
          party1: { nip: party1NIP, name: party1Name },
          party2: { name: party2Name },
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Zamawiający (NIP)</label>
          <input value={party1NIP} onChange={e => setParty1NIP(e.target.value)} placeholder="000-000-00-00" className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Nazwa zamawiającego</label>
          <input value={party1Name} onChange={e => setParty1Name(e.target.value)} placeholder="ABC Sp. z o.o." className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Wykonawca</label>
          <input value={party2Name} onChange={e => setParty2Name(e.target.value)} placeholder="XYZ Budowlana" className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Wartość (PLN)</label>
          <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="50 000" type="number" className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">Termin realizacji</label>
        <input value={deadline} onChange={e => setDeadline(e.target.value)} type="date" className="w-full border rounded-lg px-3 py-2 text-sm" />
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
