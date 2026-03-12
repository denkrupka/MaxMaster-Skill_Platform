import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, ChevronRight, X, Building2, UserPlus, FolderPlus, Puzzle, PartyPopper, Loader2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { supabase } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

type StepKey = 'dane_firmy' | 'pracownik' | 'projekt' | 'moduly' | 'gotowe';

interface StepConfig {
  key: StepKey;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}

const STEPS: StepConfig[] = [
  {
    key: 'dane_firmy',
    title: 'Dane firmy',
    subtitle: 'Uzupełnij podstawowe informacje o firmie',
    icon: <Building2 className="w-6 h-6" />,
  },
  {
    key: 'pracownik',
    title: 'Pierwszy pracownik',
    subtitle: 'Dodaj pierwszego członka zespołu',
    icon: <UserPlus className="w-6 h-6" />,
  },
  {
    key: 'projekt',
    title: 'Pierwszy projekt',
    subtitle: 'Stwórz swój pierwszy projekt',
    icon: <FolderPlus className="w-6 h-6" />,
  },
  {
    key: 'moduly',
    title: 'Wybierz moduły',
    subtitle: 'Aktywuj funkcje potrzebne Twojej firmie',
    icon: <Puzzle className="w-6 h-6" />,
  },
  {
    key: 'gotowe',
    title: 'Gotowe!',
    subtitle: 'Twoja firma jest skonfigurowana',
    icon: <PartyPopper className="w-6 h-6" />,
  },
];

// ---------------------------------------------------------------------------
// Onboarding form data
// ---------------------------------------------------------------------------

interface OnboardingData {
  // Step 1 — company
  industry: string;
  phone: string;
  city: string;
  // Step 2 — employee
  empFirstName: string;
  empLastName: string;
  empEmail: string;
  empPosition: string;
  // Step 3 — project
  projectName: string;
  projectDescription: string;
  // Step 4 — modules (checkboxes)
  selectedModules: string[];
}

