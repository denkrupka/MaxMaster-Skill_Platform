# Moniti → MaxMaster: Техническое сравнение и план интеграции

## СОДЕРЖАНИЕ

1. [Сравнение ролей](#1-сравнение-ролей)
2. [Матрица готовности](#2-матрица-готовности-функционала)
3. [Раздел A: Настройки компании (рабочее время)](#раздел-a-настройки-компании--конфигурация-рабочего-времени)
4. [Раздел B: Объекты с иерархией и геозонами](#раздел-b-объекты-с-иерархией-и-геозонами)
5. [МОДУЛЬ 1: Учёт рабочего времени (Time & Attendance)](#модуль-1-учёт-рабочего-времени-time--attendance)
6. [Раздел D: Дашборд "Команда сейчас"](#раздел-d-дашборд-команда-сейчас-team-now)
7. [МОДУЛЬ 2: Отпуска и отсутствия (Time Off)](#модуль-2-отпуска-и-отсутствия-time-off)
8. [МОДУЛЬ 3: Графики работ (Work Schedule)](#модуль-3-графики-работ-work-schedule)
9. [МОДУЛЬ 4: Проекты (Tasks & Projects)](#модуль-4-проекты-tasks--projects)
10. [МОДУЛЬ 5: Отчёты и Payroll](#модуль-5-отчёты-и-payroll)
11. [Раздел I: Праздничный календарь](#раздел-i-праздничный-календарь)
12. [Раздел J: Центр уведомлений (Notification Hub)](#раздел-j-центр-уведомлений-notification-hub)

> **Определение "Модуль":** Модуль — это платный раздел портала с доступом по подписке. В системе MaxMaster 5 модулей:
> 1. Учёт рабочего времени
> 2. Отпуска
> 3. Графики работ
> 4. Проекты
> 5. Отчёты
>
> Остальные разделы (Настройки компании, Объекты, Дашборд "Команда сейчас", Праздничный календарь, Центр уведомлений) — это дополнительные функции портала, а не отдельные модули.

---

## 1. СРАВНЕНИЕ РОЛЕЙ

### Moniti → MaxMaster маппинг ролей

| Moniti роль | MaxMaster роль | Комментарий |
|---|---|---|
| **Admin** (Owner) | **COMPANY_ADMIN** | Полный доступ к компании. Наш COMPANY_ADMIN = их Admin |
| **Manager** | **HR** / **COORDINATOR** | Moniti Manager — роль с гранулярными правами. У нас HR управляет людьми, COORDINATOR — операционная координация. Новые Moniti-функции распределяются между ними |
| **Worker** | **EMPLOYEE** | Рядовой сотрудник. Доступ к своим данным |

### Распределение новых функций по нашим ролям

| Новый функционал (из Moniti) | COMPANY_ADMIN | HR | COORDINATOR | BRIGADIR | EMPLOYEE |
|---|---|---|---|---|---|
| Настройки рабочего времени компании | ✅ полный | ✅ | ❌ | ❌ | ❌ |
| Управление объектами с геозонами | ✅ полный | ✅ чтение | ✅ чтение | ❌ | ❌ |
| Учёт времени — просмотр всех | ✅ | ✅ свой объект | ✅ свой объект | ✅ своя бригада | ❌ |
| Учёт времени — отметка (clock-in/out) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Учёт времени — ручная коррекция | ✅ | ✅ | ✅ | ❌ | ❌ |
| Дашборд "Команда сейчас" | ✅ все | ✅ все | ✅ свой объект | ✅ своя бригада | ❌ |
| Отпуска — подача заявки | ✅ | ✅ | ✅ | ✅ | ✅ |
| Отпуска — одобрение/отклонение | ✅ | ✅ | ✅ | ✅ | ❌ |
| Отпуска — настройка типов и лимитов | ✅ | ✅ | ❌ | ❌ | ❌ |
| Рабочие графики — планирование | ✅ | ✅ | ✅ | ❌ | ❌ |
| Рабочие графики — просмотр своего | ✅ | ✅ | ✅ | ✅ | ✅ |
| Задачи и проекты — управление | ✅ | ✅ | ✅ | ❌ | ❌ |
| Задачи — выполнение своих | ✅ | ✅ | ✅ | ✅ | ✅ |
| Отчёты по времени и зарплате | ✅ | ✅ | ✅ | ✅ | ❌ |
| Праздничный календарь | ✅ настройка | ✅ настройка | ✅ чтение | ✅ чтение | ✅ чтение |
| Заявки на изменение рабочего дня | ✅ одобрение | ✅ одобрение | ✅ одобрение | ✅ одобрение + подача | ✅ подача |

---

## 2. МАТРИЦА ГОТОВНОСТИ ФУНКЦИОНАЛА

| # | Функционал Moniti | Статус у нас | Что нужно |
|---|---|---|---|
| 1 | Компания: timezone, currency, рабочие часы, округление | ⚠️ Частично (есть company.settings JSON) | Добавить структурированные поля |
| 2 | Иерархия объектов с геозонами | ❌ Нет | Новый раздел |
| 3 | Учёт рабочего времени (clock-in/out) | ❌ Нет | Новый модуль |
| 4 | Дашборд "Команда сейчас" (real-time) | ❌ Нет | Новый раздел |
| 5 | Заявки на изменение рабочего дня | ❌ Нет | Новый модуль |
| 6 | Отпуска и отсутствия | ❌ Нет | Новый модуль |
| 7 | Рабочие графики / Сменное планирование | ❌ Нет | Новый модуль |
| 8 | Задачи и проекты | ❌ Нет | Новый модуль |
| 9 | Расширенные отчёты (время + зарплата) | ⚠️ Частично (есть salary calc) | Расширить |
| 10 | Праздничный календарь | ❌ Нет | Новый раздел |
| 11 | Центр уведомлений (hub) | ⚠️ Частично (есть notification system) | Расширить |
| 12 | GPS-трекинг | ❌ Нет | **НЕ ВКЛЮЧАЕМ** (пока) |
| 13 | Киоск/Терминал | ❌ Нет | **НЕ ВКЛЮЧАЕМ** (пока) |
| 14 | Фото-подтверждение / Face detection | ❌ Нет | **НЕ ВКЛЮЧАЕМ** (пока) |
| 15 | AI-ассистент | ❌ Нет | **НЕ ВКЛЮЧАЕМ** (пока) |
| 16 | Аутентификация (email/пароль) | ✅ Готово | — |
| 17 | Управление сотрудниками (CRUD) | ✅ Готово | — |
| 18 | Должности (JobPositions) | ✅ Готово | — |
| 19 | Роли и права | ✅ Готово | — |
| 20 | Подписка и биллинг | ✅ Готово | — |
| 21 | Реферальная программа | ✅ Готово | — |
| 22 | Email/SMS уведомления | ✅ Готово | — |

---

## 3. ПОРЯДОК ВНЕДРЕНИЯ

```
Раздел A: Настройки компании (рабочее время)       ← Фундамент
    ↓
Раздел B: Объекты с иерархией и геозонами           ← Фундамент
    ↓
МОДУЛЬ 1: Учёт рабочего времени (Time&Attendance)  ← Ядро
    ↓
Раздел D: Дашборд "Команда сейчас" (Team Now)      ← Зависит от Модуля 1
    ↓
МОДУЛЬ 2: Отпуска и отсутствия (Time Off)           ← Независимый
    ↓
МОДУЛЬ 3: Графики работ (Work Schedule)             ← Зависит от Модуля 1, 2
    ↓
МОДУЛЬ 4: Проекты (Tasks & Projects)                ← Независимый
    ↓
МОДУЛЬ 5: Отчёты и Payroll                          ← Зависит от Модуля 1, 2, 3
    ↓
Раздел I: Праздничный календарь                      ← Независимый
    ↓
Раздел J: Центр уведомлений (Notification Hub)      ← Расширение
```

---

## Раздел A: Настройки компании — Конфигурация рабочего времени

### A.1 Описание

Расширяет существующую таблицу `companies` структурированными настройками рабочего времени. Moniti хранит: timezone, currency, рабочие часы по дням недели, округление времени прихода/ухода, ночные смены, максимальное рабочее время, допустимое опоздание. У нас есть поле `settings JSONB` в таблице `companies` — нужно добавить выделенные колонки и UI для управления.

### A.2 Зависимости

- Существующая таблица `companies` (есть)
- Роль COMPANY_ADMIN (есть)
- Роль HR (есть)
- Страница настроек компании `/company/settings` (есть)

### A.3 База данных — Миграция

```sql
-- Миграция: add_working_time_settings_to_companies

-- 1. Добавить новые колонки в таблицу companies
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Warsaw',
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'PLN',
  ADD COLUMN IF NOT EXISTS allow_weekend_access BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS night_time_from TEXT DEFAULT '21:00',
  ADD COLUMN IF NOT EXISTS night_time_to TEXT DEFAULT '05:00',
  ADD COLUMN IF NOT EXISTS max_working_time_minutes INTEGER DEFAULT 720,
  ADD COLUMN IF NOT EXISTS delay_tolerance_minutes INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS working_hours JSONB DEFAULT '{
    "monday":    {"enabled": true,  "start_time": "08:00", "end_time": "16:00"},
    "tuesday":   {"enabled": true,  "start_time": "08:00", "end_time": "16:00"},
    "wednesday": {"enabled": true,  "start_time": "08:00", "end_time": "16:00"},
    "thursday":  {"enabled": true,  "start_time": "08:00", "end_time": "16:00"},
    "friday":    {"enabled": true,  "start_time": "08:00", "end_time": "16:00"},
    "saturday":  {"enabled": false, "start_time": null,    "end_time": null},
    "sunday":    {"enabled": false, "start_time": null,    "end_time": null}
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS start_round_time JSONB DEFAULT '{"precision": 0, "method": "none"}'::jsonb,
  ADD COLUMN IF NOT EXISTS finish_round_time JSONB DEFAULT '{"precision": 0, "method": "none"}'::jsonb;

-- 2. Комментарии к колонкам
COMMENT ON COLUMN companies.timezone IS 'IANA timezone, напр. Europe/Warsaw';
COMMENT ON COLUMN companies.currency IS 'ISO 4217 код валюты, напр. PLN';
COMMENT ON COLUMN companies.allow_weekend_access IS 'Разрешена ли работа в выходные';
COMMENT ON COLUMN companies.night_time_from IS 'Начало ночной смены (HH:MM)';
COMMENT ON COLUMN companies.night_time_to IS 'Конец ночной смены (HH:MM)';
COMMENT ON COLUMN companies.max_working_time_minutes IS 'Макс. рабочее время за день (минуты). По умолчанию 720 = 12 часов';
COMMENT ON COLUMN companies.delay_tolerance_minutes IS 'Допустимое опоздание (минуты). NULL = без допуска';
COMMENT ON COLUMN companies.working_hours IS 'Рабочие часы по дням недели: {day: {enabled, start_time, end_time}}';
COMMENT ON COLUMN companies.start_round_time IS 'Округление времени прихода: {precision: минуты, method: ceil|floor|none}';
COMMENT ON COLUMN companies.finish_round_time IS 'Округление времени ухода: {precision: минуты, method: ceil|floor|none}';

-- 3. RLS политики — только COMPANY_ADMIN и HR своей компании могут редактировать
-- (существующие RLS на companies уже обеспечивают изоляцию по company_id)
```

### A.4 TypeScript типы

Добавить в файл `types.ts`:

```typescript
// === Раздел A: Настройки рабочего времени ===

export interface WorkingHoursDay {
  enabled: boolean;
  start_time: string | null; // "HH:MM"
  end_time: string | null;   // "HH:MM"
}

export interface WorkingHours {
  monday: WorkingHoursDay;
  tuesday: WorkingHoursDay;
  wednesday: WorkingHoursDay;
  thursday: WorkingHoursDay;
  friday: WorkingHoursDay;
  saturday: WorkingHoursDay;
  sunday: WorkingHoursDay;
}

export interface RoundTime {
  precision: number;       // Интервал округления в минутах (0, 5, 10, 15, 30)
  method: 'ceil' | 'floor' | 'none'; // ceil=вверх, floor=вниз, none=без округления
}
```

Расширить существующий интерфейс `Company` в `types.ts`:

```typescript
// Добавить в существующий интерфейс Company:
  timezone?: string;
  currency?: string;
  allow_weekend_access?: boolean;
  night_time_from?: string;
  night_time_to?: string;
  max_working_time_minutes?: number;
  delay_tolerance_minutes?: number | null;
  working_hours?: WorkingHours;
  start_round_time?: RoundTime;
  finish_round_time?: RoundTime;
```

### A.5 UI — Страница настроек

Расширить существующую страницу `/company/settings` (файл `pages/company/SettingsPage.tsx`). Добавить новую вкладку или секцию **"Рабочее время"** со следующими элементами:

**Секция "Основные настройки":**
- Поле `timezone` — выпадающий список с IANA таймзонами (Europe/Warsaw по умолчанию)
- Поле `currency` — выпадающий список (PLN, EUR, USD, UAH)
- Переключатель `allow_weekend_access` — "Разрешить работу в выходные"
- Поле `max_working_time_minutes` — числовое поле, подпись "Максимальное рабочее время за день (минуты)"
- Поле `delay_tolerance_minutes` — числовое поле, подпись "Допустимое опоздание (минуты)", может быть пустым

**Секция "Ночная смена":**
- Поле `night_time_from` — time picker, подпись "Начало ночной смены"
- Поле `night_time_to` — time picker, подпись "Конец ночной смены"

**Секция "Рабочие часы по дням недели":**
- Таблица 7 строк (Пн-Вс). Каждая строка:
  - Название дня
  - Переключатель `enabled` (рабочий/нерабочий)
  - Time picker `start_time` (активен если enabled=true)
  - Time picker `end_time` (активен если enabled=true)

**Секция "Округление времени":**
- Блок "Приход" (`start_round_time`):
  - Выпадающий список `precision`: 0 мин (без округления), 5 мин, 10 мин, 15 мин, 30 мин
  - Выпадающий список `method`: "Вверх (ceil)" / "Вниз (floor)" — показывать только если precision > 0
  - Пояснение: "Пример: precision=15, method=ceil → приход в 8:03 регистрируется как 8:15"
- Блок "Уход" (`finish_round_time`):
  - Аналогично приходу

**Кнопка** "Сохранить настройки" — PATCH запрос к Supabase `companies` по `id` компании.

### A.6 Логика сохранения

```typescript
// В SettingsPage.tsx добавить функцию:
const saveWorkingTimeSettings = async () => {
  const { error } = await supabase
    .from('companies')
    .update({
      timezone,
      currency,
      allow_weekend_access: allowWeekendAccess,
      night_time_from: nightTimeFrom,
      night_time_to: nightTimeTo,
      max_working_time_minutes: maxWorkingTimeMinutes,
      delay_tolerance_minutes: delayToleranceMinutes || null,
      working_hours: workingHours,
      start_round_time: startRoundTime,
      finish_round_time: finishRoundTime,
    })
    .eq('id', companyId);
  // Обработка ошибки, показ toast
};
```

### A.7 Права доступа

- **COMPANY_ADMIN** — полный доступ на чтение и редактирование
- **HR** — полный доступ на чтение и редактирование
- Все остальные роли — **нет доступа** к этой секции настроек (не показывать вкладку)

### A.8 Критерии готовности

- [ ] Миграция выполнена, колонки добавлены в `companies`
- [ ] TypeScript типы добавлены в `types.ts`
- [ ] Интерфейс Company расширен новыми полями
- [ ] На странице настроек компании появилась секция "Рабочее время"
- [ ] Все поля отображаются, редактируются, сохраняются
- [ ] Только COMPANY_ADMIN и HR видят и могут редактировать настройки
- [ ] Дефолтные значения корректно применяются для новых компаний

---

## Раздел B: Объекты с иерархией и геозонами

### B.1 Описание

Создать полноценную систему объектов с поддержкой иерархии (вложенности), привязкой сотрудников к объектам, и опциональными геозонами (GPS-координаты + радиус). В Moniti объекты — ключевая структурная единица: сотрудники назначены в объекты, менеджеры управляют конкретными объектами, объекты имеют адреса и геозоны для строительных объектов.

### B.2 Зависимости

- Таблица `companies` (есть)
- Таблица `users` (есть)
- Раздел A (настройки компании) — рекомендуется, но не обязательно

### B.3 База данных — Миграции

```sql
-- Миграция: create_departments_system

-- 1. Таблица объектов
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  label TEXT,                          -- Иерархическая метка (авто, напр. "Budowy > Elektryka > Vilda Art")
  parent_id UUID REFERENCES departments(id) ON DELETE SET NULL,

  -- Адрес (опционально, для строительных объектов)
  address_street TEXT,
  address_city TEXT,
  address_postal_code TEXT,
  address_country TEXT DEFAULT 'PL',

  -- Геозона (опционально)
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  range_meters INTEGER DEFAULT 200,    -- Радиус геозоны в метрах

  -- Статус
  is_archived BOOLEAN DEFAULT false,

  -- Метаданные
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Таблица связи "Сотрудник ↔ Объект" (many-to-many)
CREATE TABLE department_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',          -- 'member' | 'manager'  (manager = менеджер этого объекта)
  assigned_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(department_id, user_id)
);

-- 3. Индексы
CREATE INDEX idx_departments_company ON departments(company_id);
CREATE INDEX idx_departments_parent ON departments(parent_id);
CREATE INDEX idx_departments_archived ON departments(company_id, is_archived);
CREATE INDEX idx_dept_members_dept ON department_members(department_id);
CREATE INDEX idx_dept_members_user ON department_members(user_id);
CREATE INDEX idx_dept_members_company ON department_members(company_id);

-- 4. Функция автообновления label по иерархии
CREATE OR REPLACE FUNCTION update_department_label()
RETURNS TRIGGER AS $$
DECLARE
  parent_label TEXT;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT label INTO parent_label FROM departments WHERE id = NEW.parent_id;
    IF parent_label IS NOT NULL AND parent_label != '' THEN
      NEW.label := parent_label || ' > ' || NEW.name;
    ELSE
      SELECT name INTO parent_label FROM departments WHERE id = NEW.parent_id;
      NEW.label := parent_label || ' > ' || NEW.name;
    END IF;
  ELSE
    NEW.label := NEW.name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_department_label
  BEFORE INSERT OR UPDATE OF name, parent_id ON departments
  FOR EACH ROW EXECUTE FUNCTION update_department_label();

-- 5. Функция обновления updated_at
CREATE OR REPLACE FUNCTION update_departments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_departments_updated_at
  BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION update_departments_updated_at();

-- 6. RLS политики
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_members ENABLE ROW LEVEL SECURITY;

-- departments: пользователи видят только объекты своей компании
CREATE POLICY "departments_select_own_company" ON departments
  FOR SELECT USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_global_user = true)
  );

CREATE POLICY "departments_insert_admin" ON departments
  FOR INSERT WITH CHECK (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid() AND role IN ('company_admin', 'hr'))
  );

CREATE POLICY "departments_update_admin" ON departments
  FOR UPDATE USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid() AND role IN ('company_admin', 'hr'))
  );

CREATE POLICY "departments_delete_admin" ON departments
  FOR DELETE USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid() AND role = 'company_admin')
  );

-- department_members: аналогичные политики
CREATE POLICY "dept_members_select_own_company" ON department_members
  FOR SELECT USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_global_user = true)
  );

CREATE POLICY "dept_members_manage" ON department_members
  FOR ALL USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid() AND role IN ('company_admin', 'hr'))
  );
```

### B.4 TypeScript типы

Добавить в `types.ts`:

```typescript
// === Раздел B: Объекты ===

export interface Department {
  id: string;
  company_id: string;
  name: string;
  label?: string;           // Авто-генерируемая иерархическая метка
  parent_id?: string | null;

  // Адрес
  address_street?: string;
  address_city?: string;
  address_postal_code?: string;
  address_country?: string;

  // Геозона
  latitude?: number | null;
  longitude?: number | null;
  range_meters?: number;

  // Статус
  is_archived: boolean;

  // Метаданные
  created_at: string;
  updated_at: string;

  // Вычисляемые (при загрузке с join)
  subdepartments?: Department[];
  members_count?: number;
}

export interface DepartmentMember {
  id: string;
  department_id: string;
  user_id: string;
  company_id: string;
  role: 'member' | 'manager';
  assigned_at: string;
}
```

### B.5 UI — Страницы и компоненты

#### B.5.1 Страница списка объектов

**Путь:** `/company/departments` (новая страница)
**Доступ:** COMPANY_ADMIN (полный), HR (чтение + назначение сотрудников), COORDINATOR (чтение)

**Элементы страницы:**
- **Заголовок:** "Объекты" с кнопкой "+ Добавить объект"
- **Дерево объектов** — иерархический список:
  - Каждый узел: название объекта, кол-во сотрудников, иконка геозоны (если есть координаты)
  - Раскрытие/сворачивание дочерних объектов
  - Кнопки действий: Редактировать, Архивировать, Удалить (только для COMPANY_ADMIN)
  - Кнопка "Добавить подобъект" на каждом узле
- **Фильтры:** Поиск по имени, переключатель "Показать архивные"
- **Альтернативный вид:** Таблица (переключение дерево/таблица)

#### B.5.2 Модальное окно создания/редактирования объекта

**Поля формы:**
- `name` — Название объекта (обязательное, text input)
- `parent_id` — Родительский объект (выпадающий список существующих объектов, опционально)
- **Секция "Адрес" (раскрываемая):**
  - `address_street` — Улица
  - `address_city` — Город
  - `address_postal_code` — Почтовый индекс
  - `address_country` — Страна (по умолчанию PL)
- **Секция "Геозона" (раскрываемая):**
  - `latitude` — Широта (числовое поле)
  - `longitude` — Долгота (числовое поле)
  - `range_meters` — Радиус в метрах (числовое поле, по умолчанию 200)
  - Кнопка "Определить по адресу" — геокодирование адреса (опционально, можно реализовать позже)
- **Кнопки:** Сохранить / Отмена

#### B.5.3 Страница деталей объекта

**Путь:** `/company/departments/:id`
**Вкладки:**
1. **Информация** — название, адрес, геозона, родительский объект, дочерние объекты
2. **Сотрудники** — список назначенных сотрудников с ролью (member/manager)
   - Кнопка "Назначить сотрудника" — модальное окно с поиском по сотрудникам компании
   - Кнопка "Удалить из объекта" для каждого сотрудника
   - Переключатель роли member/manager для каждого сотрудника

### B.6 Навигация

Добавить пункт в сайдбар для ролей COMPANY_ADMIN, HR и COORDINATOR:
- Иконка: `Building2` (lucide-react)
- Текст: "Объекты"
- Путь: `/company/departments`
- Расположение: после существующего пункта "Пользователи"

### B.7 Логика работы

**Загрузка дерева объектов:**
```typescript
const loadDepartments = async () => {
  const { data } = await supabase
    .from('departments')
    .select('*, department_members(count)')
    .eq('company_id', companyId)
    .eq('is_archived', false)
    .order('name');
  // Построить дерево из плоского списка по parent_id
  return buildTree(data);
};
```

**Создание объекта:**
```typescript
const createDepartment = async (dept: Partial<Department>) => {
  const { data, error } = await supabase
    .from('departments')
    .insert({ ...dept, company_id: companyId })
    .select()
    .single();
};
```

**Назначение сотрудника в объект:**
```typescript
const assignMember = async (departmentId: string, userId: string, role: 'member' | 'manager') => {
  const { error } = await supabase
    .from('department_members')
    .upsert({
      department_id: departmentId,
      user_id: userId,
      company_id: companyId,
      role,
    }, { onConflict: 'department_id,user_id' });
};
```

### B.8 Права доступа

| Действие | COMPANY_ADMIN | HR | Остальные |
|---|---|---|---|
| Все действия (CRUD, назначения) | ✅ полный | ✅ полный | ❌ |

### B.9 Критерии готовности

- [ ] Таблицы `departments` и `department_members` созданы с RLS
- [ ] TypeScript типы Department, DepartmentMember добавлены
- [ ] Страница `/company/departments` с деревом объектов
- [ ] CRUD операции для объектов работают
- [ ] Назначение/удаление сотрудников из объектов работает
- [ ] Иерархия (parent_id) отображается корректно
- [ ] Label автоматически генерируется триггером
- [ ] Пункт "Объекты" в сайдбаре для COMPANY_ADMIN и HR
- [ ] RLS изолирует данные по company_id

---

## МОДУЛЬ 1: Учёт рабочего времени (Time & Attendance)

### C.1 Описание модуля

Основной модуль системы. Позволяет сотрудникам отмечать приход/уход/перерывы. Администраторы и HR видят сводку по всем сотрудникам, могут вручную корректировать записи. Система автоматически агрегирует отметки в рабочие дни с подсчётом рабочего времени, перерывов, переработок.

В Moniti это реализовано через цепочку: **Action** (атомарное событие) → **Activity** (блок работы/перерыва) → **WorkerDayEntry** (запись дня) → **WorkerDay** (итог дня). Мы адаптируем эту модель под нашу архитектуру Supabase.

### C.2 Зависимости

- **Раздел A** (настройки рабочего времени компании) — для округления, рабочих часов, макс. времени
- **Раздел B** (объекты) — опционально, для привязки отметки к объекту
- Таблица `users` (есть)
- Таблица `companies` (есть)
- Таблица `positions` (есть)

### C.3 База данных — Миграции

```sql
-- Миграция: create_time_attendance_system

-- ==============================================
-- 1. ТАБЛИЦА РАБОЧИХ ДНЕЙ (worker_days)
-- ==============================================
-- Один рабочий день одного сотрудника. Агрегирует все записи и активности.
CREATE TABLE worker_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- Статус дня
  status TEXT DEFAULT 'absent',
  -- Возможные значения: 'absent', 'present', 'late', 'incomplete', 'day_off', 'holiday', 'time_off'
  -- 'absent'     = не вышел на работу
  -- 'present'    = отработал полный день
  -- 'late'       = пришёл с опозданием (относительно working_hours)
  -- 'incomplete' = не доработал до нормы
  -- 'day_off'    = выходной (по графику)
  -- 'holiday'    = праздничный день (из calendar)
  -- 'time_off'   = отпуск/отсутствие (из Модуля 2)

  confirmed BOOLEAN DEFAULT false,      -- Подтверждён менеджером
  finished BOOLEAN DEFAULT false,       -- День завершён (все записи закрыты)

  -- Агрегированные поля (пересчитываются автоматически)
  total_time_minutes INTEGER DEFAULT 0,   -- Общее время (работа + перерыв)
  work_time_minutes INTEGER DEFAULT 0,    -- Чистое рабочее время
  break_time_minutes INTEGER DEFAULT 0,   -- Время перерывов
  overtime_minutes INTEGER DEFAULT 0,     -- Переработка (относительно нормы)

  -- Заметки
  note TEXT,                              -- Заметка сотрудника
  manager_note TEXT,                      -- Заметка менеджера

  -- Метаданные
  is_business_day BOOLEAN DEFAULT true,
  is_holiday BOOLEAN DEFAULT false,
  is_weekend BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, date)
);

-- ==============================================
-- 2. ТАБЛИЦА ЗАПИСЕЙ РАБОЧЕГО ДНЯ (worker_day_entries)
-- ==============================================
-- Одна "смена" внутри дня. Сотрудник может иметь несколько entries за день
-- (напр. ушёл на обед и вернулся = 2 entries, или работал в двух объектах).
CREATE TABLE worker_day_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_day_id UUID NOT NULL REFERENCES worker_days(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  start_time TIMESTAMPTZ NOT NULL,
  finish_time TIMESTAMPTZ,                -- NULL = ещё работает
  finished BOOLEAN DEFAULT false,

  -- Привязка к объекту / должности (опционально)
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  position_id UUID,                       -- Ссылка на positions (если нужно)

  is_remote BOOLEAN DEFAULT false,        -- Удалённая работа
  note TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- 3. ТАБЛИЦА АКТИВНОСТЕЙ (worker_day_activities)
-- ==============================================
-- Атомарные блоки внутри entry: работа, перерыв, деловой выход, личный выход.
CREATE TABLE worker_day_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES worker_day_entries(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  type TEXT NOT NULL,
  -- Возможные значения: 'work', 'break', 'exit_business', 'exit_private'

  start_time TIMESTAMPTZ NOT NULL,
  finish_time TIMESTAMPTZ,                -- NULL = активность в процессе
  finished BOOLEAN DEFAULT false,
  approved BOOLEAN DEFAULT true,          -- Утверждена менеджером (для перерывов)

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- 4. ТАБЛИЦА ДЕЙСТВИЙ / СОБЫТИЙ (time_actions)
-- ==============================================
-- Каждая атомарная отметка (нажатие кнопки). Лог событий.
CREATE TABLE time_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  action_type TEXT NOT NULL,
  -- Возможные значения:
  -- 'work_start', 'work_finish',
  -- 'break_start', 'break_finish',
  -- 'exit_business_start', 'exit_business_finish',
  -- 'exit_private_start', 'exit_private_finish'

  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT DEFAULT 'web',              -- 'web', 'mobile', 'kiosk', 'manual'
  -- 'web'    = через веб-приложение
  -- 'mobile' = через мобильное (будущее)
  -- 'kiosk'  = через терминал (будущее)
  -- 'manual' = ручная коррекция менеджером

  -- Опционально: геолокация
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,

  -- Опционально: привязка к объекту
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,

  -- Кто создал (для manual — id менеджера, иначе = user_id)
  created_by UUID REFERENCES users(id),

  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- 5. ТАБЛИЦА ЗАЯВОК НА ИЗМЕНЕНИЕ РАБОЧЕГО ДНЯ (worker_day_requests)
-- ==============================================
-- Сотрудник запрашивает коррекцию своего рабочего дня.
CREATE TABLE worker_day_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  worker_day_id UUID REFERENCES worker_days(id) ON DELETE SET NULL,
  date DATE NOT NULL,

  status TEXT DEFAULT 'pending',
  -- 'pending', 'approved', 'rejected'

  -- Предлагаемые данные (что сотрудник хочет исправить)
  requested_entries JSONB NOT NULL,
  -- Формат: [{start_time, finish_time, department_id, activities: [{type, start_time, finish_time}]}]

  note TEXT,                              -- Пояснение от сотрудника
  reviewer_id UUID REFERENCES users(id),  -- Кто рассмотрел
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- 6. ТАБЛИЦА ТЕКУЩЕГО СОСТОЯНИЯ СОТРУДНИКА (worker_states)
-- ==============================================
-- Один row на сотрудника. Обновляется при каждом action. Для дашборда "Команда сейчас".
CREATE TABLE worker_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  current_status TEXT DEFAULT 'offline',
  -- 'offline', 'working', 'on_break', 'exit_business', 'exit_private'

  activity_started_at TIMESTAMPTZ,        -- Когда начата текущая активность
  work_started_at TIMESTAMPTZ,            -- Когда начал работу сегодня
  work_finished_at TIMESTAMPTZ,           -- Когда закончил работу сегодня

  current_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  is_remote BOOLEAN DEFAULT false,

  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- ==============================================
-- 7. ИНДЕКСЫ
-- ==============================================
CREATE INDEX idx_worker_days_company_date ON worker_days(company_id, date);
CREATE INDEX idx_worker_days_user_date ON worker_days(user_id, date);
CREATE INDEX idx_worker_day_entries_day ON worker_day_entries(worker_day_id);
CREATE INDEX idx_worker_day_entries_user ON worker_day_entries(user_id, company_id);
CREATE INDEX idx_worker_day_activities_entry ON worker_day_activities(entry_id);
CREATE INDEX idx_time_actions_user_ts ON time_actions(user_id, timestamp);
CREATE INDEX idx_time_actions_company_ts ON time_actions(company_id, timestamp);
CREATE INDEX idx_worker_day_requests_company ON worker_day_requests(company_id, status);
CREATE INDEX idx_worker_day_requests_user ON worker_day_requests(user_id, date);
CREATE INDEX idx_worker_states_company ON worker_states(company_id);

-- ==============================================
-- 8. RLS ПОЛИТИКИ
-- ==============================================
ALTER TABLE worker_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_day_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_day_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_day_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_states ENABLE ROW LEVEL SECURITY;

-- worker_days: сотрудник видит только свои, admin/hr — все в компании
CREATE POLICY "worker_days_select" ON worker_days FOR SELECT USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  AND (
    user_id = auth.uid()
    OR (SELECT role FROM users WHERE id = auth.uid()) IN ('company_admin', 'hr', 'coordinator', 'brigadir')
    OR (SELECT is_global_user FROM users WHERE id = auth.uid()) = true
  )
);

CREATE POLICY "worker_days_insert" ON worker_days FOR INSERT WITH CHECK (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
);

CREATE POLICY "worker_days_update" ON worker_days FOR UPDATE USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  AND (
    user_id = auth.uid()
    OR (SELECT role FROM users WHERE id = auth.uid()) IN ('company_admin', 'hr')
    OR (SELECT is_global_user FROM users WHERE id = auth.uid()) = true
  )
);

-- Аналогичные политики для остальных таблиц
CREATE POLICY "entries_select" ON worker_day_entries FOR SELECT USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  AND (
    user_id = auth.uid()
    OR (SELECT role FROM users WHERE id = auth.uid()) IN ('company_admin', 'hr', 'coordinator', 'brigadir')
    OR (SELECT is_global_user FROM users WHERE id = auth.uid()) = true
  )
);

CREATE POLICY "entries_manage" ON worker_day_entries FOR ALL USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
);

CREATE POLICY "activities_select" ON worker_day_activities FOR SELECT USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  AND (
    user_id = auth.uid()
    OR (SELECT role FROM users WHERE id = auth.uid()) IN ('company_admin', 'hr', 'coordinator', 'brigadir')
    OR (SELECT is_global_user FROM users WHERE id = auth.uid()) = true
  )
);

CREATE POLICY "activities_manage" ON worker_day_activities FOR ALL USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
);

CREATE POLICY "actions_select" ON time_actions FOR SELECT USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  AND (
    user_id = auth.uid()
    OR (SELECT role FROM users WHERE id = auth.uid()) IN ('company_admin', 'hr')
    OR (SELECT is_global_user FROM users WHERE id = auth.uid()) = true
  )
);

CREATE POLICY "actions_insert" ON time_actions FOR INSERT WITH CHECK (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
);

CREATE POLICY "requests_select" ON worker_day_requests FOR SELECT USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  AND (
    user_id = auth.uid()
    OR (SELECT role FROM users WHERE id = auth.uid()) IN ('company_admin', 'hr')
    OR (SELECT is_global_user FROM users WHERE id = auth.uid()) = true
  )
);

CREATE POLICY "requests_manage" ON worker_day_requests FOR ALL USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
);

CREATE POLICY "states_select" ON worker_states FOR SELECT USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
);

CREATE POLICY "states_manage" ON worker_states FOR ALL USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
);

-- ==============================================
-- 9. ФУНКЦИЯ: Обработка действия (clock-in/out)
-- ==============================================
-- Эта функция вызывается при каждом clock-in/out.
-- Она создаёт/обновляет worker_day, entry, activity и state.

CREATE OR REPLACE FUNCTION process_time_action(
  p_user_id UUID,
  p_company_id UUID,
  p_action_type TEXT,
  p_timestamp TIMESTAMPTZ DEFAULT NOW(),
  p_source TEXT DEFAULT 'web',
  p_department_id UUID DEFAULT NULL,
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_action_id UUID;
  v_date DATE;
  v_worker_day_id UUID;
  v_entry_id UUID;
  v_activity_id UUID;
  v_round_time JSONB;
  v_rounded_ts TIMESTAMPTZ;
  v_company RECORD;
BEGIN
  -- 1. Определить дату (с учётом таймзоны компании)
  SELECT timezone INTO v_company FROM companies WHERE id = p_company_id;
  v_date := (p_timestamp AT TIME ZONE COALESCE(v_company.timezone, 'Europe/Warsaw'))::DATE;

  -- 2. Записать action в лог
  INSERT INTO time_actions (company_id, user_id, action_type, timestamp, source, latitude, longitude, department_id, created_by, note)
  VALUES (p_company_id, p_user_id, p_action_type, p_timestamp, p_source, p_latitude, p_longitude, p_department_id, p_user_id, p_note)
  RETURNING id INTO v_action_id;

  -- 3. Получить или создать worker_day
  INSERT INTO worker_days (company_id, user_id, date, status)
  VALUES (p_company_id, p_user_id, v_date, 'present')
  ON CONFLICT (user_id, date) DO UPDATE SET status = 'present', updated_at = NOW()
  RETURNING id INTO v_worker_day_id;

  -- 4. Обработка по типу действия
  CASE p_action_type
    WHEN 'work_start' THEN
      -- Создать новую entry и activity 'work'
      INSERT INTO worker_day_entries (worker_day_id, company_id, user_id, start_time, department_id)
      VALUES (v_worker_day_id, p_company_id, p_user_id, p_timestamp, p_department_id)
      RETURNING id INTO v_entry_id;

      INSERT INTO worker_day_activities (entry_id, company_id, user_id, type, start_time)
      VALUES (v_entry_id, p_company_id, p_user_id, 'work', p_timestamp);

      -- Обновить state
      INSERT INTO worker_states (company_id, user_id, current_status, activity_started_at, work_started_at, current_department_id)
      VALUES (p_company_id, p_user_id, 'working', p_timestamp, p_timestamp, p_department_id)
      ON CONFLICT (user_id) DO UPDATE SET
        current_status = 'working',
        activity_started_at = p_timestamp,
        work_started_at = p_timestamp,
        work_finished_at = NULL,
        current_department_id = p_department_id,
        updated_at = NOW();

    WHEN 'work_finish' THEN
      -- Закрыть текущую activity и entry
      UPDATE worker_day_activities SET finish_time = p_timestamp, finished = true
      WHERE user_id = p_user_id AND finished = false AND type = 'work'
        AND entry_id IN (SELECT id FROM worker_day_entries WHERE worker_day_id = v_worker_day_id AND finished = false);

      UPDATE worker_day_entries SET finish_time = p_timestamp, finished = true
      WHERE worker_day_id = v_worker_day_id AND user_id = p_user_id AND finished = false;

      -- Обновить state
      UPDATE worker_states SET
        current_status = 'offline',
        work_finished_at = p_timestamp,
        activity_started_at = NULL,
        updated_at = NOW()
      WHERE user_id = p_user_id;

      -- Пересчитать время дня
      PERFORM recalculate_worker_day(v_worker_day_id);

    WHEN 'break_start' THEN
      -- Закрыть текущую work activity, начать break
      UPDATE worker_day_activities SET finish_time = p_timestamp, finished = true
      WHERE user_id = p_user_id AND finished = false AND type = 'work'
        AND entry_id IN (SELECT id FROM worker_day_entries WHERE worker_day_id = v_worker_day_id AND finished = false);

      SELECT id INTO v_entry_id FROM worker_day_entries
      WHERE worker_day_id = v_worker_day_id AND user_id = p_user_id AND finished = false
      LIMIT 1;

      IF v_entry_id IS NOT NULL THEN
        INSERT INTO worker_day_activities (entry_id, company_id, user_id, type, start_time)
        VALUES (v_entry_id, p_company_id, p_user_id, 'break', p_timestamp);
      END IF;

      UPDATE worker_states SET current_status = 'on_break', activity_started_at = p_timestamp, updated_at = NOW()
      WHERE user_id = p_user_id;

    WHEN 'break_finish' THEN
      -- Закрыть break activity, начать новую work activity
      UPDATE worker_day_activities SET finish_time = p_timestamp, finished = true
      WHERE user_id = p_user_id AND finished = false AND type = 'break'
        AND entry_id IN (SELECT id FROM worker_day_entries WHERE worker_day_id = v_worker_day_id AND finished = false);

      SELECT id INTO v_entry_id FROM worker_day_entries
      WHERE worker_day_id = v_worker_day_id AND user_id = p_user_id AND finished = false
      LIMIT 1;

      IF v_entry_id IS NOT NULL THEN
        INSERT INTO worker_day_activities (entry_id, company_id, user_id, type, start_time)
        VALUES (v_entry_id, p_company_id, p_user_id, 'work', p_timestamp);
      END IF;

      UPDATE worker_states SET current_status = 'working', activity_started_at = p_timestamp, updated_at = NOW()
      WHERE user_id = p_user_id;

  END CASE;

  RETURN jsonb_build_object('action_id', v_action_id, 'worker_day_id', v_worker_day_id, 'status', 'ok');
END;
$$;

-- ==============================================
-- 10. ФУНКЦИЯ: Пересчёт времени рабочего дня
-- ==============================================
CREATE OR REPLACE FUNCTION recalculate_worker_day(p_worker_day_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_work_minutes INTEGER := 0;
  v_break_minutes INTEGER := 0;
  v_total_minutes INTEGER := 0;
  v_daily_norm INTEGER;
  v_overtime INTEGER := 0;
  v_user_id UUID;
  v_company_id UUID;
  rec RECORD;
BEGIN
  SELECT user_id, company_id INTO v_user_id, v_company_id FROM worker_days WHERE id = p_worker_day_id;

  -- Подсчёт по activities
  FOR rec IN
    SELECT type,
           EXTRACT(EPOCH FROM (COALESCE(finish_time, NOW()) - start_time)) / 60.0 AS minutes
    FROM worker_day_activities
    WHERE entry_id IN (SELECT id FROM worker_day_entries WHERE worker_day_id = p_worker_day_id)
      AND finished = true
  LOOP
    IF rec.type = 'work' THEN
      v_work_minutes := v_work_minutes + ROUND(rec.minutes);
    ELSIF rec.type = 'break' THEN
      v_break_minutes := v_break_minutes + ROUND(rec.minutes);
    END IF;
  END LOOP;

  v_total_minutes := v_work_minutes + v_break_minutes;

  -- Получить норму рабочего дня (из users.daily_working_time или company working_hours)
  SELECT COALESCE(
    (SELECT CASE WHEN base_rate IS NOT NULL THEN 480 ELSE 480 END FROM users WHERE id = v_user_id),
    480
  ) INTO v_daily_norm; -- По умолчанию 8 часов = 480 минут

  v_overtime := GREATEST(0, v_work_minutes - v_daily_norm);

  -- Обновить worker_day
  UPDATE worker_days SET
    total_time_minutes = v_total_minutes,
    work_time_minutes = v_work_minutes,
    break_time_minutes = v_break_minutes,
    overtime_minutes = v_overtime,
    finished = true,
    updated_at = NOW()
  WHERE id = p_worker_day_id;
END;
$$;
```

### C.4 TypeScript типы

Добавить в `types.ts`:

```typescript
// === МОДУЛЬ 1: Учёт рабочего времени ===

export type WorkerDayStatus = 'absent' | 'present' | 'late' | 'incomplete' | 'day_off' | 'holiday' | 'time_off';
export type ActivityType_TA = 'work' | 'break' | 'exit_business' | 'exit_private';
export type TimeActionType = 'work_start' | 'work_finish' | 'break_start' | 'break_finish' | 'exit_business_start' | 'exit_business_finish' | 'exit_private_start' | 'exit_private_finish';
export type TimeActionSource = 'web' | 'mobile' | 'kiosk' | 'manual';
export type WorkerCurrentStatus = 'offline' | 'working' | 'on_break' | 'exit_business' | 'exit_private';
export type DayRequestStatus = 'pending' | 'approved' | 'rejected';

export interface WorkerDay {
  id: string;
  company_id: string;
  user_id: string;
  date: string;
  status: WorkerDayStatus;
  confirmed: boolean;
  finished: boolean;
  total_time_minutes: number;
  work_time_minutes: number;
  break_time_minutes: number;
  overtime_minutes: number;
  note?: string;
  manager_note?: string;
  is_business_day: boolean;
  is_holiday: boolean;
  is_weekend: boolean;
  created_at: string;
  updated_at: string;
  // Joins
  entries?: WorkerDayEntry[];
  user?: User;
}

export interface WorkerDayEntry {
  id: string;
  worker_day_id: string;
  company_id: string;
  user_id: string;
  start_time: string;
  finish_time?: string;
  finished: boolean;
  department_id?: string;
  position_id?: string;
  is_remote: boolean;
  note?: string;
  created_at: string;
  updated_at: string;
  // Joins
  activities?: WorkerDayActivity[];
  department?: Department;
}

export interface WorkerDayActivity {
  id: string;
  entry_id: string;
  company_id: string;
  user_id: string;
  type: ActivityType_TA;
  start_time: string;
  finish_time?: string;
  finished: boolean;
  approved: boolean;
  created_at: string;
}

export interface TimeAction {
  id: string;
  company_id: string;
  user_id: string;
  action_type: TimeActionType;
  timestamp: string;
  source: TimeActionSource;
  latitude?: number;
  longitude?: number;
  department_id?: string;
  created_by?: string;
  note?: string;
  created_at: string;
}

export interface WorkerState {
  id: string;
  company_id: string;
  user_id: string;
  current_status: WorkerCurrentStatus;
  activity_started_at?: string;
  work_started_at?: string;
  work_finished_at?: string;
  current_department_id?: string;
  is_remote: boolean;
  updated_at: string;
  // Joins
  user?: User;
  department?: Department;
}

export interface WorkerDayRequest {
  id: string;
  company_id: string;
  user_id: string;
  worker_day_id?: string;
  date: string;
  status: DayRequestStatus;
  requested_entries: RequestedEntry[];
  note?: string;
  reviewer_id?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
  // Joins
  user?: User;
  reviewer?: User;
}

export interface RequestedEntry {
  start_time: string;
  finish_time: string;
  department_id?: string;
  activities: { type: ActivityType_TA; start_time: string; finish_time: string }[];
}
```

### C.5 UI — Страницы и компоненты

#### C.5.1 Страница "Мой рабочий день" (для EMPLOYEE и всех ролей)

**Путь:** `/employee/attendance` (новая страница)
**Доступ:** все роли компании (каждый видит своё)

**Элементы страницы:**

**Верхний блок — Текущий статус:**
- Большие кнопки действий (видимые в зависимости от текущего статуса):
  - Статус `offline` → кнопка "Начать работу" (зелёная, action_type=`work_start`)
  - Статус `working` → кнопки "Перерыв" (жёлтая, `break_start`) и "Завершить работу" (красная, `work_finish`)
  - Статус `on_break` → кнопка "Закончить перерыв" (зелёная, `break_finish`)
- Текущее время работы (таймер, обновляется каждую секунду)
- Текущий статус текстом: "Работает с 08:00", "На перерыве с 12:00"
- Опциональный выбор объекта (dropdown, если сотрудник в нескольких)
- Чекбокс "Удалённая работа" (если разрешено)

**Нижний блок — История за месяц:**
- Таблица / Список рабочих дней текущего месяца:
  - Дата | Статус | Приход | Уход | Работа | Перерыв | Переработка
- Цветовое кодирование: зелёный=present, жёлтый=late, красный=absent, серый=day_off
- Клик по дню → развёрнутая информация по entries и activities
- Навигация по месяцам (← Предыдущий / Следующий →)

**Итоги месяца (summary):**
- Всего рабочих дней
- Всего отработано часов
- Переработки
- Дни отсутствия

#### C.5.2 Страница "Посещаемость" (для COMPANY_ADMIN, HR)

**Путь:** `/company/attendance` (новая страница)
**Доступ:** COMPANY_ADMIN (все), HR (все в компании), COORDINATOR (свой объект), BRIGADIR (своя бригада)

**Вкладки:**

**Вкладка "Дневная сводка":**
- Выбор даты (date picker, по умолчанию — сегодня)
- Таблица всех сотрудников:
  - Имя | Объект | Статус | Приход | Уход | Работа | Перерыв | Переработка | Действия
- Фильтры: по объекту, по статусу (present/absent/late/etc.), поиск по имени
- Экспорт в Excel (кнопка)
- Клик по строке → модальное окно с деталями дня

**Вкладка "Итоги периода":**
- Выбор диапазона дат (date range picker)
- Выбор сотрудников (multi-select или все)
- Таблица с агрегацией:
  - Имя | Рабочих дней | Часов работы | Часов перерывов | Переработка | Опоздания | Отсутствия
- Экспорт в Excel

**Вкладка "Заявки на изменение":**
- Список всех pending заявок (WorkerDayRequest)
- **Доступ к одобрению:** COMPANY_ADMIN, HR, COORDINATOR (свой объект), BRIGADIR (своя бригада)
- Каждая заявка:
  - Имя сотрудника | Дата | Текущие данные | Запрошенные данные | Комментарий
  - Кнопки: "Одобрить" / "Отклонить" / "Одобрить все выбранные" / "Отклонить все выбранные"
- Чекбоксы для массовых действий

#### C.5.3 Модальное окно "Редактирование рабочего дня" (для COMPANY_ADMIN, HR, COORDINATOR)

**Вызывается из:** вкладка "Дневная сводка" → клик по строке → кнопка "Редактировать"

**Поля:**
- Дата (readonly)
- Сотрудник (readonly)
- Статус дня (dropdown: present/absent/late/day_off)
- Записи дня (entries) — список:
  - Приход (time picker)
  - Уход (time picker)
  - Объект (dropdown)
  - Удалённая работа (checkbox)
  - Активности внутри entry (sub-list):
    - Тип (work/break) | Начало | Конец
    - Кнопка "+ Добавить активность"
  - Кнопка "+ Добавить запись"
- Заметка менеджера (textarea)
- Чекбокс "Подтвердить день"
- Кнопки: Сохранить / Отмена

**Логика сохранения:** UPSERT в worker_day_entries и worker_day_activities, затем вызов `recalculate_worker_day`.

#### C.5.4 Модальное окно "Заявка на изменение" (для EMPLOYEE, BRIGADIR, COORDINATOR, HR)

**Вызывается из:** "Мой рабочий день" → клик по дню → кнопка "Запросить изменение"

**Поля:**
- Дата (readonly)
- Текущие записи (readonly, для справки)
- Предлагаемые записи:
  - Приход (time picker)
  - Уход (time picker)
  - Активности [{type, start, finish}]
- Комментарий (textarea, обязательно)
- Кнопка: Отправить заявку

### C.6 Навигация

Добавить в сайдбар:

**Для EMPLOYEE, BRIGADIR, COORDINATOR, HR, COMPANY_ADMIN:**
- Иконка: `Clock` (lucide-react)
- Текст: "Рабочее время"
- Путь: `/employee/attendance`

**Дополнительно для COMPANY_ADMIN, HR, COORDINATOR, BRIGADIR:**
- Иконка: `ClipboardList` (lucide-react)
- Текст: "Посещаемость"
- Путь: `/company/attendance`
- Бейдж с количеством pending заявок

### C.7 Логика clock-in/out

```typescript
// Функция регистрации действия
const clockAction = async (actionType: TimeActionType) => {
  const { data, error } = await supabase.rpc('process_time_action', {
    p_user_id: currentUser.id,
    p_company_id: currentUser.company_id,
    p_action_type: actionType,
    p_timestamp: new Date().toISOString(),
    p_source: 'web',
    p_department_id: selectedDepartmentId || null,
    p_note: null,
  });
  if (!error) {
    // Обновить UI: перезагрузить worker_state и worker_day
    await refreshCurrentState();
    await refreshTodayData();
  }
};

// Загрузка текущего состояния
const refreshCurrentState = async () => {
  const { data } = await supabase
    .from('worker_states')
    .select('*')
    .eq('user_id', currentUser.id)
    .single();
  setCurrentState(data);
};

// Загрузка данных текущего дня
const refreshTodayData = async () => {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('worker_days')
    .select('*, worker_day_entries(*, worker_day_activities(*))')
    .eq('user_id', currentUser.id)
    .eq('date', today)
    .single();
  setTodayData(data);
};
```

### C.8 Права доступа

| Действие | COMPANY_ADMIN | HR | COORDINATOR | BRIGADIR | EMPLOYEE |
|---|---|---|---|---|---|
| Clock-in/out (свой) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Просмотр своей посещаемости | ✅ | ✅ | ✅ | ✅ | ✅ |
| Просмотр всех в компании | ✅ | ✅ | ✅ свой объект* | ✅ своя бригада* | ❌ |
| Ручная коррекция дня | ✅ | ✅ | ✅ | ❌ | ❌ |
| Одобрение заявок | ✅ | ✅ | ✅ | ❌ | ❌ |
| Подача заявки на изменение | ✅ | ✅ | ✅ | ✅ | ✅ |
| Подтверждение дня | ✅ | ✅ | ✅ | ❌ | ❌ |
| Экспорт в Excel | ✅ | ✅ | ✅ | ❌ | ❌ |

*COORDINATOR и BRIGADIR видят только сотрудников своего объекта/бригады (фильтрация через department_members и assigned_brigadir_id)

### C.9 Регистрация модуля

Добавить в таблицу `modules` новый модуль:

```sql
INSERT INTO modules (code, name_pl, name_en, description_pl, available_roles, base_price_per_user, is_active, display_order, icon)
VALUES (
  'time_attendance',
  'Czas pracy',
  'Time & Attendance',
  'Rejestracja czasu pracy, obecność, nadgodziny, wnioski o korekty',
  ARRAY['company_admin', 'hr', 'coordinator', 'brigadir', 'employee'],
  49,
  true,
  3,
  'Clock'
);
```

### C.10 Критерии готовности

- [ ] Все 6 таблиц созданы (worker_days, worker_day_entries, worker_day_activities, time_actions, worker_day_requests, worker_states)
- [ ] RLS политики на все таблицы
- [ ] Функции process_time_action и recalculate_worker_day работают
- [ ] TypeScript типы добавлены
- [ ] Модуль зарегистрирован в таблице modules
- [ ] Страница "Мой рабочий день" — clock-in/out работает, таймер, история
- [ ] Страница "Посещаемость" — дневная сводка, итоги периода, заявки
- [ ] Модальное редактирование рабочего дня (admin/hr)
- [ ] Подача и обработка заявок на изменение
- [ ] Навигация в сайдбаре
- [ ] Экспорт в Excel

---

## Раздел D: Дашборд "Команда сейчас" (Team Now)

### D.1 Описание

Дашборд реального времени, показывающий текущий статус всех сотрудников компании: кто работает, кто на перерыве, кто ещё не пришёл. В Moniti это ключевой экран для менеджеров. Данные берутся из таблицы `worker_states` (Модуль 1). Обновление через Supabase Realtime (подписка на изменения таблицы).

### D.2 Зависимости

- **Модуль 1** (Time & Attendance) — таблица `worker_states` обязательна
- **Раздел B** (Объекты) — опционально, для фильтрации по объектам

### D.3 База данных

Новых таблиц не требуется. Используется `worker_states` из Модуля 1.

### D.4 UI — Страница "Команда сейчас"

**Путь:** `/company/team-now` (новая страница)
**Доступ:** COMPANY_ADMIN, HR (все), COORDINATOR (свой объект), BRIGADIR (своя бригада)

**Элементы страницы:**

**Верхний блок — Сводка (карточки):**
- Карточка "Работают" — число сотрудников со статусом `working`, зелёный цвет
- Карточка "На перерыве" — число со статусом `on_break`, жёлтый цвет
- Карточка "Деловой выход" — число со статусом `exit_business`, синий цвет
- Карточка "Не на работе" — число со статусом `offline`, серый цвет
- Карточка "Всего сотрудников" — общее число активных сотрудников компании

**Средний блок — Список сотрудников:**
- Таблица с автообновлением:
  - Аватар | Имя Фамилия | Объект | Статус (цветной бейдж) | Текущая активность с | Начало работы | Общее время сегодня
- Цветовое кодирование статусов:
  - `working` = зелёный бейдж "Работает"
  - `on_break` = жёлтый бейдж "Перерыв"
  - `exit_business` = синий бейдж "Деловой выход"
  - `offline` = серый бейдж "Не на работе"
- Фильтры:
  - По статусу (чекбоксы: Работают / На перерыве / Не на работе)
  - По объекту (dropdown, если Раздел B внедрён)
  - Поиск по имени
- Сортировка: по имени, по статусу, по времени начала работы

**Нижний блок (опционально) — Таймлайн:**
- Горизонтальный таймлайн дня (00:00–24:00) для каждого сотрудника
- Цветные полосы: зелёная=работа, жёлтая=перерыв, пустая=не на работе
- Визуализация аналогичная Moniti "Admin Day"

### D.5 Realtime-обновление

```typescript
// Подписка на изменения worker_states через Supabase Realtime
useEffect(() => {
  const channel = supabase
    .channel('team-now')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'worker_states',
      filter: `company_id=eq.${companyId}`,
    }, (payload) => {
      // Обновить конкретного сотрудника в списке
      updateWorkerState(payload.new as WorkerState);
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [companyId]);
```

### D.6 Навигация

Добавить в сайдбар для COMPANY_ADMIN, HR, COORDINATOR, BRIGADIR:
- Иконка: `Users` (lucide-react)
- Текст: "Команда сейчас"
- Путь: `/company/team-now`
- Расположение: первым пунктом в секции "Время"

### D.7 Права доступа

| Действие | COMPANY_ADMIN | HR | COORDINATOR | BRIGADIR | EMPLOYEE |
|---|---|---|---|---|---|
| Просмотр дашборда | ✅ все | ✅ все | ✅ свой объект | ✅ своя бригада | ❌ |


### D.8 Критерии готовности

- [ ] Страница `/company/team-now` отображает все статусы
- [ ] Карточки-счётчики по статусам
- [ ] Таблица с realtime-обновлением через Supabase Realtime
- [ ] Фильтрация по статусу, объекту, поиск по имени
- [ ] Цветовое кодирование статусов
- [ ] Пункт в сайдбаре для управленческих ролей
- [ ] COORDINATOR видит только свой объект, BRIGADIR — свою бригаду

---

## МОДУЛЬ 2: Отпуска и отсутствия (Time Off)

### E.1 Описание модуля

Управление отпусками, больничными, и другими типами отсутствий. Включает: настройку типов отпусков, установку лимитов по сотрудникам, подачу и одобрение заявок, календарь отсутствий, расчёт остатка дней, перенос остатков на следующий год.

### E.2 Зависимости

- Таблица `users` (есть)
- Таблица `companies` (есть)
- Модуль 1 (опционально) — для интеграции: день с одобренным отпуском помечается статусом `time_off` в `worker_days`

### E.3 База данных — Миграции

```sql
-- Миграция: create_time_off_system

-- ==============================================
-- 1. ТИПЫ ОТПУСКОВ (time_off_types)
-- ==============================================
CREATE TABLE time_off_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                     -- "Urlop wypoczynkowy", "Zwolnienie lekarskie", etc.
  color TEXT DEFAULT '#4b88fe',           -- Цвет для календаря
  icon TEXT DEFAULT 'calendar',           -- Иконка lucide-react
  is_paid BOOLEAN DEFAULT true,           -- Оплачиваемый
  requires_approval BOOLEAN DEFAULT true, -- Требует одобрения
  allows_half_day BOOLEAN DEFAULT false,  -- Можно брать полдня
  allows_hourly BOOLEAN DEFAULT false,    -- Можно брать почасово
  is_archived BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- 2. ЛИМИТЫ ОТПУСКОВ ПО СОТРУДНИКАМ (time_off_limits)
-- ==============================================
CREATE TABLE time_off_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  time_off_type_id UUID NOT NULL REFERENCES time_off_types(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,                  -- Год, к которому относится лимит
  total_days NUMERIC(5,1) DEFAULT 0,      -- Общий лимит дней (напр. 26.0)
  used_days NUMERIC(5,1) DEFAULT 0,       -- Использовано дней
  carried_over_days NUMERIC(5,1) DEFAULT 0, -- Перенесено с прошлого года
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, time_off_type_id, year)
);

-- ==============================================
-- 3. ЗАЯВКИ НА ОТПУСК (time_off_requests)
-- ==============================================
CREATE TABLE time_off_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  time_off_type_id UUID NOT NULL REFERENCES time_off_types(id) ON DELETE CASCADE,

  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  all_day BOOLEAN DEFAULT true,           -- Полный день
  start_time TIME,                        -- Если не all_day — начало
  end_time TIME,                          -- Если не all_day — конец
  hourly BOOLEAN DEFAULT false,           -- Почасовой отпуск

  amount NUMERIC(5,1) NOT NULL,           -- Кол-во дней (или часов если hourly)

  status TEXT DEFAULT 'pending',
  -- 'pending', 'approved', 'rejected', 'cancelled'

  note_worker TEXT,                       -- Пояснение сотрудника
  note_reviewer TEXT,                     -- Комментарий рецензента

  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- 4. ИНДЕКСЫ
-- ==============================================
CREATE INDEX idx_time_off_types_company ON time_off_types(company_id);
CREATE INDEX idx_time_off_limits_user_year ON time_off_limits(user_id, year);
CREATE INDEX idx_time_off_limits_company ON time_off_limits(company_id, year);
CREATE INDEX idx_time_off_requests_company ON time_off_requests(company_id, status);
CREATE INDEX idx_time_off_requests_user ON time_off_requests(user_id, status);
CREATE INDEX idx_time_off_requests_dates ON time_off_requests(company_id, start_date, end_date);

-- ==============================================
-- 5. RLS ПОЛИТИКИ
-- ==============================================
ALTER TABLE time_off_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_off_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_off_requests ENABLE ROW LEVEL SECURITY;

-- Типы: все в компании видят, admin/hr создают
CREATE POLICY "toff_types_select" ON time_off_types FOR SELECT USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
);
CREATE POLICY "toff_types_manage" ON time_off_types FOR ALL USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid() AND role IN ('company_admin', 'hr'))
);

-- Лимиты: сотрудник видит свои, admin/hr — все
CREATE POLICY "toff_limits_select" ON time_off_limits FOR SELECT USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  AND (
    user_id = auth.uid()
    OR (SELECT role FROM users WHERE id = auth.uid()) IN ('company_admin', 'hr')
    OR (SELECT is_global_user FROM users WHERE id = auth.uid()) = true
  )
);
CREATE POLICY "toff_limits_manage" ON time_off_limits FOR ALL USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid() AND role IN ('company_admin', 'hr'))
);

-- Заявки: сотрудник видит/создаёт свои, admin/hr — все
CREATE POLICY "toff_requests_select" ON time_off_requests FOR SELECT USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  AND (
    user_id = auth.uid()
    OR (SELECT role FROM users WHERE id = auth.uid()) IN ('company_admin', 'hr')
    OR (SELECT is_global_user FROM users WHERE id = auth.uid()) = true
  )
);
CREATE POLICY "toff_requests_insert" ON time_off_requests FOR INSERT WITH CHECK (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  AND user_id = auth.uid()
);
CREATE POLICY "toff_requests_update" ON time_off_requests FOR UPDATE USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  AND (
    user_id = auth.uid()
    OR (SELECT role FROM users WHERE id = auth.uid()) IN ('company_admin', 'hr')
  )
);

-- ==============================================
-- 6. Дефолтные типы отпусков (вставлять при создании компании)
-- ==============================================
-- При создании новой компании — edge function или триггер создаёт:
-- 1. Urlop wypoczynkowy (Ежегодный отпуск) — оплачиваемый, requires_approval, цвет #4b88fe
-- 2. Zwolnienie lekarskie (Больничный) — оплачиваемый, requires_approval, цвет #ff6b6b
-- 3. Urlop bezpłatny (Неоплачиваемый отпуск) — неоплачиваемый, requires_approval, цвет #868e96
-- 4. Urlop na żądanie (Отпуск по требованию) — оплачиваемый, requires_approval, цвет #ffa94d
-- 5. Delegacja (Командировка) — оплачиваемый, requires_approval, цвет #51cf66
```

### E.4 TypeScript типы

Добавить в `types.ts`:

```typescript
// === МОДУЛЬ 2: Отпуска и отсутствия ===

export type TimeOffRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface TimeOffType {
  id: string;
  company_id: string;
  name: string;
  color: string;
  icon: string;
  is_paid: boolean;
  requires_approval: boolean;
  allows_half_day: boolean;
  allows_hourly: boolean;
  is_archived: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface TimeOffLimit {
  id: string;
  company_id: string;
  user_id: string;
  time_off_type_id: string;
  year: number;
  total_days: number;
  used_days: number;
  carried_over_days: number;
  created_at: string;
  updated_at: string;
  // Joins
  time_off_type?: TimeOffType;
  user?: User;
}

export interface TimeOffRequest {
  id: string;
  company_id: string;
  user_id: string;
  time_off_type_id: string;
  start_date: string;
  end_date: string;
  all_day: boolean;
  start_time?: string;
  end_time?: string;
  hourly: boolean;
  amount: number;
  status: TimeOffRequestStatus;
  note_worker?: string;
  note_reviewer?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
  // Joins
  time_off_type?: TimeOffType;
  user?: User;
  reviewer?: User;
}
```

### E.5 UI — Страницы

#### E.5.1 Страница "Мои отпуска" (для всех ролей компании)

**Путь:** `/employee/time-off` (новая страница)
**Доступ:** все роли (видят своё)

**Элементы:**
- **Карточки остатков** — для каждого типа отпуска: лимит | использовано | осталось | перенесено
- **Кнопка "Подать заявку"** — открывает модальное окно:
  - Тип отпуска (dropdown из time_off_types)
  - Дата начала (date picker)
  - Дата окончания (date picker)
  - Чекбокс "Полный день" / "Часть дня"
  - Если часть дня: time pickers начало/конец
  - Автоподсчёт дней (amount)
  - Комментарий (textarea)
  - Кнопка "Отправить"
- **Список моих заявок** — таблица:
  - Тип | Даты | Дней | Статус (бейдж: pending=жёлтый, approved=зелёный, rejected=красный) | Дата подачи
  - Кнопка "Отменить" для pending заявок

#### E.5.2 Страница "Управление отпусками" (для COMPANY_ADMIN, HR, COORDINATOR, BRIGADIR)

**Путь:** `/company/time-off` (новая страница)
**Доступ:** COMPANY_ADMIN, HR (все заявки), COORDINATOR (заявки своего объекта), BRIGADIR (заявки своей бригады)

**Вкладки:**

**Вкладка "Заявки":**
- Фильтры: статус (pending/approved/rejected/all), сотрудник, тип отпуска, период
- Таблица: Сотрудник | Тип | Даты | Дней | Статус | Комментарий | Действия
- Кнопки: "Одобрить" / "Отклонить" для каждой pending заявки
- Массовые действия: чекбоксы + "Одобрить выбранные" / "Отклонить выбранные"

**Вкладка "Календарь":**
- Месячный календарь (grid по дням)
- Каждый день показывает кто отсутствует (цветные метки по типу отпуска)
- Навигация по месяцам
- Фильтр по объекту

**Вкладка "Лимиты":**
- Выбор года (dropdown)
- Таблица: Сотрудник | Тип отпуска | Лимит | Использовано | Остаток | Перенесено
- Редактирование лимита inline (click-to-edit на поле "Лимит")
- Кнопка "Установить лимиты для всех" — массовая установка лимита для типа отпуска
- Кнопка "Перенести остатки" — перенос остатка на следующий год (carry-over)

**Вкладка "Типы отпусков":**
- CRUD для типов: Название | Цвет | Оплачиваемый | Требует одобрения | Полдня | Почасовой
- Модальное окно создания/редактирования типа
- Архивация типа (soft delete)

### E.6 Логика одобрения заявки

```typescript
const approveRequest = async (requestId: string) => {
  // 1. Обновить статус заявки
  const { data: request } = await supabase
    .from('time_off_requests')
    .update({
      status: 'approved',
      reviewed_by: currentUser.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .select('*, time_off_type(*)')
    .single();

  // 2. Обновить использованные дни в лимитах
  const year = new Date(request.start_date).getFullYear();
  await supabase.rpc('update_time_off_used_days', {
    p_user_id: request.user_id,
    p_type_id: request.time_off_type_id,
    p_year: year,
  });

  // 3. (Если Модуль 1) Создать/обновить worker_days со статусом 'time_off'
  // для каждого дня в диапазоне start_date..end_date
};
```

### E.7 Навигация

**Для всех ролей компании:**
- Иконка: `CalendarOff` (lucide-react), Текст: "Мои отпуска", Путь: `/employee/time-off`

**Дополнительно для COMPANY_ADMIN, HR, COORDINATOR, BRIGADIR:**
- Иконка: `CalendarDays` (lucide-react), Текст: "Управление отпусками", Путь: `/company/time-off`
- Бейдж с количеством pending заявок

### E.8 Регистрация модуля

```sql
INSERT INTO modules (code, name_pl, name_en, description_pl, available_roles, base_price_per_user, is_active, display_order, icon)
VALUES (
  'time_off',
  'Urlopy i nieobecności',
  'Time Off',
  'Zarządzanie urlopami, zwolnieniami, limitami dni wolnych',
  ARRAY['company_admin', 'hr', 'coordinator', 'brigadir', 'employee'],
  29,
  true,
  4,
  'CalendarOff'
);
```

### E.9 Критерии готовности

- [ ] Таблицы time_off_types, time_off_limits, time_off_requests созданы с RLS
- [ ] Дефолтные типы отпусков создаются при регистрации компании
- [ ] TypeScript типы добавлены
- [ ] Страница "Мои отпуска" — карточки остатков, подача заявки, список заявок
- [ ] Страница "Управление отпусками" — заявки, календарь, лимиты, типы
- [ ] Одобрение/отклонение заявок работает
- [ ] Лимиты редактируются, остаток пересчитывается
- [ ] Перенос остатков (carry-over) работает
- [ ] Навигация в сайдбаре
- [ ] Модуль зарегистрирован

---

## МОДУЛЬ 3: Графики работ (Work Schedule)

### F.1 Описание модуля

Планирование рабочих смен для сотрудников. Администратор/HR создаёт шаблоны графиков (напр. "Утренняя смена 06:00–14:00") и назначает их сотрудникам на конкретные даты. Система отображает кто, когда и в какую смену должен работать.

### F.2 Зависимости

- Таблица `users` (есть)
- Раздел B (Объекты) — опционально
- Модуль 2 (Time Off) — для отображения одобренных отпусков в графике

### F.3 База данных — Миграции

```sql
-- Миграция: create_work_schedule_system

-- 1. Шаблоны смен
CREATE TABLE schedule_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                     -- "Zmiana poranna", "Zmiana nocna"
  start_time TIME NOT NULL,              -- 06:00
  end_time TIME NOT NULL,                -- 14:00
  break_minutes INTEGER DEFAULT 0,       -- Перерыв в минутах
  color TEXT DEFAULT '#4b88fe',
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Назначения графиков (кто, когда, какая смена)
CREATE TABLE schedule_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES schedule_templates(id) ON DELETE SET NULL,
  date DATE NOT NULL,

  -- Если без шаблона — ручное время
  custom_start_time TIME,
  custom_end_time TIME,

  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  note TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, date)
);

-- 3. Индексы
CREATE INDEX idx_schedule_templates_company ON schedule_templates(company_id);
CREATE INDEX idx_schedule_assignments_company_date ON schedule_assignments(company_id, date);
CREATE INDEX idx_schedule_assignments_user_date ON schedule_assignments(user_id, date);

-- 4. RLS
ALTER TABLE schedule_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sched_templates_select" ON schedule_templates FOR SELECT USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
);
CREATE POLICY "sched_templates_manage" ON schedule_templates FOR ALL USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid() AND role IN ('company_admin', 'hr', 'coordinator'))
);

CREATE POLICY "sched_assignments_select" ON schedule_assignments FOR SELECT USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  AND (
    user_id = auth.uid()
    OR (SELECT role FROM users WHERE id = auth.uid()) IN ('company_admin', 'hr', 'coordinator')
    OR (SELECT is_global_user FROM users WHERE id = auth.uid()) = true
  )
);
CREATE POLICY "sched_assignments_manage" ON schedule_assignments FOR ALL USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid() AND role IN ('company_admin', 'hr', 'coordinator'))
);
```

### F.4 TypeScript типы

```typescript
// === МОДУЛЬ 3: Графики работ ===

export interface ScheduleTemplate {
  id: string;
  company_id: string;
  name: string;
  start_time: string;  // "HH:MM"
  end_time: string;
  break_minutes: number;
  color: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScheduleAssignment {
  id: string;
  company_id: string;
  user_id: string;
  template_id?: string;
  date: string;
  custom_start_time?: string;
  custom_end_time?: string;
  department_id?: string;
  note?: string;
  created_at: string;
  updated_at: string;
  // Joins
  template?: ScheduleTemplate;
  user?: User;
  department?: Department;
}
```

### F.5 UI — Страницы

#### F.5.1 Страница "Мой график" (для всех)

**Путь:** `/employee/schedule`
**Элементы:**
- Еженедельный/месячный календарь с назначенными сменами
- Каждая ячейка: шаблон (название + время) или кастомное время, цветовой код
- Отпуска отображаются отдельным цветом (если Модуль 2)
- Навигация по неделям/месяцам

#### F.5.2 Страница "Планирование графиков" (для COMPANY_ADMIN, HR, COORDINATOR)

**Путь:** `/company/schedules`

**Вкладки:**

**Вкладка "График":**
- Еженедельный/месячный вид
- Строки = сотрудники, Столбцы = дни
- Каждая ячейка — назначенная смена (кликабельная)
- Drag-and-drop назначение шаблона на ячейку
- Клик по ячейке → dropdown выбор шаблона или "Нет смены"
- Фильтры: по объекту, по сотруднику
- Кнопка "Копировать неделю" — копировать текущую неделю на следующую
- Кнопка "Применить шаблон" — назначить один шаблон всем/выбранным на период

**Вкладка "Шаблоны смен":**
- CRUD шаблонов: Название | Начало | Конец | Перерыв | Цвет
- Модальное окно создания/редактирования

### F.6 Навигация

**Для всех ролей:** Иконка: `CalendarClock`, Текст: "Мой график", Путь: `/employee/schedule`
**Для COMPANY_ADMIN, HR, COORDINATOR:** Иконка: `CalendarRange`, Текст: "Графики", Путь: `/company/schedules`

### F.7 Регистрация модуля

```sql
INSERT INTO modules (code, name_pl, name_en, description_pl, available_roles, base_price_per_user, is_active, display_order, icon)
VALUES (
  'work_schedule',
  'Grafik pracy',
  'Work Schedule',
  'Planowanie zmian, szablony grafików, przypisania pracowników',
  ARRAY['company_admin', 'hr', 'coordinator', 'brigadir', 'employee'],
  39,
  true,
  5,
  'CalendarRange'
);
```

### F.8 Критерии готовности

- [ ] Таблицы schedule_templates и schedule_assignments с RLS
- [ ] TypeScript типы
- [ ] Страница "Мой график" — календарь с назначенными сменами
- [ ] Страница "Планирование графиков" — сетка сотрудники×дни, шаблоны
- [ ] CRUD шаблонов смен
- [ ] Назначение смен через UI
- [ ] Копирование недели
- [ ] Навигация в сайдбаре
- [ ] Модуль зарегистрирован

---

## МОДУЛЬ 4: Проекты (Tasks & Projects)

### G.1 Описание модуля

Управление задачами и проектами с привязкой к сотрудникам и отслеживанием времени. Проекты содержат задачи, задачи назначаются сотрудникам, время по задачам логируется.

### G.2 Зависимости

- Таблица `users` (есть)
- Таблица `companies` (есть)
- Модуль 1 (опционально) — для привязки залогированного времени к задачам

### G.3 База данных — Миграции

```sql
-- Миграция: create_tasks_projects_system

-- 1. Клиенты (заказчики проектов)
CREATE TABLE project_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  note TEXT,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Проекты
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES project_customers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',           -- 'active', 'completed', 'archived', 'on_hold'
  color TEXT DEFAULT '#4b88fe',
  budget_hours NUMERIC(10,1),             -- Бюджет в часах
  budget_amount NUMERIC(12,2),            -- Бюджет в деньгах
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Участники проекта
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',             -- 'manager', 'member'
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- 4. Задачи
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo',             -- 'todo', 'in_progress', 'review', 'done', 'cancelled'
  priority TEXT DEFAULT 'medium',         -- 'low', 'medium', 'high', 'urgent'
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id),
  due_date DATE,
  estimated_hours NUMERIC(6,1),
  tags TEXT[],                            -- Теги
  is_archived BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Логирование времени по задачам
CREATE TABLE task_time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  minutes INTEGER NOT NULL,               -- Залогированное время в минутах
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Вложения к задачам
CREATE TABLE task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Индексы
CREATE INDEX idx_projects_company ON projects(company_id, status);
CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);
CREATE INDEX idx_tasks_company ON tasks(company_id, status);
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX idx_task_time_logs_task ON task_time_logs(task_id);
CREATE INDEX idx_task_time_logs_user ON task_time_logs(user_id, date);
CREATE INDEX idx_project_customers_company ON project_customers(company_id);

-- 8. RLS
ALTER TABLE project_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;

-- Сотрудники видят проекты/задачи своей компании,
-- но EMPLOYEE только те, к которым назначен
CREATE POLICY "projects_select" ON projects FOR SELECT USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
);
CREATE POLICY "projects_manage" ON projects FOR ALL USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid() AND role IN ('company_admin', 'hr', 'coordinator'))
);

CREATE POLICY "tasks_select" ON tasks FOR SELECT USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  AND (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR (SELECT role FROM users WHERE id = auth.uid()) IN ('company_admin', 'hr', 'coordinator')
    OR (SELECT is_global_user FROM users WHERE id = auth.uid()) = true
  )
);
CREATE POLICY "tasks_manage" ON tasks FOR ALL USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
);

CREATE POLICY "time_logs_select" ON task_time_logs FOR SELECT USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
);
CREATE POLICY "time_logs_manage" ON task_time_logs FOR ALL USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
);

CREATE POLICY "customers_select" ON project_customers FOR SELECT USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
);
CREATE POLICY "customers_manage" ON project_customers FOR ALL USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid() AND role IN ('company_admin', 'hr', 'coordinator'))
);

CREATE POLICY "members_select" ON project_members FOR SELECT USING (
  project_id IN (SELECT id FROM projects WHERE company_id = (SELECT company_id FROM users WHERE id = auth.uid()))
);
CREATE POLICY "members_manage" ON project_members FOR ALL USING (
  project_id IN (SELECT id FROM projects WHERE company_id = (SELECT company_id FROM users WHERE id = auth.uid() AND role IN ('company_admin', 'hr', 'coordinator')))
);

CREATE POLICY "attachments_select" ON task_attachments FOR SELECT USING (
  task_id IN (SELECT id FROM tasks WHERE company_id = (SELECT company_id FROM users WHERE id = auth.uid()))
);
CREATE POLICY "attachments_manage" ON task_attachments FOR ALL USING (
  task_id IN (SELECT id FROM tasks WHERE company_id = (SELECT company_id FROM users WHERE id = auth.uid()))
);
```

### G.4 TypeScript типы

```typescript
// === МОДУЛЬ 4: Проекты ===

export type ProjectStatus = 'active' | 'completed' | 'archived' | 'on_hold';
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface ProjectCustomer {
  id: string;
  company_id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  note?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  company_id: string;
  customer_id?: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  color: string;
  budget_hours?: number;
  budget_amount?: number;
  start_date?: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
  // Joins
  customer?: ProjectCustomer;
  members?: ProjectMember[];
  tasks_count?: number;
  logged_hours?: number;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: 'manager' | 'member';
  added_at: string;
  user?: User;
}

export interface ProjectTask {
  id: string;
  company_id: string;
  project_id?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to?: string;
  created_by?: string;
  due_date?: string;
  estimated_hours?: number;
  tags?: string[];
  is_archived: boolean;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  // Joins
  project?: Project;
  assignee?: User;
  creator?: User;
  time_logs?: TaskTimeLog[];
  attachments?: TaskAttachment[];
  total_logged_minutes?: number;
}

export interface TaskTimeLog {
  id: string;
  company_id: string;
  task_id: string;
  user_id: string;
  date: string;
  minutes: number;
  description?: string;
  created_at: string;
  user?: User;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  file_url: string;
  file_name: string;
  file_size?: number;
  uploaded_by?: string;
  created_at: string;
}
```

### G.5 UI — Страницы

#### G.5.1 "Мои задачи" (для всех ролей)

**Путь:** `/employee/tasks`
- Список задач назначенных текущему пользователю
- Фильтры: статус, приоритет, проект
- Kanban-доска (todo → in_progress → review → done)
- Клик по задаче → детальная страница

#### G.5.2 "Проекты" (для COMPANY_ADMIN, HR, COORDINATOR)

**Путь:** `/company/projects`
- Список проектов: Название | Клиент | Статус | Бюджет | Прогресс | Действия
- Кнопка "Создать проект"
- Клик по проекту → детали проекта:
  - Вкладка "О проекте" — описание, клиент, бюджет, участники
  - Вкладка "Задачи" — список задач проекта (kanban или таблица)
  - Вкладка "Время" — залогированное время по задачам и сотрудникам
  - Вкладка "Файлы" — вложения задач проекта

#### G.5.3 "Задачи" (для COMPANY_ADMIN, HR, COORDINATOR, BRIGADIR)

**Путь:** `/company/tasks`
- Все задачи компании (все проекты + без проекта)
- Kanban-доска или таблица (переключение)
- Фильтры: проект, сотрудник, статус, приоритет, срок
- Создание задачи через модальное окно:
  - Название, Описание, Проект (dropdown), Назначить (dropdown), Приоритет, Срок, Оценка часов, Теги

#### G.5.4 "Клиенты" (для COMPANY_ADMIN, HR, COORDINATOR)

**Путь:** `/company/customers`
- CRUD клиентов: Название | Email | Телефон | Проектов | Действия

### G.6 Навигация

**Для всех:** Иконка: `CheckSquare`, Текст: "Мои задачи", Путь: `/employee/tasks`
**Для COMPANY_ADMIN, HR, COORDINATOR:**
- Иконка: `FolderKanban`, Текст: "Проекты", Путь: `/company/projects`
- Иконка: `ListTodo`, Текст: "Все задачи", Путь: `/company/tasks`

### G.7 Регистрация модуля

```sql
INSERT INTO modules (code, name_pl, name_en, description_pl, available_roles, base_price_per_user, is_active, display_order, icon)
VALUES (
  'tasks_projects',
  'Zadania i projekty',
  'Tasks & Projects',
  'Zarządzanie zadaniami, projektami, klientami, logowanie czasu',
  ARRAY['company_admin', 'hr', 'coordinator', 'brigadir', 'employee'],
  39,
  true,
  6,
  'FolderKanban'
);
```

### G.8 Критерии готовности

- [ ] Таблицы projects, project_members, tasks, task_time_logs, task_attachments, project_customers с RLS
- [ ] TypeScript типы
- [ ] Страница "Мои задачи" — kanban + список
- [ ] Страница "Проекты" с деталями
- [ ] Страница "Все задачи" — общий вид
- [ ] CRUD клиентов
- [ ] Логирование времени по задачам
- [ ] Вложения к задачам
- [ ] Навигация в сайдбаре
- [ ] Модуль зарегистрирован

---

## МОДУЛЬ 5: Отчёты и Payroll

### H.1 Описание модуля

Расширение существующей системы отчётов. Генерация табелей (timesheets) на основе данных из Модулей 1, 2, 3. Отчёты по времени и зарплате с учётом ставок, переработок, ночных смен.

### H.2 Зависимости

- Модуль 1 (Time & Attendance) — основные данные по времени
- Модуль 2 (Time Off) — опционально, учёт отпусков в табеле
- Модуль 3 (Work Schedule) — опционально, план vs факт
- Существующая система salary (services/salaryCalculation.ts) — расширяется

### H.3 База данных

```sql
-- Миграция: create_reports_system

-- 1. Сгенерированные табели
CREATE TABLE timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,                 -- 1-12

  -- Агрегированные данные
  total_work_days INTEGER DEFAULT 0,
  total_work_minutes INTEGER DEFAULT 0,
  total_break_minutes INTEGER DEFAULT 0,
  total_overtime_minutes INTEGER DEFAULT 0,
  total_night_minutes INTEGER DEFAULT 0,
  total_weekend_minutes INTEGER DEFAULT 0,
  total_holiday_minutes INTEGER DEFAULT 0,
  total_time_off_days NUMERIC(5,1) DEFAULT 0,

  -- Расчёт зарплаты
  base_salary NUMERIC(10,2) DEFAULT 0,
  overtime_salary NUMERIC(10,2) DEFAULT 0,
  night_salary NUMERIC(10,2) DEFAULT 0,
  weekend_salary NUMERIC(10,2) DEFAULT 0,
  holiday_salary NUMERIC(10,2) DEFAULT 0,
  bonus_salary NUMERIC(10,2) DEFAULT 0,  -- Бонусы от skills
  total_salary NUMERIC(10,2) DEFAULT 0,

  status TEXT DEFAULT 'draft',            -- 'draft', 'confirmed', 'paid'
  confirmed_by UUID REFERENCES users(id),
  confirmed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, year, month)
);

-- 2. Сохранённые отчёты
CREATE TABLE saved_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,                     -- 'attendance', 'time_salary', 'timesheet', 'custom'
  parameters JSONB NOT NULL,              -- Параметры генерации: period, filters, groupBy
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Индексы и RLS
CREATE INDEX idx_timesheets_company ON timesheets(company_id, year, month);
CREATE INDEX idx_timesheets_user ON timesheets(user_id, year, month);
CREATE INDEX idx_saved_reports_company ON saved_reports(company_id);

ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timesheets_select" ON timesheets FOR SELECT USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  AND (
    user_id = auth.uid()
    OR (SELECT role FROM users WHERE id = auth.uid()) IN ('company_admin', 'hr', 'coordinator', 'brigadir')
    OR (SELECT is_global_user FROM users WHERE id = auth.uid()) = true
  )
);
CREATE POLICY "timesheets_manage" ON timesheets FOR ALL USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid() AND role IN ('company_admin', 'hr'))
);

CREATE POLICY "reports_select" ON saved_reports FOR SELECT USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
);
CREATE POLICY "reports_manage" ON saved_reports FOR ALL USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid() AND role IN ('company_admin', 'hr'))
);
```

### H.4 TypeScript типы

```typescript
// === МОДУЛЬ 5: Отчёты и Payroll ===

export type TimesheetStatus = 'draft' | 'confirmed' | 'paid';

export interface Timesheet {
  id: string;
  company_id: string;
  user_id: string;
  year: number;
  month: number;
  total_work_days: number;
  total_work_minutes: number;
  total_break_minutes: number;
  total_overtime_minutes: number;
  total_night_minutes: number;
  total_weekend_minutes: number;
  total_holiday_minutes: number;
  total_time_off_days: number;
  base_salary: number;
  overtime_salary: number;
  night_salary: number;
  weekend_salary: number;
  holiday_salary: number;
  bonus_salary: number;
  total_salary: number;
  status: TimesheetStatus;
  confirmed_by?: string;
  confirmed_at?: string;
  created_at: string;
  updated_at: string;
  user?: User;
}

export interface SavedReport {
  id: string;
  company_id: string;
  name: string;
  type: 'attendance' | 'time_salary' | 'timesheet' | 'custom';
  parameters: Record<string, any>;
  created_by?: string;
  created_at: string;
}
```

### H.5 UI — Страницы

#### H.5.1 Страница "Табели" (для COMPANY_ADMIN, HR, COORDINATOR)

**Путь:** `/company/timesheets`
- Выбор месяца/года
- Кнопка "Сгенерировать табели" — создаёт timesheets для всех сотрудников за выбранный месяц
- Таблица: Сотрудник | Рабочих дней | Часов | Переработка | Ночные | Выходные | База | Бонусы | Итого | Статус
- Клик по строке → детальный табель сотрудника (по дням)
- Кнопки: "Подтвердить все" / "Экспорт Excel" / "Экспорт PDF"

#### H.5.2 Страница "Отчёты" (для COMPANY_ADMIN, HR, COORDINATOR)

**Путь:** `/company/reports`
- **Отчёт "Время и зарплата":**
  - Фильтры: период, объект, сотрудники
  - Таблица с агрегацией по сотрудникам
  - Графики (recharts): время по дням, распределение по объектам
  - Экспорт Excel/PDF

- **Отчёт "Посещаемость":**
  - Фильтры: период, объект
  - Метрики: присутствие, опоздания, отсутствия, больничные
  - Графики

- **Сохранённые отчёты:**
  - Список сохранённых конфигураций
  - Быстрый запуск

### H.6 Навигация

**Для COMPANY_ADMIN, HR, COORDINATOR:**
- Иконка: `FileSpreadsheet`, Текст: "Табели", Путь: `/company/timesheets`
- Иконка: `BarChart3`, Текст: "Отчёты", Путь: `/company/reports`
- COORDINATOR видит данные только по своему объекту

### H.7 Критерии готовности

- [ ] Таблицы timesheets и saved_reports с RLS
- [ ] Генерация табелей (агрегация из worker_days)
- [ ] Расчёт зарплаты с учётом ставок из users
- [ ] Страница табелей с генерацией и экспортом
- [ ] Страница отчётов с графиками
- [ ] Экспорт Excel и PDF

---

## Раздел I: Праздничный календарь

### I.1 Описание

Настройка праздничных дней для компании. Праздники влияют на расчёт рабочих дней, отображаются в графиках и табелях.

### I.2 База данных

```sql
-- Миграция: create_holiday_calendar

CREATE TABLE holiday_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  name TEXT NOT NULL,                     -- "Nowy Rok", "Boże Narodzenie"
  is_recurring BOOLEAN DEFAULT false,     -- Ежегодный (по дате без года)
  country_code TEXT DEFAULT 'PL',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(company_id, date)
);

CREATE INDEX idx_holiday_days_company ON holiday_days(company_id, date);

ALTER TABLE holiday_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "holidays_select" ON holiday_days FOR SELECT USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
);
CREATE POLICY "holidays_manage" ON holiday_days FOR ALL USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid() AND role IN ('company_admin', 'hr'))
);
-- COMPANY_ADMIN и HR имеют полный доступ к настройке праздничных дней

-- Польские праздники по умолчанию (вставлять при создании компании)
-- 1 января — Nowy Rok
-- 6 января — Trzech Króli
-- 1 мая — Święto Pracy
-- 3 мая — Święto Konstytucji 3 Maja
-- 15 августа — Wniebowzięcie NMP
-- 1 ноября — Wszystkich Świętych
-- 11 ноября — Święto Niepodległości
-- 25 декабря — Boże Narodzenie
-- 26 декабря — Drugi dzień Bożego Narodzenia
```

### I.3 TypeScript типы

```typescript
export interface HolidayDay {
  id: string;
  company_id: string;
  date: string;
  name: string;
  is_recurring: boolean;
  country_code: string;
  created_at: string;
}
```

### I.4 UI

Добавить вкладку "Праздники" в настройки компании (`/company/settings`):
- Таблица: Дата | Название | Ежегодный (checkbox) | Действия (удалить)
- Кнопка "Добавить праздник" → date picker + название
- Кнопка "Загрузить польские праздники на [год]" — вставить стандартные

### I.5 Критерии готовности

- [ ] Таблица holiday_days с RLS
- [ ] Вкладка "Праздники" в настройках компании
- [ ] CRUD праздничных дней
- [ ] Дефолтные польские праздники при создании компании
- [ ] Интеграция с Модулями 1, 3, 5 (пометка дней как holiday)

---

## Раздел J: Центр уведомлений (Notification Hub)

### J.1 Описание

Расширение существующей системы уведомлений. Централизованный хаб с историей всех уведомлений, статусом прочтения, фильтрацией. Новые типы уведомлений для Модулей 1–5.

### J.2 Зависимости

- Существующая таблица уведомлений (расширяется)
- Все модули (1–5) генерируют уведомления

### J.3 База данных

```sql
-- Миграция: create_notification_hub

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  type TEXT NOT NULL,
  -- Типы уведомлений:
  -- attendance_reminder: напоминание об отметке
  -- day_request_new: новая заявка на изменение дня
  -- day_request_approved: заявка одобрена
  -- day_request_rejected: заявка отклонена
  -- time_off_new: новая заявка на отпуск
  -- time_off_approved: отпуск одобрен
  -- time_off_rejected: отпуск отклонён
  -- schedule_updated: график обновлён
  -- task_assigned: задача назначена
  -- task_status_changed: статус задачи изменён
  -- task_comment: комментарий к задаче
  -- timesheet_ready: табель сформирован
  -- general: общее уведомление

  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,                              -- URL для перехода
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,

  -- Метаданные
  entity_type TEXT,                       -- 'worker_day_request', 'time_off_request', 'task', etc.
  entity_id UUID,                         -- ID связанной сущности

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_company ON notifications(company_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (
  user_id = auth.uid()
);
CREATE POLICY "notifications_update" ON notifications FOR UPDATE USING (
  user_id = auth.uid()
);
```

### J.4 TypeScript типы

```typescript
export type NotificationType_Hub =
  | 'attendance_reminder' | 'day_request_new' | 'day_request_approved' | 'day_request_rejected'
  | 'time_off_new' | 'time_off_approved' | 'time_off_rejected'
  | 'schedule_updated' | 'task_assigned' | 'task_status_changed' | 'task_comment'
  | 'timesheet_ready' | 'general';

export interface NotificationHub {
  id: string;
  company_id: string;
  user_id: string;
  type: NotificationType_Hub;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  read_at?: string;
  entity_type?: string;
  entity_id?: string;
  created_at: string;
}
```

### J.5 UI

**Компонент NotificationBell (уже частично есть в AppLayout):**
- Иконка колокольчика в header
- Бейдж с количеством непрочитанных
- Dropdown со списком последних 10 уведомлений
- Кнопка "Все уведомления" → страница `/notifications`

**Страница "/notifications":**
- Полный список уведомлений с пагинацией
- Фильтры: тип, прочитанные/непрочитанные
- Кнопка "Отметить все как прочитанные"
- Клик по уведомлению → переход по link + отметка как прочитано

**Supabase Realtime подписка:**
```typescript
supabase.channel('notifications')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: `user_id=eq.${userId}`,
  }, (payload) => {
    addNotification(payload.new as NotificationHub);
    incrementUnreadCount();
  })
  .subscribe();
```

### J.6 Генерация уведомлений

Уведомления создаются серверным кодом (edge functions или triggers) при:
- Модуль 1: новая заявка на изменение дня → уведомление admin/hr. Одобрение/отклонение → уведомление сотруднику.
- Модуль 2: новая заявка на отпуск → уведомление admin/hr. Одобрение/отклонение → уведомление сотруднику.
- Модуль 3: обновление графика → уведомление затронутых сотрудников.
- Модуль 4: назначение задачи → уведомление исполнителю. Изменение статуса → уведомление создателю.
- Модуль 5: табель сформирован → уведомление сотруднику.

### J.7 Критерии готовности

- [ ] Таблица notifications с RLS
- [ ] TypeScript типы
- [ ] Компонент NotificationBell с dropdown
- [ ] Страница /notifications с полным списком
- [ ] Realtime подписка на новые уведомления
- [ ] Генерация уведомлений из Модулей 1–5
- [ ] Отметка как прочитанное (одиночно и массово)

---

## ИТОГО: ПОЛНАЯ КАРТА ВНЕДРЕНИЯ

| Раздел / Модуль | Таблицы БД | Новые страницы | Приоритет |
|---|---|---|---|
| Раздел A. Настройки рабочего времени | 0 (расширение companies) | 0 (расширение settings) | 1 - Фундамент |
| Раздел B. Объекты с иерархией | 2 (departments, department_members) | 2 (список, детали) | 1 - Фундамент |
| МОДУЛЬ 1. Учёт рабочего времени | 6 (worker_days, entries, activities, actions, requests, states) | 2 (мой день, посещаемость) | 2 - Ядро |
| Раздел D. Дашборд "Команда сейчас" | 0 (использует worker_states) | 1 (team-now) | 2 - Ядро |
| МОДУЛЬ 2. Отпуска | 3 (types, limits, requests) | 2 (мои отпуска, управление) | 3 - Расширение |
| МОДУЛЬ 3. Графики работ | 2 (templates, assignments) | 2 (мой график, планирование) | 3 - Расширение |
| МОДУЛЬ 4. Проекты | 6 (customers, projects, members, tasks, time_logs, attachments) | 4 (задачи, проекты, клиенты, детали) | 3 - Расширение |
| МОДУЛЬ 5. Отчёты и Payroll | 2 (timesheets, saved_reports) | 2 (табели, отчёты) | 4 - Продвинутый |
| Раздел I. Праздничный календарь | 1 (holiday_days) | 0 (вкладка в settings) | 4 - Продвинутый |
| Раздел J. Центр уведомлений | 1 (notifications) | 1 (уведомления) | 4 - Продвинутый |
| **ИТОГО** | **23 таблицы** | **16 страниц** | |

---

*Документ создан на основе анализа портала Moniti (web.moniti.app) и проекта MaxMaster-Skill_Platform. Январь 2026.*
