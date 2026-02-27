
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

// Subscription status labels (database values)
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

// Company subscription display status (computed from modules)
// BRAK - no active subscription and no demo
// DEMO - has demo modules but no paid subscriptions
// TRIALING - has active subscription in trial period
// AKTYWNA - has active paid subscription
export const COMPANY_SUBSCRIPTION_DISPLAY_LABELS: Record<string, string> = {
  'none': 'BRAK',
  'demo': 'DEMO',
  'trialing': 'TRIAL',
  'active': 'AKTYWNA'
};

export const COMPANY_SUBSCRIPTION_DISPLAY_COLORS: Record<string, string> = {
  'none': 'bg-gray-100 text-gray-800 border-gray-200',
  'demo': 'bg-blue-100 text-blue-800 border-blue-200',
  'trialing': 'bg-purple-100 text-purple-800 border-purple-200',
  'active': 'bg-green-100 text-green-800 border-green-200'
};

// Module labels
export const MODULE_LABELS: Record<string, string> = {
  'recruitment': 'Rekrutacja',
  'skills': 'Umiejętności',
  'time_attendance': 'Czas pracy',
  'time_off': 'Urlopy i nieobecności',
  'work_schedule': 'Grafik pracy',
  'tasks_projects': 'Zadania i projekty',
  'reports_payroll': 'Raporty i rozliczenia'
};

export const MODULE_DESCRIPTIONS: Record<string, string> = {
  'recruitment': 'Moduł rekrutacji kandydatów i zarządzania okresem próbnym',
  'skills': 'Moduł zarządzania umiejętnościami i rozwojem pracowników',
  'time_attendance': 'Rejestracja czasu pracy, obecność, nadgodziny, wnioski o korekty',
  'time_off': 'Zarządzanie urlopami, zwolnieniami, limitami dni wolnych',
  'work_schedule': 'Planowanie zmian, szablony grafików, przypisania pracowników',
  'tasks_projects': 'Zarządzanie zadaniami, projektami, klientami, logowanie czasu',
  'reports_payroll': 'Tabele czasu pracy, raporty obecności, rozliczenia wynagrodzeń'
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

// =============================================
// CRM Constants for Sales Module
// =============================================

import { DealStage, DealPriority, ActivityType } from './types';

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  [DealStage.LEAD]: 'Nowy Lead',
  [DealStage.QUALIFIED]: 'Zakwalifikowany',
  [DealStage.PROPOSAL]: 'Propozycja',
  [DealStage.NEGOTIATION]: 'Negocjacje',
  [DealStage.WON]: 'Wygrana',
  [DealStage.LOST]: 'Przegrana'
};

export const DEAL_STAGE_COLORS: Record<DealStage, string> = {
  [DealStage.LEAD]: 'bg-slate-100 text-slate-700',
  [DealStage.QUALIFIED]: 'bg-blue-100 text-blue-700',
  [DealStage.PROPOSAL]: 'bg-purple-100 text-purple-700',
  [DealStage.NEGOTIATION]: 'bg-orange-100 text-orange-700',
  [DealStage.WON]: 'bg-green-100 text-green-700',
  [DealStage.LOST]: 'bg-red-100 text-red-700'
};

export const DEAL_PRIORITY_LABELS: Record<DealPriority, string> = {
  [DealPriority.LOW]: 'Niski',
  [DealPriority.MEDIUM]: 'Średni',
  [DealPriority.HIGH]: 'Wysoki',
  [DealPriority.URGENT]: 'Pilny'
};

export const DEAL_PRIORITY_COLORS: Record<DealPriority, string> = {
  [DealPriority.LOW]: 'bg-slate-100 text-slate-600',
  [DealPriority.MEDIUM]: 'bg-blue-100 text-blue-600',
  [DealPriority.HIGH]: 'bg-orange-100 text-orange-600',
  [DealPriority.URGENT]: 'bg-red-100 text-red-600'
};

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  [ActivityType.CALL]: 'Telefon',
  [ActivityType.EMAIL]: 'Email',
  [ActivityType.MEETING]: 'Spotkanie',
  [ActivityType.NOTE]: 'Notatka',
  [ActivityType.TASK]: 'Zadanie',
  [ActivityType.STATUS_CHANGE]: 'Zmiana statusu'
};

