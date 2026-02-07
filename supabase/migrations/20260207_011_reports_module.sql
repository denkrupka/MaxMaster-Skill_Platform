-- =====================================================
-- Migration: Reports Module (Raporty)
-- Date: 2026-02-07
-- Description: Report templates, dashboards, and scheduled reports
-- =====================================================

-- 1. Report Templates
DROP TYPE IF EXISTS report_template_type CASCADE;
CREATE TYPE report_template_type AS ENUM ('project_report', 'ticket_report', 'financial_report', 'estimate_report', 'act_report', 'custom');

DROP TYPE IF EXISTS report_format CASCADE;
CREATE TYPE report_format AS ENUM ('pdf', 'xlsx', 'csv', 'html');

CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  template_type report_template_type NOT NULL,
  category TEXT,
  page_orientation TEXT DEFAULT 'portrait' CHECK (page_orientation IN ('portrait', 'landscape')),
  page_size TEXT DEFAULT 'A4' CHECK (page_size IN ('A4', 'A3', 'Letter')),
  margins JSONB DEFAULT '{"top": 20, "bottom": 20, "left": 20, "right": 20}'::jsonb,
  header_html TEXT,
  body_html TEXT NOT NULL,
  footer_html TEXT,
  custom_css TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  required_params JSONB DEFAULT '[]'::jsonb,
  -- required_params: [{name: "project_id", type: "uuid", label: "Projekt", default: null}]
  is_system BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  preview_image_url TEXT,
  version INTEGER DEFAULT 1,
  parent_template_id UUID REFERENCES report_templates(id) ON DELETE SET NULL,
  created_by_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Generated Reports
CREATE TABLE IF NOT EXISTS generated_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_id UUID REFERENCES report_templates(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  format report_format NOT NULL DEFAULT 'pdf',
  file_url TEXT,
  file_size BIGINT,
  parameters JSONB DEFAULT '{}'::jsonb,
  cache_key TEXT,
  expires_at TIMESTAMPTZ,
  generated_by_id UUID NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  generation_time_ms INTEGER
);

-- 3. Dashboards
DROP TYPE IF EXISTS dashboard_type CASCADE;
CREATE TYPE dashboard_type AS ENUM ('project', 'financial', 'tasks', 'custom');

CREATE TABLE IF NOT EXISTS dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  dashboard_type dashboard_type NOT NULL DEFAULT 'custom',
  layout JSONB DEFAULT '[]'::jsonb,
  -- layout: [{widget_id: ..., x: 0, y: 0, w: 4, h: 3, config: {...}}]
  is_default BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE,
  refresh_interval INTEGER DEFAULT 300, -- seconds
  created_by_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Dashboard Widgets
DROP TYPE IF EXISTS widget_type CASCADE;
CREATE TYPE widget_type AS ENUM ('counter', 'chart_pie', 'chart_bar', 'chart_line', 'table', 'list', 'progress', 'calendar');

DROP TYPE IF EXISTS widget_data_source CASCADE;
CREATE TYPE widget_data_source AS ENUM ('tickets', 'estimates', 'finance', 'projects', 'resources', 'custom_query');

CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  widget_type widget_type NOT NULL,
  data_source widget_data_source NOT NULL,
  config JSONB DEFAULT '{}'::jsonb,
  -- config: {query: ..., aggregation: ..., filters: [...], colors: [...]}
  is_system BOOLEAN DEFAULT FALSE,
  created_by_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Scheduled Reports
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES report_templates(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parameters JSONB DEFAULT '{}'::jsonb,
  schedule_cron TEXT NOT NULL, -- cron expression
  timezone TEXT DEFAULT 'Europe/Warsaw',
  format report_format DEFAULT 'pdf',
  delivery_method TEXT DEFAULT 'email' CHECK (delivery_method IN ('email', 'storage', 'both')),
  recipients JSONB DEFAULT '[]'::jsonb,
  -- recipients: [{email: ...} or {user_id: ...}]
  is_active BOOLEAN DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  last_error TEXT,
  created_by_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Report Subscriptions (user-level)
CREATE TABLE IF NOT EXISTS report_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheduled_report_id UUID NOT NULL REFERENCES scheduled_reports(id) ON DELETE CASCADE,
  delivery_email TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, scheduled_report_id)
);

