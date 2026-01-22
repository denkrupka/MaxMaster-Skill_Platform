# КРИТИЧЕСКАЯ ПРОБЛЕМА: Email Links не работают

## Проблема
Email с регистрацией отправляет link на `https://portal.maxmaster.info/` вместо `https://portal.maxmaster.info/#/setup-password`.

## Причина
Supabase Dashboard конфигурация неправильная или edge function не был redeployed.

---

## РЕШЕНИЕ (Выполни ВСЕ шаги по порядку)

### Шаг 1: Исправь Site URL в Supabase Dashboard ⚠️ КРИТИЧНО

1. Открой https://supabase.com/dashboard
2. Выбери проект MaxMaster
3. Идти в **Authentication** → **URL Configuration**
4. Найди поле **"Site URL"**
5. Установи ТОЧНО такое значение:
   ```
   https://portal.maxmaster.info
   ```
   **ВАЖНО:**
   - Должно начинаться с `https://` (НЕ `http://`)
   - БЕЗ слэша `/` на конце
   - БЕЗ `/#/setup-password` на конце

6. Нажми **"Save"**

---

### Шаг 2: Добавь Redirect URLs ⚠️ КРИТИЧНО

В той же секции **Authentication** → **URL Configuration**, найди **"Redirect URLs"**.

Добавь следующие URL (каждый на отдельной строке):

```
https://portal.maxmaster.info/#/setup-password
https://portal.maxmaster.info/#/reset-password
http://localhost:5173/#/setup-password
http://localhost:5173/#/reset-password
```

**ВАЖНО:**
- Каждый URL должен быть на ОТДЕЛЬНОЙ строке
- БЕЗ пробелов в начале или конце
- Должны содержать `/#/` (HashRouter)

Нажми **"Save"**

---

### Шаг 3: Redeploy Edge Function

**Вариант A: Через Supabase Dashboard (Рекомендуется)**

1. Идти в **Edge Functions** → **create-candidate**
2. Кликни на кнопку **"Deploy"** или **"Redeploy"**
3. Подтверди deployment

**Вариант B: Через CLI (если установлен)**

Выполни в терминале:
```bash
cd /home/user/MaxMaster-Skill_Platform
npx supabase functions deploy create-candidate
```

---

### Шаг 4: Проверь конфигурацию

Вернись в **Edge Functions** → **create-candidate** → **Secrets/Environment Variables**

Убедись что есть переменная:
- Имя: `SITE_URL`
- Значение: `https://portal.maxmaster.info`

Если её нет, добавь и redeploy функцию еще раз.

---

### Шаг 5: ТЕСТ

1. **УДАЛИ старого тестового кандидата** из базы данных (если был создан)
2. **Создай НОВОГО кандидата** через HR панель с новым email
3. **Проверь почту** - должен прийти email
4. **Скопируй URL из email** (не кликай!)
5. URL должен выглядеть так:
   ```
   https://diytvuczpciikzdhldny.supabase.co/auth/v1/verify?token=...&type=signup&redirect_to=https://portal.maxmaster.info/%23%2Fsetup-password
   ```

   **Обрати внимание:** `redirect_to` теперь содержит `%23%2Fsetup-password` (это URL-encoded `/#/setup-password`)

6. **Кликни на link** - должен перенаправить на страницу setup-password

---

## Как понять что все работает?

✅ **ПРАВИЛЬНО:**
- Кликаешь link из email
- Открывается страница "Witaj, [Имя]! Utwórz hasło"
- В URL видно: `https://portal.maxmaster.info/#/setup-password#access_token=...`
- Можешь ввести пароль и сохранить

❌ **НЕПРАВИЛЬНО:**
- Кликаешь link из email
- Перенаправляет на страницу логина
- URL: `https://portal.maxmaster.info/#/login`

---

## Если ВСЕ ЕЩЕ не работает

1. Проверь что Site URL в Supabase **ТОЧНО** `https://portal.maxmaster.info` (с https://, без слэша)
2. Проверь что Redirect URLs содержат `https://portal.maxmaster.info/#/setup-password`
3. Убедись что edge function был redeployed ПОСЛЕ изменения конфигурации
4. Очисти cache браузера (Ctrl+Shift+Delete)
5. Попробуй в режиме инкогнито

---

## Техническая информация (для дебага)

Текущая конфигурация edge function:
- Файл: `/home/user/MaxMaster-Skill_Platform/supabase/functions/create-candidate/index.ts`
- Строка 32: `const siteUrl = Deno.env.get('SITE_URL') || 'https://portal.maxmaster.info'`
- Строка 33: `const redirectUrl = \`\${siteUrl}/#/setup-password\``
- Строка 47: `redirectTo: redirectUrl`

Если в email redirect_to НЕ содержит `/#/setup-password`, это значит:
1. Edge function использует старый код (не redeployed)
2. ИЛИ Supabase игнорирует redirectTo потому что URL не в allowed list

---

## Контакт
Если проблема продолжается после выполнения всех шагов, предоставь:
1. Screenshot конфигурации Site URL
2. Screenshot конфигурации Redirect URLs
3. Полный URL из нового email (после re-deploy)
