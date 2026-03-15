import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, Download, Printer, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface PDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string;
  documentName: string;
}

export const PDFPreviewModal: React.FC<PDFPreviewModalProps> = ({
  isOpen,
  onClose,
  pdfUrl,
  documentName,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scale, setScale] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setError('');
      setScale(1);
      setCurrentPage(1);
    }
  }, [isOpen, pdfUrl]);

  if (!isOpen) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `${documentName}.pdf`;
    link.click();
  };

  const handlePrint = () => {
    const printWindow = window.open(pdfUrl, '_blank');
    printWindow?.print();
  };

  const zoomIn = () => setScale(s => Math.min(s + 0.25, 3));
  const zoomOut = () => setScale(s => Math.max(s - 0.25, 0.5));

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
      <div className="bg-white w-full h-full flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-medium text-slate-800 truncate max-w-md">
              {documentName}
            </h2>
            <span className="text-xs text-slate-400">
              Strona {currentPage} z {totalPages}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Zoom controls */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              <button
                onClick={zoomOut}
                className="p-1.5 hover:bg-white rounded transition-colors"
                title="Pomniejsz"
              >
                <ZoomOut className="w-4 h-4 text-slate-600" />
              </button>
              <span className="text-xs text-slate-600 min-w-[50px] text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={zoomIn}
                className="p-1.5 hover:bg-white rounded transition-colors"
                title="Powiększ"
              >
                <ZoomIn className="w-4 h-4 text-slate-600" />
              </button>
            </div>

            {/* Page navigation */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 hover:bg-white rounded transition-colors disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 hover:bg-white rounded transition-colors disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>

            <div className="w-px h-6 bg-slate-200 mx-2" />

            {/* Actions */}
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Pobierz
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Printer className="w-4 h-4" />
              Drukuj
            </button>
            
            <button
              onClick={onClose}
              className="ml-2 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Zamknij"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="flex-1 bg-slate-100 overflow-auto flex items-center justify-center p-8">
          {loading && (
            <div className="flex items-center gap-3 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Ładowanie PDF...</span>
            </div>
          )}
          
          {error && (
            <div className="text-center">
              <p className="text-red-600 mb-2">{error}</p>
              <button
                onClick={handleDownload}
                className="text-blue-600 hover:underline text-sm"
              >
                Pobierz PDF bezpośrednio
              </button>
            </div>
          )}

          <iframe
            src={pdfUrl}
            className={`bg-white shadow-lg transition-transform origin-center ${loading ? 'hidden' : 'block'}`}
            style={{ 
              transform: `scale(${scale})`,
              width: '800px',
              height: '1130px',
              maxWidth: '100%',
            }}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError('Nie udało się załadować PDF');
            }}
            title="PDF Preview"
          />
        </div>
      </div>
    </div>
  );
};

export default PDFPreviewModal;
