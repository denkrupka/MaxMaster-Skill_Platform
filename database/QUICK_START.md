# MaxMaster Skills - Quick Start Guide

## 🚀 Быстрый старт

Это руководство поможет вам за 10 минут развернуть базу данных и подключить фронтенд.

---

## Шаг 1: Установка PostgreSQL

### Ubuntu/Debian
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### macOS (с Homebrew)
```bash
brew install postgresql
brew services start postgresql
```

### Windows
Скачайте установщик с https://www.postgresql.org/download/windows/

---

## Шаг 2: Создание базы данных

```bash
# Войдите как postgres пользователь
sudo -u postgres psql

# Создайте базу данных и пользователя
CREATE DATABASE maxmaster_skills;
CREATE USER maxmaster WITH ENCRYPTED PASSWORD 'your_secure_password_123';
GRANT ALL PRIVILEGES ON DATABASE maxmaster_skills TO maxmaster;
ALTER DATABASE maxmaster_skills OWNER TO maxmaster;

# Выйдите
\q
```

---

## Шаг 3: Применение схемы

```bash
# Перейдите в папку database
cd database/

# Примените схему
psql -U maxmaster -d maxmaster_skills -f schema.sql

# Загрузите начальные данные
psql -U maxmaster -d maxmaster_skills -f seed_data.sql
```

**Важно**: При запросе пароля введите `your_secure_password_123` (или тот, что вы установили)

---

## Шаг 4: Проверка установки

```bash
# Подключитесь к базе
psql -U maxmaster -d maxmaster_skills

# Проверьте таблицы
\dt

# Должно показать 20+ таблиц:
#  users
#  skills
#  user_skills
#  tests
#  questions
#  ... и т.д.

# Проверьте данные
SELECT COUNT(*) FROM users;
# Должно вернуть: 13 (пользователей)

SELECT COUNT(*) FROM skills;
# Должно вернуть: 8 (навыков)

# Проверьте логин
SELECT id, email, first_name, last_name, role FROM users LIMIT 5;

# Выйдите
\q
```

---

## Шаг 5: Настройка Backend (Node.js + Express)

### Установите зависимости

```bash
# В корне проекта
npm init -y
npm install express pg dotenv bcrypt jsonwebtoken cors
npm install --save-dev typescript @types/node @types/express ts-node nodemon
```

### Создайте файл .env

```env
# Database
DATABASE_URL=postgresql://maxmaster:your_secure_password_123@localhost:5432/maxmaster_skills
DB_HOST=localhost
DB_PORT=5432
DB_NAME=maxmaster_skills
DB_USER=maxmaster
DB_PASSWORD=your_secure_password_123

# Server
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRE=7d

# Uploads
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760
```

### Создайте файл backend/db.ts

```typescript
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export default pool;
```

### Создайте файл backend/server.ts

```typescript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Test endpoint
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      status: 'OK',
      database: 'Connected',
      timestamp: result.rows[0].now
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', error: error.message });
  }
});

// Auth endpoints
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      'SELECT id, email, first_name, last_name, role, status, password_hash FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Проверка пароля (используйте bcrypt в production)
    // const isValid = await bcrypt.compare(password, user.password_hash);

    // Для демо используем простую проверку
    const bcrypt = require('bcrypt');
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Генерация JWT токена
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Users endpoints
app.get('/api/users', async (req, res) => {
  try {
    const { role, status, search } = req.query;
    let query = 'SELECT id, email, first_name, last_name, role, status, base_rate FROM users WHERE 1=1';
    const params: any[] = [];

    if (role) {
      params.push(role);
      query += ` AND role = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (first_name ILIKE $${params.length} OR last_name ILIKE $${params.length} OR email ILIKE $${params.length})`;
    }

    const result = await pool.query(query, params);
    res.json({ data: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Skills endpoints
app.get('/api/skills', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, COUNT(us.id) as employees_count
      FROM skills s
      LEFT JOIN user_skills us ON s.id = us.skill_id AND us.status = 'confirmed'
      WHERE s.is_archived = false
      GROUP BY s.id
      ORDER BY s.category, s.name_pl
    `);
    res.json({ data: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});
```

### Создайте package.json scripts

```json
{
  "scripts": {
    "dev": "nodemon --exec ts-node backend/server.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  }
}
```

### Запустите backend

```bash
npm run dev
```

Проверьте: http://localhost:3000/api/health

---

## Шаг 6: Подключение фронтенда

### Создайте API клиент (frontend/api/client.ts)

```typescript
const API_BASE_URL = 'http://localhost:3000/api';

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  getToken() {
    if (!this.token) {
      this.token = localStorage.getItem('token');
    }
    return this.token;
  }

  async request(endpoint: string, options: RequestInit = {}) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  // Auth
  async login(email: string, password: string) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  // Users
  async getUsers(params?: { role?: string; status?: string; search?: string }) {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/users?${query}`);
  }

  async getUser(id: string) {
    return this.request(`/users/${id}`);
  }

  // Skills
  async getSkills() {
    return this.request('/skills');
  }

  // Tests
  async getTests() {
    return this.request('/tests');
  }

  async submitTest(testId: string, answers: any) {
    return this.request(`/tests/${testId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    });
  }
}

