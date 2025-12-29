-- ============================================================
-- MAXMASTER SKILLS PLATFORM - SQL QUERIES EXAMPLES
-- ============================================================
-- Примеры полезных SQL запросов для работы с базой данных
-- ============================================================

-- ============================================================
-- ПОЛЬЗОВАТЕЛИ (USERS)
-- ============================================================

-- 1. Получить всех активных сотрудников
SELECT
    id,
    first_name,
    last_name,
    email,
    role,
    base_rate,
    contract_type,
    hired_date
FROM users
WHERE status = 'active' AND role IN ('employee', 'brigadir')
ORDER BY last_name, first_name;

-- 2. Получить сотрудников бригадира
SELECT
    u.id,
    u.first_name,
    u.last_name,
    u.status,
    b.first_name as brigadir_name,
    b.last_name as brigadir_lastname
FROM users u
LEFT JOIN users b ON u.assigned_brigadir_id = b.id
WHERE u.assigned_brigadir_id = 'u0000000-0000-0000-0000-000000000003'  -- ID бригадира
ORDER BY u.last_name;

-- 3. Получить кандидатов с количеством пройденных тестов
SELECT
    u.id,
    u.first_name,
    u.last_name,
    u.email,
    u.status,
    u.source,
    COUNT(ta.id) as tests_taken,
    COUNT(ta.id) FILTER (WHERE ta.passed = true) as tests_passed
FROM users u
LEFT JOIN test_attempts ta ON u.id = ta.user_id
WHERE u.role = 'candidate'
GROUP BY u.id
ORDER BY u.created_at DESC;

-- 4. Поиск пользователей по имени или email
SELECT id, first_name, last_name, email, role, status
FROM users
WHERE
    first_name ILIKE '%jan%'
    OR last_name ILIKE '%jan%'
    OR email ILIKE '%jan%'
ORDER BY last_name;

-- 5. Получить пользователей с рефералами (кто кого пригласил)
SELECT
    referrer.first_name as referrer_name,
    referrer.last_name as referrer_lastname,
    referred.first_name as referred_name,
    referred.last_name as referred_lastname,
    referred.status,
    referred.hired_date,
    referrer.referral_bonus_paid
FROM users referred
JOIN users referrer ON referred.referred_by_id = referrer.id
ORDER BY referrer.last_name;

-- ============================================================
-- НАВЫКИ (SKILLS & USER_SKILLS)
-- ============================================================

-- 6. Получить все навыки с количеством сотрудников
SELECT
    s.id,
    s.name_pl,
    s.category,
    s.hourly_bonus,
    COUNT(us.id) FILTER (WHERE us.status = 'confirmed') as confirmed_count,
    COUNT(us.id) FILTER (WHERE us.status IN ('pending', 'theory_passed', 'practice_pending')) as in_progress_count
FROM skills s
LEFT JOIN user_skills us ON s.id = us.skill_id AND us.is_archived = false
WHERE s.is_archived = false
GROUP BY s.id
ORDER BY s.category, s.name_pl;

-- 7. Получить навыки конкретного пользователя
SELECT
    s.name_pl,
    s.category,
    s.hourly_bonus,
    us.status,
    us.theory_score,
    us.confirmed_at,
    us.effective_from
FROM user_skills us
JOIN skills s ON us.skill_id = s.id
WHERE us.user_id = 'u0000000-0000-0000-0000-000000000005'  -- Jan Kowalski
    AND us.is_archived = false
ORDER BY s.category, s.name_pl;

-- 8. Получить навыки, ожидающие подтверждения бригадиром
SELECT
    u.first_name,
    u.last_name,
    s.name_pl as skill_name,
    us.status,
    us.theory_score,
    us.created_at
FROM user_skills us
JOIN users u ON us.user_id = u.id
JOIN skills s ON us.skill_id = s.id
WHERE us.status IN ('theory_passed', 'practice_pending')
    AND s.verification_type = 'theory_practice'
    AND u.assigned_brigadir_id = 'u0000000-0000-0000-0000-000000000003'
ORDER BY us.created_at;

-- 9. Получить навыки по категории
SELECT
    s.name_pl,
    s.hourly_bonus,
    s.required_pass_rate,
    COUNT(us.id) FILTER (WHERE us.status = 'confirmed') as employees_count
FROM skills s
LEFT JOIN user_skills us ON s.id = us.skill_id
WHERE s.category = 'TELETECHNICZNE' AND s.is_archived = false
GROUP BY s.id
ORDER BY s.hourly_bonus DESC;

-- 10. Получить пользователей, которые сдали навык но он еще не вступил в силу
SELECT
    u.first_name,
    u.last_name,
    s.name_pl,
    us.effective_from,
    s.hourly_bonus
