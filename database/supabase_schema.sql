-- ============================================================
-- MAXMASTER SKILLS PLATFORM - SUPABASE SCHEMA
-- ============================================================
-- Адаптированная схема для Supabase
-- Использует встроенную систему auth.users
-- ============================================================

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
    'trial',
    'active',
    'inactive'
);

CREATE TYPE contract_type AS ENUM ('uop', 'uz', 'b2b');

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

CREATE TYPE verification_type AS ENUM ('theory_only', 'theory_practice', 'document');
CREATE TYPE skill_status AS ENUM ('locked', 'pending', 'theory_passed', 'practice_pending', 'confirmed', 'failed', 'suspended');
CREATE TYPE grading_strategy AS ENUM ('all_correct', 'min_2_correct', 'any_correct');
CREATE TYPE note_category AS ENUM ('Ogólna', 'Postawa', 'Jakość', 'Punktualność', 'BHP');
CREATE TYPE note_severity AS ENUM ('info', 'warning', 'critical');
CREATE TYPE badge_type AS ENUM ('Szybkość', 'Jakość', 'Pomocność', 'Rzetelność', 'BHP');
CREATE TYPE notification_channel AS ENUM ('system', 'email', 'sms', 'both');
CREATE TYPE resource_type AS ENUM ('pdf', 'video', 'link', 'mixed');

-- ============================================================
-- USERS TABLE (extends auth.users)
-- ============================================================

CREATE TABLE users (
    -- Primary key связан с auth.users
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL DEFAULT 'candidate',
    status user_status NOT NULL DEFAULT 'invited',

    -- Financials
    base_rate DECIMAL(10, 2) DEFAULT 24.00,
    contract_type contract_type,
    is_student BOOLEAN DEFAULT FALSE,

    -- Contact
    phone VARCHAR(50),

    -- HR Data
    hired_date TIMESTAMP,
    contract_end_date TIMESTAMP,
    trial_end_date TIMESTAMP,
    assigned_brigadir_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Referral
    referred_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    referral_bonus_paid BOOLEAN DEFAULT FALSE,
    referral_bonus_paid_date TIMESTAMP,

    -- Candidate Data
    source VARCHAR(255),
    notes TEXT,
    resume_url VARCHAR(500),
    target_position VARCHAR(100),

    -- Personal Data
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

    -- Termination
    termination_date TIMESTAMP,
    termination_reason TEXT,
    termination_initiator VARCHAR(20),

    -- Qualifications
    qualifications JSONB DEFAULT '[]',

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_assigned_brigadir ON users(assigned_brigadir_id);

-- Trigger для автообновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Функция для автоматического создания профиля при регистрации
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, first_name, last_name, role, status)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', 'User'),
        COALESCE(NEW.raw_user_meta_data->>'last_name', 'Name'),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'candidate'),
        'started'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger на создание пользователя в auth.users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- POSITIONS
-- ============================================================

CREATE TABLE positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    responsibilities TEXT[],
    required_skill_ids UUID[],
    min_monthly_rate DECIMAL(10, 2),
    max_monthly_rate DECIMAL(10, 2),
    brigadier_bonuses JSONB DEFAULT '[]',
    "order" INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_positions_order ON positions("order");

CREATE TRIGGER positions_updated_at
    BEFORE UPDATE ON positions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SKILLS
-- ============================================================

CREATE TABLE skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_pl VARCHAR(255) NOT NULL,
    category skill_category NOT NULL,
    description_pl TEXT,
    verification_type verification_type NOT NULL,
    hourly_bonus DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    required_pass_rate INTEGER NOT NULL DEFAULT 80,
    criteria TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_skills_category ON skills(category);
CREATE INDEX idx_skills_active ON skills(is_active);

CREATE TRIGGER skills_updated_at
    BEFORE UPDATE ON skills
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- USER_SKILLS
-- ============================================================

