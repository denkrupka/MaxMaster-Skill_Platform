-- =====================================================
-- Migration: Estimates Module (Kosztorysowanie)
-- Date: 2026-02-07
-- Description: Creates tables for cost estimation with hierarchical structure
-- =====================================================

-- Helper function for updated_at triggers (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Unit Measures (справочник единиц измерения)
CREATE TABLE IF NOT EXISTS unit_measures (
  id SERIAL PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- Insert system unit measures
INSERT INTO unit_measures (code, name, is_system) VALUES
  ('szt', 'Sztuka', TRUE),
  ('mb', 'Metr bieżący', TRUE),
  ('m2', 'Metr kwadratowy', TRUE),
  ('m3', 'Metr sześcienny', TRUE),
  ('kg', 'Kilogram', TRUE),
  ('t', 'Tona', TRUE),
  ('kpl', 'Komplet', TRUE),
  ('godz', 'Godzina', TRUE),
  ('r-g', 'Roboczogodzina', TRUE),
  ('m-g', 'Maszynogodzina', TRUE),
  ('l', 'Litr', TRUE),
  ('op', 'Opakowanie', TRUE)
ON CONFLICT DO NOTHING;

-- 2. Valuation Groups (группы расценок - иерархия)
CREATE TABLE IF NOT EXISTS valuation_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES valuation_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Valuations (справочник расценок)
-- Drop and recreate resource_type to ensure correct values
DROP TYPE IF EXISTS resource_type CASCADE;
CREATE TYPE resource_type AS ENUM ('labor', 'material', 'equipment', 'overhead');

CREATE TABLE IF NOT EXISTS valuations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  group_id UUID REFERENCES valuation_groups(id) ON DELETE SET NULL,
  code TEXT,
  name TEXT NOT NULL,
  description TEXT,
  unit_measure_id INTEGER REFERENCES unit_measures(id),
  price NUMERIC(14,4) NOT NULL DEFAULT 0,
  resource_type resource_type NOT NULL DEFAULT 'material',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Estimate Stages (этапы сметы - главный уровень иерархии)
CREATE TABLE IF NOT EXISTS estimate_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES estimate_stages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Estimate Tasks (позиции сметы)
DROP TYPE IF EXISTS estimate_calculate_mode CASCADE;
CREATE TYPE estimate_calculate_mode AS ENUM ('manual', 'by_resources');

CREATE TABLE IF NOT EXISTS estimate_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES estimate_stages(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES estimate_tasks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  volume NUMERIC(14,4) NOT NULL DEFAULT 1,
  unit_measure_id INTEGER REFERENCES unit_measures(id),
  is_group BOOLEAN DEFAULT FALSE,
  calculate_mode estimate_calculate_mode DEFAULT 'by_resources',
  sort_order INTEGER DEFAULT 0,
  start_date DATE,
  end_date DATE,
  duration INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Estimate Resources (ресурсы позиции)
CREATE TABLE IF NOT EXISTS estimate_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES estimate_tasks(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  valuation_id UUID REFERENCES valuations(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  code TEXT,
  resource_type resource_type NOT NULL DEFAULT 'material',
  unit_measure_id INTEGER REFERENCES unit_measures(id),
  volume NUMERIC(14,4) NOT NULL DEFAULT 1,
  price NUMERIC(14,4) NOT NULL DEFAULT 0,
  markup NUMERIC(8,4) DEFAULT 0,
  cost NUMERIC(14,4) GENERATED ALWAYS AS (volume * price) STORED,
  price_with_markup NUMERIC(14,4) GENERATED ALWAYS AS (price * (1 + markup / 100)) STORED,
  cost_with_markup NUMERIC(14,4) GENERATED ALWAYS AS (volume * price * (1 + markup / 100)) STORED,
  contractor_id UUID,
  needed_at DATE,
  url TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Estimate Markups (наценки проекта)
CREATE TABLE IF NOT EXISTS estimate_markups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT,
  value NUMERIC(10,4) NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'percent' CHECK (type IN ('percent', 'fixed')),
  is_nds BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Enable RLS
ALTER TABLE unit_measures ENABLE ROW LEVEL SECURITY;
ALTER TABLE valuation_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE valuations ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_markups ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies
-- Unit measures: system-wide or company-scoped
DROP POLICY IF EXISTS "unit_measures_access" ON unit_measures;
CREATE POLICY "unit_measures_access" ON unit_measures
  FOR ALL USING (
    is_system = TRUE OR
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "valuation_groups_company_access" ON valuation_groups;
CREATE POLICY "valuation_groups_company_access" ON valuation_groups
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "valuations_company_access" ON valuations;
CREATE POLICY "valuations_company_access" ON valuations
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "estimate_stages_project_access" ON estimate_stages;
CREATE POLICY "estimate_stages_project_access" ON estimate_stages
  FOR ALL USING (project_id IN (
    SELECT p.id FROM projects p
    JOIN users u ON u.company_id = p.company_id
    WHERE u.id = auth.uid()
  ));

DROP POLICY IF EXISTS "estimate_tasks_project_access" ON estimate_tasks;
CREATE POLICY "estimate_tasks_project_access" ON estimate_tasks
  FOR ALL USING (project_id IN (
    SELECT p.id FROM projects p
    JOIN users u ON u.company_id = p.company_id
    WHERE u.id = auth.uid()
  ));

DROP POLICY IF EXISTS "estimate_resources_project_access" ON estimate_resources;
CREATE POLICY "estimate_resources_project_access" ON estimate_resources
  FOR ALL USING (project_id IN (
    SELECT p.id FROM projects p
    JOIN users u ON u.company_id = p.company_id
    WHERE u.id = auth.uid()
  ));

DROP POLICY IF EXISTS "estimate_markups_project_access" ON estimate_markups;
CREATE POLICY "estimate_markups_project_access" ON estimate_markups
  FOR ALL USING (project_id IN (
    SELECT p.id FROM projects p
    JOIN users u ON u.company_id = p.company_id
    WHERE u.id = auth.uid()
  ));

-- 10. Indexes
CREATE INDEX IF NOT EXISTS idx_valuation_groups_company ON valuation_groups(company_id);
CREATE INDEX IF NOT EXISTS idx_valuation_groups_parent ON valuation_groups(parent_id);
CREATE INDEX IF NOT EXISTS idx_valuations_company ON valuations(company_id);
CREATE INDEX IF NOT EXISTS idx_valuations_group ON valuations(group_id);
CREATE INDEX IF NOT EXISTS idx_estimate_stages_project ON estimate_stages(project_id);
CREATE INDEX IF NOT EXISTS idx_estimate_stages_parent ON estimate_stages(parent_id);
CREATE INDEX IF NOT EXISTS idx_estimate_tasks_stage ON estimate_tasks(stage_id);
CREATE INDEX IF NOT EXISTS idx_estimate_tasks_project ON estimate_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_estimate_tasks_parent ON estimate_tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_estimate_resources_task ON estimate_resources(task_id);
CREATE INDEX IF NOT EXISTS idx_estimate_resources_project ON estimate_resources(project_id);
CREATE INDEX IF NOT EXISTS idx_estimate_markups_project ON estimate_markups(project_id);

-- 11. Updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_valuation_groups_updated_at ON valuation_groups;
CREATE TRIGGER update_valuation_groups_updated_at BEFORE UPDATE ON valuation_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_valuations_updated_at ON valuations;
CREATE TRIGGER update_valuations_updated_at BEFORE UPDATE ON valuations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_estimate_stages_updated_at ON estimate_stages;
CREATE TRIGGER update_estimate_stages_updated_at BEFORE UPDATE ON estimate_stages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_estimate_tasks_updated_at ON estimate_tasks;
CREATE TRIGGER update_estimate_tasks_updated_at BEFORE UPDATE ON estimate_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_estimate_resources_updated_at ON estimate_resources;
CREATE TRIGGER update_estimate_resources_updated_at BEFORE UPDATE ON estimate_resources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_estimate_markups_updated_at ON estimate_markups;
CREATE TRIGGER update_estimate_markups_updated_at BEFORE UPDATE ON estimate_markups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
