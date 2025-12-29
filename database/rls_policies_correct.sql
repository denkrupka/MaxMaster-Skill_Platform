-- ============================================================
-- RLS ПОЛИТИКИ - ПРАВИЛЬНАЯ ВЕРСИЯ (на основе реальной схемы)
-- ============================================================

-- Сначала удаляем все существующие политики
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
            r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- ============================================================
-- USERS
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admin and HR can view all profiles"
  ON users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
    )
  );

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admin and HR can update all profiles"
  ON users FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
    )
  );

CREATE POLICY "Only admin can delete users"
  ON users FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admin and HR can insert users"
  ON users FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
    )
  );

-- ============================================================
-- SKILLS
-- ============================================================

ALTER TABLE skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view active skills"
  ON skills FOR SELECT
  USING (is_active = true AND is_archived = false);

CREATE POLICY "Admin can view all skills"
  ON skills FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admin can manage skills"
  ON skills FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- ============================================================
-- USER_SKILLS
-- ============================================================

ALTER TABLE user_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own skills"
  ON user_skills FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admin, HR, Brigadir can view all user skills"
  ON user_skills FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr', 'brigadir')
    )
  );

CREATE POLICY "Users can insert own skills"
  ON user_skills FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin and HR can manage all user skills"
  ON user_skills FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
    )
  );

CREATE POLICY "Brigadir can update user skills"
  ON user_skills FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr', 'brigadir')
    )
  );

-- ============================================================
-- TESTS
-- ============================================================

ALTER TABLE tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view active tests"
  ON tests FOR SELECT
  USING (is_active = true AND is_archived = false);

CREATE POLICY "Admin can view all tests"
  ON tests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admin can manage tests"
  ON tests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- ============================================================
-- QUESTIONS
-- ============================================================

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view questions for active tests"
  ON questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tests
      WHERE tests.id = questions.test_id
      AND tests.is_active = true
    )
  );

CREATE POLICY "Admin can manage questions"
  ON questions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- ============================================================
-- TEST_ATTEMPTS
-- ============================================================

ALTER TABLE test_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attempts"
  ON test_attempts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admin, HR can view all attempts"
  ON test_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
    )
  );

CREATE POLICY "Users can create own attempts"
  ON test_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- SALARY_HISTORY
-- ============================================================

ALTER TABLE salary_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own salary"
  ON salary_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admin, HR can view all salaries"
  ON salary_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
    )
  );

CREATE POLICY "Admin can manage salaries"
  ON salary_history FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- POSITIONS
-- ============================================================

ALTER TABLE positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view positions"
  ON positions FOR SELECT
  USING (true);

CREATE POLICY "Admin can manage positions"
  ON positions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- ============================================================
-- LIBRARY_RESOURCES
-- ============================================================

ALTER TABLE library_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view active resources"
  ON library_resources FOR SELECT
  USING (is_archived = false);

CREATE POLICY "Admin can view all resources"
  ON library_resources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admin can manage resources"
  ON library_resources FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- ============================================================
-- MONTHLY_BONUSES
-- ============================================================

ALTER TABLE monthly_bonuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bonuses"
  ON monthly_bonuses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admin, HR can view all bonuses"
  ON monthly_bonuses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
    )
  );

CREATE POLICY "Admin, HR can manage bonuses"
  ON monthly_bonuses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
    )
  );

-- ============================================================
-- EMPLOYEE_BADGES
-- ============================================================

ALTER TABLE employee_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can view own badges"
  ON employee_badges FOR SELECT
  USING (
    auth.uid() = employee_id AND visible_to_employee = true
  );

CREATE POLICY "Admin, HR can view all badges"
  ON employee_badges FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
    )
  );

CREATE POLICY "Admin, HR can manage badges"
  ON employee_badges FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
    )
  );

-- ============================================================
-- EMPLOYEE_NOTES
-- ============================================================

