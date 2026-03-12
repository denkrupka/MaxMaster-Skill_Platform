import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, FileText, Clock, CheckCircle, XCircle, Edit3,
  Loader2, Trash2, Send, Brain, Eye, Filter, Tag, AlertCircle,
  FolderOpen, LayoutTemplate, Files, ChevronRight, Download,
  Archive, X, Hash, ChevronDown, FolderPlus
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAppContext } from '../../../context/AppContext';
import { DocumentTemplateEditor } from './DocumentTemplateEditor';
import { DocumentInstanceView } from './DocumentInstanceView';

interface DocumentInstance {
  id: string;
  name: string;
  status: string;
  sign_token: string;
  signer_name?: string;
  signer_email?: string;
  signed_at?: string;
  ai_analysis?: any;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Szkic', color: 'bg-slate-100 text-slate-600', icon: Edit3 },
  sent: { label: 'Wysłano', color: 'bg-blue-100 text-blue-600', icon: Clock },
  signed: { label: 'Podpisany', color: 'bg-green-100 text-green-600', icon: CheckCircle },
  rejected: { label: 'Odrzucony', color: 'bg-red-100 text-red-600', icon: XCircle },
  expired: { label: 'Wygasły', color: 'bg-amber-100 text-amber-600', icon: AlertCircle },
};

// Document categories/folders
const DOC_CATEGORIES = [
  { id: 'all', label: 'Wszystkie', icon: Files, color: 'text-slate-600' },
  { id: 'umowy', label: 'Umowy', icon: FileText, color: 'text-blue-600', keywords: ['umowa', 'umow'] },
  { id: 'protokoly', label: 'Protokoły', icon: CheckCircle, color: 'text-green-600', keywords: ['protokół', 'protokol', 'odbiór'] },
  { id: 'pelnomocnictwa', label: 'Pełnomocnictwa', icon: Eye, color: 'text-purple-600', keywords: ['pełnomocnictwo', 'pelnomocnictwo'] },
  { id: 'oswiadczenia', label: 'Oświadczenia', icon: Edit3, color: 'text-amber-600', keywords: ['oświadczenie', 'oswiadczenie'] },
];

