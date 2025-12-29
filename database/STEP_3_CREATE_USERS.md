# 👥 Шаг 3: Создание тестовых пользователей

## ⚠️ ВАЖНО: Проблема с SQL-созданием пользователей

Supabase **не позволяет** создавать пользователей напрямую через SQL Editor из соображений безопасности.

Функция `create_user()` и прямые INSERT в `auth.users` **не будут работать** в SQL Editor.

## ✅ ПРАВИЛЬНЫЙ СПОСОБ - Через Authentication UI

---

### 📝 Пошаговая инструкция

#### 1. Откройте Authentication

В Supabase Dashboard:
- Левое меню → **Authentication**
- Перейдите на вкладку **Users**

#### 2. Создайте пользователей по одному

Для каждого пользователя:
1. Нажмите **Add User** → **Create new user**
2. Заполните данные:
   - **Email**: (см. таблицу ниже)
   - **Password**: (см. таблицу ниже)
   - **Auto Confirm User**: ✅ **ОБЯЗАТЕЛЬНО ВКЛЮЧИТЕ!**
3. Нажмите **Create User**
4. Подождите пока пользователь появится в списке

#### 3. Список пользователей для создания

| # | Email | Password | Роль |
|---|-------|----------|------|
| 1 | `biuro@maxmaster.info` | `admin123` | Admin (уже создан ✅) |
| 2 | `hr@maxmaster.pl` | `hr123` | HR Manager |
| 3 | `brigadir@maxmaster.pl` | `brig123` | Brigadir |
| 4 | `coordinator@maxmaster.pl` | `coord123` | Coordinator |
| 5 | `employee@maxmaster.pl` | `emp123` | Employee |
| 6 | `candidate@maxmaster.pl` | `cand123` | Candidate |
| 7 | `trial@maxmaster.pl` | `trial123` | Trial Employee |

**Создайте пользователей 2-7 через UI!**

---

### 4. Создайте профили через SQL

После того как **ВСЕ** пользователи созданы через UI, выполните этот скрипт в SQL Editor:

```sql
-- ============================================================
-- СОЗДАНИЕ ПРОФИЛЕЙ ДЛЯ ПОЛЬЗОВАТЕЛЕЙ
-- ============================================================

-- 1. Проверяем сколько пользователей в auth.users
SELECT COUNT(*) as total_auth_users FROM auth.users;
-- Должно быть 7

-- 2. Создаем профили для всех
-- (используем ON CONFLICT чтобы обновить если уже существует)

-- HR Manager
INSERT INTO public.users (
  id, email, first_name, last_name, role, status, hired_date, base_rate
)
SELECT
  id, 'hr@maxmaster.pl', 'Anna', 'Wiśniewska', 'hr', 'active', NOW(), 0
FROM auth.users WHERE email = 'hr@maxmaster.pl'
ON CONFLICT (id) DO UPDATE
SET first_name = 'Anna', last_name = 'Wiśniewska', role = 'hr', status = 'active';

-- Brigadir
INSERT INTO public.users (
  id, email, first_name, last_name, role, status, hired_date, base_rate
)
SELECT
  id, 'brigadir@maxmaster.pl', 'Piotr', 'Kowalski', 'brigadir', 'active', NOW(), 30.00
FROM auth.users WHERE email = 'brigadir@maxmaster.pl'
ON CONFLICT (id) DO UPDATE
SET first_name = 'Piotr', last_name = 'Kowalski', role = 'brigadir', status = 'active';

-- Coordinator
INSERT INTO public.users (
  id, email, first_name, last_name, role, status, hired_date, base_rate
)
SELECT
  id, 'coordinator@maxmaster.pl', 'Maria', 'Nowak', 'coordinator', 'active', NOW(), 25.00
FROM auth.users WHERE email = 'coordinator@maxmaster.pl'
ON CONFLICT (id) DO UPDATE
SET first_name = 'Maria', last_name = 'Nowak', role = 'coordinator', status = 'active';

-- Employee
INSERT INTO public.users (
  id, email, first_name, last_name, role, status, hired_date, base_rate
)
SELECT
  id, 'employee@maxmaster.pl', 'Jan', 'Pracownik', 'employee', 'active', NOW(), 22.00
FROM auth.users WHERE email = 'employee@maxmaster.pl'
ON CONFLICT (id) DO UPDATE
SET first_name = 'Jan', last_name = 'Pracownik', role = 'employee', status = 'active';

-- Candidate
INSERT INTO public.users (
  id, email, first_name, last_name, role, status, hired_date, base_rate
)
SELECT
  id, 'candidate@maxmaster.pl', 'Marek', 'Kandydacki', 'candidate', 'started', NULL, 0
FROM auth.users WHERE email = 'candidate@maxmaster.pl'
ON CONFLICT (id) DO UPDATE
SET first_name = 'Marek', last_name = 'Kandydacki', role = 'candidate', status = 'started';

-- Trial Employee
INSERT INTO public.users (
  id, email, first_name, last_name, role, status, hired_date, base_rate
)
SELECT
  id, 'trial@maxmaster.pl', 'Adam', 'Nowicjusz', 'employee', 'trial', NOW(), 20.00
FROM auth.users WHERE email = 'trial@maxmaster.pl'
ON CONFLICT (id) DO UPDATE
SET first_name = 'Adam', last_name = 'Nowicjusz', role = 'employee', status = 'trial';

-- 3. Проверяем результат
SELECT
  p.email,
  p.first_name || ' ' || p.last_name as name,
  p.role,
  p.status,
  CASE WHEN a.email_confirmed_at IS NOT NULL THEN '✅' ELSE '❌' END as confirmed
FROM public.users p
INNER JOIN auth.users a ON p.id = a.id
ORDER BY p.created_at;
```

