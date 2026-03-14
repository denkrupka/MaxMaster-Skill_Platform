import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, Plus, Search, Eye, Download, Pencil, Trash2,
  ChevronLeft, ChevronRight, Check, X, Loader2,
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import {
  fetchTemplates, fetchTemplate, createTemplate, updateTemplate, deleteTemplate,
  fetchDocuments, fetchDocument, createDocument, updateDocument,
  getAutofillData, applyAutofill, renderTemplate,
} from '../../lib/documentService';
import type {
  DocumentTemplate, DocumentRecord, TemplateVariable,
  DocumentTemplateType, DocumentStatus, TemplateSection,
  CreateTemplateInput, CreateDocumentInput,
} from '../../types';

// ── helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<DocumentTemplateType, string> = {
  contract: 'Umowa', protocol: 'Protokół', annex: 'Aneks', other: 'Inne',
};
const STATUS_LABELS: Record<DocumentStatus, string> = {
  draft: 'Szkic', completed: 'Gotowy', archived: 'Zarchiwizowany',
};
const STATUS_COLORS: Record<DocumentStatus, string> = {
  draft: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  archived: 'bg-slate-100 text-slate-500',
};

const fmt = (iso: string) => new Date(iso).toLocaleDateString('pl-PL');

// Highlight {{placeholder}} in text
const HighlightedContent = ({ text }: { text: string }) => {
  const parts = text.split(/({{[^}]+}})/g);
  return (
    <span>
      {parts.map((p, i) =>
        /^{{.+}}$/.test(p)
          ? <mark key={i} className="bg-blue-100 text-blue-700 rounded px-0.5 font-mono text-xs">{p}</mark>
          : <span key={i}>{p}</span>
      )}
    </span>
  );
};

const Spinner = () => (
  <div className="flex justify-center py-12">
    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
  </div>
);

const Empty = ({ label }: { label: string }) => (
  <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
    <FileText className="w-12 h-12" />
    <p className="text-sm">{label}</p>
  </div>
);

// ── Template Modal ────────────────────────────────────────────────────────────

interface TemplateMeta { name: string; type: DocumentTemplateType; description: string; }

