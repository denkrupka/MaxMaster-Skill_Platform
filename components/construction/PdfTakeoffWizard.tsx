import React, { useState, useCallback, useRef } from 'react';
import { Sparkles, Loader2, CheckCircle, AlertTriangle, Play, X, Scale, Ruler, Settings2, FilePlus, Edit2, Check } from 'lucide-react';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { supabase } from '../../lib/supabase';
import type { PdfAnalysisExtra } from '../../lib/pdfAnalyzer';
import { useNavigate } from 'react-router-dom';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TakeoffPosition {
  name: string;
  legendRef?: string;
  category: string;
  count: number;
  unit: string;
  description?: string;
  source: 'claude' | 'gemini' | 'both';
  confidence: number;
  needsReview: boolean;
  reviewReason?: string;
  knrCode?: string;
  id?: string;
}

interface PdfTakeoffWizardProps {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  planId: string;
  companyId: string;
  analysisExtra: PdfAnalysisExtra;
  currentScaleRatio?: number;
  onScaleChange?: (scaleRatio: number) => void;
  onCalibrateScale?: () => void;
  onAiScaleDetect?: () => void;
  aiScaleLoading?: boolean;
  onTakeoffCreated: (positions: TakeoffPosition[]) => void;
  onClose: () => void;
}

type WizardStep = 'page_select' | 'scale' | 'rendering' | 'analyzing' | 'result' | 'saving' | 'done';

// ─── Toast notification (internal) ────────────────────────────────────────────

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
}

function Toast({ message, type }: ToastProps) {
  const bg = type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600';
  return (
    <div className={`fixed bottom-6 right-6 z-[500] flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm shadow-xl ${bg}`}>
      {type === 'success' && <CheckCircle size={14} />}
      {type === 'error' && <AlertTriangle size={14} />}
      {type === 'info' && <Sparkles size={14} />}
      <span>{message}</span>
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ step }: { step: WizardStep }) {
  const steps: WizardStep[] = ['page_select', 'scale', 'rendering', 'analyzing', 'result', 'saving', 'done'];
  const idx = steps.indexOf(step);
  const progress = Math.min(100, Math.round((idx / (steps.length - 1)) * 100));
  return (
    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
      <div
        className="h-1.5 rounded-full transition-all duration-500"
        style={{ width: `${progress}%`, background: step === 'done' ? '#16a34a' : step === 'analyzing' ? '#7c3aed' : '#2563eb' }}
      />
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────


// ─── PageThumbnails — render small previews of all PDF pages ─────────────────

interface PageThumbnailsProps {
  pdfDoc: PDFDocumentProxy;
  currentPage: number;
  onSelect: (page: number) => void;
}

function PageThumbnails({ pdfDoc, currentPage, onSelect }: PageThumbnailsProps) {
  const [thumbs, setThumbs] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    const renderThumbs = async () => {
      const results: string[] = [];
      const total = pdfDoc.numPages;
      for (let i = 1; i <= total; i++) {
        try {
          const page = await pdfDoc.getPage(i);
          const vp = page.getViewport({ scale: 0.25 });
          const canvas = document.createElement('canvas');
          canvas.width = vp.width;
          canvas.height = vp.height;
          await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
          results.push(canvas.toDataURL('image/jpeg', 0.7));
        } catch {
          results.push('');
        }
        if (cancelled) return;
        setThumbs([...results]);
      }
      if (!cancelled) setLoading(false);
    };
    renderThumbs();
    return () => { cancelled = true; };
  }, [pdfDoc]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Wybierz stronę PDF do analizy AI. Dokument ma <strong>{pdfDoc.numPages}</strong> str.
      </p>
      {loading && thumbs.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Loader2 size={12} className="animate-spin" />
          <span>Generowanie podglądów…</span>
        </div>
      )}
      <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
        {thumbs.map((src, i) => {
          const pageNum = i + 1;
          const isSelected = pageNum === currentPage;
          return (
            <button
              key={pageNum}
              onClick={() => onSelect(pageNum)}
              className={`relative border-2 rounded-lg overflow-hidden transition-all ${
                isSelected
                  ? 'border-blue-600 shadow-md ring-2 ring-blue-300'
                  : 'border-slate-200 hover:border-blue-400'
              }`}
            >
              {src ? (
                <img src={src} alt={`Str. ${pageNum}`} className="w-full h-auto" />
              ) : (
                <div className="aspect-[3/4] flex items-center justify-center bg-slate-100">
                  <Loader2 size={14} className="animate-spin text-slate-300" />
                </div>
              )}
              <div className={`absolute bottom-0 inset-x-0 text-center py-0.5 text-[9px] font-bold ${
                isSelected ? 'bg-blue-600 text-white' : 'bg-black/40 text-white'
              }`}>
                {pageNum}
              </div>
              {isSelected && (
                <div className="absolute top-1 right-1 bg-blue-600 rounded-full p-0.5">
                  <CheckCircle size={8} className="text-white" />
                </div>
              )}
            </button>
          );
        })}
        {/* Show placeholder for pages still loading */}
        {loading && Array.from({ length: Math.max(0, pdfDoc.numPages - thumbs.length) }).map((_, i) => (
          <div key={`loading-${i}`} className="border-2 border-slate-200 rounded-lg aspect-[3/4] flex items-center justify-center bg-slate-50">
            <Loader2 size={14} className="animate-spin text-slate-300" />
          </div>
        ))}
      </div>
    </div>
  );
}

