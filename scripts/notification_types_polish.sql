-- ============================================================================
-- KOMPLETNE TYPY POWIADOMIEŃ DLA WSZYSTKICH RÓL
-- ============================================================================
-- Pełny system powiadomień bez prefiksów ról w etykietach
-- Uruchom ten skrypt w Supabase SQL Editor
-- ============================================================================

-- KROK 1: Dodaj brakujący constraint jeśli nie istnieje
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'notification_settings_user_id_setting_type_key'
      AND table_name = 'notification_settings'
  ) THEN
    ALTER TABLE notification_settings
    ADD CONSTRAINT notification_settings_user_id_setting_type_key
    UNIQUE (user_id, setting_type);

    RAISE NOTICE 'Constraint added successfully';
  ELSE
    RAISE NOTICE 'Constraint already exists';
  END IF;
END $$;

-- KROK 2: Usuń wszystkie istniejące domyślne powiadomienia
DELETE FROM notification_settings WHERE user_id IS NULL;

-- ============================================================================
-- POWIADOMIENIA DLA KANDYDATÓW (Candidate)
-- ============================================================================
INSERT INTO notification_settings (id, user_id, setting_type, label, system, email, sms, category, target_role)
VALUES
  -- Rejestracja i profil
  (gen_random_uuid(), NULL, 'cand_registered', 'Pomyślna rejestracja w systemie', true, true, false, 'Profil', 'candidate'),
  (gen_random_uuid(), NULL, 'cand_profile_updated', 'Dane profilu zostały zmienione', true, false, false, 'Profil', 'candidate'),

  -- Umowa i dane
  (gen_random_uuid(), NULL, 'cand_contract_data_requested', 'Zażądano danych do umowy', true, true, true, 'Umowa', 'candidate'),
  (gen_random_uuid(), NULL, 'cand_contract_data_submitted', 'Dane do umowy zostały wysłane', true, true, false, 'Umowa', 'candidate'),

  -- Dokumenty
  (gen_random_uuid(), NULL, 'cand_document_uploaded', 'Dokument został przesłany', true, false, false, 'Dokumenty', 'candidate'),
  (gen_random_uuid(), NULL, 'cand_document_approved', 'Dokument został zatwierdzony', true, true, false, 'Dokumenty', 'candidate'),
  (gen_random_uuid(), NULL, 'cand_document_rejected', 'Dokument został odrzucony', true, true, true, 'Dokumenty', 'candidate'),

  -- Testy
  (gen_random_uuid(), NULL, 'cand_test_assigned', 'Przydzielono nowy test', true, true, false, 'Testy', 'candidate'),
  (gen_random_uuid(), NULL, 'cand_test_passed', 'Test został zaliczony', true, true, false, 'Testy', 'candidate'),
  (gen_random_uuid(), NULL, 'cand_test_failed', 'Test nie został zaliczony', true, true, false, 'Testy', 'candidate'),

  -- Praktyka
  (gen_random_uuid(), NULL, 'cand_practice_assigned', 'Przydzielono praktykę', true, true, true, 'Praktyka', 'candidate'),
  (gen_random_uuid(), NULL, 'cand_practice_approved', 'Praktyka została zatwierdzona', true, true, false, 'Praktyka', 'candidate'),
  (gen_random_uuid(), NULL, 'cand_practice_rejected', 'Praktyka została odrzucona', true, true, true, 'Praktyka', 'candidate'),

  -- Status
  (gen_random_uuid(), NULL, 'cand_moved_to_trial', 'Przeniesiono na okres próbny', true, true, true, 'Status', 'candidate'),
  (gen_random_uuid(), NULL, 'cand_trial_ending_soon', 'Zbliża się koniec okresu próbnego', true, true, true, 'Status', 'candidate'),
  (gen_random_uuid(), NULL, 'cand_status_changed', 'Status został zmieniony', true, true, false, 'Status', 'candidate'),
  (gen_random_uuid(), NULL, 'cand_rejected', 'Wniosek został odrzucony', true, true, true, 'Status', 'candidate'),
  (gen_random_uuid(), NULL, 'cand_portal_blocked', 'Dostęp do portalu został zablokowany', true, true, true, 'Status', 'candidate');

