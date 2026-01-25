
import { Role, Skill, SkillCategory, VerificationType, User, Test, PracticalCheckTemplate, UserStatus, TestAttempt, SalaryHistoryEntry, LibraryResource, SkillStatus, GradingStrategy, CandidateHistoryEntry, ContractType, QualityIncident, UserSkill, EmployeeNote, NoteCategory, NoteSeverity, EmployeeBadge, BadgeType, NotificationTemplate, NotificationChannel } from './types';

export const USER_STATUS_LABELS: Record<string, string> = {
  [UserStatus.INVITED]: 'ZAPROSZONY',
  [UserStatus.STARTED]: 'ZAREJESTROWANY',
  [UserStatus.TESTS_IN_PROGRESS]: 'W TRAKCIE TESTÓW',
  [UserStatus.TESTS_COMPLETED]: 'TESTY ZAKOŃCZONE',
  [UserStatus.INTERESTED]: 'ZAINTERESOWANY',
  [UserStatus.NOT_INTERESTED]: 'ZREZYGNOWAŁ',
  [UserStatus.REJECTED]: 'ODRZUCONY',
  [UserStatus.OFFER_SENT]: 'OFERTA WYSŁANA',
  [UserStatus.DATA_REQUESTED]: 'DANE DO UMOWY – WYMAGANE',
  [UserStatus.DATA_SUBMITTED]: 'DANE DO UMOWY – PRZESŁANE',
  [UserStatus.PORTAL_BLOCKED]: 'ZABLOKOWANY',
  
  [UserStatus.TRIAL]: 'Okres Próbny',
  [UserStatus.ACTIVE]: 'Aktywny',
  [UserStatus.INACTIVE]: 'Zwolniony'
};

export const REFERRAL_STATUS_LABELS: Record<string, string> = {
    'invited': 'Zaproszenie wysłane',
    'offered': 'Zaproponowano pracę',
    'working': 'Pracuje',
    'dismissed': 'Zrezygnował / Zwolniony'
};

export const REFERRAL_BONUSES: Record<string, number> = {
    'Pomocnik': 200,
    'Elektromonter': 400,
    'Elektryk': 600,
    'Brygadzista': 1000,
    'Koordynator Robót': 2000,
    'Kierownik Robót': 3000
};

export const USER_STATUS_COLORS: Record<string, string> = {
  [UserStatus.INVITED]: 'bg-blue-100 text-blue-800 border-blue-200',
  [UserStatus.STARTED]: 'bg-blue-100 text-blue-800 border-blue-200',
  [UserStatus.TESTS_IN_PROGRESS]: 'bg-blue-100 text-blue-800 border-blue-200',
  [UserStatus.TESTS_COMPLETED]: 'bg-blue-100 text-blue-800 border-blue-200',
  [UserStatus.OFFER_SENT]: 'bg-blue-100 text-blue-800 border-blue-200',
  [UserStatus.DATA_REQUESTED]: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  [UserStatus.INTERESTED]: 'bg-green-100 text-green-800 border-green-200',
  [UserStatus.DATA_SUBMITTED]: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  [UserStatus.NOT_INTERESTED]: 'bg-orange-100 text-orange-800 border-orange-200',
  [UserStatus.REJECTED]: 'bg-red-100 text-red-800 border-red-200',
  [UserStatus.PORTAL_BLOCKED]: 'bg-red-100 text-red-800 border-red-200',
  [UserStatus.TRIAL]: 'bg-amber-100 text-amber-800 border-amber-200',
  [UserStatus.ACTIVE]: 'bg-blue-600 text-white border-blue-700',
  [UserStatus.INACTIVE]: 'bg-slate-200 text-slate-600 border-slate-300'
};

export const SKILL_STATUS_LABELS: Record<string, string> = {
  [SkillStatus.LOCKED]: 'Zablokowane',
  [SkillStatus.PENDING]: 'Oczekuje na weryfikację',
  [SkillStatus.THEORY_PASSED]: 'Teoria Zaliczona',
  [SkillStatus.PRACTICE_PENDING]: 'Oczekuje na Praktykę',
  [SkillStatus.CONFIRMED]: 'Zatwierdzony',
  [SkillStatus.FAILED]: 'Odrzucony',
  [SkillStatus.SUSPENDED]: 'Przeterminowany'
};

