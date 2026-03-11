import React, { useState, useCallback } from 'react';
import { Sparkles, Loader2, CheckCircle, AlertTriangle, Play, X, Scale, Ruler, Settings2 } from 'lucide-react';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { supabase } from '../../lib/supabase';
import type { PdfAnalysisExtra } from '../../lib/pdfAnalyzer';

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

type WizardStep = 'scale' | 'rendering' | 'analyzing' | 'result' | 'saving' | 'done';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Main Component ────────────────────────────────────────────────────────────

export default function PdfTakeoffWizard({
  pdfDoc, pageNumber, planId, companyId, analysisExtra,
  currentScaleRatio, onScaleChange, onCalibrateScale, onAiScaleDetect, aiScaleLoading,
  onTakeoffCreated, onClose,
}: PdfTakeoffWizardProps) {
  const [step, setStep] = useState<WizardStep>('scale');
  const [statusMsg, setStatusMsg] = useState('');
  const [positions, setPositions] = useState<TakeoffPosition[]>([]);
  const [error, setError] = useState('');
  const [claudeRaw, setClaudeRaw] = useState<any>(null);
  const [geminiRaw, setGeminiRaw] = useState<any>(null);
  const [showScaleModal, setShowScaleModal] = useState(false);

  const detectedScale = analysisExtra.scaleInfo?.scaleText || null;
  const [scaleConfirmed, setScaleConfirmed] = useState(false);
  const [scaleLabel, setScaleLabel] = useState(
    currentScaleRatio
      ? `1 px = ${currentScaleRatio.toFixed(3)} mm`
      : detectedScale || ''
  );

  const isLoading = step === 'rendering' || step === 'analyzing' || step === 'saving';
  const reviewCount = positions.filter(p => p.needsReview).length;

  const run = useCallback(async () => {
    setError('');
    setStep('rendering');
    setStatusMsg('Renderowanie strony…');

    let pageBase64: string;
    try {
      const page = await pdfDoc.getPage(pageNumber);
      pageBase64 = await renderPageToBase64(page);
    } catch (e) {
      setError(`Błąd renderowania: ${e instanceof Error ? e.message : String(e)}`);
      setStep('scale');
      return;
    }

    setStep('analyzing');
    setStatusMsg('Claude analizuje rysunek i liczy elementy…');

    const [claudeRes, geminiRes] = await Promise.allSettled([
      supabase.functions.invoke('pdf-analyze-raster', {
        body: { imageBase64: pageBase64, mimeType: 'image/jpeg', pageNumber },
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

    const claudeData = claudeRes.status === 'fulfilled' ? (claudeRes.value.data?.data || claudeRes.value.data || {}) : {};
    const geminiData = geminiRes.status === 'fulfilled' ? (geminiRes.value.data?.data || geminiRes.value.data || {}) : {};

    setClaudeRaw(claudeData);
    setGeminiRaw(geminiData);

    const claudeSymbols: any[] = claudeData.symbols || [];
    const claudeRoutes: any[] = claudeData.routes || [];
    const geminiEntries: any[] = geminiData.entries || [];

    if (!claudeSymbols.length && !geminiEntries.length) {
      setError('AI nie wykryło żadnych elementów. Sprawdź czy rysunek zawiera legendę i elementy instalacji.');
      setStep('scale');
      return;
    }

    const geminiMap = new Map<string, any>();
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
      setError('Brak rozpoznanych elementów. Sprawdź jakość rysunku.');
      setStep('scale');
      return;
    }

    setPositions(result);
    setStep('result');
  }, [pdfDoc, pageNumber, analysisExtra]);

  const saveAndCreate = useCallback(async () => {
    setStep('saving');
    setStatusMsg('Zapisuję…');
    try {
      await supabase.from('drawing_analyses').upsert({
        plan_id: planId,
        page_number: pageNumber,
        analysis_data: claudeRaw,
        legend_data: geminiRaw,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'plan_id,page_number' });

      if (positions.length > 0) {
        await supabase.from('drawing_takeoff_results').insert(
          positions.map((p, i) => ({
            plan_id: planId,
            company_id: companyId,
            name: p.name,
            category: p.category,
            quantity: p.count,
            unit: p.unit,
            description: p.description,
            confidence: p.confidence,
            needs_review: p.needsReview,
            review_reason: p.reviewReason,
            source: p.source,
            sort_order: i,
          }))
        );
      }

      setStep('done');
      onTakeoffCreated(positions);
    } catch (e) {
      setError(`Błąd zapisu: ${e instanceof Error ? e.message : String(e)}`);
      setStep('result');
    }
  }, [positions, planId, companyId, claudeRaw, geminiRaw, onTakeoffCreated, pageNumber]);

  return (
    <>
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-xl shadow-2xl w-[700px] max-h-[85vh] flex flex-col">

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

          {/* Body */}
          <div className="p-4 flex-1 overflow-y-auto space-y-3">

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

            {/* Loading */}
            {isLoading && (
              <div className="flex items-center gap-2 py-6 justify-center">
                <Loader2 size={16} className="text-blue-600 animate-spin" />
                <span className="text-sm text-gray-600">{statusMsg}</span>
              </div>
            )}

            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-100 p-2 rounded flex items-center gap-1.5">
                <AlertTriangle size={12} className="shrink-0" />{error}
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
                          <td className="px-3 py-2 text-right font-mono text-gray-800">
                            {pos.count > 0 ? pos.count : <span className="text-gray-300">—</span>}
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
                    {reviewCount} pozycji do ręcznej weryfikacji — zostaną uwzględnione.
                  </p>
                )}
              </div>
            )}

            {step === 'done' && (
              <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
                <CheckCircle size={14} />
                <span>Zapisano {positions.length} pozycji.</span>
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
                <button
                  onClick={saveAndCreate}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                >
                  <Sparkles size={13} />
                  Utwórz przedmiar ({positions.filter(p => p.count > 0).length} pozycji)
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
    </>
  );
}
