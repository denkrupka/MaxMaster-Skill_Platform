# 🚀 MaxMaster Skills + Supabase - Quick Start (15 минут)

## Самое быстрое руководство для Supabase

---

## ⚡ Шаг 1: Создайте проект (2 минуты)

1. Перейдите на https://supabase.com
2. Нажмите "New Project"
3. Заполните:
   - **Name**: MaxMaster Skills
   - **Database Password**: (придумайте и сохраните!)
   - **Region**: Europe (Frankfurt)
4. Нажмите "Create new project"
5. Ждите 2-3 минуты

---

## 📊 Шаг 2: Создайте базу данных (3 минуты)

### 2.1 Откройте SQL Editor
- В левом меню → **SQL Editor**
- Нажмите **New Query**

### 2.2 Примените схему
- Скопируйте **ВСЁ** содержимое файла `database/supabase_schema.sql`
- Вставьте в SQL Editor
- Нажмите **Run** или `Ctrl+Enter`
- Ждите ~30 секунд

### 2.3 Примените политики безопасности
- Создайте **New Query**
- Скопируйте **ВСЁ** содержимое файла `database/supabase_rls_policies.sql`
- Вставьте и нажмите **Run**

✅ **База данных создана!** У вас теперь 22 таблицы с полной защитой.

---

## 🔐 Шаг 3: Создайте тестового пользователя (2 минуты)

### 3.1 Откройте Authentication
- В левом меню → **Authentication** → **Users**
- Нажмите **Add User** → **Create new user**

### 3.2 Заполните данные
```
Email: admin@maxmaster.pl
Password: admin123
Auto Confirm User: ✅ (включите!)
```

### 3.3 Добавьте профиль в SQL Editor
```sql
-- Создаем профиль для admin
INSERT INTO public.users (
  id, email, first_name, last_name, role, status, base_rate
)
SELECT
  id,
  'admin@maxmaster.pl',
  'Admin',
  'MaxMaster',
  'admin',
  'active',
  0
FROM auth.users
WHERE email = 'admin@maxmaster.pl';
```

✅ **Тестовый пользователь создан!**

---

## 📁 Шаг 4: Создайте Storage Buckets (2 минуты)

### 4.1 Откройте Storage
- В левом меню → **Storage**

### 4.2 Создайте buckets
Нажмите **New bucket** для каждого:

1. **documents** - приватный
2. **certificates** - приватный
3. **verification-photos** - приватный
4. **resumes** - приватный
5. **avatars** - публичный ✅

✅ **Storage настроен!**

---

## 🔑 Шаг 5: Скопируйте ключи API (1 минута)

### 5.1 Откройте Settings
- В левом меню → **Project Settings** → **API**

### 5.2 Скопируйте:
```
Project URL: https://xxxxx.supabase.co
anon public key: eyJhbGci...
```

---

## 💻 Шаг 6: Настройте фронтенд (5 минут)

### 6.1 Установите Supabase клиент

```bash
npm install @supabase/supabase-js
```

### 6.2 Создайте .env файл

Создайте файл `.env` в корне проекта:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

**Замените** на ваши значения из Шага 5!

### 6.3 Скопируйте файлы

Файлы уже созданы, просто используйте их:

✅ `src/lib/supabase.ts` - уже создан
✅ `src/context/AppContext.supabase.example.tsx` - пример готов

### 6.4 Обновите AppContext

**Вариант А: Быстрый способ (рекомендуется для начала)**

Замените ваш `src/context/AppContext.tsx` на:

```typescript
// Просто скопируйте содержимое из:
// src/context/AppContext.supabase.example.tsx
```

**Вариант Б: Постепенная миграция**

Начните с одного компонента (например, Login) и постепенно переносите.

### 6.5 Обновите Login страницу

```typescript
import { useAppContext } from './context/AppContext';

const LoginPage = () => {
  const { login } = useAppContext();

  const handleLogin = async (email: string, password: string) => {
    try {
      await login(email, password);
      // Перенаправление произойдет автоматически
    } catch (error) {
      alert('Ошибка входа');
    }
  };

  return (
    // ... ваш UI
    <input
      type="email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
    />
    <input
      type="password"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
    />
    <button onClick={() => handleLogin(email, password)}>
      Войти
    </button>
  );
};
```

