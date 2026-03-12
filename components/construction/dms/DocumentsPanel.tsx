import React, { useState, useEffect } from 'react';
import {
  Plus, Search, FileText, Clock, CheckCircle, XCircle, Edit3,
  Loader2, Trash2, Send, Brain, Eye, Filter, Tag, AlertCircle,
  FolderOpen, LayoutTemplate, Files, ChevronRight
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

export const DocumentsPanel: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser } = state;

  const [documents, setDocuments] = useState<DocumentInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) loadDocuments();
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

  const filtered = documents.filter(doc => {
    const matchSearch = doc.name.toLowerCase().includes(search.toLowerCase()) ||
      doc.signer_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || doc.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: documents.length,
    draft: documents.filter(d => d.status === 'draft').length,
    sent: documents.filter(d => d.status === 'sent').length,
    signed: documents.filter(d => d.status === 'signed').length,
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
        <button
          onClick={() => setShowTemplateEditor(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          Nowy dokument
        </button>
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

      {/* Search & filter */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Szukaj dokumentów..."
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
            {search || statusFilter !== 'all' ? 'Brak wyników dla podanych filtrów' : 'Utwórz pierwszy dokument z szablonu'}
          </p>
          {!search && statusFilter === 'all' && (
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
            return (
              <div
                key={doc.id}
                onClick={() => setSelectedDocId(doc.id)}
                className="bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition p-4 cursor-pointer group flex items-center gap-4"
              >
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
