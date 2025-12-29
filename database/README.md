# MaxMaster Skills Platform - База данных

## 📋 Содержание

1. [Обзор](#обзор)
2. [Архитектура базы данных](#архитектура-базы-данных)
3. [Установка и настройка](#установка-и-настройка)
4. [Структура таблиц](#структура-таблиц)
5. [Связи между таблицами](#связи-между-таблицами)
6. [Индексы и производительность](#индексы-и-производительность)
7. [Миграция данных](#миграция-данных)
8. [Backup и восстановление](#backup-и-восстановление)

---

## 🎯 Обзор

База данных MaxMaster Skills Platform предназначена для управления:
- Пользователями (кандидаты, сотрудники, HR, администраторы)
- Навыками и их верификацией
- Тестами и оценками
- Системой вознаграждений и зарплат
- Библиотекой обучающих материалов
- Уведомлениями и историей действий

**СУБД**: PostgreSQL 12+ (рекомендуется 14+)

**Основные особенности**:
- Полная нормализация данных
- Использование ENUM типов для категорий
- JSONB для гибких структур данных
- Soft delete (мягкое удаление)
- Автоматическое обновление timestamps
- Полнотекстовый поиск
- Views для часто используемых запросов

---

## 🏗️ Архитектура базы данных

### Основные модули

```
┌─────────────────────────────────────────────────────────┐
│                    USERS MODULE                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐         │
│  │  users   │  │positions │  │salary_history│         │
│  └──────────┘  └──────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   SKILLS MODULE                         │
│  ┌──────────┐  ┌────────────┐  ┌──────────────────┐   │
│  │  skills  │──│user_skills │──│ verification_*   │   │
│  └──────────┘  └────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   TESTING MODULE                        │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐        │
│  │  tests   │──│ questions │  │test_attempts │        │
│  └──────────┘  └───────────┘  └──────────────┘        │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                 SUPPORTING MODULES                      │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────┐      │
│  │  library    │  │notifications │  │  config  │      │
│  │  resources  │  │   & notes    │  │          │      │
│  └─────────────┘  └──────────────┘  └──────────┘      │
└─────────────────────────────────────────────────────────┘
```

### Диаграмма связей (ER Diagram)

```
users ──┬── user_skills ──── skills
        │                      │
        ├── test_attempts ──── tests ──── questions
        │
        ├── candidate_history
        ├── quality_incidents
        ├── employee_notes
        ├── employee_badges
        ├── salary_history
        ├── monthly_bonuses
        └── notifications

skills ──── practical_check_templates
         └── library_resources
```

---

## 🚀 Установка и настройка

### Предварительные требования

- PostgreSQL 12+ установлен и запущен
- psql клиент
- Права на создание базы данных

### Шаг 1: Создание базы данных

```bash
# Создайте базу данных
sudo -u postgres psql

postgres=# CREATE DATABASE maxmaster_skills;
postgres=# CREATE USER maxmaster WITH PASSWORD 'your_secure_password';
postgres=# GRANT ALL PRIVILEGES ON DATABASE maxmaster_skills TO maxmaster;
postgres=# \q
```

### Шаг 2: Применение схемы

```bash
# Перейдите в директорию database
cd /path/to/MaxMaster-Skill_Platform/database

# Примените схему
psql -U maxmaster -d maxmaster_skills -f schema.sql

# Загрузите начальные данные
psql -U maxmaster -d maxmaster_skills -f seed_data.sql
```

### Шаг 3: Проверка установки

```bash
# Подключитесь к базе данных
psql -U maxmaster -d maxmaster_skills

# Проверьте таблицы
maxmaster_skills=# \dt

# Проверьте данные
maxmaster_skills=# SELECT COUNT(*) FROM users;
maxmaster_skills=# SELECT COUNT(*) FROM skills;
```

### Переменные окружения

Создайте файл `.env` в корне проекта:

```env
# Database Configuration
DATABASE_URL=postgresql://maxmaster:your_secure_password@localhost:5432/maxmaster_skills
DB_HOST=localhost
DB_PORT=5432
DB_NAME=maxmaster_skills
DB_USER=maxmaster
DB_PASSWORD=your_secure_password
DB_SSL=false

# Application
NODE_ENV=development
PORT=3000

# JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=7d

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# Email (optional)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@maxmaster.pl

# SMS (optional)
SMS_API_KEY=
SMS_SENDER_ID=MaxMaster
```

---

## 📊 Структура таблиц

### Основные таблицы

#### 1. **users** - Пользователи системы
```sql
- id (UUID, PK)
- email (VARCHAR, UNIQUE)
- password_hash (VARCHAR)
- first_name, last_name (VARCHAR)
- role (ENUM: admin, hr, brigadir, employee, candidate, coordinator)
- status (ENUM: invited, started, active, trial, inactive, etc.)
- base_rate (DECIMAL)
- contract_type (ENUM: uop, uz, b2b)
- hired_date (TIMESTAMP)
- assigned_brigadir_id (UUID, FK → users)
- referred_by_id (UUID, FK → users)
+ 20+ дополнительных полей для HR данных
```

**Индексы**:
- `idx_users_email` - поиск по email
- `idx_users_role` - фильтр по роли
- `idx_users_status` - фильтр по статусу
- `idx_users_name_search` - полнотекстовый поиск

#### 2. **skills** - Навыки
```sql
- id (UUID, PK)
- name_pl (VARCHAR)
- category (ENUM: skill_category)
- description_pl (TEXT)
- verification_type (ENUM: theory_only, theory_practice, document)
- hourly_bonus (DECIMAL)
- required_pass_rate (INTEGER)
- is_active (BOOLEAN)
- is_archived (BOOLEAN)
```

#### 3. **user_skills** - Навыки пользователей
```sql
- id (UUID, PK)
- user_id (UUID, FK → users)
- skill_id (UUID, FK → skills)
- status (ENUM: locked, pending, theory_passed, confirmed, failed)
- theory_score (INTEGER)
- practice_checked_by (UUID, FK → users)
- practice_date (TIMESTAMP)
- confirmed_at (TIMESTAMP)
- checklist_progress (JSONB)
- document_url, document_urls (VARCHAR, TEXT[])
- effective_from (DATE) - дата вступления в силу повышения
```

**Важно**: Связь many-to-many между users и skills

#### 4. **tests** - Тесты
```sql
- id (UUID, PK)
- skill_ids (UUID[]) - массив связанных навыков
- title (VARCHAR)
- time_limit_minutes (INTEGER)
- is_active (BOOLEAN)
```

#### 5. **questions** - Вопросы в тестах
```sql
- id (UUID, PK)
- test_id (UUID, FK → tests)
- text (TEXT)
- options (TEXT[]) - массив вариантов ответа
- correct_option_indices (INTEGER[]) - правильные индексы
- grading_strategy (ENUM)
- question_order (INTEGER)
```

#### 6. **test_attempts** - Попытки прохождения тестов
```sql
- id (UUID, PK)
- user_id (UUID, FK → users)
- test_id (UUID, FK → tests)
- score (INTEGER)
- passed (BOOLEAN)
- duration_seconds (INTEGER)
- answers (JSONB) - сохраненные ответы
- completed_at (TIMESTAMP)
```

### Вспомогательные таблицы

#### 7. **positions** - Должности
```sql
- id (UUID, PK)
- name (VARCHAR)
- responsibilities (TEXT[])
- required_skill_ids (UUID[])
- brigadier_bonuses (JSONB)
- order (INTEGER)
```

#### 8. **quality_incidents** - Инциденты качества
```sql
- id (UUID, PK)
- user_id (UUID, FK → users)
- skill_id (UUID, FK → skills)
- incident_number (INTEGER)
- description (TEXT)
- reported_by (VARCHAR)
- image_url (VARCHAR)
```

#### 9. **employee_notes** - Заметки о сотрудниках
```sql
- id (UUID, PK)
- employee_id (UUID, FK → users)
- author_id (UUID, FK → users)
- category (ENUM: Ogólna, Postawa, Jakość, etc.)
- severity (ENUM: info, warning, critical)
- text (TEXT)
```

#### 10. **employee_badges** - Награды сотрудников
```sql
- id (UUID, PK)
- employee_id (UUID, FK → users)
- author_id (UUID, FK → users)
- month (VARCHAR) - YYYY-MM
- type (ENUM: Szybkość, Jakość, Pomocność, etc.)
- description (TEXT)
- visible_to_employee (BOOLEAN)
```

#### 11. **salary_history** - История зарплат
```sql
- id (UUID, PK)
- user_id (UUID, FK → users)
- change_date (TIMESTAMP)
- reason (TEXT)
- old_rate, new_rate (DECIMAL)
- changed_by_id (UUID, FK → users)
```

#### 12. **monthly_bonuses** - Месячные бонусы
```sql
- id (UUID, PK)
- user_id (UUID, FK → users)
- month (VARCHAR) - YYYY-MM
- kontrola_pracownikow (BOOLEAN)
- realizacja_planu (BOOLEAN)
- brak_usterek (BOOLEAN)
- brak_naduzyc_materialowych (BOOLEAN)
- staz_pracy_years (INTEGER)
```

#### 13. **library_resources** - Библиотека материалов
```sql
- id (UUID, PK)
- title (VARCHAR)
- type (ENUM: pdf, video, link, mixed)
- categories (skill_category[])
- skill_ids (UUID[])
- url (VARCHAR)
- is_archived (BOOLEAN)
```

#### 14. **notifications** - Уведомления
```sql
- id (UUID, PK)
- user_id (UUID, FK → users)
- title (VARCHAR)
- message (TEXT)
- is_read (BOOLEAN)
- link (VARCHAR)
```

---

## 🔗 Связи между таблицами

### One-to-Many (1:N)

1. **users → user_skills**: Один пользователь - много навыков
2. **skills → user_skills**: Один навык - много пользователей
3. **users → test_attempts**: Один пользователь - много попыток
4. **tests → questions**: Один тест - много вопросов
5. **users → salary_history**: Один пользователь - много записей истории
6. **users → employee_notes**: Один сотрудник - много заметок
7. **users → quality_incidents**: Один пользователь - много инцидентов

### Self-Referencing

1. **users.assigned_brigadir_id → users.id**: Сотрудник привязан к бригадиру
2. **users.referred_by_id → users.id**: Система рефералов

### Many-to-Many через промежуточные таблицы

1. **users ↔ skills** через **user_skills**
2. **tests ↔ skills** через массив **skill_ids**
3. **library_resources ↔ skills** через массив **skill_ids**

---

## ⚡ Индексы и производительность

### Основные индексы

```sql
-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_role_status ON users(role, status);

-- User Skills
CREATE INDEX idx_user_skills_user ON user_skills(user_id);
CREATE INDEX idx_user_skills_skill ON user_skills(skill_id);
CREATE INDEX idx_user_skills_user_status ON user_skills(user_id, status);

-- Test Attempts
CREATE INDEX idx_test_attempts_user ON test_attempts(user_id);
CREATE INDEX idx_test_attempts_completed ON test_attempts(completed_at);

-- Full-text search
CREATE INDEX idx_users_name_search ON users USING gin(to_tsvector('simple', first_name || ' ' || last_name));
CREATE INDEX idx_skills_name_search ON skills USING gin(to_tsvector('simple', name_pl));
```

### Views для оптимизации

```sql
-- Активные сотрудники с навыками
CREATE VIEW v_active_employees AS ...

-- Кандидаты с результатами тестов
CREATE VIEW v_candidates_summary AS ...

-- Статистика по навыкам
CREATE VIEW v_skills_statistics AS ...
```

### Рекомендации по производительности

1. **Используйте prepared statements** для защиты от SQL injection
2. **Используйте connection pooling** (pg-pool в Node.js)
3. **Кэшируйте частые запросы** (Redis)
4. **Используйте EXPLAIN ANALYZE** для анализа медленных запросов
5. **Регулярно обновляйте статистику**: `ANALYZE;`

---

## 🔄 Миграция данных

### Миграция из текущего состояния (constants.ts)

1. **Экспорт данных из constants.ts**:

```typescript
// Скрипт для экспорта в SQL формат
import { USERS, SKILLS, TESTS } from './constants';

// Генерация INSERT statements
```

2. **Применение миграции**:

```bash
# Создайте миграцию
psql -U maxmaster -d maxmaster_skills -f migration_from_constants.sql
```

### Инструменты миграции

Рекомендуется использовать:
- **TypeORM** - для Node.js/TypeScript
- **Prisma** - современная ORM
- **Knex.js** - query builder с миграциями
- **node-pg-migrate** - специализированный инструмент для PostgreSQL

Пример с node-pg-migrate:

```bash
npm install node-pg-migrate

# Создание миграции
npm run migrate create add-new-field

# Применение миграций
npm run migrate up
```

---

## 💾 Backup и восстановление

### Создание backup

```bash
# Полный backup
pg_dump -U maxmaster maxmaster_skills > backup_$(date +%Y%m%d).sql

# Только схема
pg_dump -U maxmaster --schema-only maxmaster_skills > schema_backup.sql

# Только данные
pg_dump -U maxmaster --data-only maxmaster_skills > data_backup.sql

# Backup в custom формате (сжатый)
pg_dump -U maxmaster -Fc maxmaster_skills > backup.dump
```

### Восстановление

```bash
# Из SQL файла
psql -U maxmaster maxmaster_skills < backup_20231020.sql

# Из custom формата
pg_restore -U maxmaster -d maxmaster_skills backup.dump

# Восстановление конкретной таблицы
pg_restore -U maxmaster -d maxmaster_skills -t users backup.dump
```

### Автоматический backup (cron)

```bash
# Добавьте в crontab
0 2 * * * pg_dump -U maxmaster maxmaster_skills > /backups/db_$(date +\%Y\%m\%d).sql

# Удаление старых backups (старше 30 дней)
0 3 * * * find /backups -name "db_*.sql" -mtime +30 -delete
```

---

## 🧪 Тестирование

### Проверка целостности данных

```sql
-- Проверка сирот (orphaned records)
SELECT us.id
FROM user_skills us
LEFT JOIN users u ON us.user_id = u.id
WHERE u.id IS NULL;

-- Проверка дубликатов
SELECT email, COUNT(*)
FROM users
GROUP BY email
HAVING COUNT(*) > 1;

-- Проверка валидности дат
SELECT * FROM users
WHERE trial_end_date < hired_date;
```

### Тестовые запросы

```sql
-- Получить сотрудников с навыками
SELECT u.first_name, u.last_name, s.name_pl, us.status
FROM users u
JOIN user_skills us ON u.id = us.user_id
JOIN skills s ON us.skill_id = s.id
WHERE u.status = 'active';

-- Получить результаты тестов кандидата
SELECT u.first_name, u.last_name, t.title, ta.score, ta.passed
FROM test_attempts ta
JOIN users u ON ta.user_id = u.id
JOIN tests t ON ta.test_id = t.id
WHERE u.role = 'candidate';
```

---

## 📚 Дополнительные ресурсы

### Документация

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [pg module for Node.js](https://node-postgres.com/)
- [TypeORM](https://typeorm.io/)
- [Prisma](https://www.prisma.io/)

### Полезные команды psql

```sql
\dt              -- Список таблиц
\d table_name    -- Описание таблицы
\di              -- Список индексов
\dv              -- Список views
\df              -- Список функций
\l               -- Список баз данных
\du              -- Список пользователей
\q               -- Выход
```

---

## 🔐 Безопасность

### Рекомендации

1. **Пароли**: Всегда используйте bcrypt/argon2 для хеширования
2. **SQL Injection**: Используйте prepared statements
3. **Права доступа**: Минимальные необходимые права
4. **Шифрование**: SSL/TLS для подключений
5. **Логирование**: Включите pgaudit для аудита
6. **Резервные копии**: Регулярные и зашифрованные

### Настройка SSL

```bash
# В postgresql.conf
ssl = on
ssl_cert_file = 'server.crt'
ssl_key_file = 'server.key'

# В .env
DB_SSL=true
```

---

## 📞 Поддержка

При возникновении проблем:

1. Проверьте логи PostgreSQL: `/var/log/postgresql/`
2. Проверьте подключение: `psql -U maxmaster -h localhost`
3. Проверьте версию: `SELECT version();`
4. Проверьте активные подключения: `SELECT * FROM pg_stat_activity;`

---

**Версия документации**: 1.0
**Дата**: 2023
**Автор**: MaxMaster Development Team
