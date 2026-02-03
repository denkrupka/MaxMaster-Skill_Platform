-- Add client_id to departments to link objects to clients
ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES contractors_clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_departments_client ON departments(client_id);
