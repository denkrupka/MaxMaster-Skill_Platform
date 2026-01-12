import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Download, ExternalLink, ZoomIn, ZoomOut, Loader2, RotateCw, FileText, AlertCircle } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Ensure worker is set up correctly
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs`;

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  urls: string[];
  initialIndex?: number;
  title?: string;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({ 
  isOpen, 
  onClose, 
  urls = [], 
  initialIndex = 0, 
  title = 'Podgląd Dokumentu' 
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // PDF State
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);

  // Reset index when opening
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setError(null);
    }
  }, [isOpen, initialIndex]);

  // Determine file type helper
  const isPdfUrl = (url: string) => {
      if (!url) return false;
      const lower = url.toLowerCase();
      return lower.endsWith('.pdf') || lower.includes('.pdf?') || lower.includes('#pdf') || (lower.startsWith('blob:') && lower.endsWith('#pdf'));
  };

  const currentUrl = urls && urls.length > 0 ? urls[currentIndex] : null;
  const isPdf = currentUrl ? isPdfUrl(currentUrl) : false;

  // Load Content
  useEffect(() => {
    if (!isOpen) return;
    
    if (!currentUrl) {
      setPdfDoc(null);
      setNumPages(0);
      setIsLoading(false);
      if (urls.length === 0) {
        setError('Brak plików do wyświetlenia w tym dokumencie.');
      }
      return;
    }
    
    // Reset state for new load
    setPdfDoc(null);
    setPageNum(1);
    setNumPages(0);
    setScale(1.0);
    setRotation(0);
    setError(null);
    setIsLoading(true);

    if (isPdf) {
      const loadingTask = pdfjsLib.getDocument(currentUrl);
      loadingTask.promise.then((pdf) => {
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setIsLoading(false);
      }, (reason) => {
        console.error('Error loading PDF:', reason);
        setError('Nie udało się otworzyć pliku PDF. Sprawdź czy plik nie jest uszkodzony lub czy masz dostęp (CORS).');
        setIsLoading(false);
      });
    } else {
      // For images, loading is handled by the <img> onLoad event
      // but we clear error here
      setError(null);
    }

    return () => {
        if (renderTaskRef.current) {
            renderTaskRef.current.cancel();
        }
    };
  }, [currentIndex, isOpen, currentUrl, isPdf, urls]);

  // Render PDF Page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    const renderPage = async () => {
      try {
        if (renderTaskRef.current) {
            await renderTaskRef.current.cancel();
        }

        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale, rotation });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        
        await renderTask.promise;
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
            console.error('Render error:', err);
        }
      }
    };

    renderPage();
  }, [pdfDoc, pageNum, scale, rotation]);

  if (!isOpen) return null;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex < urls.length - 1) setCurrentIndex(prev => prev + 1);
  };

  const handleDownload = () => {
    if (!currentUrl) return;
    const link = document.createElement('a');
    link.href = currentUrl;
    link.download = `Dokument_${currentIndex + 1}${isPdf ? '.pdf' : ''}`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-[9999] flex flex-col animate-in fade-in duration-200" onClick={onClose}>
      
      {/* HEADER */}
      <div className="flex justify-between items-center px-6 py-4 bg-black/50 text-white backdrop-blur-sm" onClick={e => e.stopPropagation()}>
        <div className="flex flex-col">
            <h3 className="font-bold text-lg flex items-center gap-2">
                {isPdf ? <FileText size={20} className="text-blue-400"/> : null} {title}
            </h3>
            <span className="text-sm text-gray-400">
                Plik {urls.length > 0 ? currentIndex + 1 : 0} z {urls.length}
            </span>
        </div>
        <div className="flex items-center gap-4">
            {currentUrl && (
              <button onClick={handleDownload} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-300 hover:text-white" title="Pobierz">
                  <Download size={20}/>
              </button>
            )}
            {currentUrl && (
              <a href={currentUrl} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-300 hover:text-white" title="Otwórz w nowej karcie">
                  <ExternalLink size={20}/>
              </a>
            )}
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-300 hover:text-white">
                <X size={24}/>
            </button>
        </div>
      </div>

      {/* BODY */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden p-4" onClick={e => e.stopPropagation()}>
        
        {currentIndex > 0 && (
            <button className="absolute left-4 z-20 bg-white/10 hover:bg-white/20 p-3 rounded-full text-white transition-colors backdrop-blur-sm" onClick={handlePrev}>
                <ChevronLeft size={32}/>
            </button>
        )}

        <div className="w-full h-full flex items-center justify-center relative">
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <Loader2 size={48} className="animate-spin text-blue-500"/>
                </div>
            )}
            
            {error ? (
                <div className="text-white bg-slate-800/80 p-8 rounded-2xl flex flex-col items-center gap-4 border border-slate-700 max-w-md text-center shadow-2xl">
                    <AlertCircle size={48} className="text-red-400"/>
                    <span className="font-bold text-lg">{error}</span>
                    <p className="text-sm text-slate-400">Spróbuj odświeżyć stronę lub pobrać plik bezpośrednio przyciskiem na górze.</p>
                    {currentUrl && (
                      <a href={currentUrl} target="_blank" rel="noreferrer" className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-bold transition-colors">
                        Otwórz w nowym oknie
                      </a>
                    )}
                </div>
            ) : currentUrl ? (
                <>
                    {isPdf ? (
                        <div key={currentUrl} className="max-w-full max-h-full overflow-auto flex flex-col items-center">
                            <canvas ref={canvasRef} className="shadow-2xl max-w-full bg-white rounded shadow-2xl" />
                            {pdfDoc && (
                                <div className="absolute bottom-8 flex items-center gap-4 bg-black/80 p-2 rounded-full text-white backdrop-blur-sm shadow-xl z-20 border border-white/10">
                                    <button onClick={() => setPageNum(p => Math.max(1, p - 1))} disabled={pageNum <= 1} className="p-1 hover:text-blue-400 disabled:opacity-30"><ChevronLeft size={20}/></button>
                                    <span className="text-sm font-mono min-w-[60px] text-center">{pageNum} / {numPages}</span>
                                    <button onClick={() => setPageNum(p => Math.min(numPages, p + 1))} disabled={pageNum >= numPages} className="p-1 hover:text-blue-400 disabled:opacity-30"><ChevronRight size={20}/></button>
                                    <div className="w-px h-4 bg-white/20 mx-1"></div>
                                    <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} className="p-1 hover:text-blue-400"><ZoomOut size={18}/></button>
                                    <span className="text-xs w-10 text-center">{Math.round(scale * 100)}%</span>
                                    <button onClick={() => setScale(s => Math.min(3.0, s + 0.2))} className="p-1 hover:text-blue-400"><ZoomIn size={18}/></button>
                                    <button onClick={() => setRotation(r => (r + 90) % 360)} className="p-1 hover:text-blue-400 ml-1"><RotateCw size={18}/></button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <img 
                            key={currentUrl}
                            src={currentUrl} 
                            alt={`Dokument ${currentIndex + 1}`} 
                            className={`max-w-full max-h-full object-contain shadow-2xl transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                            onLoad={() => setIsLoading(false)}
                            onError={() => { 
                                setIsLoading(false); 
                                setError('Nie udało się załadować obrazu. Sprawdź połączenie internetowe.'); 
                            }}
                        />
                    )}
                </>
            ) : null}
        </div>

        {currentIndex < urls.length - 1 && (
            <button className="absolute right-4 z-20 bg-white/10 hover:bg-white/20 p-3 rounded-full text-white transition-colors backdrop-blur-sm" onClick={handleNext}>
                <ChevronRight size={32}/>
            </button>
        )}
      </div>

      {urls.length > 1 && (
          <div className="h-20 bg-black/60 flex justify-center items-center gap-3 overflow-x-auto px-6 backdrop-blur-sm border-t border-white/5" onClick={e => e.stopPropagation()}>
            {urls.map((u, idx) => (
                <button 
                    key={idx} 
                    onClick={() => setCurrentIndex(idx)}
                    className={`w-3 h-3 rounded-full transition-all duration-300 ${idx === currentIndex ? 'bg-blue-500 scale-150 shadow-[0_0_10px_rgba(59,130,246,0.8)]' : 'bg-white/30 hover:bg-white/50'}`}
                    title={`Plik ${idx + 1}`}
                />
            ))}
          </div>
      )}
    </div>
  );
};