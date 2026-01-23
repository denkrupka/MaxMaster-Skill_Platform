# Инструкции по деплою исправлений Email Confirmation

## Критические файлы для деплоя

Для исправления редиректа после подтверждения email необходимо задеплоить следующие файлы:

### 1. **index.html** (КРИТИЧЕСКИ ВАЖНО!)

Этот файл содержит скрипт который перехватывает auth токены ДО загрузки React app.

**Путь**: `/index.html`

**Что делает**:
- Запускается перед React приложением
- Проверяет наличие `access_token` в URL hash
- Если токены найдены на корневом пути - редиректит на `/#/setup-password#access_token=...`

**БЕЗ ЭТОГО ФАЙЛА** редирект не будет работать даже со старыми email!

### 2. **email-redirect.html**

Промежуточная страница для обработки редиректов от Supabase.

**Путь**: `/public/email-redirect.html`

**Должен быть доступен по**: `https://portal.maxmaster.info/email-redirect.html`

### 3. **SetupPassword.tsx** (опционально, но рекомендуется)

Обновленная страница setup-password с детальным логированием.

**Путь**: `/pages/SetupPassword.tsx`

**Что добавлено**:
- Подробные console.log для отладки
- Улучшенная обработка токенов из hash

## Быстрый деплой (минимум)

Если у вас нет времени деплоить весь frontend, задеплойте ТОЛЬКО:

```bash
# 1. Build проекта
npm run build

# 2. Скопируйте на сервер минимум эти файлы:
# - dist/index.html (ОБЯЗАТЕЛЬНО!)
# - dist/email-redirect.html (ОБЯЗАТЕЛЬНО!)
```

## Полный деплой (рекомендуется)

```bash
# 1. Build всего проекта
npm run build

# 2. Деплой всей папки dist на хостинг
# Убедитесь что:
# - index.html в корне
# - email-redirect.html в корне (не в подпапке)
```

## Проверка деплоя

### 1. Проверьте index.html

Откройте в браузере: `https://portal.maxmaster.info/`

Посмотрите исходный код страницы (View Page Source). Должен быть виден скрипт:
```html
<script>
  // Email confirmation redirect handler - runs BEFORE React loads
  (function() {
    console.log('[PreReact] Email redirect handler started');
    ...
  })();
</script>
```

Если этого скрипта НЕТ - index.html не обновлен!

### 2. Проверьте email-redirect.html

Откройте: `https://portal.maxmaster.info/email-redirect.html`

Должна загрузиться страница с:
- Логотипом MaxMaster
- Спиннером
- Текстом "Aktywacja konta..."

### 3. Проверьте консоль

Откройте главную страницу с консолью (F12):

Вы должны увидеть:
```
[PreReact] Email redirect handler started
[PreReact] URL: https://portal.maxmaster.info/
[PreReact] Hash:
[PreReact] No redirect needed, loading React app
```

## Тестирование

### Тест со старым email (redirect на `/`)

1. Откройте Developer Tools (F12) → Console
2. Кликните на старую ссылку из email (которая редиректит на `/`)
3. Должны появиться логи:
```
[PreReact] Email redirect handler started
[PreReact] URL: https://portal.maxmaster.info/#access_token=...
[PreReact] Hash: #access_token=...&type=signup...
[PreReact] Parsed - access_token: true, type: signup
[PreReact] Auth tokens found on root, redirecting to setup-password
[PreReact] Redirected to: #/setup-password#access_token=...

[SetupPassword] Starting token check
[SetupPassword] Full URL: ...
[SetupPassword] Session created successfully for: email@example.com
```

4. Должна открыться форма setup-password с именем кандидата

### Тест с новым email (redirect на `/email-redirect.html`)

1. Создайте нового кандидата (после деплоя Edge Function)
2. Откройте консоль и кликните на ссылку в email
3. Должны появиться логи:
```
[email-redirect] Starting redirect handling
[email-redirect] Current URL: https://portal.maxmaster.info/email-redirect.html#access_token=...
[email-redirect] Valid tokens found, redirecting to setup-password
[email-redirect] Redirecting to: /#/setup-password#access_token=...

[SetupPassword] Starting token check
[SetupPassword] Session created successfully for: email@example.com
```

## Что делать если не работает

### Проблема: Консоль пустая

**Причина**: index.html не обновлен

**Решение**:
1. Проверьте исходный код страницы (View Page Source)
2. Убедитесь что скрипт `[PreReact]` присутствует
3. Если нет - задеплойте index.html заново

### Проблема: 404 на email-redirect.html

**Причина**: Файл не задеплоен или в неправильной папке

**Решение**:
1. Убедитесь что файл в dist/email-redirect.html
2. Задеплойте в корень сайта (рядом с index.html)

### Проблема: Редиректит на логин

**Причина**: Токены не передаются или не обрабатываются

**Решение**:
1. Проверьте консоль - есть ли логи?
2. Если нет логов - index.html не обновлен
3. Если есть логи но ошибка - отправьте логи для анализа

### Проблема: Ошибка "Invalid token"

**Причина**: Токен истек (старше 24 часов)

**Решение**:
1. Создайте нового кандидата
2. Используйте свежий email

## Суммарный чеклист

- [ ] Edge Function `create-candidate` задеплоена с `redirectUrl = /email-redirect.html`
- [ ] `index.html` задеплоен с скриптом `[PreReact]`
- [ ] `email-redirect.html` задеплоен и доступен
- [ ] В Supabase Redirect URLs добавлен `/email-redirect.html`
- [ ] Email template использует `{{ .ConfirmationURL }}`
- [ ] Site URL в Supabase: `https://portal.maxmaster.info`
- [ ] Тест: консоль показывает логи `[PreReact]`
- [ ] Тест: старые email работают (редирект через `/`)
- [ ] Тест: новые email работают (редирект через `/email-redirect.html`)

## Edge Function деплой

```bash
supabase functions deploy create-candidate
```

Убедитесь что в логах функции:
```
Redirect URL: https://portal.maxmaster.info/email-redirect.html
```

## Важные примечания

1. **index.html** - самый важный файл! Без него ничего не заработает
2. Старые email (до деплоя Edge Function) будут работать через index.html
3. Новые email (после деплоя Edge Function) будут работать через email-redirect.html
4. Оба пути ведут на `/#/setup-password` с токенами

## Архитектура решения

```
Старый email (redirect_to = /)
└─> Supabase verify
    └─> redirect: portal.maxmaster.info/#access_token=...
        └─> index.html загружается
            └─> [PreReact] скрипт перехватывает токены
                └─> redirect: /#/setup-password#access_token=...
                    └─> SetupPassword обрабатывает токены

Новый email (redirect_to = /email-redirect.html)
└─> Supabase verify
    └─> redirect: portal.maxmaster.info/email-redirect.html#access_token=...
        └─> email-redirect.html загружается
            └─> JavaScript перехватывает токены
                └─> redirect: /#/setup-password#access_token=...
                    └─> SetupPassword обрабатывает токены
```

Оба пути работают независимо и приводят к одному результату!
