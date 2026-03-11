-- Migration: Drawing Takeoff & Analysis persistence tables
-- Created: 2026-03-11

-- 1. drawing_takeoff_rules
CREATE TABLE IF NOT EXISTS drawing_takeoff_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  company_id      uuid REFERENCES companies(id) ON DELETE CASCADE,
  name            text NOT NULL,
  category        text NOT NULL DEFAULT 'Inne',
  match_type      text NOT NULL DEFAULT 'style_color',
  match_pattern   text NOT NULL,
  quantity_source text NOT NULL DEFAULT 'count',
  unit            text NOT NULL DEFAULT 'szt.',
  multiplier      numeric NOT NULL DEFAULT 1,
  is_default      boolean NOT NULL DEFAULT false,
  is_ai_generated boolean NOT NULL DEFAULT false,
  enabled         boolean NOT NULL DEFAULT true,
  created_by      uuid REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dtr_plan_id ON drawing_takeoff_rules(plan_id);
CREATE INDEX IF NOT EXISTS idx_dtr_company_id ON drawing_takeoff_rules(company_id);

-- 2. drawing_legends
CREATE TABLE IF NOT EXISTS drawing_legends (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id        uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  label          text NOT NULL,
  description    text,
  entry_type     text NOT NULL DEFAULT 'symbol',
  category       text NOT NULL DEFAULT 'Inne',
  color          text,
  line_style     text,
  line_width     text,
  is_ai_detected boolean NOT NULL DEFAULT false,
  drawing_type   text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dl_plan_id ON drawing_legends(plan_id);

-- 3. drawing_takeoff_results
CREATE TABLE IF NOT EXISTS drawing_takeoff_results (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id      uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  rule_id      text NOT NULL,
  rule_name    text NOT NULL,
  category     text NOT NULL DEFAULT 'Inne',
  quantity     numeric NOT NULL DEFAULT 0,
  unit         text NOT NULL DEFAULT 'szt.',
  entity_count integer NOT NULL DEFAULT 0,
  page_number  integer NOT NULL DEFAULT 1,
  created_by   uuid REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dtres_plan_id ON drawing_takeoff_results(plan_id);

-- 4. drawing_analyses
CREATE TABLE IF NOT EXISTS drawing_analyses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id        uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  page_number    integer NOT NULL DEFAULT 1,
  drawing_type   text,
  total_entities integer,
  total_blocks   integer,
  ai_model       text,
  analysis_data  jsonb,
  legend_data    jsonb,
  status         text NOT NULL DEFAULT 'completed',
  created_by     uuid REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plan_id, page_number)
);
CREATE INDEX IF NOT EXISTS idx_da_plan_id ON drawing_analyses(plan_id);

-- 5. RLS
ALTER TABLE drawing_takeoff_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE drawing_legends ENABLE ROW LEVEL SECURITY;
ALTER TABLE drawing_takeoff_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE drawing_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all_dtr"  ON drawing_takeoff_rules  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_dl"   ON drawing_legends        FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_dtres" ON drawing_takeoff_results FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_da"   ON drawing_analyses       FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "auth_dtr" ON drawing_takeoff_rules FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "auth_dl" ON drawing_legends FOR ALL TO authenticated
  USING (plan_id IN (SELECT p.id FROM plans p JOIN projects proj ON proj.id=p.project_id JOIN users u ON u.company_id=proj.company_id WHERE u.id=auth.uid()));

CREATE POLICY "auth_dtres" ON drawing_takeoff_results FOR ALL TO authenticated
  USING (plan_id IN (SELECT p.id FROM plans p JOIN projects proj ON proj.id=p.project_id JOIN users u ON u.company_id=proj.company_id WHERE u.id=auth.uid()));

CREATE POLICY "auth_da" ON drawing_analyses FOR ALL TO authenticated
  USING (plan_id IN (SELECT p.id FROM plans p JOIN projects proj ON proj.id=p.project_id JOIN users u ON u.company_id=proj.company_id WHERE u.id=auth.uid()));

-- 6. updated_at trigger
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS set_dtr_updated_at ON drawing_takeoff_rules;
CREATE TRIGGER set_dtr_updated_at BEFORE UPDATE ON drawing_takeoff_rules FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