FROM user_skills us
JOIN users u ON us.user_id = u.id
JOIN skills s ON us.skill_id = s.id
WHERE us.status = 'confirmed'
    AND us.effective_from > CURRENT_DATE
ORDER BY us.effective_from;

-- ============================================================
-- ТЕСТЫ (TESTS & TEST_ATTEMPTS)
-- ============================================================

-- 11. Получить все тесты с количеством вопросов
SELECT
    t.id,
    t.title,
    t.time_limit_minutes,
    t.is_active,
    COUNT(q.id) as questions_count
FROM tests t
LEFT JOIN questions q ON t.id = q.test_id
WHERE t.is_archived = false
GROUP BY t.id
ORDER BY t.title;

-- 12. Получить результаты тестов пользователя
SELECT
    t.title,
    ta.score,
    ta.passed,
    ta.duration_seconds,
    ta.completed_at
FROM test_attempts ta
JOIN tests t ON ta.test_id = t.id
WHERE ta.user_id = 'c0000000-0000-0000-0000-000000000001'  -- Marek Kandydacki
ORDER BY ta.completed_at DESC;

-- 13. Получить статистику по тесту
SELECT
    t.title,
    COUNT(ta.id) as total_attempts,
    COUNT(ta.id) FILTER (WHERE ta.passed = true) as passed_count,
    ROUND(AVG(ta.score), 2) as avg_score,
    MAX(ta.score) as max_score,
    MIN(ta.score) as min_score
FROM tests t
LEFT JOIN test_attempts ta ON t.id = ta.test_id
WHERE t.id = 't0000001-0000-0000-0000-000000000001'
GROUP BY t.id;

-- 14. Получить последние попытки тестов
SELECT
    u.first_name,
    u.last_name,
    t.title,
    ta.score,
    ta.passed,
    ta.completed_at
FROM test_attempts ta
JOIN users u ON ta.user_id = u.id
JOIN tests t ON ta.test_id = t.id
ORDER BY ta.completed_at DESC
LIMIT 20;

-- ============================================================
-- ЗАРПЛАТА И БОНУСЫ
-- ============================================================

-- 15. Расчет текущей ставки пользователя
SELECT
    u.first_name,
    u.last_name,
    u.base_rate,
    COALESCE(SUM(s.hourly_bonus) FILTER (
        WHERE us.status = 'confirmed'
        AND (us.effective_from IS NULL OR us.effective_from <= CURRENT_DATE)
    ), 0) as skills_bonus,
    u.base_rate + COALESCE(SUM(s.hourly_bonus) FILTER (
        WHERE us.status = 'confirmed'
        AND (us.effective_from IS NULL OR us.effective_from <= CURRENT_DATE)
    ), 0) as total_rate
FROM users u
LEFT JOIN user_skills us ON u.id = us.user_id AND us.is_archived = false
LEFT JOIN skills s ON us.skill_id = s.id
WHERE u.id = 'u0000000-0000-0000-0000-000000000005'
GROUP BY u.id;

-- 16. История изменений зарплаты
SELECT
    sh.change_date,
    sh.reason,
    sh.old_rate,
    sh.new_rate,
    sh.new_rate - sh.old_rate as difference,
    changed_by.first_name as changed_by_name
FROM salary_history sh
LEFT JOIN users changed_by ON sh.changed_by_id = changed_by.id
WHERE sh.user_id = 'u0000000-0000-0000-0000-000000000005'
ORDER BY sh.change_date DESC;

-- 17. Месячные бонусы всех сотрудников
SELECT
    u.first_name,
    u.last_name,
    mb.month,
    mb.kontrola_pracownikow,
    mb.realizacja_planu,
    mb.brak_usterek,
    mb.brak_naduzyc_materialowych,
    mb.staz_pracy_years
FROM monthly_bonuses mb
JOIN users u ON mb.user_id = u.id
WHERE mb.month = '2023-10'
ORDER BY u.last_name;

-- 18. Средняя ставка по должностям
SELECT
    u.target_position,
    COUNT(u.id) as employees_count,
    ROUND(AVG(u.base_rate), 2) as avg_base_rate,
    ROUND(MIN(u.base_rate), 2) as min_rate,
    ROUND(MAX(u.base_rate), 2) as max_rate
FROM users u
WHERE u.status = 'active' AND u.target_position IS NOT NULL
GROUP BY u.target_position
ORDER BY avg_base_rate DESC;

-- ============================================================
-- КАЧЕСТВО И ИНЦИДЕНТЫ
-- ============================================================

-- 19. Получить инциденты качества пользователя
SELECT
    qi.date,
    s.name_pl as skill_name,
    qi.incident_number,
    qi.description,
    qi.reported_by,
    qi.image_url