CREATE TABLE user_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
    status skill_status NOT NULL DEFAULT 'pending',

    theory_score INTEGER,
    practice_checked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    practice_date TIMESTAMP,
    confirmed_at TIMESTAMP,
    rejection_reason TEXT,

    checklist_progress JSONB DEFAULT '{}',

    document_url VARCHAR(500),
    document_urls TEXT[],
    expiry_date DATE,

    custom_name VARCHAR(255),
    is_indefinite BOOLEAN DEFAULT FALSE,
    issue_date DATE,
    expires_at DATE,
    bonus_value DECIMAL(10, 2),

    is_archived BOOLEAN DEFAULT FALSE,
    effective_from DATE,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_skills_user ON user_skills(user_id);
CREATE INDEX idx_user_skills_skill ON user_skills(skill_id);
CREATE INDEX idx_user_skills_status ON user_skills(status);

CREATE TRIGGER user_skills_updated_at
    BEFORE UPDATE ON user_skills
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- VERIFICATION TABLES
-- ============================================================

CREATE TABLE verification_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_skill_id UUID NOT NULL REFERENCES user_skills(id) ON DELETE CASCADE,
    url VARCHAR(500) NOT NULL,
    type VARCHAR(20) NOT NULL,
    name VARCHAR(255),
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE verification_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_skill_id UUID NOT NULL REFERENCES user_skills(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    author UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_role user_role NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE verification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_skill_id UUID NOT NULL REFERENCES user_skills(id) ON DELETE CASCADE,
    action VARCHAR(255) NOT NULL,
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    performed_by_role user_role,
    details TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TESTS
-- ============================================================

CREATE TABLE tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_ids UUID[] NOT NULL,
    title VARCHAR(255) NOT NULL,
    time_limit_minutes INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TRIGGER tests_updated_at
    BEFORE UPDATE ON tests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    options TEXT[] NOT NULL,
    correct_option_indices INTEGER[] NOT NULL,
    grading_strategy grading_strategy NOT NULL DEFAULT 'all_correct',
    image_url VARCHAR(500),
    time_limit INTEGER,
    question_order INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_questions_test ON questions(test_id);

CREATE TABLE test_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    passed BOOLEAN NOT NULL,
    duration_seconds INTEGER,
    answers JSONB,
    completed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_test_attempts_user ON test_attempts(user_id);
CREATE INDEX idx_test_attempts_test ON test_attempts(test_id);

-- ============================================================
-- PRACTICAL CHECK TEMPLATES
-- ============================================================

CREATE TABLE practical_check_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    title_pl VARCHAR(255) NOT NULL,
    min_points_to_pass INTEGER NOT NULL,
    items JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TRIGGER practical_templates_updated_at
    BEFORE UPDATE ON practical_check_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- LIBRARY RESOURCES
-- ============================================================

CREATE TABLE library_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type resource_type NOT NULL,
    category skill_category,
    categories skill_category[],
    skill_ids UUID[],
    url VARCHAR(500) NOT NULL,
    video_url VARCHAR(500),
    image_url VARCHAR(500),
    text_content TEXT,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_library_type ON library_resources(type);

CREATE TRIGGER library_updated_at
    BEFORE UPDATE ON library_resources
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- CANDIDATE HISTORY
-- ============================================================

CREATE TABLE candidate_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    performed_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_candidate_history_candidate ON candidate_history(candidate_id);

-- ============================================================
-- QUALITY & PERFORMANCE
-- ============================================================

CREATE TABLE quality_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    incident_number INTEGER NOT NULL,
    description TEXT NOT NULL,
    reported_by VARCHAR(255) NOT NULL,
    image_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_quality_incidents_user ON quality_incidents(user_id);
CREATE INDEX idx_quality_incidents_skill ON quality_incidents(skill_id);

CREATE TABLE employee_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category note_category NOT NULL,
    severity note_severity DEFAULT 'info',
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_employee_notes_employee ON employee_notes(employee_id);

CREATE TABLE employee_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month VARCHAR(7) NOT NULL,
    type badge_type NOT NULL,
    description TEXT,
    visible_to_employee BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_employee_badges_employee ON employee_badges(employee_id);

-- ============================================================
-- SALARY & BONUSES
-- ============================================================

CREATE TABLE monthly_bonuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month VARCHAR(7) NOT NULL,
    kontrola_pracownikow BOOLEAN DEFAULT FALSE,
    realizacja_planu BOOLEAN DEFAULT FALSE,
    brak_usterek BOOLEAN DEFAULT FALSE,
    brak_naduzyc_materialowych BOOLEAN DEFAULT FALSE,
    staz_pracy_years INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, month)
);

