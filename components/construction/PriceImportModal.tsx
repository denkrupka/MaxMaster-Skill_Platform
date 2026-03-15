import React, { useState, useRef, useCallback } from 'react';
import { X, Upload, FileSpreadsheet, FileText, Table, AlertCircle, CheckCircle2, Loader2, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';

interface PriceImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  priceListId: string;
  onImportComplete: () => void;
}

type ImportFileType = 'excel' | 'csv' | 'pdf';

interface ParsedItem {
  item_type: 'material' | 'equipment' | 'labor';
  item_code: string;
  item_name: string;
  unit: string;
  price: number;
  rowNumber: number;
  errors?: string[];
}

interface ImportPreview {
  valid: ParsedItem[];
  invalid: ParsedItem[];
  total: number;
}

const UNITS_MAP: Record<string, string> = {
  'szt': 'szt.', 'szt.': 'szt.', 'sztuka': 'szt.',
  'm': 'm', 'mb': 'mb', 'metr': 'm',
  'm2': 'm²', 'm²': 'm²', 'mkw': 'm²', 'metr kwadratowy': 'm²',
  'm3': 'm³', 'm³': 'm³', 'metr sześcienny': 'm³',
  'kg': 'kg', 'kilogram': 'kg',
  'kpl': 'kpl.', 'kpl.': 'kpl.', 'komplet': 'kpl.',
  'godz': 'godz.', 'godz.': 'godz.', 'h': 'godz.', 'hr': 'godz.',
  'op': 'op.', 'op.': 'op.', 'opakowanie': 'op.',
  'l': 'l', 'ltr': 'l', 'lit': 'l', 'litr': 'l',
  't': 't', 'tona': 't',
  'r-g': 'r-g', 'rg': 'r-g', 'roboczogodzina': 'r-g',
  'm-g': 'm-g', 'mg': 'm-g', 'maszynogodzina': 'm-g'
};

const normalizeUnit = (unit: string): string => {
  const normalized = unit.toLowerCase().trim();
  return UNITS_MAP[normalized] || unit;
};

const detectItemType = (name: string, code: string): 'material' | 'equipment' | 'labor' => {
  const text = (name + ' ' + code).toLowerCase();
  
  // Labor indicators
  if (text.includes('robocizna') || text.includes('praca') || text.includes('montaż') || 
      text.includes('instalacja') || text.includes('r-g') || text.includes('rg ')) {
    return 'labor';
  }
  
  // Equipment indicators
  if (text.includes('sprzęt') || text.includes('wynajem') || text.includes('maszyna') || 
      text.includes('urządzenie') || text.includes('m-g') || text.includes('mg ')) {
    return 'equipment';
  }
  
  // Default to material
  return 'material';
};

