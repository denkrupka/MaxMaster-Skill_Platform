-- =====================================================
-- Migration: Uzgodnienia (Agreements/Coordination) Module
-- Date: 2026-03-12
-- Description: Full workflow for uzgodnienia with plan attachment,
--              delegation, SLA escalation, audit trail
-- =====================================================

-- 1. Uzgodnienia table
DROP TYPE IF EXISTS uzgodnienie_status CASCADE;
CREATE TYPE uzgodnienie_status AS ENUM ('new', 'in_review', 'approved', 'rejected', 'delegated', 'escalated', 'cancelled');

DROP TYPE IF EXISTS uzgodnienie_priority CASCADE;
CREATE TYPE uzgodnienie_priority AS ENUM ('low', 'normal', 'high', 'urgent');

CREATE TABLE IF NOT EXISTS uzgodnienia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  number TEXT,
  title TEXT NOT NULL,
  description TEXT,
  status uzgodnienie_status DEFAULT 'new',
  priority uzgodnienie_priority DEFAULT 'normal',

  -- Plan attachment: page + coordinates
  plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
  plan_page INTEGER,
  plan_x NUMERIC(8,4),
  plan_y NUMERIC(8,4),
  plan_screenshot_url TEXT,

  -- Responsible person
  assigned_to_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- SLA
  sla_hours INTEGER DEFAULT 24,
  sla_deadline TIMESTAMPTZ,
  escalated_at TIMESTAMPTZ,
  escalated_to_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Completion
  resolved_at TIMESTAMPTZ,
  resolved_by_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 2. Uzgodnienia History (full audit trail)
CREATE TABLE IF NOT EXISTS uzgodnienia_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uzgodnienie_id UUID NOT NULL REFERENCES uzgodnienia(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'created', 'approved', 'rejected', 'delegated', 'escalated', 'comment', 'reassigned'
  from_status uzgodnienie_status,
  to_status uzgodnienie_status,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  comment TEXT,
  delegated_to_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Uzgodnienia Photos
CREATE TABLE IF NOT EXISTS uzgodnienia_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uzgodnienie_id UUID NOT NULL REFERENCES uzgodnienia(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption TEXT,
  uploaded_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS
ALTER TABLE uzgodnienia ENABLE ROW LEVEL SECURITY;
ALTER TABLE uzgodnienia_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE uzgodnienia_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uzgodnienia_company_access" ON uzgodnienia
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "uzgodnienia_history_access" ON uzgodnienia_history
  FOR ALL USING (uzgodnienie_id IN (
    SELECT id FROM uzgodnienia WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY "uzgodnienia_photos_access" ON uzgodnienia_photos
  FOR ALL USING (uzgodnienie_id IN (
    SELECT id FROM uzgodnienia WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_uzgodnienia_company ON uzgodnienia(company_id);
CREATE INDEX IF NOT EXISTS idx_uzgodnienia_project ON uzgodnienia(project_id);
CREATE INDEX IF NOT EXISTS idx_uzgodnienia_status ON uzgodnienia(status);
CREATE INDEX IF NOT EXISTS idx_uzgodnienia_assigned ON uzgodnienia(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_uzgodnienia_created_by ON uzgodnienia(created_by_id);
CREATE INDEX IF NOT EXISTS idx_uzgodnienia_history_uzg ON uzgodnienia_history(uzgodnienie_id);
CREATE INDEX IF NOT EXISTS idx_uzgodnienia_photos_uzg ON uzgodnienia_photos(uzgodnienie_id);

-- 6. Trigger
CREATE TRIGGER update_uzgodnienia_updated_at BEFORE UPDATE ON uzgodnienia
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Auto-number function
CREATE OR REPLACE FUNCTION generate_uzgodnienie_number()
RETURNS TRIGGER AS $$
DECLARE
  v_count INTEGER;
  v_year TEXT;
BEGIN
  IF NEW.number IS NULL THEN
    v_year := TO_CHAR(NOW(), 'YYYY');
    SELECT COUNT(*) + 1 INTO v_count
    FROM uzgodnienia
    WHERE company_id = NEW.company_id
      AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
    NEW.number := 'UZG/' || v_year || '/' || LPAD(v_count::TEXT, 4, '0');
  END IF;

  -- Set SLA deadline
  IF NEW.sla_deadline IS NULL AND NEW.sla_hours IS NOT NULL THEN
    NEW.sla_deadline := NOW() + (NEW.sla_hours || ' hours')::INTERVAL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_uzgodnienie_number
  BEFORE INSERT ON uzgodnienia
  FOR EACH ROW EXECUTE FUNCTION generate_uzgodnienie_number();
