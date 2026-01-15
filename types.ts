
export interface AppNotification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
}

export interface NotificationSetting {
    id?: string; // UUID z bazy danych
    setting_type: string; // Logiczny kod (np. 'cand_reg')
    label: string;
    category: 'rekrutacja' | 'trial' | 'skills' | 'quality' | 'referrals' | 'system';
    target_role: Role | 'work_manager'; 
    system: boolean;
    email: boolean;
    sms: boolean;
}

export interface NotificationSettingUpdate extends Partial<NotificationSetting> {
    setting_type: string;
    target_role: Role | 'work_manager';
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
  INVITED = 'invited',
  STARTED = 'started',
  TESTS_IN_PROGRESS = 'tests_in_progress',
  TESTS_COMPLETED = 'tests_completed',
  INTERESTED = 'interested',
  NOT_INTERESTED = 'not_interested',
  REJECTED = 'rejected',
  OFFER_SENT = 'offer_sent',
  DATA_REQUESTED = 'data_requested',
  DATA_SUBMITTED = 'data_submitted',
  PORTAL_BLOCKED = 'portal_blocked',
  TRIAL = 'trial',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum ContractType {
  UOP = 'uop',
  UZ = 'uz',
  B2B = 'b2b'
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
  PENDING = 'pending',
  THEORY_PASSED = 'theory_passed',
  PRACTICE_PENDING = 'practice_pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  SUSPENDED = 'suspended'
}

/**
 * Added GradingStrategy enum to support test evaluation logic and fix imports in HR and Candidate pages.
 */
export enum GradingStrategy {
  ALL_CORRECT = 'all_correct',
  ANY_CORRECT = 'any_correct',
  MIN_2_CORRECT = 'min_2_correct'
}

/**
 * Added Question interface to define the structure of test questions.
 */
export interface Question {
  id: string;
  text: string;
  options: string[];
  correctOptionIndices: number[];
  gradingStrategy: GradingStrategy;
  timeLimit?: number;
  imageUrl?: string;
}

export interface Skill {
  id: string;
  name_pl: string;
  category: string; // Changed from enum to string for dynamic support
  description_pl: string;
  verification_type: VerificationType;
  hourly_bonus: number;
  required_pass_rate: number;
  criteria?: string[];
  is_active?: boolean;
  is_archived?: boolean;
}

export interface Position {
  id: string;
  name: string;
  responsibilities: string[];
  required_skill_ids: string[];
  min_monthly_rate?: number;
  max_monthly_rate?: number;
  salary_type: 'hourly' | 'monthly';
  order: number;
  referral_bonus?: number;
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  status: UserStatus;
  base_rate?: number;
  contract_type?: ContractType;
  is_student?: boolean;
  phone?: string;
  hired_date: string;
  contract_end_date?: string;
  trial_end_date?: string;
  assigned_brigadir_id?: string;
  referred_by_id?: string;
  referral_bonus_paid?: boolean;
  referral_bonus_paid_date?: string;
  source?: string;
  notes?: string;
  resume_url?: string;
  target_position?: string;
  pesel?: string;
  birth_date?: string;
  citizenship?: string;
  document_type?: string;
  document_number?: string;
  zip_code?: string;
  city?: string;
  street?: string;
  house_number?: string;
  apartment_number?: string;
  bank_account?: string;
  nip?: string;
  termination_date?: string;
  termination_reason?: string;
  termination_initiator?: 'employee' | 'company';
  qualifications?: string[];
}

export interface UserSkill {
  id: string;
  user_id: string;
  skill_id: string;
  status: SkillStatus;
  theory_score?: number;
  practice_checked_by?: string;
  practice_date?: string;
  confirmed_at?: string;
  rejection_reason?: string;
  checklist_progress?: Record<number, any>;
  document_url?: string;
  document_urls?: string[];
  expiry_date?: string;
  custom_name?: string;
  custom_type?: string;
  is_indefinite?: boolean;
  issue_date?: string;
  expires_at?: string;
  bonus_value?: number;
  is_archived?: boolean;
  effective_from?: string;
}

/**
 * Updated Test interface to use the Question interface for stronger typing.
 */
export interface Test {
  id: string;
  skill_ids: string[];
  title: string;
  questions: Question[];
  time_limit_minutes: number;
  is_active: boolean;
  is_archived?: boolean;
}

/**
 * Added TestAttempt interface to track user performance on qualification tests.
 */
export interface TestAttempt {
  id: string;
  user_id: string;
  test_id: string;
  score: number;
  passed: boolean;
  completed_at: string;
  duration_seconds?: number;
}

/**
 * Added BonusDocumentType for HR system configuration.
 */
export interface BonusDocumentType {
  id: string;
  label: string;
  bonus: number;
}

export interface SystemConfig {
    baseRate: number;
    overtimeBonus: number;
    holidayBonus: number;
    seniorityBonus: number;
    delegationBonus: number;
    contractBonuses: Record<string, number>;
    studentBonus: number;
    bonusDocumentTypes: BonusDocumentType[];
    bonusPermissionTypes: BonusDocumentType[];
    terminationReasons: string[];
    positions: string[];
    noteCategories: string[];
    badgeTypes: string[];
    skillCategories: string[]; // Added
}

export interface CandidateHistoryEntry {
    id: string;
    candidate_id: string;
    created_at: string;
    action: string;
    performed_by: string;
}

export interface QualityIncident {
    id: string;
    user_id: string;
    skill_id: string;
    date: string;
    incident_number: number;
    description: string;
    reported_by: string;
    image_url?: string;
    image_urls?: string[];
}

export enum NoteCategory {
    GENERAL = 'Ogólna',
    ATTITUDE = 'Postawa',
    QUALITY = 'Jakość',
    PUNCTUALITY = 'Punktualność',
    SAFETY = 'BHP'
}

/**
 * Added NoteSeverity enum for employee evaluation notes.
 */
export enum NoteSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical'
}

