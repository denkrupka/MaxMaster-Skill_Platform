-- ============================================================================
-- FULL NOTIFICATION TYPES FOR ALL ROLES
-- ============================================================================
-- Complete notification system based on all features in the application
-- Run this script in Supabase SQL Editor after running complete_fix.sql
-- ============================================================================

-- First, clear existing default settings
DELETE FROM notification_settings WHERE user_id IS NULL;

-- ============================================================================
-- CANDIDATE NOTIFICATIONS (Кандидат)
-- ============================================================================
INSERT INTO notification_settings (id, user_id, setting_type, label, system, email, sms, category, target_role)
VALUES
  -- Регистрация и профиль
  (gen_random_uuid(), NULL, 'cand_registered', 'Кандидат: Успешная регистрация в системе', true, true, false, 'Профиль', 'candidate'),
  (gen_random_uuid(), NULL, 'cand_profile_updated', 'Кандидат: Данные профиля изменены', true, false, false, 'Профиль', 'candidate'),

  -- Договор и данные
  (gen_random_uuid(), NULL, 'cand_contract_data_requested', 'Кандидат: Запрошены данные для договора', true, true, true, 'Договор', 'candidate'),
  (gen_random_uuid(), NULL, 'cand_contract_data_submitted', 'Кандидат: Данные для договора отправлены', true, true, false, 'Договор', 'candidate'),

  -- Документы
  (gen_random_uuid(), NULL, 'cand_document_uploaded', 'Кандидат: Документ загружен', true, false, false, 'Документы', 'candidate'),
  (gen_random_uuid(), NULL, 'cand_document_approved', 'Кандидат: Документ подтвержден', true, true, false, 'Документы', 'candidate'),
  (gen_random_uuid(), NULL, 'cand_document_rejected', 'Кандидат: Документ отклонен', true, true, true, 'Документы', 'candidate'),

  -- Тесты
  (gen_random_uuid(), NULL, 'cand_test_assigned', 'Кандидат: Назначен новый тест', true, true, false, 'Тесты', 'candidate'),
  (gen_random_uuid(), NULL, 'cand_test_passed', 'Кандидат: Тест успешно пройден', true, true, false, 'Тесты', 'candidate'),
  (gen_random_uuid(), NULL, 'cand_test_failed', 'Кандидат: Тест не пройден', true, true, false, 'Тесты', 'candidate'),

  -- Практика
  (gen_random_uuid(), NULL, 'cand_practice_assigned', 'Кандидат: Назначена практика', true, true, true, 'Практика', 'candidate'),
  (gen_random_uuid(), NULL, 'cand_practice_approved', 'Кандидат: Практика подтверждена', true, true, false, 'Практика', 'candidate'),
  (gen_random_uuid(), NULL, 'cand_practice_rejected', 'Кандидат: Практика отклонена', true, true, true, 'Практика', 'candidate'),

  -- Статус
  (gen_random_uuid(), NULL, 'cand_moved_to_trial', 'Кандидат: Переведен на испытательный срок', true, true, true, 'Статус', 'candidate'),
  (gen_random_uuid(), NULL, 'cand_trial_ending_soon', 'Кандидат: Скоро окончание испытательного срока', true, true, true, 'Статус', 'candidate'),
  (gen_random_uuid(), NULL, 'cand_status_changed', 'Кандидат: Статус изменен', true, true, false, 'Статус', 'candidate'),
  (gen_random_uuid(), NULL, 'cand_rejected', 'Кандидат: Заявка отклонена', true, true, true, 'Статус', 'candidate'),
  (gen_random_uuid(), NULL, 'cand_portal_blocked', 'Кандидат: Доступ к порталу заблокирован', true, true, true, 'Статус', 'candidate');

