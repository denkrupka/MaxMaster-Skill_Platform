# Отладка Email Confirmation Redirect

## Проблема
После клика на кнопку подтверждения email пользователь попадает на страницу логина вместо setup-password.

## Пошаговая отладка

### Шаг 1: Проверить что email template использует ConfirmationURL

В Supabase Dashboard → Authentication → Email Templates → **Invite user** должно быть:

```html
<a href="{{ .ConfirmationURL }}" style="...">
  Potwierdź email i utwórz hasło ✉️
</a>
```

✅ **УЖЕ ИСПРАВЛЕНО** (согласно вашему коду)

### Шаг 2: Проверить Redirect URLs в Supabase

**Supabase Dashboard → Authentication → URL Configuration → Redirect URLs**

Должны быть добавлены:
```
https://portal.maxmaster.info/email-redirect.html
https://portal.maxmaster.info/#/setup-password
http://localhost:5173/email-redirect.html
http://localhost:5173/#/setup-password
```

⚠️ **КРИТИЧЕСКИ ВАЖНО**: Если этого нет, Supabase НЕ ПОЗВОЛИТ редиректить на email-redirect.html

### Шаг 3: Проверить что email-redirect.html задеплоен

Откройте в браузере:
```
https://portal.maxmaster.info/email-redirect.html
```

Должна открыться страница с логотипом MaxMaster и спиннером.

❌ **ВОЗМОЖНАЯ ПРОБЛЕМА**: Если файл не найден (404), значит frontend не задеплоен с новыми изменениями.

### Шаг 4: Deploy функции create-candidate

```bash
supabase functions deploy create-candidate
```

Убедитесь, что функция использует:
```typescript
const redirectUrl = `${siteUrl}/email-redirect.html`
```

### Шаг 5: Deploy frontend с email-redirect.html

```bash
npm run build
```

Затем загрузите build на ваш хостинг. Убедитесь что файл `email-redirect.html` находится в корне (не в папке `#`).

### Шаг 6: Тестирование с консолью браузера

1. Откройте Developer Tools (F12) → Console
2. Создайте тестового кандидата
3. Откройте полученный email
4. Перед кликом на кнопку убедитесь что консоль открыта
5. Кликните на кнопку
6. Следите за логами в консоли

**Ожидаемая последовательность логов:**

```
[email-redirect] Starting redirect handling
[email-redirect] Current URL: https://portal.maxmaster.info/email-redirect.html#access_token=...
[email-redirect] Hash: #access_token=...&refresh_token=...&type=invite
[email-redirect] Parsed params: { hasAccessToken: true, hasRefreshToken: true, type: 'invite' }
[email-redirect] Valid tokens found, redirecting to setup-password
[email-redirect] Redirecting to: /#/setup-password#access_token=...

[SetupPassword] Starting token check
[SetupPassword] URL: https://portal.maxmaster.info/#/setup-password#access_token=...
[SetupPassword] Found access_token in hash
[SetupPassword] Setting session with access_token
[SetupPassword] Session created successfully
```

### Шаг 7: Что делать если не работает

#### Проблема A: 404 на email-redirect.html

**Решение**: Frontend не задеплоен. Нужно:
1. `npm run build`
2. Загрузить build на хостинг
3. Убедиться что `email-redirect.html` в корне рядом с `index.html`

#### Проблема B: Supabase редиректит на другой URL

**Логи покажут**:
```
[email-redirect] Current URL: https://portal.maxmaster.info/#access_token=...
```

**Причина**: redirect URL не добавлен в Supabase allowed list, поэтому Supabase редиректит на Site URL вместо `/email-redirect.html`.

**Решение**: Добавить `/email-redirect.html` в Supabase → Authentication → URL Configuration → Redirect URLs

#### Проблема C: Email не приходит

**Причина**: Email template не обновлен в Supabase или используется старый.

**Решение**:
1. Проверить Supabase Dashboard → Authentication → Email Templates → Invite user
2. Убедиться что используется `{{ .ConfirmationURL }}`
3. Сохранить изменения

#### Проблема D: Ссылка в email ведет на другой URL

Посмотрите в исходном коде email на что ведет кнопка.

**Если ссылка вида**:
```
https://portal.maxmaster.info/#/setup-password?token=xxx&type=signup
```

❌ **НЕПРАВИЛЬНО** - это старый template, обновите на `{{ .ConfirmationURL }}`

**Если ссылка вида**:
```
https://xxxxx.supabase.co/auth/v1/verify?token=xxx&type=invite&redirect_to=https://portal.maxmaster.info/email-redirect.html
```

✅ **ПРАВИЛЬНО** - это использует `{{ .ConfirmationURL }}`

## Проверка настроек Supabase

### Site URL
```
Authentication → URL Configuration → Site URL
https://portal.maxmaster.info
```

### Redirect URLs
```
Authentication → URL Configuration → Redirect URLs

ОБЯЗАТЕЛЬНО добавить:
https://portal.maxmaster.info/email-redirect.html
https://portal.maxmaster.info/#/setup-password
```

### Email Template
```
Authentication → Email Templates → Invite user

Кнопка должна использовать:
{{ .ConfirmationURL }}

НЕ использовать:
{{ .SiteURL }}/#/setup-password?token={{ .Token }}
```

## Альтернативное решение (если всё остальное не работает)

Если `email-redirect.html` по какой-то причине не работает, можно использовать EmailConfirmationHandler на маршруте "/".

### Вариант 1: Изменить redirectTo на корень

В `create-candidate/index.ts`:
```typescript
const redirectUrl = `${siteUrl}/`
```

EmailConfirmationHandler (уже есть в App.tsx:100-221) обработает редирект.

### Вариант 2: Изменить redirectTo на HashRouter путь

В `create-candidate/index.ts`:
```typescript
const redirectUrl = `${siteUrl}/#/setup-password`
```

Но это работает ТОЛЬКО если Supabase разрешает hash в redirect URL (может не работать).

## Итоговый чеклист

- [ ] Email template использует `{{ .ConfirmationURL }}`
- [ ] В Supabase added redirect URLs: `/email-redirect.html` и `/#/setup-password`
- [ ] Site URL в Supabase: `https://portal.maxmaster.info`
- [ ] Edge function `create-candidate` задеплоена с `redirectUrl = .../email-redirect.html`
- [ ] Frontend задеплоен с файлом `email-redirect.html` в корне
- [ ] Тестовый email получен и ссылка ведет на `supabase.co/auth/v1/verify`
- [ ] При клике на ссылку в консоли появляются логи `[email-redirect]`
- [ ] После обработки появляются логи `[SetupPassword]`
- [ ] Отображается форма setup-password с именем кандидата
