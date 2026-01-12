
export interface AppNotification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
}

export interface NotificationSetting {
    id: string; // UUID in database
    setting_type: string; // e.g., "hr_cand_reg", "status_change"
    label: string;
    system: boolean;
    email: boolean;
    sms: boolean;
    user_id?: string;
    category?: string;
    target_role?: string;
}

export enum Role {
  ADMIN = 'admin',
  HR = 'hr',
  BRIGADIR = 'brigadir',
  EMPLOYEE = 'employee',
  CANDIDATE = 'candidate',
  COORDINATOR = 'coordinator'
}

export enum UserStatus {
  // Candidate Stages
  INVITED = 'invited', // Zaproszony, nie wszedł
  STARTED = 'started', // Zarejestrowany / Wszedł do panelu
  TESTS_IN_PROGRESS = 'tests_in_progress', // Rozpoczął testy
  TESTS_COMPLETED = 'tests_completed', // Zakończył testy
  INTERESTED = 'interested', // Zainteresowany współpracą
  NOT_INTERESTED = 'not_interested', // Rezygnacja
  REJECTED = 'rejected', // Odrzucony przez HR
  OFFER_SENT = 'offer_sent', // Oferta wysłana
  DATA_REQUESTED = 'data_requested', // Prośba o dane
  DATA_SUBMITTED = 'data_submitted', // Dane przesłane
  PORTAL_BLOCKED = 'portal_blocked', // Zablokowany dostęp

  // Employee Stages
  TRIAL = 'trial', // Okres Próbny
  ACTIVE = 'active', // Aktywny pracownik
  INACTIVE = 'inactive', // Zwolniony / Były pracownik
}

export enum ContractType {
  UOP = 'uop', // Umowa o Pracę (+0)
  UZ = 'uz',   // Umowa Zlecenie (+1)
  B2B = 'b2b'  // B2B (+7)
}

export enum SkillCategory {
  MONTAZ = 'PRACE MONTAŻOWE',
  ELEKTRYKA = 'INSTALACJE ELEKTRYCZNE',
  TELETECHNIKA = 'TELETECHNICZNE',
  AUTOMATYKA = 'AUTOMATYKA',
  PPOZ = 'PPOŻ',
  POMIARY = 'POMIARY I PROTOKOŁY',
  UPRAWNIENIA = 'UPRAWNIENIA',
  BRYGADZISTA = 'BRYGADZISTA',
  TECZKA = 'TECZKA STANOWISKOWA',
  TECZKA_PRACOWNICZA = 'TECZKA PRACOWNICZA',
  INNE = 'INNE'
}

export enum VerificationType {
  THEORY_ONLY = 'theory_only',
  THEORY_PRACTICE = 'theory_practice',
  DOCUMENT = 'document'
}

export enum SkillStatus {
  LOCKED = 'locked',
  PENDING = 'pending', // Not started
  THEORY_PASSED = 'theory_passed', // Theory OK, waiting for practice
  PRACTICE_PENDING = 'practice_pending', // Check created, waiting for Brigadir
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  SUSPENDED = 'suspended'
}

export interface Skill {
  id: string;
  name_pl: string;
  category: SkillCategory;
  description_pl: string;
  verification_type: VerificationType;
  hourly_bonus: number;
  required_pass_rate: number;
  criteria?: string[]; // New field for detailed criteria
  is_active?: boolean; // New field for activation status
  is_archived?: boolean; // Soft delete
}

export interface BrigadierBonus {
  id: string;
  name: string;
  amount: number;
}

export interface Position {
  id: string;
  name: string;
  responsibilities: string[];
  required_skill_ids: string[];
  min_monthly_rate?: number; // For Coordinator/Work Manager
  max_monthly_rate?: number; // For Coordinator/Work Manager
  brigadier_bonuses?: BrigadierBonus[]; // Specific for Brigadier
  order: number;
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  status: UserStatus;
  
