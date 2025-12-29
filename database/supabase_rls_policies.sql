-- ============================================================
-- SUPABASE ROW LEVEL SECURITY POLICIES
-- ============================================================
-- Детальные политики безопасности для всех таблиц
-- Выполните ПОСЛЕ supabase_schema.sql
-- ============================================================

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Функция для проверки роли текущего пользователя
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS user_role AS $$
    SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE;

-- Функция для проверки является ли пользователь HR/Admin
CREATE OR REPLACE FUNCTION auth.is_hr_or_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role IN ('hr', 'admin')
    );
$$ LANGUAGE SQL STABLE;

-- Функция для проверки является ли пользователь бригадиром
CREATE OR REPLACE FUNCTION auth.is_brigadir()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'brigadir'
    );
$$ LANGUAGE SQL STABLE;

-- ============================================================
-- POSITIONS - Должности
-- ============================================================

-- Все аутентифицированные могут читать
CREATE POLICY "Authenticated users can view positions"
    ON positions FOR SELECT
    TO authenticated
    USING (true);

-- Только HR/Admin могут создавать/обновлять/удалять
CREATE POLICY "HR/Admin can manage positions"
    ON positions FOR ALL
    USING (auth.is_hr_or_admin());

-- ============================================================
-- USER_SKILLS - Расширенные политики
-- ============================================================

-- Обновление статуса навыка
CREATE POLICY "HR/Brigadir can update skill status"
    ON user_skills FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('hr', 'admin', 'brigadir')
        )
    );

-- Бригадир может обновлять навыки своей команды
CREATE POLICY "Brigadir can update team skills"
    ON user_skills FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = user_skills.user_id
            AND u.assigned_brigadir_id = auth.uid()
        )
    );

-- ============================================================
-- VERIFICATION ATTACHMENTS
-- ============================================================

ALTER TABLE verification_attachments ENABLE ROW LEVEL SECURITY;

-- Пользователь может загружать свои вложения
CREATE POLICY "Users can upload own verification attachments"
    ON verification_attachments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_skills
            WHERE id = user_skill_id AND user_id = auth.uid()
        )
    );

-- Пользователь может видеть свои вложения
CREATE POLICY "Users can view own verification attachments"
    ON verification_attachments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_skills
            WHERE id = user_skill_id
            AND (
                user_id = auth.uid()
                OR auth.is_hr_or_admin()
                OR auth.is_brigadir()
            )
        )
    );

-- ============================================================
-- VERIFICATION NOTES
-- ============================================================

ALTER TABLE verification_notes ENABLE ROW LEVEL SECURITY;

-- Все заинтересованные могут читать заметки
CREATE POLICY "Stakeholders can view verification notes"
    ON verification_notes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_skills
            WHERE id = user_skill_id
            AND (
                user_id = auth.uid()
                OR auth.is_hr_or_admin()
                OR auth.is_brigadir()
            )
        )
    );

-- HR/Brigadir могут добавлять заметки
CREATE POLICY "HR/Brigadir can add verification notes"
    ON verification_notes FOR INSERT
    WITH CHECK (
        auth.is_hr_or_admin() OR auth.is_brigadir()
    );

-- ============================================================
-- VERIFICATION LOGS
-- ============================================================

ALTER TABLE verification_logs ENABLE ROW LEVEL SECURITY;

-- Все заинтересованные могут читать логи
CREATE POLICY "Stakeholders can view verification logs"
    ON verification_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_skills
            WHERE id = user_skill_id
            AND (
                user_id = auth.uid()
                OR auth.is_hr_or_admin()
                OR auth.is_brigadir()
            )
        )
    );

-- Система автоматически создает логи (через service role)
CREATE POLICY "Service role can create logs"
    ON verification_logs FOR INSERT
    WITH CHECK (true);

-- ============================================================
-- QUESTIONS
-- ============================================================

-- Аутентифицированные пользователи могут читать вопросы активных тестов
CREATE POLICY "Users can view questions of active tests"
    ON questions FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM tests
            WHERE id = test_id AND is_active = true AND is_archived = false
        )
    );

-- HR/Admin могут управлять вопросами
CREATE POLICY "HR/Admin can manage questions"
    ON questions FOR ALL
    USING (auth.is_hr_or_admin());

-- ============================================================
-- PRACTICAL CHECK TEMPLATES
-- ============================================================

