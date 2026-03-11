import React, { useState, useCallback } from 'react';
import { Sparkles, Loader2, CheckCircle, AlertTriangle, Play, X, Scale } from 'lucide-react';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { supabase } from '../../lib/supabase';
import type { PdfAnalysisExtra } from '../../lib/pdfAnalyzer';
import type { TakeoffRule } from '../../lib/dxfTakeoff';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PdfTakeoffWizardProps {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  planId: string;
  companyId: string;
  analysisExtra: PdfAnalysisExtra;
  onTakeoffCreated: (rules: TakeoffRule[]) => void;
  onClose: () => void;
}

type WizardStep = 'scale' | 'rendering' | 'analyzing' | 'comparing' | 'creating' | 'done';

interface LegendEntry {
  label: string;
  description?: string;
  entryType?: string;
  color?: string;
  category?: string;
}

interface ComparedRow {
  label: string;
  category?: string;
  entryType?: string;
  color?: string;
  gemini: boolean;
  claude: boolean;
  geminiColor?: string;
  claudeColor?: string;
  confidence: number;
  needsReview: boolean;
  reviewReason?: string;
  status: 'ok' | 'mismatch' | 'single';
}

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

function normalize(s: string) { return s.toLowerCase().trim().replace(/\s+/g, ' '); }