  // Financials
  base_rate?: number; // Base hourly rate
  contract_type?: ContractType;
  is_student?: boolean;

  // HR Data
  phone?: string;
  hired_date: string;
  contract_end_date?: string;
  trial_end_date?: string; // If in trial
  assigned_brigadir_id?: string;
  
  // Referral System
  referred_by_id?: string; // ID of the employee who invited this user
  referral_bonus_paid?: boolean; // Payment status
  referral_bonus_paid_date?: string; // Payment timestamp

  // Candidate Data
  source?: string; // Skąd przyszedł (OLX, Polecenie, etc.)
  notes?: string;
  resume_url?: string;
  target_position?: string; // Stanowisko na ktore aplikuje

  // Personal Data (For Contract)
  pesel?: string;
  birth_date?: string;
  citizenship?: string;
  document_type?: string; // Dowód / Paszport
  document_number?: string;
  zip_code?: string;
  city?: string;
  street?: string;
  house_number?: string;
  apartment_number?: string;
  bank_account?: string;
  nip?: string; // Optional for B2B

  // Termination
  termination_date?: string;
  termination_reason?: string;
  termination_initiator?: 'employee' | 'company';

  // Qualifications Selection (Candidate)
  qualifications?: string[]; // IDs from QUALIFICATIONS_LIST
}

export interface ChecklistItemState {
    checked: boolean;
    image_url?: string;
    checkedBy?: string; // Name of user who checked
    checkedByRole?: Role; 
    checkedAt?: string; // ISO Date
}

export interface VerificationAttachment {
    id: string;
    url: string;
    type: 'photo' | 'file';
    name: string;
    uploadedBy: string;
    createdAt: string;
}

export interface VerificationNote {
    id: string;
    text: string;
    author: string;
    role: Role;
    createdAt: string;
}

export interface VerificationLog {
    id: string;
    action: string; // e.g., "Started", "Checked Item", "Approved"
    by: string;
    role: Role;
    at: string;
    details?: string;
}

export interface UserSkill {
  id: string;
  user_id: string;
  skill_id: string;
  status: SkillStatus;
  
  // Details
  theory_score?: number;
  practice_checked_by?: string; // Brigadir ID
  practice_date?: string;
  confirmed_at?: string;
  rejection_reason?: string;
  
  // Checklist Progress
  checklist_progress?: Record<number, ChecklistItemState>;

  // Enhanced Verification Data
  verification_attachments?: VerificationAttachment[];
  verification_notes?: VerificationNote[];
  verification_logs?: VerificationLog[];

  // For Documents
  document_url?: string; // Legacy single file
  document_urls?: string[]; // Multiple files support
  expiry_date?: string;
  
  // For Custom/Extra Documents (Candidate Uploads)
  custom_name?: string;
  is_indefinite?: boolean;
  issue_date?: string;
  expires_at?: string;
  bonus_value?: number; // For non-standard skills/docs

  is_archived?: boolean; // Soft delete
  effective_from?: string; // Date when rate increase starts (M+1 logic)
}

// Added GradingStrategy enum
export enum GradingStrategy {
    ALL_CORRECT = 'all_correct',
    MIN_2_CORRECT = 'min_2_correct',
    ANY_CORRECT = 'any_correct'
}

// Fixed Question interface to use GradingStrategy and provided properties
export interface Question {
  id: string;
  text: string;
  options: string[];
  correctOptionIndices: number[];
  gradingStrategy: GradingStrategy;
  imageUrl?: string;
  timeLimit?: number; // in seconds
}

export interface Test {
  id: string;
  skill_ids: string[]; // One test can cover multiple skills (e.g. SEP theory covers multiple)
  title: string;
  questions: Question[];
  time_limit_minutes: number;
  is_active: boolean;
  is_archived?: boolean;
}

// Added TestAttempt interface
export interface TestAttempt {
  id: string;
  user_id: string;
  test_id: string;
  score: number;
  passed: boolean;
  completed_at: string;
  duration_seconds?: number;
  answers?: any;
}