export const apiClient = new ApiClient();
```

### Обновите AppContext.tsx

```typescript
import { apiClient } from './api/client';

// Замените хардкоженные данные на API calls

const login = async (email: string, password: string) => {
  try {
    const data = await apiClient.login(email, password);
    setState(prev => ({ ...prev, currentUser: data.user }));
  } catch (error) {
    console.error('Login failed:', error);
  }
};

const getUsers = async () => {
  try {
    const data = await apiClient.getUsers();
    setState(prev => ({ ...prev, users: data.data }));
  } catch (error) {
    console.error('Failed to fetch users:', error);
  }
};
```

---

## Шаг 7: Тестирование

### Тест логина

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "employee@maxmaster.pl",
    "password": "emp123"
  }'
```

Ожидаемый ответ:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "email": "employee@maxmaster.pl",
    "first_name": "Jan",
    "last_name": "Kowalski",
    "role": "employee",
    "status": "active"
  }
}
```

### Тест получения пользователей

```bash
curl http://localhost:3000/api/users?role=employee
```

---

## 📝 Тестовые учетные записи

После загрузки seed_data.sql доступны следующие аккаунты:

| Email | Password | Role | Описание |
|-------|----------|------|----------|
| admin@maxmaster.pl | admin123 | admin | Администратор |
| hr@maxmaster.pl | hr123 | hr | HR менеджер |
| brigadir@maxmaster.pl | brig123 | brigadir | Бригадир |
| coord@maxmaster.pl | coord123 | coordinator | Координатор |
| employee@maxmaster.pl | emp123 | employee | Сотрудник (Jan) |
| newbie@maxmaster.pl | trial123 | employee | На испытательном сроке |
| marek.k@gmail.com | cand123 | candidate | Кандидат |

---

## 🔍 Полезные SQL запросы

### Посмотреть всех пользователей
```sql
SELECT id, email, first_name, last_name, role, status
FROM users
ORDER BY role, last_name;
```

### Посмотреть навыки с количеством сотрудников
```sql
SELECT s.name_pl, s.category, s.hourly_bonus,
       COUNT(us.id) FILTER (WHERE us.status = 'confirmed') as confirmed_count
FROM skills s
LEFT JOIN user_skills us ON s.id = us.skill_id
GROUP BY s.id
ORDER BY confirmed_count DESC;
```

### Посмотреть результаты тестов
```sql
SELECT u.first_name, u.last_name, t.title, ta.score, ta.passed
FROM test_attempts ta
JOIN users u ON ta.user_id = u.id
JOIN tests t ON ta.test_id = t.id
ORDER BY ta.completed_at DESC;
```

### Сбросить пароль пользователя
```sql
-- Новый пароль: "newpassword123"
UPDATE users
SET password_hash = crypt('newpassword123', gen_salt('bf'))
WHERE email = 'employee@maxmaster.pl';
```

---

## 🐛 Troubleshooting

### Проблема: Cannot connect to database

**Решение**:
```bash
# Проверьте, запущен ли PostgreSQL
sudo systemctl status postgresql

# Запустите, если не запущен
sudo systemctl start postgresql

# Проверьте подключение
psql -U maxmaster -h localhost -d maxmaster_skills
```

### Проблема: Permission denied

**Решение**:
```sql
-- Войдите как postgres
sudo -u postgres psql

-- Дайте права
GRANT ALL PRIVILEGES ON DATABASE maxmaster_skills TO maxmaster;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO maxmaster;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO maxmaster;
```

### Проблема: Password authentication failed

**Решение**:
```bash
# Отредактируйте pg_hba.conf
sudo nano /etc/postgresql/14/main/pg_hba.conf

# Измените на:
local   all   all   md5
host    all   all   127.0.0.1/32   md5

# Перезапустите PostgreSQL
sudo systemctl restart postgresql
```

---

## 📚 Следующие шаги

1. ✅ База данных развернута
2. ✅ Backend запущен
3. ✅ API endpoints работают
4. 🔲 Реализуйте остальные endpoints из API_ENDPOINTS.md
5. 🔲 Добавьте middleware для аутентификации
6. 🔲 Добавьте валидацию данных
7. 🔲 Настройте загрузку файлов
8. 🔲 Добавьте обработку ошибок
9. 🔲 Напишите тесты
10. 🔲 Настройте production окружение

---

## 💡 Полезные команды

```bash
# Посмотреть активные подключения
SELECT * FROM pg_stat_activity WHERE datname = 'maxmaster_skills';

# Убить все подключения
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'maxmaster_skills' AND pid <> pg_backend_pid();

# Размер базы данных
SELECT pg_size_pretty(pg_database_size('maxmaster_skills'));

# Vacuum (очистка)
VACUUM ANALYZE;

# Пересоздать базу данных (ОСТОРОЖНО!)
DROP DATABASE maxmaster_skills;
CREATE DATABASE maxmaster_skills;
```

---

**Готово!** 🎉

Ваша база данных настроена и готова к работе. Теперь можно начинать разработку backend API.

Для полной документации смотрите:
- `README.md` - Полная документация БД
- `API_ENDPOINTS.md` - Спецификация API
- `schema.sql` - SQL схема
- `seed_data.sql` - Начальные данные
