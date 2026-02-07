-- =====================================================
-- Migration: Drawings/Plans Module (Rysunki Techniczne)
-- Date: 2026-02-07
-- Description: Technical drawings with annotations and task linking
-- =====================================================

-- 1. Plan Components (компоненты/разделы проекта)
CREATE TABLE IF NOT EXISTS plan_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES plan_components(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_by_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 2. Plans (чертежи)
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id UUID NOT NULL REFERENCES plan_components(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  file_id UUID,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  original_filename TEXT,
  mime_type TEXT,
  file_size BIGINT,
  width INTEGER,
  height INTEGER,
  -- Calibration
  calibration_enabled BOOLEAN DEFAULT FALSE,
  calibration_length NUMERIC(12,4),
  calibration_pixels NUMERIC(12,4),
  scale_ratio NUMERIC(12,6),
  -- Versioning
  version INTEGER DEFAULT 1,
  is_current_version BOOLEAN DEFAULT TRUE,
  parent_plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
  -- Meta
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_by_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 3. Plan Layers
CREATE TABLE IF NOT EXISTS plan_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  is_visible BOOLEAN DEFAULT TRUE,
  is_locked BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, slug)
);

-- 4. Plan Markups (annotations)
CREATE TYPE markup_type AS ENUM ('line', 'arrow', 'rectangle', 'circle', 'ellipse', 'polygon', 'polyline', 'freehand', 'text', 'measurement');

CREATE TABLE IF NOT EXISTS plan_markups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  markup_type markup_type NOT NULL,
  geometry JSONB NOT NULL,
  stroke_color TEXT DEFAULT '#ef4444',
  stroke_width NUMERIC(4,2) DEFAULT 2,
  fill_color TEXT,
  fill_opacity NUMERIC(3,2) DEFAULT 0.3,
  font_size INTEGER DEFAULT 14,
  font_family TEXT DEFAULT 'Arial',
  text_content TEXT,
  measurement_value NUMERIC(14,4),
  measurement_unit TEXT DEFAULT 'm',
  is_visible BOOLEAN DEFAULT TRUE,
  layer TEXT DEFAULT 'default',
  z_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 5. Plan Pins (точки связи с задачами)
CREATE TABLE IF NOT EXISTS plan_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  position_x NUMERIC(10,2) NOT NULL,
  position_y NUMERIC(10,2) NOT NULL,
  icon TEXT DEFAULT 'MapPin',
  color TEXT DEFAULT '#ef4444',
  label TEXT,
  created_by_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Plan Comments
CREATE TABLE IF NOT EXISTS plan_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  position_x NUMERIC(10,2),
  position_y NUMERIC(10,2),
  content TEXT NOT NULL,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_by_id UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 7. Plan Comment Replies
CREATE TABLE IF NOT EXISTS plan_comment_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES plan_comments(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Enable RLS
ALTER TABLE plan_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_markups ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_comment_replies ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies
CREATE POLICY "plan_components_project_access" ON plan_components
  FOR ALL USING (project_id IN (
    SELECT p.id FROM projects p
    JOIN users u ON u.company_id = p.company_id
    WHERE u.id = auth.uid()
  ));

CREATE POLICY "plans_project_access" ON plans
  FOR ALL USING (project_id IN (
    SELECT p.id FROM projects p
    JOIN users u ON u.company_id = p.company_id
    WHERE u.id = auth.uid()
  ));

CREATE POLICY "plan_layers_access" ON plan_layers
  FOR ALL USING (plan_id IN (
    SELECT pl.id FROM plans pl
    JOIN projects p ON p.id = pl.project_id
    JOIN users u ON u.company_id = p.company_id
    WHERE u.id = auth.uid()
  ));

CREATE POLICY "plan_markups_access" ON plan_markups
  FOR ALL USING (plan_id IN (
    SELECT pl.id FROM plans pl
    JOIN projects p ON p.id = pl.project_id
    JOIN users u ON u.company_id = p.company_id
    WHERE u.id = auth.uid()
  ));

CREATE POLICY "plan_pins_access" ON plan_pins
  FOR ALL USING (plan_id IN (
    SELECT pl.id FROM plans pl
    JOIN projects p ON p.id = pl.project_id
    JOIN users u ON u.company_id = p.company_id
    WHERE u.id = auth.uid()
  ));

CREATE POLICY "plan_comments_access" ON plan_comments
  FOR ALL USING (plan_id IN (
    SELECT pl.id FROM plans pl
    JOIN projects p ON p.id = pl.project_id
    JOIN users u ON u.company_id = p.company_id
    WHERE u.id = auth.uid()
  ));

CREATE POLICY "plan_comment_replies_access" ON plan_comment_replies
  FOR ALL USING (comment_id IN (
    SELECT pc.id FROM plan_comments pc
    JOIN plans pl ON pl.id = pc.plan_id
    JOIN projects p ON p.id = pl.project_id
    JOIN users u ON u.company_id = p.company_id
    WHERE u.id = auth.uid()
  ));

-- 10. Indexes
CREATE INDEX IF NOT EXISTS idx_plan_components_project ON plan_components(project_id);
CREATE INDEX IF NOT EXISTS idx_plan_components_parent ON plan_components(parent_id);
CREATE INDEX IF NOT EXISTS idx_plans_component ON plans(component_id);
CREATE INDEX IF NOT EXISTS idx_plans_project ON plans(project_id);
CREATE INDEX IF NOT EXISTS idx_plans_parent ON plans(parent_plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_layers_plan ON plan_layers(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_markups_plan ON plan_markups(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_markups_author ON plan_markups(author_id);
CREATE INDEX IF NOT EXISTS idx_plan_pins_plan ON plan_pins(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_pins_ticket ON plan_pins(ticket_id);
CREATE INDEX IF NOT EXISTS idx_plan_comments_plan ON plan_comments(plan_id);

-- 11. Triggers
CREATE TRIGGER update_plan_components_updated_at BEFORE UPDATE ON plan_components
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plan_markups_updated_at BEFORE UPDATE ON plan_markups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plan_comments_updated_at BEFORE UPDATE ON plan_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 12. Update tickets table to add plan links
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'component_id'
  ) THEN
    ALTER TABLE tickets ADD COLUMN component_id UUID REFERENCES plan_components(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'plan_id'
  ) THEN
    ALTER TABLE tickets ADD COLUMN plan_id UUID REFERENCES plans(id) ON DELETE SET NULL;
  END IF;
END $$;