---

## 🧪 Шаг 7: Тестирование (2 минуты)

### 7.1 Запустите проект

```bash
npm run dev
```

### 7.2 Попробуйте войти

```
Email: admin@maxmaster.pl
Password: admin123
```

### 7.3 Проверьте в Supabase Dashboard

- **Authentication** → **Users** - должен появиться активный пользователь
- **Table Editor** → **users** - должен быть профиль
- **SQL Editor** - попробуйте:

```sql
SELECT * FROM users;
SELECT * FROM skills;
```

✅ **Всё работает!**

---

## 🎯 Что дальше?

### Загрузите начальные данные

Если хотите начальные данные (навыки, тесты, должности), выполните в SQL Editor:

```sql
-- Скопируйте содержимое из database/seed_data.sql
-- НО замените UUID на реальные (из auth.users)
```

### Добавьте больше пользователей

Через **Authentication** → **Add User** создайте:
- HR менеджера (hr@maxmaster.pl)
- Бригадира (brigadir@maxmaster.pl)
- Сотрудника (employee@maxmaster.pl)

Для каждого добавьте профиль через SQL:

```sql
INSERT INTO public.users (id, email, first_name, last_name, role, status)
SELECT id, 'hr@maxmaster.pl', 'Anna', 'HR', 'hr', 'active'
FROM auth.users WHERE email = 'hr@maxmaster.pl';
```

---

## 📚 Примеры использования

### Получить всех пользователей

```typescript
import { db } from './lib/supabase';

const { data: users } = await db.users.getAll();
```

### Получить навыки пользователя

```typescript
const { data: skills } = await db.userSkills.getByUserId(userId);
```

### Загрузить файл

```typescript
import { storage, utils } from './lib/supabase';

const handleUpload = async (file: File) => {
  const userId = 'xxx';
  const path = utils.generateFilePath(userId, file.name);

  const { data } = await storage.upload('documents', path, file);
  const url = storage.getPublicUrl('documents', path);

  // Сохраните URL в базе данных
};
```

### Подписаться на изменения (Realtime)

```typescript
import { realtime } from './lib/supabase';

const channel = realtime.subscribe('user_skills', (payload) => {
  console.log('Изменение:', payload);
  // Обновите UI
});

// Cleanup
return () => realtime.unsubscribe(channel);
```

---

## 🆘 Troubleshooting

### Ошибка: "relation does not exist"
- Убедитесь, что выполнили `supabase_schema.sql`
- Проверьте в **Table Editor** что таблицы созданы

### Ошибка: "permission denied"
- Выполните `supabase_rls_policies.sql`
- Проверьте что пользователь существует в `auth.users` И в `public.users`

### Логин не работает
- Проверьте что пользователь создан в **Authentication**
- Проверьте что профиль создан в **Table Editor** → **users**
- Проверьте `.env` файл

### Файлы не загружаются
- Проверьте что bucket создан в **Storage**
- Проверьте политики в SQL Editor:
```sql
SELECT * FROM storage.buckets;
SELECT * FROM pg_policies WHERE tablename = 'objects';
```

---

## 🎉 Готово!

Теперь у вас есть:

✅ Работающая база данных Supabase
✅ Автоматическая REST API
✅ Аутентификация
✅ Загрузка файлов
✅ Realtime обновления
✅ Безопасность (RLS)

**Никакого backend кода писать не нужно!** 🚀

---

## 📖 Дополнительные ресурсы

- `SUPABASE_SETUP.md` - Полное руководство
- `supabase_schema.sql` - SQL схема
- `supabase_rls_policies.sql` - Политики безопасности
- `src/lib/supabase.ts` - Библиотека клиента
- `src/context/AppContext.supabase.example.tsx` - Пример контекста

---

**Время установки**: ~15 минут
**Сложность**: Легко
**Результат**: Production-ready приложение

Удачи! 🚀
