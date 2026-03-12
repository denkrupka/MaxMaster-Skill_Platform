import React, { useState, useEffect } from 'react';
import {
  X, ChevronRight, FileText, Eye, Edit3, Save, Loader2,
  AlertCircle, CheckCircle, ArrowLeft
} from 'lucide-react';
import { BUILTIN_TEMPLATES, BuiltinTemplate, TemplateVariable } from './builtinTemplates';
import { supabase } from '../../../lib/supabase';
import { useAppContext } from '../../../context/AppContext';

interface Props {
  onClose: () => void;
  onCreated: (documentId: string) => void;
  initialTemplateId?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Umowy': 'bg-blue-100 text-blue-700',
  'Protokoły': 'bg-green-100 text-green-700',
  'Inne': 'bg-purple-100 text-purple-700',
};

function fillTemplate(content: string, values: Record<string, string>): string {
  let result = content;
  Object.entries(values).forEach(([key, value]) => {
    result = result.split(`{{${key}}}`).join(value || `<span style="color:#ef4444; background:#fee2e2; padding:0 4px; border-radius:3px;">{{${key}}}</span>`);
  });
  // Mark unfilled variables
  result = result.replace(/\{\{([^}]+)\}\}/g, `<span style="color:#ef4444; background:#fee2e2; padding:0 4px; border-radius:3px;">{{$1}}</span>`);
  return result;
}