ALTER TABLE practical_check_templates ENABLE ROW LEVEL SECURITY;

-- Все аутентифицированные могут читать
CREATE POLICY "Authenticated users can view practical templates"
    ON practical_check_templates FOR SELECT
    TO authenticated
    USING (true);

-- HR/Admin могут управлять
CREATE POLICY "HR/Admin can manage practical templates"
    ON practical_check_templates FOR ALL
    USING (auth.is_hr_or_admin());

-- ============================================================
-- CANDIDATE HISTORY
-- ============================================================

ALTER TABLE candidate_history ENABLE ROW LEVEL SECURITY;

-- Кандидат может видеть свою историю
CREATE POLICY "Candidates can view own history"
    ON candidate_history FOR SELECT
    USING (
        candidate_id = auth.uid()
        OR auth.is_hr_or_admin()
    );

-- HR/Admin могут создавать записи истории
CREATE POLICY "HR/Admin can create history entries"
    ON candidate_history FOR INSERT
    WITH CHECK (auth.is_hr_or_admin());

-- ============================================================
-- QUALITY INCIDENTS
-- ============================================================

ALTER TABLE quality_incidents ENABLE ROW LEVEL SECURITY;

-- Сотрудник может видеть свои инциденты
CREATE POLICY "Employees can view own incidents"
    ON quality_incidents FOR SELECT
    USING (
        user_id = auth.uid()
        OR auth.is_hr_or_admin()
        OR auth.is_brigadir()
    );

-- Бригадир может создавать инциденты
CREATE POLICY "Brigadir can create incidents"
    ON quality_incidents FOR INSERT
    WITH CHECK (auth.is_brigadir() OR auth.is_hr_or_admin());

-- HR/Admin могут управлять всеми инцидентами
CREATE POLICY "HR/Admin can manage all incidents"
    ON quality_incidents FOR ALL
    USING (auth.is_hr_or_admin());

-- ============================================================
-- EMPLOYEE NOTES
-- ============================================================

-- Сотрудник НЕ видит свои заметки (они служебные)
-- Только HR/Brigadir
CREATE POLICY "HR/Brigadir can view notes"
    ON employee_notes FOR SELECT
    USING (
        auth.is_hr_or_admin()
        OR auth.is_brigadir()
    );

CREATE POLICY "HR/Brigadir can create notes"
    ON employee_notes FOR INSERT
    WITH CHECK (
        auth.is_hr_or_admin() OR auth.is_brigadir()
    );

CREATE POLICY "Authors can update own notes"
    ON employee_notes FOR UPDATE
    USING (author_id = auth.uid());

CREATE POLICY "Authors can delete own notes"
    ON employee_notes FOR DELETE
    USING (author_id = auth.uid());

-- ============================================================
-- EMPLOYEE BADGES
-- ============================================================

-- Сотрудник видит только visible_to_employee = true
CREATE POLICY "Employees can view visible badges"
    ON employee_badges FOR SELECT
    USING (
        (employee_id = auth.uid() AND visible_to_employee = true)
        OR auth.is_hr_or_admin()
        OR auth.is_brigadir()
    );

CREATE POLICY "HR/Brigadir can create badges"
    ON employee_badges FOR INSERT
    WITH CHECK (
        auth.is_hr_or_admin() OR auth.is_brigadir()
    );

CREATE POLICY "HR/Admin can manage badges"
    ON employee_badges FOR ALL
    USING (auth.is_hr_or_admin());

-- ============================================================
-- MONTHLY BONUSES
-- ============================================================

ALTER TABLE monthly_bonuses ENABLE ROW LEVEL SECURITY;

-- Сотрудник может видеть свои бонусы
CREATE POLICY "Employees can view own bonuses"
    ON monthly_bonuses FOR SELECT
    USING (
        user_id = auth.uid()
        OR auth.is_hr_or_admin()
        OR auth.is_brigadir()
    );

-- HR может управлять бонусами
CREATE POLICY "HR can manage bonuses"
    ON monthly_bonuses FOR ALL
    USING (auth.is_hr_or_admin());

-- ============================================================
-- SALARY HISTORY
-- ============================================================

ALTER TABLE salary_history ENABLE ROW LEVEL SECURITY;

-- Сотрудник может видеть свою историю зарплаты
CREATE POLICY "Employees can view own salary history"
    ON salary_history FOR SELECT
    USING (
        user_id = auth.uid()
        OR auth.is_hr_or_admin()
    );