const TemplateModal = ({
  companyId, userId, existing, onClose, onSaved,
}: {
  companyId: string; userId: string;
  existing?: DocumentTemplate;
  onClose: () => void; onSaved: () => void;
}) => {
  const [meta, setMeta] = useState<TemplateMeta>({
    name: existing?.name ?? '', type: existing?.type ?? 'contract', description: existing?.description ?? '',
  });
  const [sections, setSections] = useState<TemplateSection[]>(
    existing?.content ?? [{ title: '', body: '' }]
  );
  const [variables, setVariables] = useState<TemplateVariable[]>(existing?.variables ?? []);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const updateSection = (i: number, field: keyof TemplateSection, val: string) =>
    setSections(s => s.map((sec, idx) => idx === i ? { ...sec, [field]: val } : sec));
  const moveSection = (i: number, dir: -1 | 1) => {
    const arr = [...sections]; const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]]; setSections(arr);
  };
  const updateVar = (i: number, field: keyof TemplateVariable, val: string) =>
    setVariables(v => v.map((vr, idx) => idx === i ? { ...vr, [field]: val } : vr));

  const save = async () => {
    if (!meta.name.trim()) { setErr('Nazwa jest wymagana'); return; }
    setSaving(true); setErr('');
    try {
      const payload = { ...meta, content: sections, variables, is_active: true };
      if (existing) {
        await updateTemplate(existing.id, payload);
      } else {
        const inp: CreateTemplateInput = { ...payload, company_id: companyId, created_by: userId };
        await createTemplate(inp);
      }
      onSaved();
    } catch (e: any) { setErr(e.message ?? 'Błąd zapisu'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-slate-800">
            {existing ? 'Edytuj szablon' : 'Nowy szablon'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-4 space-y-4">
          {/* Meta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Nazwa *</label>
              <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                value={meta.name} onChange={e => setMeta(m => ({ ...m, name: e.target.value }))}
                placeholder="Np. Umowa o dzieło" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Typ</label>
              <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                value={meta.type} onChange={e => setMeta(m => ({ ...m, type: e.target.value as DocumentTemplateType }))}>
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Opis</label>
            <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              value={meta.description} onChange={e => setMeta(m => ({ ...m, description: e.target.value }))}
              placeholder="Opcjonalny opis szablonu" />
          </div>
          {/* Sections */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">Sekcje szablonu</span>
              <button onClick={() => setSections(s => [...s, { title: '', body: '' }])}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Dodaj sekcję
              </button>
            </div>
            <div className="space-y-3">
              {sections.map((sec, i) => (
                <div key={i} className="border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input className="flex-1 border border-slate-200 rounded px-2 py-1 text-sm"
                      placeholder="Tytuł sekcji (opcjonalny)" value={sec.title ?? ''}
                      onChange={e => updateSection(i, 'title', e.target.value)} />
                    <button onClick={() => moveSection(i, -1)} disabled={i === 0}
                      className="text-slate-400 hover:text-slate-600 disabled:opacity-30">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button onClick={() => moveSection(i, 1)} disabled={i === sections.length - 1}
                      className="text-slate-400 hover:text-slate-600 disabled:opacity-30">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button onClick={() => setSections(s => s.filter((_, idx) => idx !== i))}
                      className="text-red-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <textarea className="w-full border border-slate-200 rounded px-2 py-1 text-sm font-mono h-24 resize-y"
                    placeholder="Treść sekcji, użyj {{zmienna}} jako placeholder"
                    value={sec.body} onChange={e => updateSection(i, 'body', e.target.value)} />
                  <div className="text-xs text-slate-400">
                    <HighlightedContent text={sec.body.slice(0, 120) + (sec.body.length > 120 ? '…' : '')} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Variables */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">Zmienne</span>
              <button onClick={() => setVariables(v => [...v, { key: '', label: '', source: 'manual', type: 'text' }])}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Dodaj zmienną
              </button>
            </div>
            {variables.length > 0 && (
              <div className="space-y-2">
                {variables.map((vr, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2 items-center">
                    <input className="border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                      placeholder="klucz" value={vr.key} onChange={e => updateVar(i, 'key', e.target.value)} />
                    <input className="border border-slate-200 rounded px-2 py-1 text-xs"
                      placeholder="etykieta" value={vr.label} onChange={e => updateVar(i, 'label', e.target.value)} />
                    <select className="border border-slate-200 rounded px-2 py-1 text-xs"
                      value={vr.source} onChange={e => updateVar(i, 'source', e.target.value as any)}>
                      <option value="manual">Ręcznie</option>
                      <option value="contractors">Kontrahent</option>
                      <option value="projects">Projekt</option>
                      <option value="companies">Firma</option>
                      <option value="employees">Pracownik</option>
                    </select>
                    <div className="flex items-center gap-1">
                      <select className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs"
                        value={vr.type} onChange={e => updateVar(i, 'type', e.target.value as any)}>
                        <option value="text">Tekst</option>
                        <option value="date">Data</option>
                        <option value="number">Liczba</option>
                      </select>
                      <button onClick={() => setVariables(v => v.filter((_, idx) => idx !== i))}
                        className="text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {err && <p className="text-red-600 text-sm">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Anuluj</button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Zapisz
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Document Create Wizard ────────────────────────────────────────────────────

const DocumentWizard = ({
  companyId, userId, templates, contractors, projects, onClose, onSaved,
}: {
  companyId: string; userId: string;
  templates: DocumentTemplate[];
  contractors: any[]; projects: any[];
  onClose: () => void; onSaved: () => void;
}) => {
  const [step, setStep] = useState(1);
  const [templateId, setTemplateId] = useState('');
  const [contractorId, setContractorId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const tpl = templates.find(t => t.id === templateId);

  const handleStep2Next = async () => {
    if (!tpl) return;
    const autofill = await getAutofillData(companyId, contractorId || undefined, projectId || undefined);
    const filled = applyAutofill(tpl.variables, autofill);
    setFormData(filled);
    setStep(3);
  };

  const handleStep3Next = () => {
    if (!tpl) return;
    setPreview(renderTemplate(tpl, formData));
    setStep(4);
  };

  const save = async (status: 'draft' | 'completed') => {
    if (!tpl) return;
    setSaving(true); setErr('');
    try {
      const docName = formData['contract_name'] || formData['document_name'] || `${TYPE_LABELS[tpl.type]} — ${tpl.name}`;
      const inp: CreateDocumentInput = {
        company_id: companyId, template_id: templateId, created_by: userId,
        name: docName, status, data: formData,
        contractor_id: contractorId || undefined,
        project_id: projectId || undefined,
      };
      await createDocument(inp);
      onSaved();
    } catch (e: any) { setErr(e.message ?? 'Błąd zapisu'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Nowy dokument</h2>
            <p className="text-xs text-slate-400">Krok {step} z 4</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        {/* Steps */}
        <div className="px-6 py-4 min-h-[200px]">
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700">Wybierz szablon</p>
              <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                value={templateId} onChange={e => setTemplateId(e.target.value)}>
                <option value="">-- wybierz szablon --</option>
                {templates.filter(t => t.is_active).map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({TYPE_LABELS[t.type]})</option>
                ))}
              </select>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-slate-700">Kontrahent i projekt</p>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Kontrahent</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  value={contractorId} onChange={e => setContractorId(e.target.value)}>
                  <option value="">-- brak --</option>
                  {contractors.map(c => <option key={c.id} value={c.id}>{c.name ?? c.company_name ?? c.id}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Projekt</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  value={projectId} onChange={e => setProjectId(e.target.value)}>
                  <option value="">-- brak --</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name ?? p.id}</option>)}
                </select>
              </div>
            </div>
          )}
          {step === 3 && tpl && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700">Uzupełnij zmienne</p>
              {tpl.variables.length === 0 && <p className="text-sm text-slate-400">Brak zmiennych w szablonie.</p>}
              {tpl.variables.map(v => (
                <div key={v.key}>
                  <label className="block text-xs text-slate-500 mb-1">
                    {v.label || v.key}
                    {v.source !== 'manual' && <span className="ml-1 text-blue-500">(autouzupełnione)</span>}
                  </label>
                  <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    type={v.type === 'date' ? 'date' : v.type === 'number' ? 'number' : 'text'}
                    value={formData[v.key] ?? ''}
                    onChange={e => setFormData(d => ({ ...d, [v.key]: e.target.value }))}
                    placeholder={v.defaultValue ?? v.label} />
                </div>
              ))}
            </div>
          )}
          {step === 4 && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-3">Podgląd dokumentu</p>
              <div className="border border-slate-200 rounded-lg p-4 text-sm text-slate-700 max-h-64 overflow-y-auto prose prose-sm"
                dangerouslySetInnerHTML={{ __html: preview }} />
            </div>
          )}
          {err && <p className="text-red-600 text-sm mt-2">{err}</p>}
        </div>
        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t">
          <button onClick={() => setStep(s => s - 1)} disabled={step === 1}
            className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800 disabled:opacity-30">
            <ChevronLeft className="w-4 h-4" /> Wstecz
          </button>
          <div className="flex gap-2">
            {step === 4 && (
              <>
                <button onClick={() => save('draft')} disabled={saving}
                  className="px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Zapisz jako szkic
                </button>
                <button onClick={() => save('completed')} disabled={saving}
                  className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1">
                  <Check className="w-4 h-4" /> Zatwierdź
                </button>
              </>
            )}
            {step < 4 && (
              <button
                onClick={() => {
                  if (step === 1 && !templateId) { setErr('Wybierz szablon'); return; }
                  setErr('');
                  if (step === 2) { handleStep2Next(); return; }
                  if (step === 3) { handleStep3Next(); return; }
                  setStep(s => s + 1);
                }}
                className="flex items-center gap-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Dalej <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Document View Modal ───────────────────────────────────────────────────────

const DocumentView = ({ docId, onClose, onRefresh }: { docId: string; onClose: () => void; onRefresh: () => void }) => {
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewError, setViewError] = useState<string | null>(null);

  useEffect(() => {
    fetchDocument(docId)
      .then(d => { setDoc(d); setLoading(false); })
      .catch(() => { setViewError('Nie udało się załadować dokumentu'); setLoading(false); });
  }, [docId]);

  const archive = async () => {
    if (!doc) return;
    try {
      await updateDocument(doc.id, { status: 'archived' });
      onRefresh(); onClose();
    } catch {
      setViewError('Nie udało się zarchiwizować dokumentu');
    }
  };

  const renderedHtml = doc?.document_templates
    ? renderTemplate(doc.document_templates as DocumentTemplate, doc.data)
    : '';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{doc?.name ?? '...'}</h2>
            {doc && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[doc.status]}`}>{STATUS_LABELS[doc.status]}</span>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-4">
          {viewError && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center justify-between">
              <span>{viewError}</span>
              <button onClick={() => setViewError(null)} className="text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button>
            </div>
          )}
          {loading ? <Spinner /> : (
            <div className="border border-slate-200 rounded-lg p-4 prose prose-sm max-h-96 overflow-y-auto text-slate-700"
              dangerouslySetInnerHTML={{ __html: renderedHtml }} />
          )}
        </div>
        <div className="flex justify-between px-6 py-4 border-t">
          <button onClick={() => alert('PDF generation coming soon')}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50">
            <Download className="w-4 h-4" /> Pobierz PDF
          </button>
          {doc?.status !== 'archived' && (
            <button onClick={archive}
              className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
              <Trash2 className="w-4 h-4" /> Archiwizuj
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export const DMSPage: React.FC = () => {
  const { state } = useAppContext();
  const companyId = state.currentUser?.company_id ?? '';
  const userId = state.currentUser?.id ?? '';

  const [tab, setTab] = useState<'templates' | 'documents'>('templates');
  const [error, setError] = useState<string | null>(null);

  // Templates state
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [tplLoading, setTplLoading] = useState(true);
  const [tplSearch, setTplSearch] = useState('');
  const [tplTypeFilter, setTplTypeFilter] = useState<DocumentTemplateType | ''>('');
  const [showTplModal, setShowTplModal] = useState(false);
  const [editingTpl, setEditingTpl] = useState<DocumentTemplate | undefined>();

  // Documents state
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [docLoading, setDocLoading] = useState(true);
  const [docSearch, setDocSearch] = useState('');
  const [docStatus, setDocStatus] = useState<DocumentStatus | ''>('');
  const [showDocWizard, setShowDocWizard] = useState(false);
  const [viewDocId, setViewDocId] = useState<string | null>(null);

  // Shared
  const [contractors, setContractors] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  const loadTemplates = useCallback(async () => {
    if (!companyId) return;
    setTplLoading(true);
    try {
      const data = await fetchTemplates(companyId, tplTypeFilter || undefined);
      setTemplates(data);
    } catch {
      setError('Nie udało się załadować danych');
    } finally { setTplLoading(false); }
  }, [companyId, tplTypeFilter]);

  const loadDocuments = useCallback(async () => {
    if (!companyId) return;
    setDocLoading(true);
    try {
      const data = await fetchDocuments(companyId, { status: docStatus || undefined });
      setDocuments(data);
    } catch {
      setError('Nie udało się załadować danych');
    } finally { setDocLoading(false); }
  }, [companyId, docStatus]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);
  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  useEffect(() => {
    if (!companyId) return;
    supabase.from('contractor_clients').select('id,name,company_name').eq('company_id', companyId)
      .then(({ data }) => { if (data) setContractors(data); })
      .catch(() => setError('Nie udało się załadować kontrahentów'));
    supabase.from('projects').select('id,name').eq('company_id', companyId)
      .then(({ data }) => { if (data) setProjects(data); })
      .catch(() => setError('Nie udało się załadować projektów'));
  }, [companyId]);

  const deleteTpl = async (id: string) => {
    if (!confirm('Usunąć szablon?')) return;
    try {
      await deleteTemplate(id);
      loadTemplates();
    } catch {
      setError('Nie udało się usunąć szablonu');
    }
  };

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(tplSearch.toLowerCase())
  );
  const filteredDocuments = documents.filter(d =>
    d.name.toLowerCase().includes(docSearch.toLowerCase()) ||
    (d.number ?? '').toLowerCase().includes(docSearch.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 space-y-6 font-[Inter,sans-serif]">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dokumenty</h1>
          <p className="text-sm text-slate-500 mt-0.5">Szablony i dokumenty firmowe</p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {([['templates', 'Szablony'], ['documents', 'Dokumenty']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === key ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── TEMPLATES TAB ── */}
      {tab === 'templates' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm"
                placeholder="Szukaj szablonu…" value={tplSearch} onChange={e => setTplSearch(e.target.value)} />
            </div>
            <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
              value={tplTypeFilter} onChange={e => setTplTypeFilter(e.target.value as any)}>
              <option value="">Wszystkie typy</option>
              {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button onClick={() => { setEditingTpl(undefined); setShowTplModal(true); }}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 whitespace-nowrap">
              <Plus className="w-4 h-4" /> Nowy szablon
            </button>
          </div>

          {tplLoading ? <Spinner /> : filteredTemplates.length === 0 ? <Empty label="Brak szablonów" /> : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-3">Nazwa</th>
                    <th className="text-left px-4 py-3 hidden sm:table-cell">Typ</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Opis</th>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">Data</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTemplates.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">{t.name}</td>
                      <td className="px-4 py-3 hidden sm:table-cell text-slate-500">{TYPE_LABELS[t.type]}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-slate-500 max-w-xs truncate">{t.description ?? '—'}</td>
                      <td className="px-4 py-3 hidden lg:table-cell text-slate-400">{fmt(t.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {t.is_active ? 'Aktywny' : 'Nieaktywny'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => { setEditingTpl(t); setShowTplModal(true); }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteTpl(t.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── DOCUMENTS TAB ── */}
      {tab === 'documents' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm"
                placeholder="Szukaj dokumentu…" value={docSearch} onChange={e => setDocSearch(e.target.value)} />
            </div>
            <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
              value={docStatus} onChange={e => setDocStatus(e.target.value as any)}>
              <option value="">Wszystkie statusy</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button onClick={() => setShowDocWizard(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 whitespace-nowrap">
              <Plus className="w-4 h-4" /> Nowy dokument
            </button>
          </div>

          {docLoading ? <Spinner /> : filteredDocuments.length === 0 ? <Empty label="Brak dokumentów" /> : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-3 hidden sm:table-cell">Numer</th>
                    <th className="text-left px-4 py-3">Nazwa</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Szablon</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">Data</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDocuments.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 hidden sm:table-cell text-slate-400 font-mono text-xs">{d.number ?? '—'}</td>
                      <td className="px-4 py-3 font-medium text-slate-800 max-w-xs truncate">{d.name}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-slate-500">
                        {d.document_templates ? `${d.document_templates.name} (${TYPE_LABELS[d.document_templates.type]})` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[d.status]}`}>
                          {STATUS_LABELS[d.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-slate-400">{fmt(d.created_at)}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => setViewDocId(d.id)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors">
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showTplModal && (
        <TemplateModal
          companyId={companyId} userId={userId} existing={editingTpl}
          onClose={() => setShowTplModal(false)}
          onSaved={() => { setShowTplModal(false); loadTemplates(); }}
        />
      )}
      {showDocWizard && (
        <DocumentWizard
          companyId={companyId} userId={userId}
          templates={templates} contractors={contractors} projects={projects}
          onClose={() => setShowDocWizard(false)}
          onSaved={() => { setShowDocWizard(false); loadDocuments(); }}
        />
      )}
      {viewDocId && (
        <DocumentView
          docId={viewDocId}
          onClose={() => setViewDocId(null)}
          onRefresh={loadDocuments}
        />
      )}
    </div>
  );
};

export default DMSPage;
