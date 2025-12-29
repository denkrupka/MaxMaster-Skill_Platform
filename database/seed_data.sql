-- ============================================================
-- MAXMASTER SKILLS PLATFORM - SEED DATA
-- ============================================================
-- Начальные данные для базы данных
-- Запускать ПОСЛЕ schema.sql
-- ============================================================

-- ============================================================
-- POSITIONS (Должности)
-- ============================================================

INSERT INTO positions (id, name, responsibilities, required_skill_ids, min_monthly_rate, max_monthly_rate, brigadier_bonuses, "order") VALUES
('11111111-1111-1111-1111-111111111111', 'Pomocnik', ARRAY['Dbanie o porządek', 'Pomoc w transporcie'], ARRAY[]::UUID[], NULL, NULL, '[]', 1),
('22222222-2222-2222-2222-222222222222', 'Elektromonter', ARRAY['Montaż tras kablowych', 'Układanie kabli'], ARRAY[]::UUID[], NULL, NULL, '[]', 2),
('33333333-3333-3333-3333-333333333333', 'Elektryk', ARRAY['Prefabrykacja rozdzielnic', 'Pomiary'], ARRAY[]::UUID[], NULL, NULL, '[]', 3),
('44444444-4444-4444-4444-444444444444', 'Brygadzista', ARRAY['Nadzór nad zespołem', 'Odbiory'], ARRAY[]::UUID[], NULL, NULL, '[{"id": "b1", "name": "Premia za brak usterki", "amount": 500}]', 4),
('55555555-5555-5555-5555-555555555555', 'Koordynator Robót', ARRAY['Harmonogramowanie', 'Materiały'], ARRAY[]::UUID[], 8000, 12000, '[]', 5),
('66666666-6666-6666-6666-666666666666', 'Kierownik Robót', ARRAY['Nadzór ogólny', 'Kontakt z inwestorem'], ARRAY[]::UUID[], 10000, 18000, '[]', 6);

-- ============================================================
-- SKILLS (Навыки)
-- ============================================================

INSERT INTO skills (id, name_pl, category, description_pl, verification_type, hourly_bonus, required_pass_rate, is_active, is_archived) VALUES
-- Montaż
('a0000001-0000-0000-0000-000000000001', 'Czytanie projektu i montaż', 'PRACE MONTAŻOWE', 'Umejętność czytania schematów i montażu wg projektu', 'theory_practice', 1.0, 80, TRUE, FALSE),

-- Elektryka
('a0000002-0000-0000-0000-000000000002', 'Gniazda, Wyłączniki 230V', 'INSTALACJE ELEKTRYCZNE', 'Montaż rozetek i wyłączników', 'theory_practice', 0.5, 80, TRUE, FALSE),
('a0000003-0000-0000-0000-000000000003', 'Montaż linii zasilającej', 'INSTALACJE ELEKTRYCZNE', 'Montaż linii oświetleniowej i zasilającej', 'theory_practice', 1.0, 80, TRUE, FALSE),

-- Teletechnika
('a0000004-0000-0000-0000-000000000004', 'LAN – Sieci strukturalne', 'TELETECHNICZNE', 'Montaż sieci, RJ-45, testowanie', 'theory_practice', 1.5, 80, TRUE, FALSE),
('a0000005-0000-0000-0000-000000000005', 'CCTV - Kamery IP', 'TELETECHNICZNE', 'Montaż i konfiguracja kamer IP', 'theory_practice', 2.0, 80, TRUE, FALSE),
('a0000006-0000-0000-0000-000000000006', 'Światłowody', 'TELETECHNICZNE', 'Montaż i spawanie światłowodów', 'theory_practice', 2.5, 85, TRUE, FALSE),

-- Uprawnienia
('a0000007-0000-0000-0000-000000000007', 'SEP E z pomiarami', 'UPRAWNIENIA', 'Świadectwo kwalifikacji E', 'document', 0.5, 100, TRUE, FALSE),
('a0000008-0000-0000-0000-000000000008', 'UDT - Podnośniki', 'UPRAWNIENIA', 'Uprawnienia UDT', 'document', 1.0, 100, TRUE, FALSE);

-- ============================================================
-- USERS (Пользователи)
-- ============================================================

