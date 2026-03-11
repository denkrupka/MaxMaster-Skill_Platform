import React, { useState, useCallback } from 'react';
import { Sparkles, Loader2, CheckCircle, AlertTriangle, Play, X } from 'lucide-react';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { supabase } from '../../lib/supabase';
import type { PdfAnalysisExtra } from '../../lib/pdfAnalyzer';
import type { TakeoffRule } from '../../lib/dxfTakeoff';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PdfTakeoffWizardProps {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  planId: string;
  companyId: string;
  analysisExtra: PdfAnalysisExtra;
  onTakeoffCreated: (rules: TakeoffRule[]) => void;
  onClose: () => void;
}

type WizardStep = 'idle' | 'rendering' | 'analyzing' | 'comparing' | 'creating' | 'done';

interface LegendEntry {
  label: string;
  description?: string;
  entryType?: string;
  color?: string;
  category?: string;
}

interface RasterBlock {
  name?: string;
  count?: number;
  description?: string;
  category?: string;
  color?: string;
}

interface RasterLineGroup {
  label?: string;
  style?: string;
  color?: string;
  category?: string;
  totalLength?: number;
}

interface ComparedRow {
  label: string;
  geminiEntry?: LegendEntry;
  claudeEntry?: { name?: string; category?: string; color?: string; entryType?: string };
  status: 'ok' | 'mismatch' | 'single';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function renderPageToBase64(page: PDFPageProxy): Promise<string> {
  const baseVp = page.getViewport({ scale: 1 });
  const basePx = baseVp.width * baseVp.height;
  const maxPixels = 12_000_000;
  let renderScale = 3;
  if (basePx * 9 < 4_000_000) renderScale = 4;
  if (basePx * renderScale * renderScale > maxPixels) {
    renderScale = Math.max(2, Math.floor(Math.sqrt(maxPixels / basePx)));
  }
  const viewport = page.getViewport({ scale: renderScale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, viewport }).promise;
  const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
  return dataUrl.replace(/^data:image\/jpeg;base64,/, '');
}

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.8;
  return 0;
}

function compareResults(
  geminiEntries: LegendEntry[],
  claudeBlocks: RasterBlock[],
  claudeLines: RasterLineGroup[],
): ComparedRow[] {
  const claudeItems: Array<{ name: string; category?: string; color?: string; entryType?: string }> = [
    ...claudeBlocks.map(b => ({ name: b.name || '', category: b.category, color: b.color, entryType: 'symbol' })),
    ...claudeLines.map(l => ({ name: l.label || '', category: l.category, color: l.color, entryType: 'line' })),
  ];

  const matched = new Set<number>();
  const rows: ComparedRow[] = [];

  for (const ge of geminiEntries) {
    let bestIdx = -1;
    let bestScore = 0;
    claudeItems.forEach((ci, i) => {
      if (matched.has(i)) return;
      const score = similarity(ge.label, ci.name);
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    });

    if (bestIdx >= 0 && bestScore >= 0.5) {
      matched.add(bestIdx);
      const ci = claudeItems[bestIdx];
      const colorDiff = ge.color && ci.color
        ? ge.color.toLowerCase() !== ci.color.toLowerCase()
        : false;
      const status: ComparedRow['status'] = colorDiff ? 'mismatch' : 'ok';
      rows.push({ label: ge.label, geminiEntry: ge, claudeEntry: ci, status });
    } else {
      rows.push({ label: ge.label, geminiEntry: ge, status: 'single' });
    }
  }

  claudeItems.forEach((ci, i) => {
    if (!matched.has(i) && ci.name) {
      rows.push({ label: ci.name, claudeEntry: ci, status: 'single' });
    }
  });

  return rows;
}

