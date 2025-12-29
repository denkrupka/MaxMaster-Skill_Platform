-- ============================================================
-- ПОКАЗАТЬ ВСЕ КОЛОНКИ ВСЕХ ТАБЛИЦ
-- ============================================================

SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  COALESCE(column_default, '') as default_value
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
