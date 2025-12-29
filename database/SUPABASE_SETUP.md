# 🚀 MaxMaster Skills - Supabase Setup Guide

## Полное руководство по развертыванию в Supabase

Supabase - это идеальное решение для вашего проекта! Вы получите:
- ✅ PostgreSQL база данных (наша схема полностью совместима)
- ✅ Автоматическая REST API (не нужно писать backend!)
- ✅ Realtime subscriptions
- ✅ Authentication из коробки
- ✅ File Storage для документов и фото
- ✅ Row Level Security для безопасности

---

## 📋 Шаг 1: Создание проекта в Supabase

### 1.1 Регистрация
1. Перейдите на https://supabase.com
2. Нажмите "Start your project"
3. Войдите через GitHub

### 1.2 Создание проекта
1. Нажмите "New Project"
2. Заполните:
   - **Name**: MaxMaster Skills
   - **Database Password**: (сохраните в безопасном месте!)
   - **Region**: Europe (Frankfurt или ближайший)
   - **Pricing Plan**: Free tier (достаточно для начала)
3. Нажмите "Create new project"
4. Ждите 2-3 минуты пока создается проект

### 1.3 Сохраните учетные данные
После создания проекта скопируйте:
- **Project URL**: `https://xxxxx.supabase.co`
- **API Key (anon public)**: `eyJhbGci...`
- **Service role key**: `eyJhbGci...` (секретный ключ)

---

## 📊 Шаг 2: Создание схемы базы данных

### 2.1 Откройте SQL Editor
1. В Supabase Dashboard перейдите в **SQL Editor**
2. Нажмите **New Query**

### 2.2 Примените схему

Скопируйте и выполните содержимое файла `database/supabase_schema.sql` (создам ниже)

**Важно**: Supabase уже имеет встроенную таблицу `auth.users`, поэтому мы создадим таблицу `public.users` которая будет связана с `auth.users`.

---

## 🔐 Шаг 3: Настройка Authentication

### 3.1 Включите Email Authentication
1. Перейдите в **Authentication** → **Providers**
2. Включите **Email**
3. Отключите "Confirm email" (для development)

### 3.2 Создайте тестовых пользователей

Используйте SQL Editor:

```sql
-- Создание пользователя в auth.users и public.users
DO $$
DECLARE
  user_id uuid;
BEGIN
  -- Admin
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'admin@maxmaster.pl',
    crypt('admin123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"admin"}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  ) RETURNING id INTO user_id;

  -- Создаем профиль в public.users
  INSERT INTO public.users (
    id, email, first_name, last_name, role, status, base_rate, hired_date
  ) VALUES (
    user_id, 'admin@maxmaster.pl', 'Piotr', 'Adminowicz', 'admin', 'active', 0, NOW()
  );
END $$;
```

Но проще использовать Supabase Auth UI для создания пользователей.

---

## 📁 Шаг 4: Настройка Storage (для файлов)

### 4.1 Создайте Buckets
1. Перейдите в **Storage**
2. Создайте следующие buckets:

```sql
-- Создание buckets через SQL
INSERT INTO storage.buckets (id, name, public) VALUES
  ('resumes', 'resumes', false),
  ('documents', 'documents', false),
  ('certificates', 'certificates', false),
  ('verification-photos', 'verification-photos', false),
  ('avatars', 'avatars', true);
```

### 4.2 Настройте политики Storage

```sql
-- Политики для bucket 'documents'
CREATE POLICY "Users can upload their own documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- HR может видеть все документы
CREATE POLICY "HR can view all documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('hr', 'admin')
  )
);
```

---

## 🔒 Шаг 5: Row Level Security (RLS)

Supabase требует настройки RLS для безопасности данных.

### 5.1 Включите RLS для всех таблиц

```sql
-- Включаем RLS для всех таблиц
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_attempts ENABLE ROW LEVEL SECURITY;
-- ... и так для всех таблиц
```

### 5.2 Создайте политики доступа