export const ACTIVITY_TYPE_ICONS: Record<ActivityType, string> = {
  [ActivityType.CALL]: 'Phone',
  [ActivityType.EMAIL]: 'Mail',
  [ActivityType.MEETING]: 'Calendar',
  [ActivityType.NOTE]: 'FileText',
  [ActivityType.TASK]: 'CheckSquare',
  [ActivityType.STATUS_CHANGE]: 'RefreshCw'
};

export const INDUSTRY_OPTIONS = [
  'Budownictwo',
  'IT / Technologia',
  'Produkcja',
  'Logistyka',
  'Handel',
  'Usługi',
  'Finanse',
  'Zdrowie',
  'Edukacja',
  'Inne'
];

// CRM Company Status Options
export const CRM_STATUS_OPTIONS = [
  'new',
  'contacted',
  'interested',
  'proposal',
  'negotiation',
  'won',
  'lost',
  'inactive'
];

export const CRM_STATUS_LABELS: Record<string, string> = {
  'new': 'Nowy',
  'contacted': 'Skontaktowany',
  'interested': 'Zainteresowany',
  'proposal': 'Propozycja',
  'negotiation': 'Negocjacje',
  'won': 'Wygrany',
  'lost': 'Przegrany',
  'inactive': 'Nieaktywny'
};

export const CRM_STATUS_COLORS: Record<string, string> = {
  'new': 'bg-slate-100 text-slate-700 border-slate-200',
  'contacted': 'bg-blue-100 text-blue-700 border-blue-200',
  'interested': 'bg-cyan-100 text-cyan-700 border-cyan-200',
  'proposal': 'bg-purple-100 text-purple-700 border-purple-200',
  'negotiation': 'bg-orange-100 text-orange-700 border-orange-200',
  'won': 'bg-green-100 text-green-700 border-green-200',
  'lost': 'bg-red-100 text-red-700 border-red-200',
  'inactive': 'bg-gray-100 text-gray-500 border-gray-200'
};

export const DEAL_STAGES_ORDER: DealStage[] = [
  DealStage.LEAD,
  DealStage.QUALIFIED,
  DealStage.PROPOSAL,
  DealStage.NEGOTIATION,
  DealStage.WON,
  DealStage.LOST
];

// =============================================
// Construction Modules Constants
// =============================================

import {
  ResourceType,
  ContractorEntityType,
  ContractorType,
  OfferStatus,
  TicketStatusType,
  TicketPriorityType,
  GanttDependencyType,
  FinanceOperationType,
  FinanceOperationStatus,
  ActStatus,
  ActPaymentStatus,
  ActType,
  ActFormType,
  ResourceRequestStatus,
  OrderStatus,
  OrderDeliveryStatus,
  OrderPaymentStatus,
  StockOperationType,
  ApprovalRequestStatus,
  ApprovalActionType,
  ApprovalEntityType,
  DMSPermission,
  DMSActivityAction,
  MarkupType,
  ConstructionRole
} from './types';

// =============================================
// Resource Types (Estimates)
// =============================================

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  labor: 'Praca',
  material: 'Materiał',
  equipment: 'Sprzęt',
  overhead: 'Koszty ogólne'
};

export const RESOURCE_TYPE_COLORS: Record<ResourceType, string> = {
  labor: 'bg-blue-100 text-blue-700 border-blue-200',
  material: 'bg-green-100 text-green-700 border-green-200',
  equipment: 'bg-orange-100 text-orange-700 border-orange-200',
  overhead: 'bg-purple-100 text-purple-700 border-purple-200'
};

export const RESOURCE_TYPE_ICONS: Record<ResourceType, string> = {
  labor: 'Users',
  material: 'Package',
  equipment: 'Wrench',
  overhead: 'PieChart'
};

// =============================================
// Contractor Types
// =============================================

export const CONTRACTOR_ENTITY_TYPE_LABELS: Record<ContractorEntityType, string> = {
  individual: 'Osoba fizyczna',
  legal_entity: 'Osoba prawna'
};

export const CONTRACTOR_TYPE_LABELS: Record<ContractorType, string> = {
  customer: 'Inwestor / Zamawiający',
  contractor: 'Podwykonawca',
  supplier: 'Dostawca'
};

export const CONTRACTOR_TYPE_COLORS: Record<ContractorType, string> = {
  customer: 'bg-blue-100 text-blue-700 border-blue-200',
  contractor: 'bg-amber-100 text-amber-700 border-amber-200',
  supplier: 'bg-green-100 text-green-700 border-green-200'
};