-- Только HR может создавать записи
CREATE POLICY "HR can create salary history"
    ON salary_history FOR INSERT
    WITH CHECK (auth.is_hr_or_admin());

-- ============================================================
-- NOTIFICATION SETTINGS
-- ============================================================

ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- Пользователь управляет своими настройками
CREATE POLICY "Users can manage own notification settings"
    ON notification_settings FOR ALL
    USING (user_id = auth.uid());

-- ============================================================
-- NOTIFICATION TEMPLATES
-- ============================================================

ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

-- Все аутентифицированные могут читать активные шаблоны
CREATE POLICY "Users can view active templates"
    ON notification_templates FOR SELECT
    TO authenticated
    USING (is_active = true);

-- Только Admin может управлять шаблонами
CREATE POLICY "Admin can manage templates"
    ON notification_templates FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================
-- SYSTEM CONFIG
-- ============================================================

ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Все аутентифицированные могут читать конфигурацию
CREATE POLICY "Users can view config"
    ON system_config FOR SELECT
    TO authenticated
    USING (true);

-- Только Admin может изменять конфигурацию
CREATE POLICY "Admin can manage config"
    ON system_config FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================
-- BONUS DOCUMENT TYPES
-- ============================================================

ALTER TABLE bonus_document_types ENABLE ROW LEVEL SECURITY;

-- Все аутентифицированные могут читать активные типы
CREATE POLICY "Users can view active document types"
    ON bonus_document_types FOR SELECT
    TO authenticated
    USING (is_active = true);

-- HR/Admin могут управлять типами
CREATE POLICY "HR/Admin can manage document types"
    ON bonus_document_types FOR ALL
    USING (auth.is_hr_or_admin());

-- ============================================================
-- STORAGE POLICIES
-- ============================================================

-- Bucket: documents
-- Пользователь может загружать в свою папку
CREATE POLICY "Users can upload to own folder in documents"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'documents'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Пользователь может читать свои документы
CREATE POLICY "Users can view own documents"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'documents'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- HR/Admin могут читать все документы
CREATE POLICY "HR can view all documents"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'documents'
        AND auth.is_hr_or_admin()
    );

-- Bucket: verification-photos
-- Пользователь может загружать фото верификации
CREATE POLICY "Users can upload verification photos"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'verification-photos'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- HR/Brigadir могут видеть все фото верификации
CREATE POLICY "HR/Brigadir can view verification photos"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'verification-photos'
        AND (
            auth.uid()::text = (storage.foldername(name))[1]
            OR auth.is_hr_or_admin()
            OR auth.is_brigadir()
        )
    );

-- Bucket: resumes
-- Кандидат может загружать резюме
CREATE POLICY "Candidates can upload resumes"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'resumes'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- HR может видеть все резюме
CREATE POLICY "HR can view all resumes"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'resumes'
        AND auth.is_hr_or_admin()
    );

-- Bucket: certificates
-- Пользователь может загружать сертификаты
CREATE POLICY "Users can upload certificates"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'certificates'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Пользователь может видеть свои сертификаты
CREATE POLICY "Users can view own certificates"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'certificates'
        AND (
            auth.uid()::text = (storage.foldername(name))[1]
            OR auth.is_hr_or_admin()
        )
    );

-- Bucket: avatars (public bucket)
-- Любой аутентифицированный может загружать аватар
CREATE POLICY "Users can upload own avatar"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'avatars'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Любой может видеть аватары (public bucket)
CREATE POLICY "Anyone can view avatars"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'avatars');

-- Пользователь может обновлять свой аватар
CREATE POLICY "Users can update own avatar"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'avatars'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Пользователь может удалять свой аватар
CREATE POLICY "Users can delete own avatar"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'avatars'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- ============================================================
-- REALTIME SUBSCRIPTIONS (опционально)
-- ============================================================

-- Разрешить realtime подписки на таблицы
-- Выполните в Supabase Dashboard → Database → Replication

-- ALTER PUBLICATION supabase_realtime ADD TABLE users;
-- ALTER PUBLICATION supabase_realtime ADD TABLE user_skills;
-- ALTER PUBLICATION supabase_realtime ADD TABLE test_attempts;
-- ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
-- ALTER PUBLICATION supabase_realtime ADD TABLE quality_incidents;

-- ============================================================
-- END OF RLS POLICIES
-- ============================================================
