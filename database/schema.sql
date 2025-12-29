-- ============================================================
-- MAXMASTER SKILLS PLATFORM - DATABASE SCHEMA
-- ============================================================
-- Полная схема базы данных для платформы управления навыками
-- Поддерживает: PostgreSQL 12+
-- ============================================================

-- Создание базы данных
-- CREATE DATABASE maxmaster_skills;
-- \c maxmaster_skills;

-- Включение расширений
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE user_role AS ENUM (
    'admin',
    'hr',
    'brigadir',
    'employee',
    'candidate',
    'coordinator'
);

CREATE TYPE user_status AS ENUM (
    -- Candidate Stages
    'invited',
    'started',
    'tests_in_progress',
    'tests_completed',
    'interested',
    'not_interested',
    'rejected',
    'offer_sent',
    'data_requested',
    'data_submitted',
    'portal_blocked',
    -- Employee Stages
    'trial',
    'active',
    'inactive'
);

CREATE TYPE contract_type AS ENUM (
    'uop',  -- Umowa o Pracę
    'uz',   -- Umowa Zlecenie
    'b2b'   -- B2B
);

CREATE TYPE skill_category AS ENUM (
    'PRACE MONTAŻOWE',
    'INSTALACJE ELEKTRYCZNE',
    'TELETECHNICZNE',
    'AUTOMATYKA',
    'PPOŻ',
    'POMIARY I PROTOKOŁY',
    'UPRAWNIENIA',
    'BRYGADZISTA',
    'TECZKA STANOWISKOWA',
    'TECZKA PRACOWNICZA',
    'INNE'
);

CREATE TYPE verification_type AS ENUM (
    'theory_only',
    'theory_practice',
    'document'
);

CREATE TYPE skill_status AS ENUM (
    'locked',
    'pending',
    'theory_passed',
    'practice_pending',
    'confirmed',
    'failed',
    'suspended'
);

CREATE TYPE grading_strategy AS ENUM (
    'all_correct',
    'min_2_correct',
    'any_correct'
);

CREATE TYPE note_category AS ENUM (
    'Ogólna',
    'Postawa',
    'Jakość',
    'Punktualność',
    'BHP'
);

CREATE TYPE note_severity AS ENUM (
    'info',
    'warning',
    'critical'
);

CREATE TYPE badge_type AS ENUM (
    'Szybkość',
    'Jakość',
    'Pomocność',
    'Rzetelność',
    'BHP'
);

CREATE TYPE notification_channel AS ENUM (
    'system',
    'email',
    'sms',
    'both'
);

CREATE TYPE resource_type AS ENUM (
    'pdf',
    'video',
    'link',
    'mixed'
);

-- ============================================================
-- MAIN TABLES
-- ============================================================

-- ========== USERS TABLE ==========
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- Для аутентификации
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL DEFAULT 'candidate',
    status user_status NOT NULL DEFAULT 'invited',

    -- Financials
    base_rate DECIMAL(10, 2) DEFAULT 24.00,
    contract_type contract_type,
    is_student BOOLEAN DEFAULT FALSE,

    -- Contact Information
    phone VARCHAR(50),

    -- HR Data
    hired_date TIMESTAMP,
    contract_end_date TIMESTAMP,
    trial_end_date TIMESTAMP,
    assigned_brigadir_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Referral System
    referred_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    referral_bonus_paid BOOLEAN DEFAULT FALSE,
    referral_bonus_paid_date TIMESTAMP,

    -- Candidate Data
    source VARCHAR(255), -- Skąd przyszedł (OLX, Polecenie, etc.)
    notes TEXT,
    resume_url VARCHAR(500),
    target_position VARCHAR(100),

    -- Personal Data (For Contract)
    pesel VARCHAR(11),
    birth_date DATE,
    citizenship VARCHAR(100),
    document_type VARCHAR(50),
    document_number VARCHAR(50),
    zip_code VARCHAR(10),
    city VARCHAR(100),
    street VARCHAR(200),
    house_number VARCHAR(20),
    apartment_number VARCHAR(20),
    bank_account VARCHAR(50),
    nip VARCHAR(20),

    -- Termination Data
    termination_date TIMESTAMP,
    termination_reason TEXT,
    termination_initiator VARCHAR(20), -- 'employee' or 'company'

    -- Qualifications Selection (JSON array of IDs)
    qualifications JSONB DEFAULT '[]',

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Indexes
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_assigned_brigadir ON users(assigned_brigadir_id);
CREATE INDEX idx_users_referred_by ON users(referred_by_id);

