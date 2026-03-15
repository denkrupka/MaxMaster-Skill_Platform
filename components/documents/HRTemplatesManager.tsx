import React, { useState } from 'react';
import { FileText, Plus, Edit, Trash2, Send, X, Save, Copy } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { t } from '../../lib/i18n';

export interface HRTemplate {
  id: string;
  name: string;
  type: 'employment_contract' | 'nda' | 'custom';
  content: string;
  fields: TemplateField[];
  created_at: string;
  updated_at?: string;
  company_id?: string;
}

export interface TemplateField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'date' | 'number' | 'select';
  required: boolean;
  options?: string[];
  defaultValue?: string;
}

interface HRTemplatesManagerProps {
  onSendForSigning?: (template: HRTemplate, filledData: Record<string, any>) => void;
}

// Predefined templates
const DEFAULT_TEMPLATES: HRTemplate[] = [
  {
    id: 'template-employment-contract',
    name: 'Umowa o pracę',
    type: 'employment_contract',
    content: `UMOWA O PRACĘ

Zawarta w dniu {{contract_date}} pomiędzy:
{{employer_name}}, z siedzibą w {{employer_city}}, ul. {{employer_street}} {{employer_building}},
reprezentowanym przez: {{employer_representative}},
zwaną dalej Pracodawcą,

a

{{employee_first_name}} {{employee_last_name}}, zamieszkałym/ą w {{employee_city}}, ul. {{employee_street}} {{employee_building}},
obywatelstwo: {{employee_citizenship}}, PESEL: {{employee_pesel}},
zwaną dalej Pracownikiem,

o następującej treści:

§ 1
Pracownik zobowiązuje się świadczyć pracę na stanowisku: {{position_name}}.
Miejsce świadczenia pracy: {{work_place}}.

§ 2
1. Pracownik zatrudniony jest na podstawie umowy o pracę w wymiarze {{work_hours}} godzin tygodniowo.
2. Wynagrodzenie brutto: {{salary_gross}} zł {{salary_period}}.
3. Data rozpoczęcia pracy: {{start_date}}.
4. Data zakończenia pracy: {{end_date}}.

§ 3
W sprawach nieuregulowanych niniejszą umową zastosowanie mają przepisy Kodeksu pracy.

Podpisy:

Pracodawca: _____________________

Pracownik: _____________________`,
    fields: [
      { id: 'contract_date', name: 'contract_date', label: 'Data zawarcia umowy', type: 'date', required: true },
      { id: 'employer_name', name: 'employer_name', label: 'Nazwa pracodawcy', type: 'text', required: true, defaultValue: 'MaxMaster Sp. z o.o.' },
      { id: 'employer_city', name: 'employer_city', label: 'Miasto (pracodawca)', type: 'text', required: true },
      { id: 'employer_street', name: 'employer_street', label: 'Ulica (pracodawca)', type: 'text', required: true },
      { id: 'employer_building', name: 'employer_building', label: 'Nr budynku (pracodawca)', type: 'text', required: true },
      { id: 'employer_representative', name: 'employer_representative', label: 'Reprezentant pracodawcy', type: 'text', required: true },
      { id: 'employee_first_name', name: 'employee_first_name', label: 'Imię pracownika', type: 'text', required: true },
      { id: 'employee_last_name', name: 'employee_last_name', label: 'Nazwisko pracownika', type: 'text', required: true },
      { id: 'employee_city', name: 'employee_city', label: 'Miasto (pracownik)', type: 'text', required: true },
      { id: 'employee_street', name: 'employee_street', label: 'Ulica (pracownik)', type: 'text', required: true },
      { id: 'employee_building', name: 'employee_building', label: 'Nr budynku (pracownik)', type: 'text', required: true },
      { id: 'employee_citizenship', name: 'employee_citizenship', label: 'Obywatelstwo', type: 'text', required: true },
      { id: 'employee_pesel', name: 'employee_pesel', label: 'PESEL', type: 'text', required: true },
      { id: 'position_name', name: 'position_name', label: 'Stanowisko', type: 'text', required: true },
      { id: 'work_place', name: 'work_place', label: 'Miejsce pracy', type: 'text', required: true },
      { id: 'work_hours', name: 'work_hours', label: 'Godziny tygodniowo', type: 'number', required: true, defaultValue: '40' },
      { id: 'salary_gross', name: 'salary_gross', label: 'Wynagrodzenie brutto (zł)', type: 'number', required: true },
      { id: 'salary_period', name: 'salary_period', label: 'Okres wypłaty', type: 'select', required: true, options: ['miesięcznie', 'godzinowo', 'tygodniowo'], defaultValue: 'miesięcznie' },
      { id: 'start_date', name: 'start_date', label: 'Data rozpoczęcia', type: 'date', required: true },
      { id: 'end_date', name: 'end_date', label: 'Data zakończenia', type: 'date', required: false },
    ],
    created_at: new Date().toISOString(),
  },
  {
    id: 'template-nda',
    name: 'NDA - Umowa o poufności',
    type: 'nda',
    content: `UMOWA O ZACHOWANIU POUFNOŚCI (NDA)

Zawarta w dniu {{contract_date}} pomiędzy:
{{company_name}}, z siedzibą w {{company_city}},
zwaną dalej Zleceniodawcą,

a

{{employee_first_name}} {{employee_last_name}},
zwaną dalej Zleceniobiorcą,

§ 1
Zleceniobiorca zobowiązuje się do zachowania w tajemnicy wszelkich informacji poufnych uzyskanych w związku z wykonywaniem obowiązków służbowych.

§ 2
Za informacje poufne uważa się:
- Dane techniczne i technologiczne
- Dane klientów i kontrahentów
- Strategie i plany biznesowe
- Informacje o pracownikach

§ 3
Zakaz ujawniania informacji poufnych obowiązuje przez okres {{confidentiality_years}} lat od zakończenia współpracy.

Podpisy:

Zleceniodawca: _____________________

Zleceniobiorca: _____________________`,
    fields: [
      { id: 'contract_date', name: 'contract_date', label: 'Data zawarcia', type: 'date', required: true },
      { id: 'company_name', name: 'company_name', label: 'Nazwa firmy', type: 'text', required: true, defaultValue: 'MaxMaster Sp. z o.o.' },
      { id: 'company_city', name: 'company_city', label: 'Miasto firmy', type: 'text', required: true },
      { id: 'employee_first_name', name: 'employee_first_name', label: 'Imię', type: 'text', required: true },
      { id: 'employee_last_name', name: 'employee_last_name', label: 'Nazwisko', type: 'text', required: true },
      { id: 'confidentiality_years', name: 'confidentiality_years', label: 'Lata poufności', type: 'number', required: true, defaultValue: '3' },
    ],
    created_at: new Date().toISOString(),
  },
];

