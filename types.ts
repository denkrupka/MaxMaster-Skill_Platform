
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
  // Global roles (is_global_user = true)
  SUPERADMIN = 'superadmin',
  SALES = 'sales',
  DORADCA = 'doradca',

  // Company roles (is_global_user = false)
  COMPANY_ADMIN = 'company_admin',
  HR = 'hr',
  COORDINATOR = 'coordinator',
  BRIGADIR = 'brigadir',
  EMPLOYEE = 'employee',
  CANDIDATE = 'candidate',
  TRIAL = 'trial',

  // Legacy (for backward compatibility during migration)
  ADMIN = 'admin'
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
  required_document_ids?: string[];
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
  is_blocked?: boolean;
  blocked_at?: string;
  blocked_reason?: string;
  plain_password?: string;

  // Multi-company fields
  company_id?: string;
  is_global_user?: boolean;
  invitation_token?: string;
  invitation_expires_at?: string;
  invited_by?: string;
  available_modules?: string[];
}

// =====================================================
// MULTI-COMPANY TYPES
// =====================================================

export type CompanyStatus = 'active' | 'suspended' | 'cancelled' | 'trial';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled';

export interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;

  // Legal data (for invoices)
  legal_name?: string;
  tax_id?: string; // NIP
  regon?: string;
  address_street?: string;
  address_city?: string;
  address_postal_code?: string;
  address_country?: string;

  // Contact data
  contact_email?: string;
  contact_phone?: string;
  billing_email?: string;

  // Additional info
  industry?: string;

  // Status
  status: CompanyStatus;
  is_blocked: boolean;
  blocked_at?: string;
  blocked_reason?: string;

  // Subscription
  trial_ends_at?: string;
  subscription_status: SubscriptionStatus;

  // Stripe
  stripe_customer_id?: string;
  stripe_subscription_id?: string;

  // Bonus balance
  bonus_balance: number;

  // Referral program
  referred_by_company_id?: string;
  referral_bonus_paid?: boolean;
  referral_bonus_paid_at?: string;

  // Settings
  settings?: Record<string, any>;

  // Metadata
  created_at: string;
  updated_at?: string;
  created_by?: string;
  sales_owner_id?: string;
  doradca_id?: string;
}

export interface Module {
  code: string;
  name_pl: string;
  name_en?: string;
  description_pl?: string;
  description_en?: string;
  available_roles: string[];
  base_price_per_user: number;
  is_active: boolean;
  display_order: number;
  icon?: string;
  created_at: string;
}

export interface CompanyModule {
  id: string;
  company_id: string;
  module_code: string;
  max_users: number;
  current_users: number;
  price_per_user: number;
  billing_cycle: 'monthly' | 'yearly';
  is_active: boolean;
  activated_at: string;
  deactivated_at?: string;
  demo_end_date?: string | null;
  stripe_subscription_id?: string;
  stripe_subscription_item_id?: string;
  next_billing_cycle_price?: number | null;
  price_scheduled_at?: string | null;
  scheduled_max_users?: number | null;
  scheduled_change_at?: string | null;
  subscription_period_end?: string | null;
  subscription_period_start?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface ModuleUserAccess {
  id: string;
  company_id: string;
  user_id: string;
  module_code: string;
  is_enabled: boolean;
  enabled_at: string;
  disabled_at?: string;
  days_used: number;
  created_at: string;
}

export interface PaymentHistory {
  id: string;
  company_id: string;
  stripe_invoice_id?: string;
  stripe_payment_intent_id?: string;
  amount: number;
  currency: string;
  status: 'paid' | 'failed' | 'pending' | 'refunded';
  invoice_number?: string;
  invoice_pdf_url?: string;
  description?: string;
  paid_at?: string;
  created_at: string;
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
  questions_to_display?: number; // Optional: number of questions to show from total pool. If not set, shows all questions.
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

    // Sales limits (set by SuperAdmin)
    salesMaxDiscountPercent: number;      // Max discount % a salesperson can give
    salesMaxFreeExtensionDays: number;    // Max free extension days a salesperson can give

    // Referral program settings (set by SuperAdmin)
    referralMinPaymentAmount: number;     // Min payment by referral to trigger bonus (default: 100 PLN)
    referralBonusAmount: number;          // Bonus for inviter (default: 50 PLN)
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

// =============================================
// CRM Types for Sales Module
// =============================================

export enum DealStage {
  LEAD = 'lead',
  QUALIFIED = 'qualified',
  PROPOSAL = 'proposal',
  NEGOTIATION = 'negotiation',
  WON = 'won',
  LOST = 'lost'
}

export enum DealPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum ActivityType {
  CALL = 'call',
  EMAIL = 'email',
  MEETING = 'meeting',
  NOTE = 'note',
  TASK = 'task'
}

export interface CRMCompany {
  id: string;
  name: string;
  legal_name?: string;
  tax_id?: string;
  regon?: string;
  industry?: string;
  website?: string;
  address_street?: string;
  address_city?: string;
  address_postal_code?: string;
  address_country?: string;
  employee_count?: number;
  annual_revenue?: number;
  notes?: string;
  status: string;
  source?: string;
  assigned_sales_id?: string;
  // Portal account linking
  linked_company_id?: string;
  // Subscription info (synced from linked company)
  subscription_status?: 'brak' | 'trialing' | 'active' | 'past_due' | 'cancelled';
  subscription_end_date?: string;
  created_at: string;
  updated_at: string;
}

export interface CRMContact {
  id: string;
  crm_company_id?: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  position?: string;
  department?: string;
  is_decision_maker: boolean;
  linkedin_url?: string;
  notes?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CRMDeal {
  id: string;
  title: string;
  crm_company_id?: string;
  contact_id?: string;
  stage: DealStage;
  priority: DealPriority;
  value?: number;
  probability: number;
  expected_close_date?: string;
  actual_close_date?: string;
  lost_reason?: string;
  modules_interested?: string[];
  employee_count_estimate?: number;
  module_user_counts?: Record<string, number>;
  notes?: string;
  assigned_sales_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CRMActivity {
  id: string;
  activity_type: ActivityType;
  subject: string;
  description?: string;
  crm_company_id?: string;
  contact_id?: string;
  deal_id?: string;
  scheduled_at?: string;
  completed_at?: string;
  is_completed: boolean;
  duration_minutes?: number;
  outcome?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}
