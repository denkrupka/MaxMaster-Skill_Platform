-- ============================================================
-- ПРОВЕРКА RLS ПОЛИТИК
-- ============================================================

-- Количество политик для каждой таблицы
SELECT
  tablename,
  COUNT(*) as policies_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Общее количество
SELECT
  '=== ИТОГО ===' as info,
  COUNT(*) as total_policies
FROM pg_policies
WHERE schemaname = 'public';

-- Таблицы БЕЗ политик (если есть)
SELECT
  '=== ТАБЛИЦЫ БЕЗ RLS ===' as info,
  t.table_name
FROM information_schema.tables t
LEFT JOIN pg_policies p ON t.table_name = p.tablename AND p.schemaname = 'public'
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND p.tablename IS NULL
ORDER BY t.table_name;