function labelSimilarity(a: string, b: string): number {
  const na = normalize(a); const nb = normalize(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.8;
  const wa = na.split(' '); const wb = nb.split(' ');
  return wa.filter(w => wb.includes(w)).length / Math.max(wa.length, wb.length);
}

function computeConfidence(gemini: boolean, claude: boolean, status: string): number {
  if (gemini && claude && status === 'ok') return 0.92;
  if (gemini && claude && status === 'mismatch') return 0.55;
  if (gemini && !claude) return 0.65;
  if (!gemini && claude) return 0.60;
  return 0.50;
}

function buildStyleGroupsSummary(extra: PdfAnalysisExtra): string {
  return (extra.styleGroups || []).slice(0, 20).map(g =>
    `color:${g.strokeColor} width:${g.lineWidth} dash:${(g.dashPattern || []).join(',') || 'solid'} paths:${g.pathCount} length:${g.totalLengthM?.toFixed(1) ?? '?'}m`
  ).join('\n');
}

function compareResults(
  geminiEntries: LegendEntry[],
  claudeBlocks: Array<{ name?: string; category?: string; color?: string }>,
  claudeLines: Array<{ label?: string; category?: string; color?: string }>,
): ComparedRow[] {
  const claudeItems = [
    ...claudeBlocks.map(b => ({ name: b.name || '', category: b.category, color: b.color, entryType: 'symbol' })),
    ...claudeLines.map(l => ({ name: l.label || '', category: l.category, color: l.color, entryType: 'line' })),
  ];
  const matched = new Set<number>();
  const rows: ComparedRow[] = [];

  for (const ge of geminiEntries) {
    let bestIdx = -1; let bestScore = 0;
    claudeItems.forEach((ci, i) => {
      if (matched.has(i)) return;
      const s = labelSimilarity(ge.label, ci.name);
      if (s > bestScore) { bestScore = s; bestIdx = i; }
    });
    if (bestIdx >= 0 && bestScore >= 0.5) {
      matched.add(bestIdx);
      const ci = claudeItems[bestIdx];
      const colorMismatch = !!(ge.color && ci.color && normalize(ge.color) !== normalize(ci.color));
      const status: ComparedRow['status'] = colorMismatch ? 'mismatch' : 'ok';
      const conf = computeConfidence(true, true, status);
      rows.push({ label: ge.label, category: ge.category || ci.category, entryType: ge.entryType || ci.entryType,
        color: ge.color || ci.color, gemini: true, claude: true, geminiColor: ge.color, claudeColor: ci.color,
        confidence: conf, needsReview: conf < 0.70, reviewReason: colorMismatch ? `Kolor: Gemini=${ge.color}, Claude=${ci.color}` : undefined, status });
    } else {
      const conf = computeConfidence(true, false, 'single');
      rows.push({ label: ge.label, category: ge.category, entryType: ge.entryType, color: ge.color,
        gemini: true, claude: false, geminiColor: ge.color, confidence: conf,
        needsReview: true, reviewReason: 'Tylko Gemini — Claude nie wykryło', status: 'single' });
    }
  }
  claudeItems.forEach((ci, i) => {
    if (!matched.has(i) && ci.name) {
      const conf = computeConfidence(false, true, 'single');
      rows.push({ label: ci.name, category: ci.category, entryType: ci.entryType, color: ci.color,
        gemini: false, claude: true, claudeColor: ci.color, confidence: conf,
        needsReview: true, reviewReason: 'Tylko Claude — Gemini nie wykryło', status: 'single' });
    }
  });
  return rows;
}

function buildRules(rows: ComparedRow[]): TakeoffRule[] {
  return rows.map((row, index) => {
    const isLine = (row.entryType || '').toLowerCase() === 'line';
    return {
      id: `takeoff-${Date.now()}-${index}`,
      name: row.label,
      category: row.category || 'Inne',
      matchType: isLine ? 'style_color' : 'block_contains',
      matchPattern: row.color || row.label,
      quantitySource: isLine ? 'group_length_m' : 'count',
      unit: isLine ? 'm' : 'szt.',
      multiplier: 1,
      isDefault: false,
    } as TakeoffRule;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PdfTakeoffWizard({
  pdfDoc, pageNumber, planId, companyId, analysisExtra, onTakeoffCreated, onClose,
}: PdfTakeoffWizardProps) {
  const [step, setStep] = useState<WizardStep>('scale');
  const [statusMsg, setStatusMsg] = useState('');
  const [comparedRows, setComparedRows] = useState<ComparedRow[]>([]);
  const [pendingRules, setPendingRules] = useState<TakeoffRule[]>([]);
  const [error, setError] = useState('');

  const detectedScale = analysisExtra.scaleInfo?.scaleText || null;
  const [scaleConfirmed, setScaleConfirmed] = useState(false);
  const [customScale, setCustomScale] = useState(detectedScale || '1:100');
  const [scaleSource, setScaleSource] = useState<'detected' | 'custom'>(detectedScale ? 'detected' : 'custom');

  const isLoading = step === 'rendering' || step === 'analyzing' || step === 'creating';
  const reviewCount = comparedRows.filter(r => r.needsReview).length;
  const okCount = comparedRows.filter(r => !r.needsReview).length;

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
    setStatusMsg('Gemini + Claude analizują równolegle…');
    const styleGroupsSummary = buildStyleGroupsSummary(analysisExtra);
    const [legendRes, rasterRes] = await Promise.allSettled([
      supabase.functions.invoke('pdf-analyze-legend', {
        body: { legendImageBase64: pageBase64, mimeType: 'image/jpeg', styleGroupsSummary },
      }),
      supabase.functions.invoke('pdf-analyze-raster', {
        body: { imageBase64: pageBase64, mimeType: 'image/jpeg', pageNumber },
      }),
    ]);
    const geminiEntries: LegendEntry[] =
      legendRes.status === 'fulfilled'
        ? (legendRes.value.data?.data?.entries || legendRes.value.data?.entries || [])
        : [];
    const rasterData = rasterRes.status === 'fulfilled' && rasterRes.value.data ? rasterRes.value.data : {};
    const claudeBlocks = (rasterData as any).blocks || [];
    const claudeLines = (rasterData as any).lineGroups || [];
    if (!geminiEntries.length && !claudeBlocks.length && !claudeLines.length) {
      setError('Żadna analiza AI nie zwróciła wyników. Spróbuj ponownie lub sprawdź jakość rysunku.');
      setStep('scale');
      return;
    }
    const rows = compareResults(geminiEntries, claudeBlocks, claudeLines);
    setComparedRows(rows);
    setPendingRules(buildRules(rows));
    setStep('comparing');
    setStatusMsg('');
  }, [pdfDoc, pageNumber, analysisExtra]);

  const createTakeoff = useCallback(async () => {
    if (!pendingRules.length) return;
    setStep('creating');
    setStatusMsg('Zapisuję reguły…');
    try {
      await supabase.from('drawing_takeoff_rules').insert(pendingRules.map(r => ({
        plan_id: planId, company_id: companyId, name: r.name, category: r.category,
        match_type: r.matchType, match_pattern: r.matchPattern, quantity_source: r.quantitySource,
        unit: r.unit, multiplier: r.multiplier, is_default: false, is_ai_generated: true, enabled: true,
      })));
      setStep('done');
      setStatusMsg(`Zapisano ${pendingRules.length} reguł. Do weryfikacji: ${reviewCount}`);
      onTakeoffCreated(pendingRules);
    } catch (e) {
      setError(`Błąd zapisu: ${e instanceof Error ? e.message : String(e)}`);
      setStep('comparing');
    }
  }, [pendingRules, planId, companyId, onTakeoffCreated, reviewCount]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-[680px] max-h-[85vh] flex flex-col">

        {/* Header — matches PdfAnalysisModal */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-violet-600" />
            <h3 className="font-semibold text-sm">Wizard AI Przedmiarowania</h3>
            {step === 'done' && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                Gotowe
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="p-4 flex-1 overflow-y-auto space-y-3">

          {/* PROTECTION 1: Scale confirmation */}
          <div className={`rounded-lg border p-3 ${scaleConfirmed ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Scale size={13} className={scaleConfirmed ? 'text-green-600' : 'text-amber-600'} />
              <span className={`text-xs font-semibold ${scaleConfirmed ? 'text-green-700' : 'text-amber-700'}`}>
                Ochrona 1: Potwierdź skalę rysunku
              </span>
              {scaleConfirmed && <CheckCircle size={12} className="text-green-600" />}
            </div>
            {detectedScale && (
              <p className="text-xs text-gray-500 mb-2">
                Wykryta skala: <strong className="text-gray-800">{detectedScale}</strong>
                <span className="text-gray-400"> (z tekstu rysunku)</span>
              </p>
            )}
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                <input type="radio" checked={scaleSource === 'detected'} onChange={() => setScaleSource('detected')}
                  disabled={!detectedScale} className="accent-green-600" />
                Wykryta: {detectedScale || '—'}
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                <input type="radio" checked={scaleSource === 'custom'} onChange={() => setScaleSource('custom')} className="accent-amber-600" />
                Inna:
                <input type="text" value={customScale} onChange={e => setCustomScale(e.target.value)}
                  disabled={scaleSource !== 'custom'} placeholder="1:50"
                  className="ml-1 w-20 border border-gray-200 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-40" />
              </label>
              {!scaleConfirmed && (
                <button onClick={() => setScaleConfirmed(true)}
                  className="ml-auto px-3 py-1 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded font-medium">
                  Potwierdzam skalę
                </button>
              )}
            </div>
          </div>

          {/* Status */}
          {statusMsg && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {isLoading && <Loader2 size={12} className="text-blue-600 animate-spin" />}
              {step === 'done' && <CheckCircle size={12} className="text-green-600" />}
              <span>{statusMsg}</span>
            </div>
          )}

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 p-2 rounded flex items-center gap-1.5">
              <AlertTriangle size={12} className="shrink-0" />{error}
            </div>
          )}

          {/* PROTECTION 2+3: Comparison table */}
          {comparedRows.length > 0 && (
            <div>
              {/* Summary bar */}
              <div className="text-xs text-gray-500 bg-gray-50 rounded p-2 mb-2 flex items-center gap-3">
                <span>Razem: <strong className="text-gray-800">{comparedRows.length}</strong></span>
                <span className="text-green-700">✓ OK: {okCount}</span>
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
                      <th className="px-3 py-2 font-medium">Element</th>
                      <th className="px-3 py-2 font-medium text-violet-700">Gemini</th>
                      <th className="px-3 py-2 font-medium text-blue-700">Claude</th>
                      <th className="px-3 py-2 font-medium text-center">Pewność</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {comparedRows.map((row, i) => (
                      <tr key={i} className={`hover:bg-gray-50 ${row.needsReview ? 'bg-amber-50/50' : ''}`}>
                        <td className="px-3 py-2 text-gray-800 font-medium max-w-[180px] truncate" title={row.label}>
                          {row.label}
                        </td>
                        <td className="px-3 py-2">
                          {row.gemini
                            ? <span className="text-violet-700 font-bold bg-violet-50 px-1.5 py-0.5 rounded">✓{row.geminiColor ? <span className="text-gray-400 font-normal ml-1">{row.geminiColor}</span> : null}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          {row.claude
                            ? <span className="text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded">✓{row.claudeColor ? <span className="text-gray-400 font-normal ml-1">{row.claudeColor}</span> : null}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {(() => {
                            const pct = Math.round(row.confidence * 100);
                            const cls = pct >= 85 ? 'text-green-700 bg-green-50' : pct >= 65 ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50';
                            return <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono ${cls}`}>{pct}%</span>;
                          })()}
                        </td>
                        <td className="px-3 py-2">
                          {row.needsReview
                            ? <span className="flex items-center gap-1 text-amber-700"><AlertTriangle size={11} /><span className="text-[10px]">{row.reviewReason}</span></span>
                            : <span className="text-green-700 text-[10px]">✓ OK</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {reviewCount > 0 && (
                <p className="mt-1.5 text-xs text-amber-700 flex items-center gap-1">
                  <AlertTriangle size={11} />
                  {reviewCount} pozycji wymaga ręcznej weryfikacji — zostaną uwzględnione, ale zaznaczone.
                </p>
              )}
            </div>
          )}

          {step === 'done' && (
            <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <CheckCircle size={14} />
              <span>Przedmiar gotowy! Reguły zapisane i aktywowane w przestrzeni roboczej.</span>
            </div>
          )}
        </div>

        {/* Footer — matches existing modal style */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100">
            {step === 'done' ? 'Zamknij' : 'Anuluj'}
          </button>
          <div className="flex items-center gap-2">
            {step === 'scale' && (
              <button onClick={run} disabled={!scaleConfirmed || isLoading}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
                <Play size={14} /> {scaleConfirmed ? 'Uruchom analizę AI' : 'Najpierw potwierdź skalę'}
              </button>
            )}
            {step === 'comparing' && pendingRules.length > 0 && (
              <button onClick={createTakeoff}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700">
                <Sparkles size={14} /> Utwórz przedmiar ({pendingRules.length})
              </button>
            )}
            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2 size={12} className="animate-spin text-blue-600" />
                {step === 'rendering' ? 'Renderowanie…' : step === 'analyzing' ? 'AI analizuje…' : 'Zapisywanie…'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