export const ROLE_LABELS: Record<string, string> = {
  // Global roles
  [Role.SUPERADMIN]: 'Super Administrator',
  [Role.SALES]: 'Sprzedawca',
  [Role.DORADCA]: 'Doradca',

  // Company roles
  [Role.COMPANY_ADMIN]: 'Administrator Firmy',
  [Role.HR]: 'HR Manager',
  [Role.COORDINATOR]: 'Koordynator Robót',
  [Role.BRIGADIR]: 'Brygadzista',
  [Role.EMPLOYEE]: 'Pracownik',
  [Role.CANDIDATE]: 'Kandydat',
  [Role.TRIAL]: 'Okres Próbny',

  // Legacy
  [Role.ADMIN]: 'Administrator'
};

// Company status labels
export const COMPANY_STATUS_LABELS: Record<string, string> = {
  'active': 'Aktywna',
  'suspended': 'Zawieszona',
  'cancelled': 'Anulowana',
  'trial': 'Okres próbny'
};

export const COMPANY_STATUS_COLORS: Record<string, string> = {
  'active': 'bg-green-100 text-green-800 border-green-200',
  'suspended': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'cancelled': 'bg-red-100 text-red-800 border-red-200',
  'trial': 'bg-blue-100 text-blue-800 border-blue-200'
};

// Subscription status labels
export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  'trialing': 'Okres próbny',
  'active': 'Aktywna',
  'past_due': 'Zaległa płatność',
  'cancelled': 'Anulowana'
};

export const SUBSCRIPTION_STATUS_COLORS: Record<string, string> = {
  'trialing': 'bg-blue-100 text-blue-800 border-blue-200',
  'active': 'bg-green-100 text-green-800 border-green-200',
  'past_due': 'bg-red-100 text-red-800 border-red-200',
  'cancelled': 'bg-gray-100 text-gray-800 border-gray-200'
};

// Module labels
export const MODULE_LABELS: Record<string, string> = {
  'recruitment': 'Rekrutacja',
  'skills': 'Umiejętności'
};

export const MODULE_DESCRIPTIONS: Record<string, string> = {
  'recruitment': 'Moduł rekrutacji kandydatów i zarządzania okresem próbnym',
  'skills': 'Moduł zarządzania umiejętnościami i rozwojem pracowników'
};

// Global roles (users with is_global_user = true)
export const GLOBAL_ROLES: Role[] = [
  Role.SUPERADMIN,
  Role.SALES,
  Role.DORADCA
];

// Company roles (users with is_global_user = false)
export const COMPANY_ROLES: Role[] = [
  Role.COMPANY_ADMIN,
  Role.HR,
  Role.COORDINATOR,
  Role.BRIGADIR,
  Role.EMPLOYEE,
  Role.CANDIDATE,
  Role.TRIAL
];

// Roles available per module
export const MODULE_ROLES: Record<string, Role[]> = {
  'recruitment': [Role.CANDIDATE, Role.TRIAL],
  'skills': [Role.EMPLOYEE, Role.BRIGADIR, Role.COORDINATOR]
};

export const CONTRACT_TYPE_LABELS: Record<string, string> = {
  [ContractType.UOP]: 'Umowa o Pracę',
  [ContractType.UZ]: 'Umowa Zlecenie',
  [ContractType.B2B]: 'B2B'
};

export const CONTRACT_BONUSES: Record<string, number> = {
  [ContractType.UOP]: 0,
  [ContractType.UZ]: 1,
  [ContractType.B2B]: 7
};

export const BONUS_DOCUMENT_TYPES = [
    { id: 'sep_e', label: 'SEP E z pomiarami', bonus: 0.5 },
    { id: 'sep_d', label: 'SEP D z pomiarami', bonus: 0.5 },
    { id: 'udt_pod', label: 'UDT - Podnośniki (IP)', bonus: 1.0 },
    { id: 'bhp_szkol', label: 'Szkolenie BHP (Wstępne/Okresowe)', bonus: 0 },
    { id: 'badania', label: 'Orzeczenie Lekarskie (Wysokościowe)', bonus: 0 },
    { id: 'other', label: 'Inny dokument', bonus: 0 }
];

export const TERMINATION_REASONS = [
    "Niesatysfakcjonujące wynagrodzenie",
    "Brak możliwości rozwoju",
    "Zła atmosfera w zespole",
    "Lepsza oferta konkurencji",
    "Przyczyny osobiste / Relokacja",
    "Niewywiązywanie się z obowiązków (Zwolnienie)",
    "Naruszenie regulaminu pracy",
    "Koniec umowy / projektu",
    "Inne"
];

