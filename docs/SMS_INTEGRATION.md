# SMS Integration - SMSAPI.pl

Интеграция SMS уведомлений через SMSAPI.pl для портала MaxMaster.

## 📋 Обзор

SMS уведомления автоматически отправляются при:
- **Приглашении кандидата** (CAND_INVITE_LINK) - с ссылкой на портал
- **Отклонении кандидата** (CAND_REJECTED) - уведомление об отклонении
- **Запросе документов** (CAND_DOCS_REQUEST) - запрос данных для умовы
- **Начале периода próбного** (TRIAL_START) - информация о начале работы
- **Подтверждении умiejętности** (PRACTICE_VERIFICATION_RESULT_APPROVED) - уведомление о повышении ставки

## 🔧 Настройка

### 1. Получите учетные данные SMSAPI.pl

1. Зарегистрируйтесь на https://www.smsapi.pl
2. Получите **API Token** (OAuth 2.0):
   - Панель → API → OAuth 2.0 Token
3. Зарегистрируйте **Sender Name**:
   - Панель → Ustawienia → Nazwy nadawcy
   - Рекомендуется: **MaxMaster**

### 2. Настройка Supabase Edge Function

#### Добавьте секреты в Supabase:

```bash
# В Supabase Dashboard:
# Project Settings → Edge Functions → Secrets

# Добавьте следующие секреты:
SMSAPI_TOKEN=your_oauth_token_here
SMSAPI_SENDER_NAME=MaxMaster
```

Или через CLI:

```bash
supabase secrets set SMSAPI_TOKEN=your_oauth_token_here
supabase secrets set SMSAPI_SENDER_NAME=MaxMaster
```

### 3. Деплой Edge Function

```bash
# Установите Supabase CLI (если еще не установлено)
npm install -g supabase

# Войдите в Supabase
supabase login

# Деплой функции send-sms
supabase functions deploy send-sms

# Проверьте статус
supabase functions list
```

### 4. Примените миграцию базы данных

Миграция создаст таблицу `sms_logs` для хранения истории отправленных SMS.

```bash
# Через Supabase Dashboard:
# SQL Editor → New Query → Вставьте содержимое файла:
# supabase/migrations/20260118_add_sms_logs.sql

# Или через CLI:
supabase db push
```

## 📊 Таблица sms_logs

Структура таблицы для логирования SMS:

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | UUID | Уникальный ID записи |
| user_id | UUID | ID пользователя (ссылка на users) |
| phone_number | VARCHAR(20) | Номер телефона получателя |
| message | TEXT | Текст сообщения |
| template_code | VARCHAR(100) | Код шаблона (CAND_INVITE_LINK, etc.) |
| status | VARCHAR(50) | Статус: pending, sent, delivered, failed |
| sms_id | VARCHAR(100) | ID сообщения от SMSAPI.pl |
| error_message | TEXT | Сообщение об ошибке (если есть) |
| created_at | TIMESTAMP | Время создания записи |
| sent_at | TIMESTAMP | Время отправки SMS |
| delivered_at | TIMESTAMP | Время доставки (будущее) |

## 🔍 Просмотр логов SMS

### В Supabase Dashboard:

```sql
-- Все отправленные SMS за последние 7 дней
SELECT * FROM sms_logs
WHERE created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- SMS для конкретного пользователя
SELECT * FROM sms_logs
WHERE user_id = 'user-uuid-here'
ORDER BY created_at DESC;

-- Статистика по шаблонам
SELECT
  template_code,
  status,
  COUNT(*) as count
FROM sms_logs
GROUP BY template_code, status
ORDER BY template_code, status;

-- Неудачные отправки
SELECT * FROM sms_logs
WHERE status = 'failed'
ORDER BY created_at DESC;
```

## 🧪 Тестирование

### Тест отправки SMS вручную:

