
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Building2, Search, CheckCircle, Edit3, ArrowRight, ArrowLeft,
  User, Phone, Mail, Briefcase, Users, FileText, Loader2,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// Industry options
const INDUSTRY_OPTIONS = [
  'Budownictwo',
  'Elektroinstalacje',
  'Energetyka',
  'Przemysł',
  'Telekomunikacja',
  'IT / Technologia',
  'Transport / Logistyka',
  'Handel',
  'Usługi',
  'Produkcja',
  'Rolnictwo',
  'Górnictwo',
  'Inne'
];

const EMPLOYEE_COUNT_OPTIONS = [
  '1-5',
  '6-10',
  '11-25',
  '26-50',
  '51-100',
  '101-250',
  '251-500',
  '500+'
];

interface GUSData {
  nazwa: string;
  ulica: string;
  nrNieruchomosci: string;
  nrLokalu: string;
  kodPocztowy: string;
  miejscowosc: string;
  regon: string;
  nip: string;
}

type Step = 'welcome' | 'nip' | 'confirm' | 'personal' | 'done';

export const CompanyRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const referralCompanyId = searchParams.get('ref');

  // Step management
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // NIP step
  const [nip, setNip] = useState('');
  const [gusData, setGusData] = useState<GUSData | null>(null);
  const [editableCompanyData, setEditableCompanyData] = useState<GUSData | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Personal data step
  const [personalData, setPersonalData] = useState({
    firstName: '',
    lastName: '',
    position: '',
    phone: '+48',
    email: '',
    invoiceEmail: '',
    usesDifferentInvoiceEmail: false,
    industry: '',
    employeeCount: ''
  });
  const [personalErrors, setPersonalErrors] = useState<Record<string, string>>({});

  // Success modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  // Referral company name
  const [referralCompanyName, setReferralCompanyName] = useState<string | null>(null);

  // Load referral company name
  useEffect(() => {
    if (referralCompanyId) {
      supabase
        .from('companies')
        .select('name')
        .eq('id', referralCompanyId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setReferralCompanyName(data.name);
        });
    }
  }, [referralCompanyId]);

  // Format NIP as user types (XXX-XXX-XX-XX)
  const formatNip = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    if (digits.length <= 8) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
  };

  // Format phone number
  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    let formatted = '+48';
    if (digits.length > 2) {
      const remaining = digits.slice(2);
      if (remaining.length <= 3) formatted += ' ' + remaining;
      else if (remaining.length <= 6) formatted += ' ' + remaining.slice(0, 3) + ' ' + remaining.slice(3);
      else formatted += ' ' + remaining.slice(0, 3) + ' ' + remaining.slice(3, 6) + ' ' + remaining.slice(6, 9);
    }
    return formatted;
  };

  // Search GUS by NIP
  const handleSearchGUS = async () => {
    const cleanNip = nip.replace(/[\s-]/g, '');
    if (cleanNip.length !== 10) {
      setError('NIP musi składać się z 10 cyfr');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('search-gus', {
        body: { nip: cleanNip }
      });

      if (fnError) throw new Error('Błąd połączenia z rejestrem GUS');

      if (!data?.success || !data?.data?.found) {
        setError(data?.error || 'Firma o podanym NIP nie została znaleziona w rejestrze GUS');
        return;
      }

      setGusData(data.data);
      setEditableCompanyData(data.data);
      setCurrentStep('confirm');
    } catch (err: any) {
      setError(err.message || 'Nie udało się wyszukać firmy. Spróbuj ponownie.');
    } finally {
      setIsLoading(false);
    }
  };

  // Validate personal data
  const validatePersonalData = (): boolean => {
    const errors: Record<string, string> = {};

    if (!personalData.firstName.trim()) errors.firstName = 'Imię jest wymagane';
    if (!personalData.lastName.trim()) errors.lastName = 'Nazwisko jest wymagane';
    if (!personalData.position.trim()) errors.position = 'Stanowisko jest wymagane';

    const phoneDigits = personalData.phone.replace(/\D/g, '');
    if (phoneDigits.length !== 11 || !phoneDigits.startsWith('48')) {
      errors.phone = 'Podaj prawidłowy numer telefonu';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!personalData.email.trim() || !emailRegex.test(personalData.email.trim())) {
      errors.email = 'Podaj prawidłowy adres e-mail';
    }

    if (personalData.usesDifferentInvoiceEmail) {
      if (!personalData.invoiceEmail.trim() || !emailRegex.test(personalData.invoiceEmail.trim())) {
        errors.invoiceEmail = 'Podaj prawidłowy adres e-mail do faktur';
      }
    }

    if (!personalData.industry) errors.industry = 'Wybierz branżę';
    if (!personalData.employeeCount) errors.employeeCount = 'Wybierz liczbę pracowników';

    setPersonalErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle registration
  const handleRegister = async () => {
    if (!validatePersonalData() || !editableCompanyData) return;

    setIsLoading(true);
    setError(null);

    try {
      const addressStreet = [
        editableCompanyData.ulica,
        editableCompanyData.nrNieruchomosci,
        editableCompanyData.nrLokalu ? `/${editableCompanyData.nrLokalu}` : ''
      ].filter(Boolean).join(' ');

      const { data, error: fnError } = await supabase.functions.invoke('register-company', {
        body: {
          companyName: editableCompanyData.nazwa,
          legalName: editableCompanyData.nazwa,
          taxId: editableCompanyData.nip,
          regon: editableCompanyData.regon || null,
          addressStreet,
          addressCity: editableCompanyData.miejscowosc,
          addressPostalCode: editableCompanyData.kodPocztowy,
          industry: personalData.industry || null,
          employeeCount: personalData.employeeCount || null,
          firstName: personalData.firstName.trim(),
          lastName: personalData.lastName.trim(),
          position: personalData.position.trim(),
          phone: personalData.phone.replace(/\s/g, ''),
          email: personalData.email.trim().toLowerCase(),
          billingEmail: personalData.usesDifferentInvoiceEmail
            ? personalData.invoiceEmail.trim().toLowerCase()
            : personalData.email.trim().toLowerCase(),
          referralCompanyId: referralCompanyId || null
        }
      });

      if (fnError) {
        throw new Error('Błąd połączenia z serwerem. Spróbuj ponownie.');
      }

      if (!data?.success) {
        setError(data?.error || 'Nie udało się utworzyć konto firmy. Spróbuj ponownie.');
        setIsLoading(false);
        return;
      }

      // Success!
      setRegisteredEmail(personalData.email.trim());
      setShowSuccessModal(true);
      setCurrentStep('done');
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step indicator
  const steps = [
    { key: 'welcome', label: 'Start', number: 1 },
    { key: 'nip', label: 'NIP', number: 2 },
    { key: 'confirm', label: 'Dane firmy', number: 3 },
    { key: 'personal', label: 'Twoje dane', number: 4 }
  ];

  const currentStepIndex = steps.findIndex(s => s.key === currentStep);

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, idx) => (
        <React.Fragment key={step.key}>
          <div className={`flex items-center gap-2 ${idx <= currentStepIndex ? 'text-blue-600' : 'text-slate-300'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
              idx < currentStepIndex
                ? 'bg-blue-600 text-white'
                : idx === currentStepIndex
                  ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                  : 'bg-slate-100 text-slate-400'
            }`}>
              {idx < currentStepIndex ? <CheckCircle size={16} /> : step.number}
            </div>
            <span className={`text-xs font-semibold hidden sm:inline ${
              idx <= currentStepIndex ? 'text-blue-600' : 'text-slate-400'
            }`}>
              {step.label}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div className={`w-8 sm:w-12 h-0.5 transition-all duration-300 ${
              idx < currentStepIndex ? 'bg-blue-600' : 'bg-slate-200'
            }`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  // STEP: Welcome
  const renderWelcome = () => (
    <div className="text-center space-y-6">
      <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-700 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-blue-600/20">
        <Building2 className="w-10 h-10 text-white" />
      </div>
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Witaj w MaxMaster!
        </h1>
        <p className="text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
          Zarejestruj swoją firmę i zyskaj dostęp do pełnej platformy zarządzania kompetencjami pracowników.
        </p>
      </div>

      {referralCompanyName && (
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-medium">
          <Users size={16} />
          <span>Polecenie od: <strong>{referralCompanyName}</strong></span>
        </div>
      )}

      <div className="space-y-3 text-left max-w-sm mx-auto">
        <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
            <Search size={16} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">Weryfikacja NIP</p>
            <p className="text-xs text-slate-500">Automatycznie pobierzemy dane z rejestru GUS</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
            <User size={16} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">Dane kontaktowe</p>
            <p className="text-xs text-slate-500">Podasz swoje dane jako administrator firmy</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
            <CheckCircle size={16} className="text-green-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">Gotowe!</p>
            <p className="text-xs text-slate-500">Potwierdź email i zacznij korzystać z platformy</p>
          </div>
        </div>
      </div>

      <button
        onClick={() => setCurrentStep('nip')}
        className="w-full max-w-sm mx-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30"
      >
        Rozpocznij rejestrację
        <ArrowRight size={18} />
      </button>

      <p className="text-xs text-slate-400">
        Masz już konto?{' '}
        <button
          onClick={() => navigate('/login')}
          className="text-blue-600 hover:text-blue-700 font-semibold"
        >
          Zaloguj się
        </button>
      </p>
    </div>
  );

  // STEP: NIP Input
  const renderNipStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Search className="w-7 h-7 text-blue-600" />
        </div>
        <h2 className="text-xl font-black text-slate-900">Wpisz NIP firmy</h2>
        <p className="text-slate-500 text-sm mt-1">
          Automatycznie pobierzemy dane z rejestru GUS
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-600 text-sm">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
          NIP (Numer Identyfikacji Podatkowej)
        </label>
        <input
          type="text"
          value={nip}
          onChange={(e) => {
            setNip(formatNip(e.target.value));
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSearchGUS();
          }}
          placeholder="XXX-XXX-XX-XX"
          className="w-full border-2 border-slate-200 p-4 rounded-xl text-lg font-mono text-center tracking-widest focus:border-blue-500 focus:outline-none transition-colors"
          autoFocus
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => { setCurrentStep('welcome'); setError(null); }}
          className="flex-1 flex items-center justify-center gap-2 text-slate-600 hover:text-slate-800 font-semibold py-3 px-4 rounded-xl border-2 border-slate-200 hover:border-slate-300 transition-all"
        >
          <ArrowLeft size={16} />
          Wstecz
        </button>
        <button
          onClick={handleSearchGUS}
          disabled={isLoading || nip.replace(/\D/g, '').length !== 10}
          className="flex-[2] flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-blue-600/20"
        >
          {isLoading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Szukam w GUS...
            </>
          ) : (
            <>
              <Search size={18} />
              Sprawdź NIP
            </>
          )}
        </button>
      </div>
    </div>
  );

  // STEP: Confirm company data
  const renderConfirmStep = () => {
    if (!editableCompanyData) return null;

    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-7 h-7 text-green-600" />
          </div>
          <h2 className="text-xl font-black text-slate-900">Dane firmy z GUS</h2>
          <p className="text-slate-500 text-sm mt-1">
            Sprawdź poprawność danych i przejdź dalej
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-600 text-sm">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-200">
          <div className="p-4">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Nazwa firmy
            </label>
            {isEditing ? (
              <input
                type="text"
                value={editableCompanyData.nazwa}
                onChange={(e) => setEditableCompanyData({ ...editableCompanyData, nazwa: e.target.value })}
                className="w-full border-2 border-slate-200 p-2 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
              />
            ) : (
              <p className="text-sm font-semibold text-slate-900">{editableCompanyData.nazwa}</p>
            )}
          </div>
          <div className="p-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">NIP</label>
              <p className="text-sm font-mono text-slate-700">{editableCompanyData.nip}</p>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">REGON</label>
              <p className="text-sm font-mono text-slate-700">{editableCompanyData.regon || '—'}</p>
            </div>
          </div>
          <div className="p-4">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Adres</label>
            {isEditing ? (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={editableCompanyData.ulica}
                    onChange={(e) => setEditableCompanyData({ ...editableCompanyData, ulica: e.target.value })}
                    placeholder="Ulica"
                    className="col-span-2 border-2 border-slate-200 p-2 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={editableCompanyData.nrNieruchomosci}
                    onChange={(e) => setEditableCompanyData({ ...editableCompanyData, nrNieruchomosci: e.target.value })}
                    placeholder="Nr"
                    className="border-2 border-slate-200 p-2 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={editableCompanyData.kodPocztowy}
                    onChange={(e) => setEditableCompanyData({ ...editableCompanyData, kodPocztowy: e.target.value })}
                    placeholder="Kod pocztowy"
                    className="border-2 border-slate-200 p-2 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={editableCompanyData.miejscowosc}
                    onChange={(e) => setEditableCompanyData({ ...editableCompanyData, miejscowosc: e.target.value })}
                    placeholder="Miasto"
                    className="col-span-2 border-2 border-slate-200 p-2 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-700">
                {[
                  editableCompanyData.ulica,
                  editableCompanyData.nrNieruchomosci,
                  editableCompanyData.nrLokalu ? `/ ${editableCompanyData.nrLokalu}` : ''
                ].filter(Boolean).join(' ')}
                <br />
                {editableCompanyData.kodPocztowy} {editableCompanyData.miejscowosc}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          {isEditing ? (
            <>
              <button
                onClick={() => {
                  setEditableCompanyData(gusData);
                  setIsEditing(false);
                }}
                className="flex-1 text-slate-600 hover:text-slate-800 font-semibold py-3 px-4 rounded-xl border-2 border-slate-200 hover:border-slate-300 transition-all text-sm"
              >
                Przywróć dane GUS
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="flex-[2] flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl transition-all text-sm"
              >
                <CheckCircle size={16} />
                Zatwierdź zmiany
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setCurrentStep('nip'); setError(null); }}
                className="flex items-center justify-center gap-2 text-slate-600 hover:text-slate-800 font-semibold py-3 px-4 rounded-xl border-2 border-slate-200 hover:border-slate-300 transition-all"
              >
                <ArrowLeft size={16} />
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className="flex-1 flex items-center justify-center gap-2 text-slate-700 hover:text-slate-900 font-semibold py-3 px-4 rounded-xl border-2 border-slate-200 hover:border-slate-300 transition-all text-sm"
              >
                <Edit3 size={16} />
                Edytuj dane
              </button>
              <button
                onClick={() => { setCurrentStep('personal'); setError(null); }}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-blue-600/20 text-sm"
              >
                Dane prawidłowe
                <ArrowRight size={16} />
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  // STEP: Personal data
  const renderPersonalStep = () => {
    const renderField = (
      label: string,
      name: string,
      value: string,
      type: string = 'text',
      placeholder: string = '',
      options?: { icon?: React.ReactNode; onChange?: (v: string) => void }
    ) => (
      <div>
        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
          {label}
        </label>
        <div className="relative">
          {options?.icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              {options.icon}
            </div>
          )}
          <input
            type={type}
            value={value}
            onChange={(e) => {
              const newVal = options?.onChange ? (options.onChange(e.target.value), e.target.value) : e.target.value;
              setPersonalData(prev => ({ ...prev, [name]: options?.onChange ? value : newVal }));
              setPersonalErrors(prev => ({ ...prev, [name]: '' }));
            }}
            placeholder={placeholder}
            className={`w-full border-2 ${personalErrors[name] ? 'border-red-300 bg-red-50' : 'border-slate-200'} p-3 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-colors ${options?.icon ? 'pl-10' : ''}`}
          />
        </div>
        {personalErrors[name] && (
          <p className="text-xs text-red-500 mt-1 font-medium">{personalErrors[name]}</p>
        )}
      </div>
    );

    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <User className="w-7 h-7 text-blue-600" />
          </div>
          <h2 className="text-xl font-black text-slate-900">Twoje dane</h2>
          <p className="text-slate-500 text-sm mt-1">
            Podaj dane osoby zarządzającej kontem firmy
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-600 text-sm">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Name fields */}
        <div className="grid grid-cols-2 gap-4">
          {renderField('Imię', 'firstName', personalData.firstName, 'text', 'Jan')}
          {renderField('Nazwisko', 'lastName', personalData.lastName, 'text', 'Kowalski')}
        </div>

        {/* Position */}
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            Stanowisko
          </label>
          <div className="relative">
            <Briefcase size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={personalData.position}
              onChange={(e) => {
                setPersonalData(prev => ({ ...prev, position: e.target.value }));
                setPersonalErrors(prev => ({ ...prev, position: '' }));
              }}
              placeholder="np. Dyrektor, Właściciel, Manager"
              className={`w-full border-2 ${personalErrors.position ? 'border-red-300 bg-red-50' : 'border-slate-200'} p-3 pl-10 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-colors`}
            />
          </div>
          {personalErrors.position && <p className="text-xs text-red-500 mt-1 font-medium">{personalErrors.position}</p>}
        </div>

        {/* Phone */}
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            Numer telefonu
          </label>
          <div className="relative">
            <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="tel"
              value={personalData.phone}
              onChange={(e) => {
                setPersonalData(prev => ({ ...prev, phone: formatPhoneNumber(e.target.value) }));
                setPersonalErrors(prev => ({ ...prev, phone: '' }));
              }}
              placeholder="+48 500 123 456"
              className={`w-full border-2 ${personalErrors.phone ? 'border-red-300 bg-red-50' : 'border-slate-200'} p-3 pl-10 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-colors`}
            />
          </div>
          {personalErrors.phone && <p className="text-xs text-red-500 mt-1 font-medium">{personalErrors.phone}</p>}
        </div>

        {/* Email */}
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            Adres e-mail
          </label>
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              value={personalData.email}
              onChange={(e) => {
                setPersonalData(prev => ({ ...prev, email: e.target.value }));
                setPersonalErrors(prev => ({ ...prev, email: '' }));
              }}
              placeholder="jan@firma.pl"
              className={`w-full border-2 ${personalErrors.email ? 'border-red-300 bg-red-50' : 'border-slate-200'} p-3 pl-10 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-colors`}
            />
          </div>
          {personalErrors.email && <p className="text-xs text-red-500 mt-1 font-medium">{personalErrors.email}</p>}
        </div>

        {/* Invoice email checkbox */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="diffInvoiceEmail"
            checked={personalData.usesDifferentInvoiceEmail}
            onChange={(e) => setPersonalData(prev => ({ ...prev, usesDifferentInvoiceEmail: e.target.checked }))}
            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="diffInvoiceEmail" className="text-sm text-slate-600 cursor-pointer">
            Inny adres e-mail do faktur
          </label>
        </div>

        {/* Invoice email (conditional) */}
        {personalData.usesDifferentInvoiceEmail && (
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              E-mail do faktur
            </label>
            <div className="relative">
              <FileText size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={personalData.invoiceEmail}
                onChange={(e) => {
                  setPersonalData(prev => ({ ...prev, invoiceEmail: e.target.value }));
                  setPersonalErrors(prev => ({ ...prev, invoiceEmail: '' }));
                }}
                placeholder="faktury@firma.pl"
                className={`w-full border-2 ${personalErrors.invoiceEmail ? 'border-red-300 bg-red-50' : 'border-slate-200'} p-3 pl-10 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-colors`}
              />
            </div>
            {personalErrors.invoiceEmail && <p className="text-xs text-red-500 mt-1 font-medium">{personalErrors.invoiceEmail}</p>}
          </div>
        )}

        {/* Industry */}
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            Branża
          </label>
          <select
            value={personalData.industry}
            onChange={(e) => {
              setPersonalData(prev => ({ ...prev, industry: e.target.value }));
              setPersonalErrors(prev => ({ ...prev, industry: '' }));
            }}
            className={`w-full border-2 ${personalErrors.industry ? 'border-red-300 bg-red-50' : 'border-slate-200'} p-3 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-colors bg-white`}
          >
            <option value="">Wybierz branżę...</option>
            {INDUSTRY_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          {personalErrors.industry && <p className="text-xs text-red-500 mt-1 font-medium">{personalErrors.industry}</p>}
        </div>

        {/* Employee count */}
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            Liczba pracowników
          </label>
          <div className="grid grid-cols-4 gap-2">
            {EMPLOYEE_COUNT_OPTIONS.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  setPersonalData(prev => ({ ...prev, employeeCount: opt }));
                  setPersonalErrors(prev => ({ ...prev, employeeCount: '' }));
                }}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all border-2 ${
                  personalData.employeeCount === opt
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          {personalErrors.employeeCount && <p className="text-xs text-red-500 mt-1 font-medium">{personalErrors.employeeCount}</p>}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => { setCurrentStep('confirm'); setError(null); }}
            className="flex items-center justify-center gap-2 text-slate-600 hover:text-slate-800 font-semibold py-3.5 px-4 rounded-xl border-2 border-slate-200 hover:border-slate-300 transition-all"
          >
            <ArrowLeft size={16} />
          </button>
          <button
            onClick={handleRegister}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-black uppercase tracking-wider py-3.5 px-6 rounded-xl transition-all shadow-lg shadow-blue-600/20 text-sm"
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Rejestracja...
              </>
            ) : (
              <>
                Zarejestruj firmę
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  // Success modal
  const renderSuccessModal = () => {
    if (!showSuccessModal) return null;

    return (
      <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-white rounded-[28px] shadow-2xl max-w-md w-full p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <Mail className="w-10 h-10 text-green-600" />
          </div>

          <div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">Potwierdź e-mail</h2>
            <p className="text-slate-500 leading-relaxed">
              Na adres <strong className="text-slate-700">{registeredEmail}</strong> wysłaliśmy
              link aktywacyjny. Kliknij w link, aby <strong className="text-slate-700">ustawić hasło</strong> i aktywować swoje konto.
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left">
            <p className="text-sm text-amber-700">
              <strong>Nie widzisz wiadomości?</strong> Sprawdź folder SPAM lub poczekaj kilka minut.
            </p>
          </div>

          <button
            onClick={() => navigate('/login')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg shadow-blue-600/20"
          >
            Przejdź do logowania
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-blue-600/20">
            M
          </div>
          <span className="text-xl font-black text-slate-900 tracking-tight">MaxMaster</span>
        </div>
      </div>

      {/* Main card */}
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-[28px] shadow-xl border border-slate-100 p-8">
          {currentStep !== 'welcome' && currentStep !== 'done' && renderStepIndicator()}

          {currentStep === 'welcome' && renderWelcome()}
          {currentStep === 'nip' && renderNipStep()}
          {currentStep === 'confirm' && renderConfirmStep()}
          {currentStep === 'personal' && renderPersonalStep()}
        </div>

        {/* Footer */}
        <div className="text-center mt-4">
          <p className="text-xs text-slate-400">
            Rejestrując się, akceptujesz{' '}
            <span className="text-blue-500 cursor-pointer hover:underline">regulamin</span>
            {' '}i{' '}
            <span className="text-blue-500 cursor-pointer hover:underline">politykę prywatności</span>
          </p>
        </div>
      </div>

      {renderSuccessModal()}
    </div>
  );
};
