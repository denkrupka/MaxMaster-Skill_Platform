-- ============================================================
-- АЛЬТЕРНАТИВНЫЙ ПОДХОД - Создание пользователей вручную
-- ============================================================
-- Если автоматический скрипт не работает, используйте этот подход
-- ============================================================

/*

ПРОБЛЕМА:
--------
Supabase не позволяет напрямую вставлять данные в auth.users через SQL Editor
из соображений безопасности. Это можно делать только через:
1. Authentication UI (Dashboard)
2. Admin API
3. Service Role ключ

РЕШЕНИЕ - ПОШАГОВАЯ ИНСТРУКЦИЯ:
--------------------------------

Шаг 1: Создайте пользователей через Authentication UI
======================================================

Перейдите в Supabase Dashboard:
Authentication → Users → Add User → Create new user

Создайте следующих пользователей:

1. HR Manager
   Email: hr@maxmaster.pl
   Password: hr123
   Auto Confirm User: ✅ (ОБЯЗАТЕЛЬНО!)

2. Brigadir
   Email: brigadir@maxmaster.pl
   Password: brig123
   Auto Confirm User: ✅

3. Coordinator
   Email: coordinator@maxmaster.pl
   Password: coord123
   Auto Confirm User: ✅

4. Employee
   Email: employee@maxmaster.pl
   Password: emp123
   Auto Confirm User: ✅

5. Candidate
   Email: candidate@maxmaster.pl
   Password: cand123
   Auto Confirm User: ✅

6. Trial Employee
   Email: trial@maxmaster.pl
   Password: trial123
   Auto Confirm User: ✅


Шаг 2: Создайте профили для этих пользователей
===============================================

После создания пользователей через UI, выполните скрипт ниже
в SQL Editor, чтобы создать им профили в public.users

*/

-- ============================================================
-- СКРИПТ ДЛЯ СОЗДАНИЯ ПРОФИЛЕЙ
-- ============================================================

-- Удаляем триггер временно (чтобы не было конфликтов)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Создаем профили для всех пользователей из auth.users
-- которые еще не имеют профиля в public.users

-- HR Manager
INSERT INTO public.users (
  id, email, first_name, last_name, role, status, hired_date, base_rate
)
SELECT
  id,
  'hr@maxmaster.pl',
  'Anna',
  'Wiśniewska',
  'hr',
  'active',
  NOW(),
  0
FROM auth.users
WHERE email = 'hr@maxmaster.pl'
ON CONFLICT (id) DO UPDATE
SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  role = EXCLUDED.role,
  status = 'active',
  updated_at = NOW();

-- Brigadir
INSERT INTO public.users (
  id, email, first_name, last_name, role, status, hired_date, base_rate
)
SELECT
  id,
  'brigadir@maxmaster.pl',
  'Piotr',
  'Kowalski',
  'brigadir',
  'active',
  NOW(),
  30.00
FROM auth.users
WHERE email = 'brigadir@maxmaster.pl'
ON CONFLICT (id) DO UPDATE
SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  role = EXCLUDED.role,
  status = 'active',
  updated_at = NOW();

-- Coordinator
INSERT INTO public.users (
  id, email, first_name, last_name, role, status, hired_date, base_rate
)
SELECT
  id,
  'coordinator@maxmaster.pl',
  'Maria',
  'Nowak',
  'coordinator',
  'active',
  NOW(),
  25.00
FROM auth.users
WHERE email = 'coordinator@maxmaster.pl'
ON CONFLICT (id) DO UPDATE
SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  role = EXCLUDED.role,
  status = 'active',
  updated_at = NOW();

-- Employee
INSERT INTO public.users (
  id, email, first_name, last_name, role, status, hired_date, base_rate
)
SELECT
  id,
  'employee@maxmaster.pl',
  'Jan',
  'Pracownik',
  'employee',
  'active',
  NOW(),
  22.00
FROM auth.users
WHERE email = 'employee@maxmaster.pl'
ON CONFLICT (id) DO UPDATE
SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  role = EXCLUDED.role,
  status = 'active',
  updated_at = NOW();

-- Candidate
INSERT INTO public.users (
  id, email, first_name, last_name, role, status, hired_date, base_rate
)
SELECT
  id,
  'candidate@maxmaster.pl',
  'Marek',
  'Kandydacki',
  'candidate',
  'started',
  NULL,
  0
FROM auth.users
WHERE email = 'candidate@maxmaster.pl'
ON CONFLICT (id) DO UPDATE
SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  role = EXCLUDED.role,
  status = 'started',
  updated_at = NOW();

-- Trial Employee
INSERT INTO public.users (
  id, email, first_name, last_name, role, status, hired_date, base_rate
)
SELECT
  id,
  'trial@maxmaster.pl',
  'Adam',
  'Nowicjusz',
  'employee',
  'trial',
  NOW(),
  20.00
FROM auth.users
WHERE email = 'trial@maxmaster.pl'
ON CONFLICT (id) DO UPDATE
SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  role = EXCLUDED.role,
  status = 'trial',
  updated_at = NOW();

-- ============================================================
-- ВОССТАНАВЛИВАЕМ ТРИГГЕР
-- ============================================================

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ПРОВЕРКА РЕЗУЛЬТАТОВ
-- ============================================================

-- Показываем всех созданных пользователей
SELECT
  '=== Все пользователи ===' as section,
  p.email,
  p.first_name || ' ' || p.last_name as full_name,
  p.role,
  p.status,
  CASE WHEN a.email_confirmed_at IS NOT NULL THEN '✅ Confirmed' ELSE '❌ Not confirmed' END as auth_status,
  p.created_at
FROM public.users p
INNER JOIN auth.users a ON p.id = a.id
ORDER BY p.created_at DESC;

-- Показываем статистику
SELECT
  '=== Статистика ===' as section,
  (SELECT COUNT(*) FROM auth.users) as auth_users,
  (SELECT COUNT(*) FROM public.users) as public_users,
  (SELECT COUNT(*) FROM auth.users WHERE email_confirmed_at IS NOT NULL) as confirmed_users;

-- Проверяем есть ли пользователи без профиля
SELECT
  '=== Пользователи без профиля ===' as section,
  a.email,
  a.created_at
FROM auth.users a
LEFT JOIN public.users p ON a.id = p.id
WHERE p.id IS NULL;

-- ============================================================
-- ИТОГО
-- ============================================================

/*

УСПЕХ! Теперь у вас должно быть 7 пользователей:

1. biuro@maxmaster.info - Admin (создан вручную)
2. hr@maxmaster.pl - HR Manager
3. brigadir@maxmaster.pl - Brigadir
4. coordinator@maxmaster.pl - Coordinator
5. employee@maxmaster.pl - Employee
6. candidate@maxmaster.pl - Candidate
7. trial@maxmaster.pl - Trial Employee

Все они могут войти в систему используя свои email и пароли.

СЛЕДУЮЩИЕ ШАГИ:
===============

1. ✅ Пользователи созданы
2. ⬜ Создайте Storage Buckets (SUPABASE_QUICK_START.md - Шаг 4)
3. ⬜ Скопируйте API ключи (Шаг 5)
4. ⬜ Настройте фронтенд (Шаг 6)
5. ⬜ Тестирование (Шаг 7)

*/