export const CONTRACTOR_TYPE_ICONS: Record<ContractorType, string> = {
  customer: 'Building2',
  contractor: 'HardHat',
  supplier: 'Truck'
};

// =============================================
// Offer Status
// =============================================

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  draft: 'Wersja robocza',
  sent: 'Wysłana',
  accepted: 'Zaakceptowana',
  rejected: 'Odrzucona'
};

export const OFFER_STATUS_COLORS: Record<OfferStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  sent: 'bg-blue-100 text-blue-700 border-blue-200',
  accepted: 'bg-green-100 text-green-700 border-green-200',
  rejected: 'bg-red-100 text-red-700 border-red-200'
};

export const OFFER_STATUS_ICONS: Record<OfferStatus, string> = {
  draft: 'FileEdit',
  sent: 'Send',
  accepted: 'CheckCircle',
  rejected: 'XCircle'
};

// =============================================
// Ticket Status
// =============================================

export const TICKET_STATUS_LABELS: Record<TicketStatusType, string> = {
  open: 'Otwarte',
  in_progress: 'W trakcie',
  review: 'Do weryfikacji',
  resolved: 'Rozwiązane',
  closed: 'Zamknięte',
  rejected: 'Odrzucone'
};

export const TICKET_STATUS_COLORS: Record<TicketStatusType, string> = {
  open: 'bg-slate-100 text-slate-700 border-slate-200',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
  review: 'bg-purple-100 text-purple-700 border-purple-200',
  resolved: 'bg-green-100 text-green-700 border-green-200',
  closed: 'bg-gray-100 text-gray-500 border-gray-200',
  rejected: 'bg-red-100 text-red-700 border-red-200'
};

export const TICKET_STATUS_ICONS: Record<TicketStatusType, string> = {
  open: 'Circle',
  in_progress: 'Play',
  review: 'Eye',
  resolved: 'CheckCircle',
  closed: 'Archive',
  rejected: 'XCircle'
};

// =============================================
// Ticket Priority
// =============================================

export const TICKET_PRIORITY_LABELS: Record<TicketPriorityType, string> = {
  low: 'Niski',
  normal: 'Normalny',
  high: 'Wysoki',
  critical: 'Krytyczny'
};

export const TICKET_PRIORITY_COLORS: Record<TicketPriorityType, string> = {
  low: 'bg-slate-100 text-slate-600 border-slate-200',
  normal: 'bg-blue-100 text-blue-600 border-blue-200',
  high: 'bg-orange-100 text-orange-600 border-orange-200',
  critical: 'bg-red-100 text-red-600 border-red-200'
};

export const TICKET_PRIORITY_ICONS: Record<TicketPriorityType, string> = {
  low: 'ArrowDown',
  normal: 'Minus',
  high: 'ArrowUp',
  critical: 'AlertTriangle'
};

// =============================================
// Gantt Dependency Types
// =============================================

export const GANTT_DEPENDENCY_LABELS: Record<GanttDependencyType, string> = {
  FS: 'Zakończenie-Początek (FS)',
  FF: 'Zakończenie-Zakończenie (FF)',
  SS: 'Początek-Początek (SS)',
  SF: 'Początek-Zakończenie (SF)'
};

export const GANTT_DEPENDENCY_SHORT_LABELS: Record<GanttDependencyType, string> = {
  FS: 'FS',
  FF: 'FF',
  SS: 'SS',
  SF: 'SF'
};

// =============================================
// Finance Operation Types
// =============================================

export const FINANCE_OPERATION_TYPE_LABELS: Record<FinanceOperationType, string> = {
  income: 'Przychód',
  expense: 'Rozchód'
};

export const FINANCE_OPERATION_TYPE_COLORS: Record<FinanceOperationType, string> = {
  income: 'bg-green-100 text-green-700 border-green-200',
  expense: 'bg-red-100 text-red-700 border-red-200'
};

export const FINANCE_OPERATION_TYPE_ICONS: Record<FinanceOperationType, string> = {
  income: 'TrendingUp',
  expense: 'TrendingDown'
};

export const FINANCE_OPERATION_STATUS_LABELS: Record<FinanceOperationStatus, string> = {
  pending: 'Oczekuje',
  completed: 'Zrealizowana',
  cancelled: 'Anulowana'
};

export const FINANCE_OPERATION_STATUS_COLORS: Record<FinanceOperationStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200'
};

