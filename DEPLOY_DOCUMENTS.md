# Documents Module - Deployment Guide

## Выполненные задачи (16 пунктов)

### 🔴 Критично (1-5)
1. ✅ **Edge Functions deploy (4 штуки)**
   - `generate-document-number` - атомарная генерация номеров документов
   - `generate-document-pdf` - генерация PDF из шаблонов
   - `log-document-event` - логирование событий (audit log)
   - `analyze-document` - AI анализ документов через Gemini

2. ✅ **Пагинация** - компонент `Pagination.tsx` с умным отображением страниц

3. ✅ **Валидация форм** - `FormValidation.tsx` с FormInput, FormTextarea, FormSelect

4. ✅ **Error boundaries** - `ErrorBoundary.tsx` с dev mode и recovery

5. ✅ **Loading skeletons** - 7 вариантов скелетонов (table, list, card, wizard, stats)

### 🟡 UX (6-10)
6. ✅ **"Сохранить как шаблон"** - `SaveAsTemplateModal.tsx`

7. ✅ **Email отправка UI** - `EmailSendModal.tsx` с вложениями и ссылками

8. ✅ **Вкладка автоматизаций** - `AutomationsTab.tsx` (trigger → action)

9. ✅ **Страница подписания** - `SigningPage.tsx` для внешних получателей

10. ✅ **Пагинация аудит-лога** - `AuditLogPagination.tsx`

### 💡 Фичи (11-16)
11. ✅ **PDF inline preview** - `PDFPreviewModal.tsx` с zoom и навигацией

12. ✅ **Drag & drop секций** - `DragDropSections.tsx` для шаблонов

13. ✅ **Быстрое редактирование** - `QuickEditField.tsx` inline editing

14. ✅ **Привязка документ ↔ фактура** - `DocumentInvoiceLink.tsx`

15. ✅ **Напоминания** - `DocumentReminders.tsx` с email/notification

16. ✅ **QR-код на PDF** - `DocumentQRCode.tsx` с верификацией

---

## Порядок деплоя

### 1. База данных (Supabase SQL Editor)
```bash
# Выполнить миграцию:
supabase/migrations/20260315_documents_stage2.sql
```

### 2. Edge Functions (Supabase CLI)
```bash
# Установить Supabase CLI если нужно
npm install -g supabase

# Логин
supabase login

# Линк проекта
supabase link --project-ref <your-project-ref>

# Деплой функций
supabase functions deploy generate-document-number
supabase functions deploy generate-document-pdf
supabase functions deploy log-document-event
supabase functions deploy analyze-document
```

### 3. Environment Variables (Supabase Dashboard)
В разделе Project Settings → Edge Functions добавить:
- `GEMINI_API_KEY` - для AI анализа (опционально)

### 4. Frontend
```bash
# Установить зависимости
npm install

# Сборка
npm run build

# Деплой (Vercel/Netlify/etc)
npm run deploy
```

---

## Структура файлов

```
components/documents/
├── index.ts                    # Barrel export
├── Pagination.tsx              # Пагинация (пункт 2)
├── AuditLogPagination.tsx      # Пагинация аудит-лога (пункт 10)
├── ErrorBoundary.tsx           # Error boundaries (пункт 4)
├── FormValidation.tsx          # Валидация форм (пункт 3)
├── LoadingSkeletons.tsx        # Loading skeletons (пункт 5)
├── SaveAsTemplateModal.tsx     # Сохранить как шаблон (пункт 6)
├── EmailSendModal.tsx          # Email отправка (пункт 7)
├── AutomationsTab.tsx          # Автоматизации (пункт 8)
├── SigningPage.tsx             # Страница подписания (пункт 9)
├── PDFPreviewModal.tsx         # PDF preview (пункт 11)
├── DragDropSections.tsx        # Drag & drop (пункт 12)
├── QuickEditField.tsx          # Быстрое редактирование (пункт 13)
├── DocumentInvoiceLink.tsx     # Связь с фактурой (пункт 14)
├── DocumentReminders.tsx       # Напоминания (пункт 15)
└── DocumentQRCode.tsx          # QR-код (пункт 16)

supabase/functions/
├── generate-document-number/   # Edge Function (пункт 1)
├── generate-document-pdf/      # Edge Function (пункт 1)
├── log-document-event/         # Edge Function (пункт 1)
└── analyze-document/           # Edge Function (пункт 1)

supabase/migrations/
└── 20260315_documents_stage2.sql  # Миграция БД
```

---

## Git коммиты

```
c179d93 feat(documents): batch 1 - critical features (1-5)
f933fc4 feat(documents): batch 2 - UX features (6-10)
3093425 feat(documents): batch 3 - advanced features (11-16)
```

---

## QA Checklist

- [ ] Edge Functions деплоятся без ошибок
- [ ] Пагинация работает на списке документов
- [ ] Валидация форм показывает ошибки
- [ ] Error Boundary ловит ошибки
- [ ] Skeletons отображаются при загрузке
- [ ] "Сохранить как шаблон" создаёт шаблон
- [ ] Email отправка создаёт записи в document_emails
- [ ] Автоматизации включаются/выключаются
- [ ] Страница подписания доступна по токену
- [ ] Аудит-лог пагинируется
- [ ] PDF preview открывается в модалке
- [ ] Drag & drop меняет порядок секций
- [ ] Quick edit сохраняет изменения
- [ ] Связь с фактурой работает
- [ ] Напоминания создаются и отображаются
- [ ] QR-код генерируется и скачивается

---

## Известные ограничения

1. **PDF Generation** - текущая реализация возвращает HTML для preview. Для production PDF рекомендуется:
   - Puppeteer/Playwright в Edge Function
   - Внешний сервис (PDF.co, DocRaptor)
   - Библиотека jsPDF/pdfmake на клиенте

2. **AI Analysis** - требует GEMINI_API_KEY. Без ключа возвращает placeholder.

3. **Email Sending** - создаёт записи в БД. Для реальной отправки нужен:
   - Edge Function с Resend/SendGrid
   - Cron job для обработки очереди

4. **QR Verification** - требует создания страницы `/verify/:documentId`
