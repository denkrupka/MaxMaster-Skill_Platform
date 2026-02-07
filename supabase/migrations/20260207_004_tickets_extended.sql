-- =====================================================
-- Migration: Extended Tickets/Tasks Module (Zadania)
-- Date: 2026-02-07
-- Description: Extended task management with custom types and fields
-- =====================================================

-- 1. Ticket Types (типы задач)
CREATE TABLE IF NOT EXISTS ticket_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT 'CheckSquare',
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Ticket Type Fields (пользовательские поля)
DROP TYPE IF EXISTS ticket_field_type CASCADE;
CREATE TYPE ticket_field_type AS ENUM ('text', 'number', 'date', 'datetime', 'select', 'multiselect', 'user', 'file', 'checkbox');

CREATE TABLE IF NOT EXISTS ticket_type_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_type_id UUID NOT NULL REFERENCES ticket_types(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  field_type ticket_field_type NOT NULL DEFAULT 'text',
  options JSONB DEFAULT '[]'::jsonb,
  is_required BOOLEAN DEFAULT FALSE,
  is_visible BOOLEAN DEFAULT TRUE,
  default_value TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Ticket Statuses
CREATE TABLE IF NOT EXISTS ticket_statuses (
  id SERIAL PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#64748b',
  is_default BOOLEAN DEFAULT FALSE,
  is_closed BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0
);

-- Insert default statuses
INSERT INTO ticket_statuses (name, color, is_default, is_closed, sort_order) VALUES
  ('Otwarte', '#64748b', TRUE, FALSE, 1),
  ('W trakcie', '#3b82f6', FALSE, FALSE, 2),
  ('Do weryfikacji', '#8b5cf6', FALSE, FALSE, 3),
  ('Rozwiązane', '#22c55e', FALSE, FALSE, 4),
  ('Zamknięte', '#6b7280', FALSE, TRUE, 5),
  ('Odrzucone', '#ef4444', FALSE, TRUE, 6)
ON CONFLICT DO NOTHING;

-- 4. Ticket Priorities
CREATE TABLE IF NOT EXISTS ticket_priorities (
  id SERIAL PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#64748b',
  is_default BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0
);

-- Insert default priorities
INSERT INTO ticket_priorities (name, color, is_default, sort_order) VALUES
  ('Niski', '#64748b', FALSE, 1),
  ('Normalny', '#3b82f6', TRUE, 2),
  ('Wysoki', '#f97316', FALSE, 3),
  ('Krytyczny', '#ef4444', FALSE, 4)
ON CONFLICT DO NOTHING;

-- 5. Tickets (extended tasks)
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  ticket_type_id UUID NOT NULL REFERENCES ticket_types(id) ON DELETE RESTRICT,
  parent_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  code TEXT,
  title TEXT NOT NULL,
  description TEXT,
  status_id INTEGER NOT NULL REFERENCES ticket_statuses(id) DEFAULT 1,
  priority_id INTEGER REFERENCES ticket_priorities(id),
  assigned_to_id UUID REFERENCES users(id) ON DELETE SET NULL,
  author_id UUID NOT NULL,
  due_date DATE,
  start_date DATE,
  end_date DATE,
  duration INTEGER,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  -- Link to plan/drawing
  component_id UUID,
  plan_id UUID,
  position_x NUMERIC(10,2),
  position_y NUMERIC(10,2),
  -- Custom fields
  custom_fields JSONB DEFAULT '{}'::jsonb,
  -- Locking
  is_locked BOOLEAN DEFAULT FALSE,
  locked_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  locked_at TIMESTAMPTZ,
  -- Meta
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

-- 6. Ticket Comments
CREATE TABLE IF NOT EXISTS ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 7. Ticket Journal (history)
CREATE TABLE IF NOT EXISTS ticket_journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Ticket Attachments
CREATE TABLE IF NOT EXISTS ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  uploaded_by_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Ticket Watchers
CREATE TABLE IF NOT EXISTS ticket_watchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticket_id, user_id)
);