// =============================================
// Act (Finance) Status
// =============================================

export const ACT_STATUS_LABELS: Record<ActStatus, string> = {
  draft: 'Wersja robocza',
  sent: 'Wysłany',
  accepted: 'Zaakceptowany',
  rejected: 'Odrzucony'
};

export const ACT_STATUS_COLORS: Record<ActStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  sent: 'bg-blue-100 text-blue-700 border-blue-200',
  accepted: 'bg-green-100 text-green-700 border-green-200',
  rejected: 'bg-red-100 text-red-700 border-red-200'
};

export const ACT_PAYMENT_STATUS_LABELS: Record<ActPaymentStatus, string> = {
  unpaid: 'Nieopłacony',
  partial: 'Częściowo opłacony',
  paid: 'Opłacony'
};

export const ACT_PAYMENT_STATUS_COLORS: Record<ActPaymentStatus, string> = {
  unpaid: 'bg-red-100 text-red-700 border-red-200',
  partial: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  paid: 'bg-green-100 text-green-700 border-green-200'
};

export const ACT_TYPE_LABELS: Record<ActType, string> = {
  customer: 'Dla zamawiającego',
  contractor: 'Od podwykonawcy'
};

export const ACT_FORM_TYPE_LABELS: Record<ActFormType, string> = {
  KS2: 'Formularz KS-2',
  KS6a: 'Formularz KS-6a',
  free: 'Formularz dowolny'
};

// =============================================
// Resource Request Status (Procurement)
// =============================================

export const RESOURCE_REQUEST_STATUS_LABELS: Record<ResourceRequestStatus, string> = {
  new: 'Nowe',
  partial: 'Częściowo zamówione',
  ordered: 'Zamówione',
  received: 'Otrzymane',
  cancelled: 'Anulowane'
};

export const RESOURCE_REQUEST_STATUS_COLORS: Record<ResourceRequestStatus, string> = {
  new: 'bg-blue-100 text-blue-700 border-blue-200',
  partial: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  ordered: 'bg-purple-100 text-purple-700 border-purple-200',
  received: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200'
};

// =============================================
// Order Status (Procurement)
// =============================================

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: 'Wersja robocza',
  sent: 'Wysłane',
  confirmed: 'Potwierdzone',
  shipped: 'Wysłane (dostawa)',
  delivered: 'Dostarczone',
  cancelled: 'Anulowane'
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  sent: 'bg-blue-100 text-blue-700 border-blue-200',
  confirmed: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  shipped: 'bg-purple-100 text-purple-700 border-purple-200',
  delivered: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200'
};

export const ORDER_DELIVERY_STATUS_LABELS: Record<OrderDeliveryStatus, string> = {
  pending: 'Oczekuje',
  partial: 'Częściowo dostarczone',
  delivered: 'Dostarczone'
};

export const ORDER_DELIVERY_STATUS_COLORS: Record<OrderDeliveryStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  partial: 'bg-blue-100 text-blue-700 border-blue-200',
  delivered: 'bg-green-100 text-green-700 border-green-200'
};

export const ORDER_PAYMENT_STATUS_LABELS: Record<OrderPaymentStatus, string> = {
  unpaid: 'Nieopłacone',
  partial: 'Częściowo opłacone',
  paid: 'Opłacone'
};

export const ORDER_PAYMENT_STATUS_COLORS: Record<OrderPaymentStatus, string> = {
  unpaid: 'bg-red-100 text-red-700 border-red-200',
  partial: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  paid: 'bg-green-100 text-green-700 border-green-200'
};

// =============================================
// Stock Operation Types
// =============================================

export const STOCK_OPERATION_TYPE_LABELS: Record<StockOperationType, string> = {
  receipt: 'Przyjęcie',
  issue: 'Wydanie',
  transfer: 'Przesunięcie',
  inventory: 'Inwentaryzacja'
};

export const STOCK_OPERATION_TYPE_COLORS: Record<StockOperationType, string> = {
  receipt: 'bg-green-100 text-green-700 border-green-200',
  issue: 'bg-red-100 text-red-700 border-red-200',
  transfer: 'bg-blue-100 text-blue-700 border-blue-200',
  inventory: 'bg-purple-100 text-purple-700 border-purple-200'
};