-- ========== POSITIONS TABLE ==========
CREATE TABLE positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    responsibilities TEXT[], -- Array of responsibilities
    required_skill_ids UUID[], -- Array of skill IDs
    min_monthly_rate DECIMAL(10, 2),
    max_monthly_rate DECIMAL(10, 2),
    brigadier_bonuses JSONB DEFAULT '[]', -- Array of {id, name, amount}
    "order" INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_positions_order ON positions("order");

-- ========== SKILLS TABLE ==========
CREATE TABLE skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name_pl VARCHAR(255) NOT NULL,
    category skill_category NOT NULL,
    description_pl TEXT,
    verification_type verification_type NOT NULL,
    hourly_bonus DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    required_pass_rate INTEGER NOT NULL DEFAULT 80,
    criteria TEXT[], -- Array of detailed criteria
    is_active BOOLEAN DEFAULT TRUE,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_skills_category ON skills(category);
CREATE INDEX idx_skills_active ON skills(is_active);
CREATE INDEX idx_skills_archived ON skills(is_archived);

-- ========== USER_SKILLS TABLE ==========
CREATE TABLE user_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
    status skill_status NOT NULL DEFAULT 'pending',

    -- Theory Test Data
    theory_score INTEGER,

    -- Practice Verification Data
    practice_checked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    practice_date TIMESTAMP,
    confirmed_at TIMESTAMP,
    rejection_reason TEXT,

    -- Checklist Progress (JSON object: {itemId: {checked, image_url, checkedBy, checkedAt}})
    checklist_progress JSONB DEFAULT '{}',

    -- Document Data
    document_url VARCHAR(500),
    document_urls TEXT[], -- Multiple files support
    expiry_date DATE,

    -- Custom Documents (Candidate Uploads)
    custom_name VARCHAR(255),
    is_indefinite BOOLEAN DEFAULT FALSE,
    issue_date DATE,
    expires_at DATE,
    bonus_value DECIMAL(10, 2),

    -- Archiving
    is_archived BOOLEAN DEFAULT FALSE,
    effective_from DATE, -- Date when rate increase starts (M+1 logic)

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, skill_id, custom_name)
);

CREATE INDEX idx_user_skills_user ON user_skills(user_id);
CREATE INDEX idx_user_skills_skill ON user_skills(skill_id);
CREATE INDEX idx_user_skills_status ON user_skills(status);
CREATE INDEX idx_user_skills_archived ON user_skills(is_archived);

-- ========== VERIFICATION ATTACHMENTS TABLE ==========
CREATE TABLE verification_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_skill_id UUID NOT NULL REFERENCES user_skills(id) ON DELETE CASCADE,
    url VARCHAR(500) NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'photo' or 'file'
    name VARCHAR(255),
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_verification_attachments_user_skill ON verification_attachments(user_skill_id);