-- ============================================================================
-- POWIADOMIENIA DLA PRACOWNIKÓW (Employee)
-- ============================================================================
INSERT INTO notification_settings (id, user_id, setting_type, label, system, email, sms, category, target_role)
VALUES
  -- Brygadzista
  (gen_random_uuid(), NULL, 'emp_brigadir_assigned', 'Przydzielono brygadzistę', true, true, false, 'Zespół', 'employee'),
  (gen_random_uuid(), NULL, 'emp_brigadir_changed', 'Brygadzista został zmieniony', true, true, false, 'Zespół', 'employee'),

  -- Umiejętności
  (gen_random_uuid(), NULL, 'emp_skill_confirmed', 'Umiejętność została potwierdzona', true, true, false, 'Umiejętności', 'employee'),
  (gen_random_uuid(), NULL, 'emp_skill_rejected', 'Umiejętność została odrzucona', true, true, false, 'Umiejętności', 'employee'),
  (gen_random_uuid(), NULL, 'emp_skill_practice_ready', 'Gotowy do praktycznej weryfikacji', true, true, false, 'Umiejętności', 'employee'),

  -- Stawka i bonusy
  (gen_random_uuid(), NULL, 'emp_rate_changed', 'Stawka została zmieniona', true, true, true, 'Finanse', 'employee'),
  (gen_random_uuid(), NULL, 'emp_monthly_bonus', 'Naliczono miesięczny bonus', true, true, false, 'Finanse', 'employee'),
  (gen_random_uuid(), NULL, 'emp_bonus_blocked', 'Blokada bonusu do końca miesiąca', true, true, true, 'Finanse', 'employee'),

  -- Jakość pracy
  (gen_random_uuid(), NULL, 'emp_quality_warning', 'Ostrzeżenie o jakości pracy', true, true, true, 'Jakość', 'employee'),
  (gen_random_uuid(), NULL, 'emp_quality_incident', 'Zarejestrowano incydent jakościowy', true, true, true, 'Jakość', 'employee'),
  (gen_random_uuid(), NULL, 'emp_badge_earned', 'Otrzymano nagrodę/odznakę', true, true, false, 'Osiągnięcia', 'employee'),
  (gen_random_uuid(), NULL, 'emp_note_added', 'Dodano notatkę o pracy', true, false, false, 'Jakość', 'employee'),

  -- Program poleceń
  (gen_random_uuid(), NULL, 'emp_referral_accepted', 'Polecony kandydat został zaakceptowany', true, true, false, 'Program poleceń', 'employee'),
  (gen_random_uuid(), NULL, 'emp_referral_bonus', 'Naliczono bonus za polecenie', true, true, false, 'Program poleceń', 'employee'),
  (gen_random_uuid(), NULL, 'emp_referral_hired', 'Polecony pracownik został zatrudniony', true, true, false, 'Program poleceń', 'employee'),

  -- Dokumenty i umowa
  (gen_random_uuid(), NULL, 'emp_document_expiring', 'Dokument wygasa za 30 dni', true, true, true, 'Dokumenty', 'employee'),
  (gen_random_uuid(), NULL, 'emp_contract_expiring', 'Umowa wygasa za 30 dni', true, true, true, 'Umowa', 'employee'),
  (gen_random_uuid(), NULL, 'emp_contract_permanent', 'Przeniesiono na umowę stałą', true, true, false, 'Umowa', 'employee'),

  -- Status
  (gen_random_uuid(), NULL, 'emp_hired', 'Przyjęto na stałe zatrudnienie', true, true, true, 'Status', 'employee'),
  (gen_random_uuid(), NULL, 'emp_terminated', 'Powiadomienie o zwolnieniu', true, true, true, 'Status', 'employee');