export const HRTemplatesManager: React.FC<HRTemplatesManagerProps> = ({ onSendForSigning }) => {
  const { state } = useAppContext();
  const { language, currentCompany } = state;
  
  const [templates, setTemplates] = useState<HRTemplate[]>(() => {
    const saved = localStorage.getItem(`hr_templates_${currentCompany?.id || 'default'}`);
    return saved ? [...DEFAULT_TEMPLATES, ...JSON.parse(saved)] : DEFAULT_TEMPLATES;
  });
  
  const [selectedTemplate, setSelectedTemplate] = useState<HRTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isFilling, setIsFilling] = useState(false);
  const [filledData, setFilledData] = useState<Record<string, any>>({});
  const [previewContent, setPreviewContent] = useState('');

  // Form states for creating/editing
  const [editForm, setEditForm] = useState<Partial<HRTemplate>>({
    name: '',
    type: 'custom',
    content: '',
    fields: [],
  });
  const [newField, setNewField] = useState<Partial<TemplateField>>({
    name: '',
    label: '',
    type: 'text',
    required: true,
  });

  const saveTemplates = (newTemplates: HRTemplate[]) => {
    const customTemplates = newTemplates.filter(t => !t.id.startsWith('template-'));
    localStorage.setItem(`hr_templates_${currentCompany?.id || 'default'}`, JSON.stringify(customTemplates));
    setTemplates(newTemplates);
  };

  const handleCreateTemplate = () => {
    const template: HRTemplate = {
      id: `template-${Date.now()}`,
      name: editForm.name || 'Nowy szablon',
      type: editForm.type as HRTemplate['type'] || 'custom',
      content: editForm.content || '',
      fields: editForm.fields || [],
      created_at: new Date().toISOString(),
      company_id: currentCompany?.id,
    };
    saveTemplates([...templates, template]);
    setIsEditing(false);
    setEditForm({ name: '', type: 'custom', content: '', fields: [] });
  };

  const handleUpdateTemplate = () => {
    if (!selectedTemplate) return;
    const updated = templates.map(t => 
      t.id === selectedTemplate.id 
        ? { ...t, ...editForm, updated_at: new Date().toISOString() }
        : t
    );
    saveTemplates(updated);
    setIsEditing(false);
    setSelectedTemplate(null);
    setEditForm({ name: '', type: 'custom', content: '', fields: [] });
  };

  const handleDeleteTemplate = (id: string) => {
    if (confirm('Czy na pewno chcesz usunąć ten szablon?')) {
      saveTemplates(templates.filter(t => t.id !== id));
      if (selectedTemplate?.id === id) {
        setSelectedTemplate(null);
      }
    }
  };

  const handleDuplicateTemplate = (template: HRTemplate) => {
    const duplicated: HRTemplate = {
      ...template,
      id: `template-${Date.now()}`,
      name: `${template.name} (kopia)`,
      created_at: new Date().toISOString(),
    };
    saveTemplates([...templates, duplicated]);
  };

  const addField = () => {
    if (!newField.name || !newField.label) return;
    const field: TemplateField = {
      id: `field-${Date.now()}`,
      name: newField.name,
      label: newField.label,
      type: newField.type as TemplateField['type'] || 'text',
      required: newField.required ?? true,
      options: newField.options,
      defaultValue: newField.defaultValue,
    };
    setEditForm(prev => ({
      ...prev,
      fields: [...(prev.fields || []), field],
    }));
    setNewField({ name: '', label: '', type: 'text', required: true });
  };

  const removeField = (fieldId: string) => {
    setEditForm(prev => ({
      ...prev,
      fields: (prev.fields || []).filter(f => f.id !== fieldId),
    }));
  };

  const generatePreview = (template: HRTemplate, data: Record<string, any>) => {
    let content = template.content;
    template.fields.forEach(field => {
      const value = data[field.name] || field.defaultValue || `{{${field.name}}}`;
      content = content.replace(new RegExp(`{{${field.name}}}`, 'g'), value);
    });
    return content;
  };

  const handleFillAndPreview = (template: HRTemplate) => {
    setSelectedTemplate(template);
    setIsFilling(true);
    const initialData: Record<string, any> = {};
    template.fields.forEach(field => {
      initialData[field.name] = field.defaultValue || '';
    });
    setFilledData(initialData);
    setPreviewContent(generatePreview(template, initialData));
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    const newData = { ...filledData, [fieldName]: value };
    setFilledData(newData);
    if (selectedTemplate) {
      setPreviewContent(generatePreview(selectedTemplate, newData));
    }
  };

  const handleSendForSigning = () => {
    if (selectedTemplate && onSendForSigning) {
      onSendForSigning(selectedTemplate, filledData);
    }
    setIsFilling(false);
    setSelectedTemplate(null);
    setFilledData({});
  };

  const startEditing = (template?: HRTemplate) => {
    if (template) {
      setSelectedTemplate(template);
      setEditForm({
        name: template.name,
        type: template.type,
        content: template.content,
        fields: [...template.fields],
      });
    } else {
      setSelectedTemplate(null);
      setEditForm({ name: '', type: 'custom', content: '', fields: [] });
    }
    setIsEditing(true);
  };

  if (isFilling && selectedTemplate) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">{selectedTemplate.name}</h3>
          <button onClick={() => setIsFilling(false)} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
          {/* Form */}
          <div className="p-4 border-r border-slate-200">
            <h4 className="font-medium text-slate-700 mb-4">Wypełnij pola</h4>
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {selectedTemplate.fields.map(field => (
                <div key={field.id}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      value={filledData[field.name] || ''}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">Wybierz...</option>
                      {field.options?.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : field.type === 'date' ? (
                    <input
                      type="date"
                      value={filledData[field.name] || ''}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  ) : field.type === 'number' ? (
                    <input
                      type="number"
                      value={filledData[field.name] || ''}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  ) : (
                    <input
                      type="text"
                      value={filledData[field.name] || ''}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  )}
                </div>
              ))}
            </div>
            
            <div className="mt-6 flex gap-2">
              <Button onClick={handleSendForSigning} className="flex-1">
                <Send size={16} className="mr-2" />
                Wyślij do podpisu
              </Button>
            </div>
          </div>
          
          {/* Preview */}
          <div className="p-4 bg-slate-50">
            <h4 className="font-medium text-slate-700 mb-4">Podgląd</h4>
            <div className="bg-white border border-slate-200 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap h-[600px] overflow-y-auto">
              {previewContent}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">
            {selectedTemplate ? 'Edytuj szablon' : 'Nowy szablon'}
          </h3>
          <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa szablonu</label>
              <input
                type="text"
                value={editForm.name || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Np. Umowa o pracę"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Typ</label>
              <select
                value={editForm.type}
                onChange={(e) => setEditForm(prev => ({ ...prev, type: e.target.value as HRTemplate['type'] }))}
                className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="employment_contract">Umowa o pracę</option>
                <option value="nda">NDA</option>
                <option value="custom">Własny</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Treść szablonu</label>
            <p className="text-xs text-slate-500 mb-2">Użyj {{nazwa_pola}} dla pól do wypełnienia</p>
            <textarea
              value={editForm.content || ''}
              onChange={(e) => setEditForm(prev => ({ ...prev, content: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
              rows={10}
              placeholder="Treść dokumentu..."
            />
          </div>
          
          <div className="border-t border-slate-200 pt-4">
            <h4 className="font-medium text-slate-700 mb-3">Pola formularza</h4>
            
            <div className="space-y-2 mb-4">
              {(editForm.fields || []).map(field => (
                <div key={field.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                  <span className="font-medium text-sm flex-1">{field.label}</span>
                  <span className="text-xs text-slate-500">{field.name}</span>
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">{field.type}</span>
                  {field.required && <span className="text-xs text-red-500">*</span>}
                  <button onClick={() => removeField(field.id)} className="text-red-500 hover:text-red-700">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 p-3 bg-slate-50 rounded-lg">
              <input
                type="text"
                value={newField.name || ''}
                onChange={(e) => setNewField(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nazwa pola (np. first_name)"
                className="border border-slate-300 rounded p-2 text-sm"
              />
              <input
                type="text"
                value={newField.label || ''}
                onChange={(e) => setNewField(prev => ({ ...prev, label: e.target.value }))}
                placeholder="Etykieta"
                className="border border-slate-300 rounded p-2 text-sm"
              />
              <select
                value={newField.type}
                onChange={(e) => setNewField(prev => ({ ...prev, type: e.target.value as TemplateField['type'] }))}
                className="border border-slate-300 rounded p-2 text-sm"
              >
                <option value="text">Tekst</option>
                <option value="date">Data</option>
                <option value="number">Liczba</option>
                <option value="select">Wybór</option>
              </select>
              <button onClick={addField} className="bg-blue-600 text-white rounded p-2 text-sm hover:bg-blue-700">
                <Plus size={16} className="inline mr-1" />
                Dodaj
              </button>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button variant="ghost" onClick={() => setIsEditing(false)}>Anuluj</Button>
            <Button onClick={selectedTemplate ? handleUpdateTemplate : handleCreateTemplate}>
              <Save size={16} className="mr-2" />
              {selectedTemplate ? 'Zapisz zmiany' : 'Utwórz szablon'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-slate-900">{t(language, 'templates.title')}</h3>
        <Button size="sm" onClick={() => startEditing()}>
          <Plus size={16} className="mr-2" />
          {t(language, 'templates.createTemplate')}
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(template => (
          <div key={template.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText size={20} className="text-blue-600" />
                <h4 className="font-medium text-slate-900">{template.name}</h4>
              </div>
              {!template.id.startsWith('template-') && (
                <div className="flex gap-1">
                  <button 
                    onClick={() => startEditing(template)}
                    className="p-1 text-slate-400 hover:text-blue-600"
                  >
                    <Edit size={16} />
                  </button>
                  <button 
                    onClick={() => handleDeleteTemplate(template.id)}
                    className="p-1 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
            
            <p className="text-sm text-slate-500 mb-3">
              {template.fields.length} pól • 
              {template.type === 'employment_contract' ? ' Umowa o pracę' : 
               template.type === 'nda' ? ' NDA' : ' Własny'}
            </p>
            
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1"
                onClick={() => handleFillAndPreview(template)}
              >
                <Send size={14} className="mr-1" />
                {t(language, 'templates.fillAndSend')}
              </Button>
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => handleDuplicateTemplate(template)}
              >
                <Copy size={14} />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HRTemplatesManager;