-- ============================================================================
-- EMPLOYEE NOTIFICATIONS (Сотрудник) - все что у кандидата + дополнительные
-- ============================================================================
INSERT INTO notification_settings (id, user_id, setting_type, label, system, email, sms, category, target_role)
VALUES
  -- Бригадир
  (gen_random_uuid(), NULL, 'emp_brigadir_assigned', 'Сотрудник: Назначен бригадир', true, true, false, 'Команда', 'employee'),
  (gen_random_uuid(), NULL, 'emp_brigadir_changed', 'Сотрудник: Изменен бригадир', true, true, false, 'Команда', 'employee'),

  -- Навыки
  (gen_random_uuid(), NULL, 'emp_skill_confirmed', 'Сотрудник: Навык подтвержден', true, true, false, 'Навыки', 'employee'),
  (gen_random_uuid(), NULL, 'emp_skill_rejected', 'Сотрудник: Навык отклонен', true, true, false, 'Навыки', 'employee'),
  (gen_random_uuid(), NULL, 'emp_skill_practice_ready', 'Сотрудник: Готов к практической проверке', true, true, false, 'Навыки', 'employee'),

  -- Ставка и бонусы
  (gen_random_uuid(), NULL, 'emp_rate_changed', 'Сотрудник: Ставка изменена', true, true, true, 'Финансы', 'employee'),
  (gen_random_uuid(), NULL, 'emp_monthly_bonus', 'Сотрудник: Начислен месячный бонус', true, true, false, 'Финансы', 'employee'),
  (gen_random_uuid(), NULL, 'emp_bonus_blocked', 'Сотрудник: Блокировка бонуса до конца месяца', true, true, true, 'Финансы', 'employee'),

  -- Качество работы
  (gen_random_uuid(), NULL, 'emp_quality_warning', 'Сотрудник: Предупреждение о качестве работы', true, true, true, 'Качество', 'employee'),
  (gen_random_uuid(), NULL, 'emp_quality_incident', 'Сотрудник: Зарегистрирован инцидент качества', true, true, true, 'Качество', 'employee'),
  (gen_random_uuid(), NULL, 'emp_badge_earned', 'Сотрудник: Получена награда/значок', true, true, false, 'Достижения', 'employee'),
  (gen_random_uuid(), NULL, 'emp_note_added', 'Сотрудник: Добавлена заметка о работе', true, false, false, 'Качество', 'employee'),

  -- Реферальная программа
  (gen_random_uuid(), NULL, 'emp_referral_accepted', 'Сотрудник: Приглашенный кандидат принят', true, true, false, 'Реферальная программа', 'employee'),
  (gen_random_uuid(), NULL, 'emp_referral_bonus', 'Сотрудник: Начислен бонус за приглашение', true, true, false, 'Реферальная программа', 'employee'),
  (gen_random_uuid(), NULL, 'emp_referral_hired', 'Сотрудник: Приглашенный сотрудник нанят', true, true, false, 'Реферальная программа', 'employee'),

  -- Документы и договор
  (gen_random_uuid(), NULL, 'emp_document_expiring', 'Сотрудник: Документ истекает через 30 дней', true, true, true, 'Документы', 'employee'),
  (gen_random_uuid(), NULL, 'emp_contract_expiring', 'Сотрудник: Договор истекает через 30 дней', true, true, true, 'Договор', 'employee'),
  (gen_random_uuid(), NULL, 'emp_contract_permanent', 'Сотрудник: Переведен на постоянный договор', true, true, false, 'Договор', 'employee'),

  -- Статус
  (gen_random_uuid(), NULL, 'emp_hired', 'Сотрудник: Принят на постоянную работу', true, true, true, 'Статус', 'employee'),
  (gen_random_uuid(), NULL, 'emp_terminated', 'Сотрудник: Уведомление об увольнении', true, true, true, 'Статус', 'employee');

