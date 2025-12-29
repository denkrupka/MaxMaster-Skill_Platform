-- ============================================================
-- DEBUG SCRIPT - Проверка пользователей
-- ============================================================
-- Выполните этот скрипт чтобы увидеть что происходит
-- ============================================================

-- 1. Проверяем сколько пользователей в auth.users
SELECT
  '=== AUTH.USERS ===' as section,
  COUNT(*) as total_count
FROM auth.users;

-- 2. Все пользователи в auth.users
SELECT
  id,
  email,
  email_confirmed_at,
  created_at,
  raw_user_meta_data
FROM auth.users
ORDER BY created_at DESC;

-- 3. Проверяем сколько пользователей в public.users
SELECT
  '=== PUBLIC.USERS ===' as section,
  COUNT(*) as total_count
FROM public.users;

-- 4. Все пользователи в public.users
SELECT
  id,
  email,
  first_name,
  last_name,
  role,
  status,
  created_at
FROM public.users
ORDER BY created_at DESC;

-- 5. Пользователи которые есть в auth.users но НЕТ в public.users (orphaned auth users)
SELECT
  '=== ORPHANED AUTH USERS (без профиля) ===' as section,
  a.id,
  a.email,
  a.created_at
FROM auth.users a
LEFT JOIN public.users p ON a.id = p.id
WHERE p.id IS NULL;

-- 6. Пользователи которые есть в public.users но НЕТ в auth.users (impossible but checking)
SELECT
  '=== ORPHANED PUBLIC USERS (без auth) ===' as section,
  p.id,
  p.email,
  p.created_at
FROM public.users p
LEFT JOIN auth.users a ON p.id = a.id
WHERE a.id IS NULL;
