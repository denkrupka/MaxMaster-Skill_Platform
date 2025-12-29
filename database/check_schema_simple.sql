-- ============================================================
-- ПРОСТАЯ ПРОВЕРКА СХЕМЫ
-- ============================================================

-- 1. Все таблицы
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns c
   WHERE c.table_schema = 'public' AND c.table_name = t.table_name) as columns
FROM information_schema.tables t
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
