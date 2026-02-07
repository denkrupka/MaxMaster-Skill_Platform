<analysis>

# ПРЕДВАРИТЕЛЬНЫЙ АНАЛИЗ

## 1. Полный список функций референсных порталов

### GECTARO (Россия, СНГ - полнофункциональное строительное сметирование)
1. Управление компанией (настройки, логотип, валюта)
2. Тарифы и биллинг (SaaS-модель)
3. Управление сотрудниками (приглашения, роли)
4. RBAC система прав (owner, manager, employee + кастомные)
5. Папки проектов (иерархия, цветовая маркировка)
6. Проекты (CRUD, статусы, копирование)
7. **Сметирование** - КЛЮЧЕВОЙ модуль:
   - Разделы сметы (stages)
   - Работы (tasks)
   - Ресурсы (resources): работы, материалы, механизмы, накладные
   - Наценки (markups), НДС
   - Расчёт стоимости (cost, cost_with_markup)
8. Справочник расценок (иерархический)
9. Справочник операций
10. Единицы измерения
11. Контрагенты (CRUD, реквизиты, группы)
12. **График Ганта** (зависимости, экспорт XLSX)
13. Заявки на ресурсы (контроль бюджета)
14. Заказы поставщикам (статусы доставки)
15. Склад (поступление, списание, остатки)
16. Акты выполненных работ (КС-6а)
17. Финансы (платежи, счета)
18. Статистика и аналитика (15+ отчётов)
19. Задачи/Поручения (таск-менеджер)
20. Журнал строительства
21. Шаблоны документов
22. Комментарии к ресурсам
23. Экспорт (XLSX, PDF, CSV)

### SCCOT (Польша - коммерческие предложения и сметирование)
1. Дашборд с виджетами (проекты, контрагенты, заметки, cashflow)
2. **Офферы (коммерческие предложения)** - КЛЮЧЕВОЙ модуль:
   - 5 типов вкладок (описания, расценки)
   - Секции и закладки
   - Работы, материалы, оборудование
   - Связанные позиции (Labour с workers, materials, equipments)
   - Ведомости (sheets) с хеш-адресацией
   - Сводки (summaries)
   - Настройки печати
   - Библиотека шаблонов
   - Варианты офферов
   - Онлайн-офферы с PDF
3. Проекты с финансовой аналитикой:
   - Прогнозы (prognosies)
   - Фактические финансы
   - Расчёты (settlements)
   - Доходы, затраты, прибыль
4. Контрагенты (физ./юр. лица, NIP, GUS-интеграция)
5. **Тикеты/Задачи** (Kanban-доска)
6. RMS справочники (системные + пользовательские):
   - Работы (labours)
   - Материалы (materials)
   - Оборудование (equipments)
7. Теги для категоризации
8. Заметки (Notes)
9. Глобальный поиск
10. Real-time (WebSocket, presence channels)
11. CASL права доступа
12. Stripe-биллинг
13. Freemium-модель с лимитами

### PLANRADAR (Австрия/международный - управление задачами и дефектами)
1. **Задачи/Тикеты/Дефекты** - КЛЮЧЕВОЙ модуль:
   - Кастомные типы задач (forms)
   - Кастомные поля (JSONB)
   - Статусы, приоритеты
   - Подзадачи (иерархия)
   - Комментарии, журнал изменений
   - Вложения, фото
   - Электронные подписи
   - Блокировка редактирования (optimistic locking)
   - Повторяющиеся напоминания
   - Режимы отображения: таблица, карточки, календарь, план, Гант
2. Проекты:
   - Участники (memberships)
   - Роли
   - Рабочие дни (праздники по странам)
   - Копирование с опциями
   - AI-сводки
3. **Чертежи/Планы**:
   - Компоненты (этажи/секции)
   - Маркеры задач на плане
   - Аннотации (markups)
   - Калибровка масштаба
   - Версионирование
4. **DMS (документооборот)**:
   - Иерархическая файловая структура
   - Версионирование файлов
   - Чанковая загрузка
   - Права доступа на файлы
   - Логи активности
   - WOPI (Office Online)
5. **Диаграмма Ганта**:
   - Задачи с датами
   - Зависимости
   - Автоматическое планирование
   - Прогресс
6. **Конструктор отчётов**:
   - Шаблоны с токенами
   - WYSIWYG-редактор (Froala)
   - PDF-генерация
7. **Полевые отчёты** (Site Reports)
8. **Дашборды и статистика**
9. **Согласования** (Approval Workflows)
10. Управление пользователями и ролями
11. Фильтрация и сохранённые фильтры
12. Экспорт (PDF, XLSX, BCF, CSV)
13. Импорт (BCF, CSV, пользователи)
14. Уведомления и WebSocket
15. AI-ассистент
16. Онбординг-мастер

## 2. Функции для ElektroSmeta (предположительно существующие)

На основе названия проекта (ЭлектроСмета) предполагается специализация на электромонтажных работах:
- Базовое сметирование электромонтажных работ
- Базовые справочники (кабели, оборудование, работы)
- Авторизация пользователей
- Базовые роли (возможно: Администратор, Сметчик)
- Базовый экспорт смет

## 3. Лучшие практики из анализа порталов

| Аспект | Лучшая практика | Источник |
|--------|-----------------|----------|
| **Сметирование** | Иерархия: Раздел → Работа → Ресурсы с inline-редактированием | Gectaro |
| **Офферы** | Шаблоны + варианты + онлайн-просмотр с PDF | SCCOT |
| **Задачи** | Кастомные типы/поля + подзадачи + множество режимов просмотра | PlanRadar |
| **Документооборот** | Иерархия папок + версионирование + чанковая загрузка | PlanRadar |
| **Планы/чертежи** | Маркеры задач + аннотации + версионирование | PlanRadar |
| **График** | Гант с зависимостями и автопланированием | PlanRadar + Gectaro |
| **Отчёты** | Конструктор с токенами + WYSIWYG | PlanRadar |
| **Права** | RBAC с проектным скоупом + гранулярные permissions | Gectaro |
| **Real-time** | WebSocket для совместной работы | SCCOT + PlanRadar |
| **Финансы** | План-факт + cashflow + прогнозы | SCCOT + Gectaro |

## 4. Группировка недостающего функционала в модули

### МОДУЛЬ 1: Ядро системы (Core)
- Мультитенантная архитектура
- Управление компаниями
- RBAC система прав
- Аутентификация (сессии + 2FA)

### МОДУЛЬ 2: Управление проектами
- CRUD проектов
- Папки проектов (иерархия)
- Статусы проектов
- Участники проекта
- Копирование проектов

### МОДУЛЬ 3: Сметирование (расширенное)
- Разделы → Работы → Ресурсы
- Справочники (расценки, операции, единицы)
- Наценки и НДС
- Inline-редактирование
- Drag & Drop

### МОДУЛЬ 4: Коммерческие предложения (Офферы)
- Создание офферов
- Шаблоны офферов
- Варианты офферов
- Ведомости материалов
- Онлайн-просмотр и PDF

### МОДУЛЬ 5: Контрагенты
- CRUD контрагентов
- Типы (физ./юр. лица)
- Реквизиты
- Группы
- Интеграция с госреестрами

### МОДУЛЬ 6: Задачи и дефекты
- Кастомные типы задач
- Кастомные поля
- Статусы и приоритеты
- Подзадачи
- Комментарии и история
- Вложения

### МОДУЛЬ 7: Чертежи и планы
- Загрузка чертежей
- Компоненты (этажи)
- Маркеры задач
- Аннотации
- Версионирование

### МОДУЛЬ 8: Документооборот (DMS)
- Файловая структура
- Версионирование
- Права доступа
- Поиск
- Логи активности

### МОДУЛЬ 9: Планирование (Гант)
- Диаграмма Ганта
- Зависимости задач
- Автопланирование
- Экспорт

### МОДУЛЬ 10: Финансы
- Платежи
- Акты выполненных работ
- План-факт
- Cashflow

### МОДУЛЬ 11: Закупки и склад
- Заявки на ресурсы
- Заказы поставщикам
- Складской учёт
- Контроль бюджета

### МОДУЛЬ 12: Отчётность
- Конструктор отчётов
- Шаблоны с токенами
- Экспорт (PDF, XLSX)
- Дашборды

### МОДУЛЬ 13: Согласования
- Workflow-шаблоны
- Запросы на согласование
- Уведомления

### МОДУЛЬ 14: Настройки и интеграции
- Профиль пользователя
- Настройки компании
- Локализация
- Внешние интеграции

### МОДУЛЬ 15: Биллинг (SaaS)
- Тарифные планы
- Подписки
- Платежи

## 5. Анализ ролей и прав доступа

### Роли в референсных системах:

**Gectaro:**
- Owner (владелец)
- Manager (менеджер)
- Employee (сотрудник)
- + кастомные роли

**SCCOT:**
- Subscriber (подписчик/владелец)
- Team member (член команды)
- + права по ресурсам (offers, projects, clients, tasks, rms, accounts, payments, settings)

**PlanRadar:**
- Admin
- Manager
- Worker
- Subcontractor
- Observer
- + кастомные роли с проектным скоупом

### Предлагаемые роли для ElektroSmeta:

| Роль | Описание | Базовые права |
|------|----------|---------------|
| **Администратор системы** | Полный контроль | Всё |
| **Владелец компании** | Управление компанией | Компания, биллинг, пользователи |
| **Руководитель проектов** | Управление проектами | Проекты, задачи, отчёты |
| **Инженер-сметчик** | Работа со сметами | Сметы, офферы, справочники |
| **Прораб/Исполнитель** | Выполнение задач | Задачи, журнал, чертежи |
| **Субподрядчик** | Ограниченный доступ | Назначенные задачи |
| **Наблюдатель** | Только чтение | Просмотр без редактирования |
| **Бухгалтер** | Финансы | Финансы, акты, отчёты |

## 6. Зависимости между модулями

```
МОДУЛЬ 1 (Ядро) ─────────────────────────────────────────────────►
       │
       ▼
МОДУЛЬ 2 (Проекты) ──────────────────────────────────────────────►
       │                │                │
       ▼                ▼                ▼
МОДУЛЬ 3 (Сметы)   МОДУЛЬ 5 (Контр.)  МОДУЛЬ 6 (Задачи)
       │                │                │
       ├────────────────┼────────────────┤
       ▼                ▼                ▼
МОДУЛЬ 4 (Офферы)  МОДУЛЬ 10 (Финансы)  МОДУЛЬ 7 (Чертежи)
       │                │                │
       ├────────────────┴────────────────┤
       ▼                                 ▼
МОДУЛЬ 11 (Закупки)              МОДУЛЬ 8 (DMS)
       │                                 │
       ├─────────────────────────────────┤
       ▼                                 ▼
МОДУЛЬ 9 (Гант)               МОДУЛЬ 12 (Отчёты)
       │                                 │
       ├─────────────────────────────────┤
       ▼
МОДУЛЬ 13 (Согласования)
       │
       ▼
МОДУЛЬ 14 (Настройки) ◄──── МОДУЛЬ 15 (Биллинг)
```

## 7. Оптимальная последовательность внедрения

### Фаза 1 — MVP (3-4 месяца)
1. **МОДУЛЬ 1**: Ядро системы
2. **МОДУЛЬ 2**: Управление проектами
3. **МОДУЛЬ 3**: Сметирование (расширенное)
4. **МОДУЛЬ 5**: Контрагенты

### Фаза 2 — Базовый функционал (2-3 месяца)
5. **МОДУЛЬ 4**: Коммерческие предложения
6. **МОДУЛЬ 6**: Задачи и дефекты
7. **МОДУЛЬ 10**: Финансы (базово)

### Фаза 3 — Документооборот (2 месяца)
8. **МОДУЛЬ 8**: Документооборот
9. **МОДУЛЬ 7**: Чертежи и планы

### Фаза 4 — Планирование (2 месяца)
10. **МОДУЛЬ 9**: Диаграмма Ганта
11. **МОДУЛЬ 11**: Закупки и склад

### Фаза 5 — Отчётность и автоматизация (2 месяца)
12. **МОДУЛЬ 12**: Отчётность
13. **МОДУЛЬ 13**: Согласования

### Фаза 6 — Завершение (1-2 месяца)
14. **МОДУЛЬ 14**: Настройки и интеграции
15. **МОДУЛЬ 15**: Биллинг

### ИСКЛЮЧЕНИЯ (по требованию):
- BIM-модели
- 3D-модели
- 360-панорамы

</analysis>

---

<technical_specification>

# ТЕХНИЧЕСКОЕ ЗАДАНИЕ
# Проект: ElektroSmeta v2.0
# Интеграция функционала из Gectaro, SCCOT, PlanRadar

**Версия документа:** 2.0  
**Дата:** 07.02.2026  
**Статус:** Проект  

---

# 1. EXECUTIVE SUMMARY (Краткое резюме)

## 1.1 Общий обзор проекта

Настоящее техническое задание определяет требования к расширению функционала системы ElektroSmeta путём интеграции лучших практик и функций из трёх референсных порталов:

- **Gectaro** (Россия) — система строительного сметирования с полным циклом управления проектами
- **SCCOT** (Польша) — SaaS-платформа для коммерческих предложений и сметирования
- **PlanRadar** (Австрия/международный) — система управления строительными дефектами и задачами

## 1.2 Ключевые цели

1. **Расширение сметного функционала** — иерархическая структура смет с inline-редактированием
2. **Коммерческие предложения** — создание и управление офферами с шаблонами
3. **Управление задачами** — полноценный трекер задач и дефектов с кастомными полями
4. **Документооборот** — файловая система с версионированием
5. **Работа с чертежами** — маркеры задач на планах, аннотации
6. **Планирование** — диаграмма Ганта с зависимостями
7. **Финансовый учёт** — план-факт, акты, cashflow
8. **Отчётность** — конструктор отчётов с шаблонами

## 1.3 Общее количество модулей

| № | Модуль | Приоритет | Фаза |
|---|--------|-----------|------|
| 1 | Ядро системы | Критический | 1 |
| 2 | Управление проектами | Критический | 1 |
| 3 | Сметирование | Критический | 1 |
| 4 | Коммерческие предложения | Высокий | 2 |
| 5 | Контрагенты | Критический | 1 |
| 6 | Задачи и дефекты | Высокий | 2 |
| 7 | Чертежи и планы | Высокий | 3 |
| 8 | Документооборот | Высокий | 3 |
| 9 | Планирование (Гант) | Средний | 4 |
| 10 | Финансы | Высокий | 2 |
| 11 | Закупки и склад | Средний | 4 |
| 12 | Отчётность | Средний | 5 |
| 13 | Согласования | Низкий | 5 |
| 14 | Настройки и интеграции | Низкий | 6 |
| 15 | Биллинг | Низкий | 6 |

**Общая оценка:** 15 модулей, ~12-15 месяцев разработки

---

# 2. СРАВНИТЕЛЬНЫЙ АНАЛИЗ

## 2.1 Таблица сравнения функционала

| Функция | Gectaro | SCCOT | PlanRadar | ElektroSmeta (цель) |
|---------|:-------:|:-----:|:---------:|:-------------------:|
| **ПРОЕКТЫ** |
| CRUD проектов | ✅ | ✅ | ✅ | ✅ |
| Папки проектов | ✅ | ❌ | ❌ | ✅ |
| Статусы проектов | ✅ | ✅ | ✅ | ✅ |
| Копирование проектов | ✅ | ❌ | ✅ | ✅ |
| Участники проекта | ✅ | ❌ | ✅ | ✅ |
| **СМЕТИРОВАНИЕ** |
| Иерархия: разделы→работы→ресурсы | ✅ | ✅ | ❌ | ✅ |
| Справочники расценок | ✅ | ✅ | ❌ | ✅ |
| Наценки и НДС | ✅ | ✅ | ❌ | ✅ |
| Inline-редактирование | ✅ | ✅ | ❌ | ✅ |
| **КОММЕРЧЕСКИЕ ПРЕДЛОЖЕНИЯ** |
| Создание офферов | ❌ | ✅ | ❌ | ✅ |
| Шаблоны офферов | ❌ | ✅ | ❌ | ✅ |
| Онлайн-просмотр | ❌ | ✅ | ❌ | ✅ |
| **ЗАДАЧИ** |
| Базовые задачи | ✅ | ✅ | ✅ | ✅ |
| Кастомные типы | ❌ | ❌ | ✅ | ✅ |
| Кастомные поля | ❌ | ❌ | ✅ | ✅ |
| Подзадачи | ❌ | ❌ | ✅ | ✅ |
| История изменений | ❌ | ❌ | ✅ | ✅ |
| **ЧЕРТЕЖИ** |
| Загрузка планов | ❌ | ❌ | ✅ | ✅ |
| Маркеры задач | ❌ | ❌ | ✅ | ✅ |
| Аннотации | ❌ | ❌ | ✅ | ✅ |
| Версионирование | ❌ | ❌ | ✅ | ✅ |
| **ДОКУМЕНТООБОРОТ** |
| Файловая структура | ❌ | ❌ | ✅ | ✅ |
| Версионирование файлов | ❌ | ❌ | ✅ | ✅ |
| Права на файлы | ❌ | ❌ | ✅ | ✅ |
| **ПЛАНИРОВАНИЕ** |
| Диаграмма Ганта | ✅ | ❌ | ✅ | ✅ |
| Зависимости | ✅ | ❌ | ✅ | ✅ |
| **ФИНАНСЫ** |
| Платежи | ✅ | ✅ | ❌ | ✅ |
| Акты | ✅ | ❌ | ❌ | ✅ |
| План-факт | ✅ | ✅ | ❌ | ✅ |
| **ЗАКУПКИ** |
| Заявки | ✅ | ❌ | ❌ | ✅ |
| Заказы | ✅ | ❌ | ❌ | ✅ |
| Склад | ✅ | ❌ | ❌ | ✅ |
| **ОТЧЁТНОСТЬ** |
| Конструктор отчётов | ❌ | ❌ | ✅ | ✅ |
| Экспорт PDF/XLSX | ✅ | ✅ | ✅ | ✅ |
| Дашборды | ✅ | ✅ | ✅ | ✅ |
| **СОГЛАСОВАНИЯ** |
| Workflow | ❌ | ❌ | ✅ | ✅ |
| **ПРОЧЕЕ** |
| Real-time (WebSocket) | ❌ | ✅ | ✅ | ✅ |
| 2FA | ❌ | ❌ | ✅ | ✅ |
| API | ✅ | ✅ | ✅ | ✅ |

## 2.2 Анализ ролей и прав доступа

### 2.2.1 Роли в референсных системах

| Система | Роли |
|---------|------|
| **Gectaro** | Owner, Manager, Employee + кастомные |
| **SCCOT** | Subscriber, Team members (по правам) |
| **PlanRadar** | Admin, Manager, Worker, Subcontractor, Observer + кастомные |

### 2.2.2 Предлагаемые роли для ElektroSmeta

| ID | Роль | Описание | Уровень |
|----|------|----------|---------|
| 1 | **Суперадмин** | Администратор платформы | Системный |
| 2 | **Владелец** | Владелец компании | Компания |
| 3 | **Администратор** | Админ компании | Компания |
| 4 | **Руководитель проектов** | Управление проектами | Проект |
| 5 | **Инженер-сметчик** | Работа со сметами | Проект |
| 6 | **Прораб** | Исполнение на объекте | Проект |
| 7 | **Субподрядчик** | Внешний исполнитель | Проект |
| 8 | **Наблюдатель** | Только просмотр | Проект |
| 9 | **Бухгалтер** | Финансовые операции | Компания |

## 2.3 Карта соответствия ролей

| Действие | Суперадмин | Владелец | Администратор | Рук. проектов | Сметчик | Прораб | Субподр. | Наблюд. | Бухгалтер |
|----------|:----------:|:--------:|:-------------:|:-------------:|:-------:|:------:|:--------:|:-------:|:---------:|
| **Компания** |
| Управление компанией | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Биллинг | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Пользователи | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Проекты** |
| Создание | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Редактирование | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Просмотр | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Свои | ✅ | ✅ |
| Удаление | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Сметы** |
| Создание | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Редактирование | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Просмотр | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Свои | ✅ | ✅ |
| **Офферы** |
| Создание | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Редактирование | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Просмотр | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Задачи** |
| Создание | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Назначение | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Выполнение | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Просмотр | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Свои | ✅ | ❌ |
| **Документы** |
| Загрузка | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Просмотр | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Свои | ✅ | ✅ |
| Удаление | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Финансы** |
| Создание платежей | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Просмотр | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Отчёты | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |

---

# 3. АРХИТЕКТУРА СИСТЕМЫ

## 3.1 Общая архитектурная схема

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          КЛИЕНТСКИЕ ПРИЛОЖЕНИЯ                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ Web SPA     │  │ Mobile PWA │  │ Desktop     │  │ API Clients │    │
│  │ (React)     │  │ (React)    │  │ (Electron)  │  │ (REST)      │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │
└─────────┼────────────────┼────────────────┼────────────────┼───────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ Auth        │  │ Rate        │  │ Load        │  │ Request     │    │
│  │ Middleware  │  │ Limiting    │  │ Balancing   │  │ Validation  │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
          ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ REST API        │    │ WebSocket       │    │ File Service    │
│ Service         │    │ Service         │    │                 │
│ (Node.js)       │    │ (Socket.io)     │    │ (Node.js)       │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                      │
         ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          SERVICE LAYER                                   │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐            │
│  │ Projects  │  │ Estimates │  │ Tasks     │  │ Documents │            │
│  │ Service   │  │ Service   │  │ Service   │  │ Service   │            │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘            │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐            │
│  │ Finance   │  │ Reports   │  │ Users     │  │ Notific.  │            │
│  │ Service   │  │ Service   │  │ Service   │  │ Service   │            │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘            │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ PostgreSQL      │  │ Redis           │  │ S3-compatible   │
│ (Primary DB)    │  │ (Cache/Queue)   │  │ (File Storage)  │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## 3.2 Схема базы данных (ERD)

### 3.2.1 Ядро системы

```sql
-- Таблица: companies (Компании)
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    inn VARCHAR(20),
    kpp VARCHAR(20),
    ogrn VARCHAR(20),
    legal_address TEXT,
    actual_address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(255),
    logo_url VARCHAR(500),
    currency_id INTEGER REFERENCES currencies(id),
    country_id INTEGER REFERENCES countries(id),
    timezone VARCHAR(50) DEFAULT 'Europe/Moscow',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Таблица: users (Пользователи)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    phone VARCHAR(50),
    avatar_url VARCHAR(500),
    language VARCHAR(10) DEFAULT 'ru',
    timezone VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    is_email_verified BOOLEAN DEFAULT FALSE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(255),
    last_login_at TIMESTAMP WITH TIME ZONE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Таблица: company_users (Связь компания-пользователь)
CREATE TABLE company_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id),
    is_owner BOOLEAN DEFAULT FALSE,
    invited_by_id UUID REFERENCES users(id),
    invited_at TIMESTAMP WITH TIME ZONE,
    joined_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending', -- pending, active, suspended
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, user_id)
);

-- Таблица: roles (Роли)
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    level VARCHAR(20) DEFAULT 'project', -- system, company, project
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица: permissions (Права)
CREATE TABLE permissions (
    id SERIAL PRIMARY KEY,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    UNIQUE(resource, action)
);

-- Таблица: role_permissions (Связь роль-право)
CREATE TABLE role_permissions (
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Таблица: sessions (Сессии)
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3.2.2 Проекты

```sql
-- Таблица: project_folders (Папки проектов)
CREATE TABLE project_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES project_folders(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(20) DEFAULT 'gray',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Таблица: projects (Проекты)
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES project_folders(id) ON DELETE SET NULL,
    code VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    full_name TEXT,
    description TEXT,
    address TEXT,
    status_id INTEGER NOT NULL REFERENCES project_statuses(id),
    customer_id UUID REFERENCES contractors(id),
    manager_id UUID REFERENCES users(id),
    start_date DATE,
    end_date DATE,
    budget DECIMAL(15, 2),
    currency_id INTEGER REFERENCES currencies(id),
    settings JSONB DEFAULT '{}',
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Таблица: project_statuses (Статусы проектов)
CREATE TABLE project_statuses (
    id SERIAL PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20) DEFAULT 'gray',
    is_default BOOLEAN DEFAULT FALSE,
    is_closed BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0
);

-- Таблица: project_members (Участники проекта)
CREATE TABLE project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id),
    added_by_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);
```

### 3.2.3 Сметирование

```sql
-- Таблица: unit_measures (Единицы измерения)
CREATE TABLE unit_measures (
    id SERIAL PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_system BOOLEAN DEFAULT FALSE
);

-- Таблица: valuation_groups (Группы расценок)
CREATE TABLE valuation_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES valuation_groups(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица: valuations (Расценки)
CREATE TABLE valuations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES valuation_groups(id) ON DELETE CASCADE,
    code VARCHAR(50),
    name VARCHAR(500) NOT NULL,
    description TEXT,
    unit_measure_id INTEGER REFERENCES unit_measures(id),
    price DECIMAL(15, 4) DEFAULT 0,
    resource_type INTEGER DEFAULT 1, -- 1=работа, 2=материал, 3=механизм, 5=накладные
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица: estimate_stages (Разделы сметы)
CREATE TABLE estimate_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES estimate_stages(id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    code VARCHAR(50),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица: estimate_tasks (Работы сметы)
CREATE TABLE estimate_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id UUID NOT NULL REFERENCES estimate_stages(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES estimate_tasks(id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    code VARCHAR(50),
    volume DECIMAL(15, 4) DEFAULT 0,
    unit_measure_id INTEGER REFERENCES unit_measures(id),
    is_group BOOLEAN DEFAULT FALSE,
    calculate_mode INTEGER DEFAULT 0, -- 0=ручной, 1=по ресурсам
    sort_order INTEGER DEFAULT 0,
    start_date DATE,
    end_date DATE,
    duration INTEGER, -- в днях
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица: estimate_resources (Ресурсы сметы)
CREATE TABLE estimate_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES estimate_tasks(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    valuation_id UUID REFERENCES valuations(id),
    name VARCHAR(500) NOT NULL,
    code VARCHAR(50),
    resource_type INTEGER NOT NULL DEFAULT 2, -- 1=работа, 2=материал, 3=механизм, 5=накладные
    unit_measure_id INTEGER REFERENCES unit_measures(id),
    volume DECIMAL(15, 4) DEFAULT 0,
    price DECIMAL(15, 4) DEFAULT 0,
    markup DECIMAL(8, 4) DEFAULT 0, -- наценка в %
    cost DECIMAL(15, 2) GENERATED ALWAYS AS (volume * price) STORED,
    price_with_markup DECIMAL(15, 4) GENERATED ALWAYS AS (price * (1 + markup / 100)) STORED,
    cost_with_markup DECIMAL(15, 2) GENERATED ALWAYS AS (volume * price * (1 + markup / 100)) STORED,
    contractor_id UUID REFERENCES contractors(id),
    needed_at DATE,
    url VARCHAR(500),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица: estimate_markups (Наценки сметы)
CREATE TABLE estimate_markups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255),
    value DECIMAL(10, 4) NOT NULL,
    type INTEGER DEFAULT 0, -- 0=процент, 1=фикс.сумма
    is_nds BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3.2.4 Задачи

```sql
-- Таблица: ticket_types (Типы задач)
CREATE TABLE ticket_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT 'blue',
    icon VARCHAR(50),
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица: ticket_type_fields (Поля типа задачи)
CREATE TABLE ticket_type_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_type_id UUID NOT NULL REFERENCES ticket_types(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    field_type VARCHAR(50) NOT NULL, -- text, number, date, select, multiselect, user, file
    options JSONB, -- для select: [{value, label}]
    is_required BOOLEAN DEFAULT FALSE,
    is_visible BOOLEAN DEFAULT TRUE,
    default_value TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица: ticket_statuses (Статусы задач)
CREATE TABLE ticket_statuses (
    id SERIAL PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20) DEFAULT 'gray',
    is_default BOOLEAN DEFAULT FALSE,
    is_closed BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0
);

-- Таблица: ticket_priorities (Приоритеты задач)
CREATE TABLE ticket_priorities (
    id SERIAL PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20) DEFAULT 'gray',
    is_default BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0
);

-- Таблица: tickets (Задачи)
CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    ticket_type_id UUID NOT NULL REFERENCES ticket_types(id),
    parent_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
    code VARCHAR(50),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status_id INTEGER NOT NULL REFERENCES ticket_statuses(id),
    priority_id INTEGER REFERENCES ticket_priorities(id),
    assigned_to_id UUID REFERENCES users(id),
    author_id UUID NOT NULL REFERENCES users(id),
    due_date TIMESTAMP WITH TIME ZONE,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    duration INTEGER, -- в днях
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    component_id UUID REFERENCES components(id),
    plan_id UUID REFERENCES plans(id),
    position_x DECIMAL(10, 2),
    position_y DECIMAL(10, 2),
    custom_fields JSONB DEFAULT '{}',
    is_locked BOOLEAN DEFAULT FALSE,
    locked_by_id UUID REFERENCES users(id),
    locked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Таблица: ticket_comments (Комментарии к задачам)
CREATE TABLE ticket_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Таблица: ticket_journals (Журнал изменений задач)
CREATE TABLE ticket_journals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(50) NOT NULL, -- created, updated, status_changed, assigned, commented
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для tickets
CREATE INDEX idx_tickets_project ON tickets(project_id);
CREATE INDEX idx_tickets_assigned ON tickets(assigned_to_id);
CREATE INDEX idx_tickets_status ON tickets(status_id);
CREATE INDEX idx_tickets_due_date ON tickets(due_date);
CREATE INDEX idx_tickets_component ON tickets(component_id);
CREATE INDEX idx_tickets_plan ON tickets(plan_id);
```

### 3.2.5 Чертежи и DMS

```sql
-- Таблица: components (Компоненты/Этажи)
CREATE TABLE components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES components(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица: plans (Чертежи/Планы)
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500),
    width INTEGER,
    height INTEGER,
    scale DECIMAL(10, 4),
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица: plan_markups (Аннотации на планах)
CREATE TABLE plan_markups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id),
    markup_type VARCHAR(50) NOT NULL, -- line, rectangle, circle, text, arrow, polygon
    data JSONB NOT NULL, -- координаты, стили, текст
    is_visible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица: dms_folders (Папки DMS)
CREATE TABLE dms_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES dms_folders(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    path TEXT NOT NULL, -- /root/folder1/folder2
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Таблица: dms_files (Файлы DMS)
CREATE TABLE dms_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES dms_folders(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100),
    size BIGINT,
    url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500),
    version INTEGER DEFAULT 1,
    is_current_version BOOLEAN DEFAULT TRUE,
    parent_file_id UUID REFERENCES dms_files(id),
    checksum VARCHAR(64),
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Таблица: dms_file_permissions (Права на файлы)
CREATE TABLE dms_file_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID REFERENCES dms_files(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES dms_folders(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    permission VARCHAR(20) NOT NULL, -- view, edit, delete, manage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (
        (file_id IS NOT NULL AND folder_id IS NULL) OR
        (file_id IS NULL AND folder_id IS NOT NULL)
    ),
    CHECK (
        (user_id IS NOT NULL AND role_id IS NULL) OR
        (user_id IS NULL AND role_id IS NOT NULL)
    )
);

-- Таблица: dms_activity_log (Лог активности DMS)
CREATE TABLE dms_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID REFERENCES dms_files(id) ON DELETE SET NULL,
    folder_id UUID REFERENCES dms_folders(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(50) NOT NULL, -- created, viewed, downloaded, updated, deleted, moved, renamed
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3.2.6 Контрагенты

```sql
-- Таблица: contractor_groups (Группы контрагентов)
CREATE TABLE contractor_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(20) DEFAULT 'gray',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица: contractors (Контрагенты)
CREATE TABLE contractors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    group_id UUID REFERENCES contractor_groups(id) ON DELETE SET NULL,
    contractor_type INTEGER DEFAULT 2, -- 1=физ.лицо, 2=юр.лицо
    type INTEGER DEFAULT 10, -- 10=заказчик, 20=подрядчик, 30=поставщик
    name VARCHAR(255) NOT NULL,
    short_name VARCHAR(100),
    contact_person VARCHAR(255),
    position VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(255),
    inn VARCHAR(20),
    kpp VARCHAR(20),
    ogrn VARCHAR(20),
    legal_address TEXT,
    actual_address TEXT,
    bank_name VARCHAR(255),
    bank_bik VARCHAR(20),
    bank_account VARCHAR(30),
    bank_corr_account VARCHAR(30),
    notes TEXT,
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);
```

### 3.2.7 Финансы

```sql
-- Таблица: payment_operations (Платёжные операции)
CREATE TABLE payment_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    operation_type INTEGER NOT NULL, -- 1=приход, 2=расход
    amount DECIMAL(15, 2) NOT NULL,
    currency_id INTEGER REFERENCES currencies(id),
    contractor_id UUID REFERENCES contractors(id),
    operation_date DATE NOT NULL,
    description TEXT,
    document_number VARCHAR(100),
    document_date DATE,
    category_id INTEGER REFERENCES payment_categories(id),
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица: acts (Акты выполненных работ)
CREATE TABLE acts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    contractor_id UUID NOT NULL REFERENCES contractors(id),
    number VARCHAR(50),
    date DATE NOT NULL,
    period_from DATE,
    period_to DATE,
    total_amount DECIMAL(15, 2) DEFAULT 0,
    nds_amount DECIMAL(15, 2) DEFAULT 0,
    total_with_nds DECIMAL(15, 2) DEFAULT 0,
    status INTEGER DEFAULT 1, -- 1=черновик, 2=подписан, 3=оплачен
    payment_status INTEGER DEFAULT 1, -- 1=не оплачен, 2=частично, 3=оплачен
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица: act_items (Позиции акта)
CREATE TABLE act_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    act_id UUID NOT NULL REFERENCES acts(id) ON DELETE CASCADE,
    task_id UUID REFERENCES estimate_tasks(id),
    name VARCHAR(500) NOT NULL,
    unit_measure_id INTEGER REFERENCES unit_measures(id),
    volume DECIMAL(15, 4) DEFAULT 0,
    price DECIMAL(15, 4) DEFAULT 0,
    amount DECIMAL(15, 2) DEFAULT 0,
    sort_order INTEGER DEFAULT 0
);
```

## 3.3 Схема API-взаимодействий

### 3.3.1 REST API структура

```
/api/v1/
├── /auth
│   ├── POST   /login              # Вход
│   ├── POST   /logout             # Выход
│   ├── POST   /register           # Регистрация
│   ├── POST   /refresh            # Обновление токена
│   ├── POST   /password/reset     # Сброс пароля
│   └── POST   /2fa/verify         # Проверка 2FA
│
├── /users
│   ├── GET    /current            # Текущий пользователь
│   ├── PUT    /current            # Обновление профиля
│   ├── PUT    /current/password   # Смена пароля
│   └── PUT    /current/settings   # Настройки
│
├── /companies
│   ├── GET    /                   # Список компаний пользователя
│   ├── POST   /                   # Создание компании
│   ├── GET    /:id                # Получение компании
│   ├── PUT    /:id                # Обновление компании
│   ├── DELETE /:id                # Удаление компании
│   ├── GET    /:id/users          # Пользователи компании
│   ├── POST   /:id/users/invite   # Приглашение пользователя
│   └── GET    /:id/roles          # Роли компании
│
├── /projects
│   ├── GET    /                   # Список проектов
│   ├── POST   /                   # Создание проекта
│   ├── GET    /:id                # Получение проекта
│   ├── PUT    /:id                # Обновление проекта
│   ├── DELETE /:id                # Удаление проекта
│   ├── POST   /:id/copy           # Копирование проекта
│   ├── GET    /:id/members        # Участники проекта
│   └── POST   /:id/members        # Добавление участника
│
├── /estimates
│   ├── GET    /projects/:pid/stages       # Разделы сметы
│   ├── POST   /projects/:pid/stages       # Создание раздела
│   ├── PUT    /stages/:id                 # Обновление раздела
│   ├── DELETE /stages/:id                 # Удаление раздела
│   ├── POST   /stages/:id/sort            # Сортировка разделов
│   ├── GET    /stages/:sid/tasks          # Работы раздела
│   ├── POST   /stages/:sid/tasks          # Создание работы
│   ├── PUT    /tasks/:id                  # Обновление работы
│   ├── DELETE /tasks/:id                  # Удаление работы
│   ├── GET    /tasks/:tid/resources       # Ресурсы работы
│   ├── POST   /tasks/:tid/resources       # Создание ресурса
│   ├── POST   /tasks/:tid/resources/batch # Массовое создание
│   ├── PUT    /resources/:id              # Обновление ресурса
│   └── DELETE /resources/:id              # Удаление ресурса
│
├── /tickets
│   ├── GET    /                   # Список задач
│   ├── POST   /                   # Создание задачи
│   ├── GET    /:id                # Получение задачи
│   ├── PUT    /:id                # Обновление задачи
│   ├── DELETE /:id                # Удаление задачи
│   ├── POST   /:id/lock           # Блокировка
│   ├── POST   /:id/unlock         # Разблокировка
│   ├── GET    /:id/comments       # Комментарии
│   ├── POST   /:id/comments       # Добавление комментария
│   ├── GET    /:id/journals       # Журнал изменений
│   └── GET    /:id/subtickets     # Подзадачи
│
├── /dms
│   ├── GET    /folders            # Дерево папок
│   ├── POST   /folders            # Создание папки
│   ├── PUT    /folders/:id        # Переименование
│   ├── DELETE /folders/:id        # Удаление папки
│   ├── GET    /files              # Список файлов
│   ├── POST   /files              # Загрузка файла
│   ├── GET    /files/:id          # Получение файла
│   ├── PUT    /files/:id          # Обновление файла
│   ├── DELETE /files/:id          # Удаление файла
│   └── GET    /files/:id/versions # Версии файла
│
├── /plans
│   ├── GET    /                   # Список планов
│   ├── POST   /                   # Загрузка плана
│   ├── GET    /:id                # Получение плана
│   ├── PUT    /:id                # Обновление плана
│   ├── DELETE /:id                # Удаление плана
│   ├── GET    /:id/markups        # Аннотации
│   └── POST   /:id/markups        # Добавление аннотации
│
├── /contractors
│   ├── GET    /                   # Список контрагентов
│   ├── POST   /                   # Создание
│   ├── GET    /:id                # Получение
│   ├── PUT    /:id                # Обновление
│   └── DELETE /:id                # Удаление
│
├── /finance
│   ├── GET    /operations         # Платёжные операции
│   ├── POST   /operations         # Создание операции
│   ├── GET    /acts               # Акты
│   ├── POST   /acts               # Создание акта
│   └── GET    /statistics         # Финансовая статистика
│
├── /reports
│   ├── GET    /templates          # Шаблоны отчётов
│   ├── POST   /templates          # Создание шаблона
│   ├── POST   /generate           # Генерация отчёта
│   └── GET    /dashboards         # Дашборды
│
└── /export
    ├── GET    /estimate/:pid      # Экспорт сметы
    ├── GET    /tickets            # Экспорт задач
    └── GET    /report/:id         # Экспорт отчёта
```

### 3.3.2 WebSocket каналы

```javascript
// Структура каналов
channels: {
    // Персональный канал пользователя
    'user.{userId}': {
        events: ['notification', 'task_assigned', 'mention']
    },
    
    // Канал проекта
    'project.{projectId}': {
        events: ['task_created', 'task_updated', 'comment_added', 'file_uploaded']
    },
    
    // Presence-канал для совместного редактирования
    'presence.estimate.{projectId}': {
        events: ['user_joined', 'user_left', 'cell_locked', 'cell_unlocked']
    },
    
    // Канал задачи
    'ticket.{ticketId}': {
        events: ['updated', 'comment_added', 'locked', 'unlocked']
    }
}
```

## 3.4 Схема интеграций с внешними системами

```
┌─────────────────────────────────────────────────────────────────┐
│                       ELEKTROSMETA                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   OAuth      │    │   SMTP       │    │   SMS        │      │
│  │   Providers  │    │   Server     │    │   Gateway    │      │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘      │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│  ┌──────────────────────────────────────────────────────┐      │
│  │                    AUTH SERVICE                       │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐      │
│  │                   FILE SERVICE                        │      │
│  └──────┬─────────────────┬─────────────────┬───────────┘      │
│         │                 │                 │                   │
│         ▼                 ▼                 ▼                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  S3 Storage  │  │  Google      │  │  Dropbox     │         │
│  │  (MinIO)     │  │  Drive       │  │              │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐      │
│  │                  PAYMENT SERVICE                      │      │
│  └──────┬─────────────────┬─────────────────┬───────────┘      │
│         │                 │                 │                   │
│         ▼                 ▼                 ▼                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Stripe     │  │   YooKassa   │  │   Invoice    │         │
│  │              │  │              │  │   Service    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐      │
│  │                  EXPORT SERVICE                       │      │
│  └──────┬─────────────────┬─────────────────┬───────────┘      │
│         │                 │                 │                   │
│         ▼                 ▼                 ▼                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  PDF Gen     │  │  XLSX Gen    │  │  WOPI        │         │
│  │  (Puppeteer) │  │  (ExcelJS)   │  │  (Office)    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐      │
│  │                EXTERNAL DATA SERVICE                  │      │
│  └──────┬─────────────────┬─────────────────────────────┘      │
│         │                 │                                     │
│         ▼                 ▼                                     │
│  ┌──────────────┐  ┌──────────────┐                            │
│  │  EGRUL/EGRIP │  │  DaData      │                            │
│  │  (ФНС)       │  │              │                            │
│  └──────────────┘  └──────────────┘                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

# 4. МОДУЛИ ДЛЯ ВНЕДРЕНИЯ

---

## МОДУЛЬ 1: Ядро системы (Core)

### 4.1.1 Описание и цели модуля

**Назначение:** Базовый фундамент системы, обеспечивающий мультитенантную архитектуру, аутентификацию, авторизацию и управление пользователями.

**Бизнес-цели:**
- Безопасный доступ к системе с разграничением прав
- Поддержка нескольких компаний (мультитенантность)
- Гибкая ролевая модель
- Масштабируемость для SaaS-модели

**Связь с другими модулями:**
- Является фундаментом для ВСЕХ остальных модулей
- Предоставляет контекст пользователя и компании
- Управляет правами доступа ко всем ресурсам

### 4.1.2 Роли и права доступа

**Системные роли (предустановленные):**

| Роль | ID | Описание |
|------|-----|----------|
| Суперадмин | 1 | Полный контроль платформы |
| Владелец | 2 | Владелец компании |
| Администратор | 3 | Админ компании |
| Руководитель проектов | 4 | Управление проектами |
| Инженер-сметчик | 5 | Работа со сметами |
| Прораб | 6 | Исполнение на объекте |
| Субподрядчик | 7 | Внешний исполнитель |
| Наблюдатель | 8 | Только просмотр |
| Бухгалтер | 9 | Финансы |

**Матрица прав для модуля Core:**

| Действие | Суперадмин | Владелец | Админ | Остальные |
|----------|:----------:|:--------:|:-----:|:---------:|
| Просмотр компании | ✅ | ✅ | ✅ | ✅ |
| Редактирование компании | ✅ | ✅ | ✅ | ❌ |
| Удаление компании | ✅ | ✅ | ❌ | ❌ |
| Управление пользователями | ✅ | ✅ | ✅ | ❌ |
| Управление ролями | ✅ | ✅ | ✅ | ❌ |
| Просмотр логов | ✅ | ✅ | ✅ | ❌ |

### 4.1.3 База данных

**Таблица: companies**

| Поле | Тип | Обязательное | По умолчанию | Описание |
|------|-----|:------------:|--------------|----------|
| id | UUID | ✅ | gen_random_uuid() | Первичный ключ |
| name | VARCHAR(255) | ✅ | - | Название компании |
| inn | VARCHAR(20) | ❌ | NULL | ИНН |
| kpp | VARCHAR(20) | ❌ | NULL | КПП |
| ogrn | VARCHAR(20) | ❌ | NULL | ОГРН |
| legal_address | TEXT | ❌ | NULL | Юридический адрес |
| actual_address | TEXT | ❌ | NULL | Фактический адрес |
| phone | VARCHAR(50) | ❌ | NULL | Телефон |
| email | VARCHAR(255) | ❌ | NULL | Email |
| website | VARCHAR(255) | ❌ | NULL | Сайт |
| logo_url | VARCHAR(500) | ❌ | NULL | URL логотипа |
| currency_id | INTEGER | ❌ | 1 | FK → currencies |
| country_id | INTEGER | ❌ | 1 | FK → countries |
| timezone | VARCHAR(50) | ❌ | 'Europe/Moscow' | Часовой пояс |
| settings | JSONB | ❌ | '{}' | Настройки |
| created_at | TIMESTAMP | ✅ | NOW() | Дата создания |
| updated_at | TIMESTAMP | ✅ | NOW() | Дата обновления |
| deleted_at | TIMESTAMP | ❌ | NULL | Soft delete |

**Индексы:**
```sql
CREATE INDEX idx_companies_name ON companies(name);
CREATE INDEX idx_companies_inn ON companies(inn);
CREATE INDEX idx_companies_deleted ON companies(deleted_at) WHERE deleted_at IS NULL;
```

**Таблица: users**

| Поле | Тип | Обязательное | По умолчанию | Описание |
|------|-----|:------------:|--------------|----------|
| id | UUID | ✅ | gen_random_uuid() | Первичный ключ |
| email | VARCHAR(255) | ✅ | - | Email (уникальный) |
| password_hash | VARCHAR(255) | ✅ | - | Хеш пароля (bcrypt) |
| first_name | VARCHAR(100) | ✅ | - | Имя |
| last_name | VARCHAR(100) | ✅ | - | Фамилия |
| middle_name | VARCHAR(100) | ❌ | NULL | Отчество |
| phone | VARCHAR(50) | ❌ | NULL | Телефон |
| avatar_url | VARCHAR(500) | ❌ | NULL | URL аватара |
| language | VARCHAR(10) | ❌ | 'ru' | Язык интерфейса |
| timezone | VARCHAR(50) | ❌ | NULL | Часовой пояс |
| is_active | BOOLEAN | ✅ | TRUE | Активен |
| is_email_verified | BOOLEAN | ✅ | FALSE | Email подтверждён |
| two_factor_enabled | BOOLEAN | ✅ | FALSE | 2FA включена |
| two_factor_secret | VARCHAR(255) | ❌ | NULL | Секрет 2FA |
| last_login_at | TIMESTAMP | ❌ | NULL | Последний вход |
| settings | JSONB | ❌ | '{}' | Настройки |
| created_at | TIMESTAMP | ✅ | NOW() | Дата создания |
| updated_at | TIMESTAMP | ✅ | NOW() | Дата обновления |
| deleted_at | TIMESTAMP | ❌ | NULL | Soft delete |

**Индексы:**
```sql
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = TRUE;
```

### 4.1.4 Backend API

#### POST /api/v1/auth/login

**Описание:** Аутентификация пользователя

**Параметры запроса:** Нет

**Тело запроса:**
```json
{
    "email": "user@example.com",
    "password": "SecurePassword123",
    "remember_me": true
}
```

**Заголовки:**
```
Content-Type: application/json
Accept: application/json
```

**Логика обработки:**
1. Валидация входных данных (email формат, пароль не пустой)
2. Поиск пользователя по email
3. Проверка is_active = true
4. Проверка хеша пароля (bcrypt.compare)
5. Если 2FA включена → вернуть требование кода
6. Генерация JWT токена
7. Создание записи в sessions
8. Обновление last_login_at
9. Логирование события входа

**Валидация:**
- email: required, email format
- password: required, min 8 chars

**Ответ (успех, без 2FA):**
```json
{
    "success": true,
    "data": {
        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...",
        "expires_in": 3600,
        "token_type": "Bearer",
        "user": {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "email": "user@example.com",
            "first_name": "Иван",
            "last_name": "Петров",
            "avatar_url": null,
            "companies": [
                {
                    "id": "660e8400-e29b-41d4-a716-446655440001",
                    "name": "ООО Электромонтаж",
                    "role": "owner"
                }
            ]
        }
    }
}
```

**Ответ (требуется 2FA):**
```json
{
    "success": true,
    "data": {
        "requires_2fa": true,
        "temp_token": "temp_2fa_token_here"
    }
}
```

**Коды ошибок:**

| Код | Описание |
|-----|----------|
| 400 | Невалидные входные данные |
| 401 | Неверный email или пароль |
| 403 | Аккаунт деактивирован |
| 429 | Превышен лимит попыток |

**SQL-запросы:**
```sql
-- Поиск пользователя
SELECT id, email, password_hash, first_name, last_name, 
       is_active, two_factor_enabled, two_factor_secret
FROM users 
WHERE email = $1 AND deleted_at IS NULL;

-- Обновление last_login
UPDATE users SET last_login_at = NOW() WHERE id = $1;

-- Создание сессии
INSERT INTO sessions (user_id, token_hash, ip_address, user_agent, expires_at)
VALUES ($1, $2, $3, $4, $5);
```

#### POST /api/v1/auth/register

**Описание:** Регистрация нового пользователя и компании

**Тело запроса:**
```json
{
    "email": "newuser@example.com",
    "password": "SecurePassword123",
    "password_confirmation": "SecurePassword123",
    "first_name": "Иван",
    "last_name": "Петров",
    "phone": "+7 (999) 123-45-67",
    "company_name": "ООО Электромонтаж",
    "company_inn": "7707083893",
    "agree_terms": true,
    "agree_privacy": true
}
```

**Логика обработки:**
1. Валидация всех полей
2. Проверка уникальности email
3. Хеширование пароля (bcrypt, cost 12)
4. Начало транзакции
5. Создание компании
6. Создание пользователя
7. Создание связи company_users с ролью owner
8. Создание базовых ролей для компании
9. Отправка email подтверждения
10. Коммит транзакции
11. Генерация токенов

**Валидация:**
- email: required, email, unique
- password: required, min 8, must contain uppercase, lowercase, digit
- password_confirmation: required, must match password
- first_name: required, min 2, max 100
- last_name: required, min 2, max 100
- company_name: required, min 2, max 255
- agree_terms: required, must be true
- agree_privacy: required, must be true

**Ответ (успех):**
```json
{
    "success": true,
    "data": {
        "message": "Регистрация успешна. Проверьте email для подтверждения.",
        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "user": {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "email": "newuser@example.com",
            "first_name": "Иван",
            "last_name": "Петров",
            "is_email_verified": false
        },
        "company": {
            "id": "660e8400-e29b-41d4-a716-446655440001",
            "name": "ООО Электромонтаж"
        }
    }
}
```

#### GET /api/v1/users/current

**Описание:** Получение данных текущего пользователя

**Заголовки:**
```
Authorization: Bearer {access_token}
Accept: application/json
```

**Ответ:**
```json
{
    "success": true,
    "data": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "email": "user@example.com",
        "first_name": "Иван",
        "last_name": "Петров",
        "middle_name": "Сергеевич",
        "phone": "+7 (999) 123-45-67",
        "avatar_url": "https://storage.example.com/avatars/550e8400.jpg",
        "language": "ru",
        "timezone": "Europe/Moscow",
        "is_email_verified": true,
        "two_factor_enabled": false,
        "settings": {
            "notifications": {
                "email": true,
                "push": true
            },
            "theme": "light"
        },
        "companies": [
            {
                "id": "660e8400-e29b-41d4-a716-446655440001",
                "name": "ООО Электромонтаж",
                "logo_url": "https://storage.example.com/logos/660e8400.jpg",
                "role": {
                    "id": 2,
                    "name": "Владелец",
                    "slug": "owner"
                },
                "is_owner": true,
                "permissions": ["company.manage", "users.manage", "projects.create", ...]
            }
        ],
        "created_at": "2024-01-15T10:30:00Z"
    }
}
```

### 4.1.5 Frontend - Интерфейс пользователя

#### Страница: Вход в систему

**URL:** `/login`

**Wireframe (текстовый):**
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                      [ЛОГОТИП]                              │
│                    ElektroSmeta                             │
│                                                             │
│    ┌───────────────────────────────────────────────────┐   │
│    │                                                   │   │
│    │   Email                                           │   │
│    │   ┌───────────────────────────────────────────┐   │   │
│    │   │ user@example.com                          │   │   │
│    │   └───────────────────────────────────────────┘   │   │
│    │                                                   │   │
│    │   Пароль                                          │   │
│    │   ┌───────────────────────────────────────────┐   │   │
│    │   │ ••••••••••                           [👁]│   │   │
│    │   └───────────────────────────────────────────┘   │   │
│    │                                                   │   │
│    │   [✓] Запомнить меня           Забыли пароль? →  │   │
│    │                                                   │   │
│    │   ┌───────────────────────────────────────────┐   │   │
│    │   │              ВОЙТИ                        │   │   │
│    │   └───────────────────────────────────────────┘   │   │
│    │                                                   │   │
│    │   ─────────────── или ───────────────            │   │
│    │                                                   │   │
│    │   [🔵 Google]  [⬛ Yandex]                        │   │
│    │                                                   │   │
│    │   Нет аккаунта? Зарегистрироваться →             │   │
│    │                                                   │   │
│    └───────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Элементы интерфейса:**

| Элемент | Тип | Валидация | Поведение |
|---------|-----|-----------|-----------|
| Поле Email | Input (email) | required, email format | Автофокус |
| Поле Пароль | Input (password) | required, min 8 | Кнопка показать/скрыть |
| Запомнить меня | Checkbox | - | Продлённая сессия (30 дней) |
| Забыли пароль? | Link | - | Переход на /forgot-password |
| Кнопка Войти | Button (primary) | - | POST /auth/login |
| Google OAuth | Button | - | Redirect to Google OAuth |
| Регистрация | Link | - | Переход на /register |

**Состояния:**
- **Загрузка:** Спиннер на кнопке "Войти", поля disabled
- **Ошибка:** Красная рамка на полях, сообщение под формой
- **2FA требуется:** Модальное окно с вводом кода

#### Страница: Регистрация

**URL:** `/register`

**Элементы формы:**

1. **Блок "Личные данные"**
   - Email (required, email, unique check on blur)
   - Пароль (required, min 8, strength indicator)
   - Подтверждение пароля (must match)
   - Имя (required, 2-100 chars)
   - Фамилия (required, 2-100 chars)
   - Телефон (optional, phone mask)

2. **Блок "Компания"**
   - Название компании (required)
   - ИНН (optional, 10 or 12 digits, autofill from DaData)

3. **Блок "Согласия"**
   - Checkbox: Согласие с условиями (required)
   - Checkbox: Согласие на обработку данных (required)

4. **Кнопка "Зарегистрироваться"**

### 4.1.6 Бизнес-логика и процессы

#### Процесс: Регистрация пользователя

```
┌─────────────────┐
│  Пользователь   │
│  заполняет      │
│  форму          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Валидация      │──── Ошибка ──→ Показать ошибки
│  на клиенте     │
└────────┬────────┘
         │ OK
         ▼
┌─────────────────┐
│  POST /register │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Проверка       │──── Занят ──→ Ошибка "Email занят"
│  уникальности   │
│  email          │
└────────┬────────┘
         │ Свободен
         ▼
┌─────────────────┐
│  BEGIN          │
│  TRANSACTION    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Создать        │
│  Company        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Создать User   │
│  (hash password)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Создать        │
│  company_users  │
│  (role=owner)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Создать        │
│  базовые роли   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  COMMIT         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Отправить      │
│  email          │
│  подтверждения  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Сгенерировать  │
│  JWT токены     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Redirect на    │
│  Dashboard      │
└─────────────────┘
```

### 4.1.7 Интеграции

- **OAuth провайдеры:** Google, Yandex
- **Email сервис:** SendGrid / MailGun для отправки писем
- **DaData:** Автозаполнение данных компании по ИНН

### 4.1.8 Уведомления

| Событие | Email | Push | In-app |
|---------|:-----:|:----:|:------:|
| Регистрация (welcome) | ✅ | ❌ | ❌ |
| Подтверждение email | ✅ | ❌ | ❌ |
| Сброс пароля | ✅ | ❌ | ❌ |
| Вход с нового устройства | ✅ | ✅ | ✅ |
| Приглашение в компанию | ✅ | ✅ | ✅ |

**Шаблон email "Welcome":**
```
Тема: Добро пожаловать в ElektroSmeta!

Здравствуйте, {first_name}!

Вы успешно зарегистрировались в системе ElektroSmeta.

Ваш аккаунт:
- Email: {email}
- Компания: {company_name}

Для подтверждения email перейдите по ссылке:
{confirmation_url}

Ссылка действительна 24 часа.

С уважением,
Команда ElektroSmeta
```

### 4.1.9 Тестирование

**Сценарии тестирования:**

| # | Сценарий | Шаги | Ожидаемый результат |
|---|----------|------|---------------------|
| 1 | Успешный вход | 1. Открыть /login<br>2. Ввести валидные данные<br>3. Нажать "Войти" | Редирект на dashboard |
| 2 | Неверный пароль | 1. Ввести неверный пароль<br>2. Нажать "Войти" | Ошибка "Неверный email или пароль" |
| 3 | Заблокированный аккаунт | 1. Войти с деактивированным аккаунтом | Ошибка "Аккаунт деактивирован" |
| 4 | Регистрация | 1. Заполнить форму<br>2. Нажать "Зарегистрироваться" | Создан аккаунт, редирект |
| 5 | 2FA вход | 1. Войти с 2FA<br>2. Ввести код | Успешный вход |

### 4.1.10 Критерии приёмки

- [ ] Регистрация нового пользователя с созданием компании
- [ ] Вход по email/паролю
- [ ] Двухфакторная аутентификация (TOTP)
- [ ] OAuth через Google
- [ ] Сброс пароля по email
- [ ] Подтверждение email
- [ ] JWT токены с refresh
- [ ] Управление сессиями
- [ ] Выход из системы
- [ ] RBAC система прав
- [ ] Приглашение пользователей в компанию

---

## МОДУЛЬ 2: Управление проектами

### 4.2.1 Описание и цели модуля

**Назначение:** Управление строительными проектами, их организация в папки, назначение участников и отслеживание статусов.

**Бизнес-цели:**
- Централизованное управление всеми проектами компании
- Организация проектов в иерархическую структуру папок
- Контроль участников и их ролей в проекте
- Отслеживание жизненного цикла проекта

**Связь с другими модулями:**
- **Зависит от:** Модуль 1 (Ядро) — пользователи, компании, права
- **Использует:** Модуль 5 (Контрагенты) — заказчики проектов
- **Используется:** Все остальные модули — контекст проекта

### 4.2.2 Роли и права доступа

| Действие | Владелец | Админ | Рук. проектов | Сметчик | Прораб | Субподр. | Наблюд. |
|----------|:--------:|:-----:|:-------------:|:-------:|:------:|:--------:|:-------:|
| Просмотр списка проектов | Все | Все | Все | Свои | Свои | Свои | Свои |
| Создание проекта | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Редактирование проекта | ✅ | ✅ | Свои | ❌ | ❌ | ❌ | ❌ |
| Удаление проекта | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Архивация проекта | ✅ | ✅ | Свои | ❌ | ❌ | ❌ | ❌ |
| Копирование проекта | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Управление участниками | ✅ | ✅ | Свои | ❌ | ❌ | ❌ | ❌ |
| Создание папок | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

### 4.2.3 База данных

(Таблицы описаны в разделе 3.2.2)

**Дополнительные поля project_statuses (предустановленные):**

```sql
INSERT INTO project_statuses (name, color, is_default, is_closed, sort_order) VALUES
('Новый', 'blue', TRUE, FALSE, 1),
('В работе', 'green', FALSE, FALSE, 2),
('На паузе', 'yellow', FALSE, FALSE, 3),
('Завершён', 'gray', FALSE, TRUE, 4),
('Отменён', 'red', FALSE, TRUE, 5);
```

### 4.2.4 Backend API

#### GET /api/v1/projects

**Описание:** Список проектов с фильтрацией и пагинацией

**Query параметры:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| page | integer | Номер страницы (default: 1) |
| per_page | integer | Записей на странице (default: 20, max: 100) |
| folder_id | UUID | Фильтр по папке |
| status_id | integer | Фильтр по статусу |
| search | string | Поиск по названию |
| sort | string | Поле сортировки (name, created_at, updated_at) |
| order | string | Направление (asc, desc) |

**Ответ:**
```json
{
    "success": true,
    "data": {
        "items": [
            {
                "id": "770e8400-e29b-41d4-a716-446655440002",
                "code": "PRJ-001",
                "name": "ЖК Новые горизонты",
                "full_name": "Электромонтажные работы ЖК Новые горизонты",
                "address": "г. Москва, ул. Строителей, 15",
                "status": {
                    "id": 2,
                    "name": "В работе",
                    "color": "green"
                },
                "customer": {
                    "id": "880e8400-e29b-41d4-a716-446655440003",
                    "name": "ООО СтройИнвест"
                },
                "manager": {
                    "id": "550e8400-e29b-41d4-a716-446655440000",
                    "name": "Петров И.С."
                },
                "budget": 15000000.00,
                "start_date": "2024-02-01",
                "end_date": "2024-08-31",
                "members_count": 5,
                "tasks_count": 42,
                "created_at": "2024-01-20T14:30:00Z"
            }
        ],
        "pagination": {
            "current_page": 1,
            "per_page": 20,
            "total_pages": 5,
            "total_count": 87
        }
    }
}
```

#### POST /api/v1/projects

**Описание:** Создание нового проекта

**Тело запроса:**
```json
{
    "folder_id": "990e8400-e29b-41d4-a716-446655440004",
    "code": "PRJ-002",
    "name": "БЦ Меридиан",
    "full_name": "Электромонтажные работы БЦ Меридиан",
    "description": "Полный комплекс электромонтажных работ",
    "address": "г. Москва, ул. Академика Королёва, 8",
    "status_id": 1,
    "customer_id": "880e8400-e29b-41d4-a716-446655440003",
    "manager_id": "550e8400-e29b-41d4-a716-446655440000",
    "start_date": "2024-03-01",
    "end_date": "2024-12-31",
    "budget": 25000000.00,
    "currency_id": 1,
    "settings": {
        "auto_numbering": true,
        "default_markup": 15
    }
}
```

**Валидация:**
- name: required, min 3, max 255
- code: optional, unique within company
- customer_id: optional, must exist
- manager_id: optional, must be company member
- start_date: optional, date format
- end_date: optional, must be >= start_date

#### POST /api/v1/projects/{id}/copy

**Описание:** Копирование проекта

**Тело запроса:**
```json
{
    "name": "БЦ Меридиан (копия)",
    "copy_options": {
        "estimate": true,
        "tasks": false,
        "documents": false,
        "members": true
    }
}
```

### 4.2.5 Frontend - Интерфейс пользователя

#### Страница: Список проектов

**URL:** `/projects`

**Wireframe:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│ [← Меню]  Проекты                                   [+ Создать проект]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────────────────────────────────┐  │
│  │ 📁 Папки        │  │ 🔍 [Поиск по названию...           ] [⚙]   │  │
│  │                 │  │                                             │  │
│  │ 📁 Все проекты  │  │ Фильтры: [Статус ▼] [Менеджер ▼] [Период]  │  │
│  │ 📁 2024         │  │                                             │  │
│  │   📁 Москва     │  │ ┌─────┬──────────┬────────┬────────┬──────┐ │  │
│  │   📁 СПб        │  │ │ Код │ Название │ Статус │ Срок   │ 👤   │ │  │
│  │ 📁 2023         │  │ ├─────┼──────────┼────────┼────────┼──────┤ │  │
│  │ 📁 Архив        │  │ │PRJ-1│ЖК Горизо │🟢 В ра.│01.02-31│ ИП   │ │  │
│  │                 │  │ │PRJ-2│БЦ Меридиа│🔵 Новый│01.03-31│ СА   │ │  │
│  │ [+ Новая папка] │  │ │PRJ-3│ТЦ Европа │🟡 Пауза│15.01-30│ МК   │ │  │
│  │                 │  │ │...  │...       │...     │...     │...   │ │  │
│  └─────────────────┘  │ └─────┴──────────┴────────┴────────┴──────┘ │  │
│                       │                                             │  │
│                       │ Показано 1-20 из 87        [◀ 1 2 3 4 5 ▶]  │  │
│                       └─────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

**Элементы интерфейса:**

| Элемент | Тип | Описание |
|---------|-----|----------|
| Панель папок | TreeView | Иерархия папок с drag&drop |
| Кнопка "Создать проект" | Button (primary) | Открывает модальное окно |
| Поле поиска | Input | Live-search с debounce 300ms |
| Фильтр статуса | Select | Множественный выбор статусов |
| Фильтр менеджера | Select | Выбор менеджера |
| Фильтр периода | DateRange | Диапазон дат |
| Таблица проектов | DataTable | Сортировка по клику на заголовок |
| Пагинация | Pagination | Переключение страниц |

**Контекстное меню строки:**
- Открыть
- Редактировать
- Копировать
- Архивировать
- Удалить (с подтверждением)

### 4.2.6 Бизнес-логика и процессы

#### Процесс: Жизненный цикл проекта

```
  ┌─────────┐    Создать     ┌─────────┐
  │         │ ──────────────→│  Новый  │
  │  Идея   │                │   🔵    │
  │         │                └────┬────┘
  └─────────┘                     │
                                  │ Запустить
                                  ▼
                             ┌─────────┐
                        ┌───→│ В работе│◄───┐
                        │    │   🟢    │    │
                        │    └────┬────┘    │
                        │         │         │
               Возобновить    Пауза    Продолжить
                        │         ▼         │
                        │    ┌─────────┐    │
                        └────│ На паузе│────┘
                             │   🟡    │
                             └────┬────┘
                                  │
            ┌─────────────────────┼─────────────────────┐
            │                     │                     │
        Отменить             Завершить              Удалить
            ▼                     ▼                     ▼
       ┌─────────┐         ┌─────────┐         ┌─────────────┐
       │ Отменён │         │Завершён │         │   Удалён    │
       │   🔴    │         │   ⚫    │         │  (soft)     │
       └─────────┘         └─────────┘         └─────────────┘
```

### 4.2.7 Критерии приёмки

- [ ] CRUD операции с проектами
- [ ] Иерархическая структура папок с drag&drop
- [ ] Фильтрация и поиск проектов
- [ ] Статусы проекта с цветовой индикацией
- [ ] Назначение участников с ролями
- [ ] Копирование проекта с выбором опций
- [ ] Архивация проектов
- [ ] Интеграция с контрагентами (заказчик)

---

## МОДУЛЬ 3: Сметирование (расширенное)

### 4.3.1 Описание и цели модуля

**Назначение:** Создание и управление сметами электромонтажных работ с иерархической структурой разделов, работ и ресурсов.

**Бизнес-цели:**
- Детальное сметирование электромонтажных работ
- Автоматический расчёт стоимости с наценками
- Удобное inline-редактирование
- Интеграция со справочниками расценок
- Экспорт смет в различных форматах

**Связь с другими модулями:**
- **Зависит от:** Модуль 2 (Проекты), Модуль 5 (Контрагенты)
- **Используется:** Модуль 4 (Офферы), Модуль 10 (Финансы), Модуль 11 (Закупки)

### 4.3.2 Роли и права доступа

| Действие | Владелец | Админ | Рук. проектов | Сметчик | Прораб | Наблюд. |
|----------|:--------:|:-----:|:-------------:|:-------:|:------:|:-------:|
| Просмотр сметы | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Создание раздела | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Создание работы | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Создание ресурса | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Редактирование | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Удаление | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Управление наценками | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Экспорт | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### 4.3.3 База данных

(Таблицы описаны в разделе 3.2.3)

**Типы ресурсов:**

```sql
-- Справочник типов ресурсов
CREATE TABLE resource_types (
    id INTEGER PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    code VARCHAR(10) NOT NULL,
    color VARCHAR(20) DEFAULT 'gray'
);

INSERT INTO resource_types (id, name, code, color) VALUES
(1, 'Работа', 'labor', 'blue'),
(2, 'Материал', 'material', 'green'),
(3, 'Механизм', 'equipment', 'orange'),
(5, 'Накладные', 'overhead', 'gray');
```

### 4.3.4 Backend API

#### GET /api/v1/projects/{projectId}/estimate

**Описание:** Получение полной структуры сметы проекта

**Query параметры:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| expand | string | Включить связанные данные: tasks, resources, totals |

**Ответ:**
```json
{
    "success": true,
    "data": {
        "project_id": "770e8400-e29b-41d4-a716-446655440002",
        "stages": [
            {
                "id": "aa0e8400-e29b-41d4-a716-446655440010",
                "name": "Раздел 1. Электроснабжение",
                "code": "ЭС",
                "sort_order": 1,
                "totals": {
                    "cost": 5420000.00,
                    "cost_with_markup": 6234000.00
                },
                "tasks": [
                    {
                        "id": "bb0e8400-e29b-41d4-a716-446655440020",
                        "name": "Прокладка кабеля ВВГнг 3x2.5",
                        "code": "ЭС-001",
                        "volume": 1500,
                        "unit_measure": {
                            "id": 1,
                            "code": "м",
                            "name": "метр"
                        },
                        "is_group": false,
                        "sort_order": 1,
                        "totals": {
                            "cost": 225000.00,
                            "cost_with_markup": 258750.00
                        },
                        "resources": [
                            {
                                "id": "cc0e8400-e29b-41d4-a716-446655440030",
                                "name": "Кабель ВВГнг 3x2.5",
                                "code": "М-001",
                                "resource_type": {
                                    "id": 2,
                                    "name": "Материал",
                                    "code": "material"
                                },
                                "unit_measure": {
                                    "id": 1,
                                    "code": "м",
                                    "name": "метр"
                                },
                                "volume": 1500,
                                "price": 85.00,
                                "markup": 15,
                                "cost": 127500.00,
                                "price_with_markup": 97.75,
                                "cost_with_markup": 146625.00,
                                "contractor": null,
                                "url": "https://leroymerlin.ru/product/kabel-vvg-123456/",
                                "sort_order": 1
                            },
                            {
                                "id": "cc0e8400-e29b-41d4-a716-446655440031",
                                "name": "Монтаж кабеля в гофре",
                                "code": "Р-001",
                                "resource_type": {
                                    "id": 1,
                                    "name": "Работа",
                                    "code": "labor"
                                },
                                "unit_measure": {
                                    "id": 1,
                                    "code": "м",
                                    "name": "метр"
                                },
                                "volume": 1500,
                                "price": 65.00,
                                "markup": 15,
                                "cost": 97500.00,
                                "price_with_markup": 74.75,
                                "cost_with_markup": 112125.00,
                                "contractor": {
                                    "id": "dd0e8400-e29b-41d4-a716-446655440040",
                                    "name": "ИП Сидоров"
                                },
                                "sort_order": 2
                            }
                        ]
                    }
                ]
            }
        ],
        "markups": [
            {
                "id": "ee0e8400-e29b-41d4-a716-446655440050",
                "name": "НДС 20%",
                "value": 20,
                "type": 0,
                "is_nds": true,
                "sort_order": 1
            }
        ],
        "totals": {
            "subtotal": 15420000.00,
            "subtotal_with_markup": 17733000.00,
            "nds": 3546600.00,
            "total": 21279600.00
        }
    }
}
```

#### POST /api/v1/stages/{stageId}/tasks

**Описание:** Создание работы в разделе сметы

**Тело запроса:**
```json
{
    "name": "Установка автоматических выключателей",
    "code": "ЭС-002",
    "volume": 50,
    "unit_measure_id": 2,
    "is_group": false,
    "calculate_mode": 1,
    "start_date": "2024-03-15",
    "end_date": "2024-03-20",
    "duration": 5
}
```

#### POST /api/v1/tasks/{taskId}/resources/batch

**Описание:** Массовое создание ресурсов из справочника расценок

**Тело запроса:**
```json
{
    "valuation_ids": [
        "ff0e8400-e29b-41d4-a716-446655440060",
        "ff0e8400-e29b-41d4-a716-446655440061",
        "ff0e8400-e29b-41d4-a716-446655440062"
    ],
    "default_markup": 15
}
```

#### PUT /api/v1/resources/{resourceId}

**Описание:** Обновление ресурса (inline-редактирование)

**Тело запроса (частичное обновление):**
```json
{
    "volume": 1600,
    "price": 90.00
}
```

**Логика пересчёта:**
1. Получить текущий ресурс
2. Применить изменения
3. Пересчитать: cost = volume * price
4. Пересчитать: cost_with_markup = cost * (1 + markup/100)
5. Обновить запись
6. Пересчитать итоги работы (task)
7. Пересчитать итоги раздела (stage)
8. Пересчитать итоги проекта
9. Отправить WebSocket-событие об изменении

### 4.3.5 Frontend - Интерфейс пользователя

#### Страница: Смета проекта

**URL:** `/projects/{id}/estimate`

**Wireframe:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [← Проект] ЖК Новые горизонты / Смета            [Экспорт ▼] [Настройки ⚙] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐│
│ │ [+ Раздел]  [+ Работа]  [+ Ресурс]  │  🔍 Поиск  │ [≡ Фильтры]         ││
│ └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│ ┌───┬──────────────────────────┬────────┬─────┬─────────┬────────┬───────┐ │
│ │☑️ │ Наименование              │ Ед.изм │ Кол │ Цена    │ Наценка│ Сумма │ │
│ ├───┼──────────────────────────┼────────┼─────┼─────────┼────────┼───────┤ │
│ │   │ ▼ Раздел 1. Электроснаб. │        │     │         │        │6 234 T│ │
│ │   │   ▼ Прокладка кабеля     │ м      │1500 │         │        │ 258 T │ │
│ │☐  │     🟢 Кабель ВВГнг 3x2.5 │ м      │1500 │   85.00 │  15%   │146 625│ │
│ │☐  │     🔵 Монтаж кабеля      │ м      │1500 │   65.00 │  15%   │112 125│ │
│ │   │   ▶ Установка автоматов  │ шт     │  50 │         │        │  45 T │ │
│ │   │ ▶ Раздел 2. Освещение    │        │     │         │        │4 500 T│ │
│ └───┴──────────────────────────┴────────┴─────┴─────────┴────────┴───────┘ │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐│
│ │                         ИТОГИ ПО СМЕТЕ                                  ││
│ │                                                                         ││
│ │  Итого по смете:                                    17 733 000.00 ₽     ││
│ │  ┌─────────────────────────────────────────────────────────────────┐    ││
│ │  │ [+ Добавить наценку]                                            │    ││
│ │  │                                                                 │    ││
│ │  │   НДС 20%                                     + 3 546 600.00 ₽  │    ││
│ │  └─────────────────────────────────────────────────────────────────┘    ││
│ │  ═══════════════════════════════════════════════════════════════════   ││
│ │  ВСЕГО ПО СМЕТЕ:                                   21 279 600.00 ₽     ││
│ └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

**Элементы интерфейса:**

| Элемент | Тип | Поведение |
|---------|-----|-----------|
| Дерево сметы | TreeTable | Раскрытие/сворачивание, drag&drop для сортировки |
| Ячейки | Editable cells | Клик → режим редактирования, Enter/Tab → сохранение |
| Цветные маркеры | Badge | 🔵 Работа, 🟢 Материал, 🟠 Механизм, ⚫ Накладные |
| Чекбоксы | Checkbox | Множественный выбор для массовых операций |
| Кнопка "Экспорт" | Dropdown | Excel, PDF, XML |
| Поиск | Input | Live-search по названию |

**Inline-редактирование:**
- Клик по ячейке активирует режим редактирования
- Enter сохраняет, Escape отменяет
- Tab переходит к следующей ячейке
- Валидация в реальном времени
- Автопересчёт сумм при изменении

**Drag & Drop:**
- Перетаскивание разделов меняет их порядок
- Перетаскивание работ между разделами
- Перетаскивание ресурсов между работами
- Визуальная индикация целевой позиции

### 4.3.6 Бизнес-логика и процессы

#### Алгоритм расчёта сметы

```javascript
// 1. Расчёт ресурса
resource.cost = resource.volume * resource.price;
resource.price_with_markup = resource.price * (1 + resource.markup / 100);
resource.cost_with_markup = resource.volume * resource.price_with_markup;

// 2. Расчёт работы
task.cost = SUM(resources.cost);
task.cost_with_markup = SUM(resources.cost_with_markup);

// 3. Расчёт раздела
stage.cost = SUM(tasks.cost);
stage.cost_with_markup = SUM(tasks.cost_with_markup);

// 4. Расчёт итогов
estimate.subtotal = SUM(stages.cost);
estimate.subtotal_with_markup = SUM(stages.cost_with_markup);

// 5. Применение наценок/скидок
let running_sum = estimate.subtotal_with_markup;
for (const markup of markups) {
    if (markup.type === 0) { // процент
        running_sum += running_sum * markup.value / 100;
    } else { // фиксированная сумма
        running_sum += markup.value;
    }
}
estimate.total = running_sum;
```

### 4.3.7 Уведомления

| Событие | WebSocket | Описание |
|---------|:---------:|----------|
| resource_updated | ✅ | Изменён ресурс |
| task_created | ✅ | Создана работа |
| task_deleted | ✅ | Удалена работа |
| stage_reordered | ✅ | Изменён порядок разделов |
| estimate_recalculated | ✅ | Пересчитаны итоги |

### 4.3.8 Экспорт

**Форматы экспорта:**

| Формат | Содержание |
|--------|------------|
| **XLSX** | Полная структура сметы с формулами |
| **PDF** | Отформатированная смета для печати |
| **XML** | Формат АРПС для обмена с другими системами |

### 4.3.9 Критерии приёмки

- [ ] Иерархическая структура: разделы → работы → ресурсы
- [ ] Inline-редактирование ячеек
- [ ] Drag&drop для сортировки и перемещения
- [ ] Автоматический пересчёт сумм
- [ ] Типы ресурсов с цветовой индикацией
- [ ] Наценки (процентные и фиксированные)
- [ ] НДС (включён/не включён)
- [ ] Интеграция со справочником расценок
- [ ] Массовые операции (удаление, копирование, смена типа)
- [ ] Комментарии к ресурсам
- [ ] Экспорт в XLSX, PDF
- [ ] Real-time обновления (WebSocket)

---

## МОДУЛЬ 4: Коммерческие предложения (Офферы)

### 4.4.1 Описание и цели модуля

**Назначение:** Создание и управление коммерческими предложениями (офферами) для клиентов на основе смет проектов.

**Бизнес-цели:**
- Быстрое формирование КП из сметы
- Библиотека шаблонов офферов
- Варианты предложений (разные комплектации)
- Онлайн-просмотр и PDF-экспорт
- Отслеживание статуса КП

**Связь с другими модулями:**
- **Зависит от:** Модуль 2 (Проекты), Модуль 3 (Сметы), Модуль 5 (Контрагенты)
- **Используется:** Модуль 10 (Финансы)

### 4.4.2 База данных

```sql
-- Таблица: offers (Коммерческие предложения)
CREATE TABLE offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    client_id UUID REFERENCES contractors(id) ON DELETE SET NULL,
    template_id UUID REFERENCES offer_templates(id),
    number VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    status INTEGER DEFAULT 1, -- 1=черновик, 2=отправлен, 3=принят, 4=отклонён
    language VARCHAR(10) DEFAULT 'ru',
    currency_id INTEGER REFERENCES currencies(id),
    valid_until DATE,
    total_amount DECIMAL(15, 2) DEFAULT 0,
    discount_percent DECIMAL(5, 2) DEFAULT 0,
    discount_amount DECIMAL(15, 2) DEFAULT 0,
    final_amount DECIMAL(15, 2) DEFAULT 0,
    notes TEXT,
    internal_notes TEXT,
    print_settings JSONB DEFAULT '{}',
    public_token VARCHAR(100) UNIQUE,
    public_url VARCHAR(500),
    viewed_at TIMESTAMP WITH TIME ZONE,
    viewed_count INTEGER DEFAULT 0,
    sent_at TIMESTAMP WITH TIME ZONE,
    accepted_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Таблица: offer_sections (Разделы оффера)
CREATE TABLE offer_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица: offer_items (Позиции оффера)
CREATE TABLE offer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    section_id UUID REFERENCES offer_sections(id) ON DELETE CASCADE,
    source_resource_id UUID REFERENCES estimate_resources(id),
    name VARCHAR(500) NOT NULL,
    description TEXT,
    unit_measure_id INTEGER REFERENCES unit_measures(id),
    quantity DECIMAL(15, 4) DEFAULT 1,
    unit_price DECIMAL(15, 4) DEFAULT 0,
    total_price DECIMAL(15, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    sort_order INTEGER DEFAULT 0,
    is_optional BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица: offer_templates (Шаблоны офферов)
CREATE TABLE offer_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    content JSONB NOT NULL, -- структура шаблона
    print_settings JSONB DEFAULT '{}',
    is_system BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    preview_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы
CREATE INDEX idx_offers_company ON offers(company_id);
CREATE INDEX idx_offers_client ON offers(client_id);
CREATE INDEX idx_offers_status ON offers(status);
CREATE INDEX idx_offers_public_token ON offers(public_token);
```

### 4.4.3 Backend API

#### POST /api/v1/offers

**Описание:** Создание КП из сметы проекта

**Тело запроса:**
```json
{
    "project_id": "770e8400-e29b-41d4-a716-446655440002",
    "client_id": "880e8400-e29b-41d4-a716-446655440003",
    "name": "КП на электромонтаж ЖК Новые горизонты",
    "valid_until": "2024-03-31",
    "discount_percent": 5,
    "notes": "Специальное предложение при заказе до конца месяца",
    "import_from_estimate": true,
    "import_options": {
        "stage_ids": ["aa0e8400-e29b-41d4-a716-446655440010"],
        "include_markup": true
    }
}
```

#### GET /api/v1/offers/{id}/public/{token}

**Описание:** Публичный просмотр КП (без авторизации)

**Логика:**
1. Проверить валидность токена
2. Проверить срок действия КП
3. Увеличить счётчик просмотров
4. Записать viewed_at если первый просмотр
5. Вернуть данные КП для отображения

#### POST /api/v1/offers/{id}/send

**Описание:** Отправка КП клиенту

**Тело запроса:**
```json
{
    "email": "client@example.com",
    "subject": "Коммерческое предложение от ElektroSmeta",
    "message": "Добрый день! Направляем вам коммерческое предложение...",
    "attach_pdf": true
}
```

### 4.4.4 Frontend - Интерфейс

#### Страница: Редактор оффера

**URL:** `/offers/{id}`

**Функционал:**
- Вкладки: Описание, Позиции, Настройки печати, Предпросмотр
- Drag&drop позиций
- Inline-редактирование цен
- Варианты КП (опциональные позиции)
- Генерация публичной ссылки
- Отправка по email
- Экспорт в PDF

### 4.4.5 Критерии приёмки

- [ ] Создание КП из сметы проекта
- [ ] Библиотека шаблонов
- [ ] Редактирование позиций и цен
- [ ] Скидки (процентные и фиксированные)
- [ ] Публичная ссылка для просмотра
- [ ] Отслеживание просмотров
- [ ] Отправка по email
- [ ] Экспорт в PDF
- [ ] Статусы: черновик, отправлен, принят, отклонён

---

## МОДУЛЬ 5: Контрагенты

### 4.5.1 Описание и цели модуля

**Назначение:** Управление базой контрагентов (заказчики, поставщики, подрядчики).

**Бизнес-цели:**
- Единая база контрагентов компании
- Автозаполнение реквизитов по ИНН
- Группировка контрагентов
- История взаимодействий

### 4.5.2 База данных

(Таблицы описаны в разделе 3.2.6)

### 4.5.3 Backend API

#### POST /api/v1/contractors

**Описание:** Создание контрагента

**Тело запроса:**
```json
{
    "contractor_type": 2,
    "type": 10,
    "name": "ООО СтройИнвест",
    "short_name": "СтройИнвест",
    "inn": "7707083893",
    "kpp": "770701001",
    "ogrn": "1027700132195",
    "contact_person": "Иванов Пётр Сергеевич",
    "position": "Генеральный директор",
    "phone": "+7 (495) 123-45-67",
    "email": "info@stroyinvest.ru",
    "legal_address": "г. Москва, ул. Строителей, 15",
    "bank_name": "ПАО Сбербанк",
    "bank_bik": "044525225",
    "bank_account": "40702810938000012345",
    "bank_corr_account": "30101810400000000225",
    "group_id": "gg0e8400-e29b-41d4-a716-446655440070"
}
```

#### GET /api/v1/contractors/search-by-inn/{inn}

**Описание:** Поиск данных контрагента по ИНН (интеграция с DaData)

**Ответ:**
```json
{
    "success": true,
    "data": {
        "name": "ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ \"СТРОЙИНВЕСТ\"",
        "short_name": "ООО \"СТРОЙИНВЕСТ\"",
        "inn": "7707083893",
        "kpp": "770701001",
        "ogrn": "1027700132195",
        "legal_address": "г. Москва, ул. Строителей, 15",
        "director": "Иванов Пётр Сергеевич",
        "status": "ACTIVE"
    }
}
```

### 4.5.4 Критерии приёмки

- [ ] CRUD контрагентов
- [ ] Типы: физ.лицо, юр.лицо
- [ ] Категории: заказчик, поставщик, подрядчик
- [ ] Автозаполнение по ИНН (DaData)
- [ ] Группировка контрагентов
- [ ] Поиск и фильтрация
- [ ] Связь с проектами, сметами, документами

---

## МОДУЛЬ 6: Задачи и дефекты

### 4.6.1 Описание и цели модуля

**Назначение:** Полноценная система управления задачами с кастомными типами, полями и подзадачами (по образцу PlanRadar).

**Бизнес-цели:**
- Отслеживание всех задач и дефектов на проекте
- Гибкая настройка типов задач и полей
- Иерархия задач (подзадачи)
- Полная история изменений
- Интеграция с чертежами (маркеры)

### 4.6.2 База данных

(Таблицы описаны в разделе 3.2.4)

### 4.6.3 Backend API

#### GET /api/v1/tickets

**Описание:** Список задач с фильтрацией

**Query параметры:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| project_id | UUID | Фильтр по проекту |
| status_id | integer | Фильтр по статусу |
| priority_id | integer | Фильтр по приоритету |
| assigned_to_id | UUID | Фильтр по исполнителю |
| ticket_type_id | UUID | Фильтр по типу |
| due_date_from | date | Срок от |
| due_date_to | date | Срок до |
| search | string | Поиск по названию |
| sort | string | Поле сортировки |
| order | string | Направление |

#### POST /api/v1/tickets

**Описание:** Создание задачи

**Тело запроса:**
```json
{
    "project_id": "770e8400-e29b-41d4-a716-446655440002",
    "ticket_type_id": "hh0e8400-e29b-41d4-a716-446655440080",
    "title": "Дефект: повреждение кабеля в щитовой",
    "description": "<p>Обнаружено повреждение изоляции кабеля...</p>",
    "status_id": 1,
    "priority_id": 3,
    "assigned_to_id": "550e8400-e29b-41d4-a716-446655440000",
    "due_date": "2024-02-15T18:00:00Z",
    "component_id": "ii0e8400-e29b-41d4-a716-446655440090",
    "plan_id": "jj0e8400-e29b-41d4-a716-4466554400a0",
    "position_x": 245.5,
    "position_y": 178.3,
    "custom_fields": {
        "severity": "high",
        "category": "electrical"
    }
}
```

#### POST /api/v1/tickets/{id}/lock

**Описание:** Блокировка задачи для редактирования

**Логика:**
1. Проверить, не заблокирована ли уже
2. Если заблокирована другим — вернуть ошибку с информацией кто блокирует
3. Установить is_locked = true, locked_by_id, locked_at
4. Отправить WebSocket-событие

#### POST /api/v1/tickets/{id}/comments

**Описание:** Добавление комментария

**Тело запроса:**
```json
{
    "content": "Проведена проверка, дефект подтверждён. Необходима замена участка кабеля."
}
```

### 4.6.4 Frontend - Интерфейс

#### Страница: Список задач

**URL:** `/projects/{id}/tickets`

**Режимы отображения:**
1. **Таблица** — виртуализированная таблица со всеми задачами
2. **Kanban** — доска со столбцами по статусам
3. **Календарь** — задачи по датам
4. **План** — маркеры на чертеже

**Wireframe Kanban:**
```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│   Открыта    │  В работе    │   Решена     │   Закрыта    │
│     (5)      │     (3)      │     (2)      │     (8)      │
├──────────────┼──────────────┼──────────────┼──────────────┤
│ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │              │
│ │ TKT-001  │ │ │ TKT-004  │ │ │ TKT-007  │ │              │
│ │ Дефект   │ │ │ Монтаж   │ │ │ Провер.  │ │              │
│ │ 🔴 Высок │ │ │ 🟡 Норм  │ │ │ 🟢 Низк  │ │              │
│ │ 👤 ИП    │ │ │ 👤 СА    │ │ │ 👤 МК    │ │              │
│ │ 📅 15.02 │ │ │ 📅 20.02 │ │ │ 📅 10.02 │ │              │
│ └──────────┘ │ └──────────┘ │ └──────────┘ │              │
│ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │              │
│ │ TKT-002  │ │ │ TKT-005  │ │ │ TKT-008  │ │              │
│ │ ...      │ │ │ ...      │ │ │ ...      │ │              │
│ └──────────┘ │ └──────────┘ │ └──────────┘ │              │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

### 4.6.5 Критерии приёмки

- [ ] CRUD задач
- [ ] Кастомные типы задач
- [ ] Кастомные поля (текст, число, дата, список)
- [ ] Статусы с цветовой индикацией
- [ ] Приоритеты
- [ ] Назначение исполнителя
- [ ] Подзадачи (иерархия)
- [ ] Комментарии
- [ ] История изменений (журнал)
- [ ] Вложения файлов
- [ ] Блокировка редактирования
- [ ] Режимы: таблица, Kanban, календарь
- [ ] Маркеры на чертежах
- [ ] Фильтрация и поиск
- [ ] Массовые операции

---

# 5. ПЛАН ВНЕДРЕНИЯ

## 5.1 Последовательность внедрения модулей

```
                    ФАЗА 1 (3-4 мес)
        ┌──────────────────────────────────────┐
        │                                      │
        │   Модуль 1      Модуль 2             │
        │   (Ядро)    →   (Проекты)            │
        │     ↓             ↓                  │
        │   Модуль 5  ←   Модуль 3             │
        │   (Контраг.)    (Сметы)              │
        │                                      │
        └──────────────────────────────────────┘
                         ↓
                    ФАЗА 2 (2-3 мес)
        ┌──────────────────────────────────────┐
        │                                      │
        │   Модуль 4      Модуль 6             │
        │   (Офферы)  →   (Задачи)             │
        │      ↓            ↓                  │
        │           Модуль 10                  │
        │           (Финансы базово)           │
        │                                      │
        └──────────────────────────────────────┘
                         ↓
                    ФАЗА 3 (2 мес)
        ┌──────────────────────────────────────┐
        │                                      │
        │   Модуль 8      Модуль 7             │
        │   (DMS)     →   (Чертежи)            │
        │                                      │
        └──────────────────────────────────────┘
                         ↓
                    ФАЗА 4 (2 мес)
        ┌──────────────────────────────────────┐
        │                                      │
        │   Модуль 9      Модуль 11            │
        │   (Гант)    →   (Закупки)            │
        │                                      │
        └──────────────────────────────────────┘
                         ↓
                    ФАЗА 5 (2 мес)
        ┌──────────────────────────────────────┐
        │                                      │
        │   Модуль 12     Модуль 13            │
        │   (Отчёты)  →   (Согласования)       │
        │                                      │
        └──────────────────────────────────────┘
                         ↓
                    ФАЗА 6 (1-2 мес)
        ┌──────────────────────────────────────┐
        │                                      │
        │   Модуль 14     Модуль 15            │
        │   (Настройки)   (Биллинг)            │
        │                                      │
        └──────────────────────────────────────┘
```

## 5.2 Зависимости между модулями

| Модуль | Зависит от | Блокирует |
|--------|-----------|-----------|
| 1. Ядро | - | Все остальные |
| 2. Проекты | 1 | 3, 4, 6, 7, 8, 9, 10, 11 |
| 3. Сметы | 1, 2, 5 | 4, 10, 11 |
| 4. Офферы | 1, 2, 3, 5 | - |
| 5. Контрагенты | 1 | 2, 3, 4, 10, 11 |
| 6. Задачи | 1, 2 | 7, 9, 13 |
| 7. Чертежи | 1, 2, 8 | 6 (маркеры) |
| 8. DMS | 1, 2 | 7 |
| 9. Гант | 1, 2, 6 | - |
| 10. Финансы | 1, 2, 3, 5 | - |
| 11. Закупки | 1, 2, 3, 5 | - |
| 12. Отчёты | 1, 2, 3, 6 | - |
| 13. Согласования | 1, 2, 6 | - |
| 14. Настройки | 1 | - |
| 15. Биллинг | 1 | - |

## 5.3 Оценка сложности модулей

| Модуль | Сложность | Story Points | Команда |
|--------|:---------:|:------------:|:-------:|
| 1. Ядро | Высокая | 80-100 | 3-4 разработчика |
| 2. Проекты | Средняя | 40-50 | 2 разработчика |
| 3. Сметы | Очень высокая | 120-150 | 4 разработчика |
| 4. Офферы | Высокая | 60-80 | 2-3 разработчика |
| 5. Контрагенты | Низкая | 20-30 | 1-2 разработчика |
| 6. Задачи | Очень высокая | 100-120 | 3-4 разработчика |
| 7. Чертежи | Высокая | 60-80 | 2-3 разработчика |
| 8. DMS | Высокая | 60-80 | 2-3 разработчика |
| 9. Гант | Высокая | 50-70 | 2 разработчика |
| 10. Финансы | Средняя | 40-60 | 2 разработчика |
| 11. Закупки | Средняя | 50-70 | 2 разработчика |
| 12. Отчёты | Высокая | 60-80 | 2-3 разработчика |
| 13. Согласования | Средняя | 40-50 | 2 разработчика |
| 14. Настройки | Низкая | 20-30 | 1-2 разработчика |
| 15. Биллинг | Средняя | 40-60 | 2 разработчика |

**Итого:** ~820-1030 Story Points

## 5.4 Рекомендации по приоритизации

### Критический путь (MVP):
1. **Модуль 1** — без него ничего не работает
2. **Модуль 2** — проекты — основа системы
3. **Модуль 3** — сметирование — ключевой функционал
4. **Модуль 5** — контрагенты — необходимы для смет

### Высокий приоритет:
5. **Модуль 4** — офферы (монетизация)
6. **Модуль 6** — задачи (операционная эффективность)
7. **Модуль 10** — финансы (учёт)

### Средний приоритет:
8. **Модуль 8** — DMS (документооборот)
9. **Модуль 7** — чертежи (визуализация)
10. **Модуль 9** — Гант (планирование)
11. **Модуль 11** — закупки (логистика)

### Низкий приоритет:
12. **Модуль 12** — отчёты (аналитика)
13. **Модуль 13** — согласования (workflow)
14. **Модуль 14** — настройки (кастомизация)
15. **Модуль 15** — биллинг (SaaS)

---

# 6. МИГРАЦИЯ ДАННЫХ

## 6.1 Данные для миграции

| Тип данных | Источник | Объём | Приоритет |
|------------|----------|-------|-----------|
| Пользователи | Текущая БД | ~500 | Критический |
| Компании | Текущая БД | ~50 | Критический |
| Справочники | XLSX/CSV | ~10000 записей | Высокий |
| Проекты | Текущая БД | ~200 | Высокий |
| Сметы | Текущая БД | ~500 | Средний |

## 6.2 План миграции

1. **Подготовка:**
   - Анализ текущей структуры данных
   - Маппинг полей старая → новая БД
   - Разработка скриптов миграции
   - Тестовая миграция на копии

2. **Выполнение:**
   - Создание бэкапа
   - Миграция справочников
   - Миграция пользователей и компаний
   - Миграция проектов
   - Миграция смет
   - Проверка целостности

3. **Откат:**
   - В случае критических ошибок — восстановление из бэкапа
   - Период параллельной работы двух систем

---

# 7. ГЛОССАРИЙ

| Термин | Определение |
|--------|-------------|
| **Акт** | Документ о приёмке выполненных работ |
| **Гант** | Диаграмма Ганта — визуализация графика работ |
| **Дефект** | Выявленное несоответствие или недостаток |
| **DMS** | Document Management System — система управления документами |
| **Контрагент** | Юридическое или физическое лицо — партнёр по проекту |
| **КП** | Коммерческое предложение (оффер) |
| **Наценка** | Процентная или фиксированная надбавка к стоимости |
| **Оффер** | Коммерческое предложение клиенту |
| **RBAC** | Role-Based Access Control — ролевая модель доступа |
| **Раздел сметы** | Группировка работ по функциональному признаку |
| **Расценка** | Единичная стоимость работы или материала |
| **Ресурс** | Материал, работа или механизм в смете |
| **Смета** | Документ с расчётом стоимости работ |
| **Тикет** | Задача в системе трекинга |
| **2FA** | Two-Factor Authentication — двухфакторная аутентификация |
| **WebSocket** | Протокол для двусторонней связи в реальном времени |

---

# ПРИЛОЖЕНИЯ

## A. Список сокращений

| Сокращение | Расшифровка |
|------------|-------------|
| API | Application Programming Interface |
| БД | База данных |
| CRUD | Create, Read, Update, Delete |
| DMS | Document Management System |
| ERD | Entity-Relationship Diagram |
| FK | Foreign Key (внешний ключ) |
| JWT | JSON Web Token |
| MVP | Minimum Viable Product |
| RBAC | Role-Based Access Control |
| REST | Representational State Transfer |
| SaaS | Software as a Service |
| UUID | Universally Unique Identifier |

## B. Технологический стек (рекомендуемый)

| Компонент | Технология |
|-----------|-----------|
| **Frontend** | React 18+, TypeScript, TailwindCSS |
| **State Management** | Redux Toolkit / Zustand |
| **UI Components** | Radix UI / shadcn/ui |
| **Tables** | TanStack Table (React Table) |
| **Gantt** | dhtmlxGantt / DHTMLX Scheduler |
| **PDF Viewer** | react-pdf / PDF.js |
| **WYSIWYG** | TipTap / Slate |
| **Backend** | Node.js (NestJS) / Go |
| **Database** | PostgreSQL 15+ |
| **Cache** | Redis |
| **File Storage** | S3-compatible (MinIO) |
| **Search** | PostgreSQL FTS / Meilisearch |
| **WebSocket** | Socket.io / WS |
| **Queue** | Bull (Redis) |
| **PDF Generation** | Puppeteer / wkhtmltopdf |
| **Email** | Nodemailer + SendGrid |
| **Auth** | Passport.js / Custom JWT |
| **Deployment** | Docker, Kubernetes |

---

**Конец документа**

*Версия 2.0 | Дата: 07.02.2026*

</technical_specification>



---
---
---

# ═══════════════════════════════════════════════════════════════
# ЧАСТЬ 2: МОДУЛИ 7–15
# ═══════════════════════════════════════════════════════════════

# ТЕХНИЧЕСКОЕ ЗАДАНИЕ: ElektroSmeta v2.0
# ЧАСТЬ 2: Модули 7-15

**Продолжение документа TZ_ElektroSmeta_Integration_v2_0.md**

---

## МОДУЛЬ 7: Чертежи и планы

### 4.7.1 Описание и цели модуля

**Назначение:** Управление чертежами и планами проекта с возможностью размещения маркеров задач, аннотаций и версионирования.

**Бизнес-цели:**
- Визуализация задач и дефектов на чертежах
- Аннотирование планов (пометки, замеры)
- Версионирование чертежей (сравнение ревизий)
- Калибровка масштаба для точных измерений

**Связь с другими модулями:**
- **Зависит от:** Модуль 2 (Проекты), Модуль 8 (DMS)
- **Используется:** Модуль 6 (Задачи — маркеры на планах)

### 4.7.2 Роли и права доступа

| Действие | Владелец | Админ | Рук. проектов | Сметчик | Прораб | Субподр. | Наблюд. |
|----------|:--------:|:-----:|:-------------:|:-------:|:------:|:--------:|:-------:|
| Просмотр чертежей | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Загрузка чертежей | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Управление компонентами | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Создание аннотаций | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Удаление своих аннотаций | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Удаление чужих аннотаций | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Калибровка масштаба | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Версионирование | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

### 4.7.3 База данных

```sql
-- Таблица: components (Компоненты/Этажи/Секции)
CREATE TABLE components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES components(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Индексы для components
CREATE INDEX idx_components_project ON components(project_id);
CREATE INDEX idx_components_parent ON components(parent_id);

-- Таблица: plans (Чертежи/Планы)
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    file_id UUID REFERENCES dms_files(id),
    file_url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500),
    original_filename VARCHAR(255),
    mime_type VARCHAR(100),
    file_size BIGINT,
    width INTEGER, -- ширина в пикселях
    height INTEGER, -- высота в пикселях
    -- Калибровка масштаба
    calibration_enabled BOOLEAN DEFAULT FALSE,
    calibration_length DECIMAL(10, 4), -- реальная длина (метры)
    calibration_pixels INTEGER, -- длина в пикселях
    scale_ratio DECIMAL(15, 8), -- метров на пиксель
    -- Версионирование
    version INTEGER DEFAULT 1,
    is_current_version BOOLEAN DEFAULT TRUE,
    parent_plan_id UUID REFERENCES plans(id),
    -- Метаданные
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Индексы для plans
CREATE INDEX idx_plans_project ON plans(project_id);
CREATE INDEX idx_plans_component ON plans(component_id);
CREATE INDEX idx_plans_current_version ON plans(is_current_version) WHERE is_current_version = TRUE;

-- Таблица: plan_markups (Аннотации на планах)
CREATE TABLE plan_markups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id),
    -- Тип аннотации
    markup_type VARCHAR(50) NOT NULL, -- line, rectangle, circle, ellipse, polygon, polyline, text, arrow, freehand, measurement
    -- Геометрия (JSON)
    geometry JSONB NOT NULL, -- {points: [{x, y}], ...}
    -- Стили
    stroke_color VARCHAR(20) DEFAULT '#FF0000',
    stroke_width INTEGER DEFAULT 2,
    fill_color VARCHAR(20),
    fill_opacity DECIMAL(3, 2) DEFAULT 0,
    font_size INTEGER DEFAULT 14,
    font_family VARCHAR(100) DEFAULT 'Arial',
    -- Содержимое для текста
    text_content TEXT,
    -- Измерения
    measurement_value DECIMAL(15, 4), -- результат измерения в метрах
    measurement_unit VARCHAR(20) DEFAULT 'm',
    -- Видимость
    is_visible BOOLEAN DEFAULT TRUE,
    layer VARCHAR(50) DEFAULT 'default',
    z_index INTEGER DEFAULT 0,
    -- Метаданные
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Индексы для plan_markups
CREATE INDEX idx_plan_markups_plan ON plan_markups(plan_id);
CREATE INDEX idx_plan_markups_author ON plan_markups(author_id);
CREATE INDEX idx_plan_markups_type ON plan_markups(markup_type);

-- Таблица: plan_layers (Слои на планах)
CREATE TABLE plan_layers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    color VARCHAR(20) DEFAULT '#000000',
    is_visible BOOLEAN DEFAULT TRUE,
    is_locked BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица: plan_view_settings (Сохранённые настройки вида)
CREATE TABLE plan_view_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    zoom_level DECIMAL(5, 2) DEFAULT 1.0,
    pan_x DECIMAL(10, 2) DEFAULT 0,
    pan_y DECIMAL(10, 2) DEFAULT 0,
    visible_layers JSONB DEFAULT '[]',
    filters JSONB DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(plan_id, user_id)
);
```

### 4.7.4 Backend API

#### GET /api/v1/projects/{projectId}/components

**Описание:** Получение дерева компонентов проекта

**Query параметры:**

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| expand | string | - | plans, plans.tickets_count |
| flat | boolean | false | Плоский список вместо дерева |

**Ответ:**
```json
{
    "success": true,
    "data": [
        {
            "id": "comp-001",
            "name": "Корпус А",
            "code": "A",
            "sort_order": 1,
            "children": [
                {
                    "id": "comp-002",
                    "name": "Этаж 1",
                    "code": "A-1",
                    "sort_order": 1,
                    "plans": [
                        {
                            "id": "plan-001",
                            "name": "План освещения",
                            "thumbnail_url": "/storage/thumbnails/plan-001.jpg",
                            "tickets_count": 5
                        }
                    ],
                    "children": []
                }
            ]
        }
    ]
}
```

#### POST /api/v1/projects/{projectId}/components

**Описание:** Создание компонента (этажа/секции)

**Тело запроса:**
```json
{
    "name": "Этаж 2",
    "code": "A-2",
    "parent_id": "comp-001",
    "description": "Второй этаж корпуса А"
}
```

**Валидация:**
- name: required, min 1, max 255
- code: optional, max 50, unique within project
- parent_id: optional, must exist in same project

**Ответ:**
```json
{
    "success": true,
    "data": {
        "id": "comp-003",
        "project_id": "project-001",
        "parent_id": "comp-001",
        "name": "Этаж 2",
        "code": "A-2",
        "sort_order": 2,
        "created_at": "2024-02-10T10:00:00Z"
    }
}
```

#### POST /api/v1/components/{componentId}/plans

**Описание:** Загрузка чертежа к компоненту

**Заголовки:**
```
Content-Type: multipart/form-data
```

**Параметры формы:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| file | File | Файл чертежа (PDF, PNG, JPG, TIFF, DWG) |
| name | string | Название плана |
| description | string | Описание (опционально) |

**Логика обработки:**
1. Валидация файла (размер ≤ 100MB, допустимый формат)
2. Если PDF — конвертировать первую страницу в PNG для превью
3. Если DWG — конвертировать в PNG (через LibreCAD/ODA)
4. Создать thumbnail (400x400)
5. Определить ширину и высоту в пикселях
6. Сохранить файл в S3 (/projects/{projectId}/plans/)
7. Создать запись в таблице plans
8. Вернуть созданный план

**Ответ:**
```json
{
    "success": true,
    "data": {
        "id": "plan-002",
        "component_id": "comp-003",
        "name": "План розеточной сети",
        "file_url": "/storage/projects/p001/plans/plan-002.pdf",
        "thumbnail_url": "/storage/projects/p001/plans/plan-002_thumb.jpg",
        "width": 4961,
        "height": 3508,
        "version": 1,
        "calibration_enabled": false,
        "created_at": "2024-02-10T11:00:00Z"
    }
}
```

#### GET /api/v1/plans/{planId}

**Описание:** Получение плана с маркерами и аннотациями

**Query параметры:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| expand | string | markups, tickets, layers |
| ticket_filters | object | Фильтры для задач (status_id, assigned_to_id) |

**Ответ:**
```json
{
    "success": true,
    "data": {
        "id": "plan-001",
        "name": "План освещения",
        "file_url": "/storage/projects/p001/plans/plan-001.pdf",
        "width": 4961,
        "height": 3508,
        "calibration": {
            "enabled": true,
            "length": 5.0,
            "pixels": 500,
            "scale_ratio": 0.01
        },
        "markups": [
            {
                "id": "markup-001",
                "markup_type": "rectangle",
                "geometry": {
                    "x": 100,
                    "y": 200,
                    "width": 50,
                    "height": 30
                },
                "stroke_color": "#FF0000",
                "stroke_width": 2,
                "author": {
                    "id": "user-001",
                    "name": "Иван Петров"
                }
            }
        ],
        "tickets": [
            {
                "id": "ticket-001",
                "code": "TKT-001",
                "title": "Дефект проводки",
                "status": {"id": 1, "name": "Открыта", "color": "red"},
                "position_x": 245.5,
                "position_y": 178.3
            }
        ],
        "layers": [
            {"id": "layer-1", "name": "Аннотации", "slug": "annotations", "is_visible": true},
            {"id": "layer-2", "name": "Задачи", "slug": "tickets", "is_visible": true}
        ]
    }
}
```

#### PUT /api/v1/plans/{planId}/calibrate

**Описание:** Калибровка масштаба плана

**Тело запроса:**
```json
{
    "calibration_length": 10.5,
    "calibration_pixels": 1050,
    "calibration_unit": "m"
}
```

**Логика:**
1. Рассчитать scale_ratio = calibration_length / calibration_pixels
2. Обновить план
3. Пересчитать все measurement_value в markups

**Ответ:**
```json
{
    "success": true,
    "data": {
        "calibration_enabled": true,
        "scale_ratio": 0.01,
        "message": "Масштаб: 1 пиксель = 0.01 м"
    }
}
```

#### POST /api/v1/plans/{planId}/markups

**Описание:** Создание аннотации на плане

**Тело запроса:**
```json
{
    "markup_type": "measurement",
    "geometry": {
        "points": [
            {"x": 100, "y": 200},
            {"x": 300, "y": 200}
        ]
    },
    "stroke_color": "#00FF00",
    "stroke_width": 2,
    "layer": "measurements"
}
```

**Типы аннотаций:**

| Тип | Геометрия | Описание |
|-----|-----------|----------|
| line | {points: [{x,y}, {x,y}]} | Линия |
| arrow | {points: [{x,y}, {x,y}]} | Стрелка |
| rectangle | {x, y, width, height} | Прямоугольник |
| circle | {cx, cy, radius} | Окружность |
| ellipse | {cx, cy, rx, ry} | Эллипс |
| polygon | {points: [{x,y}, ...]} | Многоугольник |
| polyline | {points: [{x,y}, ...]} | Ломаная линия |
| freehand | {points: [{x,y}, ...]} | Свободное рисование |
| text | {x, y} + text_content | Текстовая метка |
| measurement | {points: [{x,y}, {x,y}]} | Измерение расстояния |

**Логика для measurement:**
1. Получить scale_ratio плана
2. Рассчитать расстояние в пикселях: sqrt((x2-x1)² + (y2-y1)²)
3. Рассчитать measurement_value = pixels * scale_ratio
4. Сохранить аннотацию

#### POST /api/v1/plans/{planId}/versions

**Описание:** Загрузка новой версии плана

**Тело запроса (multipart/form-data):**
- file: новый файл плана
- comment: комментарий к версии

**Логика:**
1. Загрузить новый файл
2. Установить is_current_version = FALSE для текущей версии
3. Создать новую запись с version = old_version + 1, parent_plan_id = old_id
4. Скопировать калибровку с предыдущей версии

**Ответ:**
```json
{
    "success": true,
    "data": {
        "id": "plan-001-v2",
        "version": 2,
        "parent_plan_id": "plan-001",
        "is_current_version": true,
        "created_at": "2024-02-15T12:00:00Z"
    }
}
```

#### GET /api/v1/plans/{planId}/versions

**Описание:** Получение истории версий плана

**Ответ:**
```json
{
    "success": true,
    "data": [
        {
            "id": "plan-001-v2",
            "version": 2,
            "is_current_version": true,
            "created_by": {"id": "user-001", "name": "Иван Петров"},
            "created_at": "2024-02-15T12:00:00Z"
        },
        {
            "id": "plan-001",
            "version": 1,
            "is_current_version": false,
            "created_by": {"id": "user-002", "name": "Мария Сидорова"},
            "created_at": "2024-02-01T10:00:00Z"
        }
    ]
}
```

### 4.7.5 Frontend - Интерфейс пользователя

#### Страница: Просмотрщик чертежей

**URL:** `/projects/{id}/plans/{planId}`

**Wireframe:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [← Проект] Корпус А / Этаж 1 / План освещения      [Версии ▼] [Экспорт ▼]  │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌────────────────────────────────────────────────────────┐  │
│ │ ИНСТРУМЕНТЫ │ │                                                        │  │
│ │             │ │                                                        │  │
│ │ [✋] Рука    │ │                    🔴 TKT-001                          │  │
│ │ [📍] Маркер │ │                       ↙                               │  │
│ │ [📏] Измер. │ │     ┌──────────────────────────────────┐              │  │
│ │ [📐] Линия  │ │     │                                  │              │  │
│ │ [▭] Прямоуг.│ │     │      [ПЛАН ЭТАЖА]               │              │  │
│ │ [○] Круг    │ │     │                                  │   🔴 TKT-003 │  │
│ │ [T] Текст   │ │     │                                  │       ↘      │  │
│ │ [🖌] Свобод.│ │     │        10.5 м                    │              │  │
│ │             │ │     │      ←────────→                  │              │  │
│ │ ─────────── │ │     │                                  │              │  │
│ │ СЛОИ        │ │     └──────────────────────────────────┘              │  │
│ │ [✓] Аннотац.│ │                                                        │  │
│ │ [✓] Задачи  │ │                      🟡 TKT-002                        │  │
│ │ [✓] Измерен.│ │                                                        │  │
│ │             │ │                                                        │  │
│ └─────────────┘ └────────────────────────────────────────────────────────┘  │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐│
│ │ [🔍-] [100%] [🔍+]  │  [⟲ Влево] [⟳ Вправо]  │  [⛶ Во весь экран]      ││
│ └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

**Элементы интерфейса:**

| Элемент | Тип | Поведение |
|---------|-----|-----------|
| Канвас плана | Canvas/SVG | Panning, zooming (колесо мыши), click для маркеров |
| Панель инструментов | Toolbar | Выбор инструмента рисования |
| Маркеры задач | Clickable pins | Клик → открытие карточки задачи |
| Слои | Checkboxes | Переключение видимости |
| Зум | Slider + buttons | 10%-400% |
| Измерение | Interactive | Две точки → показать расстояние |

**Состояния:**
- **Загрузка:** Skeleton с прогресс-баром
- **Ошибка:** Сообщение + кнопка "Повторить"
- **Пустой план:** Placeholder с кнопкой загрузки

**Модальные окна:**

1. **Калибровка масштаба:**
```
┌─────────────────────────────────────────┐
│ Калибровка масштаба            [✕]     │
├─────────────────────────────────────────┤
│                                         │
│ Отметьте на плане отрезок известной     │
│ длины, затем введите его реальный       │
│ размер.                                 │
│                                         │
│ [========= ПЛАН С ЛИНИЕЙ =========]    │
│                                         │
│ Длина отрезка: [____10.5___] м          │
│ Измерено: 1050 пикселей                 │
│                                         │
│ Масштаб: 1 пиксель = 0.01 м             │
│                                         │
│        [Отмена]    [Сохранить]          │
└─────────────────────────────────────────┘
```

2. **Сравнение версий:**
```
┌─────────────────────────────────────────────────────────────┐
│ Сравнение версий                                    [✕]     │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────┐ ┌─────────────────────┐            │
│ │ Версия 1 (01.02.24) │ │ Версия 2 (15.02.24) │            │
│ │                     │ │                     │            │
│ │                     │ │   [ИЗМЕНЁННЫЕ      │            │
│ │   [ПЛАН]            │ │    ОБЛАСТИ          │            │
│ │                     │ │    ПОДСВЕЧЕНЫ]      │            │
│ │                     │ │                     │            │
│ └─────────────────────┘ └─────────────────────┘            │
│                                                             │
│ [◀ Пред. версия]  [Наложить]  [След. версия ▶]             │
└─────────────────────────────────────────────────────────────┘
```

### 4.7.6 Бизнес-логика

**Создание маркера задачи на плане:**
1. Пользователь выбирает инструмент "Маркер"
2. Кликает на план → фиксируется position_x, position_y
3. Открывается форма создания задачи с предзаполненным plan_id
4. После сохранения задачи маркер появляется на плане

**Измерение расстояния:**
1. Пользователь выбирает инструмент "Измерение"
2. Кликает первую точку
3. Кликает вторую точку
4. Система рассчитывает: distance_m = sqrt(Δx² + Δy²) × scale_ratio
5. Отображается линия с подписью "X.XX м"
6. При клике "Сохранить" — создаётся аннотация типа measurement

**Пересчёт измерений при рекалибровке:**
1. При изменении calibration обновляется scale_ratio
2. Для всех markups типа measurement пересчитывается measurement_value
3. Обновляются подписи на фронтенде

### 4.7.7 Интеграции

| Модуль | Тип связи | Данные |
|--------|-----------|--------|
| Задачи | Маркеры на плане | ticket.plan_id, position_x, position_y |
| DMS | Хранение файлов | plan.file_id → dms_files.id |

### 4.7.8 Критерии приёмки

- [ ] CRUD компонентов (этажей/секций)
- [ ] Иерархическая структура компонентов
- [ ] Загрузка планов (PDF, PNG, JPG, TIFF)
- [ ] Конвертация DWG (опционально)
- [ ] Просмотр с зумом и панорамированием
- [ ] Калибровка масштаба
- [ ] Инструмент измерения расстояний
- [ ] Создание аннотаций (линии, прямоугольники, круги, текст)
- [ ] Слои с переключением видимости
- [ ] Версионирование планов
- [ ] Сравнение версий
- [ ] Отображение маркеров задач
- [ ] Создание задачи кликом на план
- [ ] Экспорт плана с аннотациями в PDF

---

## МОДУЛЬ 8: Документооборот (DMS)

### 4.8.1 Описание и цели модуля

**Назначение:** Полноценная система управления документами с иерархической структурой папок, версионированием, правами доступа и логированием активности.

**Бизнес-цели:**
- Централизованное хранение всех документов проекта
- Контроль версий документов
- Гранулярные права доступа на файлы и папки
- Аудит действий с документами
- Поиск по содержимому

**Связь с другими модулями:**
- **Зависит от:** Модуль 1 (Ядро), Модуль 2 (Проекты)
- **Используется:** Модуль 6 (Задачи — вложения), Модуль 7 (Чертежи)

### 4.8.2 Роли и права доступа

| Действие | Владелец | Админ | Рук. проектов | Сметчик | Прораб | Субподр. | Наблюд. |
|----------|:--------:|:-----:|:-------------:|:-------:|:------:|:--------:|:-------:|
| Просмотр файлов | ✅ | ✅ | ✅ | ✅ | ✅ | Свои | ✅ |
| Скачивание | ✅ | ✅ | ✅ | ✅ | ✅ | Свои | ✅ |
| Загрузка файлов | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Создание папок | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Переименование | ✅ | ✅ | ✅ | Свои | Свои | Свои | ❌ |
| Перемещение | ✅ | ✅ | ✅ | Свои | ❌ | ❌ | ❌ |
| Удаление | ✅ | ✅ | ✅ | Свои | ❌ | ❌ | ❌ |
| Управление правами | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Просмотр логов | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Восстановление из корзины | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

### 4.8.3 База данных

```sql
-- Таблица: dms_folders (Папки DMS)
CREATE TABLE dms_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE, -- NULL = папка компании
    parent_id UUID REFERENCES dms_folders(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    path TEXT NOT NULL, -- /root/folder1/folder2
    path_ids UUID[] NOT NULL DEFAULT '{}', -- массив id для быстрого поиска
    color VARCHAR(20) DEFAULT 'gray',
    is_system BOOLEAN DEFAULT FALSE, -- системные папки (например, "Корзина")
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by_id UUID REFERENCES users(id)
);

-- Индексы для dms_folders
CREATE INDEX idx_dms_folders_company ON dms_folders(company_id);
CREATE INDEX idx_dms_folders_project ON dms_folders(project_id);
CREATE INDEX idx_dms_folders_parent ON dms_folders(parent_id);
CREATE INDEX idx_dms_folders_path ON dms_folders USING GIN(path_ids);
CREATE INDEX idx_dms_folders_deleted ON dms_folders(deleted_at) WHERE deleted_at IS NOT NULL;

-- Таблица: dms_files (Файлы DMS)
CREATE TABLE dms_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES dms_folders(id) ON DELETE SET NULL,
    -- Информация о файле
    name VARCHAR(255) NOT NULL, -- отображаемое имя
    original_name VARCHAR(255) NOT NULL, -- оригинальное имя при загрузке
    extension VARCHAR(20),
    mime_type VARCHAR(100),
    size BIGINT NOT NULL, -- размер в байтах
    -- Хранение
    storage_path VARCHAR(500) NOT NULL, -- путь в S3
    url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500),
    preview_url VARCHAR(500), -- для PDF-превью
    -- Версионирование
    version INTEGER DEFAULT 1,
    is_current_version BOOLEAN DEFAULT TRUE,
    parent_file_id UUID REFERENCES dms_files(id), -- предыдущая версия
    version_comment TEXT,
    -- Метаданные
    checksum VARCHAR(64), -- SHA-256
    metadata JSONB DEFAULT '{}', -- произвольные метаданные (EXIF, размеры, etc.)
    -- Полнотекстовый поиск
    content_text TEXT, -- извлечённый текст для поиска
    search_vector TSVECTOR,
    -- Аудит
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by_id UUID REFERENCES users(id)
);

-- Индексы для dms_files
CREATE INDEX idx_dms_files_company ON dms_files(company_id);
CREATE INDEX idx_dms_files_project ON dms_files(project_id);
CREATE INDEX idx_dms_files_folder ON dms_files(folder_id);
CREATE INDEX idx_dms_files_current ON dms_files(is_current_version) WHERE is_current_version = TRUE;
CREATE INDEX idx_dms_files_search ON dms_files USING GIN(search_vector);
CREATE INDEX idx_dms_files_deleted ON dms_files(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_dms_files_extension ON dms_files(extension);

-- Триггер для обновления search_vector
CREATE OR REPLACE FUNCTION dms_files_search_trigger() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('russian', coalesce(NEW.name, '')), 'A') ||
        setweight(to_tsvector('russian', coalesce(NEW.content_text, '')), 'B');
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER dms_files_search_update
    BEFORE INSERT OR UPDATE ON dms_files
    FOR EACH ROW EXECUTE FUNCTION dms_files_search_trigger();

-- Таблица: dms_file_permissions (Права на файлы/папки)
CREATE TABLE dms_file_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Целевой объект (файл ИЛИ папка)
    file_id UUID REFERENCES dms_files(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES dms_folders(id) ON DELETE CASCADE,
    -- Субъект (пользователь ИЛИ роль)
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    -- Права
    permission VARCHAR(20) NOT NULL, -- view, download, edit, delete, manage
    -- Наследование
    inherited BOOLEAN DEFAULT FALSE, -- унаследовано от родительской папки
    inherited_from_id UUID REFERENCES dms_folders(id),
    -- Метаданные
    granted_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE, -- срок действия права
    -- Ограничения
    CHECK (
        (file_id IS NOT NULL AND folder_id IS NULL) OR
        (file_id IS NULL AND folder_id IS NOT NULL)
    ),
    CHECK (
        (user_id IS NOT NULL AND role_id IS NULL) OR
        (user_id IS NULL AND role_id IS NOT NULL)
    )
);

-- Индексы для dms_file_permissions
CREATE INDEX idx_dms_perms_file ON dms_file_permissions(file_id);
CREATE INDEX idx_dms_perms_folder ON dms_file_permissions(folder_id);
CREATE INDEX idx_dms_perms_user ON dms_file_permissions(user_id);
CREATE INDEX idx_dms_perms_role ON dms_file_permissions(role_id);

-- Таблица: dms_activity_log (Лог активности DMS)
CREATE TABLE dms_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id),
    file_id UUID REFERENCES dms_files(id) ON DELETE SET NULL,
    folder_id UUID REFERENCES dms_folders(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    -- Действие
    action VARCHAR(50) NOT NULL, -- created, viewed, downloaded, updated, renamed, moved, deleted, restored, permission_changed, version_created
    -- Детали
    details JSONB, -- {old_name, new_name, old_folder_id, new_folder_id, version, etc.}
    -- Контекст
    ip_address VARCHAR(45),
    user_agent TEXT,
    session_id UUID,
    -- Время
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для dms_activity_log
CREATE INDEX idx_dms_log_company ON dms_activity_log(company_id);
CREATE INDEX idx_dms_log_file ON dms_activity_log(file_id);
CREATE INDEX idx_dms_log_folder ON dms_activity_log(folder_id);
CREATE INDEX idx_dms_log_user ON dms_activity_log(user_id);
CREATE INDEX idx_dms_log_action ON dms_activity_log(action);
CREATE INDEX idx_dms_log_created ON dms_activity_log(created_at DESC);

-- Таблица: dms_bookmarks (Закладки)
CREATE TABLE dms_bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_id UUID REFERENCES dms_files(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES dms_folders(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (
        (file_id IS NOT NULL AND folder_id IS NULL) OR
        (file_id IS NULL AND folder_id IS NOT NULL)
    ),
    UNIQUE(user_id, file_id),
    UNIQUE(user_id, folder_id)
);

-- Таблица: dms_file_uploads (Чанковая загрузка)
CREATE TABLE dms_file_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES dms_folders(id),
    project_id UUID REFERENCES projects(id),
    -- Информация о файле
    filename VARCHAR(255) NOT NULL,
    total_size BIGINT NOT NULL,
    total_chunks INTEGER NOT NULL,
    uploaded_chunks INTEGER DEFAULT 0,
    -- Состояние
    status VARCHAR(20) DEFAULT 'uploading', -- uploading, processing, completed, failed
    temp_path VARCHAR(500), -- путь к временной директории
    error_message TEXT,
    -- Метаданные
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours'
);
```

### 4.8.4 Backend API

#### GET /api/v1/projects/{projectId}/dms/tree

**Описание:** Получение дерева папок проекта

**Query параметры:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| include_files | boolean | Включить файлы в ответ |
| include_trash | boolean | Включить корзину |

**Ответ:**
```json
{
    "success": true,
    "data": {
        "id": "root",
        "name": "Документы проекта",
        "children": [
            {
                "id": "folder-001",
                "name": "Проектная документация",
                "type": "folder",
                "color": "blue",
                "files_count": 15,
                "children": [
                    {
                        "id": "folder-002",
                        "name": "Чертежи",
                        "type": "folder",
                        "files_count": 8,
                        "children": []
                    }
                ]
            },
            {
                "id": "folder-003",
                "name": "Договоры",
                "type": "folder",
                "color": "green",
                "files_count": 3,
                "children": []
            }
        ],
        "trash": {
            "id": "trash",
            "name": "Корзина",
            "type": "folder",
            "is_system": true,
            "files_count": 2
        }
    }
}
```

#### GET /api/v1/dms/folders/{folderId}/contents

**Описание:** Получение содержимого папки

**Query параметры:**

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| page | integer | 1 | Страница |
| per_page | integer | 50 | Элементов на странице |
| sort | string | name | Поле сортировки |
| order | string | asc | Направление |
| search | string | - | Поиск по имени |
| type | string | - | Фильтр по типу (folder, file, image, document, etc.) |
| folders_on_top | boolean | true | Папки в начале |

**Ответ:**
```json
{
    "success": true,
    "data": {
        "folder": {
            "id": "folder-001",
            "name": "Проектная документация",
            "path": "/Проектная документация",
            "breadcrumbs": [
                {"id": "root", "name": "Документы проекта"},
                {"id": "folder-001", "name": "Проектная документация"}
            ]
        },
        "items": [
            {
                "id": "folder-002",
                "type": "folder",
                "name": "Чертежи",
                "color": "gray",
                "items_count": 8,
                "created_at": "2024-01-15T10:00:00Z",
                "created_by": {"id": "user-001", "name": "Иван Петров"}
            },
            {
                "id": "file-001",
                "type": "file",
                "name": "ТЗ_v1.docx",
                "extension": "docx",
                "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "size": 1548576,
                "version": 3,
                "thumbnail_url": "/thumbnails/file-001.png",
                "created_at": "2024-01-20T14:30:00Z",
                "updated_at": "2024-02-05T09:15:00Z",
                "created_by": {"id": "user-002", "name": "Мария Сидорова"}
            }
        ],
        "pagination": {
            "page": 1,
            "per_page": 50,
            "total": 12,
            "total_pages": 1
        }
    }
}
```

#### POST /api/v1/dms/folders

**Описание:** Создание папки

**Тело запроса:**
```json
{
    "project_id": "project-001",
    "parent_id": "folder-001",
    "name": "Акты",
    "color": "orange"
}
```

**Логика:**
1. Проверить права на создание в parent_id
2. Проверить уникальность имени в parent_id
3. Сформировать path = parent.path + "/" + name
4. Сформировать path_ids = parent.path_ids + [id]
5. Создать запись
6. Записать в activity_log

#### POST /api/v1/dms/files/upload

**Описание:** Загрузка файла (простая, до 50MB)

**Заголовки:**
```
Content-Type: multipart/form-data
```

**Параметры формы:**
- file: File
- folder_id: UUID
- project_id: UUID (если folder_id нет)

**Логика обработки:**
1. Валидация размера (≤ 50MB)
2. Валидация типа файла (блэклист: .exe, .bat, .sh, etc.)
3. Генерация уникального storage_path
4. Расчёт checksum (SHA-256)
5. Проверка дубликата по checksum
6. Загрузка в S3
7. Создание thumbnail (для изображений и PDF)
8. Извлечение текста (для PDF, DOCX, TXT)
9. Создание записи в dms_files
10. Запись в activity_log

**Ответ:**
```json
{
    "success": true,
    "data": {
        "id": "file-002",
        "name": "Смета_ЖК_Горизонт.xlsx",
        "extension": "xlsx",
        "size": 245760,
        "url": "/storage/dms/file-002.xlsx",
        "thumbnail_url": "/thumbnails/file-002.png",
        "version": 1,
        "created_at": "2024-02-10T15:00:00Z"
    }
}
```

#### POST /api/v1/dms/files/upload-chunk

**Описание:** Чанковая загрузка (для файлов > 50MB)

**Параметры формы:**
- upload_id: UUID (опционально, генерируется при первом чанке)
- chunk: File (часть файла)
- chunk_index: integer
- total_chunks: integer
- filename: string (только при первом чанке)
- total_size: integer (только при первом чанке)
- folder_id: UUID (только при первом чанке)

**Логика:**
1. Если upload_id нет — создать запись в dms_file_uploads
2. Сохранить чанк в temp директорию
3. Увеличить uploaded_chunks
4. Если uploaded_chunks == total_chunks — объединить чанки, создать файл

**Ответ (промежуточный):**
```json
{
    "success": true,
    "data": {
        "upload_id": "upload-001",
        "uploaded_chunks": 5,
        "total_chunks": 10,
        "progress_percent": 50
    }
}
```

**Ответ (финальный):**
```json
{
    "success": true,
    "data": {
        "status": "completed",
        "file": {
            "id": "file-003",
            "name": "Архив_проекта.zip",
            "size": 524288000
        }
    }
}
```

#### POST /api/v1/dms/files/{fileId}/versions

**Описание:** Загрузка новой версии файла

**Параметры формы:**
- file: File
- comment: string

**Логика:**
1. Проверить права на редактирование
2. Загрузить новый файл
3. Установить is_current_version = FALSE для текущей версии
4. Создать новую запись с version = old.version + 1, parent_file_id = old.id
5. Записать в activity_log (action: version_created)

#### GET /api/v1/dms/files/{fileId}/versions

**Описание:** История версий файла

**Ответ:**
```json
{
    "success": true,
    "data": [
        {
            "id": "file-001-v3",
            "version": 3,
            "is_current_version": true,
            "size": 1548576,
            "comment": "Добавлены требования к API",
            "created_by": {"id": "user-002", "name": "Мария Сидорова"},
            "created_at": "2024-02-05T09:15:00Z"
        },
        {
            "id": "file-001-v2",
            "version": 2,
            "is_current_version": false,
            "size": 1245184,
            "comment": "Исправлены опечатки",
            "created_by": {"id": "user-001", "name": "Иван Петров"},
            "created_at": "2024-01-25T11:30:00Z"
        }
    ]
}
```

#### PATCH /api/v1/dms/nodes/{nodeId}/move

**Описание:** Перемещение файла или папки

**Тело запроса:**
```json
{
    "target_folder_id": "folder-003"
}
```

**Логика для папки:**
1. Проверить, что target не является потомком перемещаемой папки
2. Обновить parent_id
3. Рекурсивно обновить path и path_ids для всех потомков

#### DELETE /api/v1/dms/nodes/{nodeId}

**Описание:** Удаление файла или папки (в корзину)

**Логика:**
1. Установить deleted_at = NOW(), deleted_by_id
2. Для папки — рекурсивно удалить всё содержимое
3. Записать в activity_log

#### POST /api/v1/dms/nodes/{nodeId}/restore

**Описание:** Восстановление из корзины

#### GET /api/v1/dms/search

**Описание:** Полнотекстовый поиск по документам

**Query параметры:**
- q: string (поисковый запрос)
- project_id: UUID
- folder_id: UUID (искать в папке и подпапках)
- type: string (file, folder, image, document, spreadsheet, presentation)
- date_from, date_to: datetime

**SQL-запрос:**
```sql
SELECT f.*, 
       ts_rank(f.search_vector, plainto_tsquery('russian', $1)) AS rank
FROM dms_files f
WHERE f.project_id = $2
  AND f.deleted_at IS NULL
  AND f.is_current_version = TRUE
  AND f.search_vector @@ plainto_tsquery('russian', $1)
ORDER BY rank DESC
LIMIT 50;
```

#### GET /api/v1/dms/activity-log

**Описание:** Журнал активности

**Query параметры:**
- project_id, folder_id, file_id, user_id
- action: string[]
- date_from, date_to

**Ответ:**
```json
{
    "success": true,
    "data": [
        {
            "id": "log-001",
            "action": "downloaded",
            "user": {"id": "user-001", "name": "Иван Петров"},
            "file": {"id": "file-001", "name": "ТЗ_v1.docx"},
            "details": {},
            "ip_address": "192.168.1.100",
            "created_at": "2024-02-10T14:30:00Z"
        },
        {
            "id": "log-002",
            "action": "renamed",
            "user": {"id": "user-002", "name": "Мария Сидорова"},
            "file": {"id": "file-002", "name": "Смета_финал.xlsx"},
            "details": {"old_name": "Смета_v2.xlsx", "new_name": "Смета_финал.xlsx"},
            "created_at": "2024-02-10T12:00:00Z"
        }
    ]
}
```

### 4.8.5 Frontend - Интерфейс пользователя

#### Страница: Файловый менеджер

**URL:** `/projects/{id}/documents`

**Wireframe:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [← Проект] Документы                    🔍 Поиск...    [↑ Загрузить] [+ Папка]│
├──────────────────────┬──────────────────────────────────────────────────────┤
│                      │ 📁 Документы проекта > Проектная документация        │
│ НАВИГАЦИЯ            │──────────────────────────────────────────────────────│
│                      │                                                      │
│ 📁 Документы проекта │ ☐  Имя                 Размер   Изменён      Автор   │
│  ├─📁 Проектная док. │ ─────────────────────────────────────────────────────│
│  │  ├─📁 Чертежи     │ ☐ 📁 Чертежи           8 файлов 05.02.2024  Петров   │
│  │  └─📁 Спецификац. │ ☐ 📁 Спецификации      3 файла  01.02.2024  Сидорова │
│  ├─📁 Договоры       │ ☐ 📄 ТЗ_v1.docx        1.5 MB   05.02.2024  Сидорова │
│  ├─📁 Акты           │ ☐ 📊 Смета_финал.xlsx  245 KB   10.02.2024  Петров   │
│  └─📁 Фотоотчёты     │ ☐ 📷 Фото_001.jpg      2.3 MB   08.02.2024  Иванов   │
│                      │                                                      │
│ ─────────────────    │                                                      │
│ ⭐ Избранное         │                                                      │
│  └─📄 ТЗ_v1.docx     │                                                      │
│                      │                                                      │
│ 🗑 Корзина (2)       │                                                      │
│                      │──────────────────────────────────────────────────────│
│                      │ Выбрано: 0  │  Всего: 5 элементов  │  152.3 MB      │
└──────────────────────┴──────────────────────────────────────────────────────┘
```

**Элементы интерфейса:**

| Элемент | Тип | Поведение |
|---------|-----|-----------|
| Дерево папок | TreeView | Раскрытие/сворачивание, drag&drop |
| Таблица файлов | DataTable | Сортировка, выделение, контекстное меню |
| Drag & Drop | Upload zone | Перетаскивание файлов для загрузки |
| Поиск | Input | Поиск по имени и содержимому |
| Чекбоксы | Checkbox | Множественный выбор |
| Контекстное меню | ContextMenu | Скачать, переименовать, переместить, удалить |
| Breadcrumbs | Breadcrumb | Навигация по пути |

**Контекстное меню файла:**
```
┌────────────────────┐
│ 👁 Просмотр        │
│ ⬇ Скачать         │
│ ─────────────────  │
│ ✏️ Переименовать   │
│ 📂 Переместить в...│
│ 📋 Копировать      │
│ ─────────────────  │
│ 🔗 Получить ссылку │
│ ⭐ В избранное     │
│ ─────────────────  │
│ 📜 История версий  │
│ 📊 Активность      │
│ 🔒 Права доступа   │
│ ─────────────────  │
│ 🗑 Удалить         │
└────────────────────┘
```

**Модальное окно: Предпросмотр файла**
```
┌─────────────────────────────────────────────────────────────────┐
│ ТЗ_v1.docx (версия 3)                                   [✕]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                                                             │ │
│ │                                                             │ │
│ │               [ПРЕВЬЮ ДОКУМЕНТА]                            │ │
│ │                                                             │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ [⬇ Скачать]  [📜 Версии (3)]  [✏️ Загрузить новую версию]      │
│                                                                 │
│ ───────────────────────────────────────────────────────────────│
│ Размер: 1.5 MB  │  Создан: 20.01.2024  │  Изменён: 05.02.2024  │
│ Автор: Мария Сидорова                                          │
└─────────────────────────────────────────────────────────────────┘
```

### 4.8.6 Бизнес-логика

**Наследование прав доступа:**
1. При создании файла/папки копируются права родительской папки с inherited=TRUE
2. При изменении прав папки — обновляются унаследованные права потомков
3. Явно заданные права (inherited=FALSE) имеют приоритет над унаследованными

**Автоматическое извлечение текста:**
Для полнотекстового поиска из файлов извлекается текст:
- PDF: pdftotext / Apache Tika
- DOCX: python-docx / Apache Tika
- XLSX: openpyxl (значения ячеек)
- TXT, MD, CSV: as-is

**Очистка корзины:**
- Файлы в корзине хранятся 30 дней
- Cron-задача ежедневно удаляет просроченные файлы
- Физическое удаление из S3 + hard delete из БД

### 4.8.7 Уведомления

| Событие | Получатели | Тип |
|---------|-----------|-----|
| Новый файл загружен | Участники проекта | in-app |
| Новая версия файла | Подписчики файла | in-app, email |
| Файл удалён | Автор файла | in-app |
| Права изменены | Затронутые пользователи | in-app |

### 4.8.8 Критерии приёмки

- [ ] Иерархическая структура папок
- [ ] CRUD папок и файлов
- [ ] Drag & drop загрузка файлов
- [ ] Чанковая загрузка больших файлов (>50MB)
- [ ] Версионирование файлов
- [ ] Предпросмотр файлов (PDF, изображения, Office)
- [ ] Полнотекстовый поиск
- [ ] Права доступа на файлы/папки
- [ ] Наследование прав
- [ ] Корзина с восстановлением
- [ ] Журнал активности
- [ ] Избранное/закладки
- [ ] Скачивание (одиночное и архивом)
- [ ] Генерация публичных ссылок
- [ ] Интеграция с Office Online (WOPI) — опционально

---

## МОДУЛЬ 9: Планирование (Диаграмма Ганта)

### 4.9.1 Описание и цели модуля

**Назначение:** Визуализация и управление графиком работ проекта с помощью диаграммы Ганта, поддержка зависимостей между задачами и автоматическое планирование.

**Бизнес-цели:**
- Визуализация временной шкалы проекта
- Управление зависимостями между работами
- Отслеживание прогресса выполнения
- Автоматический пересчёт сроков при изменениях
- Экспорт графика для согласования

**Связь с другими модулями:**
- **Зависит от:** Модуль 2 (Проекты), Модуль 3 (Сметирование), Модуль 6 (Задачи)
- **Используется:** Модуль 12 (Отчётность)

### 4.9.2 Роли и права доступа

| Действие | Владелец | Админ | Рук. проектов | Сметчик | Прораб | Наблюд. |
|----------|:--------:|:-----:|:-------------:|:-------:|:------:|:-------:|
| Просмотр графика | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Изменение дат | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Создание зависимостей | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Изменение прогресса | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Автопланирование | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Экспорт | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### 4.9.3 База данных

```sql
-- Таблица: gantt_tasks (Задачи графика Ганта)
-- Примечание: Связана с estimate_tasks и tickets
CREATE TABLE gantt_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    -- Источник (один из)
    estimate_task_id UUID REFERENCES estimate_tasks(id) ON DELETE CASCADE,
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    -- Или самостоятельная задача Ганта
    title VARCHAR(500),
    -- Иерархия
    parent_id UUID REFERENCES gantt_tasks(id) ON DELETE SET NULL,
    -- Временные параметры
    start_date DATE,
    end_date DATE,
    duration INTEGER, -- в днях
    -- Прогресс
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    has_custom_progress BOOLEAN DEFAULT FALSE, -- ручной или автоматический
    -- Планирование
    is_auto BOOLEAN DEFAULT TRUE, -- автоматическое планирование
    is_milestone BOOLEAN DEFAULT FALSE, -- веха (duration = 0)
    -- Визуализация
    color VARCHAR(20),
    sort_order INTEGER DEFAULT 0,
    -- Метаданные
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Ограничение: должен быть указан источник или title
    CHECK (
        estimate_task_id IS NOT NULL OR 
        ticket_id IS NOT NULL OR 
        title IS NOT NULL
    )
);

-- Индексы для gantt_tasks
CREATE INDEX idx_gantt_tasks_project ON gantt_tasks(project_id);
CREATE INDEX idx_gantt_tasks_estimate ON gantt_tasks(estimate_task_id);
CREATE INDEX idx_gantt_tasks_ticket ON gantt_tasks(ticket_id);
CREATE INDEX idx_gantt_tasks_parent ON gantt_tasks(parent_id);
CREATE INDEX idx_gantt_tasks_dates ON gantt_tasks(start_date, end_date);

-- Таблица: gantt_dependencies (Зависимости задач)
CREATE TABLE gantt_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    predecessor_id UUID NOT NULL REFERENCES gantt_tasks(id) ON DELETE CASCADE,
    successor_id UUID NOT NULL REFERENCES gantt_tasks(id) ON DELETE CASCADE,
    -- Тип зависимости
    dependency_type VARCHAR(10) NOT NULL DEFAULT 'FS', -- FS, FF, SS, SF
    -- Лаг (задержка в днях, может быть отрицательным)
    lag INTEGER DEFAULT 0,
    -- Метаданные
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Ограничение: нельзя создать зависимость на себя
    CHECK (predecessor_id != successor_id),
    UNIQUE(predecessor_id, successor_id)
);

-- Индексы для gantt_dependencies
CREATE INDEX idx_gantt_deps_project ON gantt_dependencies(project_id);
CREATE INDEX idx_gantt_deps_predecessor ON gantt_dependencies(predecessor_id);
CREATE INDEX idx_gantt_deps_successor ON gantt_dependencies(successor_id);

-- Таблица: project_working_days (Рабочие дни проекта)
CREATE TABLE project_working_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    -- Настройки рабочей недели (битовая маска: 1=пн, 2=вт, 4=ср, 8=чт, 16=пт, 32=сб, 64=вс)
    working_days_mask INTEGER DEFAULT 31, -- пн-пт
    -- Праздники
    holidays JSONB DEFAULT '[]', -- [{date, name}]
    -- Страна для автоматических праздников
    country_code VARCHAR(2),
    -- Метаданные
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id)
);

-- Таблица: gantt_baselines (Базовые планы)
CREATE TABLE gantt_baselines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    -- Снимок данных
    tasks_snapshot JSONB NOT NULL, -- [{task_id, start_date, end_date, duration, progress}]
    -- Метаданные
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 4.9.4 Backend API

#### GET /api/v1/projects/{projectId}/gantt

**Описание:** Получение данных для диаграммы Ганта

**Query параметры:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| start_date | date | Начало периода |
| end_date | date | Конец периода |
| source | string | estimate, tickets, all |
| component_id | UUID | Фильтр по компоненту |
| hide_completed | boolean | Скрыть завершённые |
| include_baseline | UUID | Включить базовый план |

**Ответ:**
```json
{
    "success": true,
    "data": {
        "project": {
            "id": "project-001",
            "name": "ЖК Новые горизонты",
            "start_date": "2024-01-15",
            "end_date": "2024-06-30"
        },
        "working_days": {
            "mask": 31,
            "holidays": [
                {"date": "2024-02-23", "name": "День защитника Отечества"},
                {"date": "2024-03-08", "name": "Международный женский день"}
            ]
        },
        "tasks": [
            {
                "id": "gantt-001",
                "title": "Раздел 1. Электроснабжение",
                "source": "estimate",
                "source_id": "stage-001",
                "parent_id": null,
                "start_date": "2024-01-15",
                "end_date": "2024-03-15",
                "duration": 60,
                "progress": 35,
                "is_milestone": false,
                "color": "#4A90D9",
                "children": [
                    {
                        "id": "gantt-002",
                        "title": "Прокладка кабеля",
                        "source": "estimate",
                        "source_id": "task-001",
                        "parent_id": "gantt-001",
                        "start_date": "2024-01-15",
                        "end_date": "2024-02-15",
                        "duration": 32,
                        "progress": 80,
                        "assigned_to": {"id": "user-001", "name": "Иван Петров"}
                    }
                ]
            },
            {
                "id": "gantt-010",
                "title": "Приёмка работ",
                "source": "milestone",
                "parent_id": null,
                "start_date": "2024-06-30",
                "end_date": "2024-06-30",
                "duration": 0,
                "is_milestone": true,
                "progress": 0
            }
        ],
        "dependencies": [
            {
                "id": "dep-001",
                "predecessor_id": "gantt-002",
                "successor_id": "gantt-003",
                "type": "FS",
                "lag": 0
            }
        ],
        "baseline": null
    }
}
```

#### PUT /api/v1/gantt/tasks/{taskId}

**Описание:** Обновление задачи Ганта (даты, прогресс)

**Тело запроса:**
```json
{
    "start_date": "2024-01-20",
    "end_date": "2024-02-20",
    "progress": 45
}
```

**Логика обработки:**
1. Обновить задачу
2. Если is_auto = TRUE для зависимых задач — пересчитать их даты
3. Обновить прогресс родительской задачи (среднее по детям)
4. Вернуть обновлённые задачи

**Алгоритм пересчёта дат (Forward Pass):**
```python
def recalculate_dates(task_id, project_id):
    # Получить все зависимости где task_id является predecessor
    dependencies = get_dependencies(predecessor_id=task_id)
    
    for dep in dependencies:
        successor = get_task(dep.successor_id)
        if not successor.is_auto:
            continue
            
        predecessor = get_task(dep.predecessor_id)
        
        if dep.type == 'FS':  # Finish-to-Start
            new_start = add_working_days(predecessor.end_date, dep.lag + 1)
        elif dep.type == 'SS':  # Start-to-Start
            new_start = add_working_days(predecessor.start_date, dep.lag)
        elif dep.type == 'FF':  # Finish-to-Finish
            new_end = add_working_days(predecessor.end_date, dep.lag)
            new_start = subtract_working_days(new_end, successor.duration)
        elif dep.type == 'SF':  # Start-to-Finish
            new_end = add_working_days(predecessor.start_date, dep.lag)
            new_start = subtract_working_days(new_end, successor.duration)
        
        update_task(successor.id, start_date=new_start)
        recalculate_dates(successor.id, project_id)  # Рекурсия
```

#### POST /api/v1/projects/{projectId}/gantt/dependencies

**Описание:** Создание зависимости между задачами

**Тело запроса:**
```json
{
    "predecessor_id": "gantt-002",
    "successor_id": "gantt-003",
    "dependency_type": "FS",
    "lag": 2
}
```

**Валидация:**
- Проверка на циклические зависимости
- Проверка что обе задачи из одного проекта

**Алгоритм проверки циклов (DFS):**
```python
def has_cycle(predecessor_id, successor_id):
    visited = set()
    
    def dfs(task_id):
        if task_id == predecessor_id:
            return True  # Цикл найден
        if task_id in visited:
            return False
        visited.add(task_id)
        
        for dep in get_dependencies(predecessor_id=task_id):
            if dfs(dep.successor_id):
                return True
        return False
    
    return dfs(successor_id)
```

#### POST /api/v1/projects/{projectId}/gantt/auto-schedule

**Описание:** Автоматическое планирование всех задач

**Тело запроса:**
```json
{
    "start_date": "2024-01-15",
    "respect_dependencies": true,
    "respect_working_days": true
}
```

**Логика:**
1. Найти все задачи без предшественников (корневые)
2. Установить им start_date = request.start_date
3. Выполнить Forward Pass для всех зависимых задач
4. Обновить родительские задачи (min(children.start), max(children.end))

#### POST /api/v1/projects/{projectId}/gantt/baselines

**Описание:** Создание базового плана (снимка)

**Тело запроса:**
```json
{
    "name": "Базовый план v1",
    "description": "Утверждённый график на совещании 15.01.2024"
}
```

**Логика:**
1. Получить все задачи проекта
2. Сформировать JSON-снимок: [{task_id, start_date, end_date, duration, progress}]
3. Сохранить в gantt_baselines

#### GET /api/v1/projects/{projectId}/gantt/export

**Описание:** Экспорт графика

**Query параметры:**
- format: xlsx, pdf, mpp (MS Project XML)
- date_scale: day, week, month
- include_resources: boolean

### 4.9.5 Frontend - Интерфейс пользователя

#### Страница: Диаграмма Ганта

**URL:** `/projects/{id}/gantt`

**Wireframe:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [← Проект] График работ              [Базовый план ▼] [Экспорт ▼] [⚙ Настр.]│
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────┬────────────────────────────────────────┤
│ │ [+ Задача] [🔗 Связь] [🎯 Автопл.]│ [День] [Неделя] [Месяц]  │ ◀ Янв 2024 ▶│
│ ├──────────────────────────────────┼────────────────────────────────────────┤
│ │                                  │ 15  16  17  18  19  20  21  22  23 ... │
│ │ Название              │Длит.│ %  │ Пн  Вт  Ср  Чт  Пт  Сб  Вс  Пн  Вт     │
│ ├──────────────────────────────────┼────────────────────────────────────────┤
│ │ ▼ Раздел 1. Электросн.│ 60д │35% │ ████████████████████████               │
│ │   ├─ Прокладка кабеля │ 32д │80% │ ████████████████████▓▓▓▓               │
│ │   │                   │     │    │        └──────┐                        │
│ │   ├─ Монтаж щитов     │ 15д │50% │               ██████████▓▓▓▓▓          │
│ │   │                   │     │    │                         └────┐         │
│ │   └─ Подключение      │ 10д │ 0% │                              █████████ │
│ │                       │     │    │                                        │
│ │ ▶ Раздел 2. Освещение │ 45д │ 0% │                    ███████████████████ │
│ │                       │     │    │                                        │
│ │ ◆ Приёмка работ       │  0д │ 0% │                                      ◆ │
│ └──────────────────────────────────┴────────────────────────────────────────┘
│                                                                             │
│ Условные обозначения:  ████ План  ▓▓▓▓ Выполнено  ◆ Веха  ─── Зависимость  │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Элементы интерфейса:**

| Элемент | Тип | Поведение |
|---------|-----|-----------|
| Левая панель | TreeTable | Иерархия задач, раскрытие/сворачивание |
| Правая панель | Gantt Chart | Горизонтальные бары задач, временная шкала |
| Бары задач | Draggable | Drag для изменения дат, resize для длительности |
| Стрелки зависимостей | SVG lines | Отображение связей между задачами |
| Инструмент связи | Click-to-connect | Клик на задачу → клик на другую = создать связь |
| Масштаб | Button group | День/Неделя/Месяц |
| Прогресс-бар | Inline slider | Изменение % выполнения |

**Типы зависимостей:**

| Тип | Название | Описание | Визуализация |
|-----|----------|----------|--------------|
| FS | Finish-to-Start | Классическая последовательность | →─┐ |
| SS | Start-to-Start | Параллельный старт | ─┬─ |
| FF | Finish-to-Finish | Параллельное завершение | ─┴─ |
| SF | Start-to-Finish | Редкий, для привязки к вехе | ←─┘ |

**Модальное окно: Редактирование задачи**
```
┌─────────────────────────────────────────────────────────────┐
│ Редактирование задачи                               [✕]    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Название: [Прокладка кабеля                      ]          │
│                                                             │
│ ┌─────────────────────┐ ┌─────────────────────┐             │
│ │ Начало              │ │ Окончание           │             │
│ │ [📅 15.01.2024    ] │ │ [📅 15.02.2024    ] │             │
│ └─────────────────────┘ └─────────────────────┘             │
│                                                             │
│ Длительность: [32] дней    ☑ Автопланирование              │
│                                                             │
│ Прогресс: [═══════════════▓▓▓▓▓] 80%                        │
│                                                             │
│ Ответственный: [▼ Иван Петров                  ]            │
│                                                             │
│ Зависимости:                                                │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Предшественники:                              [+ Добав.]│ │
│ │  └─ (нет)                                              │ │
│ │ Последователи:                                         │ │
│ │  └─ Монтаж щитов (FS, лаг: 0 дней)          [🗑]       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│                    [Отмена]    [Сохранить]                  │
└─────────────────────────────────────────────────────────────┘
```

### 4.9.6 Критерии приёмки

- [ ] Отображение диаграммы Ганта с иерархией задач
- [ ] Источники: работы сметы, задачи, ручные задачи
- [ ] Drag & drop для изменения дат
- [ ] Resize для изменения длительности
- [ ] Создание зависимостей (FS, SS, FF, SF)
- [ ] Визуализация зависимостей стрелками
- [ ] Лаг (задержка) для зависимостей
- [ ] Автоматическое планирование (forward pass)
- [ ] Учёт рабочих дней и праздников
- [ ] Вехи (milestones)
- [ ] Прогресс выполнения с визуализацией
- [ ] Автоматический расчёт прогресса родителей
- [ ] Базовые планы (snapshots)
- [ ] Сравнение с базовым планом
- [ ] Масштабирование (день/неделя/месяц)
- [ ] Экспорт в XLSX, PDF
- [ ] Экспорт в MS Project XML (опционально)

---

## МОДУЛЬ 10: Финансы

### 4.10.1 Описание и цели модуля

**Назначение:** Учёт финансовых операций проекта, формирование актов выполненных работ, план-факт анализ и управление взаиморасчётами.

**Бизнес-цели:**
- Учёт доходов и расходов по проектам
- Формирование актов выполненных работ (КС-2, КС-6а)
- План-факт анализ (сравнение сметы с фактом)
- Управление взаиморасчётами с контрагентами
- Cash flow и прогнозирование

**Связь с другими модулями:**
- **Зависит от:** Модуль 2 (Проекты), Модуль 3 (Сметы), Модуль 5 (Контрагенты)
- **Используется:** Модуль 11 (Закупки), Модуль 12 (Отчётность)

### 4.10.2 Роли и права доступа

| Действие | Владелец | Админ | Рук. проектов | Бухгалтер | Сметчик | Прораб | Наблюд. |
|----------|:--------:|:-----:|:-------------:|:---------:|:-------:|:------:|:-------:|
| Просмотр финансов | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Создание платежей | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Создание актов | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Подтверждение оплаты | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Управление счетами | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Просмотр отчётов | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |

### 4.10.3 База данных

```sql
-- Таблица: finance_accounts (Расчётные счета)
CREATE TABLE finance_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) DEFAULT 'bank', -- bank, cash, card
    bank_name VARCHAR(255),
    bank_bik VARCHAR(20),
    account_number VARCHAR(50),
    corr_account VARCHAR(50),
    currency_id INTEGER REFERENCES currencies(id),
    initial_balance DECIMAL(15, 2) DEFAULT 0,
    current_balance DECIMAL(15, 2) DEFAULT 0, -- вычисляемое
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица: finance_operation_articles (Статьи затрат/доходов)
CREATE TABLE finance_operation_articles (
    id SERIAL PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES finance_operation_articles(id),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    operation_type VARCHAR(20) NOT NULL, -- income, expense
    is_system BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0
);

-- Предустановленные статьи
INSERT INTO finance_operation_articles (id, name, code, operation_type, is_system) VALUES
(1, 'Оплата от заказчика', 'INC-001', 'income', TRUE),
(2, 'Материалы', 'EXP-001', 'expense', TRUE),
(3, 'Работы подрядчиков', 'EXP-002', 'expense', TRUE),
(4, 'Накладные расходы', 'EXP-003', 'expense', TRUE),
(5, 'Налоги', 'EXP-004', 'expense', TRUE);

-- Таблица: finance_operations (Финансовые операции)
CREATE TABLE finance_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    account_id UUID NOT NULL REFERENCES finance_accounts(id),
    -- Тип операции
    operation_type VARCHAR(20) NOT NULL, -- income, expense
    operation_article_id INTEGER REFERENCES finance_operation_articles(id),
    -- Суммы
    amount DECIMAL(15, 2) NOT NULL,
    currency_id INTEGER REFERENCES currencies(id),
    -- Даты
    operation_date DATE NOT NULL, -- дата фактической операции
    accrual_date DATE, -- дата начисления (для учёта)
    -- Контрагент
    contractor_id UUID REFERENCES contractors(id),
    -- Связанные документы
    act_id UUID REFERENCES finance_acts(id),
    order_id UUID REFERENCES orders(id),
    invoice_number VARCHAR(100),
    -- Метаданные
    description TEXT,
    comment TEXT,
    attachments JSONB DEFAULT '[]', -- [{file_id, name}]
    -- Статус
    status VARCHAR(20) DEFAULT 'pending', -- pending, completed, cancelled
    confirmed_by_id UUID REFERENCES users(id),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    -- Аудит
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Индексы
CREATE INDEX idx_finance_ops_company ON finance_operations(company_id);
CREATE INDEX idx_finance_ops_project ON finance_operations(project_id);
CREATE INDEX idx_finance_ops_account ON finance_operations(account_id);
CREATE INDEX idx_finance_ops_contractor ON finance_operations(contractor_id);
CREATE INDEX idx_finance_ops_date ON finance_operations(operation_date);
CREATE INDEX idx_finance_ops_type ON finance_operations(operation_type);

-- Таблица: finance_acts (Акты выполненных работ)
CREATE TABLE finance_acts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    -- Номер и даты
    number VARCHAR(50) NOT NULL,
    act_date DATE NOT NULL,
    period_from DATE NOT NULL,
    period_to DATE NOT NULL,
    -- Контрагент (заказчик)
    contractor_id UUID NOT NULL REFERENCES contractors(id),
    -- Ответственный
    responsible_id UUID REFERENCES users(id),
    -- Суммы
    subtotal DECIMAL(15, 2) DEFAULT 0, -- сумма работ до наценок
    markups_json JSONB DEFAULT '[]', -- наценки [{name, type, value, amount}]
    total DECIMAL(15, 2) DEFAULT 0, -- итоговая сумма
    -- Тип акта
    act_type VARCHAR(20) DEFAULT 'customer', -- customer, contractor
    form_type VARCHAR(20) DEFAULT 'KS2', -- KS2, KS6a, free
    -- Статус
    status VARCHAR(20) DEFAULT 'draft', -- draft, sent, accepted, rejected
    payment_status VARCHAR(20) DEFAULT 'unpaid', -- unpaid, partial, paid
    paid_amount DECIMAL(15, 2) DEFAULT 0,
    -- Метаданные
    notes TEXT,
    internal_notes TEXT,
    template_id UUID REFERENCES document_templates(id),
    generated_pdf_url VARCHAR(500),
    -- Аудит
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Таблица: finance_act_items (Позиции акта)
CREATE TABLE finance_act_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    act_id UUID NOT NULL REFERENCES finance_acts(id) ON DELETE CASCADE,
    estimate_task_id UUID REFERENCES estimate_tasks(id),
    -- Позиция
    name VARCHAR(500) NOT NULL,
    unit_measure_id INTEGER REFERENCES unit_measures(id),
    -- Объёмы
    volume_total DECIMAL(15, 4) DEFAULT 0, -- общий объём по смете
    volume_previous DECIMAL(15, 4) DEFAULT 0, -- выполнено ранее
    volume_current DECIMAL(15, 4) DEFAULT 0, -- выполнено за период
    -- Цены
    unit_price DECIMAL(15, 4) DEFAULT 0,
    -- Суммы
    amount_total DECIMAL(15, 2) DEFAULT 0, -- всего по смете
    amount_previous DECIMAL(15, 2) DEFAULT 0, -- ранее
    amount_current DECIMAL(15, 2) DEFAULT 0, -- за период
    -- Сортировка
    sort_order INTEGER DEFAULT 0
);

-- Индексы
CREATE INDEX idx_act_items_act ON finance_act_items(act_id);
CREATE INDEX idx_act_items_task ON finance_act_items(estimate_task_id);

-- Триггер для пересчёта итогов акта
CREATE OR REPLACE FUNCTION update_act_totals() RETURNS trigger AS $$
BEGIN
    UPDATE finance_acts SET
        subtotal = (SELECT COALESCE(SUM(amount_current), 0) FROM finance_act_items WHERE act_id = NEW.act_id)
    WHERE id = NEW.act_id;
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER act_items_update_totals
    AFTER INSERT OR UPDATE OR DELETE ON finance_act_items
    FOR EACH ROW EXECUTE FUNCTION update_act_totals();
```

### 4.10.4 Backend API

#### GET /api/v1/projects/{projectId}/finance/summary

**Описание:** Сводка по финансам проекта

**Ответ:**
```json
{
    "success": true,
    "data": {
        "budget": {
            "planned": 21279600.00,
            "committed": 15500000.00,
            "spent": 8750000.00,
            "remaining": 12529600.00
        },
        "revenue": {
            "invoiced": 10000000.00,
            "received": 8500000.00,
            "outstanding": 1500000.00
        },
        "profit": {
            "planned": 3200000.00,
            "current": 1750000.00,
            "margin_percent": 20.6
        },
        "acts": {
            "total_count": 5,
            "unpaid_count": 2,
            "unpaid_amount": 3500000.00
        },
        "cashflow": {
            "current_month": {
                "income": 2500000.00,
                "expense": 1800000.00,
                "balance": 700000.00
            }
        }
    }
}
```

#### POST /api/v1/projects/{projectId}/finance/acts

**Описание:** Создание акта выполненных работ

**Тело запроса:**
```json
{
    "number": "АВР-001",
    "act_date": "2024-02-28",
    "period_from": "2024-02-01",
    "period_to": "2024-02-28",
    "contractor_id": "contractor-001",
    "form_type": "KS2",
    "import_from_estimate": true,
    "stage_ids": ["stage-001", "stage-002"],
    "markups": [
        {"name": "НДС 20%", "type": "percent", "value": 20, "is_nds": true}
    ],
    "notes": "Акт за февраль 2024"
}
```

**Логика создания:**
1. Создать запись finance_acts
2. Если import_from_estimate = true:
   - Получить работы из указанных stage_ids
   - Для каждой работы:
     - volume_total = estimate_task.volume
     - volume_previous = сумма из предыдущих актов
     - volume_current = volume_total - volume_previous (или 0 если всё выполнено)
     - unit_price = estimate_task.price_with_markup
3. Рассчитать subtotal
4. Применить markups
5. Рассчитать total

#### GET /api/v1/projects/{projectId}/finance/acts/{actId}/preview

**Описание:** Превью акта перед генерацией PDF

**Ответ:**
```json
{
    "success": true,
    "data": {
        "act": {
            "number": "АВР-001",
            "date": "28.02.2024",
            "period": "01.02.2024 - 28.02.2024",
            "contractor": {
                "name": "ООО СтройИнвест",
                "inn": "7707083893"
            }
        },
        "items": [
            {
                "number": 1,
                "name": "Прокладка кабеля ВВГнг 3x2.5",
                "unit": "м",
                "volume_total": 1500,
                "volume_previous": 800,
                "volume_current": 700,
                "price": 150.00,
                "amount_total": 225000.00,
                "amount_previous": 120000.00,
                "amount_current": 105000.00
            }
        ],
        "totals": {
            "subtotal": 850000.00,
            "nds": 170000.00,
            "total": 1020000.00
        }
    }
}
```

#### POST /api/v1/projects/{projectId}/finance/acts/{actId}/generate-pdf

**Описание:** Генерация PDF акта

**Тело запроса:**
```json
{
    "template_id": "template-ks2"
}
```

**Логика:**
1. Получить данные акта с позициями
2. Применить шаблон документа
3. Сгенерировать PDF (Puppeteer/wkhtmltopdf)
4. Сохранить в S3
5. Обновить generated_pdf_url

#### POST /api/v1/finance/operations

**Описание:** Создание финансовой операции

**Тело запроса:**
```json
{
    "project_id": "project-001",
    "account_id": "account-001",
    "operation_type": "expense",
    "operation_article_id": 2,
    "amount": 125000.00,
    "operation_date": "2024-02-15",
    "contractor_id": "contractor-002",
    "description": "Оплата материалов по счёту №123",
    "invoice_number": "123"
}
```

#### GET /api/v1/projects/{projectId}/finance/plan-fact

**Описание:** План-факт анализ

**Query параметры:**
- group_by: stage, task, resource_type
- date_from, date_to

**Ответ:**
```json
{
    "success": true,
    "data": {
        "summary": {
            "plan_total": 21279600.00,
            "fact_total": 8750000.00,
            "variance": -12529600.00,
            "completion_percent": 41.1
        },
        "by_stage": [
            {
                "stage_id": "stage-001",
                "name": "Раздел 1. Электроснабжение",
                "plan": 6234000.00,
                "fact": 4500000.00,
                "variance": -1734000.00,
                "completion_percent": 72.2
            }
        ],
        "by_resource_type": [
            {"type": "material", "name": "Материалы", "plan": 12000000.00, "fact": 5200000.00},
            {"type": "labor", "name": "Работы", "plan": 8000000.00, "fact": 3200000.00},
            {"type": "equipment", "name": "Механизмы", "plan": 1279600.00, "fact": 350000.00}
        ]
    }
}
```

### 4.10.5 Frontend - Интерфейс пользователя

#### Страница: Финансы проекта

**URL:** `/projects/{id}/finance`

**Wireframe:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [← Проект] Финансы                              [+ Операция] [+ Акт]        │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐          │
│ │ БЮДЖЕТ            │ │ ВЫРУЧКА           │ │ ПРИБЫЛЬ           │          │
│ │ План: 21 279 600 ₽│ │ Выставлено:10 млн │ │ Плановая: 3.2 млн │          │
│ │ Факт:  8 750 000 ₽│ │ Получено:  8.5 млн│ │ Текущая:  1.75 млн│          │
│ │ Остаток:12.5 млн  │ │ Долг:      1.5 млн│ │ Маржа:    20.6%   │          │
│ │ ▓▓▓▓▓▓▓▓░░░░░░ 41%│ │ ▓▓▓▓▓▓▓▓▓▓░░░ 85% │ │ ▓▓▓▓▓▓░░░░░░ 55%  │          │
│ └───────────────────┘ └───────────────────┘ └───────────────────┘          │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐│
│ │ [Операции] [Акты] [План-факт] [Взаиморасчёты] [Cash Flow]               ││
│ └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│ ОПЕРАЦИИ                                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐│
│ │ Дата       │ Тип    │ Статья      │ Контрагент   │ Сумма        │Статус ││
│ │────────────┼────────┼─────────────┼──────────────┼──────────────┼───────││
│ │ 15.02.2024 │ Расход │ Материалы   │ ООО Кабель   │ -125 000 ₽   │ ✓     ││
│ │ 12.02.2024 │ Доход  │ Оплата заказ│ СтройИнвест  │ +2 500 000 ₽ │ ✓     ││
│ │ 10.02.2024 │ Расход │ Работы      │ ИП Сидоров   │ -350 000 ₽   │ ⏳    ││
│ └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│ [◀ Пред.]  Страница 1 из 5  [След. ▶]                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.10.6 Критерии приёмки

- [ ] Управление расчётными счетами
- [ ] Справочник статей затрат/доходов
- [ ] CRUD финансовых операций
- [ ] Создание актов выполненных работ
- [ ] Импорт позиций из сметы в акт
- [ ] Учёт ранее выполненных объёмов
- [ ] Наценки и НДС в актах
- [ ] Генерация PDF актов (КС-2, КС-6а)
- [ ] Подтверждение оплаты актов
- [ ] План-факт анализ
- [ ] Сводка по финансам проекта
- [ ] Взаиморасчёты с контрагентами
- [ ] Cash flow отчёт

---

## МОДУЛЬ 11: Закупки и склад

### 4.11.1 Описание и цели модуля

**Назначение:** Управление закупками материалов, формирование заявок и заказов поставщикам, складской учёт.

**Бизнес-цели:**
- Формирование заявок на закупку из сметы
- Контроль бюджета при закупках
- Управление заказами поставщикам
- Складской учёт материалов
- Списание материалов на работы

**Связь с другими модулями:**
- **Зависит от:** Модуль 3 (Сметы), Модуль 5 (Контрагенты)
- **Используется:** Модуль 10 (Финансы)

### 4.11.2 База данных

```sql
-- Таблица: resource_requests (Заявки на ресурсы)
CREATE TABLE resource_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    estimate_resource_id UUID REFERENCES estimate_resources(id) ON DELETE SET NULL,
    -- Информация о ресурсе
    name VARCHAR(500) NOT NULL,
    resource_type INTEGER DEFAULT 2, -- 2=материал, 3=механизм
    unit_measure_id INTEGER REFERENCES unit_measures(id),
    -- Объёмы
    volume_required DECIMAL(15, 4) NOT NULL, -- требуется
    volume_ordered DECIMAL(15, 4) DEFAULT 0, -- заказано
    volume_received DECIMAL(15, 4) DEFAULT 0, -- получено
    -- Цены
    planned_price DECIMAL(15, 4), -- плановая цена (из сметы)
    actual_price DECIMAL(15, 4), -- фактическая цена
    planned_cost DECIMAL(15, 2) GENERATED ALWAYS AS (volume_required * COALESCE(planned_price, 0)) STORED,
    -- Даты
    needed_at DATE, -- когда нужно
    -- Статус
    status VARCHAR(20) DEFAULT 'new', -- new, partial, ordered, received, cancelled
    is_over_budget BOOLEAN DEFAULT FALSE,
    -- Метаданные
    comment TEXT,
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица: orders (Заказы поставщикам)
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    contractor_id UUID NOT NULL REFERENCES contractors(id),
    -- Номер и даты
    number VARCHAR(50) NOT NULL,
    order_date DATE NOT NULL,
    expected_date DATE, -- ожидаемая дата поставки
    -- Суммы
    subtotal DECIMAL(15, 2) DEFAULT 0,
    nds_percent DECIMAL(5, 2) DEFAULT 20,
    nds_amount DECIMAL(15, 2) DEFAULT 0,
    total DECIMAL(15, 2) DEFAULT 0,
    -- Статусы
    status VARCHAR(20) DEFAULT 'draft', -- draft, sent, confirmed, shipped, delivered, cancelled
    delivery_status VARCHAR(20) DEFAULT 'pending', -- pending, partial, delivered
    payment_status VARCHAR(20) DEFAULT 'unpaid', -- unpaid, partial, paid
    -- Метаданные
    notes TEXT,
    internal_notes TEXT,
    attachments JSONB DEFAULT '[]',
    -- Аудит
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Таблица: order_items (Позиции заказа)
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    resource_request_id UUID REFERENCES resource_requests(id),
    -- Позиция
    name VARCHAR(500) NOT NULL,
    resource_type INTEGER DEFAULT 2,
    unit_measure_id INTEGER REFERENCES unit_measures(id),
    -- Объёмы
    volume DECIMAL(15, 4) NOT NULL,
    volume_delivered DECIMAL(15, 4) DEFAULT 0,
    -- Цены
    unit_price DECIMAL(15, 4) NOT NULL,
    total_price DECIMAL(15, 2) GENERATED ALWAYS AS (volume * unit_price) STORED,
    -- Сортировка
    sort_order INTEGER DEFAULT 0
);

-- Таблица: stocks (Склады)
CREATE TABLE stocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL, -- NULL = общий склад компании
    name VARCHAR(255) NOT NULL,
    address TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица: stock_balances (Остатки на складе)
CREATE TABLE stock_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    -- Номенклатура
    name VARCHAR(500) NOT NULL,
    valuation_id UUID REFERENCES valuations(id),
    unit_measure_id INTEGER REFERENCES unit_measures(id),
    -- Остаток
    quantity DECIMAL(15, 4) DEFAULT 0,
    reserved_quantity DECIMAL(15, 4) DEFAULT 0, -- зарезервировано
    available_quantity DECIMAL(15, 4) GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
    -- Учётная цена (средневзвешенная)
    unit_price DECIMAL(15, 4) DEFAULT 0,
    total_value DECIMAL(15, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    -- Метаданные
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(stock_id, name)
);

-- Таблица: stock_operations (Складские операции)
CREATE TABLE stock_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id),
    stock_id UUID NOT NULL REFERENCES stocks(id),
    -- Тип операции
    operation_type INTEGER NOT NULL, -- 1=поступление, 2=списание, 3=перемещение, 4=инвентаризация
    -- Связанные документы
    order_id UUID REFERENCES orders(id),
    contractor_id UUID REFERENCES contractors(id), -- поставщик (для поступления)
    estimate_task_id UUID REFERENCES estimate_tasks(id), -- работа (для списания)
    -- Даты и номер
    operation_date DATE NOT NULL,
    document_number VARCHAR(50),
    -- Метаданные
    comment TEXT,
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица: stock_operation_items (Позиции складской операции)
CREATE TABLE stock_operation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_id UUID NOT NULL REFERENCES stock_operations(id) ON DELETE CASCADE,
    stock_balance_id UUID REFERENCES stock_balances(id),
    order_item_id UUID REFERENCES order_items(id),
    -- Номенклатура
    name VARCHAR(500) NOT NULL,
    unit_measure_id INTEGER REFERENCES unit_measures(id),
    -- Объём и цена
    quantity DECIMAL(15, 4) NOT NULL,
    unit_price DECIMAL(15, 4) DEFAULT 0,
    total DECIMAL(15, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    -- Сортировка
    sort_order INTEGER DEFAULT 0
);

-- Триггер для обновления остатков
CREATE OR REPLACE FUNCTION update_stock_balance() RETURNS trigger AS $$
DECLARE
    op_type INTEGER;
    balance_id UUID;
BEGIN
    SELECT operation_type INTO op_type FROM stock_operations WHERE id = NEW.operation_id;
    
    -- Найти или создать остаток
    SELECT id INTO balance_id FROM stock_balances 
    WHERE stock_id = (SELECT stock_id FROM stock_operations WHERE id = NEW.operation_id)
      AND name = NEW.name;
    
    IF balance_id IS NULL THEN
        INSERT INTO stock_balances (stock_id, name, unit_measure_id, quantity, unit_price)
        SELECT so.stock_id, NEW.name, NEW.unit_measure_id, 0, NEW.unit_price
        FROM stock_operations so WHERE so.id = NEW.operation_id
        RETURNING id INTO balance_id;
    END IF;
    
    -- Обновить остаток
    IF op_type = 1 THEN -- Поступление
        UPDATE stock_balances SET
            quantity = quantity + NEW.quantity,
            unit_price = (quantity * unit_price + NEW.quantity * NEW.unit_price) / (quantity + NEW.quantity) -- средневзвешенная
        WHERE id = balance_id;
    ELSIF op_type = 2 THEN -- Списание
        UPDATE stock_balances SET quantity = quantity - NEW.quantity WHERE id = balance_id;
    END IF;
    
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER stock_operation_items_balance
    AFTER INSERT ON stock_operation_items
    FOR EACH ROW EXECUTE FUNCTION update_stock_balance();
```

### 4.11.3 Backend API

#### POST /api/v1/projects/{projectId}/resource-requests/batch

**Описание:** Массовое создание заявок из сметы

**Тело запроса:**
```json
{
    "estimate_resource_ids": ["res-001", "res-002", "res-003"],
    "needed_at": "2024-03-01"
}
```

**Логика:**
1. Получить ресурсы из сметы
2. Для каждого ресурса:
   - volume_required = estimate_resource.volume - уже заказано
   - planned_price = estimate_resource.price
   - Проверить is_over_budget = planned_cost > бюджет
3. Создать заявки

#### POST /api/v1/orders

**Описание:** Создание заказа из заявок

**Тело запроса:**
```json
{
    "project_id": "project-001",
    "contractor_id": "contractor-002",
    "number": "ЗКЗ-001",
    "order_date": "2024-02-20",
    "expected_date": "2024-02-25",
    "request_ids": ["req-001", "req-002"],
    "nds_percent": 20,
    "notes": "Срочная доставка"
}
```

#### POST /api/v1/stock-operations

**Описание:** Создание складской операции (поступление/списание)

**Тело запроса (поступление):**
```json
{
    "project_id": "project-001",
    "stock_id": "stock-001",
    "operation_type": 1,
    "order_id": "order-001",
    "contractor_id": "contractor-002",
    "operation_date": "2024-02-25",
    "document_number": "ПН-001",
    "items": [
        {
            "order_item_id": "item-001",
            "name": "Кабель ВВГнг 3x2.5",
            "unit_measure_id": 1,
            "quantity": 1500,
            "unit_price": 85.00
        }
    ]
}
```

**Тело запроса (списание):**
```json
{
    "project_id": "project-001",
    "stock_id": "stock-001",
    "operation_type": 2,
    "estimate_task_id": "task-001",
    "operation_date": "2024-02-26",
    "document_number": "ТН-001",
    "items": [
        {
            "stock_balance_id": "balance-001",
            "name": "Кабель ВВГнг 3x2.5",
            "quantity": 500
        }
    ]
}
```

### 4.11.4 Критерии приёмки

- [ ] Формирование заявок из сметы
- [ ] Контроль превышения бюджета
- [ ] CRUD заказов поставщикам
- [ ] Отслеживание статуса доставки
- [ ] Управление складами
- [ ] Приходование материалов (поступление)
- [ ] Списание материалов на работы
- [ ] Учёт остатков на складах
- [ ] Средневзвешенная учётная цена
- [ ] Перемещение между складами
- [ ] Инвентаризация
- [ ] Отчёт по остаткам

---

## МОДУЛЬ 12: Отчётность

### 4.12.1 Описание и цели модуля

**Назначение:** Конструктор отчётов с WYSIWYG-редактором, шаблонами и системой токенов для генерации PDF-документов.

**Бизнес-цели:**
- Гибкое создание отчётов любой структуры
- Шаблоны для типовых документов
- Автоматическая подстановка данных через токены
- Брендирование отчётов (логотипы, стили)
- Экспорт в PDF, XLSX

### 4.12.2 База данных

```sql
-- Таблица: report_templates (Шаблоны отчётов)
CREATE TABLE report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    -- Тип и категория
    template_type VARCHAR(50) NOT NULL, -- project_report, ticket_report, financial_report, custom
    category VARCHAR(100),
    -- Настройки страницы
    page_orientation VARCHAR(20) DEFAULT 'portrait', -- portrait, landscape
    page_size VARCHAR(10) DEFAULT 'A4', -- A4, A3, Letter
    margins JSONB DEFAULT '{"top": 18, "bottom": 18, "left": 10, "right": 10}',
    -- Контент (HTML с токенами)
    header_html TEXT,
    body_html TEXT NOT NULL,
    footer_html TEXT,
    -- Настройки
    settings JSONB DEFAULT '{}', -- {order_by, visibility, include_images, etc.}
    -- Системный
    is_system BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    preview_url VARCHAR(500),
    -- Аудит
    created_by_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица: generated_reports (Сгенерированные отчёты)
CREATE TABLE generated_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES report_templates(id),
    project_id UUID REFERENCES projects(id),
    -- Результат
    pdf_url VARCHAR(500),
    xlsx_url VARCHAR(500),
    -- Параметры генерации
    parameters JSONB DEFAULT '{}', -- фильтры, диапазон дат и т.д.
    -- Аудит
    generated_by_id UUID NOT NULL REFERENCES users(id),
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    generation_time_ms INTEGER -- время генерации
);
```

### 4.12.3 Система токенов

**Токены проекта (p.):**
- `{{p.name}}` — название проекта
- `{{p.code}}` — код проекта
- `{{p.address}}` — адрес
- `{{p.customer}}` — заказчик
- `{{p.manager}}` — менеджер
- `{{p.start_date}}` — дата начала
- `{{p.end_date}}` — дата окончания

**Токены задачи (t.):**
- `{{t.code}}` — номер задачи
- `{{t.title}}` — заголовок
- `{{t.status}}` — статус
- `{{t.priority}}` — приоритет
- `{{t.assigned_to}}` — исполнитель
- `{{t.due_date}}` — срок
- `{{t.description}}` — описание

**Токены пользователя (u.):**
- `{{u.name}}` — ФИО
- `{{u.email}}` — email
- `{{u.position}}` — должность

**Общие токены (gn.):**
- `{{gn.current_date}}` — текущая дата
- `{{gn.current_time}}` — текущее время
- `{{gn.page_number}}` — номер страницы
- `{{gn.total_pages}}` — всего страниц

**Блочные токены:**
- `{{#tickets_table columns="code,title,status,assigned_to"}}` — таблица задач
- `{{#ticket_images grid="2x2"}}` — сетка фото
- `{{#plan_view}}` — план с маркерами
- `{{#chart type="pie" field="status"}}` — диаграмма
- `{{#if field="status" value="closed"}}...{{/if}}` — условный блок

### 4.12.4 Backend API

#### POST /api/v1/report-templates

**Описание:** Создание шаблона отчёта

**Тело запроса:**
```json
{
    "name": "Отчёт по дефектам",
    "template_type": "ticket_report",
    "page_orientation": "portrait",
    "body_html": "<h1>Отчёт по проекту: {{p.name}}</h1><p>Дата: {{gn.current_date}}</p>{{#tickets_table columns='code,title,status'}}",
    "settings": {
        "order_by": "created_at",
        "include_images": true,
        "images_per_row": 2
    }
}
```

#### POST /api/v1/reports/generate

**Описание:** Генерация отчёта по шаблону

**Тело запроса:**
```json
{
    "template_id": "template-001",
    "project_id": "project-001",
    "format": "pdf",
    "parameters": {
        "ticket_filters": {
            "status_id": [1, 2],
            "date_from": "2024-01-01"
        }
    }
}
```

**Логика генерации:**
1. Получить шаблон
2. Получить данные по параметрам
3. Заменить токены на реальные значения
4. Обработать блочные токены (таблицы, графики)
5. Сгенерировать PDF (Puppeteer)
6. Сохранить в S3
7. Вернуть URL

### 4.12.5 Критерии приёмки

- [ ] WYSIWYG-редактор шаблонов
- [ ] Система токенов (проект, задачи, пользователь)
- [ ] Блочные токены (таблицы, графики, изображения)
- [ ] Условная видимость блоков
- [ ] Настройки страницы (ориентация, размер, поля)
- [ ] Колонтитулы (header/footer)
- [ ] Нумерация страниц
- [ ] Генерация PDF
- [ ] Экспорт в XLSX
- [ ] Библиотека шаблонов
- [ ] Предпросмотр шаблона

---

## МОДУЛЬ 13: Согласования (Approval Workflows)

### 4.13.1 Описание и цели модуля

**Назначение:** Управление процессами согласования документов, смет и изменений с многоэтапными маршрутами.

**Бизнес-цели:**
- Формализация процессов согласования
- Многоэтапные маршруты с участниками
- Уведомления и напоминания
- История согласований

### 4.13.2 База данных

```sql
-- Таблица: approval_workflow_templates (Шаблоны workflow)
CREATE TABLE approval_workflow_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    -- Настройки
    allow_modification BOOLEAN DEFAULT FALSE, -- можно ли менять в процессе
    notify_involved BOOLEAN DEFAULT TRUE,
    -- Шаги [{step: 1, name, approvers: [{user_id, role_id}], require_all: true}]
    steps JSONB NOT NULL,
    -- Метаданные
    is_active BOOLEAN DEFAULT TRUE,
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица: approval_requests (Запросы на согласование)
CREATE TABLE approval_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id),
    workflow_template_id UUID REFERENCES approval_workflow_templates(id),
    -- Объект согласования
    entity_type VARCHAR(50) NOT NULL, -- estimate, act, document, change_request
    entity_id UUID NOT NULL,
    -- Информация
    subject VARCHAR(500) NOT NULL,
    message TEXT,
    -- Состояние
    current_step INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'pending', -- pending, in_progress, approved, rejected, cancelled
    -- Даты
    due_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    -- Аудит
    initiated_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица: approval_actions (Действия по согласованию)
CREATE TABLE approval_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
    step INTEGER NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    -- Действие
    action VARCHAR(20) NOT NULL, -- approved, rejected, returned, delegated
    comment TEXT,
    -- Делегирование
    delegated_to_id UUID REFERENCES users(id),
    -- Метаданные
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 4.13.3 Критерии приёмки

- [ ] Создание шаблонов workflow
- [ ] Многоэтапные маршруты
- [ ] Инициирование согласования
- [ ] Согласование/отклонение/возврат
- [ ] Делегирование
- [ ] Уведомления участникам
- [ ] Напоминания о сроках
- [ ] История согласований

---

## МОДУЛЬ 14: Настройки и интеграции

### 4.14.1 Описание и цели модуля

**Назначение:** Управление настройками пользователя, компании и внешними интеграциями.

### 4.14.2 Функционал

**Настройки пользователя:**
- Профиль (ФИО, аватар, контакты)
- Смена пароля
- Двухфакторная аутентификация (2FA)
- Язык и часовой пояс
- Настройки уведомлений

**Настройки компании:**
- Реквизиты компании
- Логотип и брендирование
- Валюта по умолчанию
- Рабочие дни и праздники
- Шаблоны документов

**Интеграции:**
- DaData (автозаполнение реквизитов)
- Email (SMTP/SendGrid)
- СМС-уведомления
- Календари (Google, Outlook)
- Вебхуки для внешних систем

### 4.14.3 Критерии приёмки

- [ ] Редактирование профиля
- [ ] 2FA (TOTP)
- [ ] Управление сессиями
- [ ] Настройки уведомлений
- [ ] Реквизиты компании
- [ ] Загрузка логотипа
- [ ] Интеграция с DaData
- [ ] Настройка вебхуков

---

## МОДУЛЬ 15: Биллинг (SaaS)

### 4.15.1 Описание и цели модуля

**Назначение:** Управление подписками, тарифными планами и оплатой в SaaS-модели.

### 4.15.2 База данных

```sql
-- Таблица: billing_plans (Тарифные планы)
CREATE TABLE billing_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    -- Лимиты
    max_users INTEGER, -- NULL = безлимит
    max_projects INTEGER,
    max_storage_gb INTEGER,
    -- Доступные модули
    modules JSONB DEFAULT '[]', -- ['estimates', 'offers', 'tasks', 'gantt', ...]
    -- Цены
    price_monthly DECIMAL(10, 2),
    price_yearly DECIMAL(10, 2),
    currency VARCHAR(3) DEFAULT 'RUB',
    -- Метаданные
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Предустановленные планы
INSERT INTO billing_plans (name, code, max_users, max_projects, price_monthly, modules) VALUES
('Бесплатный', 'free', 2, 3, 0, '["estimates"]'),
('Стартап', 'startup', 5, 10, 2990, '["estimates", "offers", "tasks"]'),
('Бизнес', 'business', 20, 50, 9990, '["estimates", "offers", "tasks", "gantt", "dms", "finance"]'),
('Корпоративный', 'enterprise', NULL, NULL, NULL, '["*"]'); -- по запросу

-- Таблица: subscriptions (Подписки)
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    plan_id INTEGER NOT NULL REFERENCES billing_plans(id),
    -- Период
    billing_period VARCHAR(20) NOT NULL, -- monthly, yearly
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    -- Состояние
    status VARCHAR(20) DEFAULT 'active', -- active, past_due, cancelled, expired
    auto_renew BOOLEAN DEFAULT TRUE,
    -- Платёжные данные
    payment_method_id UUID,
    last_payment_at TIMESTAMP WITH TIME ZONE,
    next_payment_at TIMESTAMP WITH TIME ZONE,
    -- Метаданные
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица: payments (Платежи)
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    subscription_id UUID REFERENCES subscriptions(id),
    -- Сумма
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'RUB',
    -- Платёжная система
    payment_provider VARCHAR(50), -- stripe, yookassa, cloudpayments
    external_id VARCHAR(255), -- ID в платёжной системе
    -- Статус
    status VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed, refunded
    -- Метаданные
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);
```

### 4.15.3 Backend API

#### GET /api/v1/billing/plans

**Описание:** Список доступных тарифов

#### POST /api/v1/billing/subscribe

**Описание:** Оформление подписки

**Тело запроса:**
```json
{
    "plan_id": 2,
    "billing_period": "yearly",
    "payment_method": "card",
    "promo_code": "WELCOME20"
}
```

#### POST /api/v1/billing/webhook

**Описание:** Вебхук от платёжной системы

### 4.15.4 Критерии приёмки

- [ ] Страница тарифов
- [ ] Оформление подписки
- [ ] Интеграция с платёжной системой
- [ ] Учёт лимитов по тарифу
- [ ] Уведомления об окончании подписки
- [ ] Автопродление
- [ ] История платежей
- [ ] Промокоды и скидки

---

# ПРИЛОЖЕНИЕ: SQL-скрипты инициализации

## Создание базовых данных

```sql
-- Валюты
INSERT INTO currencies (id, code, name, symbol) VALUES
(1, 'RUB', 'Российский рубль', '₽'),
(2, 'USD', 'Доллар США', '$'),
(3, 'EUR', 'Евро', '€');

-- Страны
INSERT INTO countries (id, code, name) VALUES
(1, 'RU', 'Россия'),
(2, 'BY', 'Беларусь'),
(3, 'KZ', 'Казахстан');

-- Единицы измерения
INSERT INTO unit_measures (id, code, name, is_system) VALUES
(1, 'м', 'метр', TRUE),
(2, 'шт', 'штука', TRUE),
(3, 'компл', 'комплект', TRUE),
(4, 'м²', 'квадратный метр', TRUE),
(5, 'м³', 'кубический метр', TRUE),
(6, 'кг', 'килограмм', TRUE),
(7, 'т', 'тонна', TRUE),
(8, 'п.м', 'погонный метр', TRUE),
(9, 'л', 'литр', TRUE),
(10, 'час', 'час', TRUE);

-- Системные роли
INSERT INTO roles (id, name, slug, is_system, level) VALUES
(1, 'Суперадминистратор', 'superadmin', TRUE, 'system'),
(2, 'Владелец', 'owner', TRUE, 'company'),
(3, 'Администратор', 'admin', TRUE, 'company'),
(4, 'Руководитель проектов', 'project_manager', TRUE, 'project'),
(5, 'Инженер-сметчик', 'estimator', TRUE, 'project'),
(6, 'Прораб', 'foreman', TRUE, 'project'),
(7, 'Субподрядчик', 'subcontractor', TRUE, 'project'),
(8, 'Наблюдатель', 'observer', TRUE, 'project'),
(9, 'Бухгалтер', 'accountant', TRUE, 'company');

-- Базовые права
INSERT INTO permissions (resource, action, description) VALUES
-- Компания
('company', 'view', 'Просмотр компании'),
('company', 'edit', 'Редактирование компании'),
('company', 'delete', 'Удаление компании'),
-- Пользователи
('users', 'view', 'Просмотр пользователей'),
('users', 'create', 'Создание пользователей'),
('users', 'edit', 'Редактирование пользователей'),
('users', 'delete', 'Удаление пользователей'),
-- Проекты
('projects', 'view', 'Просмотр проектов'),
('projects', 'create', 'Создание проектов'),
('projects', 'edit', 'Редактирование проектов'),
('projects', 'delete', 'Удаление проектов'),
-- Сметы
('estimates', 'view', 'Просмотр смет'),
('estimates', 'create', 'Создание смет'),
('estimates', 'edit', 'Редактирование смет'),
('estimates', 'delete', 'Удаление смет'),
-- Задачи
('tickets', 'view', 'Просмотр задач'),
('tickets', 'create', 'Создание задач'),
('tickets', 'edit', 'Редактирование задач'),
('tickets', 'delete', 'Удаление задач'),
('tickets', 'assign', 'Назначение задач'),
-- Документы
('documents', 'view', 'Просмотр документов'),
('documents', 'upload', 'Загрузка документов'),
('documents', 'delete', 'Удаление документов'),
('documents', 'manage_permissions', 'Управление правами на документы'),
-- Финансы
('finance', 'view', 'Просмотр финансов'),
('finance', 'create', 'Создание операций'),
('finance', 'confirm', 'Подтверждение платежей'),
-- Отчёты
('reports', 'view', 'Просмотр отчётов'),
('reports', 'create', 'Создание шаблонов'),
('reports', 'export', 'Экспорт отчётов');

-- Статусы проектов по умолчанию
INSERT INTO project_statuses (id, name, color, is_default, is_closed, sort_order) VALUES
(1, 'Планирование', 'blue', TRUE, FALSE, 1),
(2, 'В работе', 'green', FALSE, FALSE, 2),
(3, 'На паузе', 'yellow', FALSE, FALSE, 3),
(4, 'Завершён', 'gray', FALSE, TRUE, 4);

-- Статусы задач по умолчанию
INSERT INTO ticket_statuses (id, name, color, is_default, is_closed, sort_order) VALUES
(1, 'Открыта', 'red', TRUE, FALSE, 1),
(2, 'В работе', 'blue', FALSE, FALSE, 2),
(3, 'На проверке', 'yellow', FALSE, FALSE, 3),
(4, 'Решена', 'green', FALSE, FALSE, 4),
(5, 'Закрыта', 'gray', FALSE, TRUE, 5),
(6, 'Отклонена', 'gray', FALSE, TRUE, 6);

-- Приоритеты задач
INSERT INTO ticket_priorities (id, name, color, is_default, sort_order) VALUES
(1, 'Низкий', 'gray', FALSE, 1),
(2, 'Нормальный', 'blue', TRUE, 2),
(3, 'Высокий', 'orange', FALSE, 3),
(4, 'Критический', 'red', FALSE, 4);
```

---

**Конец части 2**

*Документ является продолжением TZ_ElektroSmeta_Integration_v2_0.md*
*Версия: 2.0 | Дата: 07.02.2026*


---
---
---

# ═══════════════════════════════════════════════════════════════
# ЧАСТЬ 3: ДЕТАЛИЗАЦИЯ МОДУЛЕЙ 12–15 (ПОЛНАЯ)
# ═══════════════════════════════════════════════════════════════

# ТЕХНИЧЕСКОЕ ЗАДАНИЕ: ElektroSmeta v2.0
# ЧАСТЬ 3: Детализация модулей 12-15 (ПОЛНАЯ)

**Продолжение документов TZ_ElektroSmeta_Integration_v2_0.md и TZ_ElektroSmeta_Modules_7_15.md**

**Версия:** 2.0.1  
**Дата:** 07.02.2026

---

## МОДУЛЬ 12: Отчётность (ПОЛНАЯ ДЕТАЛИЗАЦИЯ)

### 4.12.1 Описание и цели модуля

**Назначение:** Конструктор отчётов с WYSIWYG-редактором, шаблонами и системой токенов для генерации PDF-документов, дашборды и аналитические панели.

**Бизнес-цели:**
- Гибкое создание отчётов любой структуры
- Шаблоны для типовых документов (акты, протоколы, ведомости)
- Автоматическая подстановка данных через токены
- Брендирование отчётов (логотипы, стили)
- Интерактивные дашборды
- Экспорт в PDF, XLSX, CSV

**Связь с другими модулями:**
- **Зависит от:** Модуль 1 (Ядро), Модуль 2 (Проекты), Модуль 3 (Сметы), Модуль 6 (Задачи)
- **Используется:** Модуль 10 (Финансы), Модуль 13 (Согласования)

### 4.12.2 Роли и права доступа

| Действие | Владелец | Админ | Рук. проектов | Сметчик | Прораб | Бухгалтер | Наблюд. |
|----------|:--------:|:-----:|:-------------:|:-------:|:------:|:---------:|:-------:|
| Просмотр отчётов | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Генерация отчётов | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Создание шаблонов | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Редактирование шаблонов | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Удаление шаблонов | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Настройка дашбордов | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Экспорт данных | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### 4.12.3 База данных

```sql
-- Таблица: report_templates (Шаблоны отчётов)
CREATE TABLE report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    -- Тип и категория
    template_type VARCHAR(50) NOT NULL, 
    -- project_report, ticket_report, financial_report, estimate_report, act_report, custom
    category VARCHAR(100),
    -- Настройки страницы
    page_orientation VARCHAR(20) DEFAULT 'portrait', -- portrait, landscape
    page_size VARCHAR(10) DEFAULT 'A4', -- A4, A3, Letter
    margins JSONB DEFAULT '{"top": 18, "bottom": 18, "left": 10, "right": 10}', -- mm
    -- Контент (HTML с токенами)
    header_html TEXT,
    body_html TEXT NOT NULL,
    footer_html TEXT,
    -- Стили CSS
    custom_css TEXT,
    -- Настройки
    settings JSONB DEFAULT '{}', 
    -- {order_by, visibility, include_images, group_by, filters_allowed, etc.}
    -- Обязательные параметры при генерации
    required_params JSONB DEFAULT '[]', -- [{name, type, label, default}]
    -- Системный
    is_system BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    preview_image_url VARCHAR(500),
    -- Версионирование
    version INTEGER DEFAULT 1,
    parent_template_id UUID REFERENCES report_templates(id),
    -- Аудит
    created_by_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы
CREATE INDEX idx_report_templates_company ON report_templates(company_id);
CREATE INDEX idx_report_templates_type ON report_templates(template_type);
CREATE INDEX idx_report_templates_active ON report_templates(is_active) WHERE is_active = TRUE;

-- Таблица: generated_reports (Сгенерированные отчёты)
CREATE TABLE generated_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    template_id UUID REFERENCES report_templates(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    -- Название
    name VARCHAR(255) NOT NULL,
    -- Результат
    format VARCHAR(10) NOT NULL, -- pdf, xlsx, csv, html
    file_url VARCHAR(500),
    file_size BIGINT,
    -- Параметры генерации (для повторной генерации)
    parameters JSONB DEFAULT '{}', 
    -- {ticket_filters, date_from, date_to, include_images, etc.}
    -- Кэширование
    cache_key VARCHAR(255), -- хеш параметров для кэширования
    expires_at TIMESTAMP WITH TIME ZONE,
    -- Аудит
    generated_by_id UUID NOT NULL REFERENCES users(id),
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    generation_time_ms INTEGER -- время генерации для мониторинга
);

-- Индексы
CREATE INDEX idx_generated_reports_company ON generated_reports(company_id);
CREATE INDEX idx_generated_reports_project ON generated_reports(project_id);
CREATE INDEX idx_generated_reports_template ON generated_reports(template_id);
CREATE INDEX idx_generated_reports_cache ON generated_reports(cache_key);
CREATE INDEX idx_generated_reports_date ON generated_reports(generated_at DESC);

-- Таблица: dashboards (Дашборды)
CREATE TABLE dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE, -- NULL = общий дашборд
    name VARCHAR(255) NOT NULL,
    description TEXT,
    -- Тип
    dashboard_type VARCHAR(50) DEFAULT 'custom', -- project, financial, tasks, custom
    -- Layout
    layout JSONB NOT NULL DEFAULT '[]', 
    -- [{widget_id, x, y, w, h, config}]
    -- Настройки
    is_default BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE, -- доступен всем участникам
    refresh_interval INTEGER DEFAULT 0, -- секунды, 0 = без авто-обновления
    -- Аудит
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы
CREATE INDEX idx_dashboards_company ON dashboards(company_id);
CREATE INDEX idx_dashboards_project ON dashboards(project_id);
CREATE INDEX idx_dashboards_default ON dashboards(is_default) WHERE is_default = TRUE;

-- Таблица: dashboard_widgets (Виджеты дашбордов)
CREATE TABLE dashboard_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    -- Тип виджета
    widget_type VARCHAR(50) NOT NULL, 
    -- counter, chart_pie, chart_bar, chart_line, table, list, progress, calendar
    -- Источник данных
    data_source VARCHAR(100) NOT NULL, 
    -- tickets, estimates, finance, projects, resources, custom_query
    -- Конфигурация
    config JSONB NOT NULL DEFAULT '{}',
    -- {
    --   metrics: ['count', 'sum', 'avg'],
    --   dimensions: ['status', 'date', 'assignee'],
    --   filters: {},
    --   chart_options: {},
    --   refresh_interval: 0
    -- }
    -- Системный виджет
    is_system BOOLEAN DEFAULT FALSE,
    -- Аудит
    created_by_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Предустановленные виджеты
INSERT INTO dashboard_widgets (id, name, widget_type, data_source, config, is_system) VALUES
-- Задачи
(gen_random_uuid(), 'Задачи по статусам', 'chart_pie', 'tickets', 
 '{"dimensions": ["status"], "metrics": ["count"], "colors": "status"}', TRUE),
(gen_random_uuid(), 'Открытые задачи', 'counter', 'tickets', 
 '{"filters": {"is_closed": false}, "metrics": ["count"], "icon": "ticket"}', TRUE),
(gen_random_uuid(), 'Просроченные задачи', 'counter', 'tickets', 
 '{"filters": {"overdue": true}, "metrics": ["count"], "color": "red", "icon": "alert"}', TRUE),
(gen_random_uuid(), 'Задачи по исполнителям', 'chart_bar', 'tickets', 
 '{"dimensions": ["assigned_to"], "metrics": ["count"], "orientation": "horizontal"}', TRUE),
(gen_random_uuid(), 'Динамика задач', 'chart_line', 'tickets', 
 '{"dimensions": ["created_at"], "metrics": ["count"], "period": "week"}', TRUE),
-- Финансы
(gen_random_uuid(), 'Бюджет проекта', 'progress', 'finance', 
 '{"metrics": ["budget_spent", "budget_total"], "show_percent": true}', TRUE),
(gen_random_uuid(), 'Доходы vs Расходы', 'chart_bar', 'finance', 
 '{"dimensions": ["month"], "metrics": ["income", "expense"], "stacked": false}', TRUE),
(gen_random_uuid(), 'Cashflow', 'chart_line', 'finance', 
 '{"dimensions": ["date"], "metrics": ["balance"], "period": "day"}', TRUE),
-- Проекты
(gen_random_uuid(), 'Прогресс проекта', 'progress', 'projects', 
 '{"metrics": ["completed_tasks", "total_tasks"]}', TRUE),
(gen_random_uuid(), 'Статусы проектов', 'chart_pie', 'projects', 
 '{"dimensions": ["status"], "metrics": ["count"]}', TRUE);

-- Таблица: scheduled_reports (Запланированные отчёты)
CREATE TABLE scheduled_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES report_templates(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    -- Название и параметры
    name VARCHAR(255) NOT NULL,
    parameters JSONB DEFAULT '{}',
    -- Расписание (cron)
    schedule_cron VARCHAR(100) NOT NULL, -- '0 8 * * 1' = каждый понедельник в 8:00
    timezone VARCHAR(50) DEFAULT 'Europe/Moscow',
    -- Формат и доставка
    format VARCHAR(10) DEFAULT 'pdf',
    delivery_method VARCHAR(20) DEFAULT 'email', -- email, storage, both
    recipients JSONB DEFAULT '[]', -- [{email, user_id}]
    -- Состояние
    is_active BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    -- Аудит
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы
CREATE INDEX idx_scheduled_reports_active ON scheduled_reports(is_active, next_run_at) WHERE is_active = TRUE;
CREATE INDEX idx_scheduled_reports_company ON scheduled_reports(company_id);
```

### 4.12.4 Система токенов (ПОЛНЫЙ СПРАВОЧНИК)

#### Простые токены (подстановка значений)

**Проект (p.):**
```
{{p.id}}              - ID проекта
{{p.code}}            - Код проекта
{{p.name}}            - Название проекта
{{p.full_name}}       - Полное название
{{p.address}}         - Адрес объекта
{{p.description}}     - Описание
{{p.status}}          - Статус
{{p.customer}}        - Заказчик (название)
{{p.customer.inn}}    - ИНН заказчика
{{p.manager}}         - Менеджер (ФИО)
{{p.start_date}}      - Дата начала
{{p.end_date}}        - Дата окончания
{{p.budget}}          - Бюджет
{{p.spent}}           - Израсходовано
{{p.progress}}        - Прогресс (%)
```

**Задача (t.):**
```
{{t.id}}              - ID задачи
{{t.code}}            - Номер задачи
{{t.title}}           - Заголовок
{{t.description}}     - Описание (HTML)
{{t.description_text}} - Описание (plain text)
{{t.status}}          - Статус (название)
{{t.status.color}}    - Цвет статуса
{{t.priority}}        - Приоритет
{{t.assigned_to}}     - Исполнитель (ФИО)
{{t.author}}          - Автор (ФИО)
{{t.due_date}}        - Срок
{{t.created_at}}      - Дата создания
{{t.updated_at}}      - Дата обновления
{{t.closed_at}}       - Дата закрытия
{{t.progress}}        - Прогресс (%)
{{t.component}}       - Компонент/Этаж
{{t.custom_fields.X}} - Кастомное поле X
```

**Смета (e.):**
```
{{e.subtotal}}          - Итого до наценок
{{e.markups_total}}     - Сумма наценок
{{e.total}}             - Итого со сметы
{{e.stages_count}}      - Количество разделов
{{e.tasks_count}}       - Количество работ
{{e.resources_count}}   - Количество ресурсов
```

**Акт (a.):**
```
{{a.number}}            - Номер акта
{{a.date}}              - Дата акта
{{a.period}}            - Период (от - до)
{{a.contractor}}        - Контрагент
{{a.subtotal}}          - Сумма до наценок
{{a.nds}}               - НДС
{{a.total}}             - Итого
{{a.total_words}}       - Итого прописью
```

**Пользователь (u.):**
```
{{u.id}}              - ID пользователя
{{u.name}}            - ФИО
{{u.first_name}}      - Имя
{{u.last_name}}       - Фамилия
{{u.email}}           - Email
{{u.phone}}           - Телефон
{{u.position}}        - Должность
{{u.avatar_url}}      - URL аватара
```

**Компания (c.):**
```
{{c.name}}            - Название компании
{{c.inn}}             - ИНН
{{c.kpp}}             - КПП
{{c.ogrn}}            - ОГРН
{{c.legal_address}}   - Юридический адрес
{{c.actual_address}}  - Фактический адрес
{{c.phone}}           - Телефон
{{c.email}}           - Email
{{c.website}}         - Сайт
{{c.logo_url}}        - URL логотипа
{{c.director}}        - Руководитель
```

**Общие (gn.):**
```
{{gn.current_date}}       - Текущая дата (DD.MM.YYYY)
{{gn.current_date_long}}  - Текущая дата (01 января 2024 г.)
{{gn.current_time}}       - Текущее время (HH:MM)
{{gn.current_datetime}}   - Дата и время
{{gn.page_number}}        - Номер страницы
{{gn.total_pages}}        - Всего страниц
{{gn.report_name}}        - Название отчёта
{{gn.generated_by}}       - Кто сгенерировал
```

#### Блочные токены (генерация таблиц, списков, графиков)

**Таблица задач:**
```html
{{#tickets_table 
    columns="code,title,status,priority,assigned_to,due_date"
    order_by="code"
    limit="100"
    filters="{status_id: [1,2], priority_id: 3}"
}}

<!-- Результат: -->
<table class="report-table">
  <thead>
    <tr>
      <th>Номер</th>
      <th>Название</th>
      <th>Статус</th>
      <th>Приоритет</th>
      <th>Исполнитель</th>
      <th>Срок</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>TKT-001</td>
      <td>Дефект проводки</td>
      <td><span class="status" style="background: #ff0000">Открыта</span></td>
      <td>Высокий</td>
      <td>Иванов И.И.</td>
      <td>15.02.2024</td>
    </tr>
    <!-- ... -->
  </tbody>
</table>
```

**Изображения задачи:**
```html
{{#ticket_images 
    grid="2x2"
    max="8"
    show_captions="true"
}}

<!-- Результат: сетка изображений с подписями -->
```

**Таблица сметы:**
```html
{{#estimate_table
    columns="code,name,unit,volume,price,markup,total"
    group_by="stage"
    show_totals="true"
    show_markups="true"
}}
```

**Таблица акта:**
```html
{{#act_table
    format="KS2"
    show_previous="true"
    show_totals="true"
}}
```

**Диаграмма:**
```html
{{#chart 
    type="pie"
    data_source="tickets"
    dimension="status"
    metric="count"
    width="400"
    height="300"
    colors="status"
}}

{{#chart 
    type="bar"
    data_source="finance"
    dimension="month"
    metrics="income,expense"
    width="600"
    height="400"
    stacked="false"
}}

{{#chart 
    type="line"
    data_source="tickets"
    dimension="created_at"
    metric="count"
    period="week"
    width="600"
    height="300"
}}
```

**План с маркерами:**
```html
{{#plan_view
    plan_id="plan-001"
    show_tickets="true"
    show_markups="true"
    scale="fit"
}}
```

**Условные блоки:**
```html
{{#if field="t.status" value="closed"}}
    <p>Задача закрыта: {{t.closed_at}}</p>
{{/if}}

{{#if field="e.total" operator=">" value="1000000"}}
    <p class="warning">Внимание: смета превышает 1 млн рублей</p>
{{/if}}

{{#unless field="t.assigned_to"}}
    <p class="warning">Исполнитель не назначен!</p>
{{/unless}}
```

**Цикл по коллекции:**
```html
{{#each tickets}}
    <div class="ticket-card">
        <h3>{{this.code}}: {{this.title}}</h3>
        <p>Статус: {{this.status}}</p>
        {{#each this.comments}}
            <div class="comment">
                <strong>{{this.author}}</strong>: {{this.content}}
            </div>
        {{/each}}
    </div>
{{/each}}
```

### 4.12.5 Backend API

#### GET /api/v1/report-templates

**Описание:** Список шаблонов отчётов

**Query параметры:**

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| template_type | string | - | Фильтр по типу |
| category | string | - | Фильтр по категории |
| is_system | boolean | - | Только системные |
| search | string | - | Поиск по названию |
| page | integer | 1 | Страница |
| per_page | integer | 20 | Записей на странице |

**Ответ:**
```json
{
    "success": true,
    "data": [
        {
            "id": "template-001",
            "name": "Отчёт по дефектам",
            "description": "Список всех дефектов проекта с фото",
            "template_type": "ticket_report",
            "category": "Задачи",
            "page_orientation": "portrait",
            "page_size": "A4",
            "is_system": true,
            "preview_image_url": "/previews/template-001.png",
            "created_at": "2024-01-01T00:00:00Z"
        }
    ],
    "meta": {
        "current_page": 1,
        "per_page": 20,
        "total": 15
    }
}
```

#### POST /api/v1/report-templates

**Описание:** Создание шаблона отчёта

**Тело запроса:**
```json
{
    "name": "Отчёт по дефектам",
    "description": "Список всех дефектов проекта с фото и комментариями",
    "template_type": "ticket_report",
    "category": "Задачи",
    "page_orientation": "portrait",
    "page_size": "A4",
    "margins": {"top": 18, "bottom": 18, "left": 10, "right": 10},
    "header_html": "<div class=\"header\"><img src=\"{{c.logo_url}}\" height=\"40\"/><span>{{c.name}}</span></div>",
    "body_html": "<h1>Отчёт по дефектам</h1><p>Проект: {{p.name}}</p><p>Дата: {{gn.current_date}}</p>{{#tickets_table columns='code,title,status,priority,assigned_to' filters='{ticket_type: \"defect\"}'}}",
    "footer_html": "<div class=\"footer\">Страница {{gn.page_number}} из {{gn.total_pages}}</div>",
    "custom_css": ".header { display: flex; justify-content: space-between; } .status { padding: 2px 8px; border-radius: 4px; }",
    "settings": {
        "order_by": "created_at",
        "include_images": true,
        "images_per_row": 2,
        "group_by": "status"
    },
    "required_params": [
        {"name": "date_from", "type": "date", "label": "Дата с", "default": null},
        {"name": "date_to", "type": "date", "label": "Дата по", "default": null}
    ]
}
```

**Валидация:**
- name: required, min 3, max 255
- template_type: required, enum
- body_html: required, min 10

**Ответ:**
```json
{
    "success": true,
    "data": {
        "id": "template-002",
        "name": "Отчёт по дефектам",
        "version": 1,
        "created_at": "2024-02-10T12:00:00Z"
    }
}
```

#### POST /api/v1/reports/generate

**Описание:** Генерация отчёта по шаблону

**Тело запроса:**
```json
{
    "template_id": "template-001",
    "project_id": "project-001",
    "format": "pdf",
    "name": "Отчёт по дефектам - февраль 2024",
    "parameters": {
        "ticket_filters": {
            "status_id": [1, 2],
            "ticket_type_id": "defect",
            "date_from": "2024-02-01",
            "date_to": "2024-02-29"
        },
        "include_images": true,
        "include_comments": true
    }
}
```

**Логика обработки:**
1. Получить шаблон и проверить права
2. Валидация обязательных параметров
3. Сформировать cache_key = hash(template_id + parameters)
4. Проверить наличие кэшированного отчёта (если < 5 мин)
5. Если кэш есть → вернуть URL
6. Начать генерацию:
   - Получить данные по параметрам (проект, задачи, смета и т.д.)
   - Заменить простые токены на значения
   - Обработать блочные токены (таблицы, графики, изображения)
   - Применить custom_css
   - Собрать финальный HTML
7. Генерация PDF через Puppeteer:
   - Запуск headless Chrome
   - Рендер HTML с настройками страницы
   - Генерация PDF
8. Сохранить в S3: /reports/{company_id}/{year}/{month}/{report_id}.pdf
9. Создать запись generated_reports
10. Вернуть URL

**Ответ (синхронно, если быстрая генерация):**
```json
{
    "success": true,
    "data": {
        "report_id": "report-001",
        "name": "Отчёт по дефектам - февраль 2024",
        "format": "pdf",
        "file_url": "/storage/reports/company-001/2024/02/report-001.pdf",
        "file_size": 1250000,
        "generation_time_ms": 2350,
        "generated_at": "2024-02-10T12:05:00Z"
    }
}
```

**Ответ (асинхронно, если долгая генерация):**
```json
{
    "success": true,
    "data": {
        "job_id": "job-001",
        "status": "processing",
        "estimated_time_seconds": 30,
        "webhook_url": "/api/v1/reports/status/job-001"
    }
}
```

#### GET /api/v1/reports/status/{jobId}

**Описание:** Статус асинхронной генерации

**Ответ (в процессе):**
```json
{
    "success": true,
    "data": {
        "job_id": "job-001",
        "status": "processing",
        "progress": 65,
        "message": "Генерация таблиц..."
    }
}
```

**Ответ (завершено):**
```json
{
    "success": true,
    "data": {
        "job_id": "job-001",
        "status": "completed",
        "report_id": "report-001",
        "file_url": "/storage/reports/company-001/2024/02/report-001.pdf"
    }
}
```

#### GET /api/v1/dashboards

**Описание:** Список дашбордов

**Query параметры:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| project_id | UUID | Фильтр по проекту |
| dashboard_type | string | Тип дашборда |

**Ответ:**
```json
{
    "success": true,
    "data": [
        {
            "id": "dashboard-001",
            "name": "Обзор проекта",
            "dashboard_type": "project",
            "project_id": "project-001",
            "is_default": true,
            "widgets_count": 6
        }
    ]
}
```

#### GET /api/v1/dashboards/{id}/data

**Описание:** Данные всех виджетов дашборда

**Ответ:**
```json
{
    "success": true,
    "data": {
        "dashboard": {
            "id": "dashboard-001",
            "name": "Обзор проекта",
            "layout": [
                {"widget_id": "w1", "x": 0, "y": 0, "w": 4, "h": 2},
                {"widget_id": "w2", "x": 4, "y": 0, "w": 4, "h": 2}
            ]
        },
        "widgets": {
            "w1": {
                "widget_type": "counter",
                "name": "Открытые задачи",
                "value": 15,
                "trend": {"direction": "up", "value": 3, "period": "week"},
                "color": "blue"
            },
            "w2": {
                "widget_type": "chart_pie",
                "name": "Задачи по статусам",
                "data": [
                    {"label": "Открыта", "value": 15, "color": "#FF0000"},
                    {"label": "В работе", "value": 8, "color": "#0000FF"},
                    {"label": "Решена", "value": 12, "color": "#00FF00"}
                ]
            }
        }
    }
}
```

#### POST /api/v1/scheduled-reports

**Описание:** Создание запланированного отчёта

**Тело запроса:**
```json
{
    "name": "Еженедельный отчёт по задачам",
    "template_id": "template-001",
    "project_id": "project-001",
    "parameters": {
        "include_images": false,
        "status_ids": [1, 2, 3]
    },
    "schedule_cron": "0 8 * * 1",
    "timezone": "Europe/Moscow",
    "format": "pdf",
    "delivery_method": "email",
    "recipients": [
        {"email": "manager@company.com"},
        {"user_id": "user-001"}
    ]
}
```

### 4.12.6 Frontend - Интерфейс пользователя

#### Страница: Конструктор шаблона отчёта

**URL:** `/settings/report-templates/{id}/edit`

**Wireframe:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [← Шаблоны] Редактирование шаблона: Отчёт по дефектам    [Превью] [Сохранить]│
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────┐ ┌───────────────────────────────────┐ │
│ │ ПАРАМЕТРЫ ШАБЛОНА                 │ │ ТОКЕНЫ                            │ │
│ │                                   │ │                                   │ │
│ │ Название: [Отчёт по дефектам    ] │ │ 🔍 Поиск токенов...              │ │
│ │                                   │ │                                   │ │
│ │ Тип: [▼ Отчёт по задачам        ] │ │ ▼ Проект                         │ │
│ │                                   │ │   {{p.name}} - Название          │ │
│ │ Категория: [Задачи              ] │ │   {{p.address}} - Адрес          │ │
│ │                                   │ │   ...                            │ │
│ │ ┌─────────────────┐               │ │                                   │ │
│ │ │ Формат страницы │               │ │ ▼ Задачи                         │ │
│ │ │ [○ A4] [○ A3]   │               │ │   {{t.code}} - Номер             │ │
│ │ │ [○ Портрет]     │               │ │   {{t.title}} - Название         │ │
│ │ │ [○ Альбом]      │               │ │   ...                            │ │
│ │ └─────────────────┘               │ │                                   │ │
│ └───────────────────────────────────┘ │ ▼ Блоки                          │ │
│                                       │   {{#tickets_table}}             │ │
│ ┌───────────────────────────────────────────────────────────────────────┐ │
│ │                        WYSIWYG РЕДАКТОР                               │ │
│ │ ─────────────────────────────────────────────────────────────────     │ │
│ │ [B] [I] [U] | [H1] [H2] | [≡] [⋮⋮] | [📷] [📊] | [<>] Код            │ │
│ │ ─────────────────────────────────────────────────────────────────     │ │
│ │                                                                       │ │
│ │    ┌─────────────────────────────────────────────────────────────┐   │ │
│ │    │  [LOGO]                                    {{c.name}}       │   │ │
│ │    └─────────────────────────────────────────────────────────────┘   │ │
│ │                                                                       │ │
│ │    <h1>Отчёт по дефектам</h1>                                        │ │
│ │    <p>Проект: {{p.name}}</p>                                         │ │
│ │    <p>Дата формирования: {{gn.current_date}}</p>                     │ │
│ │                                                                       │ │
│ │    {{#tickets_table columns="code,title,status,priority"}}           │ │
│ │                                                                       │ │
│ │    {{#ticket_images grid="2x2"}}                                     │ │
│ │                                                                       │ │
│ └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Элементы интерфейса:**

| Элемент | Тип | Поведение |
|---------|-----|-----------|
| Редактор | WYSIWYG (TipTap/Slate) | Визуальное редактирование HTML |
| Панель токенов | Sidebar | Drag&drop токенов в редактор |
| Переключатель код/визуал | Toggle | Переключение между режимами |
| Превью | Modal | Предпросмотр с тестовыми данными |

#### Страница: Дашборд

**URL:** `/projects/{id}/dashboard` или `/dashboard`

**Wireframe:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Обзор проекта: ЖК Новые горизонты         [Период: Этот месяц ▼] [⚙ Edit]  │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────┐ │
│ │ Открытые задачи │ │ Просроченные    │ │ Бюджет          │ │ Прогресс    │ │
│ │                 │ │                 │ │                 │ │             │ │
│ │       15        │ │       3         │ │   8.5M / 21M    │ │    65%      │ │
│ │     ↑3 за нед.  │ │    🔴 Critical  │ │ ═══════░░░░░░░  │ │ ████████░░  │ │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────┘ │
│                                                                             │
│ ┌─────────────────────────────────┐ ┌─────────────────────────────────────┐ │
│ │ Задачи по статусам              │ │ Динамика задач                      │ │
│ │                                 │ │                                     │ │
│ │          ╭─────╮                │ │     15 │    ╱─╮                     │ │
│ │         ╱ ■ 15  ╲               │ │     10 │ ──╱  ╰──╮                  │ │
│ │        ╱─────────╲              │ │      5 │ ╱       ╰──               │ │
│ │       ╲  ■ 8 ■ 12╱              │ │      0 └──────────────              │ │
│ │        ╲       ╱                │ │          Пн Вт Ср Чт Пт             │ │
│ │         ╲─────╱                 │ │                                     │ │
│ │  ■ Открыта ■ В работе ■ Решена │ │  ── Создано  ─ ─ Закрыто           │ │
│ └─────────────────────────────────┘ └─────────────────────────────────────┘ │
│                                                                             │
│ ┌───────────────────────────────────────────────────────────────────────┐   │
│ │ Последние задачи                                          [Все →]    │   │
│ │ ─────────────────────────────────────────────────────────────────── │   │
│ │ TKT-045 │ Дефект освещения коридора  │ 🔴 Высокий │ Иванов И. │ 15.02│   │
│ │ TKT-044 │ Замечание по проводке      │ 🟡 Средний │ Петров П. │ 14.02│   │
│ │ TKT-043 │ Установка розеток          │ 🟢 Низкий  │ Сидоров С.│ 13.02│   │
│ └───────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.12.7 Бизнес-логика

#### Процесс генерации PDF-отчёта

```
┌─────────────────┐
│  Запрос на      │
│  генерацию      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Проверка       │──── Нет прав ──→ 403 Forbidden
│  прав доступа   │
└────────┬────────┘
         │ OK
         ▼
┌─────────────────┐
│  Проверка       │──── Не найден ──→ 404 Not Found
│  шаблона        │
└────────┬────────┘
         │ OK
         ▼
┌─────────────────┐
│  Валидация      │──── Ошибка ──→ 400 Bad Request
│  параметров     │
└────────┬────────┘
         │ OK
         ▼
┌─────────────────┐
│  Проверка       │──── Есть ──→ Вернуть из кэша
│  кэша           │
└────────┬────────┘
         │ Нет
         ▼
┌─────────────────┐
│  Получение      │
│  данных из БД   │
│  (проект, задачи│
│  смета, и т.д.) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Замена         │
│  простых        │
│  токенов        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Обработка      │
│  блочных        │
│  токенов        │
│  (таблицы,      │
│  графики)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Сборка         │
│  финального     │
│  HTML           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Puppeteer:     │
│  рендер PDF     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Сохранение     │
│  в S3           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Запись в БД    │
│  generated_     │
│  reports        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Возврат URL    │
└─────────────────┘
```

### 4.12.8 Уведомления

| Событие | Получатели | Тип | Шаблон |
|---------|-----------|-----|--------|
| Отчёт сгенерирован | Автор | in-app | "Отчёт '{name}' готов" |
| Запланированный отчёт | recipients | email | Письмо с вложением |
| Ошибка генерации | Автор, Админ | in-app, email | "Ошибка генерации: {error}" |

### 4.12.9 Тестирование

**Сценарии тестирования:**

| # | Сценарий | Шаги | Ожидаемый результат |
|---|----------|------|---------------------|
| 1 | Создание шаблона | Заполнить форму, добавить токены, сохранить | Шаблон создан, отображается в списке |
| 2 | Генерация PDF | Выбрать шаблон, указать параметры, генерировать | PDF создан, доступен для скачивания |
| 3 | Токены проекта | Шаблон с {{p.name}}, {{p.address}} | Значения подставлены корректно |
| 4 | Таблица задач | {{#tickets_table}} с фильтрами | Таблица содержит правильные задачи |
| 5 | Диаграмма | {{#chart type="pie"}} | SVG диаграмма в PDF |
| 6 | Условный блок | {{#if status="closed"}} | Блок отображается/скрывается правильно |
| 7 | Кэширование | Повторная генерация с теми же параметрами | Возврат из кэша < 100ms |
| 8 | Запланированный отчёт | Создать schedule на 8:00 | Отчёт отправлен в указанное время |

### 4.12.10 Критерии приёмки

- [ ] WYSIWYG-редактор шаблонов (TipTap или Slate)
- [ ] Полная система токенов (проект, задачи, смета, пользователь)
- [ ] Блочные токены (таблицы, графики, изображения)
- [ ] Условная видимость блоков ({{#if}}, {{#unless}})
- [ ] Циклы ({{#each}})
- [ ] Настройки страницы (ориентация, размер, поля)
- [ ] Колонтитулы (header/footer)
- [ ] Нумерация страниц
- [ ] Генерация PDF (Puppeteer)
- [ ] Экспорт в XLSX
- [ ] Библиотека системных шаблонов
- [ ] Пользовательские шаблоны
- [ ] Предпросмотр шаблона
- [ ] Кэширование отчётов
- [ ] Запланированные отчёты (cron)
- [ ] Интерактивные дашборды
- [ ] Конфигурируемые виджеты
- [ ] Drag&drop layout дашбордов

---

## МОДУЛЬ 13: Согласования (ПОЛНАЯ ДЕТАЛИЗАЦИЯ)

### 4.13.1 Описание и цели модуля

**Назначение:** Управление процессами согласования документов, смет, актов и запросов на изменения с многоэтапными маршрутами и автоматизацией.

**Бизнес-цели:**
- Формализация процессов согласования
- Многоэтапные маршруты с участниками
- Параллельное и последовательное согласование
- Уведомления, напоминания, эскалация
- Полная история согласований
- Интеграция с документами и сметами

**Связь с другими модулями:**
- **Зависит от:** Модуль 1 (Ядро), Модуль 2 (Проекты)
- **Используется:** Модуль 3 (Сметы), Модуль 10 (Финансы), Модуль 8 (DMS)

### 4.13.2 Роли и права доступа

| Действие | Владелец | Админ | Рук. проектов | Сметчик | Бухгалтер | Прораб | Наблюд. |
|----------|:--------:|:-----:|:-------------:|:-------:|:---------:|:------:|:-------:|
| Просмотр согласований | ✅ | ✅ | ✅ | Свои | Свои | Свои | ✅ |
| Инициировать согласование | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Согласовать/отклонить | ✅ | ✅ | Назначен | Назначен | Назначен | Назначен | ❌ |
| Делегировать | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Отменить согласование | ✅ | ✅ | Свои | Свои | Свои | ❌ | ❌ |
| Создавать шаблоны workflow | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Настройка эскалации | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### 4.13.3 База данных

```sql
-- Таблица: approval_workflow_templates (Шаблоны маршрутов согласования)
CREATE TABLE approval_workflow_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    -- Тип объектов для согласования
    entity_types TEXT[] DEFAULT ARRAY['estimate', 'act', 'document', 'change_request'],
    -- Настройки
    allow_modification BOOLEAN DEFAULT FALSE, -- можно ли редактировать объект в процессе
    allow_parallel BOOLEAN DEFAULT TRUE, -- параллельное согласование на шаге
    auto_approve_on_timeout BOOLEAN DEFAULT FALSE, -- авто-согласование по таймауту
    timeout_days INTEGER, -- дней на согласование (для авто-согласования)
    require_comment_on_reject BOOLEAN DEFAULT TRUE, -- обязательный комментарий при отклонении
    -- Шаги маршрута
    steps JSONB NOT NULL,
    -- [
    --   {
    --     "step": 1,
    --     "name": "Проверка сметчиком",
    --     "approvers": [{"user_id": "...", "role_id": null}],
    --     "require_all": false, // достаточно одного
    --     "can_delegate": true,
    --     "timeout_days": 3,
    --     "auto_approve": false,
    --     "notify_on_entry": true
    --   },
    --   {
    --     "step": 2,
    --     "name": "Согласование руководителем",
    --     "approvers": [{"user_id": null, "role_id": 4}], // все с ролью
    --     "require_all": false,
    --     "can_delegate": true
    --   }
    -- ]
    -- Эскалация
    escalation_config JSONB,
    -- {
    --   "enabled": true,
    --   "after_days": 5,
    --   "escalate_to": [{"user_id": "...", "role_id": null}],
    --   "notify": true
    -- }
    -- Уведомления
    notification_settings JSONB DEFAULT '{"on_start": true, "on_step_change": true, "on_complete": true, "reminder_days": [1, 3]}',
    -- Метаданные
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE, -- по умолчанию для entity_type
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы
CREATE INDEX idx_approval_templates_company ON approval_workflow_templates(company_id);
CREATE INDEX idx_approval_templates_active ON approval_workflow_templates(is_active) WHERE is_active = TRUE;

-- Таблица: approval_requests (Запросы на согласование)
CREATE TABLE approval_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    workflow_template_id UUID NOT NULL REFERENCES approval_workflow_templates(id),
    -- Объект согласования
    entity_type VARCHAR(50) NOT NULL, -- estimate, act, document, change_request
    entity_id UUID NOT NULL,
    entity_snapshot JSONB, -- снимок данных объекта на момент отправки
    -- Информация
    subject VARCHAR(500) NOT NULL,
    message TEXT,
    urgency VARCHAR(20) DEFAULT 'normal', -- low, normal, high, critical
    -- Состояние маршрута
    current_step INTEGER DEFAULT 1,
    total_steps INTEGER NOT NULL,
    -- Статус
    status VARCHAR(20) DEFAULT 'pending', 
    -- pending, in_progress, approved, rejected, cancelled, expired
    -- Даты
    due_date TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    -- Результат
    final_comment TEXT,
    -- Аудит
    initiated_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы
CREATE INDEX idx_approval_requests_company ON approval_requests(company_id);
CREATE INDEX idx_approval_requests_project ON approval_requests(project_id);
CREATE INDEX idx_approval_requests_entity ON approval_requests(entity_type, entity_id);
CREATE INDEX idx_approval_requests_status ON approval_requests(status);
CREATE INDEX idx_approval_requests_initiator ON approval_requests(initiated_by_id);

-- Таблица: approval_step_states (Состояние шагов согласования)
CREATE TABLE approval_step_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
    step INTEGER NOT NULL,
    step_name VARCHAR(255),
    -- Состояние
    status VARCHAR(20) DEFAULT 'pending', -- pending, in_progress, approved, rejected, skipped
    -- Ожидаемые согласующие
    expected_approvers JSONB NOT NULL, -- [{user_id, role_id, name}]
    require_all BOOLEAN DEFAULT FALSE,
    -- Времена
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    due_at TIMESTAMP WITH TIME ZONE,
    -- Метаданные
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(request_id, step)
);

-- Индексы
CREATE INDEX idx_step_states_request ON approval_step_states(request_id);
CREATE INDEX idx_step_states_status ON approval_step_states(status);

-- Таблица: approval_actions (Действия по согласованию)
CREATE TABLE approval_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
    step_state_id UUID NOT NULL REFERENCES approval_step_states(id) ON DELETE CASCADE,
    step INTEGER NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    -- Действие
    action VARCHAR(20) NOT NULL, -- approved, rejected, returned, delegated, commented
    comment TEXT,
    -- Делегирование
    delegated_to_id UUID REFERENCES users(id),
    delegation_reason TEXT,
    -- Подпись (опционально)
    signature_data JSONB, -- {type: 'electronic', hash: '...', timestamp: '...'}
    -- Метаданные
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы
CREATE INDEX idx_approval_actions_request ON approval_actions(request_id);
CREATE INDEX idx_approval_actions_user ON approval_actions(user_id);
CREATE INDEX idx_approval_actions_step ON approval_actions(step);
CREATE INDEX idx_approval_actions_date ON approval_actions(created_at DESC);

-- Таблица: approval_reminders (Напоминания)
CREATE TABLE approval_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
    step_state_id UUID NOT NULL REFERENCES approval_step_states(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    -- Расписание
    remind_at TIMESTAMP WITH TIME ZONE NOT NULL,
    -- Состояние
    is_sent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP WITH TIME ZONE,
    -- Тип
    reminder_type VARCHAR(20) DEFAULT 'regular', -- regular, escalation, final
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы
CREATE INDEX idx_reminders_pending ON approval_reminders(remind_at, is_sent) WHERE is_sent = FALSE;
```

### 4.13.4 Backend API

#### GET /api/v1/approval-workflows/templates

**Описание:** Список шаблонов маршрутов согласования

**Ответ:**
```json
{
    "success": true,
    "data": [
        {
            "id": "workflow-001",
            "name": "Согласование сметы",
            "description": "Двухэтапное согласование смет проекта",
            "entity_types": ["estimate"],
            "steps_count": 2,
            "is_default": true,
            "is_active": true
        }
    ]
}
```

#### POST /api/v1/approval-workflows/templates

**Описание:** Создание шаблона маршрута

**Тело запроса:**
```json
{
    "name": "Согласование актов",
    "description": "Три этапа: сметчик → руководитель → бухгалтер",
    "entity_types": ["act"],
    "allow_modification": false,
    "require_comment_on_reject": true,
    "steps": [
        {
            "step": 1,
            "name": "Проверка сметчиком",
            "approvers": [{"role_id": 5}],
            "require_all": false,
            "can_delegate": true,
            "timeout_days": 2
        },
        {
            "step": 2,
            "name": "Согласование руководителем проекта",
            "approvers": [{"role_id": 4}],
            "require_all": false,
            "can_delegate": true,
            "timeout_days": 3
        },
        {
            "step": 3,
            "name": "Проверка бухгалтером",
            "approvers": [{"role_id": 9}],
            "require_all": false,
            "can_delegate": false,
            "timeout_days": 2
        }
    ],
    "escalation_config": {
        "enabled": true,
        "after_days": 5,
        "escalate_to": [{"role_id": 3}],
        "notify": true
    },
    "notification_settings": {
        "on_start": true,
        "on_step_change": true,
        "on_complete": true,
        "reminder_days": [1, 3]
    }
}
```

#### POST /api/v1/approvals

**Описание:** Инициирование согласования

**Тело запроса:**
```json
{
    "workflow_template_id": "workflow-001",
    "project_id": "project-001",
    "entity_type": "act",
    "entity_id": "act-001",
    "subject": "Согласование акта АВР-001 за февраль 2024",
    "message": "Прошу согласовать акт выполненных работ за февраль.",
    "urgency": "normal",
    "due_date": "2024-03-01T18:00:00Z"
}
```

**Логика обработки:**
1. Получить шаблон workflow
2. Проверить права пользователя
3. Создать snapshot объекта (entity_snapshot)
4. Создать approval_request
5. Создать approval_step_states для всех шагов
6. Определить согласующих для первого шага (по ролям/пользователям)
7. Создать напоминания
8. Отправить уведомления согласующим первого шага
9. Установить статус = 'in_progress', started_at = NOW()

**Ответ:**
```json
{
    "success": true,
    "data": {
        "id": "approval-001",
        "subject": "Согласование акта АВР-001 за февраль 2024",
        "status": "in_progress",
        "current_step": 1,
        "total_steps": 3,
        "pending_approvers": [
            {"id": "user-001", "name": "Иванов И.И.", "role": "Сметчик"}
        ],
        "started_at": "2024-02-10T12:00:00Z",
        "due_date": "2024-03-01T18:00:00Z"
    }
}
```

#### GET /api/v1/approvals/{id}

**Описание:** Детали согласования

**Ответ:**
```json
{
    "success": true,
    "data": {
        "id": "approval-001",
        "subject": "Согласование акта АВР-001 за февраль 2024",
        "message": "Прошу согласовать акт выполненных работ за февраль.",
        "status": "in_progress",
        "urgency": "normal",
        "current_step": 2,
        "total_steps": 3,
        "entity": {
            "type": "act",
            "id": "act-001",
            "name": "Акт АВР-001",
            "url": "/projects/project-001/finance/acts/act-001"
        },
        "initiated_by": {
            "id": "user-002",
            "name": "Петров П.П."
        },
        "started_at": "2024-02-10T12:00:00Z",
        "due_date": "2024-03-01T18:00:00Z",
        "steps": [
            {
                "step": 1,
                "name": "Проверка сметчиком",
                "status": "approved",
                "approvers": [
                    {
                        "user_id": "user-001",
                        "name": "Иванов И.И.",
                        "action": "approved",
                        "comment": "Проверено, замечаний нет",
                        "action_at": "2024-02-11T10:30:00Z"
                    }
                ],
                "completed_at": "2024-02-11T10:30:00Z"
            },
            {
                "step": 2,
                "name": "Согласование руководителем",
                "status": "in_progress",
                "approvers": [
                    {
                        "user_id": "user-003",
                        "name": "Сидоров С.С.",
                        "action": null,
                        "expected": true
                    }
                ],
                "started_at": "2024-02-11T10:30:00Z",
                "due_at": "2024-02-14T18:00:00Z"
            },
            {
                "step": 3,
                "name": "Проверка бухгалтером",
                "status": "pending",
                "approvers": []
            }
        ],
        "history": [
            {
                "action": "created",
                "user": "Петров П.П.",
                "timestamp": "2024-02-10T12:00:00Z"
            },
            {
                "action": "approved",
                "user": "Иванов И.И.",
                "step": 1,
                "comment": "Проверено, замечаний нет",
                "timestamp": "2024-02-11T10:30:00Z"
            }
        ]
    }
}
```

#### POST /api/v1/approvals/{id}/approve

**Описание:** Согласование на текущем шаге

**Тело запроса:**
```json
{
    "comment": "Согласовано. Акт корректен.",
    "signature": {
        "type": "electronic",
        "data": "base64_signature_data"
    }
}
```

**Логика обработки:**
1. Проверить, что пользователь — ожидаемый согласующий на текущем шаге
2. Создать approval_action с action='approved'
3. Проверить require_all:
   - Если false → шаг завершён
   - Если true → проверить, все ли согласовали
4. Если шаг завершён:
   - Установить step_state.status = 'approved'
   - Если есть следующий шаг:
     - Инициализировать следующий шаг
     - Уведомить согласующих
   - Если шагов нет:
     - Установить request.status = 'approved'
     - Уведомить инициатора
     - Выполнить callback (если есть)

**Ответ:**
```json
{
    "success": true,
    "data": {
        "message": "Согласовано успешно",
        "approval_status": "in_progress",
        "next_step": {
            "step": 3,
            "name": "Проверка бухгалтером",
            "approvers": [{"name": "Кузнецова К.К."}]
        }
    }
}
```

#### POST /api/v1/approvals/{id}/reject

**Описание:** Отклонение согласования

**Тело запроса:**
```json
{
    "comment": "Отклонено. Обнаружены расхождения в объёмах работ. Необходима корректировка.",
    "return_to_step": null
}
```

**Логика обработки:**
1. Проверить права
2. Если require_comment_on_reject и comment пустой → ошибка
3. Создать approval_action с action='rejected'
4. Установить request.status = 'rejected'
5. Уведомить инициатора
6. Если allow_modification → разблокировать объект для редактирования

#### POST /api/v1/approvals/{id}/delegate

**Описание:** Делегирование согласования

**Тело запроса:**
```json
{
    "delegate_to_id": "user-005",
    "reason": "Нахожусь в отпуске до 20.02"
}
```

**Логика обработки:**
1. Проверить can_delegate на текущем шаге
2. Создать approval_action с action='delegated'
3. Добавить delegate_to в expected_approvers
4. Уведомить нового согласующего

### 4.13.5 Frontend - Интерфейс пользователя

#### Страница: Список согласований

**URL:** `/approvals` или `/projects/{id}/approvals`

**Wireframe:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Согласования                                    [+ Создать] [Мои: 3 ожидают]│
├─────────────────────────────────────────────────────────────────────────────┤
│ [Все] [Ожидают меня 🔴3] [Мои запросы] [Завершённые]                       │
│                                                                             │
│ 🔍 Поиск...          [Статус ▼] [Тип ▼] [Проект ▼] [Срочность ▼]          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐│
│ │ 🟡 Согласование акта АВР-001 за февраль 2024                           ││
│ │ Проект: ЖК Новые горизонты                                             ││
│ │ Шаг 2 из 3: Согласование руководителем                                 ││
│ │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░░░░░░                           ││
│ │ От: Петров П.П. | Срок: 01.03.2024 | ⏰ Осталось 5 дней                ││
│ │                                                          [Открыть →]   ││
│ └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐│
│ │ 🔴 СРОЧНО: Согласование изменений в смете                              ││
│ │ Проект: Офисный центр                                                  ││
│ │ Шаг 1 из 2: Проверка сметчиком                    ⚠️ Ожидает вас      ││
│ │ ━━━━━━━━░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                   ││
│ │ От: Иванов И.И. | Срок: 15.02.2024 | ⏰ Просрочено на 2 дня           ││
│ │                                    [Согласовать] [Отклонить] [Открыть]││
│ └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Модальное окно: Согласование

```
┌─────────────────────────────────────────────────────────────────┐
│ Согласование: Акт АВР-001                                  [✕]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Объект: Акт выполненных работ АВР-001                          │
│ Сумма: 1 020 000.00 ₽                                          │
│ Период: 01.02.2024 - 28.02.2024                                │
│                                                                 │
│ [Просмотреть документ →]                                       │
│                                                                 │
│ ───────────────────────────────────────────────────────────    │
│                                                                 │
│ Ваше решение:                                                   │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Комментарий:                                                │ │
│ │ [Согласовано. Акт проверен, расхождений не выявлено.      ]│ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ☐ Подписать электронной подписью                               │
│                                                                 │
│                [Отклонить]  [Делегировать]  [✅ Согласовать]   │
└─────────────────────────────────────────────────────────────────┘
```

### 4.13.6 Уведомления

| Событие | Получатели | Тип | Шаблон |
|---------|-----------|-----|--------|
| Новый запрос на согласование | Согласующие шага 1 | email, push, in-app | "Требуется согласование: {subject}" |
| Переход на следующий шаг | Согласующие нового шага | email, push, in-app | "Ожидается ваше согласование: {subject}" |
| Согласовано полностью | Инициатор | email, in-app | "Ваш запрос согласован: {subject}" |
| Отклонено | Инициатор | email, push, in-app | "Ваш запрос отклонён: {subject}" |
| Напоминание | Ожидающие согласующие | email, push | "Напоминание: требуется согласование" |
| Эскалация | Эскалирующие | email, push, in-app | "Эскалация: просрочено согласование" |
| Делегировано | Новый согласующий | email, push, in-app | "Вам делегировано согласование" |

### 4.13.7 Критерии приёмки

- [ ] CRUD шаблонов workflow
- [ ] Многоэтапные маршруты согласования
- [ ] Параллельное согласование на шаге (require_all)
- [ ] Последовательное согласование шагов
- [ ] Инициирование согласования
- [ ] Согласование / Отклонение / Возврат
- [ ] Делегирование
- [ ] Электронная подпись (опционально)
- [ ] Снимок объекта (entity_snapshot)
- [ ] Уведомления участникам (email, push, in-app)
- [ ] Напоминания по расписанию
- [ ] Эскалация при просрочке
- [ ] История согласований с комментариями
- [ ] Интеграция со сметами, актами, документами
- [ ] Виджет "Мои согласования" на дашборде

---

## МОДУЛЬ 14: Настройки и интеграции (ПОЛНАЯ ДЕТАЛИЗАЦИЯ)

### 4.14.1 Описание и цели модуля

**Назначение:** Управление настройками пользователя, компании и внешними интеграциями.

**Бизнес-цели:**
- Персонализация интерфейса
- Настройка безопасности (2FA)
- Брендирование компании
- Интеграция с внешними сервисами
- Управление вебхуками

### 4.14.2 База данных

```sql
-- Таблица: user_settings (Настройки пользователя - расширенная)
-- Основные поля в таблице users
-- Дополнительная таблица для детальных настроек
CREATE TABLE user_notification_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    -- Email уведомления
    email_task_assigned BOOLEAN DEFAULT TRUE,
    email_task_mentioned BOOLEAN DEFAULT TRUE,
    email_task_status_changed BOOLEAN DEFAULT TRUE,
    email_comment_added BOOLEAN DEFAULT TRUE,
    email_approval_required BOOLEAN DEFAULT TRUE,
    email_approval_completed BOOLEAN DEFAULT TRUE,
    email_weekly_digest BOOLEAN DEFAULT TRUE,
    email_digest_day INTEGER DEFAULT 1, -- 1=понедельник
    -- Push уведомления
    push_enabled BOOLEAN DEFAULT TRUE,
    push_task_assigned BOOLEAN DEFAULT TRUE,
    push_task_mentioned BOOLEAN DEFAULT TRUE,
    push_approval_required BOOLEAN DEFAULT TRUE,
    push_due_date_reminder BOOLEAN DEFAULT TRUE,
    push_reminder_hours INTEGER DEFAULT 24, -- за сколько часов
    -- In-app уведомления
    in_app_sound BOOLEAN DEFAULT TRUE,
    in_app_desktop BOOLEAN DEFAULT TRUE,
    -- Тихие часы
    quiet_hours_enabled BOOLEAN DEFAULT FALSE,
    quiet_hours_start TIME DEFAULT '22:00',
    quiet_hours_end TIME DEFAULT '08:00',
    -- Метаданные
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица: company_settings (Настройки компании - расширенная)
CREATE TABLE company_settings (
    company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
    -- Брендирование
    primary_color VARCHAR(7) DEFAULT '#2563EB',
    secondary_color VARCHAR(7) DEFAULT '#64748B',
    logo_light_url VARCHAR(500), -- логотип для светлой темы
    logo_dark_url VARCHAR(500), -- логотип для тёмной темы
    favicon_url VARCHAR(500),
    -- Документы
    document_header_template TEXT, -- HTML шаблон шапки документов
    document_footer_template TEXT, -- HTML шаблон подвала
    default_document_language VARCHAR(10) DEFAULT 'ru',
    -- Нумерация
    project_number_format VARCHAR(100) DEFAULT 'P-{YYYY}-{NNNN}',
    estimate_number_format VARCHAR(100) DEFAULT 'SM-{PROJECT}-{NNN}',
    act_number_format VARCHAR(100) DEFAULT 'АВР-{NNNN}',
    offer_number_format VARCHAR(100) DEFAULT 'КП-{NNNN}',
    ticket_number_format VARCHAR(100) DEFAULT '{PROJECT}-{NNNN}',
    -- Автонумерация
    next_project_number INTEGER DEFAULT 1,
    next_act_number INTEGER DEFAULT 1,
    next_offer_number INTEGER DEFAULT 1,
    -- Рабочие дни
    working_days_mask INTEGER DEFAULT 31, -- пн-пт
    work_start_time TIME DEFAULT '09:00',
    work_end_time TIME DEFAULT '18:00',
    -- Праздники
    holidays JSONB DEFAULT '[]', -- [{date, name, is_working}]
    use_country_holidays BOOLEAN DEFAULT TRUE,
    -- Финансы
    default_nds_rate DECIMAL(5, 2) DEFAULT 20.00,
    default_markup_rate DECIMAL(5, 2) DEFAULT 0,
    -- Безопасность
    password_min_length INTEGER DEFAULT 8,
    password_require_uppercase BOOLEAN DEFAULT TRUE,
    password_require_lowercase BOOLEAN DEFAULT TRUE,
    password_require_digit BOOLEAN DEFAULT TRUE,
    password_require_special BOOLEAN DEFAULT FALSE,
    session_timeout_minutes INTEGER DEFAULT 480, -- 8 часов
    require_2fa_for_admins BOOLEAN DEFAULT FALSE,
    allowed_ip_ranges JSONB DEFAULT '[]', -- ['192.168.1.0/24']
    -- Метаданные
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица: integrations (Внешние интеграции)
CREATE TABLE integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    -- Тип интеграции
    integration_type VARCHAR(50) NOT NULL, 
    -- email_smtp, email_sendgrid, sms_gateway, dadata, calendar_google, 
    -- calendar_outlook, storage_dropbox, storage_gdrive, accounting_1c
    -- Название
    name VARCHAR(255) NOT NULL,
    description TEXT,
    -- Конфигурация (зашифрованная)
    config_encrypted TEXT NOT NULL, -- JSON зашифрованный
    -- Состояние
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    last_verified_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    -- Метаданные
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы
CREATE INDEX idx_integrations_company ON integrations(company_id);
CREATE INDEX idx_integrations_type ON integrations(integration_type);

-- Таблица: webhooks (Вебхуки)
CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    -- Конфигурация
    name VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL,
    secret VARCHAR(255), -- для подписи запросов
    -- События
    events TEXT[] NOT NULL, 
    -- ['ticket.created', 'ticket.updated', 'estimate.updated', 'act.created', ...]
    -- Фильтры
    filters JSONB DEFAULT '{}', -- {project_id: '...', ticket_type_id: '...'}
    -- Настройки
    is_active BOOLEAN DEFAULT TRUE,
    retry_count INTEGER DEFAULT 3,
    timeout_seconds INTEGER DEFAULT 30,
    -- Статистика
    total_calls INTEGER DEFAULT 0,
    successful_calls INTEGER DEFAULT 0,
    last_called_at TIMESTAMP WITH TIME ZONE,
    last_response_code INTEGER,
    last_error TEXT,
    -- Аудит
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы
CREATE INDEX idx_webhooks_company ON webhooks(company_id);
CREATE INDEX idx_webhooks_active ON webhooks(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_webhooks_events ON webhooks USING GIN(events);

-- Таблица: webhook_logs (Логи вебхуков)
CREATE TABLE webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    -- Запрос
    event VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    -- Ответ
    response_code INTEGER,
    response_body TEXT,
    response_time_ms INTEGER,
    -- Статус
    status VARCHAR(20) DEFAULT 'pending', -- pending, success, failed, retrying
    retry_attempt INTEGER DEFAULT 0,
    -- Метаданные
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Индексы (с партиционированием по времени для больших объёмов)
CREATE INDEX idx_webhook_logs_webhook ON webhook_logs(webhook_id);
CREATE INDEX idx_webhook_logs_status ON webhook_logs(status);
CREATE INDEX idx_webhook_logs_created ON webhook_logs(created_at DESC);

-- Автоочистка старых логов (хранить 30 дней)
-- Рекомендуется pg_cron или внешний cron job
```

### 4.14.3 Backend API

#### GET /api/v1/settings/profile

**Описание:** Настройки профиля пользователя

**Ответ:**
```json
{
    "success": true,
    "data": {
        "id": "user-001",
        "email": "user@example.com",
        "first_name": "Иван",
        "last_name": "Петров",
        "middle_name": "Сергеевич",
        "phone": "+7 (999) 123-45-67",
        "avatar_url": "/avatars/user-001.jpg",
        "language": "ru",
        "timezone": "Europe/Moscow",
        "two_factor_enabled": false,
        "is_email_verified": true,
        "notifications": {
            "email_task_assigned": true,
            "email_weekly_digest": true,
            "push_enabled": true,
            "quiet_hours_enabled": false
        }
    }
}
```

#### PUT /api/v1/settings/profile

**Описание:** Обновление профиля

**Тело запроса:**
```json
{
    "first_name": "Иван",
    "last_name": "Петров",
    "phone": "+7 (999) 123-45-67",
    "language": "ru",
    "timezone": "Europe/Moscow"
}
```

#### POST /api/v1/settings/2fa/enable

**Описание:** Включение 2FA

**Ответ (шаг 1 - получение QR):**
```json
{
    "success": true,
    "data": {
        "secret": "JBSWY3DPEHPK3PXP",
        "qr_code_url": "data:image/png;base64,..."
    }
}
```

**Тело запроса (шаг 2 - подтверждение):**
```json
{
    "code": "123456",
    "secret": "JBSWY3DPEHPK3PXP"
}
```

#### GET /api/v1/settings/company

**Описание:** Настройки компании

**Ответ:**
```json
{
    "success": true,
    "data": {
        "id": "company-001",
        "name": "ООО Электромонтаж",
        "inn": "7707083893",
        "kpp": "770701001",
        "ogrn": "1027700132195",
        "legal_address": "г. Москва, ул. Строителей, 15",
        "actual_address": "г. Москва, ул. Строителей, 15",
        "phone": "+7 (495) 123-45-67",
        "email": "info@company.com",
        "website": "https://company.com",
        "logo_url": "/logos/company-001.png",
        "settings": {
            "primary_color": "#2563EB",
            "working_days_mask": 31,
            "default_nds_rate": 20.00,
            "project_number_format": "P-{YYYY}-{NNNN}"
        }
    }
}
```

#### POST /api/v1/settings/company/logo

**Описание:** Загрузка логотипа компании

**Заголовки:**
```
Content-Type: multipart/form-data
```

**Параметры формы:**
- logo: File (PNG, JPG, SVG, max 2MB)

#### GET /api/v1/integrations

**Описание:** Список интеграций компании

**Ответ:**
```json
{
    "success": true,
    "data": [
        {
            "id": "int-001",
            "integration_type": "email_smtp",
            "name": "Корпоративная почта",
            "is_active": true,
            "is_verified": true,
            "last_verified_at": "2024-02-01T10:00:00Z"
        },
        {
            "id": "int-002",
            "integration_type": "dadata",
            "name": "DaData API",
            "is_active": true,
            "is_verified": true
        }
    ]
}
```

#### POST /api/v1/integrations

**Описание:** Добавление интеграции

**Тело запроса (SMTP):**
```json
{
    "integration_type": "email_smtp",
    "name": "Корпоративная почта",
    "config": {
        "host": "smtp.company.com",
        "port": 587,
        "username": "noreply@company.com",
        "password": "secret",
        "encryption": "tls",
        "from_name": "ElektroSmeta",
        "from_email": "noreply@company.com"
    }
}
```

**Тело запроса (DaData):**
```json
{
    "integration_type": "dadata",
    "name": "DaData API",
    "config": {
        "api_key": "your_api_key",
        "secret_key": "your_secret_key"
    }
}
```

#### POST /api/v1/integrations/{id}/verify

**Описание:** Проверка интеграции

**Логика:**
- SMTP: отправка тестового письма
- DaData: тестовый запрос поиска по ИНН

#### POST /api/v1/webhooks

**Описание:** Создание вебхука

**Тело запроса:**
```json
{
    "name": "Уведомление в Telegram",
    "url": "https://api.telegram.org/bot.../sendMessage",
    "secret": "webhook_secret_123",
    "events": ["ticket.created", "ticket.status_changed"],
    "filters": {
        "project_id": "project-001",
        "priority_id": [3, 4]
    }
}
```

### 4.14.4 Frontend - Интерфейс

#### Страница: Настройки профиля

**URL:** `/settings/profile`

**Секции:**
1. Личные данные (ФИО, телефон, аватар)
2. Безопасность (пароль, 2FA, сессии)
3. Уведомления (email, push, тихие часы)
4. Интерфейс (язык, часовой пояс, тема)

#### Страница: Настройки компании

**URL:** `/settings/company`

**Секции:**
1. Реквизиты (название, ИНН, адреса)
2. Брендирование (логотип, цвета)
3. Документы (шаблоны шапки/подвала, нумерация)
4. Рабочее время (дни, часы, праздники)
5. Безопасность (политика паролей, IP-ограничения)

#### Страница: Интеграции

**URL:** `/settings/integrations`

**Wireframe:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Интеграции                                                   [+ Добавить]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐│
│ │ 📧 Email (SMTP)                                                         ││
│ │ Корпоративная почта                                                     ││
│ │ ✅ Подключено | Проверено: 01.02.2024                [Настроить] [🗑]   ││
│ └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐│
│ │ 🏢 DaData                                                               ││
│ │ Автозаполнение реквизитов по ИНН                                        ││
│ │ ✅ Подключено                                        [Настроить] [🗑]   ││
│ └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐│
│ │ 📅 Google Calendar                                                      ││
│ │ Синхронизация задач с календарём                                        ││
│ │ ⚪ Не подключено                                         [Подключить]   ││
│ └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐│
│ │ 🔗 Вебхуки                                                    [3 шт.]  ││
│ │ Отправка событий на внешние URL                              [Настроить]││
│ └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.14.5 Критерии приёмки

- [ ] Редактирование профиля пользователя
- [ ] Загрузка аватара
- [ ] Смена пароля с валидацией
- [ ] Двухфакторная аутентификация (TOTP)
- [ ] Управление активными сессиями
- [ ] Настройки уведомлений (email, push)
- [ ] Тихие часы
- [ ] Редактирование реквизитов компании
- [ ] Загрузка логотипа
- [ ] Брендирование (цвета)
- [ ] Настройка форматов нумерации
- [ ] Настройка рабочих дней и праздников
- [ ] Политика паролей
- [ ] IP-ограничения
- [ ] Интеграция SMTP
- [ ] Интеграция DaData
- [ ] Вебхуки с событиями
- [ ] Логирование вебхуков

---

## МОДУЛЬ 15: Биллинг (ПОЛНАЯ ДЕТАЛИЗАЦИЯ)

### 4.15.1 Описание и цели модуля

**Назначение:** Управление подписками, тарифными планами и оплатой в SaaS-модели.

**Бизнес-цели:**
- Монетизация платформы
- Гибкая система тарифов
- Интеграция с платёжными системами
- Учёт лимитов по тарифу
- Автопродление подписок
- Выставление счетов и актов

### 4.15.2 База данных

```sql
-- Таблица: billing_plans (Тарифные планы)
CREATE TABLE billing_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    -- Лимиты
    max_users INTEGER, -- NULL = безлимит
    max_projects INTEGER,
    max_storage_gb INTEGER,
    max_documents_per_month INTEGER,
    max_reports_per_month INTEGER,
    -- Доступные модули
    modules JSONB DEFAULT '[]', 
    -- ['estimates', 'offers', 'tasks', 'gantt', 'dms', 'finance', 'reports', 'approvals', '*']
    -- Дополнительные возможности
    features JSONB DEFAULT '{}',
    -- {api_access: true, white_label: false, priority_support: false, sla_hours: 48}
    -- Цены
    price_monthly DECIMAL(10, 2),
    price_yearly DECIMAL(10, 2), -- годовая со скидкой
    currency VARCHAR(3) DEFAULT 'RUB',
    -- Триальный период
    trial_days INTEGER DEFAULT 0,
    -- Метаданные
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE, -- выделенный план
    is_enterprise BOOLEAN DEFAULT FALSE, -- по запросу
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Предустановленные планы
INSERT INTO billing_plans (name, code, max_users, max_projects, max_storage_gb, price_monthly, price_yearly, modules, features, trial_days, sort_order) VALUES
('Бесплатный', 'free', 2, 3, 1, 0, 0, 
 '["estimates"]', 
 '{"api_access": false}', 
 0, 1),
('Стартап', 'startup', 5, 10, 5, 2990, 29900, 
 '["estimates", "offers", "tasks"]', 
 '{"api_access": true, "sla_hours": 48}', 
 14, 2),
('Бизнес', 'business', 20, 50, 25, 9990, 99900, 
 '["estimates", "offers", "tasks", "gantt", "dms", "finance"]', 
 '{"api_access": true, "sla_hours": 24}', 
 14, 3),
('Профессионал', 'professional', 50, NULL, 100, 24990, 249900, 
 '["estimates", "offers", "tasks", "gantt", "dms", "finance", "reports", "approvals"]', 
 '{"api_access": true, "white_label": true, "sla_hours": 8}', 
 14, 4),
('Корпоративный', 'enterprise', NULL, NULL, NULL, NULL, NULL, 
 '["*"]', 
 '{"api_access": true, "white_label": true, "priority_support": true, "sla_hours": 4}', 
 30, 5);

-- Таблица: subscriptions (Подписки)
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    plan_id INTEGER NOT NULL REFERENCES billing_plans(id),
    -- Период
    billing_period VARCHAR(20) NOT NULL, -- monthly, yearly
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    -- Триал
    is_trial BOOLEAN DEFAULT FALSE,
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    -- Состояние
    status VARCHAR(20) DEFAULT 'active', 
    -- active, past_due, cancelled, expired, suspended
    cancel_reason TEXT,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    -- Автопродление
    auto_renew BOOLEAN DEFAULT TRUE,
    -- Платёжный метод
    payment_method_id UUID REFERENCES payment_methods(id),
    -- Даты платежей
    last_payment_at TIMESTAMP WITH TIME ZONE,
    next_payment_at TIMESTAMP WITH TIME ZONE,
    -- Переход на другой план
    pending_plan_id INTEGER REFERENCES billing_plans(id), -- план после истечения
    -- Метаданные
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id) -- одна активная подписка на компанию
);

-- Индексы
CREATE INDEX idx_subscriptions_company ON subscriptions(company_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_expires ON subscriptions(expires_at);
CREATE INDEX idx_subscriptions_next_payment ON subscriptions(next_payment_at);

-- Таблица: payment_methods (Платёжные методы)
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    -- Тип
    method_type VARCHAR(20) NOT NULL, -- card, invoice
    -- Данные карты (маскированные)
    card_last4 VARCHAR(4),
    card_brand VARCHAR(20), -- visa, mastercard, mir
    card_exp_month INTEGER,
    card_exp_year INTEGER,
    -- Токен в платёжной системе
    provider VARCHAR(50), -- stripe, yookassa, cloudpayments
    external_id VARCHAR(255), -- ID в платёжной системе
    -- Состояние
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    -- Метаданные
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица: payments (Платежи)
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id),
    payment_method_id UUID REFERENCES payment_methods(id),
    -- Сумма
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'RUB',
    -- Скидка
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    promo_code_id UUID REFERENCES promo_codes(id),
    -- Итого
    total_amount DECIMAL(10, 2) NOT NULL,
    -- Платёжная система
    payment_provider VARCHAR(50), -- stripe, yookassa, cloudpayments, invoice
    external_id VARCHAR(255), -- ID транзакции в платёжной системе
    -- Тип и статус
    payment_type VARCHAR(20) DEFAULT 'subscription', -- subscription, one_time, refund
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed, refunded
    -- Ошибка
    error_code VARCHAR(50),
    error_message TEXT,
    -- Документы
    invoice_number VARCHAR(50),
    invoice_url VARCHAR(500),
    receipt_url VARCHAR(500),
    -- Метаданные
    description TEXT,
    metadata JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    -- Даты
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    refunded_at TIMESTAMP WITH TIME ZONE
);

-- Индексы
CREATE INDEX idx_payments_company ON payments(company_id);
CREATE INDEX idx_payments_subscription ON payments(subscription_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_date ON payments(created_at DESC);
CREATE INDEX idx_payments_external ON payments(payment_provider, external_id);

-- Таблица: promo_codes (Промокоды)
CREATE TABLE promo_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    -- Скидка
    discount_type VARCHAR(20) NOT NULL, -- percent, fixed
    discount_value DECIMAL(10, 2) NOT NULL,
    -- Ограничения
    max_uses INTEGER, -- NULL = безлимит
    current_uses INTEGER DEFAULT 0,
    valid_from TIMESTAMP WITH TIME ZONE,
    valid_until TIMESTAMP WITH TIME ZONE,
    -- Применимость
    applicable_plans INTEGER[], -- ID планов, NULL = все
    min_period VARCHAR(20), -- monthly, yearly, NULL = все
    first_payment_only BOOLEAN DEFAULT TRUE,
    -- Состояние
    is_active BOOLEAN DEFAULT TRUE,
    -- Метаданные
    created_by_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы
CREATE INDEX idx_promo_codes_code ON promo_codes(code);
CREATE INDEX idx_promo_codes_active ON promo_codes(is_active, valid_until) WHERE is_active = TRUE;

-- Таблица: usage_stats (Статистика использования)
CREATE TABLE usage_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    -- Период
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    -- Метрики
    users_count INTEGER DEFAULT 0,
    projects_count INTEGER DEFAULT 0,
    storage_used_bytes BIGINT DEFAULT 0,
    documents_count INTEGER DEFAULT 0,
    reports_generated INTEGER DEFAULT 0,
    api_calls INTEGER DEFAULT 0,
    -- Метаданные
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, period_start)
);

-- Индексы
CREATE INDEX idx_usage_stats_company ON usage_stats(company_id);
CREATE INDEX idx_usage_stats_period ON usage_stats(period_start);
```

### 4.15.3 Backend API

#### GET /api/v1/billing/plans

**Описание:** Список доступных тарифов

**Ответ:**
```json
{
    "success": true,
    "data": [
        {
            "id": 1,
            "code": "free",
            "name": "Бесплатный",
            "description": "Для небольших команд",
            "price_monthly": 0,
            "price_yearly": 0,
            "limits": {
                "max_users": 2,
                "max_projects": 3,
                "max_storage_gb": 1
            },
            "modules": ["estimates"],
            "features": {
                "api_access": false
            },
            "is_featured": false
        },
        {
            "id": 2,
            "code": "startup",
            "name": "Стартап",
            "description": "Для растущих компаний",
            "price_monthly": 2990,
            "price_yearly": 29900,
            "yearly_discount_percent": 17,
            "limits": {
                "max_users": 5,
                "max_projects": 10,
                "max_storage_gb": 5
            },
            "modules": ["estimates", "offers", "tasks"],
            "features": {
                "api_access": true,
                "sla_hours": 48
            },
            "trial_days": 14,
            "is_featured": false
        },
        {
            "id": 3,
            "code": "business",
            "name": "Бизнес",
            "description": "Для средних компаний",
            "price_monthly": 9990,
            "price_yearly": 99900,
            "yearly_discount_percent": 17,
            "limits": {
                "max_users": 20,
                "max_projects": 50,
                "max_storage_gb": 25
            },
            "modules": ["estimates", "offers", "tasks", "gantt", "dms", "finance"],
            "features": {
                "api_access": true,
                "sla_hours": 24
            },
            "trial_days": 14,
            "is_featured": true
        }
    ]
}
```

#### GET /api/v1/billing/subscription

**Описание:** Текущая подписка компании

**Ответ:**
```json
{
    "success": true,
    "data": {
        "id": "sub-001",
        "plan": {
            "id": 3,
            "code": "business",
            "name": "Бизнес"
        },
        "status": "active",
        "billing_period": "yearly",
        "started_at": "2024-01-01T00:00:00Z",
        "expires_at": "2025-01-01T00:00:00Z",
        "auto_renew": true,
        "is_trial": false,
        "next_payment": {
            "date": "2024-12-01T00:00:00Z",
            "amount": 99900.00
        },
        "payment_method": {
            "type": "card",
            "card_last4": "4242",
            "card_brand": "visa"
        },
        "usage": {
            "users": {"used": 12, "limit": 20, "percent": 60},
            "projects": {"used": 25, "limit": 50, "percent": 50},
            "storage_gb": {"used": 8.5, "limit": 25, "percent": 34}
        }
    }
}
```

#### POST /api/v1/billing/subscribe

**Описание:** Оформление/изменение подписки

**Тело запроса:**
```json
{
    "plan_id": 3,
    "billing_period": "yearly",
    "payment_method_id": "pm-001",
    "promo_code": "WELCOME20"
}
```

**Логика обработки:**
1. Валидация плана и периода
2. Проверка промокода (если указан)
3. Расчёт итоговой суммы с учётом скидки
4. Если есть активная подписка:
   - Если апгрейд → пропорциональный расчёт
   - Если даунгрейд → изменение после истечения
5. Создание платежа
6. Редирект на страницу оплаты или обработка
7. После успешной оплаты:
   - Создание/обновление подписки
   - Обновление лимитов компании
   - Отправка email с подтверждением

**Ответ (редирект на оплату):**
```json
{
    "success": true,
    "data": {
        "payment_id": "pay-001",
        "checkout_url": "https://checkout.yookassa.ru/...",
        "amount": 79920.00,
        "discount": 19980.00,
        "original_amount": 99900.00
    }
}
```

#### POST /api/v1/billing/webhook

**Описание:** Вебхук от платёжной системы

**Логика:**
1. Проверка подписи запроса
2. Обработка события:
   - `payment.succeeded` → активация подписки
   - `payment.failed` → уведомление, повторная попытка
   - `refund.succeeded` → обработка возврата
3. Обновление статуса платежа
4. Логирование

#### POST /api/v1/billing/cancel

**Описание:** Отмена подписки

**Тело запроса:**
```json
{
    "reason": "too_expensive",
    "feedback": "Слишком высокая цена для нашей компании"
}
```

**Логика:**
- Отключение auto_renew
- Подписка работает до expires_at
- После истечения → переход на бесплатный план или блокировка

#### GET /api/v1/billing/invoices

**Описание:** Список счетов/платежей

**Ответ:**
```json
{
    "success": true,
    "data": [
        {
            "id": "pay-001",
            "invoice_number": "INV-2024-001",
            "date": "2024-01-01T00:00:00Z",
            "amount": 99900.00,
            "status": "completed",
            "plan": "Бизнес (годовая)",
            "invoice_url": "/invoices/pay-001.pdf",
            "receipt_url": "/receipts/pay-001.pdf"
        }
    ],
    "meta": {
        "total": 5,
        "current_page": 1
    }
}
```

#### POST /api/v1/billing/promo-code/validate

**Описание:** Проверка промокода

**Тело запроса:**
```json
{
    "code": "WELCOME20",
    "plan_id": 3,
    "billing_period": "yearly"
}
```

**Ответ (успех):**
```json
{
    "success": true,
    "data": {
        "valid": true,
        "discount_type": "percent",
        "discount_value": 20,
        "final_amount": 79920.00,
        "savings": 19980.00
    }
}
```

**Ответ (ошибка):**
```json
{
    "success": false,
    "error": {
        "code": "PROMO_EXPIRED",
        "message": "Промокод истёк"
    }
}
```

### 4.15.4 Frontend - Интерфейс

#### Страница: Тарифы

**URL:** `/billing/plans`

**Wireframe:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Выберите тарифный план                            │
│                    Переключатель: [Месяц] [Год -17%]                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│ │ БЕСПЛАТНЫЙ  │ │  СТАРТАП    │ │  БИЗНЕС     │ │ КОРПОРАТИВ. │            │
│ │             │ │             │ │  ⭐ Popular │ │             │            │
│ │    0 ₽      │ │   2 990 ₽   │ │   9 990 ₽   │ │  По запросу │            │
│ │   /мес      │ │    /мес     │ │    /мес     │ │             │            │
│ │             │ │             │ │             │ │             │            │
│ │ 2 пользов.  │ │ 5 пользов.  │ │20 пользов.  │ │ Безлимит    │            │
│ │ 3 проекта   │ │ 10 проектов │ │50 проектов  │ │ Безлимит    │            │
│ │ 1 GB        │ │ 5 GB        │ │ 25 GB       │ │ По договору │            │
│ │             │ │             │ │             │ │             │            │
│ │ ✓ Сметы     │ │ ✓ Сметы     │ │ ✓ Сметы     │ │ ✓ Все модули│            │
│ │             │ │ ✓ Офферы    │ │ ✓ Офферы    │ │ ✓ White label│           │
│ │             │ │ ✓ Задачи    │ │ ✓ Задачи    │ │ ✓ Приоритет │            │
│ │             │ │             │ │ ✓ Гант      │ │   поддержка │            │
│ │             │ │             │ │ ✓ DMS       │ │             │            │
│ │             │ │             │ │ ✓ Финансы   │ │             │            │
│ │             │ │             │ │             │ │             │            │
│ │  [Текущий]  │ │ [Выбрать]   │ │ [Выбрать]   │ │ [Связаться] │            │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘            │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Страница: Управление подпиской

**URL:** `/billing/subscription`

**Секции:**
1. Текущий план и статус
2. Использование лимитов (прогресс-бары)
3. Способ оплаты
4. Следующий платёж
5. История платежей
6. Действия (изменить план, отменить)

### 4.15.5 Уведомления

| Событие | Получатели | Тип | Когда |
|---------|-----------|-----|-------|
| Подписка оформлена | Владелец | email | Сразу |
| Платёж успешен | Владелец, Бухгалтер | email | Сразу |
| Платёж не прошёл | Владелец | email, push | Сразу |
| Подписка истекает | Владелец | email | За 7, 3, 1 день |
| Trial заканчивается | Владелец | email | За 3, 1 день |
| Превышен лимит | Владелец, Админ | email, in-app | При превышении |
| Подписка отменена | Владелец | email | Сразу |

### 4.15.6 Критерии приёмки

- [ ] Страница тарифов с сравнением
- [ ] Переключатель месяц/год
- [ ] Оформление подписки
- [ ] Интеграция с платёжной системой (YooKassa/CloudPayments)
- [ ] Обработка вебхуков платёжной системы
- [ ] Управление способом оплаты
- [ ] Промокоды и скидки
- [ ] Учёт лимитов по тарифу
- [ ] Уведомления при превышении лимитов
- [ ] Пропорциональный расчёт при апгрейде
- [ ] Триальный период
- [ ] Автопродление подписок
- [ ] Отмена подписки
- [ ] История платежей
- [ ] Выставление счетов и актов
- [ ] Выгрузка документов (PDF)
- [ ] Уведомления об истечении подписки

---

# ПРИЛОЖЕНИЕ: Дополнительные SQL-скрипты

## Функции для работы с нумерацией

```sql
-- Функция генерации номера документа
CREATE OR REPLACE FUNCTION generate_document_number(
    p_company_id UUID,
    p_format VARCHAR,
    p_counter_name VARCHAR,
    p_project_code VARCHAR DEFAULT NULL
) RETURNS VARCHAR AS $$
DECLARE
    v_number INTEGER;
    v_result VARCHAR;
BEGIN
    -- Получить и увеличить счётчик
    UPDATE company_settings 
    SET next_project_number = next_project_number + 1
    WHERE company_id = p_company_id
    RETURNING CASE 
        WHEN p_counter_name = 'project' THEN next_project_number - 1
        WHEN p_counter_name = 'act' THEN next_act_number
        WHEN p_counter_name = 'offer' THEN next_offer_number
    END INTO v_number;
    
    -- Подставить значения в формат
    v_result := p_format;
    v_result := REPLACE(v_result, '{YYYY}', EXTRACT(YEAR FROM NOW())::TEXT);
    v_result := REPLACE(v_result, '{YY}', RIGHT(EXTRACT(YEAR FROM NOW())::TEXT, 2));
    v_result := REPLACE(v_result, '{MM}', LPAD(EXTRACT(MONTH FROM NOW())::TEXT, 2, '0'));
    v_result := REPLACE(v_result, '{NNNN}', LPAD(v_number::TEXT, 4, '0'));
    v_result := REPLACE(v_result, '{NNN}', LPAD(v_number::TEXT, 3, '0'));
    v_result := REPLACE(v_result, '{NN}', LPAD(v_number::TEXT, 2, '0'));
    v_result := REPLACE(v_result, '{PROJECT}', COALESCE(p_project_code, ''));
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;
```

## Индексы для полнотекстового поиска

```sql
-- Глобальный поиск
CREATE INDEX idx_projects_search ON projects USING GIN(
    to_tsvector('russian', coalesce(name, '') || ' ' || coalesce(description, ''))
);

CREATE INDEX idx_tickets_search ON tickets USING GIN(
    to_tsvector('russian', coalesce(title, '') || ' ' || coalesce(description, ''))
);

CREATE INDEX idx_contractors_search ON contractors USING GIN(
    to_tsvector('russian', coalesce(name, '') || ' ' || coalesce(short_name, ''))
);
```

---

**Конец документа (Часть 3)**

*Документ является продолжением TZ_ElektroSmeta_Integration_v2_0.md и TZ_ElektroSmeta_Modules_7_15.md*
*Версия: 2.0.1 | Дата: 07.02.2026*


---
---
---

# ═══════════════════════════════════════════════════════════════
# ЧАСТЬ 4: ДОПОЛНЕНИЕ — НЕДОСТАЮЩИЕ СЕКЦИИ МОДУЛЕЙ
# ═══════════════════════════════════════════════════════════════

# ДОПОЛНЕНИЕ К ТЕХНИЧЕСКОМУ ЗАДАНИЮ
# ElektroSmeta v2.0 — Недостающие секции модулей

**Версия документа:** 2.0.2  
**Дата:** 07.02.2026  
**Статус:** Дополнение  

---

> **СПРАВКА О ПОЛНОТЕ**
>
> Настоящий документ дополняет три основных файла ТЗ:
> - `TZ_ElektroSmeta_Integration_v2_0.md` (Модули 1–6)
> - `TZ_ElektroSmeta_Modules_7_15.md` (Модули 7–15, сокращённо)
> - `TZ_ElektroSmeta_Modules_12_15_Complete.md` (Модули 12–15, полная детализация)
>
> Ниже приведены **только те секции**, которые отсутствуют в указанных файлах.

---

# МОДУЛЬ 2: Управление проектами — ДОПОЛНЕНИЕ

## 4.2.7-доп Интеграции

- **Модуль 1 (Ядро):** Проверка прав доступа через RBAC при каждом обращении к проекту
- **Модуль 3 (Сметирование):** Автоматическое создание пустого контейнера сметы при создании проекта; стоимость сметы отображается в карточке проекта
- **Модуль 5 (Контрагенты):** Связь проекта с заказчиком (contractor_id); фильтрация проектов по контрагенту
- **Модуль 6 (Задачи):** Счётчик задач в карточке проекта; статус-бар задач (открыто/в работе/закрыто)
- **Модуль 8 (DMS):** Автоматическое создание корневой папки документов при создании проекта
- **Модуль 10 (Финансы):** Сводка финансов проекта (бюджет, факт, отклонение)
- **WebSocket:** Канал `project:{project_id}` — real-time обновления статуса, участников, общей стоимости

**Формат обмена данными:**
- Все внутренние интеграции — через сервисный слой (прямые вызовы сервисов)
- Внешние — REST API (JSON)
- Real-time — WebSocket-события:
  ```json
  {
    "event": "project.updated",
    "data": { "project_id": "uuid", "field": "status", "value": "active", "user_id": "uuid" }
  }
  ```

## 4.2.8-доп Уведомления

| Событие | Email | Push | In-app |
|---------|:-----:|:----:|:------:|
| Создание проекта | ❌ | ❌ | ✅ |
| Добавление участника | ✅ | ✅ | ✅ |
| Удаление участника | ✅ | ✅ | ✅ |
| Изменение статуса проекта | ✅ | ✅ | ✅ |
| Изменение роли участника | ✅ | ✅ | ✅ |
| Проект архивирован | ✅ | ❌ | ✅ |
| Приближение дедлайна проекта (за 7 дней) | ✅ | ✅ | ✅ |

**Шаблон email "Добавление в проект":**
```
Тема: Вы добавлены в проект «{project_name}»

Здравствуйте, {first_name}!

Вы были добавлены в проект «{project_name}» с ролью «{role_name}».

Заказчик: {client_name}
Адрес объекта: {address}
Руководитель: {manager_name}

Перейти к проекту:
{project_url}

С уважением,
Команда ElektroSmeta
```

**Шаблон email "Смена статуса проекта":**
```
Тема: Статус проекта «{project_name}» изменён на «{new_status}»

Здравствуйте, {first_name}!

Статус проекта «{project_name}» был изменён:
- Было: {old_status}
- Стало: {new_status}
- Изменил: {changed_by_name}
- Дата: {changed_at}

Перейти к проекту:
{project_url}

С уважением,
Команда ElektroSmeta
```

**Настройки пользователя:**
Каждый пользователь может в профиле отключить/включить:
- Email-уведомления по каждому типу событий
- Push-уведомления
- In-app (нельзя отключить для критических событий)

## 4.2.9-доп Тестирование

| # | Сценарий | Шаги | Ожидаемый результат |
|---|----------|------|---------------------|
| 1 | Создание проекта | 1. Открыть /projects<br>2. Нажать «Создать проект»<br>3. Заполнить обязательные поля<br>4. Нажать «Сохранить» | Проект создан, редирект на карточку проекта |
| 2 | Создание проекта без обязательных полей | 1. Открыть форму<br>2. Оставить пустое имя<br>3. Нажать «Сохранить» | Ошибка валидации: "Название обязательно" |
| 3 | Добавление участника | 1. Открыть проект<br>2. Вкладка «Участники»<br>3. Нажать «Добавить»<br>4. Выбрать пользователя и роль | Участник добавлен, отправлено уведомление |
| 4 | Изменение статуса | 1. Открыть проект<br>2. Изменить статус на «Завершён» | Статус обновлён, уведомления участникам |
| 5 | Копирование проекта | 1. Контекстное меню проекта<br>2. «Копировать»<br>3. Настроить параметры (с/без смет, задач)<br>4. Подтвердить | Создана копия проекта с выбранными данными |
| 6 | Удаление проекта | 1. Контекстное меню<br>2. «Удалить»<br>3. Ввести подтверждение | Проект помечен как удалённый (soft delete) |
| 7 | Фильтрация проектов | 1. Открыть список<br>2. Установить фильтр по статусу<br>3. Ввести поисковый запрос | Список обновляется, показаны только подходящие проекты |
| 8 | Перемещение в папку | 1. Выбрать проект<br>2. Drag & Drop в папку | Проект перемещён, breadcrumbs обновлены |
| 9 | Права доступа — Наблюдатель | 1. Войти как Наблюдатель<br>2. Открыть проект<br>3. Попробовать редактировать | Кнопки редактирования скрыты, данные только для чтения |
| 10 | Real-time обновление | 1. Открыть проект в 2 вкладках<br>2. В одной изменить статус | Во второй вкладке статус обновлён без перезагрузки |

**Тестовые данные:**
```json
{
  "projects": [
    { "name": "ЖК Новые горизонты — электромонтаж", "status": "active", "folder": "Жилые объекты" },
    { "name": "БЦ Парус — слаботочные системы", "status": "active", "folder": "Коммерческие" },
    { "name": "Школа №42 — освещение", "status": "completed", "folder": null }
  ]
}
```

---

# МОДУЛЬ 3: Сметирование (расширенное) — ДОПОЛНЕНИЕ

## 4.3.10-доп Тестирование

| # | Сценарий | Шаги | Ожидаемый результат |
|---|----------|------|---------------------|
| 1 | Создание раздела сметы | 1. Открыть смету<br>2. Нажать «Добавить раздел»<br>3. Ввести название | Раздел создан, отображается в иерархии |
| 2 | Добавление работы | 1. Раскрыть раздел<br>2. Нажать «Добавить работу»<br>3. Заполнить наименование, объём, цену | Работа добавлена, итоги раздела пересчитаны |
| 3 | Добавление ресурса к работе | 1. Выбрать работу<br>2. «Добавить ресурс»<br>3. Выбрать из справочника | Ресурс привязан, стоимость пересчитана |
| 4 | Inline-редактирование | 1. Двойной клик на ячейке цены<br>2. Ввести новое значение<br>3. Tab/Enter | Значение сохранено, итоги пересчитаны в реальном времени |
| 5 | Drag & Drop сортировка | 1. Захватить работу<br>2. Перетащить в другой раздел | Работа перемещена, нумерация обновлена |
| 6 | Применение наценки | 1. Открыть настройки наценки<br>2. Указать % наценки и НДС<br>3. Сохранить | Все суммы пересчитаны с наценкой |
| 7 | Добавление из справочника | 1. Нажать «Из справочника»<br>2. Найти расценку<br>3. Выбрать и подтвердить | Позиция добавлена с данными из справочника |
| 8 | Копирование раздела | 1. Контекстное меню раздела<br>2. «Копировать» | Создана копия раздела со всеми работами и ресурсами |
| 9 | Экспорт сметы в XLSX | 1. Нажать «Экспорт» → XLSX<br>2. Дождаться генерации | Файл скачан, структура соответствует смете |
| 10 | Большие объёмы (500+ позиций) | 1. Загрузить смету с 500 позициями<br>2. Прокрутить, отредактировать | Виртуализация работает, UI не тормозит |
| 11 | Одновременное редактирование | 1. Два пользователя открывают смету<br>2. Один добавляет работу | Второй видит изменения через WebSocket |
| 12 | Удаление раздела с работами | 1. Удалить раздел с 3 работами<br>2. Подтвердить | Раздел и работы удалены, итоги пересчитаны |

**Тестовые данные:**
```json
{
  "estimate_sections": [
    {
      "name": "Электрощитовое оборудование",
      "tasks": [
        { "name": "Монтаж ВРУ-0,4кВ", "unit": "шт", "quantity": 2, "price": 45000 },
        { "name": "Монтаж щита ЩР", "unit": "шт", "quantity": 8, "price": 15000 }
      ]
    },
    {
      "name": "Кабельные линии",
      "tasks": [
        { "name": "Прокладка кабеля ВВГнг 3x2.5", "unit": "м", "quantity": 1500, "price": 120 },
        { "name": "Прокладка кабеля ВВГнг 5x4", "unit": "м", "quantity": 800, "price": 180 }
      ]
    }
  ]
}
```

---

# МОДУЛЬ 4: Коммерческие предложения (Офферы) — ДОПОЛНЕНИЕ

## 4.4.2-доп Роли и права доступа

| Действие | Владелец | Администратор | Рук. проектов | Сметчик | Прораб | Субподр. | Наблюд. | Бухгалтер |
|----------|:--------:|:-------------:|:-------------:|:-------:|:------:|:--------:|:-------:|:---------:|
| Просмотр списка офферов | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Создание оффера | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Редактирование оффера | ✅ | ✅ | ✅ | ✅ (свои) | ❌ | ❌ | ❌ | ❌ |
| Удаление оффера | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Отправка клиенту | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Изменение статуса | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Управление шаблонами | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Экспорт в PDF | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |

**Особые правила:**
- Инженер-сметчик может редактировать только офферы, которые он создал
- Наблюдатель видит офферы только в привязанных к нему проектах
- Бухгалтер видит только финальные суммы офферов (без детализации позиций)

## 4.4.6-доп Бизнес-логика и процессы

### Процесс: Создание оффера из сметы

```
┌─────────────────────┐
│  Пользователь       │
│  нажимает «Создать  │
│  КП из сметы»       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Выбор проекта и    │
│  сметы-источника    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Выбор разделов для │
│  импорта (чекбоксы) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Выбор контрагента  │
│  (заказчик)         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Настройка:         │
│  - Наценка?         │
│  - Скидка?          │
│  - Срок действия    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  BEGIN TRANSACTION   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Создать запись     │
│  offers             │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Скопировать разделы│
│  → offer_sections   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Скопировать позиции│
│  → offer_items      │
│  (с ценами + наценка│
│  + скидка)          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Рассчитать итоги:  │
│  total_amount       │
│  discount_amount    │
│  final_amount       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Сгенерировать      │
│  public_token       │
│  (UUID v4)          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  COMMIT              │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Redirect на        │
│  редактор оффера    │
└─────────────────────┘
```

### Процесс: Отправка КП клиенту

```
┌─────────────────────┐
│  Нажать «Отправить» │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Модальное окно:    │
│  - Email получателя │
│  - Тема письма      │
│  - Текст сообщения  │
│  - [✓] Приложить PDF│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Валидация email    │──── Ошибка ──→ Показать
└──────────┬──────────┘
           │ OK
           ▼
┌─────────────────────┐
│  Если attach_pdf:   │
│  генерация PDF      │
│  (Puppeteer)        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Отправить email    │
│  через SendGrid     │
│  (с PDF-вложением)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Обновить:          │
│  status = 2 (отпр.) │
│  sent_at = NOW()    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  WebSocket: событие │
│  offer.sent         │
└─────────────────────┘
```

### Процесс: Публичный просмотр клиентом

1. Клиент переходит по ссылке `/offers/{id}/public/{token}`
2. Система проверяет валидность `public_token`
3. Проверяет `valid_until` — если истёк, показывает «КП просрочено»
4. Увеличивает `viewed_count` на 1
5. Если `viewed_at` = NULL, устанавливает текущее время
6. Рендерит страницу просмотра (без навигации системы)
7. Кнопки: «Скачать PDF», «Принять», «Отклонить»
8. При нажатии «Принять» → статус = 3, `accepted_at` = NOW()
9. При нажатии «Отклонить» → модальное окно «причина отклонения» → статус = 4, `rejected_at` = NOW()
10. В обоих случаях — email-уведомление автору КП

**Расчёт итогов оффера:**
```
total_amount = SUM(offer_items.quantity * offer_items.unit_price)
discount_amount = total_amount * discount_percent / 100
final_amount = total_amount - discount_amount
```

## 4.4.7-доп Интеграции

- **Модуль 3 (Сметы):** Импорт позиций из сметы при создании оффера; кнопка «Создать КП» на странице сметы
- **Модуль 5 (Контрагенты):** Выбор заказчика из базы; автоподстановка реквизитов в шаблон
- **Модуль 10 (Финансы):** При принятии КП автоматически создаётся плановый платёж
- **Модуль 12 (Отчёты):** Данные офферов доступны для конструктора отчётов (токены: `{offer_number}`, `{offer_date}`, `{offer_total}`)
- **Email-сервис:** Отправка КП через SendGrid/MailGun
- **PDF-генерация:** Puppeteer для рендеринга PDF из HTML-шаблона

**WebSocket-события:**
```json
{ "event": "offer.created", "data": { "offer_id": "uuid", "project_id": "uuid" } }
{ "event": "offer.sent", "data": { "offer_id": "uuid", "client_email": "..." } }
{ "event": "offer.viewed", "data": { "offer_id": "uuid", "viewed_count": 3 } }
{ "event": "offer.accepted", "data": { "offer_id": "uuid" } }
{ "event": "offer.rejected", "data": { "offer_id": "uuid", "reason": "..." } }
```

## 4.4.8-доп Уведомления

| Событие | Email | Push | In-app |
|---------|:-----:|:----:|:------:|
| КП создано | ❌ | ❌ | ✅ |
| КП отправлено клиенту | ✅ (клиенту) | ❌ | ✅ |
| КП просмотрено клиентом | ✅ | ✅ | ✅ |
| КП принято клиентом | ✅ | ✅ | ✅ |
| КП отклонено клиентом | ✅ | ✅ | ✅ |
| Срок действия КП истекает (за 3 дня) | ✅ | ✅ | ✅ |
| Срок действия КП истёк | ✅ | ❌ | ✅ |

**Шаблон email "КП просмотрено":**
```
Тема: Клиент просмотрел КП №{offer_number}

Здравствуйте, {first_name}!

Ваше коммерческое предложение №{offer_number} «{offer_name}» было просмотрено клиентом {client_name}.

Статистика:
- Количество просмотров: {viewed_count}
- Первый просмотр: {first_viewed_at}
- Последний просмотр: {last_viewed_at}

Перейти к КП:
{offer_url}

С уважением,
Команда ElektroSmeta
```

## 4.4.9-доп Тестирование

| # | Сценарий | Шаги | Ожидаемый результат |
|---|----------|------|---------------------|
| 1 | Создание КП из сметы | 1. Открыть смету<br>2. «Создать КП»<br>3. Выбрать разделы<br>4. Указать заказчика, скидку<br>5. Сохранить | КП создано, позиции скопированы, итоги пересчитаны |
| 2 | Создание пустого КП | 1. Список офферов<br>2. «Создать КП»<br>3. Заполнить вручную | КП создано без привязки к смете |
| 3 | Inline-редактирование цен | 1. Открыть КП<br>2. Изменить цену позиции | Итоги автоматически пересчитываются |
| 4 | Отправка по email | 1. Нажать «Отправить»<br>2. Указать email, тему<br>3. Подтвердить | Статус = «Отправлен», клиент получил email |
| 5 | Публичный просмотр | 1. Перейти по публичной ссылке<br>2. Убедиться, что КП отображается | Данные КП видны, viewed_count увеличен |
| 6 | Принятие КП клиентом | 1. Публичная ссылка<br>2. Нажать «Принять» | Статус = «Принят», уведомление автору |
| 7 | Отклонение КП | 1. Публичная ссылка<br>2. Нажать «Отклонить»<br>3. Указать причину | Статус = «Отклонён», причина сохранена |
| 8 | Экспорт PDF | 1. Открыть КП<br>2. Нажать «Скачать PDF» | PDF скачан, layout корректный |
| 9 | Копирование КП | 1. Контекстное меню<br>2. «Создать вариант» | Копия КП создана со всеми позициями |
| 10 | Просроченное КП | 1. Установить valid_until в прошлом<br>2. Открыть публичную ссылку | Отображается «Срок действия истёк» |

---

# МОДУЛЬ 5: Контрагенты — ДОПОЛНЕНИЕ

## 4.5.2-доп Роли и права доступа

| Действие | Владелец | Администратор | Рук. проектов | Сметчик | Прораб | Субподр. | Наблюд. | Бухгалтер |
|----------|:--------:|:-------------:|:-------------:|:-------:|:------:|:--------:|:-------:|:---------:|
| Просмотр списка | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Просмотр карточки | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Создание контрагента | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Редактирование | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Удаление | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Управление группами | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Просмотр банк. реквизитов | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Экспорт списка | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |

## 4.5.5-доп Frontend - Интерфейс

### Страница: Список контрагентов

**URL:** `/contractors`

**Wireframe:**
```
┌──────────────────────────────────────────────────────────────────┐
│  Контрагенты                           [+ Создать] [Экспорт ▼] │
├──────────────────────────────────────────────────────────────────┤
│  🔍 Поиск по названию, ИНН, контактам...                       │
│  Тип: [Все ▼]  Категория: [Все ▼]  Группа: [Все ▼]            │
├────┬─────────────────┬──────────┬──────────┬──────────┬─────────┤
│ #  │ Наименование    │ ИНН      │ Контакт  │ Телефон  │ Проекты │
├────┼─────────────────┼──────────┼──────────┼──────────┼─────────┤
│ 1  │ 🏢 ООО СтройИн │ 77070838 │ Иванов П │ +7(495)  │ 3       │
│ 2  │ 🏢 ИП Петров А │ 50040129 │ Петров А │ +7(916)  │ 1       │
│ 3  │ 👤 Сидорова Е.  │ —        │ Сидорова │ +7(926)  │ 0       │
├────┴─────────────────┴──────────┴──────────┴──────────┴─────────┤
│  Страница 1 из 5                              [◀ 1 2 3 4 5 ▶]  │
└──────────────────────────────────────────────────────────────────┘
```

### Страница: Карточка контрагента

**URL:** `/contractors/{id}`

**Wireframe:**
```
┌──────────────────────────────────────────────────────────────────┐
│  ← Назад  ООО «СтройИнвест»                     [Редактировать]│
├──────────────────────────────────────────────────────────────────┤
│  [Основное] [Реквизиты] [Банк. счета] [Проекты] [Документы]    │
├──────────────────────────────────────────────────────────────────┤
│  Вкладка «Основное»:                                            │
│                                                                  │
│  Тип:           Юридическое лицо                                │
│  Категории:     🏷 Заказчик  🏷 Подрядчик                       │
│  Группа:        Постоянные клиенты                              │
│  Контактное лицо: Иванов Пётр Сергеевич, Генеральный директор  │
│  Телефон:       +7 (495) 123-45-67                              │
│  Email:         info@stroyinvest.ru                              │
│  Юр. адрес:     г. Москва, ул. Строителей, 15                  │
│  Факт. адрес:   г. Москва, ул. Строителей, 15                  │
│                                                                  │
│  Связанные проекты:                                             │
│  ├── ЖК Новые горизонты (активный)                              │
│  ├── БЦ Парус (активный)                                        │
│  └── Школа №42 (завершён)                                       │
│                                                                  │
│  Статистика:                                                    │
│  ├── Проектов: 3                                                │
│  ├── Офферов: 5                                                 │
│  └── Общая сумма контрактов: 12 450 000 ₽                      │
└──────────────────────────────────────────────────────────────────┘
```

**Элементы интерфейса:**

| Элемент | Тип | Поведение | Валидация |
|---------|-----|-----------|-----------|
| Название | Text input | Обязательное | min: 2, max: 500 |
| Короткое название | Text input | Необязательное | max: 100 |
| Тип | Select | Физ.лицо / Юр.лицо | required |
| ИНН | Text input | Автозаполнение при вводе 10/12 цифр | 10 цифр (юр) / 12 (физ) |
| Кнопка «Найти по ИНН» | Button | Вызов DaData API, заполнение полей | — |
| Категория | Multi-select chips | Заказчик/Поставщик/Подрядчик | min: 1 |
| Группа | Select + «создать» | Выбор или создание новой группы | — |
| Банковские реквизиты | Вложенная форма | БИК → автозаполнение банка | БИК: 9 цифр, Р/С: 20 цифр |

**Состояния страницы:**
- **Загрузка:** Skeleton-заглушки на месте данных
- **Пустой список:** Иллюстрация + «Добавьте первого контрагента»
- **Ошибка загрузки:** «Не удалось загрузить данные» + кнопка «Повторить»
- **Контрагент не найден:** 404-страница

## 4.5.6-доп Бизнес-логика и процессы

### Процесс: Автозаполнение по ИНН

```
┌─────────────────────┐
│  Пользователь       │
│  вводит ИНН         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Проверка формата   │──── Неверный ──→ Ошибка «Неверный формат ИНН»
│  (10 или 12 цифр)   │
└──────────┬──────────┘
           │ OK
           ▼
┌─────────────────────┐
│  Запрос к DaData    │
│  POST suggestions/  │
│  party              │
└──────────┬──────────┘
           │
           ├──── Не найден ──→ «Организация не найдена в реестре»
           │
           ▼ Найден
┌─────────────────────┐
│  Показать найденные │
│  варианты (dropdown) │
└──────────┬──────────┘
           │
           ▼ Выбрал
┌─────────────────────┐
│  Заполнить поля:    │
│  - name             │
│  - short_name       │
│  - kpp              │
│  - ogrn             │
│  - legal_address    │
│  - director (contact│
│    _person)         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Проверить наличие  │──── Есть ──→ «Контрагент с таким ИНН уже есть. Перейти?»
│  в базе по ИНН      │
└──────────┬──────────┘
           │ Нет
           ▼
┌─────────────────────┐
│  Пользователь       │
│  дополняет данные   │
│  и сохраняет        │
└─────────────────────┘
```

### Правила дедупликации:
- При создании проверяется уникальность ИНН в рамках компании
- Если ИНН совпадает — предлагается перейти к существующему контрагенту
- Для физ.лиц без ИНН дедупликация по ФИО + телефон

## 4.5.7-доп Интеграции

- **DaData API:** Автозаполнение реквизитов по ИНН (`POST https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/party`)
- **Модуль 2 (Проекты):** Контрагент привязывается как заказчик проекта
- **Модуль 4 (Офферы):** Контрагент выбирается как получатель КП
- **Модуль 10 (Финансы):** Контрагент выступает как плательщик/получатель в платежах
- **Модуль 11 (Закупки):** Контрагент выступает как поставщик в заказах
- **Модуль 12 (Отчёты):** Токены `{contractor_name}`, `{contractor_inn}`, `{contractor_address}`

## 4.5.8-доп Уведомления

| Событие | Email | Push | In-app |
|---------|:-----:|:----:|:------:|
| Контрагент создан | ❌ | ❌ | ✅ |
| Контрагент удалён | ❌ | ❌ | ✅ |
| Контрагент привязан к проекту | ❌ | ❌ | ✅ |

> Модуль контрагентов генерирует минимум уведомлений, так как является справочной сущностью.

## 4.5.9-доп Тестирование

| # | Сценарий | Шаги | Ожидаемый результат |
|---|----------|------|---------------------|
| 1 | Создание юр. лица | 1. Нажать «Создать»<br>2. Тип: Юр. лицо<br>3. Заполнить обязательные поля<br>4. Сохранить | Контрагент создан |
| 2 | Автозаполнение по ИНН | 1. Ввести ИНН «7707083893»<br>2. Нажать «Найти» | Поля заполнены данными из DaData |
| 3 | Дубликат ИНН | 1. Создать контрагента с ИНН<br>2. Попробовать создать второго с тем же ИНН | Предупреждение о существующем контрагенте |
| 4 | Создание физ. лица | 1. Тип: Физ. лицо<br>2. Заполнить ФИО, телефон<br>3. Сохранить | Контрагент создан без ИНН |
| 5 | Фильтрация по типу | 1. Фильтр «Поставщики» | Показаны только поставщики |
| 6 | Поиск по названию | 1. Ввести «Строй» в поиск | Показаны контрагенты, содержащие «Строй» |
| 7 | Удаление с проектами | 1. Удалить контрагента, привязанного к проекту | Предупреждение «Контрагент привязан к N проектам» |
| 8 | Экспорт в XLSX | 1. Нажать «Экспорт» | Файл скачан с актуальными данными |

---

# МОДУЛЬ 6: Задачи и дефекты — ДОПОЛНЕНИЕ

## 4.6.2-доп Роли и права доступа

| Действие | Владелец | Администратор | Рук. проектов | Сметчик | Прораб | Субподр. | Наблюд. |
|----------|:--------:|:-------------:|:-------------:|:-------:|:------:|:--------:|:-------:|
| Просмотр всех задач проекта | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Просмотр назначенных задач | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Создание задачи | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Редактирование любой задачи | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Редактирование своей задачи | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Назначение исполнителя | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Изменение статуса (свои) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Удаление задачи | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Комментирование | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Загрузка вложений | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Настройка типов задач | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Настройка кастомных полей | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Массовые операции | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

**Особые правила:**
- Субподрядчик видит только задачи, назначенные на него
- Прораб может создавать задачи и менять статус своих задач (Открыта → В работе → Решена)
- Наблюдатель не может ничего создавать или менять, только просматривать

## 4.6.6-доп Бизнес-логика и процессы

### Процесс: Жизненный цикл задачи

```
                    ┌──────────┐
                    │ Открыта  │
                    └────┬─────┘
                         │ Назначить исполнителя
                         ▼
                    ┌──────────┐
          ┌─────── │ В работе │ ◄──── Вернуть на доработку
          │        └────┬─────┘
          │             │ Выполнить
          │             ▼
          │        ┌──────────────┐
          │        │ На проверке  │
          │        └────┬────┬────┘
          │             │    │
          │     Принять │    │ Отклонить
          │             ▼    ▼
          │        ┌─────┐  ┌──────────┐
          │        │Реше-│  │ В работе │ (возврат)
          │        │ на  │  └──────────┘
          │        └──┬──┘
          │           │ Закрыть
          │           ▼
          │        ┌──────────┐
          │        │ Закрыта  │
          │        └──────────┘
          │
          │ Отклонить
          ▼
     ┌──────────┐
     │Отклонена │
     └──────────┘
```

### Процесс: Создание задачи с маркером на чертеже

```
┌─────────────────────┐
│  Пользователь       │
│  открывает чертёж   │
│  проекта            │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Нажимает на план   │
│  в нужной точке     │
│  (coordinates x, y) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Появляется форма   │
│  создания задачи с  │
│  предзаполненными   │
│  plan_id, position  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Заполнить:         │
│  - Тип задачи       │
│  - Название         │
│  - Описание         │
│  - Приоритет        │
│  - Исполнитель      │
│  - Срок             │
│  - Кастомные поля   │
│  - Фото (камера)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  POST /api/v1/      │
│  tickets            │
│  (с position_x,     │
│   position_y,       │
│   plan_id,          │
│   component_id)     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Маркер появляется  │
│  на чертеже         │
│  WebSocket: ticket. │
│  created            │
└─────────────────────┘
```

### Правила валидации кастомных полей:
```
text    → max_length: 1000
number  → min/max, decimal_places
date    → format ISO 8601, not_in_past (опц.)
select  → значение из списка options
boolean → true/false
```

### Логика optimistic locking:
1. При открытии задачи на редактирование → `POST /tickets/{id}/lock`
2. Если `is_locked = true` и `locked_by_id != current_user` → ошибка «Задача редактируется пользователем {name}»
3. Lock автоматически снимается через 5 минут бездействия
4. При сохранении/закрытии → `POST /tickets/{id}/unlock`
5. WebSocket-канал `ticket:{id}` уведомляет об изменениях lock-статуса

## 4.6.7-доп Интеграции

- **Модуль 2 (Проекты):** Задачи привязаны к проекту; статистика задач в карточке проекта
- **Модуль 7 (Чертежи):** Маркеры задач на чертежах; переход от маркера к карточке задачи
- **Модуль 8 (DMS):** Вложения задач хранятся в DMS; папка «Вложения задач» в проекте
- **Модуль 9 (Гант):** Задачи могут отображаться на диаграмме Ганта с датами и зависимостями
- **Модуль 12 (Отчёты):** Данные задач доступны для генерации отчётов
- **Модуль 13 (Согласования):** Задача может быть инициатором workflow согласования

**WebSocket-события:**
```json
{ "event": "ticket.created", "data": { "ticket_id": "uuid", "project_id": "uuid" } }
{ "event": "ticket.updated", "data": { "ticket_id": "uuid", "changes": {...} } }
{ "event": "ticket.status_changed", "data": { "ticket_id": "uuid", "old": 1, "new": 2 } }
{ "event": "ticket.assigned", "data": { "ticket_id": "uuid", "assignee_id": "uuid" } }
{ "event": "ticket.commented", "data": { "ticket_id": "uuid", "comment_id": "uuid" } }
{ "event": "ticket.locked", "data": { "ticket_id": "uuid", "user_id": "uuid" } }
{ "event": "ticket.unlocked", "data": { "ticket_id": "uuid" } }
```

## 4.6.8-доп Уведомления

| Событие | Email | Push | In-app |
|---------|:-----:|:----:|:------:|
| Задача назначена на меня | ✅ | ✅ | ✅ |
| Задача переназначена | ✅ | ✅ | ✅ |
| Статус задачи изменён | ✅ | ✅ | ✅ |
| Новый комментарий (я участник) | ✅ | ✅ | ✅ |
| Задача просрочена | ✅ | ✅ | ✅ |
| Срок задачи — завтра | ❌ | ✅ | ✅ |
| Задача заблокирована | ❌ | ❌ | ✅ |
| @упоминание в комментарии | ✅ | ✅ | ✅ |
| Вложение добавлено (я автор задачи) | ❌ | ✅ | ✅ |

**Шаблон email "Задача назначена":**
```
Тема: Вам назначена задача: {ticket_title}

Здравствуйте, {first_name}!

Вам назначена задача в проекте «{project_name}»:

Задача: {ticket_number} — {ticket_title}
Приоритет: {priority_name}
Срок: {due_date}
Назначил: {assigned_by_name}

Описание:
{ticket_description_preview}

Перейти к задаче:
{ticket_url}

С уважением,
Команда ElektroSmeta
```

## 4.6.9-доп Тестирование

| # | Сценарий | Шаги | Ожидаемый результат |
|---|----------|------|---------------------|
| 1 | Создание задачи | 1. Открыть проект<br>2. Вкладка «Задачи»<br>3. Нажать «Создать»<br>4. Заполнить форму<br>5. Сохранить | Задача создана, отображается в списке |
| 2 | Создание с маркером | 1. Открыть чертёж<br>2. Кликнуть на план<br>3. Заполнить форму | Задача создана, маркер отображается |
| 3 | Смена статуса (Kanban) | 1. Режим Kanban<br>2. Перетащить задачу | Статус обновлён, уведомление |
| 4 | Добавление комментария | 1. Открыть задачу<br>2. Написать комментарий<br>3. Отправить | Комментарий добавлен, уведомления |
| 5 | Кастомные поля | 1. Создать тип задачи с полями<br>2. Создать задачу этого типа<br>3. Заполнить кастомные поля | Поля сохранены и отображаются |
| 6 | Блокировка (lock) | 1. Пользователь A открывает задачу<br>2. Пользователь B пытается | B видит «Задача редактируется A» |
| 7 | Автоснятие lock | 1. A блокирует задачу<br>2. Ждать 5 минут без действий | Lock автоматически снят |
| 8 | Подзадачи | 1. Открыть задачу<br>2. «Добавить подзадачу»<br>3. Создать | Подзадача отображается иерархически |
| 9 | Фильтрация | 1. Установить фильтр по исполнителю и приоритету | Показаны только подходящие задачи |
| 10 | Массовая смена статуса | 1. Выбрать несколько задач (чекбоксы)<br>2. «Массовые действия» → «Изменить статус» | Все выбранные задачи обновлены |
| 11 | Субподрядчик | 1. Войти как субподрядчик<br>2. Открыть задачи | Видны только назначенные задачи |

---

# МОДУЛЬ 7: Чертежи и планы — ДОПОЛНЕНИЕ

## 4.7.8-доп Уведомления

| Событие | Email | Push | In-app |
|---------|:-----:|:----:|:------:|
| Новый чертёж загружен | ❌ | ✅ | ✅ |
| Новая версия чертежа | ✅ | ✅ | ✅ |
| Маркер задачи добавлен на план | ❌ | ❌ | ✅ |
| Аннотация добавлена | ❌ | ✅ | ✅ |
| Аннотация удалена | ❌ | ❌ | ✅ |

**Шаблон email "Новая версия чертежа":**
```
Тема: Загружена новая версия чертежа «{plan_name}»

Здравствуйте, {first_name}!

В проекте «{project_name}» загружена новая версия чертежа:

Чертёж: {plan_name}
Компонент: {component_name}
Версия: {version_number}
Загрузил: {uploaded_by_name}

Перейти к чертежу:
{plan_url}

С уважением,
Команда ElektroSmeta
```

## 4.7.9-доп Тестирование

| # | Сценарий | Шаги | Ожидаемый результат |
|---|----------|------|---------------------|
| 1 | Загрузка чертежа (PDF) | 1. Открыть раздел «Чертежи»<br>2. «Загрузить»<br>3. Выбрать PDF-файл | Чертёж загружен, превью сгенерировано |
| 2 | Загрузка чертежа (PNG/JPG) | 1. Загрузить растровое изображение | Чертёж загружен, отображается как план |
| 3 | Версионирование | 1. Выбрать существующий план<br>2. «Загрузить новую версию»<br>3. Выбрать файл | Новая версия создана, старая доступна |
| 4 | Переключение версий | 1. Открыть чертёж<br>2. Выбрать предыдущую версию | Отображается предыдущая версия |
| 5 | Добавление маркера | 1. Кликнуть на план<br>2. Заполнить форму задачи | Маркер отображается, задача создана |
| 6 | Аннотация (рисование) | 1. Режим аннотации<br>2. Нарисовать стрелку<br>3. Добавить текст | Аннотация видна всем участникам |
| 7 | Калибровка масштаба | 1. Режим калибровки<br>2. Провести линию<br>3. Указать реальное расстояние | Масштаб установлен, размеры корректны |
| 8 | Создание компонента | 1. «Добавить компонент» (этаж)<br>2. Привязать план к компоненту | Компонент создан, навигация работает |
| 9 | Большой файл (50 MB) | 1. Загрузить файл 50 MB<br>2. Дождаться обработки | Чанковая загрузка работает, прогресс отображается |
| 10 | Удаление чертежа | 1. Удалить чертёж с маркерами задач | Чертёж удалён, маркеры задач отвязаны (задачи сохранены) |

---

# МОДУЛЬ 8: Документооборот (DMS) — ДОПОЛНЕНИЕ

## 4.8.7-доп Интеграции

- **Модуль 2 (Проекты):** Автоматическое создание корневой папки при создании проекта; структура: `/{project_name}/Чертежи`, `/{project_name}/Документы`, `/{project_name}/Вложения задач`
- **Модуль 6 (Задачи):** Вложения задач хранятся в DMS; возможность привязать существующий документ к задаче
- **Модуль 7 (Чертежи):** Чертежи хранятся в DMS в папке «Чертежи»
- **Модуль 10 (Финансы):** Акты и счета хранятся как документы; автогенерация PDF актов
- **Модуль 12 (Отчёты):** Сгенерированные отчёты сохраняются в DMS
- **S3-совместимое хранилище:** MinIO/S3 для хранения файлов; DMS хранит только метаданные и ссылки
- **WOPI (будущее):** Интеграция с Office Online для онлайн-редактирования .docx/.xlsx

**Синхронизация:** Файлы загружаются в S3 сразу; метаданные записываются в PostgreSQL атомарно (транзакция). При ошибке загрузки в S3 — откат записи в БД.

## 4.8.9-доп Тестирование

| # | Сценарий | Шаги | Ожидаемый результат |
|---|----------|------|---------------------|
| 1 | Создание папки | 1. Открыть DMS<br>2. «Создать папку»<br>3. Ввести название | Папка создана |
| 2 | Загрузка файла | 1. Открыть папку<br>2. «Загрузить»<br>3. Выбрать файл | Файл загружен, отображается в списке |
| 3 | Drag & Drop загрузка | 1. Перетащить файл из ОС в браузер | Файл загружен |
| 4 | Множественная загрузка | 1. Выбрать 10 файлов<br>2. Загрузить | Все файлы загружены, прогресс для каждого |
| 5 | Чанковая загрузка (>100 MB) | 1. Загрузить файл 200 MB | Файл разбит на чанки, загрузка с прогрессом |
| 6 | Версионирование | 1. Загрузить новую версию файла<br>2. Просмотреть историю версий | Обе версии доступны |
| 7 | Поиск | 1. Ввести поисковый запрос<br>2. Результаты | Найдены файлы по имени и содержимому |
| 8 | Права доступа | 1. Установить права на папку<br>2. Войти под пользователем без доступа | Папка не видна / доступ запрещён |
| 9 | Скачивание | 1. Выбрать файл<br>2. «Скачать» | Файл скачан корректно |
| 10 | Удаление папки с файлами | 1. Удалить папку с файлами | Подтверждение, мягкое удаление |
| 11 | Перемещение файла | 1. Drag & Drop файла в другую папку | Файл перемещён, breadcrumbs обновлены |
| 12 | Лог активности | 1. Загрузить файл<br>2. Проверить лог | Запись «{user} загрузил {file}» |

---

# МОДУЛЬ 9: Планирование (Диаграмма Ганта) — ДОПОЛНЕНИЕ

## 4.9.7-доп Бизнес-логика и процессы

### Процесс: Автопланирование

```
┌─────────────────────┐
│  Пользователь       │
│  нажимает «Авто-    │
│  планирование»      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Выбор параметров:  │
│  - Дата старта      │
│  - Учёт выходных    │
│  - Учёт праздников  │
│  - Направление      │
│    (вперёд/назад)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Построить граф      │
│  зависимостей        │
│  (топологическая     │
│  сортировка)         │
└──────────┬──────────┘
           │
           ├──── Цикл обнаружен ──→ Ошибка «Циклическая зависимость»
           │
           ▼
┌─────────────────────┐
│  Для каждой задачи   │
│  (в порядке          │
│  топологической      │
│  сортировки):        │
│                      │
│  start_date = max(   │
│    predecessors.     │
│    end_date) + lag   │
│                      │
│  end_date =          │
│    addWorkingDays(   │
│    start_date,       │
│    duration)         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Показать превью     │
│  (до/после)         │
│  «Применить?»       │
└──────────┬──────────┘
           │ Подтвердить
           ▼
┌─────────────────────┐
│  UPDATE gantt_tasks  │
│  SET start_date,    │
│  end_date           │
│  (batch update)     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  WebSocket:          │
│  gantt.recalculated │
└─────────────────────┘
```

### Типы зависимостей (dependencies):
| Тип | Описание | Расчёт |
|-----|----------|--------|
| FS (Finish-to-Start) | Задача B начинается после окончания A | B.start = A.end + lag |
| FF (Finish-to-Finish) | Задача B заканчивается вместе с A | B.end = A.end + lag |
| SS (Start-to-Start) | Задача B начинается вместе с A | B.start = A.start + lag |
| SF (Start-to-Finish) | Задача B заканчивается, когда A начинается | B.end = A.start + lag |

### Алгоритм расчёта рабочих дней:
```
function addWorkingDays(startDate, durationDays, holidays, workingDays):
    currentDate = startDate
    addedDays = 0
    while addedDays < durationDays:
        currentDate = currentDate + 1 день
        if dayOfWeek(currentDate) in workingDays AND currentDate not in holidays:
            addedDays++
    return currentDate
```

### Расчёт критического пути:
1. Forward pass: вычислить ES (earliest start) и EF (earliest finish) для каждой задачи
2. Backward pass: вычислить LS (latest start) и LF (latest finish)
3. Slack = LS - ES
4. Критический путь = задачи с Slack = 0
5. Визуально выделить красным цветом

## 4.9.8-доп Интеграции

- **Модуль 2 (Проекты):** Ганта-представление привязано к проекту; даты проекта определяют границы диаграммы
- **Модуль 3 (Сметы):** Возможность импортировать разделы сметы как задачи Ганта
- **Модуль 6 (Задачи):** Задачи проекта могут отображаться на Ганте (двусторонняя привязка через `ticket_id`)
- **Модуль 11 (Закупки):** Даты поставок могут отображаться как вехи на Ганте
- **Экспорт:** XLSX (формат MS Project-совместимый), PDF (изображение диаграммы)

## 4.9.9-доп Уведомления

| Событие | Email | Push | In-app |
|---------|:-----:|:----:|:------:|
| Задача Ганта просрочена | ✅ | ✅ | ✅ |
| Приближение срока задачи (за 1 день) | ❌ | ✅ | ✅ |
| Зависимая задача задерживается | ✅ | ✅ | ✅ |
| Автопланирование завершено | ❌ | ❌ | ✅ |
| Критический путь изменился | ❌ | ❌ | ✅ |

## 4.9.10-доп Тестирование

| # | Сценарий | Шаги | Ожидаемый результат |
|---|----------|------|---------------------|
| 1 | Создание задачи Ганта | 1. Открыть Гант<br>2. «Добавить задачу»<br>3. Указать даты, длительность | Задача отображается на диаграмме |
| 2 | Создание зависимости | 1. Связать задачу A → B<br>2. Тип FS | Стрелка отображается; B начинается после A |
| 3 | Drag & Drop перенос | 1. Перетащить задачу на диаграмме | Даты обновлены; зависимые задачи пересчитаны |
| 4 | Изменение длительности | 1. Растянуть правый край задачи | Длительность увеличена; зависимости пересчитаны |
| 5 | Автопланирование | 1. Нажать «Автопланирование»<br>2. Указать дату старта<br>3. Подтвердить | Все задачи перераспределены; конфликтов нет |
| 6 | Циклическая зависимость | 1. Создать A→B→C→A | Ошибка «Циклическая зависимость обнаружена» |
| 7 | Критический путь | 1. Создать цепочку зависимостей<br>2. Включить отображение | Критический путь выделен красным |
| 8 | Прогресс | 1. Установить progress=50% | Полоска прогресса отображается |
| 9 | Экспорт XLSX | 1. Нажать «Экспорт» | Файл со структурой задач и датами |
| 10 | 100+ задач | 1. Загрузить 100+ задач | Виртуализация работает; зум и скролл плавные |

---

# МОДУЛЬ 10: Финансы — ДОПОЛНЕНИЕ

## 4.10.7-доп Бизнес-логика и процессы

### Процесс: Создание акта выполненных работ (КС-6а)

```
┌─────────────────────┐
│  Руководитель       │
│  нажимает «Создать  │
│  акт» в проекте     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Выбор периода      │
│  (дата начала —     │
│  дата окончания)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Система загружает  │
│  позиции сметы с    │
│  объёмами           │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Пользователь       │
│  указывает факти-   │
│  чески выполненные  │
│  объёмы для каждой  │
│  позиции            │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Система рассчит.:  │
│  completed_amount = │
│  SUM(qty * price)   │
│  remaining =        │
│  estimate - total   │
│  _completed         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Проверка: объём    │──── Превышает ──→ Предупреждение
│  не превышает план? │                   «Объём превышает сметный»
└──────────┬──────────┘
           │ OK / Подтверждено
           ▼
┌─────────────────────┐
│  Создать:           │
│  - work_act         │
│  - work_act_items   │
│  Статус: draft      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Опционально:       │
│  Отправить на       │
│  согласование       │
│  (Модуль 13)        │
└─────────────────────┘
```

### Процесс: План-факт анализ

1. Плановые данные берутся из **сметы** (Модуль 3)
2. Фактические данные берутся из **актов** и **платежей**
3. Расчёт:
   ```
   budget_estimate  = SUM(estimate_resources.total_cost)       — План по смете
   budget_actual    = SUM(work_act_items.completed_amount)     — Факт выполнения
   budget_deviation = budget_estimate - budget_actual           — Отклонение
   budget_percent   = (budget_actual / budget_estimate) * 100  — % выполнения
   
   payments_planned = SUM(payments WHERE type='planned')
   payments_actual  = SUM(payments WHERE type='actual' AND status='completed')
   cashflow_diff    = payments_actual - payments_planned
   ```

### Процесс: Cashflow

Cashflow строится по месяцам:
```
Для каждого месяца M:
  inflow[M]  = SUM(payments WHERE direction='incoming' AND month=M AND status='completed')
  outflow[M] = SUM(payments WHERE direction='outgoing' AND month=M AND status='completed')
  balance[M] = balance[M-1] + inflow[M] - outflow[M]
```

Прогноз на основе незавершённых платежей:
```
  planned_inflow[M]  = SUM(payments WHERE direction='incoming' AND month=M AND status='planned')
  planned_outflow[M] = SUM(payments WHERE direction='outgoing' AND month=M AND status='planned')
```

## 4.10.8-доп Интеграции

- **Модуль 2 (Проекты):** Финансовая сводка в карточке проекта (бюджет, факт, отклонение)
- **Модуль 3 (Сметы):** Плановые суммы берутся из итогов сметы
- **Модуль 4 (Офферы):** При принятии КП создаётся плановый входящий платёж
- **Модуль 5 (Контрагенты):** Контрагент = плательщик/получатель в платежах
- **Модуль 11 (Закупки):** Оплата заказов поставщикам создаёт исходящие платежи
- **Модуль 12 (Отчёты):** Финансовые данные доступны для конструктора отчётов
- **Модуль 13 (Согласования):** Акты и крупные платежи могут требовать согласования

## 4.10.9-доп Уведомления

| Событие | Email | Push | In-app |
|---------|:-----:|:----:|:------:|
| Платёж создан | ❌ | ❌ | ✅ |
| Платёж просрочен | ✅ | ✅ | ✅ |
| Приближение даты платежа (3 дня) | ✅ | ✅ | ✅ |
| Акт создан | ❌ | ❌ | ✅ |
| Акт согласован | ✅ | ✅ | ✅ |
| Акт отклонён | ✅ | ✅ | ✅ |
| Бюджет проекта превышен на >10% | ✅ | ✅ | ✅ |
| Cashflow — отрицательный баланс | ✅ | ✅ | ✅ |

**Шаблон email "Бюджет превышен":**
```
Тема: ⚠️ Бюджет проекта «{project_name}» превышен

Здравствуйте, {first_name}!

Фактические затраты по проекту «{project_name}» превысили плановые:

Бюджет по смете: {budget_estimate} ₽
Фактические затраты: {budget_actual} ₽
Превышение: {budget_deviation} ₽ ({deviation_percent}%)

Рекомендуем проверить расходы и скорректировать план.

Перейти к финансам проекта:
{finance_url}

С уважением,
Команда ElektroSmeta
```

## 4.10.10-доп Тестирование

| # | Сценарий | Шаги | Ожидаемый результат |
|---|----------|------|---------------------|
| 1 | Создание входящего платежа | 1. Открыть финансы<br>2. «Добавить платёж»<br>3. Тип: входящий<br>4. Сохранить | Платёж создан, отображается в списке |
| 2 | Создание акта | 1. «Создать акт»<br>2. Указать период<br>3. Заполнить объёмы<br>4. Сохранить | Акт создан, итоги рассчитаны |
| 3 | Превышение объёма | 1. В акте указать объём > сметного | Предупреждение о превышении |
| 4 | План-факт | 1. Открыть «План-факт»<br>2. Проверить таблицу | Плановые и фактические суммы корректны |
| 5 | Cashflow | 1. Открыть «Cashflow»<br>2. Проверить график по месяцам | График корректный, прогноз отображается |
| 6 | Фильтрация платежей | 1. Фильтр по типу, статусу, периоду | Показаны только подходящие платежи |
| 7 | Экспорт | 1. Экспортировать финансовый отчёт | XLSX/PDF скачан |
| 8 | Отрицательный баланс | 1. Создать расходы, превышающие доходы | Уведомление об отрицательном балансе |

---

# МОДУЛЬ 11: Закупки и склад — ДОПОЛНЕНИЕ

## 4.11.2-доп Роли и права доступа

| Действие | Владелец | Администратор | Рук. проектов | Сметчик | Прораб | Субподр. | Наблюд. | Бухгалтер |
|----------|:--------:|:-------------:|:-------------:|:-------:|:------:|:--------:|:-------:|:---------:|
| Создание заявки на ресурсы | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Утверждение заявки | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Создание заказа поставщику | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Просмотр заказов | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Оприходование на склад | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Списание со склада | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Просмотр остатков | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Инвентаризация | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

## 4.11.5-доп Frontend - Интерфейс

### Страница: Заявки на ресурсы

**URL:** `/projects/{id}/procurement/requests`

**Wireframe:**
```
┌──────────────────────────────────────────────────────────────────┐
│  Заявки на ресурсы                          [+ Создать заявку]  │
├──────────────────────────────────────────────────────────────────┤
│  Статус: [Все ▼]   Период: [01.01 — 31.01]                     │
├────┬──────────┬──────────────────┬──────────┬──────────┬────────┤
│ #  │ Номер    │ Содержание       │ Сумма    │ Статус   │ Автор  │
├────┼──────────┼──────────────────┼──────────┼──────────┼────────┤
│ 1  │ ЗР-001   │ Кабель ВВГнг 3x2│ 180 000₽ │ 🟡 Новая │ СИА   │
│ 2  │ ЗР-002   │ Автоматы ABB     │ 95 000₽  │ 🟢 Утв.  │ ИПС   │
│ 3  │ ЗР-003   │ Щиты распред.    │ 320 000₽ │ 🔴 Откл. │ СИА   │
└────┴──────────┴──────────────────┴──────────┴──────────┴────────┘
```

### Страница: Заказы поставщикам

**URL:** `/projects/{id}/procurement/orders`

**Wireframe:**
```
┌──────────────────────────────────────────────────────────────────┐
│  Заказы поставщикам                         [+ Создать заказ]   │
├────┬──────────┬──────────────┬──────────┬──────────┬────────────┤
│ #  │ Номер    │ Поставщик    │ Сумма    │ Статус   │ Доставка   │
├────┼──────────┼──────────────┼──────────┼──────────┼────────────┤
│ 1  │ ЗП-001   │ ООО Электро  │ 180 000₽ │ 🟡 Заказ │ 15.02.2026 │
│ 2  │ ЗП-002   │ ИП Кабельщик │ 95 000₽  │ 🟢 Дост. │ 10.02.2026 │
└────┴──────────┴──────────────┴──────────┴──────────┴────────────┘
```

### Страница: Складские остатки

**URL:** `/projects/{id}/procurement/warehouse`

**Wireframe:**
```
┌──────────────────────────────────────────────────────────────────┐
│  Склад проекта                    [Оприходование] [Списание]   │
├──────────────────────────────────────────────────────────────────┤
│  🔍 Поиск по наименованию...                                   │
├────┬──────────────────┬──────┬──────────┬──────────┬────────────┤
│ #  │ Наименование     │ Ед.  │ Остаток  │ По смете │ Расход     │
├────┼──────────────────┼──────┼──────────┼──────────┼────────────┤
│ 1  │ Кабель ВВГнг 3x2 │ м    │ 500      │ 1500     │ 1000       │
│ 2  │ Автомат ABB 16A  │ шт   │ 20       │ 50       │ 30         │
│ 3  │ Гофротруба 20мм  │ м    │ 0 ⚠️     │ 800      │ 800        │
└────┴──────────────────┴──────┴──────────┴──────────┴────────────┘
│  ⚠️ — позиции с нулевым остатком                                │
```

**Элементы формы заявки:**

| Элемент | Тип | Поведение | Валидация |
|---------|-----|-----------|-----------|
| Номер | Auto-generated | ЗР-{порядковый} | readonly |
| Позиции | Таблица inline | Добавление строк, выбор из справочника | min: 1 позиция |
| Наименование позиции | Select + search | Из справочника ресурсов сметы | required |
| Количество | Number input | Числовое поле | > 0 |
| Цена за единицу | Number input | Автозаполнение из последнего заказа | >= 0 |
| Срок необходимости | Date picker | Дата нужности | >= today |
| Комментарий | Textarea | Пояснение | max: 2000 |

## 4.11.6-доп Бизнес-логика и процессы

### Процесс: Цикл закупки

```
┌─────────────────────┐
│  Прораб создаёт     │
│  заявку на ресурсы  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Заявка: Новая      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Рук. проектов      │
│  проверяет:         │
│  - Есть ли на       │
│    складе?          │
│  - В рамках         │
│    бюджета?         │
└──────────┬──────────┘
           │
           ├──── Отклонить ──→ Статус: Отклонена
           │
           ▼ Утвердить
┌─────────────────────┐
│  Заявка: Утверждена │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Создать заказ      │
│  поставщику         │
│  (выбрать из базы   │
│  контрагентов)      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Заказ: Создан      │
│  ──→ Отправлен      │
│  ──→ Доставлен      │
│  (ручная смена      │
│  статуса)           │
└──────────┬──────────┘
           │ Доставлен
           ▼
┌─────────────────────┐
│  Оприходование      │
│  на склад           │
│  (увеличить остаток)│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Списание           │
│  (при использовании │
│  на объекте)        │
└─────────────────────┘
```

### Контроль бюджета при утверждении заявки:
```
budget_estimate  = Итог сметы по данному ресурсу (плановая стоимость)
budget_spent     = SUM(утверждённые заявки + оплаченные заказы) по ресурсу
budget_remaining = budget_estimate - budget_spent
request_amount   = Сумма текущей заявки

Если request_amount > budget_remaining:
  → Предупреждение: «Заявка на {request_amount}₽ превышает остаток бюджета ({budget_remaining}₽)»
  → Утверждающий может подтвердить или отклонить
```

### Складской учёт:
```
Текущий остаток = SUM(оприходования) - SUM(списания)

При списании: проверить остаток >= количество списания
При оприходовании: увеличить остаток
Auto-write-off (если включено в проекте): при создании акта выполненных работ автоматически списываются ресурсы
```

## 4.11.7-доп Интеграции

- **Модуль 3 (Сметы):** Плановые объёмы ресурсов берутся из сметы; позиции заявок привязаны к ресурсам сметы
- **Модуль 5 (Контрагенты):** Поставщики выбираются из базы контрагентов
- **Модуль 9 (Гант):** Даты поставок отображаются как вехи
- **Модуль 10 (Финансы):** При оплате заказа автоматически создаётся исходящий платёж

## 4.11.8-доп Уведомления

| Событие | Email | Push | In-app |
|---------|:-----:|:----:|:------:|
| Заявка создана (руководителю) | ✅ | ✅ | ✅ |
| Заявка утверждена | ✅ | ✅ | ✅ |
| Заявка отклонена | ✅ | ✅ | ✅ |
| Заказ доставлен | ✅ | ✅ | ✅ |
| Остаток ресурса = 0 | ✅ | ✅ | ✅ |
| Остаток ресурса < 10% от сметного | ❌ | ✅ | ✅ |
| Бюджет по ресурсу превышен | ✅ | ✅ | ✅ |

## 4.11.9-доп Тестирование

| # | Сценарий | Шаги | Ожидаемый результат |
|---|----------|------|---------------------|
| 1 | Создание заявки | 1. Нажать «Создать заявку»<br>2. Добавить позиции<br>3. Сохранить | Заявка создана, уведомление руководителю |
| 2 | Утверждение заявки | 1. Открыть заявку<br>2. Нажать «Утвердить» | Статус = Утверждена, уведомление автору |
| 3 | Отклонение заявки | 1. Открыть заявку<br>2. «Отклонить» + причина | Статус = Отклонена с комментарием |
| 4 | Создание заказа | 1. Из утверждённой заявки<br>2. «Создать заказ»<br>3. Выбрать поставщика | Заказ создан, привязан к заявке |
| 5 | Оприходование | 1. Заказ доставлен<br>2. «Оприходовать»<br>3. Указать количество | Остатки увеличены |
| 6 | Списание | 1. «Списать»<br>2. Выбрать ресурс<br>3. Указать количество | Остатки уменьшены |
| 7 | Списание > остатка | 1. Указать количество > остатка | Ошибка «Недостаточно остатков» |
| 8 | Контроль бюджета | 1. Создать заявку, превышающую бюджет | Предупреждение о превышении |
| 9 | Отчёт по остаткам | 1. Открыть склад<br>2. Проверить остатки | Данные соответствуют оприходованиям - списаниям |

---

# МОДУЛЬ 13: Согласования — ДОПОЛНЕНИЕ

## 4.13.6-доп Бизнес-логика и процессы

### Процесс: Многоэтапное согласование

```
┌─────────────────────┐
│  Инициатор создаёт  │
│  запрос на          │
│  согласование       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Выбор шаблона      │
│  workflow (или      │
│  создание ad-hoc)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Статус: pending     │
│  current_step = 1   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Уведомление        │
│  согласантам шага 1 │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────────┐
│  Шаг N:                                     │
│                                              │
│  require_all = true:                         │
│    ВСЕ согласанты должны утвердить           │
│                                              │
│  require_all = false:                        │
│    ЛЮБОЙ может утвердить                     │
│                                              │
│  Действия согласанта:                        │
│  - Утвердить (approved)                      │
│  - Отклонить (rejected) → завершение         │
│  - Вернуть на доработку (returned) → шаг 1   │
│  - Делегировать (delegated) → другому        │
└────────────────────┬────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
   Утвердить    Отклонить    Вернуть
        │            │            │
        ▼            ▼            ▼
   current_     status =     current_
   step++       rejected     step = 1
        │                         │
        │                         ▼
        │                    Уведомить
        │                    инициатора
        ▼
┌───────────────┐
│  Следующий    │
│  шаг есть?    │
├───────┬───────┤
│ Да    │ Нет   │
└───┬───┘   └───┘
    │           │
    ▼           ▼
 Уведомить   status =
 шага N+1    approved
             completed_at
```

### Правила делегирования:
1. Согласант может делегировать только пользователям своего проектного уровня или выше
2. Делегированный получает уведомление
3. Первоначальный согласант видит статус «Делегировано {user}»
4. Делегировать можно только один раз (нет цепочки делегирований)

### Таймауты и напоминания:
```
Если due_date установлен:
  - За 24 часа до: напоминание согласантам текущего шага
  - После истечения: уведомление инициатору «Согласование просрочено»
  - Автоотклонение (опционально, в шаблоне): auto_reject_on_timeout = true
```

## 4.13.7-доп Интеграции

- **Модуль 3 (Сметы):** Смета может быть отправлена на согласование (entity_type = 'estimate')
- **Модуль 4 (Офферы):** КП может требовать согласования перед отправкой клиенту
- **Модуль 10 (Финансы):** Акты и крупные платежи (>порога) требуют согласования
- **Модуль 8 (DMS):** Документы могут быть объектами согласования

## 4.13.8-доп Тестирование

| # | Сценарий | Шаги | Ожидаемый результат |
|---|----------|------|---------------------|
| 1 | Создание шаблона workflow | 1. Настройки<br>2. «Создать шаблон»<br>3. Добавить шаги и согласантов | Шаблон создан |
| 2 | Инициирование согласования | 1. Открыть смету<br>2. «На согласование»<br>3. Выбрать шаблон | Запрос создан, уведомления отправлены |
| 3 | Утверждение (один шаг) | 1. Согласант открывает запрос<br>2. «Утвердить» | Запрос одобрен, уведомление инициатору |
| 4 | Многоэтапное — все шаги | 1. Шаг 1: утвердить<br>2. Шаг 2: утвердить | Запрос финально одобрен |
| 5 | Отклонение | 1. Согласант «Отклонить» + причина | Запрос отклонён, уведомление инициатору |
| 6 | Возврат на доработку | 1. Согласант «Вернуть» + комментарий | Шаг сброшен на 1, уведомление |
| 7 | Делегирование | 1. «Делегировать» + выбрать пользователя | Делегирование выполнено |
| 8 | Просроченное согласование | 1. Установить due_date в прошлом | Уведомление о просрочке |
| 9 | require_all = true | 1. Шаг с 3 согласантами<br>2. Только 2 утвердили | Шаг не завершён, ожидание 3-го |
| 10 | require_all = false | 1. Шаг с 3 согласантами<br>2. 1 утвердил | Шаг завершён, переход к следующему |

---

# МОДУЛЬ 14: Настройки и интеграции — ДОПОЛНЕНИЕ

## 4.14.2-доп Роли и права доступа

| Действие | Суперадмин | Владелец | Администратор | Все остальные |
|----------|:----------:|:--------:|:-------------:|:-------------:|
| Настройки профиля (свои) | ✅ | ✅ | ✅ | ✅ |
| 2FA (свой аккаунт) | ✅ | ✅ | ✅ | ✅ |
| Управление сессиями (свои) | ✅ | ✅ | ✅ | ✅ |
| Настройки уведомлений (свои) | ✅ | ✅ | ✅ | ✅ |
| Настройки компании | ✅ | ✅ | ✅ | ❌ |
| Реквизиты компании | ✅ | ✅ | ✅ | ❌ |
| Логотип | ✅ | ✅ | ✅ | ❌ |
| Рабочие дни/праздники | ✅ | ✅ | ✅ | ❌ |
| Шаблоны документов | ✅ | ✅ | ✅ | ❌ |
| Управление интеграциями | ✅ | ✅ | ❌ | ❌ |
| Вебхуки | ✅ | ✅ | ❌ | ❌ |
| Управление ролями | ✅ | ✅ | ✅ | ❌ |

## 4.14.6-доп Бизнес-логика и процессы

### Процесс: Настройка 2FA (TOTP)

```
┌─────────────────────┐
│  Пользователь       │
│  включает 2FA       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Сервер генерирует  │
│  TOTP secret (32    │
│  символа, base32)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Показать QR-код    │
│  (otpauth://totp/   │
│  ElektroSmeta:email │
│  ?secret=XXX&       │
│  issuer=ElektroSm.) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Пользователь       │
│  сканирует QR в     │
│  приложении (Google │
│  Authenticator,     │
│  Authy)             │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Ввести код         │
│  подтверждения (6   │
│  цифр)              │
└──────────┬──────────┘
           │
           ├──── Неверный ──→ Ошибка «Неверный код»
           │
           ▼ Верный
┌─────────────────────┐
│  Сохранить          │
│  encrypted secret   │
│  в users.           │
│  two_factor_secret  │
│                     │
│  Показать backup    │
│  codes (10 штук)    │
│  для восстановления │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  two_factor_enabled │
│  = true             │
└─────────────────────┘
```

### Процесс: Настройка вебхуков

1. Пользователь добавляет URL вебхука
2. Система отправляет тестовый запрос (`POST {url}` с `{"event": "webhook.test", "timestamp": "..."}`)
3. Если ответ 2xx — вебхук подтверждён
4. Выбор событий: `project.created`, `ticket.created`, `ticket.status_changed`, `offer.sent`, `payment.created`
5. При каждом событии: `POST {url}` с `{"event": "...", "data": {...}, "timestamp": "...", "signature": "hmac-sha256"}`
6. Retry policy: 3 попытки с экспоненциальным backoff (1с, 5с, 30с)
7. После 3 неудач — вебхук деактивируется, уведомление администратору

## 4.14.7-доп Интеграции

- **DaData API:** Для автозаполнения реквизитов компании по ИНН
- **SendGrid / MailGun:** Настройка email-провайдера (API-ключ, sender email)
- **Google Calendar / Outlook:** OAuth-подключение для синхронизации задач и дедлайнов
- **Telegram Bot (будущее):** Уведомления через Telegram
- **Все модули:** Настройки компании (валюта, рабочие дни) влияют на все модули системы

## 4.14.8-доп Уведомления

| Событие | Email | Push | In-app |
|---------|:-----:|:----:|:------:|
| Пароль изменён | ✅ | ❌ | ✅ |
| 2FA включена/выключена | ✅ | ❌ | ✅ |
| Сессия с нового устройства | ✅ | ✅ | ✅ |
| Вебхук деактивирован | ✅ | ❌ | ✅ |
| Лимит тарифа приближается | ✅ | ✅ | ✅ |

## 4.14.9-доп Тестирование

| # | Сценарий | Шаги | Ожидаемый результат |
|---|----------|------|---------------------|
| 1 | Изменение профиля | 1. Настройки → Профиль<br>2. Изменить ФИО<br>3. Сохранить | Данные обновлены |
| 2 | Загрузка аватара | 1. Нажать на аватар<br>2. Выбрать изображение | Аватар загружен, отображается |
| 3 | Смена пароля | 1. Ввести текущий пароль<br>2. Ввести новый (2 раза)<br>3. Подтвердить | Пароль изменён, email-уведомление |
| 4 | Включение 2FA | 1. Включить 2FA<br>2. Сканировать QR<br>3. Ввести код | 2FA включена, backup-коды показаны |
| 5 | Вход с 2FA | 1. Ввести email/пароль<br>2. Ввести TOTP-код | Успешный вход |
| 6 | Неверный 2FA код | 1. Ввести неверный код 5 раз | Аккаунт временно заблокирован (15 мин) |
| 7 | Реквизиты компании | 1. Заполнить ИНН<br>2. Автозаполнение из DaData<br>3. Сохранить | Реквизиты сохранены |
| 8 | Загрузка логотипа | 1. Загрузить PNG | Логотип отображается в шапке, документах |
| 9 | Настройка вебхука | 1. Добавить URL<br>2. Тестовый запрос | Тест пройден, вебхук активен |
| 10 | Управление сессиями | 1. Посмотреть активные сессии<br>2. Завершить стороннюю сессию | Сессия завершена |

---

# МОДУЛЬ 15: Биллинг (SaaS) — ДОПОЛНЕНИЕ

## 4.15.2-доп Роли и права доступа

| Действие | Суперадмин | Владелец | Администратор | Бухгалтер | Все остальные |
|----------|:----------:|:--------:|:-------------:|:---------:|:-------------:|
| Просмотр текущего тарифа | ✅ | ✅ | ✅ | ✅ | ✅ (базово) |
| Смена тарифа | ✅ | ✅ | ❌ | ❌ | ❌ |
| Просмотр счетов | ✅ | ✅ | ✅ | ✅ | ❌ |
| Оплата | ✅ | ✅ | ❌ | ❌ | ❌ |
| Управление платёжными методами | ✅ | ✅ | ❌ | ❌ | ❌ |
| Отмена подписки | ✅ | ✅ | ❌ | ❌ | ❌ |
| Управление тарифами (платформа) | ✅ | ❌ | ❌ | ❌ | ❌ |

## 4.15.7-доп Бизнес-логика и процессы

### Процесс: Смена тарифного плана

```
┌─────────────────────┐
│  Владелец нажимает  │
│  «Сменить тариф»    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Показать тарифы с  │
│  текущим выделенным │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Проверка:          │
│  - Повышение или    │
│    понижение?       │
│  - Текущее          │
│    использование    │
│    ≤ лимитов нового │
│    тарифа?          │
└──────────┬──────────┘
           │
           ├──── Понижение, превышены лимиты ──→
           │     «Удалите {N} пользователей /
           │     проектов для перехода»
           │
           ▼
┌─────────────────────┐
│  Повышение:         │
│  - Пропорциональный │
│    расчёт за        │
│    остаток периода  │
│  - Разница = новая  │
│    цена * дни/30 —  │
│    оплаченная цена  │
│    * дни/30         │
│                     │
│  Понижение:         │
│  - Вступает с       │
│    начала следующего│
│    периода          │
│  - Кредит за        │
│    остаток          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Подтверждение:     │
│  «Вы переходите с   │
│  "{old}" на "{new}" │
│  Доплата: {amount}  │
│  или                │
│  Вступит в силу:    │
│  {next_period_date} │
│  »                  │
└──────────┬──────────┘
           │ Подтвердить
           ▼
┌─────────────────────┐
│  Создать invoice    │
│  (если доплата)     │
│  Обновить           │
│  subscription       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Email-уведомление  │
│  «Тариф изменён»   │
└─────────────────────┘
```

### Проверка лимитов (при каждом действии):
```
function checkLimit(company_id, resource_type):
  subscription = getActiveSubscription(company_id)
  plan = subscription.billing_plan
  
  current_usage = count(resource_type WHERE company_id)
  max_allowed = plan.limits[resource_type]  // max_users, max_projects, max_storage_gb
  
  if max_allowed IS NULL: return OK  // безлимит
  if current_usage >= max_allowed:
    throw LimitExceededError("Достигнут лимит {resource_type}: {current_usage}/{max_allowed}. Обновите тариф.")
  return OK
```

### Freemium-модель:
- Бесплатный тариф: 2 пользователя, 3 проекта, 1 GB хранилища
- При достижении лимита: модальное окно «Обновите тариф для продолжения»
- Grace period: 7 дней после истечения подписки (чтение, без создания)
- После grace period: только экспорт данных

### Автопродление:
```
CRON: ежедневно в 00:00 UTC
  Для каждой подписки WHERE current_period_end <= NOW() AND auto_renew = true:
    1. Создать invoice
    2. Попытаться списать с привязанной карты
    3. Если успешно → обновить current_period_end
    4. Если ошибка → retry через 24ч (3 попытки)
    5. После 3 неудач → подписка = past_due, уведомление
    6. Через 7 дней past_due → подписка = cancelled
```

## 4.15.8-доп Интеграции

- **Платёжные системы:** ЮKassa / Stripe для приёма платежей (карты, СБП)
- **Модуль 1 (Ядро):** Проверка лимитов тарифа при создании пользователей, проектов
- **Модуль 2 (Проекты):** Проверка лимита проектов при создании
- **Модуль 8 (DMS):** Проверка лимита хранилища при загрузке файлов
- **Email:** Отправка счетов и квитанций через SendGrid

## 4.15.9-доп Тестирование

| # | Сценарий | Шаги | Ожидаемый результат |
|---|----------|------|---------------------|
| 1 | Просмотр тарифов | 1. Настройки → Биллинг | Текущий тариф выделен, все планы видны |
| 2 | Повышение тарифа | 1. Выбрать тариф выше<br>2. Подтвердить оплату | Тариф обновлён, доплата списана |
| 3 | Понижение тарифа | 1. Выбрать тариф ниже<br>2. Подтвердить | Изменение запланировано на след. период |
| 4 | Понижение с превышением лимитов | 1. 5 пользователей<br>2. Выбрать тариф на 3 | Ошибка «Удалите 2 пользователей» |
| 5 | Достижение лимита проектов | 1. Создать max_projects + 1 | Модальное окно «Обновите тариф» |
| 6 | Достижение лимита хранилища | 1. Загрузить файл, превышающий лимит | Ошибка «Хранилище заполнено» |
| 7 | Автопродление | 1. Дождаться конца периода | Подписка автоматически продлена |
| 8 | Неудачная оплата | 1. Привязать истёкшую карту<br>2. Дождаться автопродления | 3 попытки, статус = past_due |
| 9 | Grace period | 1. Не оплатить 7 дней | Доступ только на чтение |
| 10 | Отмена подписки | 1. «Отменить подписку»<br>2. Подтвердить | Подписка активна до конца периода |

---

# 6. МИГРАЦИЯ ДАННЫХ

## 6.1 Общие принципы

Миграция данных предусматривается для случая перехода пользователей с предыдущей версии ElektroSmeta или импорта данных из внешних систем.

## 6.2 Типы миграций

### 6.2.1 Миграция из ElektroSmeta v1 (если применимо)

| Данные | Источник | Целевая таблица | Особенности |
|--------|----------|-----------------|-------------|
| Пользователи | users_v1 | users | Хеши паролей: bcrypt → сохранить as-is |
| Проекты | projects_v1 | projects | Статусы: маппинг v1→v2 |
| Сметы | estimates_v1 | estimate_stages + estimate_tasks + estimate_resources | Плоская структура → иерархия |
| Справочники | catalogs_v1 | price_catalogs + price_catalog_items | Иерархия сохраняется |
| Контрагенты | clients_v1 | contractors | Типизация: все → юр.лица |

### 6.2.2 Импорт из XLSX/CSV

Система поддерживает импорт:
- **Контрагентов** — из XLSX с колонками: Наименование, ИНН, КПП, Адрес, Телефон, Email
- **Справочников** — из CSV с колонками: Код, Наименование, Единица, Цена
- **Пользователей** — из CSV с колонками: ФИО, Email, Роль

## 6.3 Скрипт миграции (структура)

```sql
-- ============================================
-- МИГРАЦИЯ ДАННЫХ ElektroSmeta v1 → v2
-- ============================================

-- 1. Предварительная проверка
DO $$
BEGIN
    -- Проверить существование таблиц v1
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users_v1') THEN
        RAISE EXCEPTION 'Таблица users_v1 не найдена. Миграция отменена.';
    END IF;
END $$;

-- 2. Создать временные таблицы маппинга ID
CREATE TEMPORARY TABLE id_mapping_users (
    old_id INTEGER,
    new_id UUID
);

CREATE TEMPORARY TABLE id_mapping_projects (
    old_id INTEGER,
    new_id UUID
);

-- 3. Миграция компании (если не существует)
INSERT INTO companies (id, name, created_at)
SELECT gen_random_uuid(), 'Компания по умолчанию', NOW()
WHERE NOT EXISTS (SELECT 1 FROM companies LIMIT 1)
RETURNING id;

-- 4. Миграция пользователей
INSERT INTO users (id, email, first_name, last_name, password_hash, created_at)
SELECT
    gen_random_uuid(),
    v1.email,
    SPLIT_PART(v1.full_name, ' ', 2),  -- Имя
    SPLIT_PART(v1.full_name, ' ', 1),  -- Фамилия
    v1.password_hash,                   -- bcrypt, переносим as-is
    v1.created_at
FROM users_v1 v1
ON CONFLICT (email) DO NOTHING;

-- Сохранить маппинг
INSERT INTO id_mapping_users (old_id, new_id)
SELECT v1.id, u.id
FROM users_v1 v1
JOIN users u ON u.email = v1.email;

-- 5. Миграция проектов
INSERT INTO projects (id, company_id, name, description, status, created_by_id, created_at)
SELECT
    gen_random_uuid(),
    (SELECT id FROM companies LIMIT 1),
    v1.name,
    v1.description,
    CASE v1.status
        WHEN 'active' THEN 'active'
        WHEN 'done' THEN 'completed'
        WHEN 'archived' THEN 'archived'
        ELSE 'active'
    END,
    m.new_id,
    v1.created_at
FROM projects_v1 v1
LEFT JOIN id_mapping_users m ON m.old_id = v1.creator_id;

-- Сохранить маппинг проектов
INSERT INTO id_mapping_projects (old_id, new_id)
SELECT v1.id, p.id
FROM projects_v1 v1
JOIN projects p ON p.name = v1.name;

-- 6. Миграция смет (плоская → иерархическая)
-- Для каждого проекта создать корневой раздел
INSERT INTO estimate_stages (id, project_id, name, sort_order, created_at)
SELECT
    gen_random_uuid(),
    mp.new_id,
    'Основные работы',
    1,
    NOW()
FROM id_mapping_projects mp;

-- Перенести позиции сметы как задачи (tasks) в разделе
-- [Детализировать в зависимости от структуры v1]

-- 7. Миграция контрагентов
INSERT INTO contractors (id, company_id, contractor_type, type, name, inn, phone, email, created_at)
SELECT
    gen_random_uuid(),
    (SELECT id FROM companies LIMIT 1),
    2,  -- юр.лицо
    CASE v1.category WHEN 'customer' THEN 10 WHEN 'supplier' THEN 20 ELSE 10 END,
    v1.name,
    v1.inn,
    v1.phone,
    v1.email,
    v1.created_at
FROM clients_v1 v1;

-- 8. Валидация
DO $$
DECLARE
    v_users_count INTEGER;
    v_projects_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_users_count FROM id_mapping_users;
    SELECT COUNT(*) INTO v_projects_count FROM id_mapping_projects;
    
    RAISE NOTICE 'Мигрировано: % пользователей, % проектов', v_users_count, v_projects_count;
    
    -- Проверки целостности
    IF v_users_count = 0 THEN
        RAISE WARNING 'Не мигрировано ни одного пользователя!';
    END IF;
END $$;

-- 9. Очистка
DROP TABLE IF EXISTS id_mapping_users;
DROP TABLE IF EXISTS id_mapping_projects;
```

## 6.4 План отката

```sql
-- ============================================
-- ОТКАТ МИГРАЦИИ
-- ============================================

-- ВНИМАНИЕ: Откат удаляет ВСЕ данные, созданные миграцией!
-- Выполнять только если миграция завершилась с ошибками.

BEGIN;

-- Удалить данные в обратном порядке зависимостей
DELETE FROM estimate_resources WHERE created_at >= '{migration_timestamp}';
DELETE FROM estimate_tasks WHERE created_at >= '{migration_timestamp}';
DELETE FROM estimate_stages WHERE created_at >= '{migration_timestamp}';
DELETE FROM contractors WHERE created_at >= '{migration_timestamp}';
DELETE FROM project_members WHERE created_at >= '{migration_timestamp}';
DELETE FROM projects WHERE created_at >= '{migration_timestamp}';
DELETE FROM company_users WHERE created_at >= '{migration_timestamp}';
DELETE FROM users WHERE created_at >= '{migration_timestamp}';
-- Компанию НЕ удаляем (могла существовать до миграции)

COMMIT;
```

## 6.5 Рекомендации

1. **Перед миграцией:** Полный backup базы данных (pg_dump)
2. **Среда:** Сначала запуск на staging, проверка, затем production
3. **Downtime:** Миграция выполняется в окне обслуживания (ночь, выходные)
4. **Валидация:** После миграции проверить:
   - Количество записей совпадает
   - Все связи (FK) корректны
   - Пользователи могут войти
   - Сметы отображаются корректно
5. **Логирование:** Все операции миграции записываются в отдельную таблицу `migration_log`

---

# СВОДНАЯ ТАБЛИЦА ПОЛНОТЫ ДОКУМЕНТА

После объединения основных файлов и данного дополнения, все модули покрывают следующие секции:

| Модуль | Описание | Роли | БД | API | Frontend | Бизнес-логика | Интеграции | Уведомления | Тестирование | Критерии |
|--------|:--------:|:----:|:--:|:---:|:--------:|:-------------:|:----------:|:-----------:|:------------:|:--------:|
| 1. Ядро | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 2. Проекты | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅* | ✅* | ✅* | ✅ |
| 3. Сметы | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅* | ✅ |
| 4. Офферы | ✅ | ✅* | ✅ | ✅ | ✅ | ✅* | ✅* | ✅* | ✅* | ✅ |
| 5. Контрагенты | ✅ | ✅* | ✅ | ✅ | ✅* | ✅* | ✅* | ✅* | ✅* | ✅ |
| 6. Задачи | ✅ | ✅* | ✅ | ✅ | ✅ | ✅* | ✅* | ✅* | ✅* | ✅ |
| 7. Чертежи | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅* | ✅* | ✅ |
| 8. DMS | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅* | ✅ | ✅* | ✅ |
| 9. Гант | ✅ | ✅ | ✅ | ✅ | ✅ | ✅* | ✅* | ✅* | ✅* | ✅ |
| 10. Финансы | ✅ | ✅ | ✅ | ✅ | ✅ | ✅* | ✅* | ✅* | ✅* | ✅ |
| 11. Закупки | ✅ | ✅* | ✅ | ✅ | ✅* | ✅* | ✅* | ✅* | ✅* | ✅ |
| 12. Отчёты | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 13. Согласования | ✅ | ✅ | ✅ | ✅ | ✅ | ✅* | ✅* | ✅ | ✅* | ✅ |
| 14. Настройки | ✅ | ✅* | ✅ | ✅ | ✅ | ✅* | ✅* | ✅* | ✅* | ✅ |
| 15. Биллинг | ✅ | ✅* | ✅ | ✅ | ✅ | ✅* | ✅* | ✅ | ✅* | ✅ |

> ✅* — секция добавлена в настоящем дополнении

---

**Конец дополнения**

*Документ является частью пакета ТЗ ElektroSmeta v2.0*  
*Версия: 2.0.2 | Дата: 07.02.2026*