export const NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
    {
        id: 'tpl_1',
        code: 'CAND_INVITE_LINK',
        channel: NotificationChannel.BOTH,
        subject: 'Witaj w procesie rekrutacji MaxMaster',
        body: 'Cześć {{firstName}}, zapraszamy do portalu MaxMaster! Tutaj sprawdzisz swoją stawkę: {{portalUrl}}',
        variables: ['firstName', 'portalUrl'],
        is_active: true,
        created_at: new Date().toISOString()
    },
    {
        id: 'tpl_2',
        code: 'CAND_TEST_FINISHED',
        channel: NotificationChannel.EMAIL,
        subject: 'Twoje testy zostały zakończone',
        body: 'Cześć {{firstName}}, dziękujemy za wypełnienie testów. Twoje wyniki są analizowane przez dział HR. Powiadomimy Cię o kolejnych krokach.',
        variables: ['firstName'],
        is_active: true,
        created_at: new Date().toISOString()
    },
    {
        id: 'tpl_3',
        code: 'CAND_REJECTED',
        channel: NotificationChannel.BOTH,
        subject: 'Status Twojej aplikacji w MaxMaster',
        body: 'Dziękujemy {{firstName}} za udział w rekrutacji. Niestety tym razem nie możemy zaproponować Ci współpracy. Pozdrawiamy, {{companyName}}.',
        variables: ['firstName', 'companyName'],
        is_active: true,
        created_at: new Date().toISOString()
    },
    {
        id: 'tpl_4',
        code: 'CAND_DOCS_REQUEST',
        channel: NotificationChannel.BOTH,
        subject: 'Prośba o uzupełnienie danych do umowy',
        body: 'Cześć {{firstName}}, prosimy o uzupełnienie danych osobowych niezbędnych do umowy w portalu: {{actionUrl}}',
        variables: ['firstName', 'actionUrl'],
        is_active: true,
        created_at: new Date().toISOString()
    },
    {
        id: 'tpl_5',
        code: 'TRIAL_START',
        channel: NotificationChannel.BOTH,
        subject: 'Gratulacje! Rozpoczynasz okres próbny',
        body: 'Cześć {{firstName}}, witamy w zespole! Twój okres próbny kończy się {{trialEndDate}}. Twój brygadzista to {{hrName}}.',
        variables: ['firstName', 'trialEndDate', 'hrName'],
        is_active: true,
        created_at: new Date().toISOString()
    },
    {
        id: 'tpl_6',
        code: 'PRACTICE_VERIFICATION_RESULT_APPROVED',
        channel: NotificationChannel.BOTH,
        subject: 'Umiejętność zatwierdzona!',
        body: 'Świetna wiadomość {{firstName}}! Twoja umiejętność "{{skillName}}" została zatwierdzona. Twoja stawka wzроśnie od kolejnego miesiąca.',
        variables: ['firstName', 'skillName'],
        is_active: true,
        created_at: new Date().toISOString()
    }
];

export const CHECKLIST_TEMPLATES: PracticalCheckTemplate[] = [
  {
    id: 'tpl_lan',
    skill_id: 't1',
    title_pl: 'Weryfikacja: Sieci LAN',
    min_points_to_pass: 10,
    items: [
      { id: 1, text_pl: 'Prawidłowo zarobione 3 końcówki RJ-45', required: true, points: 3 },
      { id: 2, text_pl: 'Ułożenie kabli w szafie RACK (cable management)', required: true, points: 2 },
      { id: 3, text_pl: 'Oznakowanie przewodów', required: true, points: 2 },
      { id: 4, text_pl: 'Podłączenie do patch panelu', required: true, points: 2 },
      { id: 5, text_pl: 'Test miernikiem (PASS)', required: true, points: 3 },
    ]
  },
  {
    id: 'tpl_ele',
    skill_id: 'e1',
    title_pl: 'Weryfikacja: Gniazda i Wyłączniki',
    min_points_to_pass: 8,
    items: [
      { id: 1, text_pl: 'Podłączenie fazy, neutrala, PE', required: true, points: 4 },
      { id: 2, text_pl: 'Mocowanie puszek', required: true, points: 2 },
      { id: 3, text_pl: 'Estetyka (poziomowanie)', required: false, points: 1 },
      { id: 4, text_pl: 'Test działania', required: true, points: 3 },
    ]
  }
];