-- ============================================================================
-- BRIGADIR NOTIFICATIONS (Бригадир) - все что у сотрудника + управление командой
-- ============================================================================
INSERT INTO notification_settings (id, user_id, setting_type, label, system, email, sms, category, target_role)
VALUES
  -- Управление командой
  (gen_random_uuid(), NULL, 'brig_employee_added', 'Бригадир: Добавлен сотрудник в бригаду', true, true, false, 'Команда', 'brigadir'),
  (gen_random_uuid(), NULL, 'brig_employee_removed', 'Бригадир: Удален сотрудник из бригады', true, true, false, 'Команда', 'brigadir'),

  -- Проверка практики
  (gen_random_uuid(), NULL, 'brig_practice_assigned', 'Бригадир: Назначена практика для проверки', true, true, true, 'Практика', 'brigadir'),
  (gen_random_uuid(), NULL, 'brig_practice_pending', 'Бригадир: Сотрудник ожидает проверки практики', true, true, false, 'Практика', 'brigadir'),
  (gen_random_uuid(), NULL, 'brig_theory_completed', 'Бригадир: Сотрудник завершил теорию, ждет практику', true, true, false, 'Практика', 'brigadir'),

  -- Команда - статусы
  (gen_random_uuid(), NULL, 'brig_employee_trial_ending', 'Бригадир: Испытательный срок сотрудника заканчивается', true, true, true, 'Команда', 'brigadir'),
  (gen_random_uuid(), NULL, 'brig_employee_document_uploaded', 'Бригадир: Сотрудник загрузил документ', true, false, false, 'Документы', 'brigadir'),
  (gen_random_uuid(), NULL, 'brig_quality_incident_team', 'Бригадир: Инцидент качества у сотрудника бригады', true, true, true, 'Качество', 'brigadir'),
  (gen_random_uuid(), NULL, 'brig_employee_skill_completed', 'Бригадир: Сотрудник завершил навык', true, false, false, 'Навыки', 'brigadir');

-- ============================================================================
-- HR NOTIFICATIONS - управление персоналом
-- ============================================================================
INSERT INTO notification_settings (id, user_id, setting_type, label, system, email, sms, category, target_role)
VALUES
  -- Кандидаты
  (gen_random_uuid(), NULL, 'hr_cand_reg', 'HR: Новая регистрация кандидата', true, true, false, 'Кандидаты', 'hr'),
  (gen_random_uuid(), NULL, 'hr_cand_docs_uploaded', 'HR: Кандидат загрузил документы', true, true, false, 'Кандидаты', 'hr'),
  (gen_random_uuid(), NULL, 'hr_cand_tests_completed', 'HR: Кандидат завершил тесты', true, true, false, 'Кандидаты', 'hr'),
  (gen_random_uuid(), NULL, 'hr_cand_contract_data', 'HR: Кандидат отправил данные для договора', true, true, false, 'Кандидаты', 'hr'),
  (gen_random_uuid(), NULL, 'hr_cand_ready_for_trial', 'HR: Кандидат готов к испытательному сроку', true, true, false, 'Кандидаты', 'hr'),

  -- Сотрудники
  (gen_random_uuid(), NULL, 'hr_trial_ending_7days', 'HR: Испытательный срок заканчивается (7 дней)', true, true, true, 'Сотрудники', 'hr'),
  (gen_random_uuid(), NULL, 'hr_contract_expiring_30days', 'HR: Договор истекает через 30 дней', true, true, false, 'Сотрудники', 'hr'),
  (gen_random_uuid(), NULL, 'hr_document_expiring_30days', 'HR: Документ сотрудника истекает через 30 дней', true, true, false, 'Сотрудники', 'hr'),

  -- Качество и инциденты
  (gen_random_uuid(), NULL, 'hr_quality_incident_critical', 'HR: Критический инцидент качества', true, true, true, 'Качество', 'hr'),
  (gen_random_uuid(), NULL, 'hr_quality_report_ready', 'HR: Отчет о качестве готов', true, true, false, 'Отчеты', 'hr'),

  -- Увольнения
  (gen_random_uuid(), NULL, 'hr_termination_request', 'HR: Запрос на увольнение сотрудника', true, true, false, 'Увольнения', 'hr'),
  (gen_random_uuid(), NULL, 'hr_employee_terminated', 'HR: Сотрудник уволен', true, false, false, 'Увольнения', 'hr'),

  -- Реферальная программа
  (gen_random_uuid(), NULL, 'hr_referral_pending', 'HR: Реферал ожидает рассмотрения', true, true, false, 'Реферальная программа', 'hr'),
  (gen_random_uuid(), NULL, 'hr_referral_bonus_paid', 'HR: Выплачен бонус за реферал', true, false, false, 'Реферальная программа', 'hr'),

  -- Система
  (gen_random_uuid(), NULL, 'hr_monthly_report_ready', 'HR: Месячный отчет готов', true, true, false, 'Отчеты', 'hr'),
  (gen_random_uuid(), NULL, 'hr_skills_verification_pending', 'HR: Навыки ожидают верификации', true, true, false, 'Навыки', 'hr');