-- ========== VERIFICATION NOTES TABLE ==========
CREATE TABLE verification_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_skill_id UUID NOT NULL REFERENCES user_skills(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    author UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_role user_role NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_verification_notes_user_skill ON verification_notes(user_skill_id);

-- ========== VERIFICATION LOGS TABLE ==========
CREATE TABLE verification_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_skill_id UUID NOT NULL REFERENCES user_skills(id) ON DELETE CASCADE,
    action VARCHAR(255) NOT NULL,
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    performed_by_role user_role,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_verification_logs_user_skill ON verification_logs(user_skill_id);
CREATE INDEX idx_verification_logs_created ON verification_logs(created_at);

-- ========== TESTS TABLE ==========
CREATE TABLE tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    skill_ids UUID[] NOT NULL, -- Array of skill IDs
    title VARCHAR(255) NOT NULL,
    time_limit_minutes INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tests_active ON tests(is_active);
CREATE INDEX idx_tests_archived ON tests(is_archived);

-- ========== QUESTIONS TABLE ==========
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    options TEXT[] NOT NULL, -- Array of option strings
    correct_option_indices INTEGER[] NOT NULL, -- Array of correct indices
    grading_strategy grading_strategy NOT NULL DEFAULT 'all_correct',
    image_url VARCHAR(500),
    time_limit INTEGER, -- in seconds
    question_order INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_questions_test ON questions(test_id);
CREATE INDEX idx_questions_order ON questions(test_id, question_order);

-- ========== TEST ATTEMPTS TABLE ==========
CREATE TABLE test_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    passed BOOLEAN NOT NULL,
    duration_seconds INTEGER,
    answers JSONB, -- Сохранение ответов пользователя
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_test_attempts_user ON test_attempts(user_id);
CREATE INDEX idx_test_attempts_test ON test_attempts(test_id);
CREATE INDEX idx_test_attempts_completed ON test_attempts(completed_at);

-- ========== PRACTICAL CHECK TEMPLATES TABLE ==========
CREATE TABLE practical_check_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    title_pl VARCHAR(255) NOT NULL,
    min_points_to_pass INTEGER NOT NULL,
    items JSONB NOT NULL, -- Array of {id, text_pl, required, points}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_practical_templates_skill ON practical_check_templates(skill_id);

-- ========== LIBRARY RESOURCES TABLE ==========
CREATE TABLE library_resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type resource_type NOT NULL,
    category skill_category,
    categories skill_category[], -- Multiple categories support
    skill_ids UUID[], -- Array of related skill IDs
    url VARCHAR(500) NOT NULL,
    video_url VARCHAR(500),
    image_url VARCHAR(500),
    text_content TEXT,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_library_type ON library_resources(type);
CREATE INDEX idx_library_category ON library_resources(category);
CREATE INDEX idx_library_archived ON library_resources(is_archived);

-- ========== CANDIDATE HISTORY TABLE ==========
CREATE TABLE candidate_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    performed_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_candidate_history_candidate ON candidate_history(candidate_id);
CREATE INDEX idx_candidate_history_created ON candidate_history(created_at);

-- ========== QUALITY INCIDENTS TABLE ==========
CREATE TABLE quality_incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    incident_number INTEGER NOT NULL,
    description TEXT NOT NULL,
    reported_by VARCHAR(255) NOT NULL,
    image_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_quality_incidents_user ON quality_incidents(user_id);
CREATE INDEX idx_quality_incidents_skill ON quality_incidents(skill_id);
CREATE INDEX idx_quality_incidents_date ON quality_incidents(created_at);

-- ========== EMPLOYEE NOTES TABLE ==========
CREATE TABLE employee_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category note_category NOT NULL,
    severity note_severity DEFAULT 'info',
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_employee_notes_employee ON employee_notes(employee_id);
CREATE INDEX idx_employee_notes_author ON employee_notes(author_id);
CREATE INDEX idx_employee_notes_created ON employee_notes(created_at);

-- ========== EMPLOYEE BADGES TABLE ==========
CREATE TABLE employee_badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month VARCHAR(7) NOT NULL, -- YYYY-MM format
    type badge_type NOT NULL,
    description TEXT,
    visible_to_employee BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_employee_badges_employee ON employee_badges(employee_id);
CREATE INDEX idx_employee_badges_month ON employee_badges(month);

-- ========== MONTHLY BONUSES TABLE ==========
CREATE TABLE monthly_bonuses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month VARCHAR(7) NOT NULL, -- YYYY-MM format
    kontrola_pracownikow BOOLEAN DEFAULT FALSE,
    realizacja_planu BOOLEAN DEFAULT FALSE,
    brak_usterek BOOLEAN DEFAULT FALSE,
    brak_naduzyc_materialowych BOOLEAN DEFAULT FALSE,
    staz_pracy_years INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, month)
);