CREATE TRIGGER monthly_bonuses_updated_at
    BEFORE UPDATE ON monthly_bonuses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TABLE salary_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    change_date TIMESTAMP NOT NULL,
    reason TEXT NOT NULL,
    old_rate DECIMAL(10, 2) NOT NULL,
    new_rate DECIMAL(10, 2) NOT NULL,
    changed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_salary_history_user ON salary_history(user_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    link VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);

CREATE TABLE notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    setting_type VARCHAR(100) NOT NULL,
    label VARCHAR(255) NOT NULL,
    system_enabled BOOLEAN DEFAULT TRUE,
    email_enabled BOOLEAN DEFAULT FALSE,
    sms_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, setting_type)
);

CREATE TRIGGER notification_settings_updated_at
    BEFORE UPDATE ON notification_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TABLE notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) UNIQUE NOT NULL,
    channel notification_channel NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    variables TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TRIGGER notification_templates_updated_at
    BEFORE UPDATE ON notification_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SYSTEM CONFIG
-- ============================================================

CREATE TABLE system_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TRIGGER system_config_updated_at
    BEFORE UPDATE ON system_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TABLE bonus_document_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type_id VARCHAR(50) UNIQUE NOT NULL,
    label VARCHAR(255) NOT NULL,
    bonus DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- VIEWS
-- ============================================================

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

-- ============================================================
-- ROW LEVEL SECURITY (RLS) - БАЗОВЫЕ ПОЛИТИКИ
-- ============================================================

-- Включаем RLS для всех таблиц
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- USERS: Базовые политики
CREATE POLICY "Users can view own profile"
    ON users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "HR/Admin can view all users"
    ON users FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid() AND role IN ('hr', 'admin')
        )
    );

CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "HR/Admin can update all users"
    ON users FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid() AND role IN ('hr', 'admin')
        )
    );

-- SKILLS: Все могут читать, HR/Admin управляют
CREATE POLICY "Anyone authenticated can view skills"
    ON skills FOR SELECT
    TO authenticated
    USING (is_archived = false);

CREATE POLICY "HR/Admin can manage skills"
    ON skills FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid() AND role IN ('hr', 'admin')
        )
    );

-- USER_SKILLS: Пользователь видит свои, HR/Brigadir видят команды
CREATE POLICY "Users can view own skills"
    ON user_skills FOR SELECT
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid() AND role IN ('hr', 'admin', 'brigadir')
        )
    );

CREATE POLICY "Users can insert own skills"
    ON user_skills FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- TESTS: Все аутентифицированные могут читать активные
CREATE POLICY "Authenticated users can view active tests"
    ON tests FOR SELECT
    TO authenticated
    USING (is_active = true AND is_archived = false);

-- TEST_ATTEMPTS: Пользователь может создавать и видеть свои
CREATE POLICY "Users can view own attempts"
    ON test_attempts FOR SELECT
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid() AND role IN ('hr', 'admin')
        )
    );

CREATE POLICY "Users can create own attempts"
    ON test_attempts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- LIBRARY: Все аутентифицированные могут читать
CREATE POLICY "Authenticated users can view library"
    ON library_resources FOR SELECT
    TO authenticated
    USING (is_archived = false);

-- NOTIFICATIONS: Пользователь видит только свои
CREATE POLICY "Users can view own notifications"
    ON notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
    ON notifications FOR UPDATE
    USING (auth.uid() = user_id);

-- ============================================================
-- END OF SCHEMA
-- ============================================================
