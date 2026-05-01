import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle, FontFamily, Color, FontSize } from '@tiptap/extension-text-style';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import {
  analyzeDocument, getDocumentAnalyses,
  getDocumentVersions, restoreDocumentVersion,
  getDocumentComments, addDocumentComment, resolveComment,
  createPublicLink, getPublicLinks, deactivatePublicLink,
  createSignatureRequest, getSignatureRequests,
  logDocumentEvent,
} from '../../lib/documentService';
import { Loader2, ArrowLeft, Save, Download, FileText, MessageSquare, Clock, Users, Variable, PenTool, Sparkles, ChevronDown, X, Check, Reply, Send } from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────

const VARIABLE_LABELS: Record<string, string> = {
  protocol_date: 'Data protokołu', client_name: 'Nazwa klienta', contractor_name: 'Nazwa wykonawcy',
  contract_date: 'Data umowy', contract_number: 'Numer umowy', project_name: 'Nazwa projektu',
  project_address: 'Adres projektu', start_date: 'Data rozpoczęcia', end_date: 'Data zakończenia',
  deadline: 'Termin', amount: 'Kwota', payment_date: 'Termin płatności', payment_method: 'Forma płatności',
  nip: 'NIP', regon: 'REGON', address: 'Adres', phone: 'Telefon', email: 'Email',
  representative: 'Przedstawiciel', position: 'Stanowisko', warranty: 'Gwarancja', penalty: 'Kara umowna',
  scope: 'Zakres prac', city: 'Miasto', zip_code: 'Kod pocztowy', bank_account: 'Numer konta',
  name: 'Nazwa firmy', investor_name: 'Nazwa inwestora', investor_address: 'Adres inwestora',
  completion_date: 'Data zakończenia', inspection_date: 'Data odbioru', total_amount: 'Kwota łączna',
  vat_rate: 'Stawka VAT', net_amount: 'Kwota netto', gross_amount: 'Kwota brutto',
};

function getVariableLabel(name: string): string {
  return VARIABLE_LABELS[name] || name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Szkic', sent: 'Wysłany', signed: 'Podpisany', completed: 'Zakończony',
  cancelled: 'Anulowany', rejected: 'Odrzucony', pending: 'Oczekuje', active: 'Aktywny',
  withdrawn: 'Wycofany', expired: 'Wygasły', client_signed: 'Podpisany',
  viewed: 'Odczytano', archived: 'Zarchiwizowany',
};