```sql
-- USERS: Пользователь видит только себя, HR видит всех
CREATE POLICY "Users can view own profile"
ON users FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "HR can view all users"
ON users FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role IN ('hr', 'admin')
  )
);

CREATE POLICY "HR can update all users"
ON users FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role IN ('hr', 'admin')
  )
);

-- SKILLS: Все могут читать, только HR/Admin могут изменять
CREATE POLICY "Anyone can view skills"
ON skills FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "HR can manage skills"
ON skills FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role IN ('hr', 'admin')
  )
);

-- USER_SKILLS: Пользователь видит свои, HR видит все
CREATE POLICY "Users can view own skills"
ON user_skills FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role IN ('hr', 'admin', 'brigadir')
  )
);

-- TEST_ATTEMPTS: Пользователь видит свои попытки
CREATE POLICY "Users can view own test attempts"
ON test_attempts FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role IN ('hr', 'admin')
  )
);

CREATE POLICY "Users can create own test attempts"
ON test_attempts FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- LIBRARY: Все аутентифицированные могут читать
CREATE POLICY "Authenticated users can view library"
ON library_resources FOR SELECT
TO authenticated
USING (is_archived = false);
```

---

## 💻 Шаг 6: Подключение фронтенда

### 6.1 Установите Supabase клиент

```bash
npm install @supabase/supabase-js
```

### 6.2 Создайте файл `.env`

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

### 6.3 Создайте Supabase клиент

Создайте файл `src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Типы для TypeScript
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          first_name: string
          last_name: string
          role: 'admin' | 'hr' | 'brigadir' | 'employee' | 'candidate' | 'coordinator'
          status: string
          base_rate: number
          // ... остальные поля
        }
        Insert: {
          // поля для INSERT
        }
        Update: {
          // поля для UPDATE
        }
      }
      // ... остальные таблицы
    }
  }
}
```

### 6.4 Обновите AppContext.tsx

```typescript
import { supabase } from './lib/supabase'
import { useEffect } from 'react'

export const AppProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null)
  const [users, setUsers] = useState([])

  // Слушаем изменения auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUserProfile(session.user.id)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUserProfile(session.user.id)
      } else {
        setCurrentUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Загрузка профиля пользователя
  const loadUserProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (data) {
      setCurrentUser(data)
    }
  }

  // Login
  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error('Login error:', error)
      throw error
    }

    return data
  }

  // Logout
  const logout = async () => {
    await supabase.auth.signOut()
    setCurrentUser(null)
  }

  // Get users
  const getUsers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('last_name')

    if (data) {
      setUsers(data)
    }
  }

  // Add user
  const addUser = async (userData: any) => {
    const { data, error } = await supabase
      .from('users')
      .insert([userData])
      .select()

    return data?.[0]
  }

  // Update user
  const updateUser = async (userId: string, updates: any) => {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()

    if (data) {
      setUsers(prev => prev.map(u => u.id === userId ? data[0] : u))
    }

    return data?.[0]
  }

  // Get skills
  const getSkills = async () => {
    const { data, error } = await supabase
      .from('skills')
      .select('*')
      .eq('is_archived', false)
      .order('category', { ascending: true })

    return data
  }

  // Submit test
  const submitTest = async (testId: string, answers: any, score: number, passed: boolean) => {
    const { data, error } = await supabase
      .from('test_attempts')
      .insert([{
        user_id: currentUser?.id,
        test_id: testId,
        score,
        passed,
        answers,
        completed_at: new Date().toISOString()
      }])
      .select()

    return data?.[0]
  }

  return (
    <AppContext.Provider value={{
      currentUser,
      users,
      login,
      logout,
      getUsers,
      addUser,
      updateUser,
      getSkills,
      submitTest,
      // ... остальные методы
    }}>
      {children}
    </AppContext.Provider>
  )
}
```

---

## 📤 Шаг 7: Загрузка файлов

### 7.1 Загрузка документа

```typescript
const uploadDocument = async (file: File, userId: string) => {
  // Создаем уникальное имя файла
  const fileExt = file.name.split('.').pop()
  const fileName = `${userId}/${Date.now()}.${fileExt}`

  // Загружаем файл
  const { data, error } = await supabase.storage
    .from('documents')
    .upload(fileName, file)

  if (error) {
    console.error('Upload error:', error)
    return null
  }

  // Получаем публичный URL
  const { data: { publicUrl } } = supabase.storage
    .from('documents')
    .getPublicUrl(fileName)

  return publicUrl
}
```

### 7.2 Использование в компоненте

```typescript
const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (!file) return

  const url = await uploadDocument(file, currentUser.id)

  if (url) {
    // Сохраняем URL в базе данных
    await supabase
      .from('user_skills')
      .update({ document_url: url })
      .eq('id', userSkillId)
  }
}
```

