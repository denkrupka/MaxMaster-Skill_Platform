-- =====================================================
-- MULTI-COMPANY SUPPORT - Part 3: Add company_id to existing tables
-- =====================================================

-- =====================================================
-- 1. UPDATE USERS TABLE
-- =====================================================

-- Add company_id to users (nullable initially for migration)
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- Add is_global_user flag for superadmin, sales, doradca
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_global_user BOOLEAN DEFAULT FALSE;

-- Add invitation fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS invitation_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by UUID;

-- Add available_modules for users
ALTER TABLE users ADD COLUMN IF NOT EXISTS available_modules TEXT[] DEFAULT '{}';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_is_global ON users(is_global_user);
CREATE INDEX IF NOT EXISTS idx_users_invitation_token ON users(invitation_token);

-- =====================================================
-- 2. UPDATE SKILLS TABLE
-- =====================================================

ALTER TABLE skills ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE skills ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_skills_company_id ON skills(company_id);

-- =====================================================
-- 3. UPDATE USER_SKILLS TABLE
-- =====================================================

ALTER TABLE user_skills ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

CREATE INDEX IF NOT EXISTS idx_user_skills_company_id ON user_skills(company_id);

-- =====================================================
-- 4. UPDATE TESTS TABLE
-- =====================================================

ALTER TABLE tests ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE tests ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_tests_company_id ON tests(company_id);

-- =====================================================
-- 5. UPDATE TEST_ATTEMPTS TABLE
-- =====================================================

ALTER TABLE test_attempts ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

CREATE INDEX IF NOT EXISTS idx_test_attempts_company_id ON test_attempts(company_id);

-- =====================================================
-- 6. UPDATE POSITIONS TABLE
-- =====================================================

ALTER TABLE positions ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE positions ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_positions_company_id ON positions(company_id);

-- =====================================================
-- 7. UPDATE CANDIDATE_HISTORY TABLE
-- =====================================================

ALTER TABLE candidate_history ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

CREATE INDEX IF NOT EXISTS idx_candidate_history_company_id ON candidate_history(company_id);

-- =====================================================
-- 8. UPDATE QUALITY_INCIDENTS TABLE
-- =====================================================

ALTER TABLE quality_incidents ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

CREATE INDEX IF NOT EXISTS idx_quality_incidents_company_id ON quality_incidents(company_id);

-- =====================================================
-- 9. UPDATE EMPLOYEE_NOTES TABLE
-- =====================================================

ALTER TABLE employee_notes ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

CREATE INDEX IF NOT EXISTS idx_employee_notes_company_id ON employee_notes(company_id);

-- =====================================================
-- 10. UPDATE EMPLOYEE_BADGES TABLE
-- =====================================================

ALTER TABLE employee_badges ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

CREATE INDEX IF NOT EXISTS idx_employee_badges_company_id ON employee_badges(company_id);

-- =====================================================
-- 11. UPDATE LIBRARY_RESOURCES TABLE
-- =====================================================

ALTER TABLE library_resources ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE library_resources ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_library_resources_company_id ON library_resources(company_id);

-- =====================================================
-- 12. UPDATE SYSTEM_CONFIG TABLE
-- =====================================================

ALTER TABLE system_config ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

CREATE INDEX IF NOT EXISTS idx_system_config_company_id ON system_config(company_id);

-- =====================================================
-- 13. UPDATE SMS_LOGS TABLE
-- =====================================================

ALTER TABLE sms_logs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

CREATE INDEX IF NOT EXISTS idx_sms_logs_company_id ON sms_logs(company_id);

-- =====================================================
-- Add foreign key references for companies table
-- (now that users table has company_id)
-- =====================================================

-- Note: We can't add these FKs until users table is migrated
-- ALTER TABLE companies ADD CONSTRAINT fk_companies_created_by
--   FOREIGN KEY (created_by) REFERENCES users(id);
-- ALTER TABLE companies ADD CONSTRAINT fk_companies_sales_owner
--   FOREIGN KEY (sales_owner_id) REFERENCES users(id);
-- ALTER TABLE companies ADD CONSTRAINT fk_companies_doradca
--   FOREIGN KEY (doradca_id) REFERENCES users(id);

-- Add FK for user invited_by
-- ALTER TABLE users ADD CONSTRAINT fk_users_invited_by
--   FOREIGN KEY (invited_by) REFERENCES users(id);

-- Add comments
COMMENT ON COLUMN users.company_id IS 'Company the user belongs to (NULL for global users)';
COMMENT ON COLUMN users.is_global_user IS 'True for superadmin, sales, doradca roles';
COMMENT ON COLUMN users.invitation_token IS 'Token for invitation email link';
COMMENT ON COLUMN users.available_modules IS 'Array of module codes user has access to';
COMMENT ON COLUMN skills.is_template IS 'True if this is a global template skill';
COMMENT ON COLUMN tests.is_template IS 'True if this is a global template test';
