-- ============================================================
-- Contractors Update: main contact flag, subcontractor address/NIP/note
-- ============================================================

-- Add is_main_contact to client contacts
ALTER TABLE contractor_client_contacts
  ADD COLUMN IF NOT EXISTS is_main_contact BOOLEAN DEFAULT FALSE;

-- Add is_main_contact to subcontractor workers
ALTER TABLE subcontractor_workers
  ADD COLUMN IF NOT EXISTS is_main_contact BOOLEAN DEFAULT FALSE;

-- Add NIP, address, and note fields to subcontractors (mirror clients)
ALTER TABLE contractors_subcontractors
  ADD COLUMN IF NOT EXISTS nip TEXT,
  ADD COLUMN IF NOT EXISTS address_street TEXT,
  ADD COLUMN IF NOT EXISTS address_city TEXT,
  ADD COLUMN IF NOT EXISTS address_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS address_country TEXT DEFAULT 'PL',
  ADD COLUMN IF NOT EXISTS note TEXT;

-- Remove email and phone from clients (data moves to contacts)
-- We keep columns for backward compat but they won't be used in UI anymore

-- Remove email and phone from subcontractors (data moves to workers)
-- We keep columns for backward compat but they won't be used in UI anymore
