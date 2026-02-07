-- Add type column to contractors_clients to distinguish Klienci from Dostawcy
ALTER TABLE contractors_clients
  ADD COLUMN IF NOT EXISTS contractor_type TEXT DEFAULT 'client';

-- Add type column to contractor_client_contacts for reference
-- (contacts are already linked via client_id, no change needed)

-- Update existing records to be 'client' type
UPDATE contractors_clients SET contractor_type = 'client' WHERE contractor_type IS NULL;