export const DocumentTemplateEditor: React.FC<Props> = ({ onClose, onCreated, initialTemplateId }) => {
  const { state } = useAppContext();
  const { currentUser } = state;

  const [step, setStep] = useState<'select' | 'fill' | 'preview'>(initialTemplateId ? 'fill' : 'select');
  const [selectedTemplate, setSelectedTemplate] = useState<BuiltinTemplate | null>(
    initialTemplateId ? BUILTIN_TEMPLATES.find(t => t.id === initialTemplateId) || null : null
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [docName, setDocName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Pre-fill from company data
  useEffect(() => {
    if (selectedTemplate && currentUser) {
      const auto: Record<string, string> = {};
      // Try to auto-fill date fields
      const today = new Date().toISOString().split('T')[0];
      selectedTemplate.variables.forEach(v => {
        if (v.type === 'date' && (v.name === 'data' || v.name === 'data_od')) {
          auto[v.name] = today;
        }
      });
      setValues(auto);
      setDocName(selectedTemplate.name + ' - ' + new Date().toLocaleDateString('pl-PL'));
    }
  }, [selectedTemplate]);

  const allRequiredFilled = () => {
    if (!selectedTemplate) return false;
    return selectedTemplate.variables
      .filter(v => v.required)
      .every(v => values[v.name]?.trim());
  };

  const handleSave = async () => {
    if (!selectedTemplate || !currentUser) return;
    setSaving(true);
    setError('');
    try {
      const filledContent = selectedTemplate.content.replace(/\{\{([^}]+)\}\}/g, (_, key) => values[key] || '');

      const { data, error: err } = await supabase
        .from('document_instances')
        .insert({
          company_id: currentUser.company_id,
          name: docName || selectedTemplate.name,
          content: filledContent,
          status: 'draft',
          variables_values: values,
          created_by: currentUser.id,
        })
        .select()
        .single();

      if (err) throw err;

      // Save initial version
      await supabase.from('document_versions').insert({
        document_id: data.id,
        version_number: 1,
        content: filledContent,
        changed_by: currentUser.id,
        change_type: 'edit',
        change_notes: 'Wersja początkowa',
      });

      onCreated(data.id);
    } catch (e: any) {
      setError(e.message || 'Błąd zapisu dokumentu');
    } finally {
      setSaving(false);
    }
  };

  // GROUP templates by category
  const grouped = BUILTIN_TEMPLATES.reduce<Record<string, BuiltinTemplate[]>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {step !== 'select' && (
              <button onClick={() => setStep(step === 'preview' ? 'fill' : 'select')} className="p-1 hover:bg-slate-100 rounded">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
            )}
            <h2 className="text-lg font-semibold text-slate-900">
              {step === 'select' && 'Wybierz szablon dokumentu'}
              {step === 'fill' && `Wypełnij: ${selectedTemplate?.name}`}
              {step === 'preview' && 'Podgląd dokumentu'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-4">
          {['select', 'fill', 'preview'].map((s, i) => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-2 text-sm ${step === s ? 'text-blue-600 font-medium' : i < ['select','fill','preview'].indexOf(step) ? 'text-green-600' : 'text-slate-400'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                  ${step === s ? 'bg-blue-600 text-white' : i < ['select','fill','preview'].indexOf(step) ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  {i < ['select','fill','preview'].indexOf(step) ? '✓' : i + 1}
                </div>
                {s === 'select' ? 'Szablon' : s === 'fill' ? 'Dane' : 'Podgląd'}
              </div>
              {i < 2 && <ChevronRight className="w-4 h-4 text-slate-300" />}
            </React.Fragment>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* STEP 1: Select template */}
          {step === 'select' && (
            <div className="p-6 space-y-6">
              {Object.entries(grouped).map(([category, templates]) => (
                <div key={category}>
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mb-3 ${CATEGORY_COLORS[category] || 'bg-slate-100 text-slate-700'}`}>
                    {category}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {templates.map(template => (
                      <button
                        key={template.id}
                        onClick={() => { setSelectedTemplate(template); setStep('fill'); }}
                        className="text-left p-4 border border-slate-200 rounded-xl hover:border-blue-400 hover:shadow-md transition-all group"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100">
                            <FileText className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">{template.name}</p>
                            <p className="text-xs text-slate-500 mt-1">{template.description}</p>
                            <p className="text-xs text-slate-400 mt-2">{template.variables.length} zmiennych do wypełnienia</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* STEP 2: Fill variables */}
          {step === 'fill' && selectedTemplate && (
            <div className="p-6 space-y-6">
              {/* Document name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa dokumentu *</label>
                <input
                  type="text"
                  value={docName}
                  onChange={e => setDocName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder={selectedTemplate.name}
                />
              </div>

              {/* Variables */}
              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-3">Zmienne dokumentu</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedTemplate.variables.map(v => (
                    <div key={v.name}>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        {v.label} {v.required && <span className="text-red-500">*</span>}
                      </label>
                      {v.type === 'textarea' ? (
                        <textarea
                          value={values[v.name] || ''}
                          onChange={e => setValues({ ...values, [v.name]: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                          placeholder={`Wprowadź ${v.label.toLowerCase()}...`}
                        />
                      ) : (
                        <input
                          type={v.type === 'date' ? 'date' : v.type === 'number' ? 'number' : 'text'}
                          value={values[v.name] || ''}
                          onChange={e => setValues({ ...values, [v.name]: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder={v.type === 'number' ? '0.00' : `Wprowadź ${v.label.toLowerCase()}...`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Preview */}
          {step === 'preview' && selectedTemplate && (
            <div className="p-6">
              <div
                className="border border-slate-200 rounded-xl p-8 bg-white shadow-sm"
                dangerouslySetInnerHTML={{ __html: fillTemplate(selectedTemplate.content, values) }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex justify-between items-center">
          <div className="text-sm text-slate-500">
            {step === 'fill' && selectedTemplate && (
              <>
                {selectedTemplate.variables.filter(v => v.required && !values[v.name]).length > 0
                  ? `Brakuje ${selectedTemplate.variables.filter(v => v.required && !values[v.name]).length} wymaganych pól`
                  : <span className="text-green-600 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Wszystkie pola wypełnione</span>
                }
              </>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Anuluj
            </button>
            {step === 'fill' && (
              <button
                onClick={() => setStep('preview')}
                disabled={!allRequiredFilled() || !docName.trim()}
                className="flex items-center gap-2 px-4 py-2 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50"
              >
                <Eye className="w-4 h-4" />
                Podgląd
              </button>
            )}
            {(step === 'fill' || step === 'preview') && (
              <button
                onClick={handleSave}
                disabled={!allRequiredFilled() || !docName.trim() || saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Utwórz dokument
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
