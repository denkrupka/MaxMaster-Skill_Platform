-- =====================================================
-- MULTI-COMPANY SUPPORT - Part 4: Create Default Company & Migrate Data
-- =====================================================

-- Create default company for existing data
INSERT INTO companies (
  id,
  name,
  slug,
  legal_name,
  status,
  subscription_status,
  settings,
  created_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'MaxMaster',
  'maxmaster',
  'MaxMaster Sp. z o.o.',
  'active',
  'active',
  '{"isDefault": true}',
  NOW()
) ON CONFLICT (slug) DO NOTHING;

-- Migrate existing users to default company (all users for now)
UPDATE users
SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

-- Mark existing admin as global user (will update role separately after enum is updated)
UPDATE users
SET is_global_user = TRUE
WHERE role = 'admin';

-- Set company_id for all related tables
UPDATE skills SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE user_skills SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE tests SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE test_attempts SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE positions SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE candidate_history SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE quality_incidents SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE employee_notes SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE employee_badges SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE library_resources SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE system_config SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE sms_logs SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;

-- Create company_modules for default company (all modules active)
INSERT INTO company_modules (company_id, module_code, max_users, price_per_user, is_active)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'recruitment', 100, 59.00, TRUE),
  ('00000000-0000-0000-0000-000000000001', 'skills', 100, 79.00, TRUE)
ON CONFLICT (company_id, module_code) DO NOTHING;

-- Set available_modules for existing users based on their role
UPDATE users
SET available_modules = ARRAY['recruitment', 'skills']
WHERE company_id = '00000000-0000-0000-0000-000000000001'
  AND role IN ('hr', 'company_admin');

UPDATE users
SET available_modules = ARRAY['recruitment']
WHERE company_id = '00000000-0000-0000-0000-000000000001'
  AND role IN ('candidate', 'trial');

UPDATE users
SET available_modules = ARRAY['skills']
WHERE company_id = '00000000-0000-0000-0000-000000000001'
  AND role IN ('employee', 'brigadir', 'coordinator');

-- Create module_user_access records for all existing users
INSERT INTO module_user_access (company_id, user_id, module_code, is_enabled)
SELECT
  u.company_id,
  u.id,
  'recruitment',
  TRUE
FROM users u
WHERE u.company_id IS NOT NULL
  AND u.role IN ('candidate', 'trial', 'hr')
ON CONFLICT (user_id, module_code) DO NOTHING;

INSERT INTO module_user_access (company_id, user_id, module_code, is_enabled)
SELECT
  u.company_id,
  u.id,
  'skills',
  TRUE
FROM users u
WHERE u.company_id IS NOT NULL
  AND u.role IN ('employee', 'brigadir', 'coordinator', 'hr')
ON CONFLICT (user_id, module_code) DO NOTHING;

-- Add comment
COMMENT ON TABLE companies IS 'Default company created for migration: MaxMaster (id: 00000000-0000-0000-0000-000000000001)';