FROM quality_incidents qi
JOIN skills s ON qi.skill_id = s.id
WHERE qi.user_id = 'u0000000-0000-0000-0000-000000000005'
ORDER BY qi.date DESC;

-- 20. Статистика инцидентов по навыку за месяц
SELECT
    s.name_pl,
    COUNT(qi.id) as incidents_count,
    COUNT(DISTINCT qi.user_id) as affected_users
FROM quality_incidents qi
JOIN skills s ON qi.skill_id = s.id
WHERE qi.date >= DATE_TRUNC('month', CURRENT_DATE)
    AND qi.date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
GROUP BY s.id
ORDER BY incidents_count DESC;

-- 21. Пользователи с 2+ инцидентами по одному навыку (блокировка бонуса)
SELECT
    u.first_name,
    u.last_name,
    s.name_pl,
    COUNT(qi.id) as incidents_count
FROM quality_incidents qi
JOIN users u ON qi.user_id = u.id
JOIN skills s ON qi.skill_id = s.id
WHERE qi.date >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY u.id, s.id
HAVING COUNT(qi.id) >= 2
ORDER BY incidents_count DESC;

-- ============================================================
-- ЗАМЕТКИ И НАГРАДЫ
-- ============================================================

-- 22. Получить заметки о сотруднике
SELECT
    en.created_at,
    en.category,
    en.severity,
    en.text,
    author.first_name as author_name,
    author.last_name as author_lastname
FROM employee_notes en
JOIN users author ON en.author_id = author.id
WHERE en.employee_id = 'u0000000-0000-0000-0000-000000000005'
ORDER BY en.created_at DESC;

-- 23. Получить награды сотрудника
SELECT
    eb.month,
    eb.type,
    eb.description,
    eb.visible_to_employee,
    author.first_name as author_name
FROM employee_badges eb
JOIN users author ON eb.author_id = author.id
WHERE eb.employee_id = 'u0000000-0000-0000-0000-000000000005'
    AND eb.visible_to_employee = true
ORDER BY eb.month DESC;

-- 24. Статистика наград по месяцам
SELECT
    eb.month,
    eb.type,
    COUNT(*) as count
FROM employee_badges eb
GROUP BY eb.month, eb.type
ORDER BY eb.month DESC, count DESC;

-- ============================================================
-- БИБЛИОТЕКА И РЕСУРСЫ
-- ============================================================

-- 25. Получить ресурсы по категории
SELECT
    lr.title,
    lr.type,
    lr.description,
    lr.url,
    array_length(lr.skill_ids, 1) as related_skills_count
FROM library_resources lr
WHERE 'TELETECHNICZNE' = ANY(lr.categories)
    AND lr.is_archived = false
ORDER BY lr.created_at DESC;

-- 26. Получить ресурсы для конкретного навыка
SELECT
    lr.title,
    lr.type,
    lr.url,
    lr.description
FROM library_resources lr
WHERE 'a0000004-0000-0000-0000-000000000004'::uuid = ANY(lr.skill_ids)
    AND lr.is_archived = false
ORDER BY lr.title;

-- ============================================================
-- ДОЛЖНОСТИ
-- ============================================================

-- 27. Получить все должности с требованиями
SELECT
    p.name,
    p.responsibilities,
    array_length(p.required_skill_ids, 1) as required_skills_count,
    p.min_monthly_rate,
    p.max_monthly_rate,
    p."order"
FROM positions
ORDER BY p."order";

-- 28. Количество сотрудников на каждой должности
SELECT
    u.target_position,
    COUNT(*) as employees_count
FROM users u
WHERE u.status = 'active' AND u.target_position IS NOT NULL
GROUP BY u.target_position
ORDER BY employees_count DESC;

-- ============================================================
-- УВЕДОМЛЕНИЯ
-- ============================================================

-- 29. Получить непрочитанные уведомления пользователя
SELECT
    n.title,
    n.message,
    n.link,
    n.created_at
FROM notifications n
WHERE n.user_id = 'u0000000-0000-0000-0000-000000000005'
    AND n.is_read = false
ORDER BY n.created_at DESC;

-- 30. Количество непрочитанных уведомлений
SELECT
    u.first_name,
    u.last_name,
    COUNT(n.id) as unread_count
FROM users u
LEFT JOIN notifications n ON u.id = n.user_id AND n.is_read = false
WHERE u.status = 'active'
GROUP BY u.id
HAVING COUNT(n.id) > 0
ORDER BY unread_count DESC;

-- ============================================================
-- ИСТОРИЯ КАНДИДАТОВ
-- ============================================================

-- 31. История действий с кандидатом
SELECT
    ch.created_at,
    ch.action,
    ch.performed_by