-- Admin
INSERT INTO users (id, email, password_hash, first_name, last_name, role, status, base_rate, hired_date) VALUES
('u0000000-0000-0000-0000-000000000001', 'admin@maxmaster.pl', crypt('admin123', gen_salt('bf')), 'Piotr', 'Adminowicz', 'admin', 'active', 0, '2020-01-01');

-- HR
INSERT INTO users (id, email, password_hash, first_name, last_name, role, status, base_rate, hired_date) VALUES
('u0000000-0000-0000-0000-000000000002', 'hr@maxmaster.pl', crypt('hr123', gen_salt('bf')), 'Anna', 'Wiśniewska', 'hr', 'active', 28.0, '2021-09-01');

-- Brigadir
INSERT INTO users (id, email, password_hash, first_name, last_name, role, status, base_rate, hired_date, phone, contract_type) VALUES
('u0000000-0000-0000-0000-000000000003', 'brigadir@maxmaster.pl', crypt('brig123', gen_salt('bf')), 'Tomasz', 'Nowak', 'brigadir', 'active', 30.0, '2020-05-10', '700-555-444', 'b2b');

-- Coordinator
INSERT INTO users (id, email, password_hash, first_name, last_name, role, status, base_rate, hired_date, phone, contract_type) VALUES
('u0000000-0000-0000-0000-000000000004', 'coord@maxmaster.pl', crypt('coord123', gen_salt('bf')), 'Krzysztof', 'Koordynacki', 'coordinator', 'active', 35.0, '2019-06-01', '600-111-222', 'b2b');

-- Active Employee
INSERT INTO users (id, email, password_hash, first_name, last_name, role, status, base_rate, hired_date, assigned_brigadir_id, phone, contract_type) VALUES
('u0000000-0000-0000-0000-000000000005', 'employee@maxmaster.pl', crypt('emp123', gen_salt('bf')), 'Jan', 'Kowalski', 'employee', 'active', 24.0, '2023-01-15', 'u0000000-0000-0000-0000-000000000003', '500-123-456', 'uop');

-- Trial Employee
INSERT INTO users (id, email, password_hash, first_name, last_name, role, status, base_rate, hired_date, trial_end_date, assigned_brigadir_id, phone, contract_type) VALUES
('u0000000-0000-0000-0000-000000000006', 'newbie@maxmaster.pl', crypt('trial123', gen_salt('bf')), 'Adam', 'Nowicjusz', 'employee', 'trial', 24.0, '2023-11-01', '2023-12-01', 'u0000000-0000-0000-0000-000000000003', '600-987-654', 'uz');

-- Referrals (Poleceni przez Jana Kowalskiego)
INSERT INTO users (id, email, password_hash, first_name, last_name, role, status, base_rate, hired_date, referred_by_id, target_position, contract_type) VALUES
('u0000000-0000-0000-0000-000000000007', 'piotr.ref@test.pl', crypt('ref123', gen_salt('bf')), 'Piotr', 'Polecony', 'employee', 'active', 24, '2023-08-01', 'u0000000-0000-0000-0000-000000000005', 'Elektromonter', 'uop'),
('u0000000-0000-0000-0000-000000000008', 'igor.ref@test.pl', crypt('ref123', gen_salt('bf')), 'Igor', 'Nowy', 'employee', 'trial', 24, '2023-11-20', 'u0000000-0000-0000-0000-000000000005', 'Pomocnik', 'uz'),
('u0000000-0000-0000-0000-000000000009', 'marek.zap@test.pl', crypt('ref123', gen_salt('bf')), 'Marek', 'Zaproszony', 'candidate', 'invited', 24, '2024-05-20', 'u0000000-0000-0000-0000-000000000005', 'Pomocnik', 'uz');

-- Candidates
INSERT INTO users (id, email, password_hash, first_name, last_name, role, status, base_rate, hired_date, phone, notes, source, resume_url, contract_type) VALUES
('c0000000-0000-0000-0000-000000000001', 'marek.k@gmail.com', crypt('cand123', gen_salt('bf')), 'Marek', 'Kandydacki', 'candidate', 'tests_completed', 24.0, '2023-10-20', '501-202-303', 'Dobre wrażenie, ma doświadczenie z CCTV.', 'Pracuj.pl', 'resume_marek.pdf', 'uz'),
('c0000000-0000-0000-0000-000000000002', 'pawel.n@onet.pl', crypt('cand123', gen_salt('bf')), 'Paweł', 'Nowy', 'candidate', 'started', 24.0, '2023-10-25', '505-606-707', NULL, 'Polecenie', NULL, 'uz'),
('c0000000-0000-0000-0000-000000000003', 'tomasz.z@wp.pl', crypt('cand123', gen_salt('bf')), 'Tomasz', 'Zieliński', 'candidate', 'invited', 24.0, '2023-10-24', '509-111-222', NULL, 'LinkedIn', NULL, 'b2b');

