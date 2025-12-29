
# MaxMaster Skills Platform

Система управления навыками и вознаграждениями для MaxMaster Sp. z o.o.

## Технологии
- **React 19** (через CDN)
- **Tailwind CSS**
- **Lucide React** (иконки)
- **Recharts** (графики)
- **Google Gemini API** (AI функции)

## Как запустить локально
Так как проект использует [ES Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) и `importmap`, его **нельзя** просто открыть как файл `index.html`. Вам нужен локальный сервер.

1. Установите расширение **Live Server** в VS Code или используйте любой другой статический сервер.
2. Запустите сервер из корневой директории проекта.
3. Откройте `http://127.0.0.1:5500` (или ваш порт).

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
