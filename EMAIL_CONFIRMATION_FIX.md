# Исправление редиректа после подтверждения email

## Проблема

При регистрации кандидата через `inviteUserByEmail`:
1. Кандидат получает email с кнопкой подтверждения
2. Нажимает на кнопку
3. **Проблема:** попадает на страницу логина вместо страницы установки пароля

## Причина

Supabase использует custom email template, который содержит неправильную ссылку:
```html
{{ .SiteURL }}/#/setup-password?token={{ .Token }}&type=signup
```

Эта ссылка **НЕ работает** правильно с Supabase auth flow, потому что:
- Supabase генерирует свою собственную ссылку для подтверждения
- Эта ссылка включает валидацию токена на стороне Supabase
- После валидации Supabase редиректит на URL из `redirectTo` параметра
- Токены передаются в URL hash, а не в query params

## Решение

### 1. Создан файл `public/email-redirect.html`

Этот файл:
- Принимает редирект от Supabase с токенами в hash
- Извлекает `access_token`, `refresh_token`, `type` из URL
- Правильно редиректит на `/#/setup-password#access_token=...`

### 2. Обновлена функция `create-candidate`

Изменен `redirectUrl`:
```typescript
// БЫЛО:
const redirectUrl = `${siteUrl}/#/setup-password`

// СТАЛО:
const redirectUrl = `${siteUrl}/email-redirect.html`
```

### 3. Настройка Supabase Email Template (ВАЖНО!)

#### Опция A: Использовать ConfirmationURL (Рекомендуется)

В Supabase Dashboard → Authentication → Email Templates → Invite user:

**Замените кнопку в email template на:**
```html
<a href="{{ .ConfirmationURL }}"
   style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
  Potwierdź email i utwórz hasło ✉️
</a>
```

**Также обновите текстовую ссылку внизу:**
```html
<p style="margin: 0; color: #667eea; font-size: 12px; word-break: break-all; font-family: monospace;">
  {{ .ConfirmationURL }}
</p>
```

#### Опция B: Проверить Redirect URLs в Supabase

Убедитесь, что в Supabase Dashboard → Authentication → URL Configuration → Redirect URLs добавлены:

```
https://portal.maxmaster.info/email-redirect.html
http://localhost:5173/email-redirect.html
```

## Как работает исправление

### Правильный Flow:

1. **HR создает кандидата** → вызывается `inviteUserByEmail`
2. **Supabase отправляет email** с ссылкой вида:
   ```
   https://[supabase-project].supabase.co/auth/v1/verify?token=xxx&type=invite&redirect_to=https://portal.maxmaster.info/email-redirect.html
   ```
3. **Кандидат кликает** на ссылку в email
4. **Supabase валидирует токен** и редиректит на:
   ```
   https://portal.maxmaster.info/email-redirect.html#access_token=xxx&refresh_token=yyy&type=invite
   ```
5. **email-redirect.html извлекает токены** из hash и редиректит на:
   ```
   https://portal.maxmaster.info/#/setup-password#access_token=xxx&refresh_token=yyy&type=invite
   ```
6. **SetupPasswordPage** извлекает токены, устанавливает сессию, позволяет создать пароль
7. **После создания пароля** → редирект на `/candidate/dashboard`

## Тестирование

1. **Deploy изменений:**
   ```bash
   # Deploy Edge Function
   supabase functions deploy create-candidate

   # Deploy frontend (с обновленным public/email-redirect.html)
   npm run build
   # загрузите build на хостинг
   ```

2. **Создайте тестового кандидата** через HR панель

3. **Проверьте email** - откройте Developer Tools → Console перед кликом на кнопку

4. **Кликните на кнопку** в email и следите за редиректами в консоли:
   - Должны увидеть логи от `[email-redirect]`
   - Должны попасть на страницу `/setup-password`
   - Должны увидеть форму создания пароля с именем кандидата

## Важные замечания

### Переменные в Email Templates

Supabase предоставляет следующие переменные:

- `{{ .ConfirmationURL }}` - **Используйте ЭТУ** для кнопки подтверждения (рекомендуется)
- `{{ .SiteURL }}` - базовый URL сайта (из настроек)
- `{{ .Token }}` - сырой токен (НЕ используйте напрямую)
- `{{ .TokenHash }}` - hash токена (НЕ используйте напрямую)

### Redirect URLs в Supabase

Убедитесь, что `/email-redirect.html` добавлен в allowed redirect URLs:
- Supabase Dashboard → Authentication → URL Configuration
- Добавьте оба URL (production и localhost)

### HashRouter и Supabase Auth

При использовании React Router HashRouter:
- URL выглядит как `domain.com/#/route`
- Supabase добавляет токены после hash: `domain.com/page#access_token=...`
- Для HashRouter это превращается в: `domain.com/#/route#access_token=...`
- Поэтому нужен промежуточный `email-redirect.html` для правильной обработки

## Альтернативное решение (если не работает)

Если email-redirect.html не работает, можно использовать EmailConfirmationHandler на маршруте `/`:

1. В Supabase email template используйте:
   ```html
   <a href="{{ .ConfirmationURL }}">
   ```

2. В `create-candidate` используйте:
   ```typescript
   const redirectUrl = `${siteUrl}/`
   ```

3. `EmailConfirmationHandler` (уже есть в `App.tsx:100-221`) будет обрабатывать редирект

## Проверка настроек Supabase

### 1. Site URL
```
Authentication → URL Configuration → Site URL
Должен быть: https://portal.maxmaster.info
```

### 2. Redirect URLs
```
Authentication → URL Configuration → Redirect URLs
Должны быть:
- https://portal.maxmaster.info/email-redirect.html
- https://portal.maxmaster.info/#/setup-password
- http://localhost:5173/email-redirect.html
- http://localhost:5173/#/setup-password
```

### 3. Email Template
```
Authentication → Email Templates → Invite user
Кнопка должна использовать: {{ .ConfirmationURL }}
```

## Отладка

Если проблема сохраняется, проверьте:

1. **Browser Console** - логи от `[email-redirect]` и `[EmailConfirmationHandler]`
2. **Network Tab** - последовательность редиректов
3. **Supabase Logs** - логи Edge Function `create-candidate`
4. **Email Template** - убедитесь, что используется `{{ .ConfirmationURL }}`

## Контакты

При возникновении проблем:
- Проверьте консоль браузера на наличие логов
- Проверьте Supabase Dashboard → Logs
- Убедитесь, что email template обновлен
