-- ============================================================
-- ПРОВЕРКА СХЕМЫ БАЗЫ ДАННЫХ
-- ============================================================
-- Этот скрипт показывает все таблицы и их колонки
-- ============================================================

-- Показываем все таблицы в public schema
SELECT
  '=== ТАБЛИЦЫ В PUBLIC SCHEMA ===' as info;

SELECT
  table_name,
  (
    SELECT COUNT(*)
    FROM information_schema.columns c
    WHERE c.table_schema = t.table_schema
    AND c.table_name = t.table_name
  ) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ============================================================
-- ДЕТАЛЬНАЯ ИНФОРМАЦИЯ ПО КАЖДОЙ ТАБЛИЦЕ
-- ============================================================

-- USERS
SELECT '=== USERS ===' as table_name;
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
ORDER BY ordinal_position;

-- SKILLS
SELECT '=== SKILLS ===' as table_name;
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'skills'
ORDER BY ordinal_position;

-- USER_SKILLS
SELECT '=== USER_SKILLS ===' as table_name;
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_skills'
ORDER BY ordinal_position;

-- TESTS
SELECT '=== TESTS ===' as table_name;
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tests'
ORDER BY ordinal_position;

-- TEST_ATTEMPTS
SELECT '=== TEST_ATTEMPTS ===' as table_name;
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'test_attempts'
ORDER BY ordinal_position;

-- SALARY_HISTORY
SELECT '=== SALARY_HISTORY ===' as table_name;
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'salary_history'
ORDER BY ordinal_position;

-- DOCUMENTS
SELECT '=== DOCUMENTS ===' as table_name;
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'documents'
ORDER BY ordinal_position;

-- CERTIFICATES
SELECT '=== CERTIFICATES ===' as table_name;
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'certificates'
ORDER BY ordinal_position;

-- SKILL_VERIFICATIONS
SELECT '=== SKILL_VERIFICATIONS ===' as table_name;
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'skill_verifications'
ORDER BY ordinal_position;

-- NOTIFICATIONS
SELECT '=== NOTIFICATIONS ===' as table_name;
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'notifications'
ORDER BY ordinal_position;

-- CHECKLIST_ITEMS
SELECT '=== CHECKLIST_ITEMS ===' as table_name;
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'checklist_items'
ORDER BY ordinal_position;

-- USER_CHECKLIST_PROGRESS
SELECT '=== USER_CHECKLIST_PROGRESS ===' as table_name;
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_checklist_progress'
ORDER BY ordinal_position;

-- POSITIONS
SELECT '=== POSITIONS ===' as table_name;
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'positions'
ORDER BY ordinal_position;

-- POSITION_SKILLS
SELECT '=== POSITION_SKILLS ===' as table_name;
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'position_skills'
ORDER BY ordinal_position;

-- AUDIT_LOG
SELECT '=== AUDIT_LOG ===' as table_name;
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'audit_log'
ORDER BY ordinal_position;

-- ============================================================
-- ПРОВЕРЯЕМ СУЩЕСТВУЮЩИЕ ENUMS
-- ============================================================

SELECT '=== ENUM TYPES ===' as info;

SELECT
  t.typname as enum_name,
  STRING_AGG(e.enumlabel, ', ' ORDER BY e.enumsortorder) as values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
GROUP BY t.typname
ORDER BY t.typname;

-- ============================================================
-- ИТОГО
-- ============================================================

SELECT '✅ Проверка схемы завершена' as status;