export const STOCK_OPERATION_TYPE_ICONS: Record<StockOperationType, string> = {
  receipt: 'ArrowDownToLine',
  issue: 'ArrowUpFromLine',
  transfer: 'ArrowLeftRight',
  inventory: 'ClipboardList'
};

// =============================================
// Approval Status
// =============================================

export const APPROVAL_REQUEST_STATUS_LABELS: Record<ApprovalRequestStatus, string> = {
  pending: 'Oczekuje',
  in_progress: 'W trakcie',
  approved: 'Zatwierdzony',
  rejected: 'Odrzucony',
  cancelled: 'Anulowany'
};

export const APPROVAL_REQUEST_STATUS_COLORS: Record<ApprovalRequestStatus, string> = {
  pending: 'bg-slate-100 text-slate-700 border-slate-200',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
  approved: 'bg-green-100 text-green-700 border-green-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200'
};

export const APPROVAL_ACTION_TYPE_LABELS: Record<ApprovalActionType, string> = {
  approved: 'Zatwierdził',
  rejected: 'Odrzucił',
  returned: 'Zwrócił do poprawy',
  delegated: 'Przekazał'
};

export const APPROVAL_ENTITY_TYPE_LABELS: Record<ApprovalEntityType, string> = {
  estimate: 'Kosztorys',
  act: 'Akt',
  document: 'Dokument',
  change_request: 'Wniosek o zmianę',
  offer: 'Oferta',
  order: 'Zamówienie',
  purchase_request: 'Zapotrzebowanie',
  purchase_order: 'Zamówienie zakupu',
  ticket: 'Zgłoszenie',
  other: 'Inne'
};

// =============================================
// DMS Permissions
// =============================================

export const DMS_PERMISSION_LABELS: Record<DMSPermission, string> = {
  view: 'Podgląd',
  download: 'Pobieranie',
  edit: 'Edycja',
  delete: 'Usuwanie',
  manage: 'Zarządzanie'
};

export const DMS_ACTIVITY_ACTION_LABELS: Record<DMSActivityAction, string> = {
  created: 'Utworzono',
  viewed: 'Wyświetlono',
  downloaded: 'Pobrano',
  updated: 'Zaktualizowano',
  renamed: 'Zmieniono nazwę',
  moved: 'Przeniesiono',
  deleted: 'Usunięto',
  restored: 'Przywrócono',
  permission_changed: 'Zmieniono uprawnienia',
  version_created: 'Utworzono wersję'
};

// =============================================
// Plan/Drawing Markup Types
// =============================================

export const MARKUP_TYPE_LABELS: Record<MarkupType, string> = {
  line: 'Linia',
  arrow: 'Strzałka',
  rectangle: 'Prostokąt',
  circle: 'Koło',
  ellipse: 'Elipsa',
  polygon: 'Wielokąt',
  polyline: 'Polilinia',
  freehand: 'Odręczne',
  text: 'Tekst',
  measurement: 'Wymiar'
};

export const MARKUP_TYPE_ICONS: Record<MarkupType, string> = {
  line: 'Minus',
  arrow: 'ArrowRight',
  rectangle: 'Square',
  circle: 'Circle',
  ellipse: 'Circle',
  polygon: 'Pentagon',
  polyline: 'Spline',
  freehand: 'Pencil',
  text: 'Type',
  measurement: 'Ruler'
};

// =============================================
// Construction Roles
// =============================================

export const CONSTRUCTION_ROLE_LABELS: Record<ConstructionRole, string> = {
  [ConstructionRole.OWNER]: 'Właściciel',
  [ConstructionRole.ADMIN]: 'Administrator',
  [ConstructionRole.PROJECT_MANAGER]: 'Kierownik projektu',
  [ConstructionRole.ESTIMATOR]: 'Kosztorysant',
  [ConstructionRole.FOREMAN]: 'Brygadzista',
  [ConstructionRole.SUBCONTRACTOR]: 'Podwykonawca',
  [ConstructionRole.OBSERVER]: 'Obserwator',
  [ConstructionRole.ACCOUNTANT]: 'Księgowy'
};

