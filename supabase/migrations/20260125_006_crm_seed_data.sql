-- =============================================
-- CRM Seed Data (Mock Data for Testing)
-- Run this AFTER 20260125_005_create_crm_tables.sql
-- =============================================

-- Insert mock CRM Companies
INSERT INTO crm_companies (id, name, legal_name, tax_id, industry, website, address_city, address_street, employee_count, status, source, created_at, updated_at) VALUES
('c0000001-0000-0000-0000-000000000001', 'Firma ABC', 'ABC Sp. z o.o.', '1234567890', 'Budownictwo', 'https://abc.pl', 'Warszawa', 'ul. Przykładowa 123', 120, 'active', 'Polecenie', NOW() - INTERVAL '15 days', NOW() - INTERVAL '5 days'),
('c0000001-0000-0000-0000-000000000002', 'XYZ Corporation', 'XYZ Corp S.A.', '9876543210', 'IT / Technologia', 'https://xyz-corp.com', 'Kraków', 'ul. Technologiczna 5', 45, 'active', 'LinkedIn', NOW() - INTERVAL '20 days', NOW() - INTERVAL '3 days'),
('c0000001-0000-0000-0000-000000000003', 'Tech Solutions', 'Tech Solutions Sp. z o.o.', '5555555555', 'IT / Technologia', 'https://techsol.pl', 'Wrocław', 'ul. Innowacyjna 10', 200, 'active', 'Strona WWW', NOW() - INTERVAL '10 days', NOW() - INTERVAL '2 days'),
('c0000001-0000-0000-0000-000000000004', 'Logistyka Plus', 'Logistyka Plus Sp. z o.o.', '1111111111', 'Logistyka', NULL, 'Poznań', 'ul. Magazynowa 20', 80, 'active', 'Cold Call', NOW() - INTERVAL '5 days', NOW() - INTERVAL '2 days'),
('c0000001-0000-0000-0000-000000000005', 'BuildPro', 'BuildPro Construction Sp. z o.o.', '2222222222', 'Budownictwo', 'https://buildpro.pl', 'Gdańsk', 'ul. Budowlana 1', 350, 'active', 'Targi', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day');

-- Insert mock CRM Contacts (LPR - Decision Makers)
INSERT INTO crm_contacts (id, crm_company_id, first_name, last_name, email, phone, position, department, is_decision_maker, status, created_at, updated_at) VALUES
-- Firma ABC contacts
('cc000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001', 'Jan', 'Kowalski', 'j.kowalski@abc.pl', '+48 600 100 001', 'Dyrektor HR', 'HR', TRUE, 'active', NOW() - INTERVAL '15 days', NOW()),
('cc000001-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000001', 'Anna', 'Nowak', 'a.nowak@abc.pl', '+48 600 100 002', 'HR Manager', 'HR', FALSE, 'active', NOW() - INTERVAL '14 days', NOW()),
-- XYZ Corp contacts
('cc000001-0000-0000-0000-000000000003', 'c0000001-0000-0000-0000-000000000002', 'Piotr', 'Wiśniewski', 'p.wisniewski@xyz-corp.com', '+48 600 200 001', 'CEO', 'Zarząd', TRUE, 'active', NOW() - INTERVAL '20 days', NOW()),
('cc000001-0000-0000-0000-000000000004', 'c0000001-0000-0000-0000-000000000002', 'Maria', 'Dąbrowska', 'm.dabrowska@xyz-corp.com', '+48 600 200 002', 'COO', 'Operacje', TRUE, 'active', NOW() - INTERVAL '18 days', NOW()),
-- Tech Solutions contacts
('cc000001-0000-0000-0000-000000000005', 'c0000001-0000-0000-0000-000000000003', 'Tomasz', 'Lewandowski', 't.lewandowski@techsol.pl', '+48 600 300 001', 'VP HR', 'HR', TRUE, 'active', NOW() - INTERVAL '10 days', NOW()),
-- Logistyka Plus contacts
('cc000001-0000-0000-0000-000000000006', 'c0000001-0000-0000-0000-000000000004', 'Katarzyna', 'Zielińska', 'k.zielinska@logistykaplus.pl', '+48 600 400 001', 'Dyrektor Operacyjny', 'Operacje', TRUE, 'active', NOW() - INTERVAL '5 days', NOW()),
-- BuildPro contacts
('cc000001-0000-0000-0000-000000000007', 'c0000001-0000-0000-0000-000000000005', 'Michał', 'Szymański', 'm.szymanski@buildpro.pl', '+48 600 500 001', 'Właściciel', 'Zarząd', TRUE, 'active', NOW() - INTERVAL '3 days', NOW()),
('cc000001-0000-0000-0000-000000000008', 'c0000001-0000-0000-0000-000000000005', 'Ewa', 'Woźniak', 'e.wozniak@buildpro.pl', '+48 600 500 002', 'Kierownik HR', 'HR', FALSE, 'active', NOW() - INTERVAL '2 days', NOW());

-- Insert mock CRM Deals
INSERT INTO crm_deals (id, title, crm_company_id, contact_id, stage, priority, value, probability, expected_close_date, modules_interested, employee_count_estimate, notes, created_at, updated_at) VALUES
('d0000001-0000-0000-0000-000000000001', 'Firma ABC - Wdrożenie HR', 'c0000001-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000001', 'proposal', 'high', 12000, 60, NOW() + INTERVAL '20 days', ARRAY['recruitment', 'skills'], 25, 'Zainteresowani pełnym pakietem HR', NOW() - INTERVAL '15 days', NOW() - INTERVAL '5 days'),
('d0000001-0000-0000-0000-000000000002', 'XYZ Corp - Moduł Skills', 'c0000001-0000-0000-0000-000000000002', 'cc000001-0000-0000-0000-000000000003', 'negotiation', 'urgent', 8500, 80, NOW() + INTERVAL '5 days', ARRAY['skills'], 15, 'Pilne wdrożenie, budżet zatwierdzony', NOW() - INTERVAL '20 days', NOW() - INTERVAL '3 days'),
('d0000001-0000-0000-0000-000000000003', 'Tech Solutions - Full Package', 'c0000001-0000-0000-0000-000000000003', 'cc000001-0000-0000-0000-000000000005', 'qualified', 'medium', 25000, 40, NOW() + INTERVAL '35 days', ARRAY['recruitment', 'skills'], 50, 'Duży klient, wymaga demo', NOW() - INTERVAL '10 days', NOW() - INTERVAL '2 days'),
('d0000001-0000-0000-0000-000000000004', 'Logistyka Plus - Recruitment', 'c0000001-0000-0000-0000-000000000004', 'cc000001-0000-0000-0000-000000000006', 'lead', 'low', 5000, 20, NULL, ARRAY['recruitment'], 10, 'Wstępne rozmowy', NOW() - INTERVAL '5 days', NOW() - INTERVAL '2 days'),
('d0000001-0000-0000-0000-000000000005', 'BuildPro - Skills Management', 'c0000001-0000-0000-0000-000000000005', 'cc000001-0000-0000-0000-000000000007', 'lead', 'medium', 15000, 25, NULL, ARRAY['skills'], 35, 'Właściciel zainteresowany', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day');

-- Insert mock CRM Activities
INSERT INTO crm_activities (id, activity_type, subject, description, crm_company_id, contact_id, deal_id, scheduled_at, is_completed, duration_minutes, outcome, created_at, updated_at) VALUES
-- Upcoming activities
('a0000001-0000-0000-0000-000000000001', 'call', 'Follow-up z Firma ABC', 'Omówić szczegóły wdrożenia', 'c0000001-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000001', NOW() + INTERVAL '1 day', FALSE, NULL, NULL, NOW(), NOW()),
('a0000001-0000-0000-0000-000000000002', 'meeting', 'Demo dla XYZ Corp', 'Prezentacja modułu Skills', 'c0000001-0000-0000-0000-000000000002', 'cc000001-0000-0000-0000-000000000003', 'd0000001-0000-0000-0000-000000000002', NOW() + INTERVAL '2 days', FALSE, 60, NULL, NOW(), NOW()),
('a0000001-0000-0000-0000-000000000003', 'email', 'Wysłać ofertę Tech Solutions', 'Przygotować ofertę na 50 użytkowników', 'c0000001-0000-0000-0000-000000000003', 'cc000001-0000-0000-0000-000000000005', 'd0000001-0000-0000-0000-000000000003', NOW() + INTERVAL '4 hours', FALSE, NULL, NULL, NOW(), NOW()),
('a0000001-0000-0000-0000-000000000004', 'task', 'Przygotować case study dla BuildPro', 'Case study z branży budowlanej', 'c0000001-0000-0000-0000-000000000005', NULL, 'd0000001-0000-0000-0000-000000000005', NOW() + INTERVAL '3 days', FALSE, NULL, NULL, NOW(), NOW()),
-- Completed activities (history)
('a0000001-0000-0000-0000-000000000005', 'call', 'Pierwszy kontakt z Firma ABC', 'Wstępna rozmowa o potrzebach', 'c0000001-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000001', NOW() - INTERVAL '14 days', TRUE, 30, 'Zainteresowani, chcą ofertę', NOW() - INTERVAL '15 days', NOW() - INTERVAL '14 days'),
('a0000001-0000-0000-0000-000000000006', 'meeting', 'Spotkanie z XYZ Corp', 'Prezentacja wstępna', 'c0000001-0000-0000-0000-000000000002', 'cc000001-0000-0000-0000-000000000003', 'd0000001-0000-0000-0000-000000000002', NOW() - INTERVAL '10 days', TRUE, 90, 'Bardzo zainteresowani, przeszli do negocjacji', NOW() - INTERVAL '12 days', NOW() - INTERVAL '10 days'),
('a0000001-0000-0000-0000-000000000007', 'note', 'Notatka o Tech Solutions', 'Firma ma duży potencjał, 200 pracowników', 'c0000001-0000-0000-0000-000000000003', NULL, 'd0000001-0000-0000-0000-000000000003', NULL, TRUE, NULL, NULL, NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days');
