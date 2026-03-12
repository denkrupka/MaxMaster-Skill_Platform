import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, FolderKanban, CheckSquare, Users, FileText, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAppContext } from '../context/AppContext';

interface SearchResult {
  id: string;
  type: 'project' | 'task' | 'employee' | 'document';
  title: string;
  subtitle?: string;
  url: string;
}

const TYPE_CONFIG = {
  project: { icon: FolderKanban, label: 'Projekt', color: 'text-blue-600 bg-blue-50' },
  task: { icon: CheckSquare, label: 'Zadanie', color: 'text-green-600 bg-green-50' },
  employee: { icon: Users, label: 'Pracownik', color: 'text-purple-600 bg-purple-50' },
  document: { icon: FileText, label: 'Dokument', color: 'text-amber-600 bg-amber-50' },
};

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { state } = useAppContext();
  const { currentUser } = state;

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const search = useCallback(async (q: string) => {
    if (!q.trim() || !currentUser) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const ilike = `%${q}%`;
      const companyId = currentUser.company_id;

      const [projectsRes, tasksRes, employeesRes, docsRes] = await Promise.all([
        supabase.from('projects')
          .select('id, name, status')
          .eq('company_id', companyId)
          .ilike('name', ilike)
          .limit(5),
        supabase.from('tasks')
          .select('id, title, status, project_id')
          .eq('company_id', companyId)
          .ilike('title', ilike)
          .limit(5),
        supabase.from('users')
          .select('id, first_name, last_name, role, position')
          .eq('company_id', companyId)
          .or(`first_name.ilike.${ilike},last_name.ilike.${ilike}`)
          .limit(5),
        supabase.from('documents')
          .select('id, name, document_type')
          .eq('company_id', companyId)
          .ilike('name', ilike)
          .limit(5),
      ]);

      const all: SearchResult[] = [];

      (projectsRes.data || []).forEach(p => all.push({
        id: p.id, type: 'project',
        title: p.name,
        subtitle: p.status,
        url: '/construction/projects',
      }));

      (tasksRes.data || []).forEach(t => all.push({
        id: t.id, type: 'task',
        title: t.title,
        subtitle: t.status,
        url: '/construction/tasks',
      }));

      (employeesRes.data || []).forEach(e => all.push({
        id: e.id, type: 'employee',
        title: `${e.first_name} ${e.last_name}`,
        subtitle: e.position || e.role,
        url: '/hr/employees',
      }));

      (docsRes.data || []).forEach((d: any) => all.push({
        id: d.id, type: 'document',
        title: d.name,
        subtitle: d.document_type,
        url: '/construction/dms',
      }));

      setResults(all);
      setSelectedIndex(0);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    const timeout = setTimeout(() => search(query), 300);
    return () => clearTimeout(timeout);
  }, [query, search]);

  const handleSelect = (result: SearchResult) => {
    navigate(result.url);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[9999] flex items-start justify-center pt-20 px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
          <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Szukaj projektów, zadań, pracowników..."
            className="flex-1 outline-none text-slate-900 placeholder:text-slate-400 text-base"
          />
          {loading && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {query && results.length === 0 && !loading && (
            <div className="py-10 text-center text-slate-400 text-sm">
              Brak wyników dla &quot;{query}&quot;
            </div>
          )}
          {!query && (
            <div className="py-8 text-center text-slate-400 text-sm">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Wpisz frazę, aby wyszukać<br />
              <kbd className="mt-2 inline-block px-2 py-0.5 bg-slate-100 rounded text-xs font-mono text-slate-500">Ctrl+K</kbd>
              {' '}aby otworzyć / zamknąć
            </div>
          )}
          {results.map((result, index) => {
            const config = TYPE_CONFIG[result.type];
            const Icon = config.icon;
            const isSelected = index === selectedIndex;
            return (
              <button
                key={result.id}
                onClick={() => handleSelect(result)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${config.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">{result.title}</p>
                  {result.subtitle && (
                    <p className="text-xs text-slate-500 truncate">{result.subtitle}</p>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.color}`}>
                  {config.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-100 bg-slate-50 text-xs text-slate-400">
          <span><kbd className="font-mono bg-white border border-slate-200 rounded px-1">↑↓</kbd> nawigacja</span>
          <span><kbd className="font-mono bg-white border border-slate-200 rounded px-1">↵</kbd> otwórz</span>
          <span><kbd className="font-mono bg-white border border-slate-200 rounded px-1">Esc</kbd> zamknij</span>
        </div>
      </div>
    </div>
  );
};

export default GlobalSearch;
