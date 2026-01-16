
# MaxMaster Skills Platform

Система управления навыками и вознаграждениями для MaxMaster Sp. z o.o.

## Технологии
- **React 19** (через CDN)
- **Tailwind CSS**
- **Lucide React** (иконки)
- **Recharts** (графики)
- **Google Gemini API** (AI функции)
- **Supabase** (база данных и аутентификация)

## Как запустить локально
Так как проект использует [ES Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) и `importmap`, его **нельзя** просто открыть как файл `index.html`. Вам нужен локальный сервер.

1. Установите расширение **Live Server** в VS Code или используйте любой другой статический сервер.
2. Создайте файл `.env` на основе `.env.example` и добавьте свой Google Gemini API ключ.
3. Запустите сервер из корневой директории проекта.
4. Откройте `http://127.0.0.1:5500` (или ваш порт).

## Конфигурация AI (обязательно для production)

Парсинг CV через AI работает через **Supabase Edge Function** для безопасности.

### Быстрая настройка:

1. **Получите Google Gemini API ключ:**
   - Перейдите на https://ai.google.dev/
   - Нажмите "Get API key" и создайте ключ

2. **Добавьте ключ в Supabase:**
   ```bash
   # Через Supabase CLI
   supabase secrets set GEMINI_API_KEY=your_api_key_here
   ```

   Или через Dashboard: **Settings** → **Secrets** → добавьте `GEMINI_API_KEY`

3. **Задеплойте Edge Function:**
   ```bash
   supabase functions deploy parse-cv
   ```

**Подробные инструкции:** см. `supabase/functions/README.md`

Без настройки AI парсинг CV будет недоступен (можно вводить данные вручную).

## Миграции базы данных

При добавлении новых функций может потребоваться обновление схемы базы данных. Инструкции по запуску миграций находятся в `supabase/migrations/README.md`.

**Для применения последних изменений:**
1. Перейдите в [Supabase SQL Editor](https://diytvuczpciikzdhldny.supabase.co/project/diytvuczpciikzdhldny/sql/new)
2. Скопируйте содержимое файла миграции из папки `supabase/migrations/`
3. Вставьте в SQL Editor и нажмите **Run**

## Как загрузить на GitHub (Команды)

Если у вас возникли сложности с загрузкой, выполните эти шаги в терминале внутри папки проекта:

```bash
# 1. Инициализация
git init

# 2. Добавление всех файлов
git add .

# 3. Первый коммит
git commit -m "Initial commit: MaxMaster Skills Platform"

# 4. Привязка к удаленному репозиторию (замените URL на свой)
git remote add origin https://github.com/ВАШ_ЛОГИН/ВАШ_РЕПОЗИТОРИЙ.git

# 5. Переименование ветки в main (стандарт GitHub)
git branch -M main

# 6. Пуш (загрузка)
git push -u origin main
```

## Хостинг на GitHub Pages
Проект готов к работе на GitHub Pages без дополнительной сборки. Просто включите GitHub Pages в настройках репозитория (`Settings > Pages > Deploy from a branch`).