export const PriceImportModal: React.FC<PriceImportModalProps> = ({
  isOpen,
  onClose,
  priceListId,
  onImportComplete
}) => {
  const { state } = useAppContext();
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload');
  const [fileType, setFileType] = useState<ImportFileType>('excel');
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    setError(null);
    
    // Detect file type
    const extension = file.name.split('.').pop()?.toLowerCase();
    let detectedType: ImportFileType = 'excel';
    
    if (extension === 'csv') detectedType = 'csv';
    else if (extension === 'pdf') detectedType = 'pdf';
    else if (['xlsx', 'xls'].includes(extension || '')) detectedType = 'excel';
    
    setFileType(detectedType);

    try {
      if (detectedType === 'pdf') {
        // PDF parsing would require a backend service or pdf-parse library
        setError('Import z PDF wymaga przetworzenia na serwerze. Użyj Excel lub CSV.');
        return;
      }

      const items = await parseFile(file, detectedType);
      const validated = validateItems(items);
      setPreview(validated);
      setStep('preview');
    } catch (err: any) {
      setError(err.message || 'Błąd podczas parsowania pliku');
    }
  };

  const parseFile = async (file: File, type: ImportFileType): Promise<Partial<ParsedItem>[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          let items: Partial<ParsedItem>[] = [];
          
          if (type === 'csv') {
            items = parseCSV(data as string);
          } else {
            items = parseExcel(data as ArrayBuffer);
          }
          
          resolve(items);
        } catch (err) {
          reject(err);
        }
      };
      
      reader.onerror = () => reject(new Error('Błąd odczytu pliku'));
      
      if (type === 'csv') {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
  };

  const parseCSV = (text: string): Partial<ParsedItem>[] => {
    const lines = text.split('\n').filter(line => line.trim());
    const items: Partial<ParsedItem>[] = [];
    
    // Try to detect header row
    let startRow = 0;
    const headerKeywords = ['kod', 'nazwa', 'cena', 'jednostka', 'typ'];
    const firstLine = lines[0]?.toLowerCase() || '';
    
    if (headerKeywords.some(kw => firstLine.includes(kw))) {
      startRow = 1;
    }
    
    for (let i = startRow; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Try different delimiters
      let cols = line.split(';');
      if (cols.length < 3) cols = line.split(',');
      if (cols.length < 3) cols = line.split('\t');
      
      if (cols.length >= 3) {
        const item = extractItemFromColumns(cols, i + 1);
        if (item) items.push(item);
      }
    }
    
    return items;
  };

  const parseExcel = (buffer: ArrayBuffer): Partial<ParsedItem>[] => {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
    
    const items: Partial<ParsedItem>[] = [];
    
    // Try to detect header row
    let startRow = 0;
    if (data.length > 0) {
      const firstRow = data[0].map((cell: any) => String(cell || '').toLowerCase());
      const headerKeywords = ['kod', 'nazwa', 'cena', 'jednostka', 'typ', 'symbol'];
      
      if (headerKeywords.some(kw => firstRow.some((cell: string) => cell.includes(kw)))) {
        startRow = 1;
      }
    }
    
    for (let i = startRow; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 2) continue;
      
      const item = extractItemFromColumns(row.map((c: any) => String(c || '')), i + 1);
      if (item) items.push(item);
    }
    
    return items;
  };

  const extractItemFromColumns = (cols: string[], rowNumber: number): Partial<ParsedItem> | null => {
    // Try to identify columns
    let code = '';
    let name = '';
    let unit = '';
    let price = 0;
    
    // Heuristic: first non-empty column is often code
    for (let i = 0; i < cols.length; i++) {
      const val = cols[i].trim();
      if (!val) continue;
      
      // Check if it's a price (contains digits and comma/dot)
      const priceMatch = val.match(/^\d+[,.]?\d*$/);
      if (priceMatch && !code && !name) {
        price = parseFloat(val.replace(',', '.'));
        continue;
      }
      
      // Check if it's a unit (short text, often after price)
      if (val.length <= 10 && !code && !name && price > 0) {
        unit = normalizeUnit(val);
        continue;
      }
      
      // First meaningful text is likely code
      if (!code && val.length <= 20 && !val.includes(' ')) {
        code = val;
        continue;
      }
      
      // Longer text is name
      if (!name) {
        name = val;
      }
    }
    
    // If no code found but we have name, use row number as code
    if (!code && name) {
      code = `P${rowNumber}`;
    }
    
    // Try to extract price from last numeric column
    if (price === 0) {
      for (let i = cols.length - 1; i >= 0; i--) {
        const val = cols[i].replace(/\s/g, '').replace(',', '.');
        const num = parseFloat(val);
        if (!isNaN(num) && num > 0) {
          price = num;
          break;
        }
      }
    }
    
    if (!name || price <= 0) return null;
    
    return {
      item_code: code,
      item_name: name,
      unit: unit || 'szt.',
      price,
      rowNumber
    };
  };

  const validateItems = (items: Partial<ParsedItem>[]): ImportPreview => {
    const valid: ParsedItem[] = [];
    const invalid: ParsedItem[] = [];
    
    items.forEach(item => {
      const errors: string[] = [];
      
      if (!item.item_name || item.item_name.length < 2) {
        errors.push('Brak nazwy');
      }
      
      if (!item.item_code) {
        errors.push('Brak kodu');
      }
      
      if (!item.price || item.price <= 0) {
        errors.push('Nieprawidłowa cena');
      }
      
      const type = item.item_type || detectItemType(item.item_name || '', item.item_code || '');
      
      const fullItem: ParsedItem = {
        item_type: type,
        item_code: item.item_code || '',
        item_name: item.item_name || '',
        unit: item.unit || 'szt.',
        price: item.price || 0,
        rowNumber: item.rowNumber || 0,
        errors
      };
      
      if (errors.length > 0) {
        invalid.push(fullItem);
      } else {
        valid.push(fullItem);
      }
    });
    
    return { valid, invalid, total: items.length };
  };

  const handleImport = async () => {
    if (!preview || preview.valid.length === 0) return;
    
    setImporting(true);
    setStep('importing');
    
    let success = 0;
    let failed = 0;
    
    try {
      // Insert in batches of 50
      const batchSize = 50;
      const items = preview.valid;
      
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        
        const insertData = batch.map(item => ({
          price_list_id: priceListId,
          item_type: item.item_type,
          item_code: item.item_code,
          item_name: item.item_name,
          unit: item.unit,
          price: item.price
        }));
        
        const { error } = await supabase
          .from('kosztorys_price_list_items')
          .insert(insertData);
        
        if (error) {
          console.error('Batch insert error:', error);
          failed += batch.length;
        } else {
          success += batch.length;
        }
      }
      
      setImportResult({ success, failed });
      setStep('complete');
      onImportComplete();
    } catch (err) {
      setError('Błąd podczas importu do bazy danych');
      setStep('preview');
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      ['Kod', 'Nazwa', 'Jednostka', 'Cena', 'Typ'],
      ['M001', 'Przewód YDY 3x1,5', 'm', '2.50', 'material'],
      ['R001', 'Montaż gniazdka', 'szt.', '25.00', 'labor'],
      ['S001', 'Wynajem rusztowania', 'mb', '15.00', 'equipment']
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Szablon');
    XLSX.writeFile(wb, 'szablon_importu_cennika.xlsx');
  };

  const reset = () => {
    setStep('upload');
    setPreview(null);
    setImportResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 py-6">
        <div className="fixed inset-0 bg-slate-900 bg-opacity-50" onClick={handleClose} />
        
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Import cennika</h3>
              <p className="text-sm text-slate-500">
                {step === 'upload' && 'Wybierz plik Excel, CSV lub PDF'}
                {step === 'preview' && `Znaleziono ${preview?.total || 0} pozycji`}
                {step === 'importing' && 'Importowanie...'}
                {step === 'complete' && 'Import zakończony'}
              </p>
            </div>
            <button onClick={handleClose} className="p-2 hover:bg-slate-200 rounded-lg transition">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {step === 'upload' && (
              <div className="space-y-6">
                {/* File type selector */}
                <div className="flex justify-center gap-4">
                  {(['excel', 'csv', 'pdf'] as ImportFileType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setFileType(type)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition ${
                        fileType === type
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {type === 'excel' && <FileSpreadsheet className="w-8 h-8 text-green-600" />}
                      {type === 'csv' && <Table className="w-8 h-8 text-blue-600" />}
                      {type === 'pdf' && <FileText className="w-8 h-8 text-red-600" />}
                      <span className="text-sm font-medium capitalize">{type.toUpperCase()}</span>
                    </button>
                  ))}
                </div>

                {/* Drop zone */}
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition ${
                    dragActive
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-300 hover:border-slate-400'
                  }`}
                >
                  <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-slate-700 mb-2">
                    Przeciągnij plik lub kliknij aby wybrać
                  </p>
                  <p className="text-sm text-slate-500">
                    Obsługiwane formaty: .xlsx, .xls, .csv
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv,.pdf"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </div>

                {/* Template download */}
                <div className="text-center">
                  <button
                    onClick={downloadTemplate}
                    className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                  >
                    <Download className="w-4 h-4" />
                    Pobierz szablon Excel
                  </button>
                </div>

                {/* Instructions */}
                <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600">
                  <p className="font-medium mb-2">Wymagane kolumny:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li><strong>Kod</strong> - unikalny identyfikator pozycji</li>
                    <li><strong>Nazwa</strong> - nazwa materiału/robocizny/sprzętu</li>
                    <li><strong>Jednostka</strong> - szt., m, m², m³, kg, itp.</li>
                    <li><strong>Cena</strong> - cena jednostkowa (zł)</li>
                    <li><strong>Typ</strong> - material, labor, equipment (opcjonalnie, auto-detekcja)</li>
                  </ul>
                </div>
              </div>
            )}

            {step === 'preview' && preview && (
              <div className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-700">{preview.total}</div>
                    <div className="text-sm text-blue-600">Wszystkich</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-700">{preview.valid.length}</div>
                    <div className="text-sm text-green-600">Poprawnych</div>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-amber-700">{preview.invalid.length}</div>
                    <div className="text-sm text-amber-600">Błędnych</div>
                  </div>
                </div>

                {/* Valid items preview */}
                {preview.valid.length > 0 && (
                  <div>
                    <h4 className="font-medium text-slate-900 mb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Pozycje do importu ({preview.valid.length})
                    </h4>
                    <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Typ</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Kod</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Nazwa</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Jedn.</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Cena</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {preview.valid.slice(0, 20).map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 text-xs rounded-full ${
                                  item.item_type === 'material' ? 'bg-green-100 text-green-700' :
                                  item.item_type === 'labor' ? 'bg-blue-100 text-blue-700' :
                                  'bg-purple-100 text-purple-700'
                                }`}>
                                  {item.item_type === 'material' ? 'Mat.' :
                                   item.item_type === 'labor' ? 'Rob.' : 'Sprz.'}
                                </span>
                              </td>
                              <td className="px-3 py-2 font-medium">{item.item_code}</td>
                              <td className="px-3 py-2 text-slate-600">{item.item_name}</td>
                              <td className="px-3 py-2 text-slate-500">{item.unit}</td>
                              <td className="px-3 py-2 text-right font-medium">
                                {item.price.toFixed(2)} zł
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {preview.valid.length > 20 && (
                        <p className="text-center text-sm text-slate-500 py-2">
                          ... i {preview.valid.length - 20} więcej
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Invalid items */}
                {preview.invalid.length > 0 && (
                  <div>
                    <h4 className="font-medium text-slate-900 mb-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                      Pozycje z błędami ({preview.invalid.length})
                    </h4>
                    <div className="border border-amber-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-amber-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-600">Wiersz</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-600">Dane</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-600">Błędy</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-100">
                          {preview.invalid.map((item, idx) => (
                            <tr key={idx} className="bg-amber-50/50">
                              <td className="px-3 py-2 text-slate-500">{item.rowNumber}</td>
                              <td className="px-3 py-2 text-slate-600">
                                {item.item_code || '-'} | {item.item_name || '-'}
                              </td>
                              <td className="px-3 py-2">
                                {item.errors?.map((err, i) => (
                                  <span key={i} className="inline-block px-2 py-0.5 bg-amber-200 text-amber-800 text-xs rounded mr-1">
                                    {err}
                                  </span>
                                ))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 'importing' && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                <p className="text-lg font-medium text-slate-700">Importowanie pozycji...</p>
                <p className="text-sm text-slate-500">To może potrwać kilka chwil</p>
              </div>
            )}

            {step === 'complete' && importResult && (
              <div className="text-center py-8">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h4 className="text-xl font-semibold text-slate-900 mb-2">Import zakończony!</h4>
                <div className="flex justify-center gap-8 mb-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">{importResult.success}</div>
                    <div className="text-sm text-slate-500">Zaimportowano</div>
                  </div>
                  {importResult.failed > 0 && (
                    <div className="text-center">
                      <div className="text-3xl font-bold text-red-600">{importResult.failed}</div>
                      <div className="text-sm text-slate-500">Błędów</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
            {step === 'upload' && (
              <>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800"
                >
                  Anuluj
                </button>
                <div className="text-sm text-slate-500">
                  Maksymalny rozmiar: 10MB
                </div>
              </>
            )}
            
            {step === 'preview' && (
              <>
                <button
                  onClick={reset}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800"
                >
                  Wybierz inny plik
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-100"
                  >
                    Anuluj
                  </button>
                  {preview && preview.valid.length > 0 && (
                    <button
                      onClick={handleImport}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Importuj {preview.valid.length} pozycji
                    </button>
                  )}
                </div>
              </>
            )}
            
            {step === 'importing' && (
              <div className="w-full text-center text-sm text-slate-500">
                Proszę czekać...
              </div>
            )}
            
            {step === 'complete' && (
              <div className="w-full flex justify-center">
                <button
                  onClick={handleClose}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Zamknij
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PriceImportModal;