-- 10. Ticket Time Logs
CREATE TABLE IF NOT EXISTS ticket_time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hours NUMERIC(6,2) NOT NULL,
  description TEXT,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Enable RLS
ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_type_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_watchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_time_logs ENABLE ROW LEVEL SECURITY;

-- 12. RLS Policies
CREATE POLICY "ticket_types_company_access" ON ticket_types
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "ticket_type_fields_access" ON ticket_type_fields
  FOR ALL USING (ticket_type_id IN (
    SELECT id FROM ticket_types WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY "ticket_statuses_access" ON ticket_statuses
  FOR ALL USING (
    company_id IS NULL OR
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "ticket_priorities_access" ON ticket_priorities
  FOR ALL USING (
    company_id IS NULL OR
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "tickets_company_access" ON tickets
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "ticket_comments_access" ON ticket_comments
  FOR ALL USING (ticket_id IN (
    SELECT id FROM tickets WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY "ticket_journals_access" ON ticket_journals
  FOR ALL USING (ticket_id IN (
    SELECT id FROM tickets WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY "ticket_attachments_access" ON ticket_attachments
  FOR ALL USING (ticket_id IN (
    SELECT id FROM tickets WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY "ticket_watchers_access" ON ticket_watchers
  FOR ALL USING (ticket_id IN (
    SELECT id FROM tickets WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY "ticket_time_logs_access" ON ticket_time_logs
  FOR ALL USING (ticket_id IN (
    SELECT id FROM tickets WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

-- 13. Indexes
CREATE INDEX IF NOT EXISTS idx_ticket_types_company ON ticket_types(company_id);
CREATE INDEX IF NOT EXISTS idx_ticket_type_fields_type ON ticket_type_fields(ticket_type_id);
CREATE INDEX IF NOT EXISTS idx_tickets_company ON tickets(company_id);
CREATE INDEX IF NOT EXISTS idx_tickets_project ON tickets(project_id);
CREATE INDEX IF NOT EXISTS idx_tickets_type ON tickets(ticket_type_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON tickets(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_tickets_author ON tickets(author_id);
CREATE INDEX IF NOT EXISTS idx_tickets_parent ON tickets(parent_id);
CREATE INDEX IF NOT EXISTS idx_tickets_plan ON tickets(plan_id) WHERE plan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_journals_ticket ON ticket_journals(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket ON ticket_attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_watchers_ticket ON ticket_watchers(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_time_logs_ticket ON ticket_time_logs(ticket_id);

-- 14. Triggers
CREATE TRIGGER update_ticket_types_updated_at BEFORE UPDATE ON ticket_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ticket_type_fields_updated_at BEFORE UPDATE ON ticket_type_fields
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ticket_comments_updated_at BEFORE UPDATE ON ticket_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 15. Function to generate ticket code
CREATE OR REPLACE FUNCTION generate_ticket_code()
RETURNS TRIGGER AS $$
DECLARE
  project_code TEXT;
  next_num INTEGER;
BEGIN
  SELECT COALESCE(code, 'PRJ') INTO project_code FROM projects WHERE id = NEW.project_id;
  SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM '[0-9]+$') AS INTEGER)), 0) + 1
    INTO next_num
    FROM tickets
    WHERE project_id = NEW.project_id;
  NEW.code := project_code || '-' || next_num;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_ticket_code_trigger
  BEFORE INSERT ON tickets
  FOR EACH ROW
  WHEN (NEW.code IS NULL)
  EXECUTE FUNCTION generate_ticket_code();

-- 16. Function to set closed_at
CREATE OR REPLACE FUNCTION set_ticket_closed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status_id IN (SELECT id FROM ticket_statuses WHERE is_closed = TRUE) THEN
    NEW.closed_at := NOW();
  ELSE
    NEW.closed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_ticket_closed_at_trigger
  BEFORE UPDATE OF status_id ON tickets
  FOR EACH ROW EXECUTE FUNCTION set_ticket_closed_at();