-- ============================================================================
-- POWIADOMIENIA DLA BRYGADZISTÓW (Brigadir)
-- ============================================================================
INSERT INTO notification_settings (id, user_id, setting_type, label, system, email, sms, category, target_role)
VALUES
  -- Zarządzanie zespołem
  (gen_random_uuid(), NULL, 'brig_employee_added', 'Dodano pracownika do brygady', true, true, false, 'Zespół', 'brigadir'),
  (gen_random_uuid(), NULL, 'brig_employee_removed', 'Usunięto pracownika z brygady', true, true, false, 'Zespół', 'brigadir'),

  -- Weryfikacja praktyki
  (gen_random_uuid(), NULL, 'brig_practice_assigned', 'Przydzielono praktykę do weryfikacji', true, true, true, 'Praktyka', 'brigadir'),
  (gen_random_uuid(), NULL, 'brig_practice_pending', 'Pracownik oczekuje na weryfikację praktyki', true, true, false, 'Praktyka', 'brigadir'),
  (gen_random_uuid(), NULL, 'brig_theory_completed', 'Pracownik ukończył teorię, czeka na praktykę', true, true, false, 'Praktyka', 'brigadir'),

  -- Zespół - statusy
  (gen_random_uuid(), NULL, 'brig_employee_trial_ending', 'Kończy się okres próbny pracownika', true, true, true, 'Zespół', 'brigadir'),
  (gen_random_uuid(), NULL, 'brig_employee_document_uploaded', 'Pracownik przesłał dokument', true, false, false, 'Dokumenty', 'brigadir'),
  (gen_random_uuid(), NULL, 'brig_quality_incident_team', 'Incydent jakościowy u pracownika brygady', true, true, true, 'Jakość', 'brigadir'),
  (gen_random_uuid(), NULL, 'brig_employee_skill_completed', 'Pracownik ukończył umiejętność', true, false, false, 'Umiejętności', 'brigadir');

-- ============================================================================
-- POWIADOMIENIA DLA HR
-- ============================================================================
INSERT INTO notification_settings (id, user_id, setting_type, label, system, email, sms, category, target_role)
VALUES
  -- Kandydaci
  (gen_random_uuid(), NULL, 'hr_cand_reg', 'Nowa rejestracja kandydata', true, true, false, 'Kandydaci', 'hr'),
  (gen_random_uuid(), NULL, 'hr_cand_docs_uploaded', 'Kandydat przesłał dokumenty', true, true, false, 'Kandydaci', 'hr'),
  (gen_random_uuid(), NULL, 'hr_cand_tests_completed', 'Kandydat ukończył testy', true, true, false, 'Kandydaci', 'hr'),
  (gen_random_uuid(), NULL, 'hr_cand_contract_data', 'Kandydat wysłał dane do umowy', true, true, false, 'Kandydaci', 'hr'),
  (gen_random_uuid(), NULL, 'hr_cand_ready_for_trial', 'Kandydat gotowy do okresu próbnego', true, true, false, 'Kandydaci', 'hr'),

  -- Pracownicy
  (gen_random_uuid(), NULL, 'hr_trial_ending_7days', 'Okres próbny kończy się za 7 dni', true, true, true, 'Pracownicy', 'hr'),
  (gen_random_uuid(), NULL, 'hr_contract_expiring_30days', 'Umowa wygasa za 30 dni', true, true, false, 'Pracownicy', 'hr'),
  (gen_random_uuid(), NULL, 'hr_document_expiring_30days', 'Dokument pracownika wygasa za 30 dni', true, true, false, 'Pracownicy', 'hr'),

  -- Jakość i incydenty
  (gen_random_uuid(), NULL, 'hr_quality_incident_critical', 'Krytyczny incydent jakościowy', true, true, true, 'Jakość', 'hr'),
  (gen_random_uuid(), NULL, 'hr_quality_report_ready', 'Raport o jakości jest gotowy', true, true, false, 'Raporty', 'hr'),

  -- Zwolnienia
  (gen_random_uuid(), NULL, 'hr_termination_request', 'Wniosek o zwolnienie pracownika', true, true, false, 'Zwolnienia', 'hr'),
  (gen_random_uuid(), NULL, 'hr_employee_terminated', 'Pracownik został zwolniony', true, false, false, 'Zwolnienia', 'hr'),

  -- Program poleceń
  (gen_random_uuid(), NULL, 'hr_referral_pending', 'Polecenie oczekuje na rozpatrzenie', true, true, false, 'Program poleceń', 'hr'),
  (gen_random_uuid(), NULL, 'hr_referral_bonus_paid', 'Wypłacono bonus za polecenie', true, false, false, 'Program poleceń', 'hr'),

  -- System
  (gen_random_uuid(), NULL, 'hr_monthly_report_ready', 'Miesięczny raport jest gotowy', true, true, false, 'Raporty', 'hr'),
  (gen_random_uuid(), NULL, 'hr_skills_verification_pending', 'Umiejętności oczekują na weryfikację', true, true, false, 'Umiejętności', 'hr');

