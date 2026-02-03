-- Project Attendance Confirmations
-- Stores client confirmation status for attendance records
CREATE TABLE IF NOT EXISTS project_attendance_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  client_confirmed BOOLEAN DEFAULT false,
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_proj_attendance_conf_project ON project_attendance_confirmations(project_id);
CREATE INDEX IF NOT EXISTS idx_proj_attendance_conf_company ON project_attendance_confirmations(company_id);
CREATE INDEX IF NOT EXISTS idx_proj_attendance_conf_date ON project_attendance_confirmations(date);

ALTER TABLE project_attendance_confirmations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'project_attendance_confirmations' AND policyname = 'project_attendance_confirmations_company_access'
  ) THEN
    CREATE POLICY project_attendance_confirmations_company_access ON project_attendance_confirmations
      FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;