async function renderPageToBase64(page: PDFPageProxy): Promise<string> {
  const baseVp = page.getViewport({ scale: 1 });
  const MAX_SIDE = 1800;
  const scale = Math.min(2, MAX_SIDE / Math.max(baseVp.width, baseVp.height));
  const vp = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = vp.width;
  canvas.height = vp.height;
  await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
  return canvas.toDataURL('image/jpeg', 0.82).replace(/^data:image\/jpeg;base64,/, '');
}

// ─── ScaleSettingsModal — 1:1 с PlansWorkspace ────────────────────────────────

interface ScaleSettingsModalProps {
  currentScaleRatio?: number;
  aiScaleLoading?: boolean;
  onScaleChange?: (scaleRatio: number) => void;
  onCalibrateScale?: () => void;
  onAiScaleDetect?: () => void;
  onClose: () => void;
}

function ScaleSettingsModal({ currentScaleRatio, aiScaleLoading, onScaleChange, onCalibrateScale, onAiScaleDetect, onClose }: ScaleSettingsModalProps) {
  const [manualValue, setManualValue] = useState('');

  const handleSetManual = () => {
    const val = parseInt(manualValue);
    if (val > 0 && onScaleChange) {
      const scaleRatio = 0.3528 * val; // PDF points to mm
      onScaleChange(scaleRatio);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[420px] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">Ustawienia skali</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Current scale info */}
          {currentScaleRatio ? (
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                <Ruler className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-green-800">Skala skalibrowana</p>
                <p className="text-[11px] text-green-600">1 px = {currentScaleRatio.toFixed(3)} mm</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                <Ruler className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-800">Skala nie jest skalibrowana</p>
                <p className="text-[11px] text-amber-600">Pomiary beda w pikselach</p>
              </div>
            </div>
          )}

          {/* Manual calibration */}
          {onCalibrateScale && (
            <button
              onClick={() => { onClose(); onCalibrateScale(); }}
              className="w-full flex items-center gap-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
                <Ruler className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">Kalibracja reczna</p>
                <p className="text-[11px] text-slate-500">Kliknij dwa punkty o znanej odleglosci i wpisz wymiar</p>
              </div>
            </button>
          )}

          {/* AI scale detection */}
          {onAiScaleDetect && (
            <button
              onClick={() => { onAiScaleDetect(); }}
              disabled={aiScaleLoading}
              className="w-full flex items-center gap-3 p-3 border border-purple-200 rounded-xl hover:bg-purple-50 transition text-left disabled:opacity-50"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 flex-shrink-0">
                {aiScaleLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">Wykryj skale AI</p>
                <p className="text-[11px] text-slate-500">
                  {aiScaleLoading ? 'Analizowanie rysunku...' : 'Automatyczne wykrycie z legendy lub wymiarow'}
                </p>
              </div>
            </button>
          )}

          {/* Manual input */}
          <div className="border-t border-slate-100 pt-3">
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-2">Lub wpisz skale recznie</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">1 :</span>
              <input
                type="number"
                min="1"
                placeholder="np. 50, 100, 200"
                value={manualValue}
                onChange={e => setManualValue(e.target.value)}
                className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                onKeyDown={e => { if (e.key === 'Enter') handleSetManual(); }}
              />
              <button
                onClick={handleSetManual}
                className="px-3 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >Ustaw</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Editable quantity cell ────────────────────────────────────────────────────

function EditableQty({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const n = parseFloat(draft);
    if (!isNaN(n) && n >= 0) onChange(n);
    else setDraft(String(value));
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        autoFocus
        type="number"
        min="0"
        step="1"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(String(value)); setEditing(false); } }}
        className="w-16 text-right text-xs font-mono border border-blue-400 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    );
  }
  return (
    <button
      onClick={() => { setDraft(String(value)); setEditing(true); }}
      className="flex items-center gap-0.5 text-right font-mono text-gray-800 hover:text-blue-700 group"
      title="Kliknij aby edytowac"
    >
      <span>{value > 0 ? value : <span className="text-gray-300">—</span>}</span>
      <Edit2 size={9} className="text-gray-300 group-hover:text-blue-500 ml-0.5" />
    </button>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function PdfTakeoffWizard({
  pdfDoc, pageNumber, planId, companyId, analysisExtra,
  currentScaleRatio, onScaleChange, onCalibrateScale, onAiScaleDetect, aiScaleLoading,
  onTakeoffCreated, onClose,
}: PdfTakeoffWizardProps) {
  const navigate = useNavigate();
  const [selectedPage, setSelectedPage] = useState(pageNumber);
  const lsKey = `takeoff_wizard_${planId}_pg${pageNumber}`;

  // Restore from localStorage on mount
  const getInitialState = () => {
    try {
      const saved = localStorage.getItem(lsKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.positions?.length > 0 && parsed.step === 'result') {
          return parsed;
        }
      }
    } catch {}
    return null;
  };
  const savedState = getInitialState();

  const [step, setStep] = useState<WizardStep>(savedState?.step || (pdfDoc.numPages > 1 ? 'page_select' : 'scale'));
  const [statusMsg, setStatusMsg] = useState('');
  const [positions, setPositions] = useState<TakeoffPosition[]>(savedState?.positions || []);
  const [error, setError] = useState('');
  const [claudeRaw, setClaudeRaw] = useState<unknown>(savedState?.claudeRaw || null);
  const [geminiRaw, setGeminiRaw] = useState<unknown>(savedState?.geminiRaw || null);
  const [showScaleModal, setShowScaleModal] = useState(false);
  const [toast, setToast] = useState<ToastProps | null>(null);
  const [creatingOffer, setCreatingOffer] = useState(false);

  // Persist to localStorage when positions change
  React.useEffect(() => {
    if (positions.length > 0) {
      try {
        localStorage.setItem(lsKey, JSON.stringify({ step, positions, claudeRaw, geminiRaw, savedAt: Date.now() }));
      } catch {}
    }
  }, [positions, step]);

  const clearSavedState = useCallback(() => {
    try { localStorage.removeItem(lsKey); } catch {}
  }, [lsKey]);

  const detectedScale = analysisExtra.scaleInfo?.scaleText || null;
  const [scaleConfirmed, setScaleConfirmed] = useState(false);
  const [scaleLabel, setScaleLabel] = useState(
    currentScaleRatio
      ? `1 px = ${currentScaleRatio.toFixed(3)} mm`
      : detectedScale || ''
  );

  const isLoading = step === 'rendering' || step === 'analyzing' || step === 'saving';
  const reviewCount = positions.filter(p => p.needsReview).length;
  const hasSavedState = !!(savedState?.positions?.length);

  const showToast = useCallback((message: string, type: ToastProps['type'] = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const updatePositionCount = useCallback((index: number, newCount: number) => {
    setPositions(prev => prev.map((p, i) => i === index ? { ...p, count: newCount, needsReview: newCount === 0 || p.needsReview } : p));
  }, []);

  const run = useCallback(async () => {
    setError('');
    setStep('rendering');
    setStatusMsg('Renderowanie strony…');

    let pageBase64: string;
    try {
      const page = await pdfDoc.getPage(selectedPage);
      pageBase64 = await renderPageToBase64(page);
    } catch (e) {
      const msg = `Błąd renderowania: ${e instanceof Error ? e.message : String(e)}`;
      setError(msg);
      showToast(msg, 'error');
      setStep('scale');
      return;
    }

    setStep('analyzing');
    setStatusMsg('AI analizuje rysunek — proszę czekać…');

    // Build structured data for vector mode (if extracted geometry available from pdfAnalyzer)
    const extraction = analysisExtra.extraction;
    const hasVectorData = analysisExtra.styleGroups?.length > 0 || extraction?.texts?.length > 0;
    const structuredDataForAI = hasVectorData ? {
      texts: (extraction?.texts || []).slice(0, 1000).map(t => ({
        text: t.text, x: t.x, y: t.y, fontSize: t.fontSize,
      })),
      symbols: (analysisExtra.symbols || []).slice(0, 2000).map(s => {
        const sg = analysisExtra.styleGroups?.find(g => g.id === s.styleGroupId);
        return {
          shape: s.shape, centerX: s.centerX, centerY: s.centerY,
          radius: s.radius, clusterId: s.clusterId,
          color: sg?.strokeColor || '#000000', count: 1,
        };
      }),
      styleGroups: (analysisExtra.styleGroups || []).slice(0, 30).map(sg => ({
        name: sg.name, color: sg.strokeColor, lineWidth: sg.lineWidth,
        dashPattern: Array.isArray(sg.dashPattern) ? sg.dashPattern.map(v => v.toFixed(0)).join('-') : 'solid',
        pathCount: sg.pathCount, totalLengthM: sg.totalLengthM,
      })),
      pageWidth: extraction?.pageWidth || 1000,
      pageHeight: extraction?.pageHeight || 700,
      scale: analysisExtra.scaleInfo?.scaleText || '1:100',
    } : undefined;

    const [claudeRes, geminiRes] = await Promise.allSettled([
      supabase.functions.invoke('pdf-analyze-raster', {
        body: {
          imageBase64: pageBase64,
          mimeType: 'image/jpeg',
          pageNumber: selectedPage,
          structuredData: structuredDataForAI,
        },
      }),
      supabase.functions.invoke('pdf-analyze-legend', {
        body: {
          legendImageBase64: pageBase64,
          mimeType: 'image/jpeg',
          styleGroupsSummary: (analysisExtra.styleGroups || []).slice(0, 20)
            .map(g => `color:${g.strokeColor} width:${g.lineWidth} paths:${g.pathCount}`)
            .join('\n'),
        },
      }),
    ]);

    if (claudeRes.status === 'rejected' && geminiRes.status === 'rejected') {
      const msg = `Błąd AI: ${claudeRes.reason?.message || 'Nieznany błąd'}`;
      setError(msg);
      showToast(msg, 'error');
      setStep('scale');
      return;
    }

    const claudeData = claudeRes.status === 'fulfilled' ? (claudeRes.value.data?.data || claudeRes.value.data || {}) : {};
    const geminiData = geminiRes.status === 'fulfilled' ? (geminiRes.value.data?.data || geminiRes.value.data || {}) : {};

    if (claudeRes.status === 'rejected') {
      showToast('Claude nie odpowiedział — używam tylko danych z legendy', 'info');
    }
    if (geminiRes.status === 'rejected') {
      showToast('Analiza legendy nie powiodła się — liczę tylko z Claude', 'info');
    }

    setClaudeRaw(claudeData);
    setGeminiRaw(geminiData);

    const claudeSymbols: Array<{ type?: string; name?: string; legendRef?: string; category?: string; count?: number; description?: string }> = (claudeData as any).symbols || [];
    const claudeRoutes: Array<{ type?: string; name?: string; estimatedLengthM?: number; description?: string }> = (claudeData as any).routes || [];
    const geminiEntries: Array<{ label?: string; category?: string; description?: string; entryType?: string }> = (geminiData as any).entries || [];

    if (!claudeSymbols.length && !geminiEntries.length) {
      const msg = 'AI nie wykryło żadnych elementów. Sprawdź czy rysunek zawiera legendę i elementy instalacji.';
      setError(msg);
      showToast(msg, 'error');
      setStep('scale');
      return;
    }

    const geminiMap = new Map<string, typeof geminiEntries[0]>();
    for (const ge of geminiEntries) {
      geminiMap.set((ge.label || '').toLowerCase().trim(), ge);
    }

    const result: TakeoffPosition[] = [];
    const usedGemini = new Set<string>();

    for (const sym of claudeSymbols) {
      const name = sym.type || sym.name || '';
      if (!name) continue;
      const geminiMatch = geminiMap.get(name.toLowerCase().trim())
        || [...geminiMap.entries()].find(([k]) => k.includes(name.toLowerCase().slice(0, 10)))?.[1];
      const count = typeof sym.count === 'number' ? sym.count : 1;
      result.push({
        id: `pos-${result.length}-${Date.now()}`,
        name,
        legendRef: sym.legendRef || '',
        category: sym.category || geminiMatch?.category || 'Inne',
        count,
        unit: 'szt.',
        description: sym.description || geminiMatch?.description || '',
        source: geminiMatch ? 'both' : 'claude',
        confidence: count > 0 ? 0.88 : 0.60,
        needsReview: count === 0 || !sym.legendRef,
        reviewReason: count === 0 ? 'Brak na rysunku (count=0)' : undefined,
      });
      if (geminiMatch) usedGemini.add(name.toLowerCase().trim());
    }

    for (const route of claudeRoutes) {
      const name = route.type || route.name || '';
      if (!name) continue;
      result.push({
        name,
        category: 'Kable i przewody',
        count: route.estimatedLengthM || 0,
        unit: 'm',
        description: route.description || '',
        source: 'claude',
        confidence: 0.65,
        needsReview: true,
        reviewReason: 'Trasa kablowa — zweryfikuj długość',
      });
    }

    const skipPatterns = ['wartość', 'natężenie', 'oświetlenie', 'poziom', 'klasa', 'współczynnik', 'moc', 'wymagania'];
    for (const ge of geminiEntries) {
      const key = (ge.label || '').toLowerCase().trim();
      if (!key || usedGemini.has(key)) continue;
      if (skipPatterns.some(p => key.includes(p))) continue;
      result.push({
        name: ge.label || '',
        category: ge.category || 'Inne',
        count: 0,
        unit: ge.entryType === 'line' ? 'm' : 'szt.',
        description: ge.description || '',
        source: 'gemini',
        confidence: 0.55,
        needsReview: true,
        reviewReason: 'Tylko legenda — Claude nie zliczył',
      });
    }

    if (!result.length) {
      const msg = 'Brak rozpoznanych elementów. Sprawdź jakość rysunku.';
      setError(msg);
      showToast(msg, 'error');
      setStep('scale');
      return;
    }

    setPositions(result);
    showToast(`Wykryto ${result.length} pozycji przedmiaru`, 'success');
    setStep('result');
  }, [pdfDoc, pageNumber, analysisExtra, showToast]);

  const saveAndCreate = useCallback(async () => {
    setStep('saving');
    setStatusMsg('Zapisuję przedmiar…');
    try {
      await supabase.from('drawing_analyses').upsert({
        plan_id: planId,
        page_number: selectedPage,
        analysis_data: claudeRaw,
        legend_data: geminiRaw,
      }, { onConflict: 'plan_id,page_number' });

      if (positions.length > 0) {
        // Delete old results for this plan page first
        await supabase.from('drawing_takeoff_results')
          .delete()
          .eq('plan_id', planId)
          .eq('page_number', pageNumber);

        await supabase.from('drawing_takeoff_results').insert(
          positions.map((p, i) => ({
            plan_id: planId,
            rule_id: `ai-${i}`,
            rule_name: p.name,
            category: p.category,
            quantity: p.count,
            unit: p.unit,
            entity_count: Math.round(p.count),
            page_number: selectedPage,
          }))
        );
      }

      showToast(`Przedmiar zapisany: ${positions.filter(p => p.count > 0).length} pozycji z ilościami`, 'success');
      clearSavedState();
      setStep('done');
      onTakeoffCreated(positions);
    } catch (e) {
      const msg = `Błąd zapisu: ${e instanceof Error ? e.message : String(e)}`;
      setError(msg);
      showToast(msg, 'error');
      setStep('result');
    }
  }, [positions, planId, companyId, claudeRaw, geminiRaw, onTakeoffCreated, selectedPage, showToast]);

  const createOffer = useCallback(async () => {
    if (!companyId) {
      showToast('Brak identyfikatora firmy', 'error');
      return;
    }
    setCreatingOffer(true);
    try {
      // Get current user id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showToast('Nie jesteś zalogowany', 'error');
        setCreatingOffer(false);
        return;
      }

      // Get next offer number
      const { count: offerCount } = await supabase
        .from('offers')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId);
      const nextNum = (offerCount || 0) + 1;
      const offerNumber = `OFR-${new Date().getFullYear()}-${String(nextNum).padStart(4, '0')}`;

      // Create offer
      const { data: newOffer, error: offerError } = await supabase
        .from('offers')
        .insert({
          company_id: companyId,
          created_by_id: user.id,
          number: offerNumber,
          name: `Przedmiar AI — Strona ${selectedPage}`,
          status: 'draft',
          currency_id: 1, // Default PLN (id=1)
        })
        .select()
        .single();

      if (offerError || !newOffer) {
        throw new Error(offerError?.message || 'Błąd tworzenia oferty');
      }

      // Group by category
      const byCategory = positions.reduce((acc, p) => {
        const cat = p.category || 'Inne';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(p);
        return acc;
      }, {} as Record<string, TakeoffPosition[]>);

      for (const [catIdx, [catName, catItems]] of Object.entries(byCategory).entries()) {
        const { data: section, error: secErr } = await supabase
          .from('offer_sections')
          .insert({ offer_id: newOffer.id, name: catName, sort_order: catIdx })
          .select()
          .single();

        if (secErr || !section) continue;

        const itemsToInsert = catItems.map((p, pIdx) => ({
          offer_id: newOffer.id,
          section_id: section.id,
          name: p.name || 'Pozycja',
          description: p.description || '',
          quantity: p.count || 0,
          unit: p.unit || 'szt.',
          unit_price: 0,
          sort_order: pIdx,
          is_optional: false,
        }));

        if (itemsToInsert.length > 0) {
          await supabase.from('offer_items').insert(itemsToInsert);
        }
      }

      showToast(`Oferta ${offerNumber} utworzona! Przekierowuję…`, 'success');
      setTimeout(() => {
        navigate(`/construction/offers?offerId=${newOffer.id}`);
      }, 1200);
    } catch (e) {
      const msg = `Błąd tworzenia oferty: ${e instanceof Error ? e.message : String(e)}`;
      showToast(msg, 'error');
    } finally {
      setCreatingOffer(false);
    }
  }, [positions, companyId, pageNumber, navigate, showToast]);

  return (
    <>
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-xl shadow-2xl w-[720px] max-h-[88vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-violet-600" />
              <h3 className="font-semibold text-sm">AI Przedmiarowanie</h3>
              {step === 'done' && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">Gotowe</span>
              )}
            </div>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={16} /></button>
          </div>

          {/* Progress bar */}
          <div className="px-4 pt-2 pb-1">
            <ProgressBar step={step} />
            <div className="flex justify-between mt-1">
              {(['page_select', 'scale', 'analyzing', 'result', 'done'] as WizardStep[]).map(s => (
                <span key={s} className={`text-[9px] font-medium ${step === s ? 'text-blue-600' : 'text-gray-300'}`}>
                  {s === 'page_select' ? 'Strona' : s === 'scale' ? 'Skala' : s === 'analyzing' ? 'Analiza AI' : s === 'result' ? 'Weryfikacja' : 'Gotowe'}
                </span>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="p-4 flex-1 overflow-y-auto space-y-3">

            {/* Step: Page Selection */}
            {step === 'page_select' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  <Sparkles size={14} className="text-blue-600" />
                  <span className="text-xs font-medium text-blue-700">Wybierz stronę PDF do analizy AI</span>
                </div>
                <PageThumbnails
                  pdfDoc={pdfDoc}
                  currentPage={selectedPage}
                  onSelect={setSelectedPage}
                />
                <button
                  onClick={() => setStep('scale')}
                  className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition"
                >
                  Dalej — Potwierdź skalę →
                </button>
              </div>
            )}

            {/* All other steps — show only when not on page_select */}
            {step !== 'page_select' && (
              <div className="space-y-3">

            {/* Restored session banner */}
            {hasSavedState && step === 'result' && (
              <div className="flex items-center gap-2 text-xs bg-blue-50 border border-blue-200 rounded px-3 py-2 text-blue-700">
                <Sparkles size={12} />
                <span>Przywrócono zapisany wynik analizy. Możesz kontynuować edycję.</span>
                <button
                  onClick={() => {
                    clearSavedState();
                    setStep(pdfDoc.numPages > 1 ? 'page_select' : 'scale');
                    setPositions([]);
                    setClaudeRaw(null);
                    setGeminiRaw(null);
                    setScaleConfirmed(false);
                  }}
                  className="ml-auto text-[10px] underline text-blue-500 hover:text-blue-700"
                >
                  Zacznij od nowa
                </button>
              </div>
            )}

            {/* Scale block — only before confirm */}
            {!scaleConfirmed && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Scale size={13} className="text-amber-600" />
                  <span className="text-xs font-semibold text-amber-700">Potwierdź skalę rysunku</span>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {/* Detected scale option */}
                  {(detectedScale || currentScaleRatio) && (
                    <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                      <input
                        type="radio"
                        name="scaleChoice"
                        defaultChecked
                        onChange={() => setScaleLabel(currentScaleRatio
                          ? `1 px = ${currentScaleRatio.toFixed(3)} mm`
                          : detectedScale || ''
                        )}
                        className="accent-green-600"
                      />
                      {currentScaleRatio
                        ? `Skalibrowana: 1 px = ${currentScaleRatio.toFixed(3)} mm`
                        : `Wykryta: ${detectedScale}`}
                    </label>
                  )}

                  {/* Inna — opens ScaleSettingsModal */}
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                    <input
                      type="radio"
                      name="scaleChoice"
                      defaultChecked={!detectedScale && !currentScaleRatio}
                      onChange={() => setShowScaleModal(true)}
                      className="accent-amber-600"
                    />
                    Inna skala…
                  </label>

                  <button
                    onClick={() => setScaleConfirmed(true)}
                    className="ml-auto px-3 py-1 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded font-medium"
                  >
                    Potwierdzam
                  </button>
                </div>

                {scaleLabel && (
                  <p className="mt-2 text-[11px] text-gray-500">Aktualna skala: <strong>{scaleLabel}</strong></p>
                )}
              </div>
            )}

            {/* Scale confirmed banner */}
            {scaleConfirmed && step === 'scale' && (
              <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                <CheckCircle size={12} />
                <span>Skala potwierdzona: <strong>{scaleLabel || 'ustawiona'}</strong></span>
                <button
                  onClick={() => setScaleConfirmed(false)}
                  className="ml-auto text-[10px] text-gray-400 hover:text-gray-600 underline"
                >
                  Zmień
                </button>
              </div>
            )}

            {/* Loading with status message */}
            {isLoading && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 size={28} className="text-blue-600 animate-spin" />
                <span className="text-sm text-gray-600">{statusMsg}</span>
                {step === 'analyzing' && (
                  <p className="text-[11px] text-gray-400 text-center max-w-sm">
                    Claude Vision analizuje symbole i trasy…<br />
                    Gemini sprawdza legendę…<br />
                    To może potrwać 20–40 sekund.
                  </p>
                )}
              </div>
            )}

            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-100 p-3 rounded flex items-start gap-2">
                <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium mb-0.5">Wystąpił błąd</p>
                  <p>{error}</p>
                </div>
              </div>
            )}

            {/* Results table */}
            {(step === 'result' || step === 'done') && positions.length > 0 && (
              <div>
                <div className="text-xs text-gray-500 bg-gray-50 rounded p-2 mb-2 flex items-center gap-3">
                  <span>Pozycji: <strong className="text-gray-800">{positions.length}</strong></span>
                  <span className="text-green-700">✓ OK: {positions.filter(p => !p.needsReview).length}</span>
                  {reviewCount > 0 && (
                    <span className="flex items-center gap-1 text-amber-700">
                      <AlertTriangle size={11} /> Do weryfikacji: {reviewCount}
                    </span>
                  )}
                  <span className="ml-auto text-[10px] text-gray-400 flex items-center gap-1">
                    <Edit2 size={10} /> Kliknij ilość aby edytować
                  </span>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 text-gray-500 border-b">
                      <tr>
                        <th className="px-3 py-2 font-medium">Pozycja</th>
                        <th className="px-3 py-2 font-medium">Kategoria</th>
                        <th className="px-3 py-2 font-medium text-right">Ilość</th>
                        <th className="px-3 py-2 font-medium">Jm</th>
                        <th className="px-3 py-2 font-medium text-center">Pewność</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {positions.map((pos, i) => (
                        <tr key={i} className={`hover:bg-gray-50 ${pos.needsReview ? 'bg-amber-50/40' : ''}`}>
                          <td className="px-3 py-2 text-gray-800 font-medium max-w-[200px]">
                            <div className="truncate" title={pos.name}>{pos.name}</div>
                            {pos.legendRef && <div className="text-[10px] text-gray-400">{pos.legendRef}</div>}
                          </td>
                          <td className="px-3 py-2 text-gray-500 max-w-[120px]">
                            <div className="truncate" title={pos.category}>{pos.category}</div>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <EditableQty
                              value={pos.count}
                              onChange={(v) => updatePositionCount(i, v)}
                            />
                          </td>
                          <td className="px-3 py-2 text-gray-500">{pos.unit}</td>
                          <td className="px-3 py-2 text-center">
                            {(() => {
                              const pct = Math.round(pos.confidence * 100);
                              const cls = pct >= 80 ? 'text-green-700 bg-green-50' : pct >= 60 ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50';
                              return <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono ${cls}`}>{pct}%</span>;
                            })()}
                          </td>
                          <td className="px-3 py-2">
                            {pos.needsReview
                              ? <span className="flex items-center gap-1 text-amber-700 text-[10px]"><AlertTriangle size={10} />{pos.reviewReason}</span>
                              : <span className="text-green-700 text-[10px]">✓</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {reviewCount > 0 && (
                  <p className="mt-1.5 text-xs text-amber-700 flex items-center gap-1">
                    <AlertTriangle size={11} />
                    {reviewCount} pozycji do ręcznej weryfikacji — kliknij ilość aby poprawić.
                  </p>
                )}
              </div>
            )}

            {step === 'done' && (
              <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
                <CheckCircle size={14} />
                <span>Zapisano {positions.length} pozycji w tabeli przedmiaru.</span>
              </div>
            )}

              </div>
            )}

          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <button onClick={onClose} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100">
              {step === 'done' ? 'Zamknij' : 'Anuluj'}
            </button>
            <div className="flex items-center gap-2">
              {step === 'scale' && (
                <>
                  <button
                    onClick={() => setShowScaleModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded hover:bg-gray-100 text-gray-600"
                  >
                    <Settings2 size={13} /> Ustawienia skali
                  </button>
                  <button
                    onClick={run}
                    disabled={!scaleConfirmed}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Play size={13} />
                    {scaleConfirmed ? 'Analizuj rysunek' : 'Najpierw potwierdź skalę'}
                  </button>
                </>
              )}
              {step === 'result' && positions.length > 0 && (
                <>
                  {/* KNR Enrichment button */}
                  <button
                    onClick={async () => {
                      showToast('Wzbogacam pozycje o kody KNR…', 'info');
                      try {
                        const positionsForKnr = positions.map(p => ({ id: p.id, name: p.name, unit: p.unit }));
                        const { data, error } = await supabase.functions.invoke('knr-ai-lookup', {
                          body: { positions: positionsForKnr },
                        });
                        if (error) throw error;
                        if (data?.results) {
                          setPositions(prev => prev.map((p, i) => {
                            const knr = data.results.find((r: any) => r.index === i);
                            if (knr?.code) {
                              return { ...p, description: knr.description || p.description, knrCode: knr.code };
                            }
                            return p;
                          }));
                          showToast(`Dodano kody KNR do ${data.results.filter((r: any) => r.code).length} pozycji`, 'success');
                        }
                      } catch (e) {
                        showToast('Błąd pobierania KNR', 'error');
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
                    title="Pobierz kody KNR dla wszystkich pozycji"
                  >
                    KNR
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const XLSX = await import('xlsx');
                        const date = new Date().toISOString().slice(0, 10);
                        const wsData = [
                          ['Lp.', 'Nazwa pozycji', 'Jednostka', 'Ilosc', 'Kategoria', 'Pewnosc', 'Wymaga przegladu'],
                          ...positions.map((p, i) => [
                            i + 1, p.name, p.unit, p.count, p.category,
                            `${Math.round(p.confidence * 100)}%`,
                            p.needsReview ? 'TAK' : 'NIE'
                          ]),
                        ];
                        const ws = XLSX.utils.aoa_to_sheet(wsData);
                        ws['!cols'] = [{wch:5},{wch:40},{wch:10},{wch:10},{wch:20},{wch:10},{wch:15}];
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, 'Przedmiar AI');
                        XLSX.writeFile(wb, `przedmiar_AI_str${pageNumber}_${date}.xlsx`);
                        showToast('Excel pobrany!', 'success');
                      } catch(e) { showToast('Blad eksportu', 'error'); }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700"
                    title="Pobierz przedmiar jako Excel"
                  >
                    <FilePlus size={13} />
                    Excel
                  </button>
                  <button
                    onClick={saveAndCreate}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    <Check size={13} />
                    Zapisz ({positions.filter(p => p.count > 0).length} poz.)
                  </button>
                  <button
                    onClick={createOffer}
                    disabled={creatingOffer}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-50"
                  >
                    {creatingOffer ? <Loader2 size={13} className="animate-spin" /> : <FilePlus size={13} />}
                    Utwórz ofertę
                  </button>
                </>
              )}
              {step === 'done' && (
                <button
                  onClick={createOffer}
                  disabled={creatingOffer}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-50"
                >
                  {creatingOffer ? <Loader2 size={13} className="animate-spin" /> : <FilePlus size={13} />}
                  Utwórz ofertę z przedmiaru
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scale Settings Modal — identical to PlansWorkspace */}
      {showScaleModal && (
        <ScaleSettingsModal
          currentScaleRatio={currentScaleRatio}
          aiScaleLoading={aiScaleLoading}
          onScaleChange={(ratio) => {
            if (onScaleChange) onScaleChange(ratio);
            const denom = Math.round(ratio / 0.3528);
            setScaleLabel(`1:${denom}`);
            setShowScaleModal(false);
          }}
          onCalibrateScale={onCalibrateScale}
          onAiScaleDetect={onAiScaleDetect}
          onClose={() => setShowScaleModal(false)}
        />
      )}

      {/* Toast notification */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </>
  );
}
