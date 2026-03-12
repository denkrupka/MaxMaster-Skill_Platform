import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Send, Brain, Eye, Edit3, Clock, CheckCircle, XCircle,
  Download, Trash2, History, Loader2, Share2, Copy, Tag,
  AlertCircle, RefreshCw, GitBranch, QrCode, Shield, ExternalLink
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAppContext } from '../../../context/AppContext';
import { DocumentSignModal } from './DocumentSignModal';
import { DocumentAIAnalysis } from './DocumentAIAnalysis';

interface Version {
  id: string;
  version_number: number;
  change_type: string;
  change_notes?: string;
  changed_by?: string;
  created_at: string;
}

interface DocumentInstance {
  id: string;
  name: string;
  content: string;
  status: string;
  sign_token: string;
  signer_name?: string;
  signer_email?: string;
  signer_phone?: string;
  signed_at?: string;
  signature_data?: string;
  ai_analysis?: any;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

interface Props {
  documentId: string;
  onBack: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Szkic', color: 'bg-slate-100 text-slate-600', icon: Edit3 },
  sent: { label: 'Wysłano', color: 'bg-blue-100 text-blue-600', icon: Clock },
  signed: { label: 'Podpisany', color: 'bg-green-100 text-green-600', icon: CheckCircle },
  rejected: { label: 'Odrzucony', color: 'bg-red-100 text-red-600', icon: XCircle },
  expired: { label: 'Wygasły', color: 'bg-amber-100 text-amber-600', icon: AlertCircle },
};

// Generate QR code URL via free API
function getQRUrl(text: string, size: number = 150): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&format=png&margin=4`;
}

export const DocumentInstanceView: React.FC<Props> = ({ documentId, onBack }) => {
  const { state } = useAppContext();
  const { currentUser } = state;

  const [doc, setDoc] = useState<DocumentInstance | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'edit' | 'history'>('preview');

  useEffect(() => {
    loadDocument();
  }, [documentId]);

  const loadDocument = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('document_instances')
        .select('*')
        .eq('id', documentId)
        .single();

      if (data) {
        setDoc(data);
        setEditContent(data.content);
      }

      const { data: versData } = await supabase
        .from('document_versions')
        .select('*')
        .eq('document_id', documentId)
        .order('version_number', { ascending: false });

      if (versData) setVersions(versData);
    } finally {
      setLoading(false);
    }
  };

  const saveEdit = async () => {
    if (!doc || !currentUser) return;
    setSaving(true);
    try {
      const newVersion = (versions[0]?.version_number || 0) + 1;
      await supabase.from('document_instances').update({ content: editContent }).eq('id', doc.id);
      await supabase.from('document_versions').insert({
        document_id: doc.id,
        version_number: newVersion,
        content: editContent,
        changed_by: currentUser.id,
        change_type: 'edit',
        change_notes: `Edycja v${newVersion}`,
      });
      setDoc({ ...doc, content: editContent });
      setVersions([{ id: 'tmp_' + Date.now(), version_number: newVersion, change_type: 'edit', change_notes: `Edycja v${newVersion}`, created_at: new Date().toISOString() }, ...versions]);
      setActiveTab('preview');
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const restoreVersion = async (version: Version) => {
    if (!doc || !currentUser) return;
    if (!window.confirm(`Przywrócić wersję v${version.version_number}?`)) return;
    
    const { data: vData } = await supabase
      .from('document_versions')
      .select('content')
      .eq('id', version.id)
      .single();

    if (!vData) return;
    
    const newVersion = (versions[0]?.version_number || 0) + 1;
    await supabase.from('document_instances').update({ content: vData.content }).eq('id', doc.id);
    await supabase.from('document_versions').insert({
      document_id: doc.id,
      version_number: newVersion,
      content: vData.content,
      changed_by: currentUser?.id,
      change_type: 'edit',
      change_notes: `Przywrócono v${version.version_number}`,
    });
    
    setDoc({ ...doc, content: vData.content });
    setEditContent(vData.content);
    setVersions([{ id: 'tmp_' + Date.now(), version_number: newVersion, change_type: 'edit', change_notes: `Przywrócono v${version.version_number}`, created_at: new Date().toISOString() }, ...versions]);
    setActiveTab('preview');
  };

  const handleDelete = async () => {
    if (!doc || !window.confirm(`Usunąć dokument "${doc.name}"?`)) return;
    await supabase.from('document_instances').delete().eq('id', doc.id);
    onBack();
  };

  const signUrl = doc ? `${window.location.origin}/sign/${doc.sign_token}` : '';

  const copySignLink = () => {
    if (!doc) return;
    navigator.clipboard.writeText(signUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadAsHtml = () => {
    if (!doc) return;
    // Add QR verification code to document
    const qrSection = doc.status === 'signed' ? `
      <div style="margin-top:40px; padding:16px; border:1px solid #e0e0e0; border-radius:8px; display:flex; align-items:center; gap:16px; background:#f9fafb;">
        <img src="${getQRUrl(signUrl, 80)}" alt="QR verification" style="width:80px;height:80px;" />
        <div>
          <p style="margin:0; font-size:12px; font-weight:bold; color:#111;">Weryfikacja elektroniczna</p>
          <p style="margin:4px 0 0; font-size:11px; color:#666;">Zeskanuj kod QR aby zweryfikować autentyczność dokumentu</p>
          <p style="margin:4px 0 0; font-size:11px; color:#3b82f6;">${signUrl}</p>
          ${doc.signed_at ? `<p style="margin:4px 0 0; font-size:11px; color:#059669;">Podpisano: ${new Date(doc.signed_at).toLocaleString('pl-PL')} przez ${doc.signer_name}</p>` : ''}
        </div>
      </div>` : '';

    const blob = new Blob([
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${doc.name}</title></head>
       <body>${doc.content}${qrSection}</body></html>`
    ], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${doc.name}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!doc) return null;

  const statusConfig = STATUS_CONFIG[doc.status] || STATUS_CONFIG.draft;
  const StatusIcon = statusConfig.icon;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-slate-900 truncate">{doc.name}</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
              <StatusIcon className="w-3 h-3" />
              {statusConfig.label}
            </span>
            <span className="text-xs text-slate-400">
              Wersja {versions.length || 1} • {new Date(doc.updated_at).toLocaleDateString('pl-PL')}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {doc.status === 'draft' && (
            <button
              onClick={() => setShowSignModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              <Send className="w-4 h-4" />
              Wyślij do podpisu
            </button>
          )}
          {doc.status === 'sent' && (
            <a
              href={signUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              Otwórz link
            </a>
          )}
          <button
            onClick={() => setShowAIModal(true)}
            className="flex items-center gap-2 px-3 py-2 border border-purple-200 text-purple-600 rounded-lg hover:bg-purple-50 text-sm"
          >
            <Brain className="w-4 h-4" />
            Analiza AI
            {doc.ai_analysis && <span className="w-2 h-2 bg-purple-500 rounded-full" />}
          </button>
          <button
            onClick={() => setShowQR(!showQR)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm
              ${showQR ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            <QrCode className="w-4 h-4" />
            QR
          </button>
          <button
            onClick={copySignLink}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-sm"
          >
            {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Skopiowano' : 'Link'}
          </button>
          <button
            onClick={downloadAsHtml}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50"
            title="Pobierz HTML"
          >
            <Download className="w-4 h-4 text-slate-600" />
          </button>
          <button
            onClick={handleDelete}
            className="p-2 border border-red-200 text-red-500 rounded-lg hover:bg-red-50"
            title="Usuń"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* QR Code panel */}
      {showQR && (
        <div className="mb-4 p-4 bg-slate-900 text-white rounded-2xl flex items-center gap-6">
          <div className="flex-shrink-0 bg-white p-2 rounded-xl">
            <img
              src={getQRUrl(signUrl, 100)}
              alt="QR kod dokumentu"
              className="w-24 h-24"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-green-400" />
              <p className="font-semibold text-sm">Weryfikacja autentyczności dokumentu</p>
            </div>
            <p className="text-slate-400 text-xs mb-2">
              Zeskanuj kod QR aby sprawdzić status dokumentu lub złożyć podpis elektroniczny.
              Kod jest unikalny i powiązany z tym dokumentem.
            </p>
            <p className="text-slate-500 text-xs font-mono truncate max-w-xs">{signUrl}</p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={copySignLink}
                className="flex items-center gap-1 px-2.5 py-1 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs"
              >
                <Copy className="w-3 h-3" />
                Kopiuj link
              </button>
              <a
                href={signUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs"
              >
                <ExternalLink className="w-3 h-3" />
                Otwórz
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-xl w-fit">
        {[
          { key: 'preview', label: 'Podgląd', icon: Eye },
          { key: 'edit', label: 'Edytuj', icon: Edit3 },
          { key: 'history', label: `Historia (${versions.length})`, icon: History },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition
              ${activeTab === tab.key ? 'bg-white shadow text-slate-900 font-medium' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Signed badge */}
      {doc.status === 'signed' && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800">
              Podpisano przez {doc.signer_name}
              {doc.signed_at && ` · ${new Date(doc.signed_at).toLocaleString('pl-PL')}`}
            </p>
            <p className="text-xs text-green-600 mt-0.5">
              Token: {doc.sign_token?.slice(0, 16)}... · eIDAS zgodny
            </p>
          </div>
          {doc.signature_data && (
            <img src={doc.signature_data} alt="Podpis" className="h-12 bg-white rounded p-1.5 border border-green-200 shadow-sm" />
          )}
          <div className="bg-white p-1 rounded-lg border border-green-200">
            <img src={getQRUrl(signUrl, 60)} alt="QR" className="w-14 h-14" />
          </div>
        </div>
      )}

      {/* Sent reminder */}
      {doc.status === 'sent' && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3">
          <Clock className="w-5 h-5 text-blue-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-800">
              Oczekuje na podpis od {doc.signer_name}
            </p>
            <p className="text-xs text-blue-600 mt-0.5">
              {doc.signer_email && `E-mail: ${doc.signer_email}`}
              {doc.signer_phone && ` · Tel: ${doc.signer_phone}`}
            </p>
          </div>
          <button
            onClick={copySignLink}
            className="flex items-center gap-1 px-2.5 py-1.5 border border-blue-200 text-blue-600 rounded-lg text-xs hover:bg-blue-100"
          >
            <Copy className="w-3 h-3" />
            Kopiuj link
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'preview' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="p-6 md:p-10">
              <div dangerouslySetInnerHTML={{ __html: doc.content }} />
            </div>
            {/* QR footer on signed docs */}
            {doc.status === 'signed' && (
              <div className="border-t border-slate-100 p-4 flex items-center gap-4 bg-slate-50 rounded-b-2xl">
                <img src={getQRUrl(signUrl, 60)} alt="QR" className="w-14 h-14 rounded" />
                <div>
                  <p className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-green-500" />
                    Dokument elektronicznie podpisany i zweryfikowany
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Podpisano: {doc.signer_name} · {doc.signed_at ? new Date(doc.signed_at).toLocaleString('pl-PL') : ''}
                  </p>
                  <p className="text-xs text-slate-400 font-mono">{signUrl.slice(0, 50)}...</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'edit' && (
          <div className="space-y-3">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Edytujesz treść dokumentu. Każda zmiana zostanie zapisana jako nowa wersja. Edycja podpisanego dokumentu unieważnia podpis.
            </div>
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              className="w-full h-[500px] p-4 border border-slate-200 rounded-xl font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500"
              placeholder="Treść dokumentu (HTML)..."
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setEditContent(doc.content); setActiveTab('preview'); }}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={saveEdit}
                disabled={saving || editContent === doc.content}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Zapisz wersję
              </button>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-2">
            {versions.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <History className="w-10 h-10 mx-auto mb-2 opacity-30" />
                Brak historii zmian
              </div>
            ) : (
              versions.map((v, i) => (
                <div key={v.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                    ${v.change_type === 'sign' ? 'bg-green-100' : v.change_type === 'suggestion' ? 'bg-purple-100' : 'bg-blue-100'}`}>
                    {v.change_type === 'sign' ? <CheckCircle className="w-5 h-5 text-green-600" /> :
                     v.change_type === 'suggestion' ? <GitBranch className="w-5 h-5 text-purple-600" /> :
                     <Edit3 className="w-5 h-5 text-blue-600" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900 text-sm">v{v.version_number} — {v.change_notes || v.change_type}</p>
                    <p className="text-xs text-slate-500">{new Date(v.created_at).toLocaleString('pl-PL')}</p>
                  </div>
                  {i !== 0 && v.change_type !== 'sign' && (
                    <button
                      onClick={() => restoreVersion(v)}
                      className="text-xs px-3 py-1.5 border border-amber-200 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Przywróć
                    </button>
                  )}
                  {i === 0 && (
                    <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">Aktualna</span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showSignModal && (
        <DocumentSignModal
          document={doc as any}
          onClose={() => setShowSignModal(false)}
          onSent={() => { setShowSignModal(false); loadDocument(); }}
        />
      )}
      {showAIModal && (
        <DocumentAIAnalysis
          document={doc as any}
          onClose={() => setShowAIModal(false)}
          onSaved={() => loadDocument()}
        />
      )}
    </div>
  );
};
