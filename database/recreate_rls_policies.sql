-- ============================================================
-- ПЕРЕСОЗДАНИЕ RLS ПОЛИТИК (если уже существуют)
-- ============================================================
-- Выполните этот скрипт если получаете ошибку "policy already exists"
-- ============================================================

-- Сначала удаляем все существующие политики
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Удаляем все политики для всех таблиц в public schema
    FOR r IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
            r.policyname, r.schemaname, r.tablename);
    END LOOP;

    RAISE NOTICE 'Все существующие политики удалены';
END $$;

-- Теперь создаем политики заново
-- ============================================================
-- USERS TABLE POLICIES
-- ============================================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can view own profile
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Admin and HR can view all profiles
CREATE POLICY "Admin and HR can view all profiles"
  ON users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
    )
  );

-- Users can update own profile
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- Admin and HR can update all profiles
CREATE POLICY "Admin and HR can update all profiles"
  ON users FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
    )
  );

-- Only admin can delete users
CREATE POLICY "Only admin can delete users"
  ON users FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- ============================================================
-- SKILLS TABLE POLICIES
-- ============================================================

ALTER TABLE skills ENABLE ROW LEVEL SECURITY;

-- Everyone can view active skills
CREATE POLICY "Everyone can view active skills"
  ON skills FOR SELECT
  USING (status = 'active' OR status = 'archived');

-- Admin can manage skills
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
-- USER_SKILLS TABLE POLICIES
-- ============================================================

ALTER TABLE user_skills ENABLE ROW LEVEL SECURITY;

-- Users can view own skills
CREATE POLICY "Users can view own skills"
  ON user_skills FOR SELECT
  USING (auth.uid() = user_id);

-- Admin, HR, Brigadir can view all user skills
CREATE POLICY "Admin, HR, Brigadir can view all user skills"
  ON user_skills FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr', 'brigadir')
    )
  );

-- Admin and HR can manage user skills
CREATE POLICY "Admin and HR can manage user skills"
  ON user_skills FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
    )
  );

-- ============================================================
-- TESTS TABLE POLICIES
-- ============================================================

ALTER TABLE tests ENABLE ROW LEVEL SECURITY;

-- Everyone can view active tests
CREATE POLICY "Everyone can view active tests"
  ON tests FOR SELECT
  USING (is_active = true);

-- Admin can manage tests
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
-- TEST_ATTEMPTS TABLE POLICIES
-- ============================================================

ALTER TABLE test_attempts ENABLE ROW LEVEL SECURITY;

-- Users can view own attempts
CREATE POLICY "Users can view own attempts"
  ON test_attempts FOR SELECT
  USING (auth.uid() = user_id);

-- Admin, HR can view all attempts
CREATE POLICY "Admin, HR can view all attempts"
  ON test_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
    )
  );

-- Users can create own attempts
CREATE POLICY "Users can create own attempts"
  ON test_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- SALARY_HISTORY TABLE POLICIES
-- ============================================================

ALTER TABLE salary_history ENABLE ROW LEVEL SECURITY;

-- Users can view own salary history
CREATE POLICY "Users can view own salary"
  ON salary_history FOR SELECT
  USING (auth.uid() = user_id);

-- Admin, HR can view all salaries
CREATE POLICY "Admin, HR can view all salaries"
  ON salary_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
    )
  );

-- Only admin can manage salaries
CREATE POLICY "Only admin can manage salaries"
  ON salary_history FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- ============================================================
-- DOCUMENTS TABLE POLICIES
-- ============================================================

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Users can view own documents
CREATE POLICY "Users can view own documents"
  ON documents FOR SELECT
  USING (auth.uid() = user_id);

-- Admin, HR can view all documents
CREATE POLICY "Admin, HR can view all documents"
  ON documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
    )
  );

-- Users can upload own documents
CREATE POLICY "Users can upload own documents"
  ON documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admin, HR can manage all documents
CREATE POLICY "Admin, HR can manage all documents"
  ON documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
    )
  );

-- ============================================================
-- CERTIFICATES TABLE POLICIES
-- ============================================================

ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