export const CONSTRUCTION_ROLE_COLORS: Record<ConstructionRole, string> = {
  [ConstructionRole.OWNER]: 'bg-purple-100 text-purple-700 border-purple-200',
  [ConstructionRole.ADMIN]: 'bg-red-100 text-red-700 border-red-200',
  [ConstructionRole.PROJECT_MANAGER]: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  [ConstructionRole.ESTIMATOR]: 'bg-blue-100 text-blue-700 border-blue-200',
  [ConstructionRole.FOREMAN]: 'bg-amber-100 text-amber-700 border-amber-200',
  [ConstructionRole.SUBCONTRACTOR]: 'bg-orange-100 text-orange-700 border-orange-200',
  [ConstructionRole.OBSERVER]: 'bg-slate-100 text-slate-700 border-slate-200',
  [ConstructionRole.ACCOUNTANT]: 'bg-emerald-100 text-emerald-700 border-emerald-200'
};

// =============================================
// Extended Module Labels
// =============================================

export const CONSTRUCTION_MODULE_LABELS: Record<string, string> = {
  'estimates': 'Kosztorysowanie',
  'offers': 'Ofertowanie',
  'drawings': 'Rysunki techniczne',
  'dms': 'Dokumenty',
  'gantt': 'Harmonogram',
  'finance': 'Finanse',
  'procurement': 'Zaopatrzenie',
  'approvals': 'Uzgodnienia'
};

export const CONSTRUCTION_MODULE_DESCRIPTIONS: Record<string, string> = {
  'estimates': 'Kosztorysowanie projektów z hierarchiczną strukturą etapów, pozycji i zasobów',
  'offers': 'Tworzenie i zarządzanie ofertami handlowymi z szablonami i śledzeniem',
  'drawings': 'Zarządzanie rysunkami technicznymi z adnotacjami i znacznikami',
  'dms': 'System zarządzania dokumentami z wersjonowaniem i uprawnieniami',
  'gantt': 'Harmonogramowanie projektów z wykresem Gantta i zależnościami',
  'finance': 'Operacje finansowe, rozliczenia i akty wykonawcze',
  'procurement': 'Zarządzanie zamówieniami, dostawami i magazynem',
  'approvals': 'Workflow zatwierdzania dokumentów i zmian'
};

export const CONSTRUCTION_MODULE_ICONS: Record<string, string> = {
  'estimates': 'Calculator',
  'offers': 'FileText',
  'drawings': 'PenTool',
  'dms': 'FolderOpen',
  'gantt': 'GanttChart',
  'finance': 'Wallet',
  'procurement': 'ShoppingCart',
  'approvals': 'CheckSquare'
};

// =============================================
// Default Colors for UI
// =============================================

export const DEFAULT_FOLDER_COLORS = [
  '#6366f1', // Indigo
  '#3b82f6', // Blue
  '#0ea5e9', // Sky
  '#14b8a6', // Teal
  '#22c55e', // Green
  '#84cc16', // Lime
  '#eab308', // Yellow
  '#f97316', // Orange
  '#ef4444', // Red
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#64748b'  // Slate
];

export const DEFAULT_TAG_COLORS = DEFAULT_FOLDER_COLORS;

// =============================================
// Currency Options
// =============================================

export const CURRENCY_OPTIONS = [
  { id: 1, code: 'PLN', symbol: 'zł', name: 'Polski złoty' },
  { id: 2, code: 'EUR', symbol: '€', name: 'Euro' },
  { id: 3, code: 'USD', symbol: '$', name: 'Dolar amerykański' },
  { id: 4, code: 'GBP', symbol: '£', name: 'Funt brytyjski' },
  { id: 5, code: 'UAH', symbol: '₴', name: 'Hrywna ukraińska' },
  { id: 6, code: 'CZK', symbol: 'Kč', name: 'Korona czeska' }
];

// =============================================
// Unit Measure Default Options
// =============================================

export const UNIT_MEASURE_OPTIONS = [
  { id: 1, code: 'szt', name: 'Sztuka' },
  { id: 2, code: 'mb', name: 'Metr bieżący' },
  { id: 3, code: 'm²', name: 'Metr kwadratowy' },
  { id: 4, code: 'm³', name: 'Metr sześcienny' },
  { id: 5, code: 'kg', name: 'Kilogram' },
  { id: 6, code: 't', name: 'Tona' },
  { id: 7, code: 'kpl', name: 'Komplet' },
  { id: 8, code: 'godz', name: 'Godzina' },
  { id: 9, code: 'r-g', name: 'Roboczogodzina' },
  { id: 10, code: 'm-g', name: 'Maszynogodzina' },
  { id: 11, code: 'l', name: 'Litr' },
  { id: 12, code: 'op', name: 'Opakowanie' }
];