CREATE INDEX idx_monthly_bonuses_user ON monthly_bonuses(user_id);
CREATE INDEX idx_monthly_bonuses_month ON monthly_bonuses(month);

-- ========== SALARY HISTORY TABLE ==========
CREATE TABLE salary_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    change_date TIMESTAMP NOT NULL,
    reason TEXT NOT NULL,
    old_rate DECIMAL(10, 2) NOT NULL,
    new_rate DECIMAL(10, 2) NOT NULL,
    changed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_salary_history_user ON salary_history(user_id);
CREATE INDEX idx_salary_history_date ON salary_history(change_date);

-- ========== NOTIFICATIONS TABLE ==========
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    link VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at);

-- ========== NOTIFICATION SETTINGS TABLE ==========
CREATE TABLE notification_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    setting_type VARCHAR(100) NOT NULL,
    label VARCHAR(255) NOT NULL,
    system_enabled BOOLEAN DEFAULT TRUE,
    email_enabled BOOLEAN DEFAULT FALSE,
    sms_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, setting_type)
);

CREATE INDEX idx_notification_settings_user ON notification_settings(user_id);

-- ========== NOTIFICATION TEMPLATES TABLE ==========
CREATE TABLE notification_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(100) UNIQUE NOT NULL,
    channel notification_channel NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    variables TEXT[], -- Array of variable names
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notification_templates_code ON notification_templates(code);
CREATE INDEX idx_notification_templates_active ON notification_templates(is_active);

-- ========== SYSTEM CONFIG TABLE ==========
CREATE TABLE system_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Вставляем базовую конфигурацию
INSERT INTO system_config (config_key, config_value, description) VALUES
('base_rate', '24.00', 'Базовая почасовая ставка'),
('contract_bonuses', '{"uop": 0, "uz": 1, "b2b": 7}', 'Бонусы по типам контрактов'),
('student_bonus', '3.00', 'Бонус для студентов'),
('termination_reasons', '["Niesatysfakcjonujące wynagrodzenie", "Brak możliwości rozwoju", "Zła atmosfera w zespole", "Lepsza oferta konkurencji", "Przyczyny osobiste / Relokacja", "Niewywiązywanie się z obowiązków (Zwolnienie)", "Naruszenie regulaminu pracy", "Koniec umowy / projektu", "Inne"]', 'Причины увольнения'),
('notification_providers', '{"email": {"enabled": false}, "sms": {"enabled": false}}', 'Настройки провайдеров уведомлений');

-- ========== BONUS DOCUMENT TYPES TABLE ==========
CREATE TABLE bonus_document_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type_id VARCHAR(50) UNIQUE NOT NULL,
    label VARCHAR(255) NOT NULL,
    bonus DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Вставляем стандартные типы документов
INSERT INTO bonus_document_types (type_id, label, bonus) VALUES
('sep_e', 'SEP E z pomiarami', 0.5),
('sep_d', 'SEP D z pomiarami', 0.5),
('udt_pod', 'UDT - Podnośniki (IP)', 1.0),
('bhp_szkol', 'Szkolenie BHP (Wstępne/Okresowe)', 0.0),
('badania', 'Orzeczenie Lekarskie (Wysokościowe)', 0.0),
('other', 'Inny dokument', 0.0);

-- ============================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Применяем триггер ко всем таблицам с updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_positions_updated_at BEFORE UPDATE ON positions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_skills_updated_at BEFORE UPDATE ON skills FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_skills_updated_at BEFORE UPDATE ON user_skills FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tests_updated_at BEFORE UPDATE ON tests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_practical_templates_updated_at BEFORE UPDATE ON practical_check_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_library_updated_at BEFORE UPDATE ON library_resources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_monthly_bonuses_updated_at BEFORE UPDATE ON monthly_bonuses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notification_settings_updated_at BEFORE UPDATE ON notification_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notification_templates_updated_at BEFORE UPDATE ON notification_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================