-- 7. Enable RLS
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_subscriptions ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies
CREATE POLICY "report_templates_access" ON report_templates
  FOR ALL USING (
    is_system = TRUE OR
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "generated_reports_company_access" ON generated_reports
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "dashboards_access" ON dashboards
  FOR ALL USING (
    is_public = TRUE OR
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "dashboard_widgets_access" ON dashboard_widgets
  FOR ALL USING (
    is_system = TRUE OR
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "scheduled_reports_company_access" ON scheduled_reports
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "report_subscriptions_user_access" ON report_subscriptions
  FOR ALL USING (user_id = auth.uid());

-- 9. Indexes
CREATE INDEX IF NOT EXISTS idx_report_templates_company ON report_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_report_templates_type ON report_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_generated_reports_company ON generated_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_template ON generated_reports(template_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_project ON generated_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_cache ON generated_reports(cache_key) WHERE cache_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dashboards_company ON dashboards(company_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_project ON dashboards(project_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_company ON dashboard_widgets(company_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_company ON scheduled_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run ON scheduled_reports(next_run_at) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_report_subscriptions_user ON report_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_report_subscriptions_scheduled ON report_subscriptions(scheduled_report_id);

-- 10. Triggers
CREATE TRIGGER update_report_templates_updated_at BEFORE UPDATE ON report_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dashboards_updated_at BEFORE UPDATE ON dashboards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dashboard_widgets_updated_at BEFORE UPDATE ON dashboard_widgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_reports_updated_at BEFORE UPDATE ON scheduled_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 11. Insert system report templates
INSERT INTO report_templates (name, description, template_type, body_html, is_system, is_active) VALUES
  ('Raport projektu', 'Podstawowy raport projektu z podsumowaniem zadań i finansów', 'project_report',
   '<h1>{{project.name}}</h1><h2>Podsumowanie</h2><p>Status: {{project.status}}</p><h2>Zadania</h2><table>{{#tasks}}<tr><td>{{title}}</td><td>{{status}}</td></tr>{{/tasks}}</table>',
   TRUE, TRUE),
  ('Raport finansowy', 'Raport finansowy projektu z przychodami i kosztami', 'financial_report',
   '<h1>Raport finansowy: {{project.name}}</h1><h2>Przychody</h2><p>Suma: {{income_total}}</p><h2>Koszty</h2><p>Suma: {{expense_total}}</p><h2>Bilans</h2><p>{{balance}}</p>',
   TRUE, TRUE),
  ('Kosztorys', 'Eksport kosztorysu projektu', 'estimate_report',
   '<h1>Kosztorys: {{project.name}}</h1>{{#stages}}<h2>{{name}}</h2><table>{{#tasks}}<tr><td>{{name}}</td><td>{{volume}} {{unit}}</td><td>{{cost}}</td></tr>{{/tasks}}</table>{{/stages}}<h2>Suma: {{total}}</h2>',
   TRUE, TRUE),
  ('Akt wykonawczy', 'Akt wykonanych robót (KS-2)', 'act_report',
   '<h1>AKT Nr {{number}}</h1><p>Okres: {{period_from}} - {{period_to}}</p><table>{{#items}}<tr><td>{{name}}</td><td>{{volume_current}}</td><td>{{amount_current}}</td></tr>{{/items}}</table><h2>Suma: {{total}}</h2>',
   TRUE, TRUE)
ON CONFLICT DO NOTHING;

-- 12. Insert system dashboard widgets
INSERT INTO dashboard_widgets (name, description, widget_type, data_source, config, is_system) VALUES
  ('Liczba zadań', 'Liczba zadań w projekcie', 'counter', 'tickets', '{"aggregation": "count", "label": "Zadania"}', TRUE),
  ('Zadania wg statusu', 'Rozkład zadań według statusu', 'chart_pie', 'tickets', '{"groupBy": "status", "aggregation": "count"}', TRUE),
  ('Postęp projektu', 'Ogólny postęp projektu', 'progress', 'projects', '{"field": "progress"}', TRUE),
  ('Przychody vs Koszty', 'Porównanie przychodów i kosztów', 'chart_bar', 'finance', '{"groupBy": "month", "series": ["income", "expense"]}', TRUE),
  ('Ostatnie aktywności', 'Lista ostatnich aktywności', 'list', 'tickets', '{"orderBy": "updated_at", "limit": 10}', TRUE),
  ('Budżet projektu', 'Status budżetu projektu', 'counter', 'finance', '{"aggregation": "sum", "field": "amount", "comparison": "budget"}', TRUE),
  ('Kalendarz terminów', 'Nadchodzące terminy zadań', 'calendar', 'tickets', '{"dateField": "due_date"}', TRUE)
ON CONFLICT DO NOTHING;

-- 13. Project Folders
CREATE TABLE IF NOT EXISTS project_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES project_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 14. Add folder_id to projects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'folder_id'
  ) THEN
    ALTER TABLE projects ADD COLUMN folder_id UUID REFERENCES project_folders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 15. Enable RLS for project_folders
ALTER TABLE project_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_folders_company_access" ON project_folders
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- 16. Indexes for project_folders
CREATE INDEX IF NOT EXISTS idx_project_folders_company ON project_folders(company_id);
CREATE INDEX IF NOT EXISTS idx_project_folders_parent ON project_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_projects_folder ON projects(folder_id) WHERE folder_id IS NOT NULL;

-- 17. Trigger for project_folders
CREATE TRIGGER update_project_folders_updated_at BEFORE UPDATE ON project_folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