/** Parse markdown to HTML for AI results */
function markdownToHtml(md: string): string {
  if (!md) return '';
  let html = md
    // Headers
    .replace(/^#{3}\s+(.+)$/gm, '<h4 class="font-semibold text-gray-900 mt-4 mb-1">$1</h4>')
    .replace(/^#{2}\s+(.+)$/gm, '<h3 class="font-semibold text-gray-900 text-lg mt-5 mb-2">$1</h3>')
    .replace(/^#{1}\s+(.+)$/gm, '<h2 class="font-bold text-gray-900 text-xl mt-6 mb-2">$1</h2>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr class="my-4 border-gray-200" />')
    // Unordered lists (- or * prefix)
    .replace(/^[\-\*]\s+(.+)$/gm, '<li class="ml-4 list-disc text-sm text-gray-700">$1</li>')
    // Ordered lists (1. 2. etc)
    .replace(/^\d+\.\s+(.+)$/gm, '<li class="ml-4 list-decimal text-sm text-gray-700">$1</li>')
    // Table rows (basic)
    .replace(/^\|(.+)\|$/gm, (_, row) => {
      const cells = row.split('|').map((c: string) => c.trim()).filter(Boolean);
      if (cells.every((c: string) => /^[-:]+$/.test(c))) return ''; // separator row
      return '<tr>' + cells.map((c: string) => `<td class="border border-gray-200 px-2 py-1 text-sm">${c}</td>`).join('') + '</tr>';
    })
    // Wrap consecutive list-disc <li> in <ul>
    .replace(/((?:<li class="ml-4 list-disc[^>]*>.*?<\/li>\n?)+)/g, '<ul class="my-2">$1</ul>')
    // Wrap consecutive list-decimal <li> in <ol>
    .replace(/((?:<li class="ml-4 list-decimal[^>]*>.*?<\/li>\n?)+)/g, '<ol class="my-2 list-decimal">$1</ol>')
    // Wrap consecutive <tr> in <table>
    .replace(/((?:<tr>.*?<\/tr>\n?)+)/g, '<table class="border-collapse w-full my-3">$1</table>')
    // Paragraphs (lines that aren't already HTML and not empty)
    .replace(/^(?!<[a-z/]|\s*$)(.+)$/gm, '<p class="text-sm text-gray-700 mb-1">$1</p>')
    // Clean up empty paragraphs
    .replace(/<p[^>]*>\s*<\/p>/g, '');
  return html;
}

/** Convert document content (various formats) to HTML for editor */
function contentToHtml(doc: any): string {
  if (!doc) return '<p></p>';

  // Try content field first (saved HTML from editor)
  if (doc.content) {
    if (typeof doc.content === 'string') return doc.content;
    if (typeof doc.content === 'object') {
      try {
        // JSON object with sections
        if (doc.content.sections && Array.isArray(doc.content.sections)) {
          return doc.content.sections.map((s: any) =>
            `<h2>${s.title || ''}</h2><p>${(s.content || s.body || '').replace(/\n/g, '</p><p>')}</p>`
          ).join('\n');
        }
        return JSON.stringify(doc.content);
      } catch { return '<p></p>'; }
    }
  }

  // Fallback: template content
  if (doc.document_templates?.content) {
    const tpl = doc.document_templates.content;
    if (Array.isArray(tpl)) {
      return tpl.map((s: any) =>
        `<h2>${s.title || ''}</h2><p>${(s.body || '').replace(/\n/g, '</p><p>')}</p>`
      ).join('\n');
    }
    if (typeof tpl === 'string') return tpl;
  }

  // Try data.content
  if (doc.data?.content) {
    if (typeof doc.data.content === 'string') return doc.data.content;
  }

  return '<p></p>';
}

// ── Variables Panel (sticky, scrolls with page) ─────────────────────────────

interface VariablesPanelProps {
  editor: any;
  content: string;
  onClose: () => void;
  onVariablesChange?: () => void;
}

const VariablesPanel: React.FC<VariablesPanelProps> = ({ editor, content, onClose, onVariablesChange }) => {
  const [variables, setVariables] = useState<Array<{ name: string; label: string; value: string }>>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const matches = [...new Set(content.match(/\{\{(\w+)\}\}/g) || [])];
    const savedLabels = JSON.parse(localStorage.getItem('doc_variable_labels') || '{}');
    const savedValues = JSON.parse(localStorage.getItem('doc_variables') || '{}');
    const vars = matches.map(m => {
      const name = m.replace(/\{\{|\}\}/g, '');
      return { name, label: savedLabels[name] || '', value: savedValues[name] || '' };
    });
    setVariables(vars);
  }, [content]);

  const updateValue = (name: string, value: string) => {
    setVariables(vars => vars.map(v => v.name === name ? { ...v, value } : v));
    const saved = JSON.parse(localStorage.getItem('doc_variables') || '{}');
    saved[name] = value;
    localStorage.setItem('doc_variables', JSON.stringify(saved));
    onVariablesChange?.();
  };

  const insertVariable = (name: string) => {
    editor?.chain().focus().insertContent(`{{${name}}}`).run();
  };

  const filtered = variables.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) || v.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl border shadow-sm sticky top-32 flex flex-col max-h-[calc(100vh-160px)]">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Zmienne dokumentu</h3>
          <p className="text-xs text-gray-400 mt-0.5">{variables.length} zmiennych</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="px-3 py-2 border-b border-gray-100">
        <input type="text" placeholder="Szukaj zmiennej..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-xs text-gray-400">{search ? 'Nie znaleziono' : 'Brak zmiennych {{}} w dokumencie'}</p>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {filtered.map(v => (
              <div key={v.name} className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-start justify-between mb-2 gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-800 mb-0.5 truncate">{v.label || getVariableLabel(v.name)}</p>
                    <span className="text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md">{`{{${v.name}}}`}</span>
                  </div>
                  <button onClick={() => insertVariable(v.name)}
                    className="flex-shrink-0 flex items-center gap-1 text-xs px-2 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Wstaw
                  </button>
                </div>
                <input type="text" placeholder={v.label ? `Wartość: ${v.label}` : `Wartość dla {{${v.name}}}...`}
                  value={v.value} onChange={e => updateValue(v.name, e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
        <p className="text-xs text-gray-400">Zaznacz miejsce w tekście i kliknij "Wstaw"</p>
      </div>
    </div>
  );
};

// ── Change Proposals Panel ──────────────────────────────────────────────────

const ChangeProposalsPanel: React.FC<{ documentId: string; onClose: () => void }> = ({ documentId, onClose }) => {
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('document_change_proposals').select('*').eq('document_id', documentId).order('created_at', { ascending: false });
    setProposals(data || []);
    setLoading(false);
  }, [documentId]);

  useEffect(() => { load(); }, [load]);

  const handleReview = async (id: string, status: string) => {
    setProcessing(id);
    await supabase.from('document_change_proposals').update({ status, review_notes: reviewNotes[id] || null, reviewed_at: new Date().toISOString() }).eq('id', id);
    await load();
    setProcessing(null);
  };

  const statusBadge = (s: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Oczekuje' },
      approved: { bg: 'bg-green-100', text: 'text-green-800', label: 'Zaakceptowano' },
      rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Odrzucono' },
      partial: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Częściowo' },
    };
    const cfg = map[s] || map.pending;
    return <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>;
  };

  return (
    <div className="bg-white rounded-xl border shadow-sm sticky top-32 flex flex-col max-h-[calc(100vh-160px)]">
      <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0">
        <h3 className="font-semibold text-sm">Propozycje zmian</h3>
        <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && <div className="px-4 py-6 text-sm text-gray-400 text-center">Ładowanie...</div>}
        {!loading && proposals.length === 0 && <div className="px-4 py-6 text-sm text-gray-400 text-center">Brak propozycji zmian</div>}
        {!loading && proposals.map(p => (
          <div key={p.id} className="border-b border-gray-100 last:border-b-0">
            <div className="px-4 py-3 flex items-start justify-between">
              <div>
                <span className="text-xs font-medium text-gray-900">{p.proposed_by_name}</span>
                {p.proposed_by_email && <span className="text-[10px] text-gray-400 ml-1">{p.proposed_by_email}</span>}
                <div className="text-xs text-gray-400 mt-0.5">{formatDate(p.created_at)}</div>
              </div>
              {statusBadge(p.status)}
            </div>
            {p.diff_summary && <div className="px-4 pb-2"><div className="text-xs text-gray-700 bg-gray-50 rounded-lg p-2.5">{p.diff_summary}</div></div>}
            {p.status === 'pending' && (
              <div className="px-4 pb-3 space-y-1.5">
                <textarea className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Komentarz do decyzji (opcjonalnie)..." rows={2}
                  value={reviewNotes[p.id] || ''} onChange={e => setReviewNotes(n => ({ ...n, [p.id]: e.target.value }))} />
                <div className="flex gap-1.5">
                  <button onClick={() => handleReview(p.id, 'approved')} disabled={processing === p.id}
                    className="flex-1 px-2.5 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium">
                    {processing === p.id ? 'Zapisywanie...' : '✓ Zaakceptuj'}
                  </button>
                  <button onClick={() => handleReview(p.id, 'rejected')} disabled={processing === p.id}
                    className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                    ✕ Odrzuć
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Status Flow Bar ─────────────────────────────────────────────────────────

const STATUS_FLOW = [
  { key: 'draft', label: 'Szkic', icon: FileText },
  { key: 'sent', label: 'Wysłano', icon: Send },
  { key: 'viewed', label: 'Odczytano', icon: Users },
  { key: 'signed', label: 'Podpisano', icon: PenTool },
  { key: 'completed', label: 'Zakończono', icon: Check },
];

const StatusFlowBar: React.FC<{ currentStatus: string }> = ({ currentStatus }) => {
  const currentIdx = STATUS_FLOW.findIndex(s => s.key === currentStatus);
  return (
    <div className="flex items-center justify-between px-6 py-4 bg-white border-b">
      {STATUS_FLOW.map((step, i) => {
        const Icon = step.icon;
        const isActive = step.key === currentStatus;
        const isPast = i < currentIdx;
        return (
          <React.Fragment key={step.key}>
            {i > 0 && <div className={`flex-1 h-0.5 mx-2 ${isPast ? 'bg-blue-500' : 'bg-gray-200'}`} />}
            <div className="flex flex-col items-center gap-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isActive ? 'bg-blue-600 text-white' : isPast ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
              }`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className={`text-xs ${isActive ? 'font-semibold text-blue-600' : 'text-gray-400'}`}>{step.label}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ── Fonts ────────────────────────────────────────────────────────────────────

const FONTS = [
  'Arial', 'Times New Roman', 'Calibri', 'Georgia', 'Verdana', 'Tahoma',
  'Courier New', 'Trebuchet MS', 'Garamond', 'Palatino',
];
const SIZES = ['10px', '11px', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px'];

// ── Main Page ───────────────────────────────────────────────────────────────

type TabKey = 'preview' | 'edit' | 'comments' | 'parties' | 'variables' | 'history' | 'download' | 'signature' | 'ai';

const TAB_CONFIG: Array<{ key: TabKey; label: string }> = [
  { key: 'preview', label: 'Podgląd' },
  { key: 'edit', label: 'Edytuj' },
  { key: 'comments', label: 'Komentarze' },
  { key: 'parties', label: 'Dane stron' },
  { key: 'variables', label: 'Zmienne' },
  { key: 'history', label: 'Historia wersji' },
];

export const DocumentViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state } = useAppContext();
  const user = state.currentUser;

  // Document state
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('preview');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Side panels
  const [showVariables, setShowVariables] = useState(false);
  const [showProposals, setShowProposals] = useState(false);

  // Comments
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // History
  const [versions, setVersions] = useState<any[]>([]);

  // AI
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<any[]>([]);

  // Parties data
  const [parties, setParties] = useState<[Record<string, string>, Record<string, string>]>([{}, {}]);

  // Signatures
  const [signatures, setSignatures] = useState<any[]>([]);

  // Font/size for toolbar
  const [currentFont, setCurrentFont] = useState('Arial');
  const [currentSize, setCurrentSize] = useState('16px');

  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  // ── Tiptap Editor ───────────────────────────────────────────────────────

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: {},
        orderedList: {},
      }),
      Underline,
      TextStyle,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      FontFamily.configure({ types: ['textStyle'] }),
      Color.configure({ types: ['textStyle'] }),
      FontSize,
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none min-h-[600px] p-8',
        style: 'font-size: 16px; line-height: 1.7;',
      },
      // Clean up pasted Word/Office HTML while preserving alignment
      transformPastedHTML(html: string) {
        return html
          .replace(/<!--\[if.*?\]>.*?<!\[endif\]-->/gis, '')
          .replace(/<o:p[^>]*>.*?<\/o:p>/gis, '')
          // Extract text-align from Mso classes before removing them
          .replace(/class="[^"]*MsoListParagraph[^"]*"/gi, '')
          .replace(/class="[^"]*Mso[^"]*"/gi, (match) => {
            // Check for center/right alignment hints in class names
            if (/center/i.test(match)) return 'style="text-align: center"';
            if (/right/i.test(match)) return 'style="text-align: right"';
            return '';
          })
          .replace(/style="[^"]*mso-[^"]*"/gi, (match) => {
            const cleaned = match.replace(/mso-[^;";]+;?/g, '');
            return cleaned === 'style=""' ? '' : cleaned;
          });
      },
    },
  });

  // Toggle editor editability based on tab
  useEffect(() => {
    if (editor) editor.setEditable(activeTab === 'edit');
  }, [activeTab, editor]);

  // ── Load Document ─────────────────────────────────────────────────────────

  const loadDocument = async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('documents')
      .select('*, document_templates(name, type, content, variables), contractors:contractor_id(name, nip), projects:project_id(name)')
      .eq('id', id)
      .single();
    if (error || !data) { setLoading(false); return; }
    setDoc(data);

    // Load parties from data
    if (data.data?.parties) {
      setParties([data.data.parties[0] || {}, data.data.parties[1] || {}]);
    }

    // Set editor content
    const html = contentToHtml(data);
    if (editor && html) editor.commands.setContent(html);

    setLoading(false);
  };

  const loadComments = async () => {
    if (!id) return;
    const { data } = await supabase.from('document_comments').select('*').eq('document_id', id).order('created_at', { ascending: true });
    if (data) {
      const roots = data.filter(c => !c.parent_id).map(c => ({ ...c, replies: data.filter(r => r.parent_id === c.id) }));
      setComments(roots);
    }
  };

  useEffect(() => { if (id) { loadDocument(); loadComments(); } }, [id]);

  // Load tab-specific data
  useEffect(() => {
    if (!id) return;
    if (activeTab === 'history') {
      getDocumentVersions(id).then(setVersions);
    } else if (activeTab === 'ai') {
      getDocumentAnalyses(id).then(setAnalyses);
    } else if (activeTab === 'signature') {
      getSignatureRequests(id).then(setSignatures);
    }
  }, [activeTab, id]);

  // ── Autosave ──────────────────────────────────────────────────────────────

  const saveDocument = useCallback(async () => {
    if (!editor || !id) return;
    setSaving(true);
    const html = editor.getHTML();
    const { error } = await supabase.from('documents').update({
      content: html,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    setSaving(false);
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
  }, [editor, id]);

  useEffect(() => {
    const timer = setInterval(saveDocument, 30000);
    return () => clearInterval(timer);
  }, [saveDocument]);

  // ── Comment Handlers ──────────────────────────────────────────────────────

  const addComment = async () => {
    if (!newComment.trim() || !user || !id) return;
    await supabase.from('document_comments').insert({
      document_id: id, author_id: user.id, author_name: user.email, content: newComment.trim(),
      field_key: selectedText ? `selection:${selectedText.slice(0, 50)}` : null,
    });
    setNewComment(''); setShowCommentInput(false); setSelectedText('');
    if (selectedText && editor) editor.commands.setHighlight({ color: '#fef08a' });
    await loadComments();
  };

  const addReply = async (parentId: string) => {
    if (!replyText.trim() || !user || !id) return;
    await supabase.from('document_comments').insert({
      document_id: id, author_id: user.id, author_name: user.email, content: replyText.trim(), parent_id: parentId,
    });
    setReplyText(''); setReplyTo(null);
    await loadComments();
  };

  const handleResolve = async (commentId: string) => {
    await supabase.from('document_comments').update({ resolved: true }).eq('id', commentId);
    setComments(c => c.map(item => item.id === commentId ? { ...item, resolved: true } : item));
  };

  // ── AI Analysis ───────────────────────────────────────────────────────────

  const runAnalysis = async (type: string) => {
    if (!id || !doc) return;
    setAiLoading(true); setAiResult(null);
    try {
      const rawHtml = editor?.getHTML() || doc.content || '';
      // Strip HTML tags to send clean text to AI (more content fits in the limit)
      const plainText = typeof rawHtml === 'string'
        ? rawHtml.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim()
        : JSON.stringify(rawHtml);
      const res = await analyzeDocument(id, doc.company_id, type, { content: plainText.slice(0, 15000) }, doc.name);
      setAiResult(res.result?.text || 'Brak wyniku');
    } catch (err: any) { setAiResult('Błąd: ' + err.message); }
    finally { setAiLoading(false); }
  };

  // ── Toolbar Handlers ──────────────────────────────────────────────────────

  const handleFontChange = (font: string) => {
    setCurrentFont(font);
    if (editor) editor.chain().focus().setFontFamily(font).run();
  };

  const handleSizeChange = (size: string) => {
    setCurrentSize(size);
    if (editor) (editor.chain().focus() as any).setFontSize(size).run();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const unresolvedComments = comments.filter(c => !c.resolved);
  const resolvedComments = comments.filter(c => c.resolved);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ── Top Header ─────────────────────────────────────── */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-20">
        <div className="max-w-screen-xl mx-auto px-4 py-2 flex items-center gap-3">
          <button onClick={() => navigate('/construction/dms')} className="text-gray-500 hover:text-gray-800 flex items-center gap-1 text-sm">
            <ArrowLeft className="w-4 h-4" /> Powrót
          </button>
          <div className="w-px h-6 bg-gray-200" />
          <h1 className="text-sm font-semibold text-gray-900 truncate max-w-xs">{doc?.name || 'Dokument'}</h1>
          <span className="text-xs text-gray-400">{STATUS_LABELS[doc?.status] || doc?.status}</span>
          <div className="flex-1" />

          {/* Tab Buttons */}
          {TAB_CONFIG.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                activeTab === t.key ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}>
              {t.label}
            </button>
          ))}

          {/* Extra buttons */}
          <div className="w-px h-6 bg-gray-200" />

          <div className="relative group">
            <button className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-1">
              Pobierz <ChevronDown className="w-3 h-3" />
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg py-1 hidden group-hover:block z-30 w-40">
              <button onClick={async () => {
                try {
                  const { generatePDF } = await import('../../lib/documentService');
                  const url = await generatePDF(doc.id);
                  window.open(url, '_blank');
                  await logDocumentEvent(doc.id, 'pdf_downloaded');
                } catch {}
              }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50">PDF</button>
              <button onClick={async () => {
                try {
                  const { default: htmlToDocx } = await import('html-to-docx');
                  const html = editor?.getHTML() || '';
                  const blob = await htmlToDocx(html, null, { table: { row: { cantSplit: true } } });
                  const url = URL.createObjectURL(blob as Blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = `${doc.name || 'dokument'}.docx`; a.click();
                  URL.revokeObjectURL(url);
                } catch {}
              }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50">DOCX</button>
            </div>
          </div>

          <button onClick={() => setActiveTab('signature')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
              activeTab === 'signature' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'
            }`}>
            Podpis
          </button>

          <button onClick={() => setActiveTab('ai')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1 ${
              activeTab === 'ai' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            }`}>
            <Sparkles className="w-3 h-3" /> AI
          </button>

          <button onClick={saveDocument} disabled={saving}
            className={`px-4 py-1.5 text-xs rounded-lg font-medium flex items-center gap-1 ${
              saved ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
            } disabled:opacity-50`}>
            <Save className="w-3 h-3" />
            {saving ? 'Zapisywanie...' : saved ? 'Zapisano!' : 'Zapisz'}
          </button>
        </div>
      </div>

      {/* ── Editor Toolbar (visible in edit mode) ─────────── */}
      {activeTab === 'edit' && editor && (
        <div className="bg-white border-b shadow-sm sticky top-[52px] z-10">
          <div className="max-w-screen-xl mx-auto px-4 py-1.5 flex items-center gap-1.5 flex-wrap">
            {/* Undo/Redo */}
            <button onClick={() => editor.chain().focus().undo().run()} className="p-1.5 rounded hover:bg-gray-100 text-gray-600" title="Cofnij">↩</button>
            <button onClick={() => editor.chain().focus().redo().run()} className="p-1.5 rounded hover:bg-gray-100 text-gray-600" title="Ponów">↪</button>
            <div className="w-px h-6 bg-gray-200 mx-1" />

            {/* Bold/Italic/Underline */}
            <button onClick={() => editor.chain().focus().toggleBold().run()}
              className={`p-1.5 rounded text-sm font-bold ${editor.isActive('bold') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>B</button>
            <button onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`p-1.5 rounded text-sm italic ${editor.isActive('italic') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>I</button>
            <button onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`p-1.5 rounded text-sm underline ${editor.isActive('underline') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>U</button>
            <div className="w-px h-6 bg-gray-200 mx-1" />

            {/* Headings */}
            <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={`px-2 py-1 rounded text-xs font-bold ${editor.isActive('heading', { level: 1 }) ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>H1</button>
            <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`px-2 py-1 rounded text-xs font-bold ${editor.isActive('heading', { level: 2 }) ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>H2</button>
            <div className="w-px h-6 bg-gray-200 mx-1" />

            {/* Lists */}
            <button onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`px-2 py-1 rounded text-xs ${editor.isActive('bulletList') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>• Lista</button>
            <button onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`px-2 py-1 rounded text-xs ${editor.isActive('orderedList') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>1. Lista</button>
            <div className="w-px h-6 bg-gray-200 mx-1" />

            {/* Alignment */}
            <button onClick={() => editor.chain().focus().setTextAlign('left').run()}
              className={`p-1.5 rounded text-xs ${editor.isActive({ textAlign: 'left' }) ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`} title="Do lewej">≡</button>
            <button onClick={() => editor.chain().focus().setTextAlign('center').run()}
              className={`p-1.5 rounded text-xs ${editor.isActive({ textAlign: 'center' }) ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`} title="Wyśrodkuj">≡</button>
            <button onClick={() => editor.chain().focus().setTextAlign('right').run()}
              className={`p-1.5 rounded text-xs ${editor.isActive({ textAlign: 'right' }) ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`} title="Do prawej">≡</button>
            <button onClick={() => editor.chain().focus().setTextAlign('justify').run()}
              className={`p-1.5 rounded text-xs ${editor.isActive({ textAlign: 'justify' }) ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`} title="Wyjustuj">≡</button>
            <div className="w-px h-6 bg-gray-200 mx-1" />

            {/* Font family */}
            <select value={currentFont} onChange={e => handleFontChange(e.target.value)}
              className="border rounded px-2 py-1 text-xs h-7">
              {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>

            {/* Font size */}
            <select value={currentSize} onChange={e => handleSizeChange(e.target.value)}
              className="border rounded px-2 py-1 text-xs h-7 w-16">
              {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            {/* Paragraph symbol (§) */}
            <button onClick={() => editor.chain().focus().insertContent('§').run()}
              className="p-1.5 rounded text-sm hover:bg-gray-100">§</button>
            <div className="w-px h-6 bg-gray-200 mx-1" />

            {/* Color picker */}
            <input type="color" onChange={e => editor.chain().focus().setColor(e.target.value).run()}
              className="w-7 h-7 rounded cursor-pointer border" title="Kolor tekstu" />

            {/* Highlight */}
            <button onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()}
              className={`px-2 py-1 rounded text-xs ${editor.isActive('highlight') ? 'bg-yellow-200' : 'hover:bg-gray-100'}`}
              style={{ background: editor.isActive('highlight') ? '#fef08a' : '' }}>
              Zaznacz
            </button>
          </div>
        </div>
      )}

      {/* ── Status Flow ───────────────────────────────────── */}
      <StatusFlowBar currentStatus={doc?.status || 'draft'} />

      {/* ── Main Content Area ─────────────────────────────── */}
      <div className="max-w-screen-xl mx-auto px-4 py-6 flex gap-6">
        {/* Left: Document Editor/Preview */}
        <div className="flex-1 min-w-0">
          {/* Comment input above editor */}
          {showCommentInput && (
            <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              {selectedText && (
                <p className="text-xs text-gray-500 mb-2 italic">
                  Komentarz do: "<span className="font-medium">{selectedText.slice(0, 80)}{selectedText.length > 80 ? '...' : ''}</span>"
                </p>
              )}
              <textarea ref={commentInputRef} value={newComment} onChange={e => setNewComment(e.target.value)}
                placeholder="Napisz komentarz..." rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="flex gap-2 mt-2">
                <button onClick={addComment} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium">Dodaj komentarz</button>
                <button onClick={() => { setShowCommentInput(false); setNewComment(''); setSelectedText(''); }}
                  className="px-3 py-1.5 rounded-lg text-xs border hover:bg-gray-50">Anuluj</button>
              </div>
            </div>
          )}

          {/* Editor Area */}
          <div className="bg-white rounded-xl shadow-sm border min-h-[700px]">
            {activeTab === 'preview' || activeTab === 'edit' || activeTab === 'variables' ? (
              <EditorContent editor={editor} />
            ) : activeTab === 'comments' ? (
              <div className="p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Komentarze ({unresolvedComments.length})</h3>
                <button onClick={() => { setShowCommentInput(true); setTimeout(() => commentInputRef.current?.focus(), 100); }}
                  className="mb-4 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg">+ Dodaj komentarz</button>
                <div className="space-y-4">
                  {unresolvedComments.map(c => (
                    <div key={c.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className="text-sm font-medium text-gray-800">{c.author_name}</span>
                          <span className="text-xs text-gray-400 ml-2">{formatDate(c.created_at)}</span>
                        </div>
                        <button onClick={() => handleResolve(c.id)} className="text-xs text-green-600 hover:underline">Rozwiąż</button>
                      </div>
                      {c.field_key?.startsWith('selection:') && (
                        <p className="text-xs text-blue-600 italic mb-1 bg-blue-50 px-2 py-0.5 rounded">
                          "{c.field_key.replace('selection:', '')}"
                        </p>
                      )}
                      <p className="text-sm text-gray-700 mb-2">{c.content}</p>
                      {c.replies?.map((r: any) => (
                        <div key={r.id} className="ml-4 bg-gray-50 rounded-lg px-3 py-2 mb-1">
                          <span className="text-xs font-medium text-gray-700">{r.author_name}</span>
                          <p className="text-xs text-gray-600 mt-0.5">{r.content}</p>
                        </div>
                      ))}
                      {replyTo === c.id ? (
                        <div className="mt-2 ml-4">
                          <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
                            placeholder="Odpowiedz..." rows={2}
                            className="w-full border rounded px-2 py-1 text-xs resize-none" />
                          <div className="flex gap-1 mt-1">
                            <button onClick={() => addReply(c.id)} className="bg-blue-600 text-white px-2 py-1 rounded text-xs">Odpowiedz</button>
                            <button onClick={() => setReplyTo(null)} className="px-2 py-1 rounded text-xs border">Anuluj</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setReplyTo(c.id)} className="text-xs text-blue-600 hover:underline mt-1">Odpowiedz</button>
                      )}
                    </div>
                  ))}
                </div>
                {resolvedComments.length > 0 && (
                  <div className="mt-6">
                    <p className="text-xs font-medium text-gray-400 mb-2">Rozwiązane ({resolvedComments.length})</p>
                    {resolvedComments.map(c => (
                      <div key={c.id} className="border border-gray-100 rounded-lg p-3 mb-2 opacity-60">
                        <span className="text-xs text-gray-500">{c.author_name}: {c.content}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : activeTab === 'parties' ? (
              <div className="p-6 space-y-6">
                <h3 className="font-semibold text-gray-900">Dane stron</h3>
                {['Strona 1 (Wykonawca)', 'Strona 2 (Usługodawca)'].map((label, idx) => (
                  <div key={idx} className="border rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-800 mb-3">{label}</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {['name', 'nip', 'address', 'city', 'zip_code', 'representative', 'position', 'phone', 'email', 'bank_account'].map(field => (
                        <div key={field}>
                          <label className="text-xs text-gray-500 block mb-0.5">{getVariableLabel(field)}</label>
                          <input type="text" value={parties[idx][field] || ''} onChange={e => {
                            const newParties = [...parties] as [Record<string, string>, Record<string, string>];
                            newParties[idx] = { ...newParties[idx], [field]: e.target.value };
                            setParties(newParties);
                          }} className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <button onClick={async () => {
                  if (!id) return;
                  const docData = doc?.data || {};
                  await supabase.from('documents').update({ data: { ...docData, parties }, updated_at: new Date().toISOString() }).eq('id', id);
                  setSaved(true); setTimeout(() => setSaved(false), 3000);
                }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Zapisz dane stron</button>
              </div>
            ) : activeTab === 'history' ? (
              <div className="p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Historia wersji</h3>
                {versions.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">Brak wersji</p>
                ) : (
                  <div className="space-y-3">
                    {versions.map(v => (
                      <div key={v.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium">Wersja {v.version_number}</p>
                          <p className="text-xs text-gray-500">{formatDate(v.created_at)}</p>
                          {v.change_summary && <p className="text-xs text-gray-400 mt-0.5">{v.change_summary}</p>}
                        </div>
                        <button onClick={async () => {
                          if (confirm(`Przywrócić wersję ${v.version_number}?`)) {
                            await restoreDocumentVersion(doc.id, v.version_number, user?.id || '');
                            await loadDocument();
                          }
                        }} className="text-xs text-blue-600 hover:underline">Przywróć</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : activeTab === 'signature' ? (
              <div className="p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Podpisy</h3>
                <div className="mb-4 p-3 bg-blue-50 rounded-lg space-y-2">
                  <p className="text-sm font-medium text-blue-700">Wyślij zapytanie o podpis</p>
                  <div className="flex gap-2">
                    <input type="text" placeholder="Imię i nazwisko" id="signer-name" className="flex-1 px-3 py-1.5 text-sm border rounded-lg" />
                    <input type="email" placeholder="Email" id="signer-email" className="flex-1 px-3 py-1.5 text-sm border rounded-lg" />
                    <button onClick={async () => {
                      const nameEl = document.getElementById('signer-name') as HTMLInputElement;
                      const emailEl = document.getElementById('signer-email') as HTMLInputElement;
                      if (!nameEl.value || !emailEl.value || !id || !doc) return;
                      await createSignatureRequest(id, doc.company_id, user?.id || '', [{ name: nameEl.value, email: emailEl.value }]);
                      nameEl.value = ''; emailEl.value = '';
                      setSignatures(await getSignatureRequests(id));
                    }} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg">Wyślij</button>
                  </div>
                </div>
                {signatures.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-2">
                    <div>
                      <p className="text-sm font-medium">{s.signer_name}</p>
                      <p className="text-xs text-gray-500">{s.signer_email}</p>
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      s.status === 'signed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>{s.status === 'signed' ? 'Podpisany' : 'Oczekuje'}</span>
                  </div>
                ))}
              </div>
            ) : activeTab === 'ai' ? (
              <div className="p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Analiza AI</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  {[
                    { type: 'review', label: 'Pełna analiza', icon: '📋' },
                    { type: 'risk', label: 'Analiza ryzyk', icon: '⚠️' },
                    { type: 'summary', label: 'Streszczenie', icon: '📝' },
                    { type: 'suggestion', label: 'Sugestie zmian', icon: '💡' },
                    { type: 'clause_check', label: 'Sprawdź klauzule', icon: '⚖️' },
                  ].map(a => (
                    <button key={a.type} onClick={() => runAnalysis(a.type)} disabled={aiLoading}
                      className="px-3 py-1.5 text-xs bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 disabled:opacity-50 font-medium">
                      {a.icon} {a.label}
                    </button>
                  ))}
                </div>

                {aiLoading && (
                  <div className="flex items-center gap-3 py-6">
                    <Loader2 className="animate-spin h-5 w-5 text-purple-500" />
                    <span className="text-sm text-gray-500">Analizuję dokument...</span>
                  </div>
                )}

                {/* AI Result — rendered as HTML from markdown */}
                {aiResult && (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
                    <p className="text-sm font-medium text-purple-700 mb-3">Wynik analizy AI</p>
                    <div className="ai-result text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: markdownToHtml(aiResult) }} />
                  </div>
                )}

                {analyses.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-gray-500 mb-2">Historia analiz</p>
                    {analyses.map((a: any) => (
                      <div key={a.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg mb-1 text-xs">
                        <span>{a.analysis_type} · {formatDate(a.created_at)}</span>
                        <button onClick={() => setAiResult(a.result?.text)} className="text-blue-600 hover:underline">Pokaż</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">Autosave co 30 sekund</p>
        </div>

        {/* Right Sidebar — Variables / Proposals (sticky, scrolls with page) */}
        {(activeTab === 'variables' || showVariables) && editor && (
          <div className="w-80 flex-shrink-0">
            <VariablesPanel editor={editor} content={editor.getHTML()} onClose={() => { setShowVariables(false); if (activeTab === 'variables') setActiveTab('preview'); }}
              onVariablesChange={() => {}} />
          </div>
        )}

        {showProposals && id && (
          <div className="w-[420px] flex-shrink-0">
            <ChangeProposalsPanel documentId={id} onClose={() => setShowProposals(false)} />
          </div>
        )}

        {/* Comments sidebar in preview/edit mode */}
        {(activeTab === 'preview' || activeTab === 'edit') && (
          <div className="w-80 flex-shrink-0">
            <div className="bg-white rounded-xl border shadow-sm sticky top-32">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <h3 className="font-semibold text-sm text-gray-900">Komentarze ({unresolvedComments.length})</h3>
                {resolvedComments.length > 0 && <span className="text-xs text-gray-400">{resolvedComments.length} rozwiązane</span>}
              </div>
              <div className="divide-y max-h-[70vh] overflow-y-auto">
                {unresolvedComments.length === 0 && (
                  <p className="px-4 py-6 text-sm text-gray-400 text-center">
                    Brak komentarzy.<br />Zaznacz tekst i kliknij "+ Komentarz"
                  </p>
                )}
                {unresolvedComments.map(c => (
                  <div key={c.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <span className="text-xs font-medium text-gray-800">{c.author_name}</span>
                        <span className="text-xs text-gray-400 ml-2">{formatDate(c.created_at)}</span>
                      </div>
                      <button onClick={() => handleResolve(c.id)} className="text-xs text-green-600 hover:underline flex-shrink-0">Rozwiąż</button>
                    </div>
                    {c.field_key?.startsWith('selection:') && (
                      <p className="text-xs text-blue-600 italic mb-1 bg-blue-50 px-2 py-0.5 rounded">"{c.field_key.replace('selection:', '')}"</p>
                    )}
                    <p className="text-sm text-gray-700 mb-2">{c.content}</p>
                    {c.replies?.map((r: any) => (
                      <div key={r.id} className="ml-3 bg-gray-50 rounded-lg px-3 py-2 mb-1">
                        <span className="text-xs font-medium text-gray-700">{r.author_name}</span>
                        <p className="text-xs text-gray-600 mt-0.5">{r.content}</p>
                      </div>
                    ))}
                    {replyTo === c.id ? (
                      <div className="mt-2">
                        <textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Odpowiedz..." rows={2}
                          className="w-full border rounded px-2 py-1 text-xs resize-none" />
                        <div className="flex gap-1 mt-1">
                          <button onClick={() => addReply(c.id)} className="bg-blue-600 text-white px-2 py-1 rounded text-xs">Odpowiedz</button>
                          <button onClick={() => setReplyTo(null)} className="px-2 py-1 rounded text-xs border">Anuluj</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setReplyTo(c.id)} className="text-xs text-blue-600 hover:underline">Odpowiedz</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default DocumentViewPage;