```typescript
import { sendSMS, sendTemplatedSMS } from './lib/smsService';

// Простая отправка
await sendSMS({
  phoneNumber: '+48501234567',
  message: 'Test SMS from MaxMaster',
  templateCode: 'TEST'
});

// Отправка по шаблону
await sendTemplatedSMS(
  'CAND_INVITE_LINK',
  '+48501234567',
  {
    firstName: 'Jan',
    portalUrl: 'https://maxmaster.pl'
  }
);
```

### Тест Edge Function через curl:

```bash
curl -X POST \
  https://diytvuczpciikzdhldny.supabase.co/functions/v1/send-sms \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+48501234567",
    "message": "Test SMS",
    "templateCode": "TEST"
  }'
```

## 📝 Использование в коде

### Отправка SMS при приглашении друга:

```typescript
// В AppContext.tsx
import { sendTemplatedSMS } from '../lib/smsService';

const inviteFriend = async (firstName: string, lastName: string, phone: string) => {
  const portalUrl = window.location.origin;

  await sendTemplatedSMS(
    'CAND_INVITE_LINK',
    phone,
    { firstName, portalUrl }
  );
};
```

### Массовая рассылка:

```typescript
import { sendBulkSMS } from './lib/smsService';

const recipients = [
  { phoneNumber: '+48501234567', userId: 'user-1' },
  { phoneNumber: '+48501234568', userId: 'user-2' },
];

const result = await sendBulkSMS(
  recipients,
  'Witaj w MaxMaster! Zapraszamy na szkolenie jutro o 10:00.',
  'TRAINING_REMINDER'
);

console.log(`Wysłano: ${result.sent}, Błędy: ${result.failed}`);
```

## 🚨 Rozwiązywanie problemów

### SMS nie wysyłane:

1. **Sprawdź sekret SMSAPI_TOKEN:**
   ```bash
   supabase secrets list
   ```

2. **Sprawdź logi Edge Function:**
   ```bash
   supabase functions logs send-sms
   ```

3. **Sprawdź format numeru telefonu:**
   - Musi być w formacie międzynarodowym: `+48501234567` lub `48501234567`
   - Bez spacji i myślników

4. **Sprawdź saldo SMSAPI.pl:**
   - Panel → Saldo → Sprawdź dostępne punkty

### Błędy autoryzacji:

- Upewnij się, że token OAuth jest aktywny (nie wygasł)
- Sprawdź uprawnienia tokena w panelu SMSAPI.pl

### SMS za drogie:

- Sprawdź ustawienia SMSAPI.pl: ECO vs. PRO wiadomości
- ECO: tańsze, ale tylko dla polskich numerów
- PRO: droższe, ale więcej funkcji (długie SMS, Unicode)

## 💰 Koszty

Aktualny cennik SMSAPI.pl (przykładowe ceny):
- SMS ECO (PL): ~0.035 PLN
- SMS PRO (PL): ~0.045 PLN
- SMS międzynarodowe: różne ceny

**Rekomendacja:** Kup pakiet 1000 SMS ECO (~35 PLN) na start.

## 🔒 Bezpieczeństwo

✅ **Dobre praktyki:**
- API Token przechowywany TYLKO w Supabase Secrets
- Nigdy nie commituj tokena do git
- Regularnie odnawiaj tokeny OAuth
- Monitoruj logi SMS pod kątem nadużyć

❌ **NIE RÓB:**
- Nie umieszczaj tokena w frontend kodzie
- Nie udostępniaj tokena w chatach/emailach
- Nie używaj tego samego tokena w wielu projektach

## 📞 Wsparcie

- Dokumentacja SMSAPI.pl: https://www.smsapi.pl/docs/
- Panel SMSAPI.pl: https://ssl.smsapi.pl/
- Support: https://www.smsapi.pl/kontakt

---

**Utworzono:** 2026-01-18
**Autor:** Claude AI
**Projekt:** MaxMaster Skill Platform
