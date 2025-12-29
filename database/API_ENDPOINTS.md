# MaxMaster Skills Platform - API Endpoints Specification

## Обзор

Полная спецификация REST API для подключения фронтенда к базе данных.

**Base URL**: `http://localhost:3000/api` (для разработки)

**Authentication**: JWT Bearer Token
```
Authorization: Bearer <token>
```

---

## 📋 Содержание

1. [Authentication](#authentication)
2. [Users](#users)
3. [Candidates](#candidates)
4. [Employees](#employees)
5. [Skills](#skills)
6. [Tests](#tests)
7. [Library](#library)
8. [Quality & Performance](#quality--performance)
9. [Notifications](#notifications)
10. [System Configuration](#system-configuration)

---

## 🔐 Authentication

### POST /auth/login
Вход пользователя

**Request Body**:
```json
{
  "email": "employee@maxmaster.pl",
  "password": "password123"
}
```

**Response**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "employee@maxmaster.pl",
    "first_name": "Jan",
    "last_name": "Kowalski",
    "role": "employee",
    "status": "active"
  }
}
```

### POST /auth/register
Регистрация кандидата

**Request Body**:
```json
{
  "email": "candidate@email.com",
  "password": "password123",
  "first_name": "Jan",
  "last_name": "Kowalski",
  "phone": "500-123-456"
}
```

### POST /auth/logout
Выход из системы

### POST /auth/refresh
Обновление токена

### POST /auth/reset-password
Сброс пароля

---

## 👥 Users

### GET /users
Получить список пользователей (с фильтрами)

**Query Parameters**:
- `role` - фильтр по роли (admin, hr, employee, candidate, brigadir, coordinator)
- `status` - фильтр по статусу
- `search` - поиск по имени/email
- `page` - номер страницы
- `limit` - количество на странице

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "email": "employee@maxmaster.pl",
      "first_name": "Jan",
      "last_name": "Kowalski",
      "role": "employee",
      "status": "active",
      "base_rate": 24.00,
      "contract_type": "uop",
      "hired_date": "2023-01-15T00:00:00Z",
      "assigned_brigadir_id": "uuid"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

### GET /users/:id
Получить данные пользователя по ID

### POST /users
Создать нового пользователя (только HR/Admin)

**Request Body**:
```json
{
  "email": "new@maxmaster.pl",
  "password": "password123",
  "first_name": "Jan",
  "last_name": "Kowalski",
  "role": "employee",
  "base_rate": 24.00,
  "contract_type": "uop",
  "phone": "500-123-456"
}
```

### PUT /users/:id
Обновить данные пользователя

### DELETE /users/:id
Удалить пользователя (soft delete)

### GET /users/:id/skills
Получить навыки пользователя

### GET /users/:id/salary-history
Получить историю зарплаты

### GET /users/:id/test-attempts
Получить попытки тестов

---

## 🎯 Candidates

### GET /candidates
Получить список кандидатов

**Query Parameters**:
- `status` - фильтр по статусу (invited, started, tests_completed, etc.)
- `source` - источник (OLX, Pracuj.pl, etc.)
- `search` - поиск

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "first_name": "Marek",
      "last_name": "Kandydacki",
      "email": "marek.k@gmail.com",
      "status": "tests_completed",
      "source": "Pracuj.pl",
      "target_position": "Elektryk",
      "notes": "Dobre wrażenie",
      "resume_url": "resume_marek.pdf",
      "tests_passed": 2,
      "tests_total": 2,
      "created_at": "2023-10-20T10:00:00Z"
    }
  ]
}
```

### POST /candidates
Добавить кандидата

### PUT /candidates/:id/status
Изменить статус кандидата

**Request Body**:
```json
{
  "status": "interested",
  "notes": "Kandydat zainteresowany współpracą"
}
```

### POST /candidates/:id/move-to-trial
Перевести кандидата в период próbny

**Request Body**:
```json
{
  "brigadir_id": "uuid",
  "start_date": "2023-11-01",
  "end_date": "2023-12-01",
  "base_rate": 24.00
}
```

### POST /candidates/:id/hire
Принять на работу

**Request Body**:
```json
{
  "hired_date": "2023-11-01",
  "contract_end_date": "2024-11-01" // optional
}
```

### GET /candidates/:id/history
Получить историю действий с кандидатом

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "action": "Stworzono kandydata",
      "performed_by": "Anna Wiśniewska",
      "created_at": "2023-10-20T10:00:00Z"
    }
  ]
}
```

### POST /candidates/:id/documents
Загрузить документ кандидата

**Request Body** (multipart/form-data):
```
custom_name: "Certyfikat CCTV"
issue_date: "2023-01-15"
expires_at: "2025-01-15"
is_indefinite: false
bonus_value: 1.5
file: [binary]
```

### PUT /candidates/:id/personal-data
Обновить персональные данные

**Request Body**:
```json
{
  "pesel": "12345678901",
  "birth_date": "1990-01-15",
  "citizenship": "Polska",
  "document_type": "Dowód osobisty",
  "document_number": "ABC123456",
  "zip_code": "00-001",
  "city": "Warszawa",
  "street": "Marszałkowska",
  "house_number": "10",
  "apartment_number": "5",
  "bank_account": "PL12345678901234567890123456",
  "nip": "1234567890"
}
```

---

## 👷 Employees

### GET /employees
Получить список сотрудников

**Query Parameters**:
- `status` - active, trial, inactive
- `position` - должность
- `brigadir_id` - фильтр по бригадиру
- `search`

### GET /employees/:id
Получить данные сотрудника

### PUT /employees/:id/terminate
Уволить сотрудника

**Request Body**:
```json
{
  "termination_date": "2023-12-31",
  "termination_reason": "Przyczyny osobiste",
  "termination_initiator": "employee"
}
```

### PUT /employees/:id/restore
Восстановить уволенного сотрудника

### POST /employees/:id/notes
Добавить заметку о сотруднике

**Request Body**:
```json
{
  "category": "Postawa",
  "severity": "info",
  "text": "Bardzo zaangażowany w pracę"
}
```

### GET /employees/:id/notes
Получить заметки о сотруднике

### DELETE /employees/:id/notes/:noteId
Удалить заметку

### POST /employees/:id/badges
Присвоить значок сотруднику

**Request Body**:
```json
{
  "month": "2023-10",
  "type": "Szybkość",
  "description": "Rekordowe tempo pracy",
  "visible_to_employee": true
}
```

### GET /employees/:id/badges
Получить значки сотрудника

### POST /employees/:id/referrals
Пригласить друга (referral)

**Request Body**:
```json
{
  "first_name": "Piotr",
  "last_name": "Kowalski",
  "phone": "600-123-456",
  "target_position": "Elektryk"
}
```

### GET /employees/:id/referrals
Получить список приглашенных

### POST /employees/:id/referrals/:referralId/pay-bonus
Выплатить бонус за приглашение

### GET /employees/:id/salary
Получить детали зарплаты

**Response**:
```json
{
  "base_rate": 24.00,
  "contract_type": "uop",
  "contract_bonus": 0,
  "student_bonus": 0,
  "skills_bonus": 2.5,
  "monthly_bonuses": 4.0,
  "total_current": 30.50,
  "total_next_month": 32.00,
  "breakdown": {
    "active_skills": [
      {
        "name": "Czytanie projektu i montaż",
        "amount": 1.0,
        "status": "active"
      }
    ],
    "pending_skills": [
      {
        "name": "LAN – Sieci strukturalne",
        "amount": 1.5,
        "effective_from": "2023-11-01"
      }
    ],
    "bonuses": {
      "kontrola_pracownikow": true,
      "realizacja_planu": true,
      "brak_usterek": false,
      "brak_naduzyc_materialowych": true,
      "staz_pracy_years": 2
    }
  }
}
```

### PUT /employees/:id/monthly-bonuses
Обновить месячные бонусы

**Request Body**:
```json
{
  "month": "2023-10",
  "kontrola_pracownikow": true,
  "realizacja_planu": true,
  "brak_usterek": true,
  "brak_naduzyc_materialowych": true,
  "staz_pracy_years": 2
}
```

---

## 🎓 Skills

### GET /skills
Получить список навыков

**Query Parameters**:
- `category` - категория
- `is_active` - активные/неактивные
- `is_archived` - архивные

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "name_pl": "Czytanie projektu i montaż",
      "category": "PRACE MONTAŻOWE",
      "description_pl": "Umejętność czytania schematów",
      "verification_type": "theory_practice",
      "hourly_bonus": 1.0,
      "required_pass_rate": 80,
      "is_active": true,
      "employees_count": 15
    }
  ]
}
```

### POST /skills
Создать навык (только HR/Admin)

**Request Body**:
```json
{
  "name_pl": "Nowa umiejętność",
  "category": "INSTALACJE ELEKTRYCZNE",
  "description_pl": "Opis umiejętności",
  "verification_type": "theory_practice",
  "hourly_bonus": 1.5,
  "required_pass_rate": 80,
  "criteria": ["Kryterium 1", "Kryterium 2"]
}
```

### PUT /skills/:id
Обновить навык

### DELETE /skills/:id
Архивировать навык

### GET /skills/:id/practical-template
Получить шаблон практической проверки

**Response**:
```json
{
  "id": "uuid",
  "skill_id": "uuid",
  "title_pl": "Weryfikacja: Sieci LAN",
  "min_points_to_pass": 10,
  "items": [
    {
      "id": 1,
      "text_pl": "Prawidłowo zarobione 3 końcówki RJ-45",
      "required": true,
      "points": 3
    }
  ]
}
```

### PUT /skills/:id/practical-template
Обновить шаблон практической проверки

---

## 📝 User Skills (Навыки пользователей)

### GET /user-skills
Получить навыки пользователей

**Query Parameters**:
- `user_id` - ID пользователя
- `skill_id` - ID навыка
- `status` - статус

### POST /user-skills
Добавить навык пользователю

**Request Body**:
```json
{
  "user_id": "uuid",
  "skill_id": "uuid",
  "status": "pending"
}
```

### PUT /user-skills/:id/status
Изменить статус навыка

**Request Body**:
```json
{
  "status": "confirmed",
  "rejection_reason": "Brak poprawek" // optional
}
```

### POST /user-skills/:id/practice-check
Начать практическую проверку

### PUT /user-skills/:id/checklist-progress
Обновить прогресс чеклиста

**Request Body**:
```json
{
  "progress": {
    "1": {
      "checked": true,
      "image_url": "https://...",
      "checkedBy": "Tomasz Nowak",
      "checkedByRole": "brigadir",
      "checkedAt": "2023-10-20T10:00:00Z"
    }
  }
}
```

### POST /user-skills/:id/confirm
Подтвердить практическую проверку

**Request Body**:
```json
{
  "checker_id": "uuid"
}
```

### POST /user-skills/:id/attachments
Загрузить вложение

**Request Body** (multipart/form-data):
```
type: "photo"
file: [binary]
```

### POST /user-skills/:id/notes
Добавить заметку к проверке

**Request Body**:
```json
{
  "text": "Uwagi do weryfikacji"
}
```

### GET /user-skills/:id/logs
Получить логи верификации

### DELETE /user-skills/:id/reset
Сбросить прогресс навыка

**Query Parameters**:
- `mode` - theory, practice, both

---

## 📚 Tests

### GET /tests
Получить список тестов

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Test wiedzy: LAN – Sieci strukturalne",
      "skill_ids": ["uuid"],
      "time_limit_minutes": 15,
      "questions_count": 5,
      "is_active": true
    }
  ]
}
```

### GET /tests/:id
Получить тест с вопросами

**Response**:
```json
{
  "id": "uuid",
  "title": "Test wiedzy: LAN",
  "time_limit_minutes": 15,
  "questions": [
    {
      "id": "uuid",
      "text": "Jaka jest maksymalna długość segmentu kabla UTP?",
      "options": ["50m", "100m", "150m", "200m"],
      "image_url": null,
      "time_limit": null
    }
  ]
}
```

### POST /tests
Создать тест (только HR/Admin)

### PUT /tests/:id
Обновить тест

### DELETE /tests/:id
Архивировать тест

### POST /tests/:id/start
Начать тест

**Response**:
```json
{
  "attempt_id": "uuid",
  "started_at": "2023-10-20T10:00:00Z",
  "expires_at": "2023-10-20T10:15:00Z"
}
```

### POST /tests/:id/submit
Отправить ответы теста

**Request Body**:
```json
{
  "attempt_id": "uuid",
  "answers": {
    "question_id_1": [1],
    "question_id_2": [0, 2]
  },
  "duration_seconds": 540
}
```

**Response**:
```json
{
  "score": 85,
  "passed": true,
  "correct_answers": 4,
  "total_questions": 5
}
```

### GET /test-attempts/:id
Получить результаты попытки

### DELETE /test-attempts/:id
Сбросить попытку теста (только HR)

---

## 📖 Library

### GET /library
Получить ресурсы библиотеки

**Query Parameters**:
- `type` - pdf, video, link, mixed
- `category` - категория
- `skill_id` - связанный навык
- `search` - поиск

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Standard T568A/B",
      "description": "Standardy okablowania",
      "type": "pdf",
      "category": "TELETECHNICZNE",
      "skill_ids": ["uuid"],
      "url": "/docs/t568.pdf",
      "created_at": "2023-01-15T00:00:00Z"
    }
  ]
}
```

### POST /library
Добавить ресурс (только HR/Admin)

**Request Body**:
```json
{
  "title": "Nowy materiał",
  "description": "Opis materiału",
  "type": "pdf",
  "categories": ["TELETECHNICZNE"],
  "skill_ids": ["uuid"],
  "url": "/docs/file.pdf"
}
```

### PUT /library/:id
Обновить ресурс

### DELETE /library/:id
Архивировать ресурс

---

## 📊 Quality & Performance

### GET /quality-incidents
Получить инциденты качества

**Query Parameters**:
- `user_id` - фильтр по пользователю
- `skill_id` - фильтр по навыку
- `from_date` - с даты
- `to_date` - до даты

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "skill_id": "uuid",
      "incident_number": 1,
      "description": "Błąd w montażu",
      "reported_by": "Tomasz Nowak",
      "image_url": "https://...",
      "created_at": "2023-10-20T10:00:00Z"
    }
  ]
}
```

### POST /quality-incidents
Создать инцидент качества

**Request Body**:
```json
{
  "user_id": "uuid",
  "skill_id": "uuid",
  "description": "Opis incydentu",
  "image_url": "https://..."
}
```

### GET /positions
Получить список должностей

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Elektryk",
      "responsibilities": ["Prefabrykacja", "Pomiary"],
      "required_skill_ids": ["uuid"],
      "order": 3
    }
  ]
}
```