-- View: Active Employees with their current rates
CREATE VIEW v_active_employees AS
SELECT
    u.id,
    u.first_name,
    u.last_name,
    u.email,
    u.role,
    u.status,
    u.base_rate,
    u.contract_type,
    u.assigned_brigadir_id,
    COUNT(DISTINCT us.id) FILTER (WHERE us.status = 'confirmed') as confirmed_skills_count,
    SUM(s.hourly_bonus) FILTER (WHERE us.status = 'confirmed') as total_skill_bonuses
FROM users u
LEFT JOIN user_skills us ON u.id = us.user_id AND us.is_archived = FALSE
LEFT JOIN skills s ON us.skill_id = s.id
WHERE u.status IN ('active', 'trial')
GROUP BY u.id;

-- View: Candidates Summary
CREATE VIEW v_candidates_summary AS
SELECT
    u.id,
    u.first_name,
    u.last_name,
    u.email,
    u.status,
    u.source,
    u.target_position,
    COUNT(DISTINCT ta.id) as tests_taken,
    COUNT(DISTINCT ta.id) FILTER (WHERE ta.passed = TRUE) as tests_passed
FROM users u
LEFT JOIN test_attempts ta ON u.id = ta.user_id
WHERE u.role = 'candidate'
GROUP BY u.id;

-- View: Skills Statistics
CREATE VIEW v_skills_statistics AS
SELECT
    s.id,
    s.name_pl,
    s.category,
    s.hourly_bonus,
    COUNT(DISTINCT us.user_id) FILTER (WHERE us.status = 'confirmed') as employees_with_skill,
    COUNT(DISTINCT us.user_id) FILTER (WHERE us.status IN ('pending', 'theory_passed', 'practice_pending')) as in_progress_count
FROM skills s
LEFT JOIN user_skills us ON s.id = us.skill_id AND us.is_archived = FALSE
WHERE s.is_archived = FALSE
GROUP BY s.id;

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

-- Composite indexes for common queries
CREATE INDEX idx_user_skills_user_status ON user_skills(user_id, status) WHERE is_archived = FALSE;
CREATE INDEX idx_test_attempts_user_passed ON test_attempts(user_id, passed);
CREATE INDEX idx_users_role_status ON users(role, status);

-- Full-text search indexes (for PostgreSQL)
CREATE INDEX idx_users_name_search ON users USING gin(to_tsvector('simple', first_name || ' ' || last_name));
CREATE INDEX idx_skills_name_search ON skills USING gin(to_tsvector('simple', name_pl));

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE users IS 'Основная таблица пользователей: кандидаты, сотрудники, HR, администраторы';
COMMENT ON TABLE skills IS 'Навыки и умения, которые могут быть подтверждены';
COMMENT ON TABLE user_skills IS 'Связь пользователей с навыками и их статус подтверждения';
COMMENT ON TABLE tests IS 'Тесты для проверки теоретических знаний';
COMMENT ON TABLE questions IS 'Вопросы в тестах';
COMMENT ON TABLE test_attempts IS 'Попытки прохождения тестов пользователями';
COMMENT ON TABLE positions IS 'Должности в компании с требованиями';
COMMENT ON TABLE library_resources IS 'Библиотека обучающих материалов';
COMMENT ON TABLE quality_incidents IS 'Инциденты качества работы';
COMMENT ON TABLE employee_notes IS 'Заметки о сотрудниках';
COMMENT ON TABLE employee_badges IS 'Награды и значки сотрудников';
COMMENT ON TABLE salary_history IS 'История изменений зарплаты';
COMMENT ON TABLE monthly_bonuses IS 'Ежемесячные бонусы сотрудников';

-- ============================================================
-- END OF SCHEMA
-- ============================================================
