import React, { useState, useEffect } from 'react';
import {
  X, ChevronRight, FileText, Eye, Edit3, Save, Loader2,
  AlertCircle, CheckCircle, ArrowLeft, User, Building2, Briefcase
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
  result = result.replace(/\{\{([^}]+)\}\}/g, `<span style="color:#ef4444; background:#fee2e2; padding:0 4px; border-radius:3px;">{{$1}}</span>`);
  return result;
}

export const DocumentTemplateEditor: React.FC<Props> = ({ onClose, onCreated, initialTemplateId }) => {
  const { state } = useAppContext();
  const { currentUser, users } = state;

  const [step, setStep] = useState<'select' | 'fill' | 'preview'>(initialTemplateId ? 'fill' : 'select');
  const [selectedTemplate, setSelectedTemplate] = useState<BuiltinTemplate | null>(
    initialTemplateId ? BUILTIN_TEMPLATES.find(t => t.id === initialTemplateId) || null : null
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [docName, setDocName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Employee & project selectors for auto-fill
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [projects, setProjects] = useState<{ id: string; name: string; code?: string }[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [contractors, setContractors] = useState<{ id: string; name: string; nip?: string; address?: string }[]>([]);
  const [selectedContractor, setSelectedContractor] = useState<string>('');

  const isHRTemplate = selectedTemplate?.id === 'umowa_o_prace' || selectedTemplate?.id === 'umowa_zlecenie' || selectedTemplate?.id === 'umowa_o_dzielo';
  const isProjectTemplate = selectedTemplate?.id === 'protokol_odbioru' || selectedTemplate?.id === 'protokol_przekazania';

  // Load company data for auto-fill
  useEffect(() => {
    if (currentUser) {
      loadProjects();
      loadContractors();
    }
  }, [currentUser]);

  const loadProjects = async () => {
    if (!currentUser) return;
    const { data } = await supabase
      .from('projects')
      .select('id, name, code')
      .eq('company_id', currentUser.company_id)
      .order('name');
    if (data) setProjects(data);
  };

  const loadContractors = async () => {
    if (!currentUser) return;
    const { data } = await supabase
      .from('contractors')
      .select('id, name, nip, address')
      .eq('company_id', currentUser.company_id)
      .order('name');
    if (data) setContractors(data);
  };

  // Pre-fill from company data
  useEffect(() => {
    if (selectedTemplate && currentUser) {
      const auto: Record<string, string> = {};
      const today = new Date().toISOString().split('T')[0];
      
      selectedTemplate.variables.forEach(v => {
        if (v.type === 'date' && (v.name === 'data' || v.name === 'data_od')) {
          auto[v.name] = today;
        }
      });

      // Auto-fill company data
      if (selectedTemplate.variables.some(v => v.name === 'firma_nazwa')) {
        // Load company info
        supabase.from('companies').select('name, nip, address').eq('id', currentUser.company_id).single().then(({ data }) => {
          if (data) {
            setValues(prev => ({
              ...prev,
              firma_nazwa: data.name || '',
              firma_nip: data.nip || '',
              firma_adres: data.address || '',
            }));
          }
        });
      }

      setValues(auto);
      setDocName(selectedTemplate.name + ' - ' + new Date().toLocaleDateString('pl-PL'));
    }
  }, [selectedTemplate]);

  // Auto-fill from employee
  useEffect(() => {
    if (!selectedEmployee || !selectedTemplate) return;
    const emp = users.find(u => u.id === selectedEmployee);
    if (!emp) return;

    const empFills: Record<string, string> = {};
    selectedTemplate.variables.forEach(v => {
      if (v.name === 'pracownik_imie_nazwisko' || v.name === 'kontrahent_nazwa') {
        empFills[v.name] = `${emp.first_name} ${emp.last_name}`;
      }
      if (v.name === 'pracownik_pesel' || v.name === 'kontrahent_pesel') {
        empFills[v.name] = emp.pesel || '';
      }
      if (v.name === 'pracownik_adres' || v.name === 'kontrahent_adres') {
        empFills[v.name] = '';
      }
      if (v.name === 'stanowisko') {
        empFills[v.name] = emp.target_position || '';
      }
      if (v.name === 'wynagrodzenie' || v.name === 'stawka_godzinowa') {
        empFills[v.name] = emp.base_rate ? String(emp.base_rate) : '';
      }
      if (v.name === 'data_od') {
        empFills[v.name] = emp.hired_date || new Date().toISOString().split('T')[0];
      }
      if (v.name === 'data_do' && emp.contract_end_date) {
        empFills[v.name] = emp.contract_end_date;
      }
      if (v.name === 'rodzaj_umowy') {
        empFills[v.name] = emp.contract_type === 'full_time' ? 'czas nieokreślony' : 
          emp.contract_end_date ? 'czas określony' : 'czas nieokreślony';
      }
      if (v.name === 'wymiar_czasu') {
        empFills[v.name] = emp.contract_type === 'part_time' ? '1/2 etatu' : 'pełny etat (8h/dobę, 40h/tydzień)';
      }
    });
    setValues(prev => ({ ...prev, ...empFills }));
  }, [selectedEmployee]);

  // Auto-fill from project
  useEffect(() => {
    if (!selectedProject || !selectedTemplate) return;
    const proj = projects.find(p => p.id === selectedProject);
    if (!proj) return;

    supabase.from('projects').select('*, address, city').eq('id', selectedProject).single().then(({ data: projData }) => {
      if (!projData) return;
      const projFills: Record<string, string> = {};
      selectedTemplate.variables.forEach(v => {
        if (v.name === 'nazwa_inwestycji' || v.name === 'nazwa_projektu') {
          projFills[v.name] = projData.name;
        }
        if (v.name === 'adres_inwestycji' || v.name === 'miejsce_pracy' || v.name === 'miejsce' || v.name === 'adres_obiektu') {
          projFills[v.name] = projData.address || projData.city || '';
        }
        if (v.name === 'nr_projektu' || v.name === 'nr_umowy') {
          projFills[v.name] = projData.code || '';
        }
        if (v.name === 'opis_robot' && !projFills[v.name]) {
          projFills[v.name] = `Roboty budowlane na obiekcie ${projData.name || ''}`.trim();
        }
      });
      setValues(prev => ({ ...prev, ...projFills }));
    });
  }, [selectedProject]);

  // Auto-fill from contractor
  useEffect(() => {
    if (!selectedContractor || !selectedTemplate) return;
    const ct = contractors.find(c => c.id === selectedContractor);
    if (!ct) return;

    const ctFills: Record<string, string> = {};
    selectedTemplate.variables.forEach(v => {
      if (v.name === 'kontrahent_nazwa' || v.name === 'wykonawca_nazwa' || v.name === 'firma_nazwa') {
        ctFills[v.name] = ct.name;
      }
      if (v.name === 'kontrahent_nip' || v.name === 'wykonawca_nip') {
        ctFills[v.name] = ct.nip || '';
      }
      if (v.name === 'kontrahent_adres' || v.name === 'wykonawca_adres') {
        ctFills[v.name] = ct.address || '';
      }
    });
    setValues(prev => ({ ...prev, ...ctFills }));
  }, [selectedContractor]);

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

  const grouped = BUILTIN_TEMPLATES.reduce<Record<string, BuiltinTemplate[]>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {});

  const employees = users.filter(u => u.status !== 'resigned' && u.status !== 'rejected');

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
                            <p className="text-xs text-slate-400 mt-2">{template.variables.length} zmiennych</p>
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

              {/* Auto-fill shortcuts */}
              <div className="space-y-3">
                {/* Employee auto-fill */}
                {isHRTemplate && employees.length > 0 && (
                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">Autouzupełnienie z danych pracownika</span>
                    </div>
                    <select
                      value={selectedEmployee}
                      onChange={e => setSelectedEmployee(e.target.value)}
                      className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="">— Wybierz pracownika —</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name} {emp.target_position ? `(${emp.target_position})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Project auto-fill */}
                {isProjectTemplate && projects.length > 0 && (
                  <div className="p-3 bg-green-50 rounded-xl border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Briefcase className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800">Autouzupełnienie z danych projektu</span>
                    </div>
                    <select
                      value={selectedProject}
                      onChange={e => setSelectedProject(e.target.value)}
                      className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-400"
                    >
                      <option value="">— Wybierz projekt —</option>
                      {projects.map(proj => (
                        <option key={proj.id} value={proj.id}>
                          {proj.name} {proj.code ? `(${proj.code})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Contractor auto-fill */}
                {contractors.length > 0 && selectedTemplate.variables.some(v => v.name.includes('kontrahent') || v.name.includes('wykonawca')) && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-medium text-amber-800">Autouzupełnienie z danych kontrahenta</span>
                    </div>
                    <select
                      value={selectedContractor}
                      onChange={e => setSelectedContractor(e.target.value)}
                      className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-400"
                    >
                      <option value="">— Wybierz kontrahenta —</option>
                      {contractors.map(ct => (
                        <option key={ct.id} value={ct.id}>
                          {ct.name} {ct.nip ? `(NIP: ${ct.nip})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
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
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm
                            ${values[v.name] ? 'border-green-300 bg-green-50' : 'border-slate-200'}`}
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
