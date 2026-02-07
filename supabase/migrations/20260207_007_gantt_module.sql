-- =====================================================
-- Migration: Gantt Module (Harmonogram)
-- Date: 2026-02-07
-- Description: Gantt chart with dependencies and baselines
-- =====================================================

-- 1. Project Working Days Configuration
CREATE TABLE IF NOT EXISTS project_working_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  working_days_mask INTEGER DEFAULT 62, -- Monday-Friday (bits: Sun=1, Mon=2, Tue=4, Wed=8, Thu=16, Fri=32, Sat=64)
  holidays JSONB DEFAULT '[]'::jsonb, -- [{date: "2026-01-01", name: "Nowy Rok"}]
  country_code TEXT DEFAULT 'PL',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Gantt Tasks (связаны с estimate_tasks или tickets)
CREATE TYPE gantt_task_source AS ENUM ('estimate', 'ticket', 'manual', 'milestone');

CREATE TABLE IF NOT EXISTS gantt_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  estimate_task_id UUID REFERENCES estimate_tasks(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  title TEXT,
  parent_id UUID REFERENCES gantt_tasks(id) ON DELETE CASCADE,
  start_date DATE,
  end_date DATE,
  duration INTEGER, -- in working days
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  has_custom_progress BOOLEAN DEFAULT FALSE,
  is_auto BOOLEAN DEFAULT TRUE, -- auto-calculate from children
  is_milestone BOOLEAN DEFAULT FALSE,
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  source gantt_task_source DEFAULT 'manual',
  source_id UUID,
  assigned_to_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure only one source
  CHECK (
    (estimate_task_id IS NOT NULL)::int +
    (ticket_id IS NOT NULL)::int +
    (title IS NOT NULL)::int <= 1 OR
    title IS NOT NULL
  )
);

-- 3. Gantt Dependencies
CREATE TYPE gantt_dependency_type AS ENUM ('FS', 'FF', 'SS', 'SF');

CREATE TABLE IF NOT EXISTS gantt_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  predecessor_id UUID NOT NULL REFERENCES gantt_tasks(id) ON DELETE CASCADE,
  successor_id UUID NOT NULL REFERENCES gantt_tasks(id) ON DELETE CASCADE,
  dependency_type gantt_dependency_type DEFAULT 'FS',
  lag INTEGER DEFAULT 0, -- in working days
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(predecessor_id, successor_id)
);

-- 4. Gantt Baselines (snapshots)
CREATE TABLE IF NOT EXISTS gantt_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  tasks_snapshot JSONB NOT NULL, -- array of {task_id, start_date, end_date, duration, progress}
  created_by_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Gantt Resources (resource allocation per task)
CREATE TABLE IF NOT EXISTS gantt_task_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gantt_task_id UUID NOT NULL REFERENCES gantt_tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  contractor_id UUID REFERENCES contractors(id) ON DELETE CASCADE,
  allocation_percent INTEGER DEFAULT 100 CHECK (allocation_percent > 0 AND allocation_percent <= 100),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (user_id IS NOT NULL OR contractor_id IS NOT NULL)
);

-- 6. Gantt Views (saved view configurations)
CREATE TABLE IF NOT EXISTS gantt_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  config JSONB DEFAULT '{
    "zoom": "week",
    "showBaseline": false,
    "showCriticalPath": false,
    "showResources": true,
    "showProgress": true,
    "columns": ["title", "start_date", "end_date", "duration", "progress"]
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Enable RLS
ALTER TABLE project_working_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE gantt_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE gantt_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE gantt_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE gantt_task_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE gantt_views ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies
CREATE POLICY "project_working_days_access" ON project_working_days
  FOR ALL USING (project_id IN (
    SELECT p.id FROM projects p
    JOIN users u ON u.company_id = p.company_id
    WHERE u.id = auth.uid()
  ));

CREATE POLICY "gantt_tasks_project_access" ON gantt_tasks
  FOR ALL USING (project_id IN (
    SELECT p.id FROM projects p
    JOIN users u ON u.company_id = p.company_id
    WHERE u.id = auth.uid()
  ));

CREATE POLICY "gantt_dependencies_project_access" ON gantt_dependencies
  FOR ALL USING (project_id IN (
    SELECT p.id FROM projects p
    JOIN users u ON u.company_id = p.company_id
    WHERE u.id = auth.uid()
  ));

CREATE POLICY "gantt_baselines_project_access" ON gantt_baselines
  FOR ALL USING (project_id IN (
    SELECT p.id FROM projects p
    JOIN users u ON u.company_id = p.company_id
    WHERE u.id = auth.uid()
  ));

CREATE POLICY "gantt_task_resources_access" ON gantt_task_resources
  FOR ALL USING (gantt_task_id IN (
    SELECT gt.id FROM gantt_tasks gt
    JOIN projects p ON p.id = gt.project_id
    JOIN users u ON u.company_id = p.company_id
    WHERE u.id = auth.uid()
  ));

CREATE POLICY "gantt_views_user_access" ON gantt_views
  FOR ALL USING (user_id = auth.uid());