ALTER TABLE employee_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin, HR can view all notes"
  ON employee_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
    )
  );

CREATE POLICY "Admin, HR can manage notes"
  ON employee_notes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
    )
  );

-- ============================================================
-- QUALITY_INCIDENTS
-- ============================================================

ALTER TABLE quality_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own incidents"
  ON quality_incidents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admin, HR, Brigadir can view all incidents"
  ON quality_incidents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr', 'brigadir')
    )
  );

CREATE POLICY "Admin, HR, Brigadir can manage incidents"
  ON quality_incidents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr', 'brigadir')
    )
  );

-- ============================================================
-- VERIFICATION_ATTACHMENTS
-- ============================================================

ALTER TABLE verification_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attachments for own skills"
  ON verification_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_skills
      WHERE user_skills.id = verification_attachments.user_skill_id
      AND user_skills.user_id = auth.uid()
    )
  );

CREATE POLICY "Admin, HR, Brigadir can view all attachments"
  ON verification_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr', 'brigadir')
    )
  );

CREATE POLICY "Users can upload attachments for own skills"
  ON verification_attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_skills
      WHERE user_skills.id = verification_attachments.user_skill_id
      AND user_skills.user_id = auth.uid()
    )
  );

CREATE POLICY "Admin, HR can manage all attachments"
  ON verification_attachments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
    )
  );

-- ============================================================
-- VERIFICATION_LOGS
-- ============================================================

ALTER TABLE verification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view logs for own skills"
  ON verification_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_skills
      WHERE user_skills.id = verification_logs.user_skill_id
      AND user_skills.user_id = auth.uid()
    )
  );

CREATE POLICY "Admin, HR, Brigadir can view all logs"
  ON verification_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr', 'brigadir')
    )
  );

CREATE POLICY "System can create logs"
  ON verification_logs FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- VERIFICATION_NOTES
-- ============================================================

ALTER TABLE verification_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view notes for own skills"
  ON verification_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_skills
      WHERE user_skills.id = verification_notes.user_skill_id
      AND user_skills.user_id = auth.uid()
    )
  );

CREATE POLICY "Admin, HR, Brigadir can view all notes"
  ON verification_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr', 'brigadir')
    )
  );

CREATE POLICY "Admin, HR, Brigadir can create notes"
  ON verification_notes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr', 'brigadir')
    )
  );

-- ============================================================
-- CANDIDATE_HISTORY
-- ============================================================

ALTER TABLE candidate_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own history"
  ON candidate_history FOR SELECT
  USING (auth.uid() = candidate_id);

CREATE POLICY "Admin, HR can view all history"
  ON candidate_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
    )
  );

CREATE POLICY "System can create history"
  ON candidate_history FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- BONUS_DOCUMENT_TYPES
-- ============================================================

ALTER TABLE bonus_document_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view active bonus types"
  ON bonus_document_types FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admin can manage bonus types"
  ON bonus_document_types FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- ============================================================
-- PRACTICAL_CHECK_TEMPLATES
-- ============================================================

ALTER TABLE practical_check_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view templates"
  ON practical_check_templates FOR SELECT
  USING (true);

CREATE POLICY "Admin can manage templates"
  ON practical_check_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- ============================================================
-- NOTIFICATION_SETTINGS
-- ============================================================

ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
  ON notification_settings FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update own settings"
  ON notification_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admin can manage all settings"
  ON notification_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- ============================================================
-- NOTIFICATION_TEMPLATES
-- ============================================================

ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view active templates"
  ON notification_templates FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admin can manage templates"
  ON notification_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- ============================================================
-- SYSTEM_CONFIG
-- ============================================================

ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view config"
  ON system_config FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admin can manage config"
  ON system_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- ============================================================
-- ПРОВЕРКА
-- ============================================================

SELECT
  tablename,
  COUNT(*) as policies_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

SELECT '✅ Все RLS политики успешно созданы!' as status;