-- ============================================================
-- USER_SKILLS (Навыки пользователей)
-- ============================================================

-- Jan Kowalski's confirmed skills
INSERT INTO user_skills (id, user_id, skill_id, status, theory_score, confirmed_at) VALUES
('us000001-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000001', 'confirmed', 90, '2023-02-01 10:00:00'),
('us000002-0000-0000-0000-000000000002', 'u0000000-0000-0000-0000-000000000005', 'a0000002-0000-0000-0000-000000000002', 'confirmed', 85, '2023-03-15 12:00:00');

-- Jan Kowalski's pending skill (theory passed, waiting for practice)
INSERT INTO user_skills (id, user_id, skill_id, status, theory_score, effective_from) VALUES
('us000003-0000-0000-0000-000000000003', 'u0000000-0000-0000-0000-000000000005', 'a0000004-0000-0000-0000-000000000004', 'theory_passed', 95, '2023-11-01');

-- ============================================================
-- TESTS
-- ============================================================

-- Test LAN
INSERT INTO tests (id, skill_ids, title, time_limit_minutes, is_active, is_archived) VALUES
('t0000001-0000-0000-0000-000000000001', ARRAY['a0000004-0000-0000-0000-000000000004']::UUID[], 'Test wiedzy: LAN – Sieci strukturalne', 15, TRUE, FALSE);

-- Questions for LAN test
INSERT INTO questions (id, test_id, text, options, correct_option_indices, grading_strategy, question_order) VALUES
('q0000001-0001-0000-0000-000000000001', 't0000001-0000-0000-0000-000000000001', 'Jaka jest maksymalna długość segmentu kabla UTP kat. 6?', ARRAY['50m', '100m', '150m', '200m'], ARRAY[1], 'all_correct', 1),
('q0000001-0001-0000-0000-000000000002', 't0000001-0000-0000-0000-000000000001', 'Ile par żył znajduje się w standardowym kablu UTP?', ARRAY['2 pary', '4 pary', '6 par', '8 par'], ARRAY[1], 'all_correct', 2),
('q0000001-0001-0000-0000-000000000003', 't0000001-0000-0000-0000-000000000001', 'Który standard okablowania jest najczęstszy?', ARRAY['T568A', 'T568B', 'RS-232', 'IEEE 802.3'], ARRAY[1], 'all_correct', 3),
('q0000001-0001-0000-0000-000000000004', 't0000001-0000-0000-0000-000000000001', 'Do czego służy patch panel?', ARRAY['Zasilanie', 'Organizacja połączeń', 'Chłodzenie', 'Montaż serwerów'], ARRAY[1], 'all_correct', 4),
('q0000001-0001-0000-0000-000000000005', 't0000001-0000-0000-0000-000000000001', 'Jakie narzędzie testuje przewody?', ARRAY['Multimetr', 'Tester sieciowy', 'Oscyloskop', 'Miernik rezystancji'], ARRAY[1], 'all_correct', 5);

-- Test Elektryka
INSERT INTO tests (id, skill_ids, title, time_limit_minutes, is_active, is_archived) VALUES
('t0000002-0000-0000-0000-000000000002', ARRAY['a0000002-0000-0000-0000-000000000002']::UUID[], 'Test wiedzy: Instalacje elektryczne', 10, TRUE, FALSE);

-- Questions for Elektryka test
INSERT INTO questions (id, test_id, text, options, correct_option_indices, grading_strategy, question_order) VALUES
('q0000002-0001-0000-0000-000000000001', 't0000002-0000-0000-0000-000000000002', 'Jakie napięcie jest standardem w domach w Polsce?', ARRAY['110V', '230V', '400V', '12V'], ARRAY[1], 'all_correct', 1),
('q0000002-0001-0000-0000-000000000002', 't0000002-0000-0000-0000-000000000002', 'Kolor przewodu ochronnego (PE)?', ARRAY['Niebieski', 'Brązowy', 'Żółto-zielony', 'Czarny'], ARRAY[2], 'all_correct', 2),
('q0000002-0001-0000-0000-000000000003', 't0000002-0000-0000-0000-000000000002', 'RCD chroni przed?', ARRAY['Zużyciem prądu', 'Porażeniem', 'Niskim napięciem', 'Brak poprawnej odpowiedzi'], ARRAY[1], 'all_correct', 3);