export const DocumentsPanel: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser } = state;

  const [documents, setDocuments] = useState<DocumentInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [showTagInput, setShowTagInput] = useState<string | null>(null);
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    if (currentUser) loadDocuments();
  }, [currentUser]);

  // Realtime: refresh when document status changes (e.g. counterparty signs)
  useEffect(() => {
    if (!currentUser) return;
    const channel = supabase
      .channel('dms_doc_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'document_instances',
          filter: `company_id=eq.${currentUser.company_id}`,
        },
        (payload) => {
          // Update the changed document in state
          const updated = payload.new as DocumentInstance;
          setDocuments(prev => 
            prev.map(d => d.id === updated.id ? { ...d, ...updated } : d)
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  const loadDocuments = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('document_instances')
        .select('id, name, status, sign_token, signer_name, signer_email, signed_at, ai_analysis, tags, created_at, updated_at')
        .eq('company_id', currentUser.company_id)
        .order('updated_at', { ascending: false });

      if (data) setDocuments(data);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const doc = documents.find(d => d.id === docId);
    if (!doc || !window.confirm(`Usunąć "${doc.name}"?`)) return;
    await supabase.from('document_instances').delete().eq('id', docId);
    setDocuments(prev => prev.filter(d => d.id !== docId));
  };

  const handleAddTag = async (docId: string) => {
    if (!newTag.trim()) return;
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;
    const currentTags = doc.tags || [];
    if (currentTags.includes(newTag.trim())) { setNewTag(''); return; }
    const updatedTags = [...currentTags, newTag.trim()];
    await supabase.from('document_instances').update({ tags: updatedTags }).eq('id', docId);
    setDocuments(prev => prev.map(d => d.id === docId ? { ...d, tags: updatedTags } : d));
    setNewTag('');
    setShowTagInput(null);
  };

  const handleRemoveTag = async (docId: string, tag: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;
    const updatedTags = (doc.tags || []).filter(t => t !== tag);
    await supabase.from('document_instances').update({ tags: updatedTags }).eq('id', docId);
    setDocuments(prev => prev.map(d => d.id === docId ? { ...d, tags: updatedTags } : d));
  };

  // Get all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    documents.forEach(doc => (doc.tags || []).forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [documents]);

  // Filter logic
  const filtered = useMemo(() => {
    return documents.filter(doc => {
      const matchSearch = !search || 
        doc.name.toLowerCase().includes(search.toLowerCase()) ||
        doc.signer_name?.toLowerCase().includes(search.toLowerCase()) ||
        (doc.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()));
      
      const matchStatus = statusFilter === 'all' || doc.status === statusFilter;
      
      const matchCategory = categoryFilter === 'all' || (() => {
        const cat = DOC_CATEGORIES.find(c => c.id === categoryFilter);
        if (!cat?.keywords) return true;
        return cat.keywords.some(kw => doc.name.toLowerCase().includes(kw));
      })();

      const matchTag = !activeTag || (doc.tags || []).includes(activeTag);

      return matchSearch && matchStatus && matchCategory && matchTag;
    });
  }, [documents, search, statusFilter, categoryFilter, activeTag]);

  const stats = {
    total: documents.length,
    draft: documents.filter(d => d.status === 'draft').length,
    sent: documents.filter(d => d.status === 'sent').length,
    signed: documents.filter(d => d.status === 'signed').length,
  };

  // Download selected as ZIP (simulated - downloads each file's HTML)
  const handleDownloadZip = async () => {
    const toDownload = selectedDocs.size > 0 
      ? documents.filter(d => selectedDocs.has(d.id))
      : filtered;
    
    if (toDownload.length === 0) return;
    setDownloadingZip(true);
    
    try {
      // Fetch full content for each document
      const { data: fullDocs } = await supabase
        .from('document_instances')
        .select('id, name, content, status, signer_name, signed_at')
        .in('id', toDownload.map(d => d.id));

      if (!fullDocs) return;

      // Create a simple combined HTML file for download
      const combinedHtml = `<!DOCTYPE html>
<html lang="pl">
<head><meta charset="utf-8"><title>Dokumenty - MaxMaster</title>
<style>
  body { font-family: Arial, sans-serif; }
  .doc-separator { page-break-after: always; border-bottom: 3px solid #333; margin: 40px 0; padding-bottom: 20px; }
  .doc-header { background: #f0f4ff; padding: 16px; margin-bottom: 24px; border-radius: 8px; }
</style>
</head>
<body>
${fullDocs.map((doc, i) => `
  <div class="doc-separator">
    <div class="doc-header">
      <h2 style="margin:0">${doc.name}</h2>
      <p style="margin:4px 0 0;color:#666">Status: ${STATUS_CONFIG[doc.status]?.label || doc.status} | ${doc.signer_name ? 'Podpisujący: ' + doc.signer_name : ''} | ${new Date().toLocaleDateString('pl-PL')}</p>
    </div>
    ${doc.content}
  </div>
`).join('')}
</body>
</html>`;

      const blob = new Blob([combinedHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dokumenty_${new Date().toISOString().split('T')[0]}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingZip(false);
      setSelectedDocs(new Set());
    }
  };

  const toggleDocSelection = (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDocs(prev => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  if (selectedDocId) {
    return (
      <DocumentInstanceView
        documentId={selectedDocId}
        onBack={() => { setSelectedDocId(null); loadDocuments(); }}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            Dokumenty elektroniczne
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Szablony, podpisywanie, historia wersji, analiza AI</p>
        </div>
        <div className="flex items-center gap-2">
          {(selectedDocs.size > 0 || filtered.length > 0) && (
            <button
              onClick={handleDownloadZip}
              disabled={downloadingZip}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-sm text-slate-600 disabled:opacity-50"
              title={selectedDocs.size > 0 ? `Pobierz ${selectedDocs.size} wybranych` : 'Pobierz wszystkie widoczne'}
            >
              {downloadingZip ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {selectedDocs.size > 0 ? `Pobierz (${selectedDocs.size})` : 'Pobierz widoczne'}
            </button>
          )}
          <button
            onClick={() => setShowTemplateEditor(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            Nowy dokument
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Wszystkie', value: stats.total, color: 'text-slate-700', bg: 'bg-slate-50', filter: 'all' },
          { label: 'Szkice', value: stats.draft, color: 'text-slate-600', bg: 'bg-slate-100', filter: 'draft' },
          { label: 'Wysłane', value: stats.sent, color: 'text-blue-600', bg: 'bg-blue-50', filter: 'sent' },
          { label: 'Podpisane', value: stats.signed, color: 'text-green-600', bg: 'bg-green-50', filter: 'signed' },
        ].map(s => (
          <button
            key={s.filter}
            onClick={() => setStatusFilter(s.filter)}
            className={`p-4 rounded-xl border-2 text-left transition
              ${statusFilter === s.filter ? 'border-blue-400 shadow-md' : 'border-transparent'} ${s.bg}`}
          >
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-sm text-slate-500 mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Category folders */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {DOC_CATEGORIES.map(cat => {
          const CatIcon = cat.icon;
          const count = cat.id === 'all' ? documents.length : documents.filter(d => {
            return cat.keywords?.some(kw => d.name.toLowerCase().includes(kw));
          }).length;
          return (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition
                ${categoryFilter === cat.id ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300'}`}
            >
              <CatIcon className={`w-4 h-4 ${categoryFilter === cat.id ? 'text-white' : cat.color}`} />
              {cat.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${categoryFilter === cat.id ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tags filter */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Hash className="w-4 h-4 text-slate-400 flex-shrink-0" />
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition
                ${activeTag === tag ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}`}
            >
              #{tag}
              {activeTag === tag && <X className="w-3 h-3" />}
            </button>
          ))}
          {activeTag && (
            <button onClick={() => setActiveTag(null)} className="text-xs text-slate-400 hover:text-slate-600">
              wyczyść
            </button>
          )}
        </div>
      )}

      {/* Search & filter */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Szukaj dokumentów, tagów, podpisującego..."
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-600"
        >
          <option value="all">Wszystkie statusy</option>
          <option value="draft">Szkice</option>
          <option value="sent">Wysłane</option>
          <option value="signed">Podpisane</option>
          <option value="rejected">Odrzucone</option>
        </select>
      </div>

      {/* Documents list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Brak dokumentów</h3>
          <p className="text-slate-400 text-sm mb-6">
            {search || statusFilter !== 'all' || categoryFilter !== 'all' || activeTag 
              ? 'Brak wyników dla podanych filtrów' 
              : 'Utwórz pierwszy dokument z szablonu'}
          </p>
          {!search && statusFilter === 'all' && categoryFilter === 'all' && !activeTag && (
            <button
              onClick={() => setShowTemplateEditor(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 mx-auto text-sm"
            >
              <LayoutTemplate className="w-4 h-4" />
              Wybierz szablon
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(doc => {
            const sc = STATUS_CONFIG[doc.status] || STATUS_CONFIG.draft;
            const StatusIcon = sc.icon;
            const isSelected = selectedDocs.has(doc.id);
            return (
              <div
                key={doc.id}
                onClick={() => setSelectedDocId(doc.id)}
                className={`bg-white rounded-xl border hover:shadow-md transition p-4 cursor-pointer group flex items-center gap-4
                  ${isSelected ? 'border-blue-400 bg-blue-50/30' : 'border-slate-200 hover:border-blue-300'}`}
              >
                {/* Checkbox */}
                <div
                  onClick={e => toggleDocSelection(doc.id, e)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition
                    ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-slate-300 bg-white hover:border-blue-400'}`}
                >
                  {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                </div>

                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900 truncate">{doc.name}</p>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {sc.label}
                    </span>
                    {doc.ai_analysis && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-600">
                        <Brain className="w-3 h-3" />
                        AI {doc.ai_analysis.score}/10
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400 mt-0.5">
                    {doc.signer_name ? `Podpisujący: ${doc.signer_name}` : 'Bez podpisującego'}
                    {doc.signed_at && ` · Podpisano: ${new Date(doc.signed_at).toLocaleDateString('pl-PL')}`}
                    {' · '}
                    {new Date(doc.updated_at).toLocaleDateString('pl-PL')}
                  </p>
                  {/* Tags */}
                  {(doc.tags || []).length > 0 && (
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {(doc.tags || []).map(tag => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500"
                        >
                          #{tag}
                          <button
                            onClick={e => handleRemoveTag(doc.id, tag, e)}
                            className="hover:text-red-500 ml-0.5"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                      {showTagInput === doc.id ? (
                        <span onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1">
                          <input
                            autoFocus
                            type="text"
                            value={newTag}
                            onChange={e => setNewTag(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleAddTag(doc.id);
                              if (e.key === 'Escape') { setShowTagInput(null); setNewTag(''); }
                            }}
                            className="w-20 px-1.5 py-0.5 text-xs border border-purple-300 rounded"
                            placeholder="tag..."
                          />
                          <button
                            onClick={e => { e.stopPropagation(); handleAddTag(doc.id); }}
                            className="text-xs text-purple-600 hover:text-purple-800"
                          >
                            +
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={e => { e.stopPropagation(); setShowTagInput(doc.id); setNewTag(''); }}
                          className="text-xs text-slate-400 hover:text-purple-600 px-1.5 py-0.5 rounded hover:bg-purple-50"
                        >
                          + tag
                        </button>
                      )}
                    </div>
                  )}
                  {(doc.tags || []).length === 0 && (
                    <button
                      onClick={e => { e.stopPropagation(); setShowTagInput(doc.id); setNewTag(''); }}
                      className="text-xs text-slate-400 hover:text-purple-600 mt-1 flex items-center gap-1"
                    >
                      <Hash className="w-3 h-3" />
                      Dodaj tag
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100">
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                  <button
                    onClick={(e) => handleDelete(doc.id, e)}
                    className="p-1.5 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bulk selection info */}
      {selectedDocs.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl z-40">
          <span className="text-sm font-medium">Wybrano: {selectedDocs.size} dokumentów</span>
          <button
            onClick={handleDownloadZip}
            disabled={downloadingZip}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 rounded-xl text-sm hover:bg-blue-400 disabled:opacity-50"
          >
            {downloadingZip ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Pobierz
          </button>
          <button
            onClick={() => setSelectedDocs(new Set())}
            className="p-1.5 hover:bg-slate-700 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Template editor modal */}
      {showTemplateEditor && (
        <DocumentTemplateEditor
          onClose={() => setShowTemplateEditor(false)}
          onCreated={(id) => {
            setShowTemplateEditor(false);
            loadDocuments();
            setSelectedDocId(id);
          }}
        />
      )}
    </div>
  );
};