-- Users can view own certificates
CREATE POLICY "Users can view own certificates"
  ON certificates FOR SELECT
  USING (auth.uid() = user_id);

-- Admin, HR, Brigadir can view all certificates
CREATE POLICY "Admin, HR, Brigadir can view all certificates"
  ON certificates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr', 'brigadir')
    )
  );

-- Admin, HR can manage certificates
CREATE POLICY "Admin, HR can manage certificates"
  ON certificates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
    )
  );

-- ============================================================
-- SKILL_VERIFICATIONS TABLE POLICIES
-- ============================================================

ALTER TABLE skill_verifications ENABLE ROW LEVEL SECURITY;

-- Users can view own verifications
CREATE POLICY "Users can view own verifications"
  ON skill_verifications FOR SELECT
  USING (
    auth.uid() = user_id OR
    auth.uid() = verified_by
  );

-- Brigadir can view all verifications
CREATE POLICY "Brigadir can view all verifications"
  ON skill_verifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr', 'brigadir')
    )
  );

-- Brigadir can create verifications
CREATE POLICY "Brigadir can create verifications"
  ON skill_verifications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'brigadir')
    )
  );

-- Brigadir can update own verifications
CREATE POLICY "Brigadir can update own verifications"
  ON skill_verifications FOR UPDATE
  USING (
    auth.uid() = verified_by OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- ============================================================
-- NOTIFICATIONS TABLE POLICIES
-- ============================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can view own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- System can create notifications for anyone
CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- CHECKLIST_ITEMS TABLE POLICIES
-- ============================================================

ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

-- Everyone can view checklist items
CREATE POLICY "Everyone can view checklist items"
  ON checklist_items FOR SELECT
  USING (true);

-- Admin can manage checklist items
CREATE POLICY "Admin can manage checklist items"
  ON checklist_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- ============================================================
-- USER_CHECKLIST_PROGRESS TABLE POLICIES
-- ============================================================

ALTER TABLE user_checklist_progress ENABLE ROW LEVEL SECURITY;

-- Users can view own progress
CREATE POLICY "Users can view own progress"
  ON user_checklist_progress FOR SELECT
  USING (auth.uid() = user_id);

-- Admin, HR can view all progress
CREATE POLICY "Admin, HR can view all progress"
  ON user_checklist_progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
    )
  );

-- Users can update own progress
CREATE POLICY "Users can update own progress"
  ON user_checklist_progress FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================
-- POSITIONS TABLE POLICIES
-- ============================================================

ALTER TABLE positions ENABLE ROW LEVEL SECURITY;

-- Everyone can view positions
CREATE POLICY "Everyone can view positions"
  ON positions FOR SELECT
  USING (true);

-- Admin can manage positions
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
-- POSITION_SKILLS TABLE POLICIES
-- ============================================================

ALTER TABLE position_skills ENABLE ROW LEVEL SECURITY;

-- Everyone can view position skills
CREATE POLICY "Everyone can view position skills"
  ON position_skills FOR SELECT
  USING (true);

-- Admin can manage position skills
CREATE POLICY "Admin can manage position skills"
  ON position_skills FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- ============================================================
-- AUDIT_LOG TABLE POLICIES
-- ============================================================

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Admin can view audit log
CREATE POLICY "Admin can view audit log"
  ON audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- System can insert audit log entries
CREATE POLICY "System can insert audit log"
  ON audit_log FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- ПРОВЕРКА
-- ============================================================

-- Показываем все созданные политики
SELECT
  schemaname,
  tablename,
  policyname,
  CASE
    WHEN cmd = 'r' THEN 'SELECT'
    WHEN cmd = 'a' THEN 'INSERT'
    WHEN cmd = 'w' THEN 'UPDATE'
    WHEN cmd = 'd' THEN 'DELETE'
    WHEN cmd = '*' THEN 'ALL'
  END as command
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Подсчитываем количество политик для каждой таблицы
SELECT
  tablename,
  COUNT(*) as policies_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- ============================================================
-- УСПЕХ!
-- ============================================================

SELECT '✅ Все RLS политики успешно пересозданы!' as status;