function buildRules(rows: ComparedRow[]): TakeoffRule[] {
  return rows.map((row, index) => {
    const entry = row.geminiEntry || {
      label: row.label,
      category: row.claudeEntry?.category,
      entryType: row.claudeEntry?.entryType,
      color: row.claudeEntry?.color,
    };
    const isLine = (entry.entryType || '').toLowerCase() === 'line';
    return {
      id: `takeoff-${Date.now()}-${index}`,
      name: entry.label,
      category: entry.category || 'Inne',
      matchType: isLine ? 'style_color' : 'block_contains',
      matchPattern: entry.color || entry.label,
      quantitySource: isLine ? 'group_length_m' : 'count',
      unit: isLine ? 'm' : 'szt.',
      multiplier: 1,
      isDefault: false,
    } as TakeoffRule;
  });
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ComparedRow['status'] }) {
  if (status === 'ok')
    return <span className="inline-flex items-center gap-1 text-green-400 text-xs"><CheckCircle size={12} /> OK</span>;
  if (status === 'mismatch')
    return <span className="inline-flex items-center gap-1 text-red-400 text-xs"><AlertTriangle size={12} /> Różnica</span>;
  return <span className="inline-flex items-center gap-1 text-yellow-400 text-xs"><AlertTriangle size={12} /> Jeden źródło</span>;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PdfTakeoffWizard({
  pdfDoc,
  pageNumber,
  planId,
  companyId,
  analysisExtra,
  onTakeoffCreated,
  onClose,
}: PdfTakeoffWizardProps) {
  const [step, setStep] = useState<WizardStep>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [comparedRows, setComparedRows] = useState<ComparedRow[]>([]);
  const [pendingRules, setPendingRules] = useState<TakeoffRule[]>([]);
  const [error, setError] = useState('');

  const styleGroupsSummary = (analysisExtra.styleGroups || [])
    .slice(0, 20)
    .map(g => `${(g as any).color || '?'} stroke:${(g as any).strokeWidth ?? '?'}`)
    .join(', ');

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
      setStep('idle');
      return;
    }

    setStep('analyzing');
    setStatusMsg('Analizuję legendę (Gemini) i rastr (Claude) równolegle…');

    const [legendRes, rasterRes] = await Promise.allSettled([
      supabase.functions.invoke('pdf-analyze-legend', {
        body: { legendImageBase64: pageBase64, mimeType: 'image/jpeg', styleGroupsSummary },
      }),
      supabase.functions.invoke('pdf-analyze-raster', {
        body: { imageBase64: pageBase64, mimeType: 'image/jpeg', pageNumber },
      }),
    ]);

    const geminiEntries: LegendEntry[] =
      legendRes.status === 'fulfilled' && legendRes.value.data?.data?.entries
        ? legendRes.value.data.data.entries
        : [];

    const rasterData =
      rasterRes.status === 'fulfilled' && rasterRes.value.data
        ? rasterRes.value.data
        : {};

    const claudeBlocks: RasterBlock[] = (rasterData as any).blocks || [];
    const claudeLines: RasterLineGroup[] = (rasterData as any).lineGroups || [];

    if (geminiEntries.length === 0 && claudeBlocks.length === 0 && claudeLines.length === 0) {
      setError('Żadna z analiz AI nie zwróciła wyników. Spróbuj ponownie.');
      setStep('idle');
      return;
    }

    setStep('comparing');
    setStatusMsg('Porównuję wyniki…');
    const rows = compareResults(geminiEntries, claudeBlocks, claudeLines);
    setComparedRows(rows);
    setPendingRules(buildRules(rows));
    setStatusMsg('');
  }, [pdfDoc, pageNumber, styleGroupsSummary]);

  const createTakeoff = useCallback(async () => {
    if (!pendingRules.length) return;
    setStep('creating');
    setStatusMsg('Zapisuję reguły przedmiarowe…');
    try {
      const dbRows = pendingRules.map(r => ({
        ...r,
        plan_id: planId,
        company_id: companyId,
        created_at: new Date().toISOString(),
      }));
      const { error: dbErr } = await supabase.from('drawing_takeoff_rules').insert(dbRows);
      if (dbErr) throw new Error(dbErr.message);
      setStep('done');
      setStatusMsg(`Zapisano ${pendingRules.length} reguł przedmiarowych.`);
      onTakeoffCreated(pendingRules);
    } catch (e) {
      setError(`Błąd zapisu: ${e instanceof Error ? e.message : String(e)}`);
      setStep('comparing');
    }
  }, [pendingRules, planId, companyId, onTakeoffCreated]);

  const isLoading = step === 'rendering' || step === 'analyzing' || step === 'creating';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-purple-400" />
            <h2 className="text-white font-semibold text-sm">Wizard AI Przedmiarowania</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {statusMsg && (
            <div className="flex items-center gap-2 text-gray-300 text-sm">
              {isLoading && <Loader2 size={14} className="animate-spin text-purple-400" />}
              {step === 'done' && <CheckCircle size={14} className="text-green-400" />}
              <span>{statusMsg}</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 bg-red-900/30 border border-red-700 rounded-lg px-3 py-2 text-red-300 text-sm">
              <AlertTriangle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {comparedRows.length > 0 && (
            <div>
              <p className="text-gray-400 text-xs mb-2">Znaleziono {comparedRows.length} elementów</p>
              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-800 text-gray-400">
                    <tr>
                      <th className="px-3 py-2">Element</th>
                      <th className="px-3 py-2">Gemini (legenda)</th>
                      <th className="px-3 py-2">Claude (rastr)</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {comparedRows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-800/50">
                        <td className="px-3 py-2 text-white font-medium">{row.label}</td>
                        <td className="px-3 py-2 text-gray-300">
                          {row.geminiEntry
                            ? <>{row.geminiEntry.entryType || '?'}{row.geminiEntry.color ? <span className="text-gray-500"> ({row.geminiEntry.color})</span> : null}</>
                            : <span className="text-gray-600">—</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-300">
                          {row.claudeEntry
                            ? <>{row.claudeEntry.entryType || '?'}{row.claudeEntry.color ? <span className="text-gray-500"> ({row.claudeEntry.color})</span> : null}</>
                            : <span className="text-gray-600">—</span>}
                        </td>
                        <td className="px-3 py-2"><StatusBadge status={row.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="flex items-center gap-2 bg-green-900/30 border border-green-700 rounded-lg px-3 py-3 text-green-300 text-sm">
              <CheckCircle size={16} />
              <span>Przedmiar gotowy! Reguły zostały zapisane i aktywowane.</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            {step === 'done' ? 'Zamknij' : 'Anuluj'}
          </button>

          <div className="flex items-center gap-3">
            {(step === 'idle' || (step !== 'done' && error)) && (
              <button
                onClick={run}
                disabled={isLoading}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <Play size={14} />
                Uruchom analizę AI
              </button>
            )}

            {step === 'comparing' && pendingRules.length > 0 && (
              <button
                onClick={createTakeoff}
                disabled={isLoading}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <Sparkles size={14} />
                Utwórz przedmiar ({pendingRules.length})
              </button>
            )}

            {isLoading && (
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Loader2 size={14} className="animate-spin" />
                <span>{step === 'rendering' ? 'Renderowanie…' : step === 'analyzing' ? 'Analiza AI…' : 'Zapisywanie…'}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
