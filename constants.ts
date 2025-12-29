
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

// Referral Mappings
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
  [Role.ADMIN]: 'Administrator',
  [Role.HR]: 'HR Manager',
  [Role.BRIGADIR]: 'Brygadzista',
  [Role.EMPLOYEE]: 'Pracownik',
  [Role.CANDIDATE]: 'Kandydat',
  [Role.COORDINATOR]: 'Koordynator Robót'
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

export const SKILLS: Skill[] = [
  { id: 'm1', name_pl: 'Czytanie projektu i montaż', category: SkillCategory.MONTAZ, description_pl: 'Umejętność czytania schematów i montażu wg projektu', verification_type: VerificationType.THEORY_PRACTICE, hourly_bonus: 1.0, required_pass_rate: 80, is_active: true, is_archived: false },
  { id: 'e1', name_pl: 'Gniazda, Wyłączniki 230V', category: SkillCategory.ELEKTRYKA, description_pl: 'Montaż roзеtek i wyłączników', verification_type: VerificationType.THEORY_PRACTICE, hourly_bonus: 0.5, required_pass_rate: 80, is_active: true, is_archived: false },
  { id: 'e2', name_pl: 'Montaż linii zasilającej', category: SkillCategory.ELEKTRYKA, description_pl: 'Montaż linii oświetleniowej i zasilającej', verification_type: VerificationType.THEORY_PRACTICE, hourly_bonus: 1.0, required_pass_rate: 80, is_active: true, is_archived: false },
  { id: 't1', name_pl: 'LAN – Sieci strukturalne', category: SkillCategory.TELETECHNIKA, description_pl: 'Montaż sieci, RJ-45, testowanie', verification_type: VerificationType.THEORY_PRACTICE, hourly_bonus: 1.5, required_pass_rate: 80, is_active: true, is_archived: false },
  { id: 't2', name_pl: 'CCTV - Kamery IP', category: SkillCategory.TELETECHNIKA, description_pl: 'Montaż i konfiguracja kamer IP', verification_type: VerificationType.THEORY_PRACTICE, hourly_bonus: 2.0, required_pass_rate: 80, is_active: true, is_archived: false },
  { id: 't3', name_pl: 'Światłowody', category: SkillCategory.TELETECHNIKA, description_pl: 'Montaż i spawanie światłowodów', verification_type: VerificationType.THEORY_PRACTICE, hourly_bonus: 2.5, required_pass_rate: 85, is_active: true, is_archived: false },
  { id: 'u1', name_pl: 'SEP E z pomiarami', category: SkillCategory.UPRAWNIENIA, description_pl: 'Świadectwo kwalifikacji E', verification_type: VerificationType.DOCUMENT, hourly_bonus: 0.5, required_pass_rate: 100, is_active: true, is_archived: false },
  { id: 'u2_doc', name_pl: 'UDT - Podnośniki', category: SkillCategory.UPRAWNIENIA, description_pl: 'Uprawnienia UDT', verification_type: VerificationType.DOCUMENT, hourly_bonus: 1.0, required_pass_rate: 100, is_active: true, is_archived: false },
];