-- ============================================================
-- TEST ATTEMPTS
-- ============================================================

INSERT INTO test_attempts (id, user_id, test_id, score, passed, completed_at) VALUES
('ta000001-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 't0000001-0000-0000-0000-000000000001', 100, TRUE, '2023-10-21 10:30:00'),
('ta000002-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 't0000002-0000-0000-0000-000000000002', 85, TRUE, '2023-10-21 11:00:00'),
('ta000003-0000-0000-0000-000000000003', 'u0000000-0000-0000-0000-000000000005', 't0000001-0000-0000-0000-000000000001', 90, TRUE, '2023-02-01 09:00:00'),
('ta000004-0000-0000-0000-000000000004', 'u0000000-0000-0000-0000-000000000006', 't0000002-0000-0000-0000-000000000002', 95, TRUE, '2023-11-05 09:00:00');

-- ============================================================
-- PRACTICAL CHECK TEMPLATES
-- ============================================================

INSERT INTO practical_check_templates (id, skill_id, title_pl, min_points_to_pass, items) VALUES
('pt000001-0000-0000-0000-000000000001', 'a0000004-0000-0000-0000-000000000004', 'Weryfikacja: Sieci LAN', 10, '[
  {"id": 1, "text_pl": "Prawidłowo zarobione 3 końcówki RJ-45", "required": true, "points": 3},
  {"id": 2, "text_pl": "Ułożenie kabli w szafie RACK (cable management)", "required": true, "points": 2},
  {"id": 3, "text_pl": "Oznakowanie przewodów", "required": true, "points": 2},
  {"id": 4, "text_pl": "Podłączenie do patch panelu", "required": true, "points": 2},
  {"id": 5, "text_pl": "Test miernikiem (PASS)", "required": true, "points": 3}
]'),
('pt000002-0000-0000-0000-000000000002', 'a0000002-0000-0000-0000-000000000002', 'Weryfikacja: Gniazda i Wyłączniki', 8, '[
  {"id": 1, "text_pl": "Podłączenie fazy, neutrala, PE", "required": true, "points": 4},
  {"id": 2, "text_pl": "Mocowanie puszek", "required": true, "points": 2},
  {"id": 3, "text_pl": "Estetyka (poziomowanie)", "required": false, "points": 1},
  {"id": 4, "text_pl": "Test działania", "required": true, "points": 3}
]');

-- ============================================================
-- LIBRARY RESOURCES
-- ============================================================

INSERT INTO library_resources (id, title, description, type, category, categories, skill_ids, url, is_archived) VALUES
('lr000001-0000-0000-0000-000000000001', 'Standard T568A/B', 'Standardy okablowania strukturalnego', 'pdf', 'TELETECHNICZNE', ARRAY['TELETECHNICZNE']::skill_category[], ARRAY['a0000004-0000-0000-0000-000000000004']::UUID[], '/docs/t568.pdf', FALSE),
('lr000002-0000-0000-0000-000000000002', 'Jak zarobić końcówkę RJ-45', 'Video tutorial: Zarabianie końcówek RJ-45', 'video', 'TELETECHNICZNE', ARRAY['TELETECHNICZNE']::skill_category[], ARRAY['a0000004-0000-0000-0000-000000000004']::UUID[], 'https://youtube.com/...', FALSE),
('lr000003-0000-0000-0000-000000000003', 'Normy SEP - Podstawy', 'Podstawowe informacje o normach SEP', 'pdf', 'INSTALACJE ELEKTRYCZNE', ARRAY['INSTALACJE ELEKTRYCZNE']::skill_category[], ARRAY['a0000002-0000-0000-0000-000000000002', 'a0000003-0000-0000-0000-000000000003']::UUID[], '/docs/sep.pdf', FALSE),
('lr000004-0000-0000-0000-000000000004', 'BHP na budowie', 'Podstawowe zasady BHP', 'pdf', 'INNE', ARRAY['INNE']::skill_category[], ARRAY[]::UUID[], '/docs/bhp.pdf', FALSE),
('lr000005-0000-0000-0000-000000000005', 'Regulamin Pracy', 'Regulamin pracy MaxMaster', 'pdf', 'TECZKA STANOWISKOWA', ARRAY['TECZKA STANOWISKOWA']::skill_category[], ARRAY[]::UUID[], '#', FALSE),
('lr000006-0000-0000-0000-000000000006', 'Struktura Organizacyjna', 'Struktura organizacyjna firmy', 'pdf', 'TECZKA STANOWISKOWA', ARRAY['TECZKA STANOWISKOWA']::skill_category[], ARRAY[]::UUID[], '#', FALSE),
('lr000007-0000-0000-0000-000000000007', 'Polityka Jakości', 'Polityka jakości MaxMaster', 'pdf', 'TECZKA STANOWISKOWA', ARRAY['TECZKA STANOWISKOWA']::skill_category[], ARRAY[]::UUID[], '#', FALSE),
('lr000008-0000-0000-0000-000000000008', 'Wniosek Urlopowy', 'Formularz wniosku urlopowego', 'pdf', 'TECZKA PRACOWNICZA', ARRAY['TECZKA PRACOWNICZA']::skill_category[], ARRAY[]::UUID[], '#', FALSE),
('lr000009-0000-0000-0000-000000000009', 'Zasady Premiowania', 'System premiowania pracowników', 'pdf', 'TECZKA PRACOWNICZA', ARRAY['TECZKA PRACOWNICZA']::skill_category[], ARRAY[]::UUID[], '#', FALSE),
('lr000010-0000-0000-0000-000000000010', 'Karta Obiegowa', 'Karta obiegowa pracownika', 'pdf', 'TECZKA PRACOWNICZA', ARRAY['TECZKA PRACOWNICZA']::skill_category[], ARRAY[]::UUID[], '#', FALSE);

-- ============================================================
-- CANDIDATE HISTORY
-- ============================================================

INSERT INTO candidate_history (id, candidate_id, action, performed_by, created_at) VALUES
('ch000001-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Stworzono kandydata', 'HR', '2023-10-20 10:00:00'),
('ch000002-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'Wysłano link do testów (Email: marek.k@gmail.com)', 'System', '2023-10-20 10:05:00'),
('ch000003-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'Zaliczono test: LAN – Sieci strukturalne', 'Kandydat', '2023-10-21 10:30:00'),
('ch000004-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'Zaliczono test: Instalacje elektryczne', 'Kandydat', '2023-10-21 11:00:00');

-- ============================================================
-- QUALITY INCIDENTS
-- ============================================================

INSERT INTO quality_incidents (id, user_id, skill_id, incident_number, description, reported_by, image_url, created_at) VALUES
('qi000001-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000001', 1, 'Niedokładne czytanie schematu, błąd w trasie.', 'Tomasz Nowak', 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?w=500&auto=format&fit=crop&q=60', CURRENT_TIMESTAMP),
('qi000002-0000-0000-0000-000000000002', 'u0000000-0000-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000001', 2, 'Kolejny błąd przy montażu koryt. Wymagana ponowna weryfikacja.', 'Tomasz Nowak', NULL, CURRENT_TIMESTAMP),
('qi000003-0000-0000-0000-000000000003', 'u0000000-0000-0000-0000-000000000005', 'a0000002-0000-0000-0000-000000000002', 1, 'Błąd w montażu gniazd.', 'Tomasz Nowak', NULL, CURRENT_TIMESTAMP);

-- ============================================================
-- EMPLOYEE NOTES
-- ============================================================

INSERT INTO employee_notes (id, employee_id, author_id, category, severity, text, created_at) VALUES
('en000001-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000005', 'u0000000-0000-0000-0000-000000000003', 'Postawa', 'info', 'Bardzo zaangażowany w pracę, chętnie pomaga młodszym kolegom.', '2023-10-15 14:30:00'),
('en000002-0000-0000-0000-000000000002', 'u0000000-0000-0000-0000-000000000005', 'u0000000-0000-0000-0000-000000000003', 'Jakość', 'warning', 'Zwrócić uwagę na estetykę układania kabli w korytach. Było kilka poprawek.', '2023-11-02 09:15:00');

-- ============================================================
-- EMPLOYEE BADGES
-- ============================================================

INSERT INTO employee_badges (id, employee_id, author_id, month, type, description, visible_to_employee, created_at) VALUES
('eb000001-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000005', 'u0000000-0000-0000-0000-000000000003', '2023-10', 'Szybkość', 'Rekordowe tempo układania tras kablowych w tym miesiącu.', TRUE, '2023-10-30 10:00:00'),
('eb000002-0000-0000-0000-000000000002', 'u0000000-0000-0000-0000-000000000005', 'u0000000-0000-0000-0000-000000000003', '2023-11', 'Pomocność', 'Pomoc nowemu pracownikowi w aklimatyzacji.', TRUE, '2023-11-28 14:00:00');

-- ============================================================
-- SALARY HISTORY
-- ============================================================

INSERT INTO salary_history (id, user_id, change_date, reason, old_rate, new_rate, changed_by_id, created_at) VALUES
('sh000001-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000005', '2023-01-15', 'Zatrudnienie', 0, 24.00, 'u0000000-0000-0000-0000-000000000002', CURRENT_TIMESTAMP),
('sh000002-0000-0000-0000-000000000002', 'u0000000-0000-0000-0000-000000000005', '2023-02-02', 'Potwierdzona umiejętność: Czytanie projektu', 24.00, 25.00, 'u0000000-0000-0000-0000-000000000002', CURRENT_TIMESTAMP),
('sh000003-0000-0000-0000-000000000003', 'u0000000-0000-0000-0000-000000000005', '2023-05-10', 'Stałe premie (Plan + Usterki)', 25.00, 27.00, 'u0000000-0000-0000-0000-000000000002', CURRENT_TIMESTAMP);

-- ============================================================
-- NOTIFICATION TEMPLATES
-- ============================================================

INSERT INTO notification_templates (id, code, channel, subject, body, variables, is_active) VALUES
('nt000001-0000-0000-0000-000000000001', 'CAND_INVITE_LINK', 'both', 'Witaj w procesie rekrutacji MaxMaster', 'Cześć {{firstName}}, zapraszamy do portalu MaxMaster! Tutaj sprawdzisz swoją stawkę: {{portalUrl}}', ARRAY['firstName', 'portalUrl'], TRUE),
('nt000002-0000-0000-0000-000000000002', 'CAND_TEST_FINISHED', 'email', 'Twoje testy zostały zakończone', 'Cześć {{firstName}}, dziękujemy za wypełnienie testów. Twoje wyniki są analizowane przez dział HR. Powiadomimy Cię o kolejnych krokach.', ARRAY['firstName'], TRUE),
('nt000003-0000-0000-0000-000000000003', 'CAND_REJECTED', 'both', 'Status Twojej aplikacji w MaxMaster', 'Dziękujemy {{firstName}} za udział w rekrutacji. Niestety tym razem nie możemy zaproponować Ci współpracy. Pozdrawiamy, {{companyName}}.', ARRAY['firstName', 'companyName'], TRUE),
('nt000004-0000-0000-0000-000000000004', 'CAND_DOCS_REQUEST', 'both', 'Prośba o uzupełnienie danych do umowy', 'Cześć {{firstName}}, prosimy o uzupełnienie danych osobowych niezbędnych do umowy w portalu: {{actionUrl}}', ARRAY['firstName', 'actionUrl'], TRUE),
('nt000005-0000-0000-0000-000000000005', 'TRIAL_START', 'both', 'Gratulacje! Rozpoczynasz okres próbny', 'Cześć {{firstName}}, witamy w zespole! Twój okres próbny kończy się {{trialEndDate}}. Twój brygadzista to {{hrName}}.', ARRAY['firstName', 'trialEndDate', 'hrName'], TRUE),
('nt000006-0000-0000-0000-000000000006', 'PRACTICE_VERIFICATION_RESULT_APPROVED', 'both', 'Umiejętność zatwierdzona!', 'Świetna wiadomość {{firstName}}! Twoja umiejętność "{{skillName}}" została zatwierdzona. Twoja stawka wzrośnie od kolejnego miesiąca.', ARRAY['firstName', 'skillName'], TRUE);

-- ============================================================
-- END OF SEED DATA
-- ============================================================