-- ============================================================================
-- POWIADOMIENIA DLA KOORDYNATORÓW (Coordinator)
-- ============================================================================
INSERT INTO notification_settings (id, user_id, setting_type, label, system, email, sms, category, target_role)
VALUES
  -- Zespół projektu
  (gen_random_uuid(), NULL, 'coord_employee_assigned', 'Nowy pracownik przydzielony do projektu', true, true, false, 'Zespół', 'coordinator'),
  (gen_random_uuid(), NULL, 'coord_team_changed', 'Zmiana składu zespołu projektu', true, true, false, 'Zespół', 'coordinator'),
  (gen_random_uuid(), NULL, 'coord_employee_removed', 'Pracownik usunięty z projektu', true, true, false, 'Zespół', 'coordinator'),

  -- Jakość i raporty
  (gen_random_uuid(), NULL, 'coord_quality_report_ready', 'Raport o jakości projektu jest gotowy', true, true, false, 'Raporty', 'coordinator'),
  (gen_random_uuid(), NULL, 'coord_quality_incident', 'Incydent jakościowy w projekcie', true, true, true, 'Jakość', 'coordinator'),
  (gen_random_uuid(), NULL, 'coord_project_milestone', 'Osiągnięto kamień milowy projektu', true, true, false, 'Projekt', 'coordinator'),

  -- Pracownicy
  (gen_random_uuid(), NULL, 'coord_contract_expiring', 'Wygasa umowa pracownika projektu', true, true, false, 'Pracownicy', 'coordinator'),
  (gen_random_uuid(), NULL, 'coord_document_expiring', 'Wygasa dokument pracownika projektu', true, true, false, 'Pracownicy', 'coordinator'),
  (gen_random_uuid(), NULL, 'coord_skills_shortage', 'Niedobór pracowników z umiejętnościami', true, true, true, 'Zespół', 'coordinator');

-- ============================================================================
-- POWIADOMIENIA DLA KIEROWNIKÓW ROBÓT (Work Manager)
-- ============================================================================
INSERT INTO notification_settings (id, user_id, setting_type, label, system, email, sms, category, target_role)
VALUES
  -- Przydzielenie i projekt
  (gen_random_uuid(), NULL, 'wm_assigned_to_project', 'Przydzielono do nowego obiektu', true, true, false, 'Projekty', 'work_manager'),
  (gen_random_uuid(), NULL, 'wm_team_changed', 'Zmiana zespołu na obiekcie', true, true, false, 'Zespół', 'work_manager'),

  -- Jakość
  (gen_random_uuid(), NULL, 'wm_execution_report_ready', 'Raport o wykonaniu jest gotowy', true, true, false, 'Raporty', 'work_manager'),
  (gen_random_uuid(), NULL, 'wm_quality_incident', 'Incydent jakościowy na obiekcie', true, true, true, 'Jakość', 'work_manager'),
  (gen_random_uuid(), NULL, 'wm_inspection_scheduled', 'Zaplanowano inspekcję obiektu', true, true, true, 'Inspekcje', 'work_manager'),

  -- Pracownicy
  (gen_random_uuid(), NULL, 'wm_skills_shortage', 'Niedobór pracowników z umiejętnościami', true, true, true, 'Zespół', 'work_manager'),
  (gen_random_uuid(), NULL, 'wm_document_expiring_site', 'Wygasa dokument pracownika na obiekcie', true, true, true, 'Dokumenty', 'work_manager'),
  (gen_random_uuid(), NULL, 'wm_employee_issue', 'Problem z pracownikiem na obiekcie', true, true, true, 'Zespół', 'work_manager');

-- ============================================================================
-- WERYFIKACJA
-- ============================================================================
SELECT
  'Utworzone typy powiadomień ogółem:' as info,
  COUNT(*) as total
FROM notification_settings
WHERE user_id IS NULL;

SELECT
  'Typy powiadomień według ról:' as info,
  COALESCE(target_role, 'WSZYSTKIE_ROLE') as rola,
  COUNT(*) as liczba
FROM notification_settings
WHERE user_id IS NULL
GROUP BY target_role
ORDER BY target_role;

-- Pokaż wszystkie powiadomienia pogrupowane według kategorii
SELECT
  category as kategoria,
  target_role as rola,
  COUNT(*) as liczba_powiadomien
FROM notification_settings
WHERE user_id IS NULL
GROUP BY category, target_role
ORDER BY category, target_role;

-- ============================================================================
-- SUKCES! Powinieneś zobaczyć:
-- - 75 typów powiadomień ogółem
-- - Podział według ról
-- - Podział według kategorii
-- ============================================================================
