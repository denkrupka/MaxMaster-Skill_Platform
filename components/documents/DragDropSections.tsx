import React, { useState, useCallback } from 'react';
import { GripVertical, ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react';

interface Section {
  id: string;
  title: string;
  body: string;
  order: number;
}

interface DragDropSectionsProps {
  sections: Section[];
  onChange: (sections: Section[]) => void;
  readOnly?: boolean;
}

export const DragDropSections: React.FC<DragDropSectionsProps> = ({
  sections,
  onChange,
  readOnly = false,
}) => {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (readOnly) return;
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    // Required for Firefox
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (readOnly || draggedId === id) return;
    setDragOverId(id);
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (readOnly || !draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const draggedIndex = sections.findIndex(s => s.id === draggedId);
    const targetIndex = sections.findIndex(s => s.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newSections = [...sections];
    const [removed] = newSections.splice(draggedIndex, 1);
    newSections.splice(targetIndex, 0, removed);

    // Update order
    const reordered = newSections.map((s, idx) => ({ ...s, order: idx }));
    onChange(reordered);

    setDraggedId(null);
    setDragOverId(null);
  };

  const moveSection = (id: string, direction: 'up' | 'down') => {
    const index = sections.findIndex(s => s.id === id);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sections.length) return;

    const newSections = [...sections];
    [newSections[index], newSections[newIndex]] = [newSections[newIndex], newSections[index]];
    
    const reordered = newSections.map((s, idx) => ({ ...s, order: idx }));
    onChange(reordered);
  };

  const updateSection = (id: string, updates: Partial<Section>) => {
    const newSections = sections.map(s => 
      s.id === id ? { ...s, ...updates } : s
    );
    onChange(newSections);
  };

  const addSection = () => {
    const newSection: Section = {
      id: `section-${Date.now()}`,
      title: '',
      body: '',
      order: sections.length,
    };
    onChange([...sections, newSection]);
  };

  const removeSection = (id: string) => {
    if (!confirm('Czy na pewno chcesz usunąć tę sekcję?')) return;
    const filtered = sections.filter(s => s.id !== id);
    const reordered = filtered.map((s, idx) => ({ ...s, order: idx }));
    onChange(reordered);
  };

  return (
    <div className="space-y-2">
      {sections.map((section, index) => (
        <div
          key={section.id}
          draggable={!readOnly}
          onDragStart={(e) => handleDragStart(e, section.id)}
          onDragOver={(e) => handleDragOver(e, section.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, section.id)}
          className={`bg-white border rounded-lg transition-all ${
            draggedId === section.id
              ? 'opacity-50 border-blue-300'
              : dragOverId === section.id
              ? 'border-blue-500 bg-blue-50'
              : 'border-slate-200'
          }`}
        >
          <div className="flex items-start gap-2 p-3">
            {/* Drag handle */}
            {!readOnly && (
              <div className="pt-1 cursor-grab active:cursor-grabbing">
                <GripVertical className="w-4 h-4 text-slate-400" />
              </div>
            )}

            <div className="flex-1 space-y-2">
              {/* Title input */}
              <input
                type="text"
                value={section.title}
                onChange={(e) => updateSection(section.id, { title: e.target.value })}
                placeholder="Tytuł sekcji (opcjonalny)"
                disabled={readOnly}
                className="w-full text-sm font-medium border-0 border-b border-transparent focus:border-blue-300 focus:ring-0 px-0 py-1 disabled:bg-transparent"
              />

              {/* Body textarea */}
              <textarea
                value={section.body}
                onChange={(e) => updateSection(section.id, { body: e.target.value })}
                placeholder="Treść sekcji..."
                rows={3}
                disabled={readOnly}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 disabled:bg-slate-50"
              />

              {/* Placeholder hint */}
              <p className="text-xs text-slate-400">
                Użyj {'{{zmienna}}'} aby wstawić dynamiczną zawartość
              </p>
            </div>

            {/* Actions */}
            {!readOnly && (
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => moveSection(section.id, 'up')}
                  disabled={index === 0}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded disabled:opacity-30"
                  title="Przenieś w górę"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => moveSection(section.id, 'down')}
                  disabled={index === sections.length - 1}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded disabled:opacity-30"
                  title="Przenieś w dół"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  onClick={() => removeSection(section.id)}
                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                  title="Usuń sekcję"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Add section button */}
      {!readOnly && (
        <button
          onClick={addSection}
          className="w-full py-3 border-2 border-dashed border-slate-200 rounded-lg text-slate-500 hover:border-blue-300 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Dodaj sekcję
        </button>
      )}
    </div>
  );
};

export default DragDropSections;