-- ============================================================================
-- COORDINATOR NOTIFICATIONS - координация проектов
-- ============================================================================
INSERT INTO notification_settings (id, user_id, setting_type, label, system, email, sms, category, target_role)
VALUES
  -- Команда проекта
  (gen_random_uuid(), NULL, 'coord_employee_assigned', 'Координатор: Новый сотрудник назначен на проект', true, true, false, 'Команда', 'coordinator'),
  (gen_random_uuid(), NULL, 'coord_team_changed', 'Координатор: Изменение состава команды проекта', true, true, false, 'Команда', 'coordinator'),
  (gen_random_uuid(), NULL, 'coord_employee_removed', 'Координатор: Сотрудник снят с проекта', true, true, false, 'Команда', 'coordinator'),

  -- Качество и отчеты
  (gen_random_uuid(), NULL, 'coord_quality_report_ready', 'Координатор: Отчет о качестве проекта готов', true, true, false, 'Отчеты', 'coordinator'),
  (gen_random_uuid(), NULL, 'coord_quality_incident', 'Координатор: Инцидент качества на проекте', true, true, true, 'Качество', 'coordinator'),
  (gen_random_uuid(), NULL, 'coord_project_milestone', 'Координатор: Достигнута веха проекта', true, true, false, 'Проект', 'coordinator'),

  -- Сотрудники
  (gen_random_uuid(), NULL, 'coord_contract_expiring', 'Координатор: Договор сотрудника проекта истекает', true, true, false, 'Сотрудники', 'coordinator'),
  (gen_random_uuid(), NULL, 'coord_document_expiring', 'Координатор: Документ сотрудника проекта истекает', true, true, false, 'Сотрудники', 'coordinator'),
  (gen_random_uuid(), NULL, 'coord_skills_shortage', 'Координатор: Нехватка сотрудников с навыками', true, true, true, 'Команда', 'coordinator');

-- ============================================================================
-- WORK MANAGER NOTIFICATIONS (Kierownik Robót) - управление объектами
-- ============================================================================
INSERT INTO notification_settings (id, user_id, setting_type, label, system, email, sms, category, target_role)
VALUES
  -- Назначение и проект
  (gen_random_uuid(), NULL, 'wm_assigned_to_project', 'Kierownik: Назначен на новый объект', true, true, false, 'Проекты', NULL),
  (gen_random_uuid(), NULL, 'wm_team_changed', 'Kierownik: Изменение команды на объекте', true, true, false, 'Команда', NULL),

  -- Качество
  (gen_random_uuid(), NULL, 'wm_execution_report_ready', 'Kierownik: Отчет о выполнении готов', true, true, false, 'Отчеты', NULL),
  (gen_random_uuid(), NULL, 'wm_quality_incident', 'Kierownik: Инцидент качества на объекте', true, true, true, 'Качество', NULL),
  (gen_random_uuid(), NULL, 'wm_inspection_scheduled', 'Kierownik: Запланирована инспекция объекта', true, true, true, 'Инспекции', NULL),

  -- Сотрудники
  (gen_random_uuid(), NULL, 'wm_skills_shortage', 'Kierownik: Нехватка сотрудников с навыками', true, true, true, 'Команда', NULL),
  (gen_random_uuid(), NULL, 'wm_document_expiring_site', 'Kierownik: Документ сотрудника на объекте истекает', true, true, true, 'Документы', NULL),
  (gen_random_uuid(), NULL, 'wm_employee_issue', 'Kierownik: Проблема с сотрудником на объекте', true, true, true, 'Команда', NULL);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT
  'Total notification types created:' as info,
  COUNT(*) as total
FROM notification_settings
WHERE user_id IS NULL;

SELECT
  'Notification types by role:' as info,
  COALESCE(target_role, 'ALL_ROLES') as role,
  COUNT(*) as count
FROM notification_settings
WHERE user_id IS NULL
GROUP BY target_role
ORDER BY target_role;

-- Show all notifications grouped by category
SELECT
  category,
  target_role,
  COUNT(*) as notifications_count
FROM notification_settings
WHERE user_id IS NULL
GROUP BY category, target_role
ORDER BY category, target_role;

-- ============================================================================
-- SUCCESS! You should see:
-- - ~85-90 total notification types
-- - Breakdown by role
-- - Breakdown by category
-- ============================================================================