FROM candidate_history ch
WHERE ch.candidate_id = 'c0000000-0000-0000-0000-000000000001'
ORDER BY ch.created_at DESC;

-- 32. Воронка кандидатов (funnel)
SELECT
    status,
    COUNT(*) as count
FROM users
WHERE role = 'candidate'
GROUP BY status
ORDER BY
    CASE status
        WHEN 'invited' THEN 1
        WHEN 'started' THEN 2
        WHEN 'tests_in_progress' THEN 3
        WHEN 'tests_completed' THEN 4
        WHEN 'interested' THEN 5
        WHEN 'data_requested' THEN 6
        WHEN 'data_submitted' THEN 7
        ELSE 99
    END;

-- ============================================================
-- АНАЛИТИКА И ОТЧЕТЫ
-- ============================================================

-- 33. Топ навыков по количеству сотрудников
SELECT
    s.name_pl,
    s.hourly_bonus,
    COUNT(us.id) as employees_count
FROM skills s
LEFT JOIN user_skills us ON s.id = us.skill_id AND us.status = 'confirmed'
WHERE s.is_archived = false
GROUP BY s.id
ORDER BY employees_count DESC
LIMIT 10;

-- 34. Активность регистраций по дням
SELECT
    DATE(created_at) as registration_date,
    role,
    COUNT(*) as registrations
FROM users
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at), role
ORDER BY registration_date DESC, role;

-- 35. Средний балл по тестам
SELECT
    t.title,
    COUNT(ta.id) as attempts_count,
    ROUND(AVG(ta.score), 2) as avg_score,
    ROUND(AVG(ta.duration_seconds) / 60.0, 2) as avg_duration_minutes
FROM tests t
LEFT JOIN test_attempts ta ON t.id = ta.test_id
GROUP BY t.id
ORDER BY avg_score DESC;

-- 36. Сотрудники с наибольшим количеством навыков
SELECT
    u.first_name,
    u.last_name,
    u.role,
    COUNT(us.id) FILTER (WHERE us.status = 'confirmed') as confirmed_skills,
    COUNT(us.id) FILTER (WHERE us.status IN ('pending', 'theory_passed', 'practice_pending')) as pending_skills
FROM users u
LEFT JOIN user_skills us ON u.id = us.user_id AND us.is_archived = false
WHERE u.status = 'active'
GROUP BY u.id
ORDER BY confirmed_skills DESC
LIMIT 10;

-- ============================================================
-- АДМИНИСТРАТИВНЫЕ ЗАПРОСЫ
-- ============================================================

-- 37. Размер таблиц в базе данных
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 38. Количество записей в каждой таблице
SELECT
    schemaname,
    tablename,
    n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- 39. Активные подключения к базе данных
SELECT
    datname,
    usename,
    application_name,
    client_addr,
    state,
    query_start
FROM pg_stat_activity
WHERE datname = 'maxmaster_skills'
ORDER BY query_start DESC;

-- 40. Очистка и оптимизация
VACUUM ANALYZE;
REINDEX DATABASE maxmaster_skills;

-- ============================================================
-- ПОЛЕЗНЫЕ ФУНКЦИИ
-- ============================================================

-- 41. Создать функцию для получения полного имени
CREATE OR REPLACE FUNCTION get_full_name(user_id UUID)
RETURNS VARCHAR AS $$
DECLARE
    full_name VARCHAR;
BEGIN
    SELECT first_name || ' ' || last_name INTO full_name
    FROM users
    WHERE id = user_id;
    RETURN full_name;
END;
$$ LANGUAGE plpgsql;

-- Использование:
-- SELECT get_full_name('u0000000-0000-0000-0000-000000000005');

-- 42. Создать функцию для расчета текущей ставки
CREATE OR REPLACE FUNCTION calculate_current_rate(user_id UUID)
RETURNS DECIMAL AS $$
DECLARE
    total_rate DECIMAL;
BEGIN
    SELECT
        u.base_rate + COALESCE(SUM(s.hourly_bonus), 0)
    INTO total_rate
    FROM users u
    LEFT JOIN user_skills us ON u.id = us.user_id
        AND us.is_archived = false
        AND us.status = 'confirmed'
        AND (us.effective_from IS NULL OR us.effective_from <= CURRENT_DATE)
    LEFT JOIN skills s ON us.skill_id = s.id
    WHERE u.id = user_id
    GROUP BY u.id;

    RETURN total_rate;
END;
$$ LANGUAGE plpgsql;

-- Использование:
-- SELECT first_name, last_name, calculate_current_rate(id) as current_rate FROM users WHERE status = 'active';

-- ============================================================
-- END OF EXAMPLES
-- ============================================================
