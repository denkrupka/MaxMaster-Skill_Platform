# Инструкция по деплою исправлений

## Статус
✅ **Production build готов** - все изменения собраны в `dist/` папке
⏳ **Требуется деплой** - нужно загрузить на hosting

---

## Проблема
Приложение на `portal.maxmaster.info` использует **старую версию кода** без наших исправлений.
Поэтому email links не работают правильно.

---

## Решение: Задеплой новый build

### Вариант 1: Если используется Vercel, Netlify, или похожий хостинг

**Git Deploy (Рекомендуется):**
```bash
# 1. Убедись что все изменения закоммичены
git status

# 2. Push в main/master branch (или тот который используется для production)
git checkout main
git merge claude/fix-signup-email-link-RH7CZ
git push origin main
```

Хостинг автоматически пересоберет и задеплоит.

---

### Вариант 2: Manual Deploy (если есть доступ к hosting panel)

**Если хостинг требует ручной загрузки файлов:**

1. Найди `dist/` папку в проекте
2. Загрузи **ВСЁ содержимое** папки `dist/` на хостинг
3. Убедись что `dist/index.html` загружен как главная страница

**FTP/SFTP команды:**
```bash
# Если используется rsync или scp
rsync -avz dist/ user@portal.maxmaster.info:/var/www/html/

# Или scp
scp -r dist/* user@portal.maxmaster.info:/var/www/html/
```

---

### Вариант 3: Если это локальный dev server

**Запусти dev server с новым кодом:**
```bash
# Останови текущий server (Ctrl+C если запущен)

# Запусти заново
npm run dev
```

Приложение откроется на `http://localhost:5173`

---

## После деплоя

### 1. Очисти browser cache
- Chrome/Edge: `Ctrl+Shift+Delete` → "Cached images and files" → "Clear data"
- Или Hard Refresh: `Ctrl+Shift+R` (Windows) / `Cmd+Shift+R` (Mac)

### 2. Открой Console для проверки
- Нажми `F12` → вкладка "Console"

### 3. Кликни на ссылку из нового email

Должны появиться логи:
```
[EmailConfirmationHandler] Starting redirect handling
[EmailConfirmationHandler] Current URL: https://portal.maxmaster.info/#access_token=...
[EmailConfirmationHandler] Hash: #access_token=...&type=signup
[EmailConfirmationHandler] Type: signup AccessToken present: true
[EmailConfirmationHandler] Redirecting to setup-password with params
```

### 4. Проверь результат
✅ Должна открыться страница "Witaj! Utwórz hasło"
✅ URL: `https://portal.maxmaster.info/#/setup-password#access_token=...`
✅ Можно установить пароль

---

## Что было исправлено

### Код приложения:
1. ✅ `App.tsx` - улучшен `EmailConfirmationHandler`:
   - Правильный парсинг hash параметров
   - Поддержка query params и hash params
   - Обработка ошибок (expired links)
   - Debug логирование

2. ✅ `pages/SetupPassword.tsx`:
   - Вызов `setSession()` перед `updateUser()`
   - Исправлена ошибка "Auth session missing!"
   - Парсинг refresh_token из URL

3. ✅ `supabase/functions/create-candidate/index.ts`:
   - Исправлен default URL: `portal.maxmaster.info` → `portal.maxmaster.info`
   - Правильный redirectUrl с `/#/setup-password`

### Документация:
4. ✅ `CRITICAL_FIX_INSTRUCTIONS.md` - пошаговая инструкция для Supabase Dashboard
5. ✅ `SUPABASE_CONFIG_FIX.md` - детальная документация проблемы
6. ✅ Обновлены README файлы

---

## Supabase Dashboard - также нужно настроить!

**ВАЖНО:** Даже после деплоя кода, нужно настроить Supabase:

### 1. Site URL
Открой: **Authentication** → **URL Configuration** → **Site URL**

Установи:
```
https://portal.maxmaster.info
```
(С `https://`, БЕЗ `/` на конце)

### 2. Redirect URLs
В той же секции добавь:
```
https://portal.maxmaster.info/#/setup-password
https://portal.maxmaster.info/#/reset-password
http://localhost:5173/#/setup-password
http://localhost:5173/#/reset-password
```

### 3. Redeploy Edge Function
**Edge Functions** → **create-candidate** → **Deploy/Redeploy**

---

## Полный чеклист для запуска

- [ ] Build приложения готов (`npm run build` выполнен)
- [ ] Код задеплоен на `portal.maxmaster.info`
- [ ] Browser cache очищен (Hard refresh)
- [ ] Supabase Dashboard: Site URL = `https://portal.maxmaster.info`
- [ ] Supabase Dashboard: Redirect URLs добавлены
- [ ] Edge function `create-candidate` redeployed
- [ ] Создан новый тестовый кандидат
- [ ] Email получен с новым линком
- [ ] Клик на линк открывает setup-password страницу
- [ ] Можно установить пароль и залогиниться

---

## Если всё ещё не работает

1. **Проверь Console логи** - должны быть `[EmailConfirmationHandler]` сообщения
2. **Проверь Network tab** - убедись что загружаются новые файлы (не из cache)
3. **Попробуй в режиме инкогнито** - чтобы исключить проблемы с cache
4. **Проверь URL из email** - должен содержать `redirect_to=...%23%2Fsetup-password`
5. **Убедись что merge выполнен** - `git log` должен показывать commits с фиксами

---

## Контакт
Если проблема остается, предоставь:
1. Screenshot Console с логами
2. Полный URL из browser после клика на email link
3. Screenshot Network tab (XHR requests)