### POST /positions
Создать должность

### PUT /positions/:id
Обновить должность

### DELETE /positions/:id
Удалить должность

### POST /positions/reorder
Изменить порядок должностей

**Request Body**:
```json
{
  "positions": [
    {"id": "uuid", "order": 1},
    {"id": "uuid", "order": 2}
  ]
}
```

---

## 🔔 Notifications

### GET /notifications
Получить уведомления пользователя

**Query Parameters**:
- `is_read` - прочитанные/непрочитанные

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Zaliczony Test",
      "message": "Jan Kowalski zaliczył test: LAN",
      "is_read": false,
      "link": "/hr/employees",
      "created_at": "2023-10-20T10:00:00Z"
    }
  ],
  "unread_count": 5
}
```

### PUT /notifications/:id/read
Отметить как прочитанное

### PUT /notifications/read-all
Отметить все как прочитанные

### GET /notification-settings
Получить настройки уведомлений

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "setting_type": "test_passed",
      "label": "Zaliczony test",
      "system_enabled": true,
      "email_enabled": false,
      "sms_enabled": false
    }
  ]
}
```

### PUT /notification-settings
Обновить настройки уведомлений

**Request Body**:
```json
{
  "settings": [
    {
      "setting_type": "test_passed",
      "system_enabled": true,
      "email_enabled": true,
      "sms_enabled": false
    }
  ]
}
```

