// ============================================================
// Public Plan View — read-only shared drawing link
// Access: /public/plan-view?planId=XXX
// ============================================================
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { FileText, AlertTriangle, Loader2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

interface PlanData {
  id: string;
  name: string;
  file_url: string;
  original_filename?: string;
  created_at: string;
  version?: number;
  company_id?: string;
  // project info
  project_name?: string;
}

export const PlanView: React.FC = () => {
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pdfPage, setPdfPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoom, setZoom] = useState(1.0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);

  const planId = new URLSearchParams(window.location.hash.split('?')[1] || '').get('planId');

  useEffect(() => {
    if (!planId) {
      setError('Brak identyfikatora pliku. Sprawdź link.');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const { data, error: dbErr } = await supabase
          .from('plans')
          .select('id, name, file_url, original_filename, created_at, version, company_id')
          .eq('id', planId)
          .single();

        if (dbErr || !data) {
          setError('Plik nie został znaleziony lub link wygasł.');
          setLoading(false);
          return;
        }
        setPlan(data);

        // Load PDF if it's a PDF file
        const filename = (data.original_filename || data.name || '').toLowerCase();
        if (filename.endsWith('.pdf')) {
          const loadingTask = pdfjsLib.getDocument(data.file_url);
          const doc = await loadingTask.promise;
          setPdfDoc(doc);
          setTotalPages(doc.numPages);
        }
        setLoading(false);
      } catch (e: any) {
        setError(e.message || 'Błąd ładowania pliku.');
        setLoading(false);
      }
    })();
  }, [planId]);

  // Render PDF page on canvas
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    const renderPage = async () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
      const page = await pdfDoc.getPage(pdfPage);
      const viewport = page.getViewport({ scale: zoom });
      const canvas = canvasRef.current!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      const renderTask = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = renderTask;
      try {
        await renderTask.promise;
      } catch (e: any) {
        if (e?.name !== 'RenderingCancelledException') {
          console.error('render error:', e);
        }
      }
    };

    renderPage();
  }, [pdfDoc, pdfPage, zoom]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm">Ładowanie planu…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-700 mb-2">Nie można załadować planu</h2>
          <p className="text-sm text-slate-500">{error}</p>
          <p className="text-xs text-slate-400 mt-4">MaxMaster — Plany i Rysunki</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-800 truncate max-w-[300px]">{plan?.name}</h1>
            <p className="text-[10px] text-slate-400">
              MaxMaster • Udostępniony plan (tylko do odczytu)
              {plan?.version && ` • Wersja ${plan.version}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
          <FileText className="w-3 h-3" />
          {plan?.original_filename || plan?.name}
        </div>
      </header>

      {/* PDF Viewer */}
      {pdfDoc ? (
        <div className="flex-1 flex flex-col">
          {/* Toolbar */}
          <div className="bg-white border-b border-slate-200 px-3 py-1.5 flex items-center gap-2">
            <button
              onClick={() => setPdfPage(p => Math.max(1, p - 1))}
              disabled={pdfPage <= 1}
              className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded disabled:opacity-40"
            >‹</button>
            <span className="text-xs text-slate-600">Strona {pdfPage} / {totalPages}</span>
            <button
              onClick={() => setPdfPage(p => Math.min(totalPages, p + 1))}
              disabled={pdfPage >= totalPages}
              className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded disabled:opacity-40"
            >›</button>
            <div className="w-px h-4 bg-slate-200 mx-1" />
            <button onClick={() => setZoom(z => Math.min(4, z + 0.25))} className="p-1 hover:bg-slate-100 rounded text-slate-600" title="Powiększ">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs text-slate-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} className="p-1 hover:bg-slate-100 rounded text-slate-600" title="Pomniejsz">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setZoom(1.0)} className="p-1 hover:bg-slate-100 rounded text-slate-600" title="Reset">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
          {/* Canvas */}
          <div className="flex-1 overflow-auto bg-slate-200 flex items-start justify-center p-4">
            <canvas
              ref={canvasRef}
              className="shadow-lg bg-white"
              style={{ maxWidth: '100%', height: 'auto' }}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow p-8 text-center max-w-sm">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-600 mb-1">{plan?.name}</p>
            <p className="text-xs text-slate-400 mb-4">{plan?.original_filename}</p>
            <a
              href={plan?.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              Pobierz plik
            </a>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 px-4 py-2 text-center">
        <p className="text-[10px] text-slate-400">
          © MaxMaster Sp. z o.o. — ten widok jest dostępny tylko do odczytu. Data udostępnienia: {plan?.created_at ? new Date(plan.created_at).toLocaleDateString('pl-PL') : ''}
        </p>
      </footer>
    </div>
  );
};

export default PlanView;
