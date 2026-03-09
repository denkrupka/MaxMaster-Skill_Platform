import React, { useState, useEffect, useRef } from 'react';
import {
  MousePointer, Hand, Ruler, Square, Hash, Type, MessageSquare,
  Camera, Scissors, PenTool, Pencil, Circle, ArrowUpRight, Minus,
  CloudLightning, MessageCircleWarning, Link2, Sparkles, Eraser,
  ChevronDown, X, Settings2
} from 'lucide-react';
import type { BottomTool } from './WorkspaceTypes';

interface ViewerBottomToolbarProps {
  activeTool: BottomTool;
  onSetTool: (tool: BottomTool) => void;
  // Annotation styling
  strokeColor: string;
  strokeWidth: number;
  onColorChange: (color: string) => void;
  onWidthChange: (width: number) => void;
  // Count display
  countValue?: number;
  countLabel?: string;
  onClearCount?: () => void;
  // Highlight info
  highlightLabel?: string;
  highlightCount?: number;
  onClearHighlight?: () => void;
  // Scale
  hasScale?: boolean;
  onCalibrateScale?: () => void;
  onOpenScaleSettings?: () => void;
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#000000', '#ffffff'];
const WIDTHS = [1, 2, 4, 6, 10];

export const ViewerBottomToolbar: React.FC<ViewerBottomToolbarProps> = ({
  activeTool, onSetTool, strokeColor, strokeWidth, onColorChange, onWidthChange,
  countValue, countLabel, onClearCount, highlightLabel, highlightCount, onClearHighlight,
  hasScale, onCalibrateScale, onOpenScaleSettings,
}) => {
  type MenuName = 'pen' | 'shape' | 'measure' | 'color' | null;
  const [openMenu, setOpenMenu] = useState<MenuName>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking anywhere outside the toolbar
  useEffect(() => {
    if (!openMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenu]);

  const ToolBtn: React.FC<{
    tool: BottomTool;
    icon: React.ReactNode;
    title: string;
    shortcut?: string;
    active?: boolean;
    className?: string;
  }> = ({ tool, icon, title, shortcut, active, className }) => (
    <button
      onClick={() => { setOpenMenu(null); onSetTool(tool); }}
      className={`p-1.5 rounded-lg transition ${
        (active ?? activeTool === tool)
          ? 'bg-blue-100 text-blue-700 shadow-inner'
          : `hover:bg-slate-100 text-slate-600 ${className || ''}`
      }`}
      title={`${title}${shortcut ? ` (${shortcut})` : ''}`}
    >
      {icon}
    </button>
  );

  const Separator = () => <div className="w-px h-5 bg-slate-200 mx-0.5" />;
  const iconSize = "w-4 h-4";

  return (
    <div ref={toolbarRef} className="px-2 py-1 border-t border-slate-200 bg-white flex items-center gap-0.5 flex-shrink-0 relative" onClick={e => e.stopPropagation()}>
      {/* Select & Pan */}
      <ToolBtn tool="select" icon={<MousePointer className={iconSize} />} title="Zaznacz" shortcut="V" />
      <ToolBtn tool="pan" icon={<Hand className={iconSize} />} title="Raczka — przesun" shortcut="G" />

      <Separator />

      {/* Pen/Highlighter dropdown */}
      <div className="relative">
        <button
          onClick={e => { e.stopPropagation(); setOpenMenu(openMenu === 'pen' ? null : 'pen'); }}
          className={`p-1.5 rounded-lg flex items-center gap-0.5 transition ${
            ['pen', 'highlighter'].includes(activeTool) ? 'bg-blue-100 text-blue-700 shadow-inner' : 'hover:bg-slate-100 text-slate-600'
          }`}
          title="Rysowanie"
        >
          <PenTool className={iconSize} /><ChevronDown className="w-2.5 h-2.5 opacity-50" />
        </button>
        {openMenu === 'pen' && (
          <div className="absolute left-0 bottom-full mb-1 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1" onClick={e => e.stopPropagation()}>
            <button className={`w-full flex items-center gap-3 px-3 py-2 text-sm ${activeTool === 'pen' ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}
              onClick={() => { onSetTool('pen'); setOpenMenu(null); }}>
              <PenTool className="w-4 h-4" /> Pioro <span className="ml-auto text-[10px] text-slate-400 font-mono">P</span>
            </button>
            <button className={`w-full flex items-center gap-3 px-3 py-2 text-sm ${activeTool === 'highlighter' ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}
              onClick={() => { onSetTool('highlighter'); setOpenMenu(null); }}>
              <Pencil className="w-4 h-4" /> Zakreslacz <span className="ml-auto text-[10px] text-slate-400 font-mono">H</span>
            </button>
          </div>
        )}
      </div>

      {/* Shape dropdown */}
      <div className="relative">
        <button
          onClick={e => { e.stopPropagation(); setOpenMenu(openMenu === 'shape' ? null : 'shape'); }}
          className={`p-1.5 rounded-lg flex items-center gap-0.5 transition ${
            ['rectangle', 'ellipse', 'arrow', 'line'].includes(activeTool) ? 'bg-blue-100 text-blue-700 shadow-inner' : 'hover:bg-slate-100 text-slate-600'
          }`}
          title="Ksztalty"
        >
          <Square className={iconSize} /><ChevronDown className="w-2.5 h-2.5 opacity-50" />
        </button>
        {openMenu === 'shape' && (
          <div className="absolute left-0 bottom-full mb-1 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1" onClick={e => e.stopPropagation()}>
            {([
              { tool: 'rectangle' as BottomTool, label: 'Prostokat', icon: Square, key: 'R' },
              { tool: 'ellipse' as BottomTool, label: 'Elipsa', icon: Circle, key: 'O' },
              { tool: 'arrow' as BottomTool, label: 'Strzalka', icon: ArrowUpRight, key: 'A' },
              { tool: 'line' as BottomTool, label: 'Linia', icon: Minus, key: 'L' },
            ]).map(item => (
              <button key={item.tool}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm ${activeTool === item.tool ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}
                onClick={() => { onSetTool(item.tool); setOpenMenu(null); }}>
                <item.icon className="w-4 h-4" /> {item.label} <span className="ml-auto text-[10px] text-slate-400 font-mono">{item.key}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Text, Cloud, Callout */}
      <ToolBtn tool="text-annotation" icon={<Type className={iconSize} />} title="Tekst" shortcut="T" />
      <ToolBtn tool="issue-cloud" icon={<CloudLightning className={iconSize} />} title="Chmura rewizyjna" shortcut="K" />
      <ToolBtn tool="callout" icon={<MessageCircleWarning className={iconSize} />} title="Odnosnik z tekstem" shortcut="B" />

      <Separator />

      {/* Measure dropdown */}
      <div className="relative">
        <button
          onClick={e => { e.stopPropagation(); setOpenMenu(openMenu === 'measure' ? null : 'measure'); }}
          className={`p-1.5 rounded-lg flex items-center gap-0.5 transition ${
            ['measure-length', 'measure-area', 'measure-polyline'].includes(activeTool) ? 'bg-blue-100 text-blue-700 shadow-inner' : 'hover:bg-slate-100 text-slate-600'
          }`}
          title={hasScale ? 'Pomiar' : 'Pomiar — skalibruj skale'}
        >
          <Ruler className={iconSize} /><ChevronDown className="w-2.5 h-2.5 opacity-50" />
        </button>
        {openMenu === 'measure' && (
          <div className="absolute left-0 bottom-full mb-1 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1" onClick={e => e.stopPropagation()}>
            <button className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm ${activeTool === 'measure-length' ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}
              onClick={() => { onSetTool('measure-length'); setOpenMenu(null); }}>
              <Ruler className="w-4 h-4" /> Polilinia
            </button>
            <button className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm ${activeTool === 'measure-area' ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}
              onClick={() => { onSetTool('measure-area'); setOpenMenu(null); }}>
              <Square className="w-4 h-4" /> Powierzchnia
            </button>
            <div className="border-t border-slate-100 my-1" />
            <button onClick={() => { onOpenScaleSettings?.(); setOpenMenu(null); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
              <Settings2 className="w-4 h-4" /> Ustawienia skali
              {hasScale && <span className="ml-auto text-[9px] text-green-600 font-medium">OK</span>}
              {!hasScale && <span className="ml-auto text-[9px] text-amber-500 font-medium">brak</span>}
            </button>
          </div>
        )}
      </div>

      {/* Count */}
      <ToolBtn tool="count-marker" icon={<Hash className={iconSize} />} title="Licznik elementow" shortcut="N" />
      {(countValue !== undefined && countValue > 0) && (
        <div className="flex items-center gap-0.5 ml-0.5">
          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full truncate max-w-[140px]" title={countLabel}>
            {countLabel ? `${countLabel}: ` : ''}{countValue}
          </span>
          <button onClick={onClearCount} className="p-0.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500" title="Wyczysc licznik">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {highlightLabel && highlightCount !== undefined && highlightCount > 0 && (
        <div className="flex items-center gap-0.5 ml-0.5">
          <span className="text-[10px] font-bold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded-full truncate max-w-[160px]" title={highlightLabel}>
            {highlightLabel}: {highlightCount}
          </span>
          <button onClick={onClearHighlight} className="p-0.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <Separator />

      {/* BOQ link & AI */}
      <ToolBtn tool="link-boq" icon={<Link2 className={iconSize} />} title="Polacz z pozycja BOQ" />
      <ToolBtn tool="ai-classify-selection" icon={<Sparkles className={iconSize} />} title="Klasyfikuj zaznaczenie AI" />

      <Separator />

      {/* Comment, Camera, Eraser, Snapshot */}
      <ToolBtn tool="comment" icon={<MessageSquare className={iconSize} />} title="Komentarz" shortcut="C" />
      <ToolBtn tool="camera" icon={<Camera className={iconSize} />} title="Zdjecie" />
      <ToolBtn tool="erase" icon={<Eraser className={iconSize} />} title="Gumka" shortcut="E" />
      <ToolBtn tool="snapshot" icon={<Scissors className={iconSize} />} title="Zrzut ekranu" />

      <div className="flex-1" />

      {/* Color picker */}
      <div className="relative">
        <button
          onClick={() => setOpenMenu(openMenu === 'color' ? null : 'color')}
          className="p-1 hover:bg-slate-100 rounded-lg flex items-center gap-1"
          title="Kolor i grubosc"
        >
          <div className="w-4 h-4 rounded-full border-2 border-slate-300" style={{ backgroundColor: strokeColor }} />
          <span className="text-[9px] text-slate-500">{strokeWidth}px</span>
        </button>
        {openMenu === 'color' && (
          <div className="absolute right-0 bottom-full mb-1 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-3" onClick={e => e.stopPropagation()}>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {COLORS.map(c => (
                <button key={c}
                  onClick={() => onColorChange(c)}
                  className={`w-6 h-6 rounded-full border-2 ${strokeColor === c ? 'border-blue-500 scale-110' : 'border-slate-200'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
            <div className="flex gap-1">
              {WIDTHS.map(w => (
                <button key={w}
                  onClick={() => onWidthChange(w)}
                  className={`flex-1 py-1 text-[10px] rounded ${strokeWidth === w ? 'bg-blue-100 text-blue-700 font-bold' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                  {w}px
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewerBottomToolbar;
