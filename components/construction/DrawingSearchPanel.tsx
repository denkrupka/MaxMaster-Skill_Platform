import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Search, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import type { IDxf } from 'dxf-parser';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { searchDxfText, type DxfSearchResult } from '../../lib/dxfSearch';

export interface DrawingSearchResult {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page?: number; // PDF page number
  // DXF-specific
  dxfResult?: DxfSearchResult;
}

interface DrawingSearchPanelProps {
  mode: 'pdf' | 'dxf';
  // PDF props
  pdfDoc?: PDFDocumentProxy | null;
  pdfPage?: number;
  pdfPageWidth?: number;
  pdfPageHeight?: number;
  // DXF props
  dxfData?: IDxf | null;
  dxfHiddenLayers?: Set<string>;
  // Callbacks
  onResultSelect: (result: DrawingSearchResult) => void;
  onHighlightResults: (results: DrawingSearchResult[]) => void;
  onClose: () => void;
}

export default function DrawingSearchPanel({
  mode, pdfDoc, pdfPage, pdfPageWidth, pdfPageHeight,
  dxfData, dxfHiddenLayers,
  onResultSelect, onHighlightResults, onClose,
}: DrawingSearchPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DrawingSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const searchPdf = useCallback(async () => {
    if (!pdfDoc || !query.trim()) return [];
    const found: DrawingSearchResult[] = [];
    const q = caseSensitive ? query : query.toLowerCase();

    // Search current page first, then all pages
    const pagesToSearch = [pdfPage || 1];
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      if (i !== (pdfPage || 1)) pagesToSearch.push(i);
    }

    for (const pageNum of pagesToSearch) {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1 });

        for (const item of textContent.items) {
          const textItem = item as any;
          if (!textItem.str) continue;
          const str = caseSensitive ? textItem.str : textItem.str.toLowerCase();
          if (!str.includes(q)) continue;

          // Transform position from PDF coords to page coords
          // PDF coords: origin at bottom-left; page coords: origin at top-left
          const tx = textItem.transform[4];
          const ty = textItem.transform[5];
          const w = textItem.width || 0;
          const h = textItem.height || textItem.transform[3] || 10;

          found.push({
            text: textItem.str,
            x: tx,
            y: viewport.height - ty - h, // flip Y
            width: w,
            height: Math.abs(h),
            page: pageNum,
          });
        }
      } catch (err) {
        console.error(`Error searching PDF page ${pageNum}:`, err);
      }
    }
    return found;
  }, [pdfDoc, pdfPage, query, caseSensitive]);

  const searchDxf = useCallback(() => {
    if (!dxfData || !query.trim()) return [];
    const dxfResults = searchDxfText(dxfData, query, { caseSensitive, hiddenLayers: dxfHiddenLayers });
    return dxfResults.map(r => ({
      text: r.matchedText,
      x: r.position.x,
      y: r.position.y,
      width: 0,
      height: 0,
      dxfResult: r,
    }));
  }, [dxfData, query, caseSensitive, dxfHiddenLayers]);

  const doSearch = useCallback(async () => {
    if (!query.trim()) { setResults([]); setSearched(false); return; }
    setSearching(true);
    try {
      const found = mode === 'pdf' ? await searchPdf() : searchDxf();
      setResults(found);
      setSearched(true);
      setSelectedIndex(-1);
      onHighlightResults(found);
    } finally {
      setSearching(false);
    }
  }, [mode, query, searchPdf, searchDxf, onHighlightResults]);

  const navigateTo = (index: number) => {
    if (index < 0 || index >= results.length) return;
    setSelectedIndex(index);
    onResultSelect(results[index]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (results.length > 0 && selectedIndex >= 0) {
        // Navigate to next result
        navigateTo((selectedIndex + 1) % results.length);
      } else {
        doSearch();
      }
    }
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowDown' && results.length > 0) {
      e.preventDefault();
      navigateTo(Math.min(selectedIndex + 1, results.length - 1));
    }
    if (e.key === 'ArrowUp' && results.length > 0) {
      e.preventDefault();
      navigateTo(Math.max(selectedIndex - 1, 0));
    }
  };

  // Count results on current page vs total
  const currentPageResults = mode === 'pdf'
    ? results.filter(r => r.page === (pdfPage || 1)).length
    : results.length;

  return (
    <div className="absolute top-2 right-2 z-50 bg-white rounded-lg shadow-xl border w-80 max-h-96 flex flex-col">
      <div className="p-2 border-b">
        <div className="flex items-center gap-1">
          <Search size={16} className="text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSearched(false); }}
            onKeyDown={handleKeyDown}
            placeholder={mode === 'pdf' ? 'Szukaj tekst w PDF...' : 'Szukaj tekst w DXF...'}
            className="flex-1 text-sm border-none outline-none bg-transparent"
          />
          {results.length > 0 && (
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button onClick={() => navigateTo(Math.max(selectedIndex - 1, 0))} className="p-0.5 hover:bg-gray-100 rounded">
                <ChevronUp size={14} />
              </button>
              <span className="text-[10px] text-gray-500 min-w-[28px] text-center">
                {selectedIndex >= 0 ? selectedIndex + 1 : 0}/{results.length}
              </span>
              <button onClick={() => navigateTo(Math.min(selectedIndex + 1, results.length - 1))} className="p-0.5 hover:bg-gray-100 rounded">
                <ChevronDown size={14} />
              </button>
            </div>
          )}
          <button onClick={() => setShowOptions(!showOptions)} className="p-1 hover:bg-gray-100 rounded" title="Opcje">
            {showOptions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button onClick={() => { onHighlightResults([]); onClose(); }} className="p-1 hover:bg-gray-100 rounded">
            <X size={14} />
          </button>
        </div>
        {showOptions && (
          <div className="mt-1 flex items-center gap-2 text-xs text-gray-600">
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={caseSensitive} onChange={e => setCaseSensitive(e.target.checked)} className="rounded" />
              Wielkość liter
            </label>
          </div>
        )}
        <div className="flex items-center gap-1 mt-1">
          <button onClick={doSearch} disabled={searching} className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
            {searching ? 'Szukam...' : 'Szukaj'}
          </button>
          {searched && (
            <span className="text-xs text-gray-500">
              {mode === 'pdf' && results.length > currentPageResults
                ? `${currentPageResults} na stronie, ${results.length} łącznie`
                : `${results.length} ${results.length === 1 ? 'wynik' : results.length < 5 ? 'wyniki' : 'wyników'}`
              }
            </span>
          )}
        </div>
      </div>

      {/* Results list */}
      <div className="overflow-y-auto flex-1">
        {results.map((r, i) => (
          <button
            key={i}
            onClick={() => navigateTo(i)}
            className={`w-full text-left px-3 py-1.5 text-xs border-b hover:bg-blue-50 ${i === selectedIndex ? 'bg-blue-100' : ''}`}
          >
            <div className="font-medium truncate">{r.text}</div>
            <div className="text-gray-400 truncate">
              {mode === 'pdf'
                ? `str. ${r.page} — (${r.x.toFixed(0)}, ${r.y.toFixed(0)})`
                : `${r.dxfResult?.entity?.type || ''} — warstwa: ${r.dxfResult?.layer || ''}`
              }
            </div>
          </button>
        ))}
        {searched && results.length === 0 && (
          <div className="p-4 text-center text-xs text-gray-400">Brak wyników</div>
        )}
      </div>
    </div>
  );
}
