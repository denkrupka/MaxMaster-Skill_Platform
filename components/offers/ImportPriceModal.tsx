import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

interface ImportedRow {
  dzial: string; poddzial: string; nazwa: string
  ilosc: number; jednostka: string; cena?: number
}
interface Props { onClose: () => void; onImport: (rows: ImportedRow[]) => void }

const ImportPriceModal: React.FC<Props> = ({ onClose, onImport }) => {
  const [activeTab, setActiveTab] = useState<'file' | 'kosztorys'>('file')
  const [preview, setPreview] = useState<ImportedRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Kosztorys tab state
  const [estimates, setEstimates] = useState<any[]>([])
  const [estimateItems, setEstimateItems] = useState<any[]>([])
  const [selectedEstimateId, setSelectedEstimateId] = useState('')
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])

  // Load estimates list when kosztorys tab is active
  useEffect(() => {
    if (activeTab === 'kosztorys' && estimates.length === 0) {
      loadEstimates()
    }
  }, [activeTab])

  const loadEstimates = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('kosztorys_estimates')
      .select('id, name, title, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setEstimates(data)
    setLoading(false)
  }

  const loadEstimateItems = async (estimateId: string) => {
    if (!estimateId) { setEstimateItems([]); return }
    setLoading(true)
    const { data } = await supabase
      .from('kosztorys_estimate_items')
      .select('*')
      .eq('estimate_id', estimateId)
      .order('position_number')
      .limit(500)
    if (data) setEstimateItems(data)
    setSelectedItemIds([])
    setLoading(false)
  }

  const handleImportFromKosztorys = () => {
    const items = estimateItems.filter(i => selectedItemIds.includes(i.id))
    const mapped: ImportedRow[] = items.map(i => ({
      dzial: i.section_name || i.dzial || '',
      poddzial: i.subsection_name || i.poddzial || '',
      nazwa: i.name || i.description || '',
      ilosc: i.quantity || 1,
      jednostka: i.unit || 'szt',
      cena: i.unit_price || i.price || undefined,
    }))
    onImport(mapped)
    onClose()
  }

  const toggleAllItems = (checked: boolean) => {
    setSelectedItemIds(checked ? estimateItems.map(i => i.id) : [])
  }

  const toggleItem = (id: string, checked: boolean) => {
    setSelectedItemIds(prev => checked ? [...prev, id] : prev.filter(i => i !== id))
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setLoading(true); setError('')
    try {
      const XLSX = await (window as any).import('https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs')
        .catch(() => import('https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs'))
      const buffer = await f.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })
      const rows: ImportedRow[] = data.slice(1).filter((r: any[]) => r[2]).map((r: any[]) => ({
        dzial: String(r[0]||''), poddzial: String(r[1]||''), nazwa: String(r[2]||''),
        ilosc: parseFloat(r[3])||1, jednostka: String(r[4]||'szt'),
        cena: r[5] ? parseFloat(r[5]) : undefined
      }))
      setPreview(rows)
    } catch { setError('Nie można przetworzyć pliku. Sprawdź format.') }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg w-3/4 max-h-screen overflow-auto p-6">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-semibold">Import przedmiaru</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {/* Tab buttons */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('file')}
            className={`px-4 py-2 text-sm rounded-lg ${activeTab === 'file' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            📁 Z pliku (Excel/CSV)
          </button>
          <button
            onClick={() => setActiveTab('kosztorys')}
            className={`px-4 py-2 text-sm rounded-lg ${activeTab === 'kosztorys' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            📊 Z kosztorysu
          </button>
        </div>

        {/* File tab */}
        {activeTab === 'file' && (
          <div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Wybierz plik (Excel .xlsx, .xls, CSV)</label>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="border rounded px-3 py-2 w-full" />
              <p className="text-xs text-gray-500 mt-1">Format kolumn: Dział | Poddział | Nazwa pozycji | Ilość | Jedn. | Cena</p>
            </div>
            {loading && <div className="text-center py-4 text-gray-500">Przetwarzanie pliku...</div>}
            {error && <div className="text-red-500 text-sm mb-3 bg-red-50 p-3 rounded">{error}</div>}
            {preview.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium mb-2">Podgląd — {preview.length} pozycji:</h3>
                <div className="overflow-auto max-h-60">
                  <table className="w-full text-xs border-collapse">
                    <thead><tr className="bg-gray-50 sticky top-0">
                      <th className="border px-2 py-1 text-left">Dział</th>
                      <th className="border px-2 py-1 text-left">Nazwa</th>
                      <th className="border px-2 py-1">Ilość</th>
                      <th className="border px-2 py-1">Jedn.</th>
                      <th className="border px-2 py-1">Cena</th>
                    </tr></thead>
                    <tbody>{preview.map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="border px-2 py-1">{r.dzial}</td>
                        <td className="border px-2 py-1">{r.nazwa}</td>
                        <td className="border px-2 py-1 text-center">{r.ilosc}</td>
                        <td className="border px-2 py-1 text-center">{r.jednostka}</td>
                        <td className="border px-2 py-1 text-right">{r.cena ? r.cena.toFixed(2)+' zł' : '-'}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50">Anuluj</button>
              <button onClick={() => { onImport(preview); onClose() }}
                disabled={preview.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                Importuj {preview.length > 0 ? `(${preview.length} poz.)` : ''}
              </button>
            </div>
          </div>
        )}

        {/* Kosztorys tab */}
        {activeTab === 'kosztorys' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Wybierz kosztorys</label>
              <select
                value={selectedEstimateId}
                onChange={e => { setSelectedEstimateId(e.target.value); loadEstimateItems(e.target.value) }}
                className="border rounded-lg px-3 py-2 w-full text-sm"
              >
                <option value="">-- Wybierz kosztorys --</option>
                {estimates.map((est) => (
                  <option key={est.id} value={est.id}>
                    {est.name || est.title || est.id}
                  </option>
                ))}
              </select>
            </div>

            {loading && <div className="text-center py-4 text-gray-500">Ładowanie...</div>}

            {estimateItems.length > 0 && !loading && (
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Znaleziono {estimateItems.length} pozycji
                  {selectedItemIds.length > 0 && ` (zaznaczono: ${selectedItemIds.length})`}:
                </p>
                <div className="max-h-60 overflow-y-auto border rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left w-8">
                          <input
                            type="checkbox"
                            checked={selectedItemIds.length === estimateItems.length && estimateItems.length > 0}
                            onChange={e => toggleAllItems(e.target.checked)}
                          />
                        </th>
                        <th className="px-3 py-2 text-left">Nazwa</th>
                        <th className="px-3 py-2 text-right">Jedn.</th>
                        <th className="px-3 py-2 text-right">Ilość</th>
                        <th className="px-3 py-2 text-right">Cena jedn.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {estimateItems.map((item: any) => (
                        <tr key={item.id} className="border-t hover:bg-gray-50">
                          <td className="px-3 py-1">
                            <input
                              type="checkbox"
                              checked={selectedItemIds.includes(item.id)}
                              onChange={e => toggleItem(item.id, e.target.checked)}
                            />
                          </td>
                          <td className="px-3 py-1">{item.name || item.description || '-'}</td>
                          <td className="px-3 py-1 text-right">{item.unit || 'szt'}</td>
                          <td className="px-3 py-1 text-right">{item.quantity || 1}</td>
                          <td className="px-3 py-1 text-right">
                            {(item.unit_price || item.price || 0).toFixed(2)} zł
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end gap-2 pt-3 border-t mt-3">
                  <button onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50">Anuluj</button>
                  <button
                    onClick={handleImportFromKosztorys}
                    disabled={selectedItemIds.length === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Importuj zaznaczone ({selectedItemIds.length})
                  </button>
                </div>
              </div>
            )}

            {selectedEstimateId && estimateItems.length === 0 && !loading && (
              <p className="text-sm text-gray-500 text-center py-4">Brak pozycji w wybranym kosztorysie.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ImportPriceModal
