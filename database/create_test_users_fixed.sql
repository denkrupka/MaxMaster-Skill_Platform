-- ============================================================
-- СОЗДАНИЕ ТЕСТОВЫХ ПОЛЬЗОВАТЕЛЕЙ - ИСПРАВЛЕННАЯ ВЕРСИЯ
-- ============================================================
-- Этот скрипт создает пользователей напрямую в auth.users
-- и автоматически создает профили через триггер
-- ============================================================

-- ВАЖНО: Этот скрипт нужно выполнять от имени postgres (service_role)
-- В Supabase SQL Editor используйте RPC вызов или выполните через Dashboard

-- Удаляем старую функцию если она есть
DROP FUNCTION IF EXISTS create_user(TEXT, TEXT, TEXT, TEXT, user_role);

-- ============================================================
-- НОВАЯ УЛУЧШЕННАЯ ФУНКЦИЯ
-- ============================================================

CREATE OR REPLACE FUNCTION create_test_user(
  p_email TEXT,
  p_password TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_role user_role DEFAULT 'employee'
)
RETURNS TABLE(user_id uuid, email text, success boolean, message text) AS $$
DECLARE
  new_user_id uuid;
  existing_id uuid;
BEGIN
  -- Проверяем существует ли уже пользователь
  SELECT id INTO existing_id FROM auth.users WHERE email = p_email;

  IF existing_id IS NOT NULL THEN
    -- Пользователь существует, обновляем профиль если нужно
    UPDATE public.users
    SET
      first_name = p_first_name,
      last_name = p_last_name,
      role = p_role,
      status = 'active',
      updated_at = NOW()
    WHERE id = existing_id;

    RETURN QUERY SELECT existing_id, p_email, false, 'User already exists, profile updated';
    RETURN;
  END IF;

  -- Генерируем новый UUID
  new_user_id := gen_random_uuid();

  -- Создаем пользователя в auth.users
  BEGIN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      invited_at,
      confirmation_token,
      confirmation_sent_at,
      recovery_token,
      recovery_sent_at,
      email_change_token_new,
      email_change,
      email_change_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      created_at,
      updated_at,
      phone,
      phone_confirmed_at,
      phone_change,
      phone_change_token,
      phone_change_sent_at,
      email_change_token_current,
      email_change_confirm_status,
      banned_until,
      reauthentication_token,
      reauthentication_sent_at,
      is_sso_user,
      deleted_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_user_id,
      'authenticated',
      'authenticated',
      p_email,
      crypt(p_password, gen_salt('bf')),
      NOW(),
      NULL,
      '',
      NULL,
      '',
      NULL,
      '',
      '',
      NULL,
      NULL,
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('first_name', p_first_name, 'last_name', p_last_name, 'role', p_role),
      false,
      NOW(),
      NOW(),
      NULL,
      NULL,
      '',
      '',
      NULL,
      '',
      0,
      NULL,
      '',
      NULL,
      false,
      NULL
    );

    -- Создаем профиль (если триггер не сработал)
    INSERT INTO public.users (
      id,
      email,
      first_name,
      last_name,
      role,
      status,
      hired_date,
      created_at,
      updated_at
    ) VALUES (
      new_user_id,
      p_email,
      p_first_name,
      p_last_name,
      p_role,
      'active',
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      role = EXCLUDED.role,
      status = 'active',
      updated_at = NOW();

    RETURN QUERY SELECT new_user_id, p_email, true, 'User created successfully';

  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT NULL::uuid, p_email, false, SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- СОЗДАЕМ ТЕСТОВЫХ ПОЛЬЗОВАТЕЛЕЙ
-- ============================================================

-- Выполняем создание всех пользователей
DO $$
DECLARE
  result RECORD;
BEGIN
  RAISE NOTICE '=== Создание тестовых пользователей ===';

  -- HR Manager
  FOR result IN SELECT * FROM create_test_user('hr@maxmaster.pl', 'hr123', 'Anna', 'Wiśniewska', 'hr')
  LOOP
    RAISE NOTICE 'HR: % - %', result.email, result.message;
  END LOOP;

  -- Brigadir
  FOR result IN SELECT * FROM create_test_user('brigadir@maxmaster.pl', 'brig123', 'Piotr', 'Kowalski', 'brigadir')
  LOOP
    RAISE NOTICE 'Brigadir: % - %', result.email, result.message;
  END LOOP;

  -- Coordinator
  FOR result IN SELECT * FROM create_test_user('coordinator@maxmaster.pl', 'coord123', 'Maria', 'Nowak', 'coordinator')
  LOOP
    RAISE NOTICE 'Coordinator: % - %', result.email, result.message;
  END LOOP;

  -- Employee
  FOR result IN SELECT * FROM create_test_user('employee@maxmaster.pl', 'emp123', 'Jan', 'Pracownik', 'employee')
  LOOP
    RAISE NOTICE 'Employee: % - %', result.email, result.message;
  END LOOP;

  -- Candidate
  FOR result IN SELECT * FROM create_test_user('candidate@maxmaster.pl', 'cand123', 'Marek', 'Kandydacki', 'candidate')
  LOOP
    RAISE NOTICE 'Candidate: % - %', result.email, result.message;
  END LOOP;

  -- Trial Employee
  FOR result IN SELECT * FROM create_test_user('trial@maxmaster.pl', 'trial123', 'Adam', 'Nowicjusz', 'employee')
  LOOP
    RAISE NOTICE 'Trial: % - %', result.email, result.message;
  END LOOP;
END $$;

-- ============================================================
-- ПРОВЕРКА РЕЗУЛЬТАТОВ
-- ============================================================

-- Проверяем сколько пользователей создано
SELECT
  '=== РЕЗУЛЬТАТЫ ===' as info,
  (SELECT COUNT(*) FROM auth.users) as auth_users_count,
  (SELECT COUNT(*) FROM public.users) as public_users_count;

-- Показываем всех пользователей
SELECT
  u.email,
  u.first_name,
  u.last_name,
  u.role,
  u.status,
  CASE WHEN a.id IS NOT NULL THEN '✅' ELSE '❌' END as has_auth,
  u.created_at
FROM public.users u
LEFT JOIN auth.users a ON u.id = a.id
ORDER BY u.created_at DESC;

-- ============================================================
-- ИТОГО
-- ============================================================

-- Если этот скрипт не сработал, используйте АЛЬТЕРНАТИВНЫЙ ПОДХОД ниже