### GET /notification-templates
Получить шаблоны уведомлений (только Admin)

### PUT /notification-templates/:id
Обновить шаблон уведомления

---

## ⚙️ System Configuration

### GET /config
Получить конфигурацию системы

**Response**:
```json
{
  "base_rate": 24.00,
  "contract_bonuses": {
    "uop": 0,
    "uz": 1,
    "b2b": 7
  },
  "student_bonus": 3.00,
  "termination_reasons": ["Przyczyny osobiste", "..."],
  "notification_providers": {
    "email": {"enabled": true},
    "sms": {"enabled": false}
  }
}
```

### PUT /config
Обновить конфигурацию (только Admin)

### GET /bonus-document-types
Получить типы документов с бонусами

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "type_id": "sep_e",
      "label": "SEP E z pomiarami",
      "bonus": 0.5,
      "is_active": true
    }
  ]
}
```

### POST /bonus-document-types
Добавить тип документа

### PUT /bonus-document-types/:id
Обновить тип документа

---

## 📈 Analytics & Reports

### GET /analytics/dashboard
Получить данные для дашборда

**Query Parameters**:
- `role` - роль пользователя для персонализации

### GET /analytics/candidates-funnel
Получить воронку кандидатов

**Response**:
```json
{
  "invited": 50,
  "started": 40,
  "tests_completed": 30,
  "interested": 25,
  "hired": 15
}
```

### GET /analytics/skills-statistics
Получить статистику по навыкам

### GET /analytics/salary-report
Получить отчет по зарплатам

**Query Parameters**:
- `month` - месяц (YYYY-MM)
- `brigadir_id` - фильтр по бригадиру

---

## 🔄 Общие параметры ответа

### Success Response
```json
{
  "success": true,
  "data": {...}
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email already exists",
    "details": {
      "field": "email"
    }
  }
}
```

### HTTP Status Codes
- `200` - OK
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `500` - Internal Server Error

---

## 📝 Примечания

1. Все даты в формате ISO 8601: `2023-10-20T10:00:00Z`
2. UUID используется для всех ID
3. Pagination: используйте параметры `page` и `limit`
4. Sorting: параметр `sort` (например, `sort=created_at:desc`)
5. Все endpoints требуют аутентификации (кроме `/auth/login` и `/auth/register`)
6. Загрузка файлов: используйте `multipart/form-data`
7. Максимальный размер файла: 10MB

---

## 🚀 Следующие шаги

1. Создать backend (Node.js/Express или Python/FastAPI)
2. Подключить PostgreSQL
3. Реализовать authentication (JWT)
4. Создать API endpoints согласно спецификации
5. Добавить валидацию данных
6. Настроить CORS
7. Добавить rate limiting
8. Настроить загрузку файлов (S3/local storage)
9. Добавить логирование
10. Написать тесты