const AVAILABLE_MODULES = [
  { code: 'hr', label: 'HR & Pracownicy', description: 'Zarządzanie zatrudnieniem, urlopy, grafiki' },
  { code: 'projects', label: 'Projekty', description: 'Planowanie, zadania, harmonogramy' },
  { code: 'finance', label: 'Finanse', description: 'Faktury, kosztorysy, budżety' },
  { code: 'crm', label: 'CRM', description: 'Klienci, kontrahenci, oferty' },
  { code: 'construction', label: 'Budownictwo', description: 'Dzienniki budowy, dokumentacja' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface OnboardingWizardProps {
  onClose?: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onClose }) => {
  const { state, updateCompany, triggerNotification } = useAppContext();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    industry: state.currentCompany?.industry || '',
    phone: state.currentCompany?.phone || state.currentCompany?.contact_phone || '',
    city: state.currentCompany?.city || state.currentCompany?.address_city || '',
    empFirstName: '',
    empLastName: '',
    empEmail: '',
    empPosition: '',
    projectName: '',
    projectDescription: '',
    selectedModules: [],
  });

  const totalSteps = STEPS.length;
  const progress = ((currentStep) / (totalSteps - 1)) * 100;

  const step = STEPS[currentStep];

  const updateData = (patch: Partial<OnboardingData>) =>
    setData(prev => ({ ...prev, ...patch }));

  const toggleModule = (code: string) => {
    setData(prev => ({
      ...prev,
      selectedModules: prev.selectedModules.includes(code)
        ? prev.selectedModules.filter(m => m !== code)
        : [...prev.selectedModules, code],
    }));
  };

  // -------------------------------------------------------------------------
  // Skip / Finish
  // -------------------------------------------------------------------------

  const markComplete = async () => {
    if (!state.currentCompany) return;
    try {
      await updateCompany(state.currentCompany.id, { onboarding_completed: true });
    } catch (e) {
      console.warn('Could not mark onboarding as complete:', e);
      // Fallback: direct update
      await supabase
        .from('companies')
        .update({ onboarding_completed: true })
        .eq('id', state.currentCompany.id);
    }
  };

  const handleSkip = async () => {
    setSkipping(true);
    // Save skip state to localStorage so we don't re-show
    const companyId = state.currentCompany?.id;
    if (companyId) {
      localStorage.setItem(`onboarding_skipped_${companyId}`, 'true');
    }
    await markComplete();
    setSkipping(false);
    navigate('/dashboard');
    onClose?.();
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      // Step 1: save company data
      if (state.currentCompany) {
        const companyUpdates: Record<string, string> = {};
        if (data.industry) companyUpdates.industry = data.industry;
        if (data.phone) companyUpdates.contact_phone = data.phone;
        if (data.city) companyUpdates.city = data.city;
        if (Object.keys(companyUpdates).length) {
          await updateCompany(state.currentCompany.id, companyUpdates as any);
        }
      }

      // Step 2: create employee invitation if provided
      if (data.empEmail && data.empFirstName && state.currentCompany) {
        try {
          await supabase.functions.invoke('create-user-admin', {
            body: {
              email: data.empEmail,
              first_name: data.empFirstName,
              last_name: data.empLastName,
              position: data.empPosition || 'Pracownik',
              role: 'employee',
              company_id: state.currentCompany.id,
              send_invitation: true,
            },
          });
        } catch (e) {
          console.warn('Could not create employee (non-fatal):', e);
        }
      }

      // Step 3: create project if provided
      if (data.projectName && state.currentCompany) {
        try {
          await supabase.from('projects').insert([{
            name: data.projectName,
            description: data.projectDescription || null,
            company_id: state.currentCompany.id,
            status: 'active',
            created_by: state.currentUser?.id,
          }]);
        } catch (e) {
          console.warn('Could not create project (non-fatal):', e);
        }
      }

      // Mark onboarding complete
      await markComplete();

      triggerNotification('success', 'Konfiguracja zakończona!', 'Twoja firma jest gotowa do pracy.');
      navigate('/dashboard');
      onClose?.();
    } catch (err) {
      console.error('Onboarding finish error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(s => s + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(s => s - 1);
  };

  // -------------------------------------------------------------------------
  // Step renderers
  // -------------------------------------------------------------------------

  const renderStepContent = () => {
    switch (step.key) {
      case 'dane_firmy':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Branża</label>
              <input
                type="text"
                value={data.industry}
                onChange={e => updateData({ industry: e.target.value })}
                placeholder="np. Budownictwo, IT, Handel"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Telefon firmowy</label>
              <input
                type="tel"
                value={data.phone}
                onChange={e => updateData({ phone: e.target.value })}
                placeholder="+48 000 000 000"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Miasto siedziby</label>
              <input
                type="text"
                value={data.city}
                onChange={e => updateData({ city: e.target.value })}
                placeholder="np. Warszawa"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        );

      case 'pracownik':
        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Opcjonalnie — możesz pominąć ten krok</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Imię</label>
                <input
                  type="text"
                  value={data.empFirstName}
                  onChange={e => updateData({ empFirstName: e.target.value })}
                  placeholder="Jan"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwisko</label>
                <input
                  type="text"
                  value={data.empLastName}
                  onChange={e => updateData({ empLastName: e.target.value })}
                  placeholder="Kowalski"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email pracownika</label>
              <input
                type="email"
                value={data.empEmail}
                onChange={e => updateData({ empEmail: e.target.value })}
                placeholder="jan.kowalski@firma.pl"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Stanowisko</label>
              <input
                type="text"
                value={data.empPosition}
                onChange={e => updateData({ empPosition: e.target.value })}
                placeholder="np. Kierownik budowy"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        );

      case 'projekt':
        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Opcjonalnie — możesz pominąć ten krok</p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa projektu</label>
              <input
                type="text"
                value={data.projectName}
                onChange={e => updateData({ projectName: e.target.value })}
                placeholder="np. Remont biura 2026"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Opis (opcjonalnie)</label>
              <textarea
                value={data.projectDescription}
                onChange={e => updateData({ projectDescription: e.target.value })}
                rows={3}
                placeholder="Krótki opis projektu..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          </div>
        );

      case 'moduly':
        return (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Wybierz moduły, które chcesz aktywować (możesz zmienić później)</p>
            {AVAILABLE_MODULES.map(mod => (
              <label
                key={mod.code}
                className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                  data.selectedModules.includes(mod.code)
                    ? 'bg-blue-50 border-blue-300'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={data.selectedModules.includes(mod.code)}
                  onChange={() => toggleModule(mod.code)}
                  className="mt-0.5 w-4 h-4 text-blue-600 rounded"
                />
                <div>
                  <div className="font-medium text-slate-900 text-sm">{mod.label}</div>
                  <div className="text-xs text-slate-500">{mod.description}</div>
                </div>
              </label>
            ))}
          </div>
        );

      case 'gotowe':
        return (
          <div className="text-center py-4">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <PartyPopper className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Wszystko gotowe!</h3>
            <p className="text-slate-500 mb-4">
              Twoja firma jest w pełni skonfigurowana. Czas zacząć pracę!
            </p>
            {state.currentCompany?.bonus_months ? (
              <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-sm text-green-700 font-medium">
                🎁 Masz <strong>{state.currentCompany.bonus_months} mies. bonus</strong> dzięki poleceniu!
              </div>
            ) : null}
          </div>
        );

      default:
        return null;
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  // Escape key to skip
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSkip();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative overflow-hidden">
        {/* Progress bar */}
        <div className="h-1.5 bg-slate-100 w-full">
          <div
            className="h-full bg-blue-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            Krok {currentStep + 1} z {totalSteps}
          </div>
          <button
            onClick={handleSkip}
            disabled={skipping}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            {skipping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
            Pomiń
          </button>
        </div>

        {/* Step indicator dots */}
        <div className="flex items-center justify-center gap-2 px-6 mb-4">
          {STEPS.map((s, idx) => (
            <button
              key={s.key}
              onClick={() => setCurrentStep(idx)}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                idx === currentStep
                  ? 'bg-blue-600 w-6'
                  : idx < currentStep
                  ? 'bg-blue-300'
                  : 'bg-slate-200'
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="px-6 pb-4">
          {/* Step header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
              {step.icon}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{step.title}</h2>
              <p className="text-sm text-slate-500">{step.subtitle}</p>
            </div>
          </div>

          {renderStepContent()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-100">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-0 transition-colors"
          >
            ← Wstecz
          </button>

          {currentStep < totalSteps - 1 ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Dalej
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-70 transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Zakończ konfigurację
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
