# Supabase Edge Functions

Этот проект использует Supabase Edge Functions для безопасного хранения API ключей на сервере.

## Функции

### `parse-cv`

Парсит CV (PDF) через Google Gemini AI и извлекает данные кандидата.

**Входные данные:**
```json
{
  "pdfBase64": "base64_encoded_pdf_data",
  "positions": ["Elektryk", "Monterka", "..."]
}
```

**Выходные данные:**
```json
{
  "success": true,
  "data": {
    "first_name": "Jan",
    "last_name": "Kowalski",
    "email": "jan@example.com",
    "phone": "+48 123 456 789",
    "target_position": "Elektryk"
  }
}
```

## Как задеплоить Edge Functions

### Вариант 1: Через Supabase CLI (рекомендуется)

1. **Установите Supabase CLI:**
   ```bash
   npm install -g supabase
   ```

2. **Войдите в Supabase:**
   ```bash
   supabase login
   ```

3. **Свяжите проект:**
   ```bash
   supabase link --project-ref diytvuczpciikzdhldny
   ```

4. **Установите секреты (API ключи):**
   ```bash
   supabase secrets set GEMINI_API_KEY=your_actual_api_key_here
   ```

5. **Задеплойте функцию:**
   ```bash
   supabase functions deploy parse-cv
   ```

6. **Проверьте статус:**
   ```bash
   supabase functions list
   ```

### Вариант 2: Через Supabase Dashboard

1. Перейдите в ваш проект: https://diytvuczpciikzdhldny.supabase.co
2. Откройте **Edge Functions** в боковом меню
3. Нажмите **Deploy new function**
4. Выберите способ загрузки:
   - Либо загрузите папку `supabase/functions/parse-cv`
   - Либо скопируйте код из `index.ts`
5. В **Settings** → **Secrets** добавьте:
   - `GEMINI_API_KEY` = ваш API ключ от Google Gemini

## Получение Google Gemini API ключа

1. Перейдите на https://ai.google.dev/
2. Нажмите "Get API key"
3. Создайте или выберите проект
4. Скопируйте сгенерированный API ключ
5. Добавьте его в секреты Supabase (см. выше)

## Тестирование

После деплоя функцию можно протестировать через Dashboard или curl:

```bash
curl -X POST 'https://diytvuczpciikzdhldny.supabase.co/functions/v1/parse-cv' \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "pdfBase64": "...",
    "positions": ["Elektryk"]
  }'
```

## Логи

Просмотр логов функции:

```bash
supabase functions logs parse-cv
```

Или через Dashboard: **Edge Functions** → **parse-cv** → **Logs**

## Важно! 🔒

- **НИКОГДА** не коммитьте API ключи в Git
- API ключ хранится только в Supabase Secrets
- Клиентский код не имеет доступа к API ключу
- Все запросы к Gemini API идут через Edge Function

## Обновление функции

Если вы изменили код функции:

```bash
supabase functions deploy parse-cv --no-verify-jwt
```

Флаг `--no-verify-jwt` позволяет вызывать функцию без JWT токена (для публичного доступа).
