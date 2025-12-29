
import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Download, ExternalLink, ZoomIn, ZoomOut, Loader2, RotateCw, FileText } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Ensure worker is set up correctly
// Use the same version as the main library
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
  urls, 
  initialIndex = 0, 
  title = 'Podgląd Dokumentu' 
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isLoading, setIsLoading] = useState(true);
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
    }
  }, [isOpen, initialIndex]);

  // Determine file type helper
  const isPdfUrl = (url: string) => {
      if (!url) return false;
      const lower = url.toLowerCase();
      return lower.endsWith('.pdf') || lower.includes('.pdf?') || lower.includes('#pdf') || (lower.startsWith('blob:') && lower.endsWith('#pdf'));
  };

  const currentUrl = urls[currentIndex];
  const isPdf = isPdfUrl(currentUrl);

  // Load Content
  useEffect(() => {
    if (!isOpen || !currentUrl) return;
    
    // Reset state
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
        setError('Nie udało się otworzyć pliku PDF. Plik może być uszkodzony lub niedostępny.');
        setIsLoading(false);
      });
    } else {
      // For images, loading is handled by the <img> onLoad event
      // Just ensure we clear previous errors
      setError(null);
      // We don't set isLoading(false) here, the img tag will do it
    }

    return () => {
        if (renderTaskRef.current) {
            renderTaskRef.current.cancel();
        }
    };
  }, [currentIndex, isOpen, currentUrl, isPdf]);

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
    const link = document.createElement('a');
    link.href = currentUrl;
    link.download = `Document_${currentIndex + 1}${isPdf ? '.pdf' : ''}`; // Simple heuristic
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
                {isPdf ? <FileText size={20}/> : null} {title}
            </h3>
            <span className="text-sm text-gray-400">Plik {currentIndex + 1} z {urls.length}</span>
        </div>
        <div className="flex items-center gap-4">
            <button onClick={handleDownload} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-300 hover:text-white" title="Pobierz">
                <Download size={20}/>
            </button>
            <a href={currentUrl} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-300 hover:text-white" title="Otwórz w nowej karcie">
                <ExternalLink size={20}/>
            </a>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-300 hover:text-white">
                <X size={24}/>
            </button>
        </div>
      </div>

      {/* BODY */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden p-4" onClick={e => e.stopPropagation()}>
        
        {/* Navigation - Left */}
        {currentIndex > 0 && (
            <button 
                className="absolute left-4 z-20 bg-white/10 hover:bg-white/20 p-3 rounded-full text-white transition-colors backdrop-blur-sm"
                onClick={handlePrev}
            >
                <ChevronLeft size={32}/>
            </button>
        )}

        {/* Content Area */}
        <div className="w-full h-full flex items-center justify-center relative">
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <Loader2 size={48} className="animate-spin text-blue-500"/>
                </div>
            )}
            
            {error ? (
                <div className="text-white bg-red-900/50 p-6 rounded-lg flex flex-col items-center gap-4 border border-red-500/50">
                    <span className="font-bold text-lg">Błąd ładowania pliku</span>
                    <span className="text-sm text-red-200">{error}</span>
                    <a href={currentUrl} target="_blank" rel="noreferrer" className="text-blue-300 underline hover:text-blue-100 mt-2">
                        Spróbuj otworzyć bezpośrednio
                    </a>
                </div>
            ) : (
                <>
                    {isPdf ? (
                        <div className="max-w-full max-h-full overflow-auto flex flex-col items-center">
                            <canvas ref={canvasRef} className="shadow-2xl max-w-full" />
                            {/* PDF Controls */}
                            {pdfDoc && (
                                <div className="absolute bottom-8 flex items-center gap-4 bg-black/80 p-2 rounded-full text-white backdrop-blur-sm shadow-xl z-20 border border-white/10">
                                    <button onClick={() => setPageNum(p => Math.max(1, p - 1))} disabled={pageNum <= 1} className="p-1 hover:text-blue-400 disabled:opacity-30"><ChevronLeft size={20}/></button>
                                    <span className="text-sm font-mono">{pageNum} / {numPages}</span>
                                    <button onClick={() => setPageNum(p => Math.min(numPages, p + 1))} disabled={pageNum >= numPages} className="p-1 hover:text-blue-400 disabled:opacity-30"><ChevronRight size={20}/></button>
                                    <div className="w-px h-4 bg-white/20 mx-1"></div>
                                    <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} className="p-1 hover:text-blue-400"><ZoomOut size={18}/></button>
                                    <span className="text-xs w-8 text-center">{Math.round(scale * 100)}%</span>
                                    <button onClick={() => setScale(s => Math.min(3.0, s + 0.2))} className="p-1 hover:text-blue-400"><ZoomIn size={18}/></button>
                                    <button onClick={() => setRotation(r => (r + 90) % 360)} className="p-1 hover:text-blue-400 ml-1"><RotateCw size={18}/></button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <img 
                            src={currentUrl} 
                            alt={`Document ${currentIndex}`} 
                            className={`max-w-full max-h-full object-contain shadow-2xl transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                            onLoad={() => setIsLoading(false)}
                            onError={() => { 
                                setIsLoading(false); 
                                setError('Nie udało się załadować obrazu. Format pliku może być nieobsługiwany.'); 
                            }}
                        />
                    )}
                </>
            )}
        </div>

        {/* Navigation - Right */}
        {currentIndex < urls.length - 1 && (
            <button 
                className="absolute right-4 z-20 bg-white/10 hover:bg-white/20 p-3 rounded-full text-white transition-colors backdrop-blur-sm"
                onClick={handleNext}
            >
                <ChevronRight size={32}/>
            </button>
        )}
      </div>

      {/* FOOTER / THUMBNAILS */}
      {urls.length > 1 && (
          <div className="h-16 bg-black/60 flex justify-center items-center gap-2 overflow-x-auto px-4 backdrop-blur-sm" onClick={e => e.stopPropagation()}>
            {urls.map((u, idx) => (
                <button 
                    key={idx} 
                    onClick={() => setCurrentIndex(idx)}
                    className={`w-3 h-3 rounded-full transition-all ${idx === currentIndex ? 'bg-blue-500 scale-125' : 'bg-white/30 hover:bg-white/50'}`}
                    title={`Plik ${idx + 1}`}
                />
            ))}
          </div>
      )}
    </div>
  );
};