---

### 5. Проверка

Должны увидеть **7 пользователей** с галочками ✅ в колонке `confirmed`.

```
email                      | name              | role        | status  | confirmed
---------------------------|-------------------|-------------|---------|----------
biuro@maxmaster.info       | Admin MaxMaster   | admin       | active  | ✅
hr@maxmaster.pl            | Anna Wiśniewska   | hr          | active  | ✅
brigadir@maxmaster.pl      | Piotr Kowalski    | brigadir    | active  | ✅
coordinator@maxmaster.pl   | Maria Nowak       | coordinator | active  | ✅
employee@maxmaster.pl      | Jan Pracownik     | employee    | active  | ✅
candidate@maxmaster.pl     | Marek Kandydacki  | candidate   | started | ✅
trial@maxmaster.pl         | Adam Nowicjusz    | employee    | trial   | ✅
```

---

## 🎯 Готово!

Теперь у вас есть 7 тестовых пользователей с разными ролями.

**Следующий шаг**: Создание Storage Buckets (Шаг 4 в SUPABASE_QUICK_START.md)

---

## 🐛 Troubleshooting

### Ошибка: "User already exists"
- Это нормально, просто не создавайте его повторно
- Или удалите старого пользователя: Authentication → Users → ... → Delete User

### Ошибка: "Database error creating new user"
- Проверьте что триггер создан правильно
- Временно удалите триггер: `DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;`
- Создайте пользователя
- Создайте профиль вручную
- Восстановите триггер

### Профиль не создался автоматически
- Выполните SQL скрипт из шага 4 выше
- Он создаст профиль для существующего auth пользователя

### Пользователь не может войти
- Проверьте что **Auto Confirm User** был включен при создании
- Или подтвердите email вручную: Authentication → Users → ... → Confirm Email

---

## 📚 Дополнительно

### Почему нельзя создавать через SQL?

Supabase использует внутреннюю систему auth с дополнительными проверками, хешированием паролей, и событиями. Прямой INSERT в `auth.users` минует эти проверки и может:
- Создать некорректного пользователя
- Нарушить безопасность
- Не отправить подтверждающие emails
- Не создать необходимые связи

Поэтому Supabase требует создания через:
1. **UI Dashboard** (самый простой способ)
2. **Admin API** (для автоматизации)
3. **Service Role** ключ в коде

Для тестовых пользователей **UI Dashboard - лучший вариант**.