-- 9. Indexes
CREATE INDEX IF NOT EXISTS idx_project_working_days_project ON project_working_days(project_id);
CREATE INDEX IF NOT EXISTS idx_gantt_tasks_project ON gantt_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_gantt_tasks_parent ON gantt_tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_gantt_tasks_estimate ON gantt_tasks(estimate_task_id);
CREATE INDEX IF NOT EXISTS idx_gantt_tasks_ticket ON gantt_tasks(ticket_id);
CREATE INDEX IF NOT EXISTS idx_gantt_tasks_dates ON gantt_tasks(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_gantt_dependencies_project ON gantt_dependencies(project_id);
CREATE INDEX IF NOT EXISTS idx_gantt_dependencies_predecessor ON gantt_dependencies(predecessor_id);
CREATE INDEX IF NOT EXISTS idx_gantt_dependencies_successor ON gantt_dependencies(successor_id);
CREATE INDEX IF NOT EXISTS idx_gantt_baselines_project ON gantt_baselines(project_id);
CREATE INDEX IF NOT EXISTS idx_gantt_task_resources_task ON gantt_task_resources(gantt_task_id);
CREATE INDEX IF NOT EXISTS idx_gantt_views_project ON gantt_views(project_id);
CREATE INDEX IF NOT EXISTS idx_gantt_views_user ON gantt_views(user_id);

-- 10. Triggers
CREATE TRIGGER update_project_working_days_updated_at BEFORE UPDATE ON project_working_days
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gantt_tasks_updated_at BEFORE UPDATE ON gantt_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gantt_views_updated_at BEFORE UPDATE ON gantt_views
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 11. Function to sync gantt task from estimate_task
CREATE OR REPLACE FUNCTION sync_gantt_from_estimate_task()
RETURNS TRIGGER AS $$
BEGIN
  -- Create or update gantt_task when estimate_task is created/updated
  INSERT INTO gantt_tasks (
    project_id, estimate_task_id, title, start_date, end_date, duration, source, source_id
  ) VALUES (
    NEW.project_id, NEW.id, NEW.name, NEW.start_date, NEW.end_date, NEW.duration, 'estimate', NEW.id
  )
  ON CONFLICT (estimate_task_id) WHERE estimate_task_id IS NOT NULL
  DO UPDATE SET
    title = EXCLUDED.title,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    duration = EXCLUDED.duration,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: Trigger is optional, can be enabled if auto-sync is needed
-- CREATE TRIGGER sync_gantt_from_estimate_task_trigger
--   AFTER INSERT OR UPDATE ON estimate_tasks
--   FOR EACH ROW EXECUTE FUNCTION sync_gantt_from_estimate_task();

-- 12. Function to calculate working days between dates
CREATE OR REPLACE FUNCTION calculate_working_days(
  p_project_id UUID,
  p_start_date DATE,
  p_end_date DATE
) RETURNS INTEGER AS $$
DECLARE
  v_working_days_mask INTEGER;
  v_holidays DATE[];
  v_current DATE;
  v_count INTEGER := 0;
  v_day_of_week INTEGER;
BEGIN
  -- Get project settings
  SELECT working_days_mask, ARRAY(SELECT (h->>'date')::DATE FROM jsonb_array_elements(holidays) h)
  INTO v_working_days_mask, v_holidays
  FROM project_working_days
  WHERE project_id = p_project_id;

  -- Default to Mon-Fri if no settings
  IF v_working_days_mask IS NULL THEN
    v_working_days_mask := 62; -- bits 1-6 (Mon-Fri)
  END IF;

  v_current := p_start_date;
  WHILE v_current <= p_end_date LOOP
    v_day_of_week := EXTRACT(DOW FROM v_current)::INTEGER; -- 0=Sun, 1=Mon, etc.
    -- Check if day is working day (bit is set) and not a holiday
    IF (v_working_days_mask & (1 << v_day_of_week)) > 0 AND NOT (v_current = ANY(v_holidays)) THEN
      v_count := v_count + 1;
    END IF;
    v_current := v_current + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- 13. Function to add working days to a date
CREATE OR REPLACE FUNCTION add_working_days(
  p_project_id UUID,
  p_start_date DATE,
  p_days INTEGER
) RETURNS DATE AS $$
DECLARE
  v_working_days_mask INTEGER;
  v_holidays DATE[];
  v_current DATE;
  v_count INTEGER := 0;
  v_day_of_week INTEGER;
BEGIN
  IF p_days <= 0 THEN
    RETURN p_start_date;
  END IF;

  SELECT working_days_mask, ARRAY(SELECT (h->>'date')::DATE FROM jsonb_array_elements(holidays) h)
  INTO v_working_days_mask, v_holidays
  FROM project_working_days
  WHERE project_id = p_project_id;

  IF v_working_days_mask IS NULL THEN
    v_working_days_mask := 62;
  END IF;

  v_current := p_start_date;
  WHILE v_count < p_days LOOP
    v_current := v_current + 1;
    v_day_of_week := EXTRACT(DOW FROM v_current)::INTEGER;
    IF (v_working_days_mask & (1 << v_day_of_week)) > 0 AND NOT (v_current = ANY(v_holidays)) THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_current;
END;
$$ LANGUAGE plpgsql;