export interface EmployeeNote {
    id: string;
    employee_id: string;
    author_id: string;
    category: string;
    text: string;
    created_at: string;
}

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
    month: string;
    type: string;
    description: string;
    visible_to_employee: boolean;
    created_at: string;
}

export interface MonthlyBonus {
    kontrola_pracownikow: boolean;
    realizacja_planu: boolean;
    brak_usterek: boolean;
    brak_naduzyc_materialowych: boolean;
    staz_pracy_years: number;
}

export interface LibraryResource {
  id: string;
  title: string;
  description?: string;
  type: 'pdf' | 'video' | 'link' | 'mixed';
  category?: string; // Changed from enum
  categories?: string[]; // Changed from enum
  skill_ids: string[];
  url: string;
  videoUrl?: string;
  imageUrl?: string;
  file_urls?: string[]; // Added for multiple files
  textContent?: string;
  is_archived: boolean;
}

/**
 * Added missing interfaces for practical verification and coordinator workflows.
 */

export interface PracticalCheckItem {
  id: number;
  text_pl: string;
  required: boolean;
  points: number;
}

export interface PracticalCheckTemplate {
  id: string;
  skill_id: string;
  title_pl: string;
  min_points_to_pass: number;
  items: PracticalCheckItem[];
}

export interface ChecklistItemState {
  checked: boolean;
  image_url?: string;
}

export interface VerificationAttachment {
  id: string;
  url: string;
  type: string;
  created_at: string;
}

export interface VerificationNote {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
}

export interface VerificationLog {
  id: string;
  action: string;
  performed_by: string;
  created_at: string;
}

/**
 * Added Notification related interfaces for HR settings.
 */

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

/**
 * Added SalaryHistoryEntry for rate change tracking.
 */
export interface SalaryHistoryEntry {
  id: string;
  user_id: string;
  date: string;
  rate: number;
  change_reason: string;
}