// Added PracticalCheckItem and PracticalCheckTemplate interfaces
export interface PracticalCheckItem {
    id: number;
    text_pl: string;
    required: boolean;
    points?: number;
}

export interface PracticalCheckTemplate {
    id: string;
    skill_id: string;
    title_pl: string;
    min_points_to_pass: number;
    items: PracticalCheckItem[];
}

export interface BonusDocumentType {
  id: string;
  label: string;
  bonus: number;
}

// Added SalaryHistoryEntry interface
export interface SalaryHistoryEntry {
  id: string;
  user_id: string;
  change_date: string;
  reason: string;
  old_rate: number;
  new_rate: number;
  changed_by_id: string;
}

// Added LibraryResource interface
export interface LibraryResource {
  id: string;
  title: string;
  description?: string;
  type: 'pdf' | 'video' | 'link' | 'mixed';
  category?: SkillCategory; // for backward compatibility
  categories?: SkillCategory[];
  skill_ids: string[];
  url: string;
  videoUrl?: string;
  imageUrl?: string;
  textContent?: string;
  is_archived: boolean;
}

// Added CandidateHistoryEntry interface
export interface CandidateHistoryEntry {
    id: string;
    candidate_id: string;
    created_at: string;
    action: string;
    performed_by: string;
}

// Added QualityIncident interface
export interface QualityIncident {
    id: string;
    user_id: string;
    skill_id: string;
    date: string;
    incident_number: number;
    description: string;
    reported_by: string;
    image_url?: string;
}

// Added Note enums and interface
export enum NoteCategory {
    GENERAL = 'Ogólna',
    ATTITUDE = 'Postawa',
    QUALITY = 'Jakość',
    PUNCTUALITY = 'Punktualność',
    SAFETY = 'BHP'
}

export enum NoteSeverity {
    INFO = 'info',
    WARNING = 'warning',
    CRITICAL = 'critical'
}

export interface EmployeeNote {
    id: string;
    employee_id: string;
    author_id: string;
    category: NoteCategory;
    severity?: NoteSeverity;
    text: string;
    created_at: string;
}

// Added Badge enums and interface
export enum BadgeType {
    SPEED = 'Szybkość',
    QUALITY = 'Jakość',
    HELP = 'Pomocność',
    RELIABILITY = 'Rzetelność',
    SAFETY = 'BHP'
}

export interface EmployeeBadge {
    id: string;
    employee_id: string;
    author_id: string;
    month: string; // YYYY-MM
    type: BadgeType;
    description: string;
    visible_to_employee: boolean;
    created_at: string;
}

// Added Notification enums and interfaces
export enum NotificationChannel {
    SYSTEM = 'system',
    EMAIL = 'email',
    SMS = 'sms',
    BOTH = 'both'
}

export interface NotificationTemplate {
    id: string;
    code: string;
    channel: NotificationChannel;
    subject: string;
    body: string;
    variables: string[];
    is_active: boolean;
    created_at: string;
}

// Added MonthlyBonus interface
export interface MonthlyBonus {
    kontrola_pracownikow: boolean;
    realizacja_planu: boolean;
    brak_usterek: boolean;
    brak_naduzyc_materialowych: boolean;
    staz_pracy_years: number;
}

export interface SystemConfig {
    baseRate: number;
    contractBonuses: Record<string, number>;
    studentBonus: number;
    bonusDocumentTypes: BonusDocumentType[];
    bonusPermissionTypes: BonusDocumentType[];
    terminationReasons: string[];
    positions: string[]; // Legacy
    notificationProviders?: {
        email: { enabled: boolean; provider: 'postmark'; apiKey: string; fromEmail: string; fromName: string; };
        sms: { enabled: boolean; provider: 'smsapi'; apiKey: string; senderId: string; quietHoursStart: number; quietHoursEnd: number; };
    };
}