---

## 🔄 Шаг 8: Realtime подписки

Supabase поддерживает realtime обновления!

```typescript
// Подписка на изменения в таблице users
useEffect(() => {
  const channel = supabase
    .channel('users-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'users' },
      (payload) => {
        console.log('Change received!', payload)
        // Обновляем локальное состояние
        if (payload.eventType === 'INSERT') {
          setUsers(prev => [...prev, payload.new])
        } else if (payload.eventType === 'UPDATE') {
          setUsers(prev => prev.map(u =>
            u.id === payload.new.id ? payload.new : u
          ))
        } else if (payload.eventType === 'DELETE') {
          setUsers(prev => prev.filter(u => u.id !== payload.old.id))
        }
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [])
```

---

## 📊 Шаг 9: Миграция данных

### 9.1 Загрузите seed данные

После создания схемы выполните в SQL Editor:

```bash
# Содержимое из seed_data.sql
# Но замените обычные UUID на auth.uid() где нужно
```

---

## 🧪 Шаг 10: Тестирование

### 10.1 Проверьте таблицы
```sql
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM skills;
SELECT COUNT(*) FROM tests;
```

### 10.2 Проверьте API
```typescript
// Тест подключения
const testConnection = async () => {
  const { data, error } = await supabase
    .from('skills')
    .select('count')

  console.log('Skills count:', data)
}
```

### 10.3 Проверьте Auth
```typescript
// Тест логина
const testLogin = async () => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@maxmaster.pl',
    password: 'admin123'
  })

  console.log('Login result:', data)
}
```

---

## 🚀 Шаг 11: Production готовность

### 11.1 Environment Variables

Production `.env`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 11.2 Включите Email Confirmation
1. Authentication → Email Templates
2. Настройте шаблоны писем
3. Включите "Confirm email"

### 11.3 Настройте Rate Limiting
1. Project Settings → API
2. Настройте лимиты запросов

### 11.4 Backup
Supabase автоматически создает daily backups на платном плане.

---

## 💡 Полезные функции Supabase

### Edge Functions (Serverless)
Создавайте serverless функции для сложной логики:

```typescript
// supabase/functions/calculate-salary/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const { userId } = await req.json()

  // Логика расчета зарплаты
  const salary = await calculateSalary(userId)

  return new Response(
    JSON.stringify({ salary }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

### Database Functions
Создавайте SQL функции для сложных запросов:

```sql
CREATE OR REPLACE FUNCTION get_user_salary(user_id UUID)
RETURNS TABLE (
  base_rate DECIMAL,
  skills_bonus DECIMAL,
  total_rate DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.base_rate,
    COALESCE(SUM(s.hourly_bonus), 0) as skills_bonus,
    u.base_rate + COALESCE(SUM(s.hourly_bonus), 0) as total_rate
  FROM users u
  LEFT JOIN user_skills us ON u.id = us.user_id
  LEFT JOIN skills s ON us.skill_id = s.id
  WHERE u.id = user_id
    AND us.status = 'confirmed'
  GROUP BY u.id;
END;
$$ LANGUAGE plpgsql;
```

---

## 📱 Преимущества Supabase

✅ **Не нужен backend** - REST API генерируется автоматически
✅ **Realtime** - WebSocket подписки из коробки
✅ **Auth** - полная система аутентификации
✅ **Storage** - хранение файлов
✅ **Edge Functions** - serverless функции
✅ **Dashboard** - удобный UI для управления
✅ **Free tier** - 500MB DB, 1GB файлов, 50K users
✅ **Automatic backups** - на платном плане
✅ **TypeScript поддержка** - автогенерация типов

---

## 🔗 Полезные ссылки

- [Supabase Docs](https://supabase.com/docs)
- [Supabase JS Client](https://supabase.com/docs/reference/javascript/introduction)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Storage](https://supabase.com/docs/guides/storage)
- [Realtime](https://supabase.com/docs/guides/realtime)

---

## 🎯 Следующие шаги

1. ✅ Создайте проект в Supabase
2. ✅ Примените схему (supabase_schema.sql)
3. ✅ Настройте RLS политики
4. ✅ Создайте Storage buckets
5. ✅ Установите Supabase клиент
6. ✅ Обновите AppContext
7. ✅ Тестируйте!

---

**Готово!** 🎉 Ваш проект готов к работе с Supabase!