export const USERS: User[] = [
  { id: 'u1', email: 'employee@maxmaster.pl', first_name: 'Jan', last_name: 'Kowalski', role: Role.EMPLOYEE, status: UserStatus.ACTIVE, base_rate: 24.0, hired_date: '2023-01-15', assigned_brigadir_id: 'u2', phone: '500-123-456', contract_type: ContractType.UOP },
  { id: 'u1_trial', email: 'newbie@maxmaster.pl', first_name: 'Adam', last_name: 'Nowicjusz', role: Role.EMPLOYEE, status: UserStatus.TRIAL, base_rate: 24.0, hired_date: '2023-11-01', assigned_brigadir_id: 'u2', phone: '600-987-654', contract_type: ContractType.UZ, trial_end_date: '2023-12-01' },
  { id: 'u2', email: 'brigadir@maxmaster.pl', first_name: 'Tomasz', last_name: 'Nowak', role: Role.BRIGADIR, status: UserStatus.ACTIVE, base_rate: 30.0, hired_date: '2020-05-10', phone: '700-555-444', contract_type: ContractType.B2B },
  { id: 'u3', email: 'hr@maxmaster.pl', first_name: 'Anna', last_name: 'Wiśniewska', role: Role.HR, status: UserStatus.ACTIVE, base_rate: 28.0, hired_date: '2021-09-01' },
  { id: 'u4', email: 'admin@maxmaster.pl', first_name: 'Piotr', last_name: 'Adminowicz', role: Role.ADMIN, status: UserStatus.ACTIVE, base_rate: 0, hired_date: '2020-01-01' },
  { id: 'u5', email: 'coord@maxmaster.pl', first_name: 'Krzysztof', last_name: 'Koordynacki', role: Role.COORDINATOR, status: UserStatus.ACTIVE, base_rate: 35.0, hired_date: '2019-06-01', phone: '600-111-222', contract_type: ContractType.B2B },
  
  // Referrals Example for Jan Kowalski (u1)
  { id: 'ref_1', email: 'piotr.ref@test.pl', first_name: 'Piotr', last_name: 'Polecony', role: Role.EMPLOYEE, status: UserStatus.ACTIVE, base_rate: 24, hired_date: '2023-08-01', referred_by_id: 'u1', target_position: 'Elektromonter' },
  { id: 'ref_2', email: 'igor.ref@test.pl', first_name: 'Igor', last_name: 'Nowy', role: Role.EMPLOYEE, status: UserStatus.TRIAL, base_rate: 24, hired_date: '2023-11-20', referred_by_id: 'u1', target_position: 'Pomocnik' },
  { id: 'ref_3', email: 'marek.zap@test.pl', first_name: 'Marek', last_name: 'Zaproszony', role: Role.CANDIDATE, status: UserStatus.INVITED, hired_date: '2024-05-20', referred_by_id: 'u1', target_position: 'Pomocnik' },

  // Candidates
  { id: 'c1', email: 'marek.k@gmail.com', first_name: 'Marek', last_name: 'Kandydacki', role: Role.CANDIDATE, status: UserStatus.TESTS_COMPLETED, base_rate: 24.0, hired_date: '2023-10-20', phone: '501-202-303', notes: 'Dobre wrażenie, ma doświadczenie z CCTV.', source: 'Pracuj.pl', resume_url: 'resume_marek.pdf', contract_type: ContractType.UZ },
  { id: 'c2', email: 'pawel.n@onet.pl', first_name: 'Paweł', last_name: 'Nowy', role: Role.CANDIDATE, status: UserStatus.STARTED, base_rate: 24.0, hired_date: '2023-10-25', phone: '505-606-707', source: 'Polecenie', contract_type: ContractType.UZ },
  { id: 'c3', email: 'tomasz.z@wp.pl', first_name: 'Tomasz', last_name: 'Zieliński', role: Role.CANDIDATE, status: UserStatus.INVITED, base_rate: 24.0, hired_date: '2023-10-24', phone: '509-111-222', source: 'LinkedIn', contract_type: ContractType.B2B },
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

export const USER_SKILLS: UserSkill[] = [
  { id: 'us1', user_id: 'u1', skill_id: 'm1', status: SkillStatus.CONFIRMED, confirmed_at: '2023-02-01T10:00:00', theory_score: 90 },
  { id: 'us2', user_id: 'u1', skill_id: 'e1', status: SkillStatus.CONFIRMED, confirmed_at: '2023-03-15T12:00:00', theory_score: 85 },
  { id: 'us_pending_demo', user_id: 'u1', skill_id: 't1', status: SkillStatus.THEORY_PASSED, theory_score: 95, effective_from: '2023-11-01' },
];

export const QUALITY_INCIDENTS: QualityIncident[] = [
    { id: 'qi1', user_id: 'u1', skill_id: 'm1', date: new Date().toISOString(), incident_number: 1, description: 'Niedokładne czyтanie schematu, błąd w trasie.', reported_by: 'Tomasz Nowak', image_url: 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?w=500&auto=format&fit=crop&q=60' },
    { id: 'qi3', user_id: 'u1', skill_id: 'm1', date: new Date().toISOString(), incident_number: 2, description: 'Kolejny błąd przy montażu koryt. Wymagana ponowna weryfikacja.', reported_by: 'Tomasz Nowak' },
    { id: 'qi2', user_id: 'u1', skill_id: 'e1', date: new Date().toISOString(), incident_number: 1, description: 'Błąd w montażu gniazd.', reported_by: 'Tomasz Nowak' },
];

export const EMPLOYEE_NOTES: EmployeeNote[] = [
    {
        id: 'n1',
        employee_id: 'u1',
        author_id: 'u2',
        category: NoteCategory.ATTITUDE,
        severity: NoteSeverity.INFO,
        text: 'Bardzo zaangażowany w pracę, chętnie pomaga młodszym kolegom.',
        created_at: '2023-10-15T14:30:00'
    },
    {
        id: 'n2',
        employee_id: 'u1',
        author_id: 'u2',
        category: NoteCategory.QUALITY,
        severity: NoteSeverity.WARNING,
        text: 'Zwrócić uwagę na estetykę układania kabli w korytach. Było kilka poprawek.',
        created_at: '2023-11-02T09:15:00'
    }
];

export const EMPLOYEE_BADGES: EmployeeBadge[] = [
    {
        id: 'b1',
        employee_id: 'u1',
        author_id: 'u2',
        month: '2023-10',
        type: BadgeType.SPEED,
        description: 'Rekordowe tempo układania tras kablowych v tym miesiącu.',
        visible_to_employee: true,
        created_at: '2023-10-30T10:00:00'
    },
    {
        id: 'b2',
        employee_id: 'u1',
        author_id: 'u2',
        month: '2023-11',
        type: BadgeType.HELP,
        description: 'Pomoc nowemu pracownikowi w aklimatyzacji.',
        visible_to_employee: true,
        created_at: '2023-11-28T14:00:00'
    }
];

export const CANDIDATE_HISTORY: CandidateHistoryEntry[] = [
    { id: 'h1', candidate_id: 'c1', date: '2023-10-20T10:00:00', action: 'Stworzono kandydata', performed_by: 'HR' },
    { id: 'h2', candidate_id: 'c1', date: '2023-10-20T10:05:00', action: 'Wysłano link do testów (Email: marek.k@gmail.com)', performed_by: 'System' },
    { id: 'h3', candidate_id: 'c1', date: '2023-10-21T10:30:00', action: 'Zaliczono test: LAN – Sieci strukturalne', performed_by: 'Kandydat' },
    { id: 'h4', candidate_id: 'c1', date: '2023-10-21T11:00:00', action: 'Zaliczono test: Instalacje elektryczne', performed_by: 'Kandydat' },
];

export const TESTS: Test[] = [
  {
    id: 'test_lan',
    skill_ids: ['t1'],
    title: 'Test wiedzy: LAN – Sieci strukturalne',
    time_limit_minutes: 15,
    is_active: true,
    is_archived: false,
    questions: [
      { id: 'q1', text: 'Jaka jest maksymalna długość segmentu kabla UTP kat. 6?', options: ['50m', '100m', '150m', '200m'], correctOptionIndices: [1], gradingStrategy: GradingStrategy.ALL_CORRECT },
      { id: 'q2', text: 'Ile par żył znajduje się w standardowym kablu UTP?', options: ['2 pary', '4 pary', '6 par', '8 par'], correctOptionIndices: [1], gradingStrategy: GradingStrategy.ALL_CORRECT },
      { id: 'q3', text: 'Który standard okablowania jest najczęstszy?', options: ['T568A', 'T568B', 'RS-232', 'IEEE 802.3'], correctOptionIndices: [1], gradingStrategy: GradingStrategy.ALL_CORRECT },
      { id: 'q4', text: 'Do czego służy patch panel?', options: ['Zasilanie', 'Organizacja połączeń', 'Chłodzenie', 'Montaż serwerów'], correctOptionIndices: [1], gradingStrategy: GradingStrategy.ALL_CORRECT },
      { id: 'q5', text: 'Jakie narzędzie testuje przewody?', options: ['Multimetr', 'Tester sieciowy', 'Oscyloskop', 'Miernik rezystancji'], correctOptionIndices: [1], gradingStrategy: GradingStrategy.ALL_CORRECT },
    ]
  },
  {
    id: 'test_ele',
    skill_ids: ['e1'],
    title: 'Test wiedzy: Instalacje elektryczne',
    time_limit_minutes: 10,
    is_active: true,
    is_archived: false,
    questions: [
      { id: 'q1', text: 'Jakie napięcie jest standardem w domach w Polsce?', options: ['110V', '230V', '400V', '12V'], correctOptionIndices: [1], gradingStrategy: GradingStrategy.ALL_CORRECT },
      { id: 'q2', text: 'Kolor przewodu ochronnego (PE)?', options: ['Niebieski', 'Brązowy', 'Żółto-zielony', 'Czarny'], correctOptionIndices: [2], gradingStrategy: GradingStrategy.ALL_CORRECT },
      { id: 'q3', text: 'RCD chroni przed?', options: ['Zużyciem prądu', 'Porażeniem', 'Niskim napięciem', 'Brak poprawnej odpowiedzi'], correctOptionIndices: [1], gradingStrategy: GradingStrategy.ALL_CORRECT },
    ]
  }
];

export const TEST_ATTEMPTS: TestAttempt[] = [
  { id: 'ta1', user_id: 'c1', test_id: 'test_lan', score: 100, passed: true, completed_at: '2023-10-21T10:30:00' },
  { id: 'ta2', user_id: 'c1', test_id: 'test_ele', score: 85, passed: true, completed_at: '2023-10-21T11:00:00' },
  { id: 'ta3', user_id: 'u1', test_id: 'test_lan', score: 90, passed: true, completed_at: '2023-02-01T09:00:00' },
  { id: 'ta4', user_id: 'u1_trial', test_id: 'test_ele', score: 95, passed: true, completed_at: '2023-11-05T09:00:00' },
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

export const SALARY_HISTORY: SalaryHistoryEntry[] = [
  { id: 'sh1', user_id: 'u1', change_date: '2023-01-15', reason: 'Zatrudnienie', old_rate: 0, new_rate: 24.00, changed_by_id: 'u3' },
  { id: 'sh2', user_id: 'u1', change_date: '2023-02-02', reason: 'Potwierdzona umiejętność: Czytanie projektu', old_rate: 24.00, new_rate: 25.00, changed_by_id: 'u3' },
  { id: 'sh3', user_id: 'u1', change_date: '2023-05-10', reason: 'Stałe premie (Plan + Usterki)', old_rate: 25.00, new_rate: 27.00, changed_by_id: 'u3' },
];

export const LIBRARY_RESOURCES: LibraryResource[] = [
  { id: 'res1', title: 'Standard T568A/B', type: 'pdf', category: SkillCategory.TELETECHNIKA, categories: [SkillCategory.TELETECHNIKA], skill_ids: ['t1'], url: '/docs/t568.pdf', is_archived: false },
  { id: 'res2', title: 'Jak zarobić końcówkę RJ-45', type: 'video', category: SkillCategory.TELETECHNIKA, categories: [SkillCategory.TELETECHNIKA], skill_ids: ['t1'], url: 'https://youtube.com/...', is_archived: false },
  { id: 'res3', title: 'Normy SEP - Podstawy', type: 'pdf', category: SkillCategory.ELEKTRYKA, categories: [SkillCategory.ELEKTRYKA], skill_ids: ['e1', 'e2'], url: '/docs/sep.pdf', is_archived: false },
  { id: 'res4', title: 'BHP na budowie', type: 'pdf', category: SkillCategory.INNE, categories: [SkillCategory.INNE], skill_ids: [], url: '/docs/bhp.pdf', is_archived: false },
  { id: 'doc_org1', title: 'Regulamin Pracy', type: 'pdf', category: SkillCategory.TECZKA, categories: [SkillCategory.TECZKA], skill_ids: [], url: '#', is_archived: false },
  { id: 'doc_org2', title: 'Struktura Organizacyjna', type: 'pdf', category: SkillCategory.TECZKA, categories: [SkillCategory.TECZKA], skill_ids: [], url: '#', is_archived: false },
  { id: 'doc_org3', title: 'Polityka Jakości', type: 'pdf', category: SkillCategory.TECZKA, categories: [SkillCategory.TECZKA], skill_ids: [], url: '#', is_archived: false },
  { id: 'doc_emp1', title: 'Wniosek Urlopowy', type: 'pdf', category: SkillCategory.TECZKA_PRACOWNICZA, categories: [SkillCategory.TECZKA_PRACOWNICZA], skill_ids: [], url: '#', is_archived: false },
  { id: 'doc_emp2', title: 'Zasady Premiowania', type: 'pdf', category: SkillCategory.TECZKA_PRACOWNICZA, categories: [SkillCategory.TECZKA_PRACOWNICZA], skill_ids: [], url: '#', is_archived: false },
  { id: 'doc_emp3', title: 'Karta Obiegowa', type: 'pdf', category: SkillCategory.TECZKA_PRACOWNICZA, categories: [SkillCategory.TECZKA_PRACOWNICZA], skill_ids: [], url: '#', is_archived: false },
];
