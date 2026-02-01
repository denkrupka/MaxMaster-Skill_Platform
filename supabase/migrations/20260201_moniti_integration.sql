-- ============================================================
-- MONITI INTEGRATION: Complete Database Migration
-- ============================================================
-- Run this migration against your Supabase database
-- Order: Section A → B → Module 1 → Module 2 → Module 3 → Module 4 → Module 5 → Section I → Section J
-- ============================================================

-- ============================================================
-- РАЗДЕЛ A: Настройки рабочего времени компании
-- ============================================================

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Warsaw',
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'PLN',
  ADD COLUMN IF NOT EXISTS allow_weekend_access BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS night_time_from TEXT DEFAULT '21:00',
  ADD COLUMN IF NOT EXISTS night_time_to TEXT DEFAULT '05:00',
  ADD COLUMN IF NOT EXISTS max_working_time_minutes INTEGER DEFAULT 720,
  ADD COLUMN IF NOT EXISTS delay_tolerance_minutes INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS working_hours JSONB DEFAULT '{
    "monday":    {"enabled": true,  "start_time": "08:00", "end_time": "16:00"},
    "tuesday":   {"enabled": true,  "start_time": "08:00", "end_time": "16:00"},
    "wednesday": {"enabled": true,  "start_time": "08:00", "end_time": "16:00"},
    "thursday":  {"enabled": true,  "start_time": "08:00", "end_time": "16:00"},
    "friday":    {"enabled": true,  "start_time": "08:00", "end_time": "16:00"},
    "saturday":  {"enabled": false, "start_time": null,    "end_time": null},
    "sunday":    {"enabled": false, "start_time": null,    "end_time": null}
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS start_round_time JSONB DEFAULT '{"precision": 0, "method": "none"}'::jsonb,
  ADD COLUMN IF NOT EXISTS finish_round_time JSONB DEFAULT '{"precision": 0, "method": "none"}'::jsonb;

COMMENT ON COLUMN companies.timezone IS 'IANA timezone, e.g. Europe/Warsaw';
COMMENT ON COLUMN companies.currency IS 'ISO 4217 currency code, e.g. PLN';
COMMENT ON COLUMN companies.allow_weekend_access IS 'Allow work on weekends';
COMMENT ON COLUMN companies.night_time_from IS 'Night shift start (HH:MM)';
COMMENT ON COLUMN companies.night_time_to IS 'Night shift end (HH:MM)';
COMMENT ON COLUMN companies.max_working_time_minutes IS 'Max daily working time in minutes. Default 720 = 12h';
COMMENT ON COLUMN companies.delay_tolerance_minutes IS 'Allowed lateness in minutes. NULL = no tolerance';
COMMENT ON COLUMN companies.working_hours IS 'Working hours per day: {day: {enabled, start_time, end_time}}';
COMMENT ON COLUMN companies.start_round_time IS 'Clock-in rounding: {precision: minutes, method: ceil|floor|none}';
COMMENT ON COLUMN companies.finish_round_time IS 'Clock-out rounding: {precision: minutes, method: ceil|floor|none}';


-- ============================================================
-- РАЗДЕЛ B: Объекты с иерархией и геозонами
-- ============================================================

CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  label TEXT,
  parent_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  address_street TEXT,
  address_city TEXT,
  address_postal_code TEXT,
  address_country TEXT DEFAULT 'PL',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  range_meters INTEGER DEFAULT 200,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS department_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(department_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_departments_company ON departments(company_id);
CREATE INDEX IF NOT EXISTS idx_departments_parent ON departments(parent_id);
CREATE INDEX IF NOT EXISTS idx_departments_archived ON departments(company_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_dept_members_dept ON department_members(department_id);
CREATE INDEX IF NOT EXISTS idx_dept_members_user ON department_members(user_id);
CREATE INDEX IF NOT EXISTS idx_dept_members_company ON department_members(company_id);

-- Department label trigger
CREATE OR REPLACE FUNCTION update_department_label()
RETURNS TRIGGER AS $$
DECLARE
  parent_label TEXT;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT label INTO parent_label FROM departments WHERE id = NEW.parent_id;
    IF parent_label IS NOT NULL AND parent_label != '' THEN
      NEW.label := parent_label || ' > ' || NEW.name;
    ELSE
      SELECT name INTO parent_label FROM departments WHERE id = NEW.parent_id;
      NEW.label := parent_label || ' > ' || NEW.name;
    END IF;
  ELSE
    NEW.label := NEW.name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_department_label ON departments;
CREATE TRIGGER trg_department_label
  BEFORE INSERT OR UPDATE OF name, parent_id ON departments
  FOR EACH ROW EXECUTE FUNCTION update_department_label();

-- Department updated_at trigger
CREATE OR REPLACE FUNCTION update_departments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_departments_updated_at ON departments;
CREATE TRIGGER trg_departments_updated_at
  BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION update_departments_updated_at();

-- RLS for departments
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "departments_select_own_company" ON departments
    FOR SELECT USING (
      company_id = (SELECT company_id FROM users WHERE id = auth.uid())
      OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_global_user = true)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "departments_insert_admin" ON departments
    FOR INSERT WITH CHECK (
      company_id = (SELECT company_id FROM users WHERE id = auth.uid() AND role IN ('company_admin', 'hr'))
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "departments_update_admin" ON departments
    FOR UPDATE USING (
      company_id = (SELECT company_id FROM users WHERE id = auth.uid() AND role IN ('company_admin', 'hr'))
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "departments_delete_admin" ON departments
    FOR DELETE USING (
      company_id = (SELECT company_id FROM users WHERE id = auth.uid() AND role = 'company_admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "dept_members_select_own_company" ON department_members
    FOR SELECT USING (
      company_id = (SELECT company_id FROM users WHERE id = auth.uid())
      OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_global_user = true)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "dept_members_manage" ON department_members
    FOR ALL USING (
      company_id = (SELECT company_id FROM users WHERE id = auth.uid() AND role IN ('company_admin', 'hr'))
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- МОДУЛЬ 1: Учёт рабочего времени (Time & Attendance)
-- ============================================================

CREATE TABLE IF NOT EXISTS worker_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT DEFAULT 'absent',
  confirmed BOOLEAN DEFAULT false,
  finished BOOLEAN DEFAULT false,
  total_time_minutes INTEGER DEFAULT 0,
  work_time_minutes INTEGER DEFAULT 0,
  break_time_minutes INTEGER DEFAULT 0,
  overtime_minutes INTEGER DEFAULT 0,
  note TEXT,
  manager_note TEXT,
  is_business_day BOOLEAN DEFAULT true,
  is_holiday BOOLEAN DEFAULT false,
  is_weekend BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS worker_day_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_day_id UUID NOT NULL REFERENCES worker_days(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  finish_time TIMESTAMPTZ,
  finished BOOLEAN DEFAULT false,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  position_id UUID,
  is_remote BOOLEAN DEFAULT false,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS worker_day_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES worker_day_entries(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  finish_time TIMESTAMPTZ,
  finished BOOLEAN DEFAULT false,
  approved BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS time_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT DEFAULT 'web',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS worker_day_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  worker_day_id UUID REFERENCES worker_days(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  status TEXT DEFAULT 'pending',
  requested_entries JSONB NOT NULL,
  note TEXT,
  reviewer_id UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS worker_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_status TEXT DEFAULT 'offline',
  activity_started_at TIMESTAMPTZ,
  work_started_at TIMESTAMPTZ,
  work_finished_at TIMESTAMPTZ,
  current_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  is_remote BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_worker_days_company_date ON worker_days(company_id, date);
CREATE INDEX IF NOT EXISTS idx_worker_days_user_date ON worker_days(user_id, date);
CREATE INDEX IF NOT EXISTS idx_worker_day_entries_day ON worker_day_entries(worker_day_id);
CREATE INDEX IF NOT EXISTS idx_worker_day_entries_user ON worker_day_entries(user_id, company_id);
CREATE INDEX IF NOT EXISTS idx_worker_day_activities_entry ON worker_day_activities(entry_id);
CREATE INDEX IF NOT EXISTS idx_time_actions_user_ts ON time_actions(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_time_actions_company_ts ON time_actions(company_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_worker_day_requests_company ON worker_day_requests(company_id, status);
CREATE INDEX IF NOT EXISTS idx_worker_day_requests_user ON worker_day_requests(user_id, date);
CREATE INDEX IF NOT EXISTS idx_worker_states_company ON worker_states(company_id);

-- RLS
ALTER TABLE worker_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_day_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_day_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_day_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_states ENABLE ROW LEVEL SECURITY;

-- worker_days policies
DO $$ BEGIN
  CREATE POLICY "worker_days_select" ON worker_days FOR SELECT USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
    AND (
      user_id = auth.uid()
      OR (SELECT role FROM users WHERE id = auth.uid()) IN ('company_admin', 'hr', 'coordinator', 'brigadir')
      OR (SELECT is_global_user FROM users WHERE id = auth.uid()) = true
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "worker_days_insert" ON worker_days FOR INSERT WITH CHECK (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "worker_days_update" ON worker_days FOR UPDATE USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
    AND (
      user_id = auth.uid()
      OR (SELECT role FROM users WHERE id = auth.uid()) IN ('company_admin', 'hr')
      OR (SELECT is_global_user FROM users WHERE id = auth.uid()) = true
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- entries policies
DO $$ BEGIN
  CREATE POLICY "entries_select" ON worker_day_entries FOR SELECT USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
    AND (
      user_id = auth.uid()
      OR (SELECT role FROM users WHERE id = auth.uid()) IN ('company_admin', 'hr', 'coordinator', 'brigadir')
      OR (SELECT is_global_user FROM users WHERE id = auth.uid()) = true
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "entries_manage" ON worker_day_entries FOR ALL USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- activities policies
DO $$ BEGIN
  CREATE POLICY "activities_select" ON worker_day_activities FOR SELECT USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
    AND (
      user_id = auth.uid()
      OR (SELECT role FROM users WHERE id = auth.uid()) IN ('company_admin', 'hr', 'coordinator', 'brigadir')
      OR (SELECT is_global_user FROM users WHERE id = auth.uid()) = true
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "activities_manage" ON worker_day_activities FOR ALL USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- actions policies
DO $$ BEGIN
  CREATE POLICY "actions_select" ON time_actions FOR SELECT USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
    AND (
      user_id = auth.uid()
      OR (SELECT role FROM users WHERE id = auth.uid()) IN ('company_admin', 'hr')
      OR (SELECT is_global_user FROM users WHERE id = auth.uid()) = true
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "actions_insert" ON time_actions FOR INSERT WITH CHECK (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- requests policies
DO $$ BEGIN
  CREATE POLICY "requests_select" ON worker_day_requests FOR SELECT USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
    AND (
      user_id = auth.uid()
      OR (SELECT role FROM users WHERE id = auth.uid()) IN ('company_admin', 'hr')
      OR (SELECT is_global_user FROM users WHERE id = auth.uid()) = true
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "requests_manage" ON worker_day_requests FOR ALL USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- states policies
DO $$ BEGIN
  CREATE POLICY "states_select" ON worker_states FOR SELECT USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "states_manage" ON worker_states FOR ALL USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- ФУНКЦИЯ: process_time_action (clock-in/out)
-- ============================================================

CREATE OR REPLACE FUNCTION process_time_action(
  p_user_id UUID,
  p_company_id UUID,
  p_action_type TEXT,
  p_timestamp TIMESTAMPTZ DEFAULT NOW(),
  p_source TEXT DEFAULT 'web',
  p_department_id UUID DEFAULT NULL,
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_action_id UUID;
  v_date DATE;
  v_worker_day_id UUID;
  v_entry_id UUID;
  v_activity_id UUID;
  v_company RECORD;
BEGIN
  SELECT timezone INTO v_company FROM companies WHERE id = p_company_id;
  v_date := (p_timestamp AT TIME ZONE COALESCE(v_company.timezone, 'Europe/Warsaw'))::DATE;

  INSERT INTO time_actions (company_id, user_id, action_type, timestamp, source, latitude, longitude, department_id, created_by, note)
  VALUES (p_company_id, p_user_id, p_action_type, p_timestamp, p_source, p_latitude, p_longitude, p_department_id, p_user_id, p_note)
  RETURNING id INTO v_action_id;

  INSERT INTO worker_days (company_id, user_id, date, status)
  VALUES (p_company_id, p_user_id, v_date, 'present')
  ON CONFLICT (user_id, date) DO UPDATE SET status = 'present', updated_at = NOW()
  RETURNING id INTO v_worker_day_id;

  CASE p_action_type
    WHEN 'work_start' THEN
      INSERT INTO worker_day_entries (worker_day_id, company_id, user_id, start_time, department_id)
      VALUES (v_worker_day_id, p_company_id, p_user_id, p_timestamp, p_department_id)
      RETURNING id INTO v_entry_id;

      INSERT INTO worker_day_activities (entry_id, company_id, user_id, type, start_time)
      VALUES (v_entry_id, p_company_id, p_user_id, 'work', p_timestamp);

      INSERT INTO worker_states (company_id, user_id, current_status, activity_started_at, work_started_at, current_department_id)
      VALUES (p_company_id, p_user_id, 'working', p_timestamp, p_timestamp, p_department_id)
      ON CONFLICT (user_id) DO UPDATE SET
        current_status = 'working',
        activity_started_at = p_timestamp,
        work_started_at = p_timestamp,
        work_finished_at = NULL,
        current_department_id = p_department_id,
        updated_at = NOW();

    WHEN 'work_finish' THEN
      UPDATE worker_day_activities SET finish_time = p_timestamp, finished = true
      WHERE user_id = p_user_id AND finished = false AND type = 'work'
        AND entry_id IN (SELECT id FROM worker_day_entries WHERE worker_day_id = v_worker_day_id AND finished = false);

      UPDATE worker_day_entries SET finish_time = p_timestamp, finished = true
      WHERE worker_day_id = v_worker_day_id AND user_id = p_user_id AND finished = false;

      UPDATE worker_states SET
        current_status = 'offline',
        work_finished_at = p_timestamp,
        activity_started_at = NULL,
        updated_at = NOW()
      WHERE user_id = p_user_id;

      PERFORM recalculate_worker_day(v_worker_day_id);

    WHEN 'break_start' THEN
      UPDATE worker_day_activities SET finish_time = p_timestamp, finished = true
      WHERE user_id = p_user_id AND finished = false AND type = 'work'
        AND entry_id IN (SELECT id FROM worker_day_entries WHERE worker_day_id = v_worker_day_id AND finished = false);

      SELECT id INTO v_entry_id FROM worker_day_entries
      WHERE worker_day_id = v_worker_day_id AND user_id = p_user_id AND finished = false
      LIMIT 1;

      IF v_entry_id IS NOT NULL THEN
        INSERT INTO worker_day_activities (entry_id, company_id, user_id, type, start_time)
        VALUES (v_entry_id, p_company_id, p_user_id, 'break', p_timestamp);
      END IF;

      UPDATE worker_states SET current_status = 'on_break', activity_started_at = p_timestamp, updated_at = NOW()
      WHERE user_id = p_user_id;

    WHEN 'break_finish' THEN
      UPDATE worker_day_activities SET finish_time = p_timestamp, finished = true
      WHERE user_id = p_user_id AND finished = false AND type = 'break'
        AND entry_id IN (SELECT id FROM worker_day_entries WHERE worker_day_id = v_worker_day_id AND finished = false);

      SELECT id INTO v_entry_id FROM worker_day_entries
      WHERE worker_day_id = v_worker_day_id AND user_id = p_user_id AND finished = false
      LIMIT 1;

      IF v_entry_id IS NOT NULL THEN
        INSERT INTO worker_day_activities (entry_id, company_id, user_id, type, start_time)
        VALUES (v_entry_id, p_company_id, p_user_id, 'work', p_timestamp);
      END IF;

      UPDATE worker_states SET current_status = 'working', activity_started_at = p_timestamp, updated_at = NOW()
      WHERE user_id = p_user_id;

  END CASE;

  RETURN jsonb_build_object('action_id', v_action_id, 'worker_day_id', v_worker_day_id, 'status', 'ok');
END;
$$;


-- ============================================================
-- ФУНКЦИЯ: recalculate_worker_day
-- ============================================================

CREATE OR REPLACE FUNCTION recalculate_worker_day(p_worker_day_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_work_minutes INTEGER := 0;
  v_break_minutes INTEGER := 0;
  v_total_minutes INTEGER := 0;
  v_daily_norm INTEGER;
  v_overtime INTEGER := 0;
  v_user_id UUID;
  v_company_id UUID;
  rec RECORD;
BEGIN
  SELECT user_id, company_id INTO v_user_id, v_company_id FROM worker_days WHERE id = p_worker_day_id;

  FOR rec IN
    SELECT type,
           EXTRACT(EPOCH FROM (COALESCE(finish_time, NOW()) - start_time)) / 60.0 AS minutes
    FROM worker_day_activities
    WHERE entry_id IN (SELECT id FROM worker_day_entries WHERE worker_day_id = p_worker_day_id)
      AND finished = true
  LOOP
    IF rec.type = 'work' THEN
      v_work_minutes := v_work_minutes + ROUND(rec.minutes);
    ELSIF rec.type = 'break' THEN
      v_break_minutes := v_break_minutes + ROUND(rec.minutes);
    END IF;
  END LOOP;

  v_total_minutes := v_work_minutes + v_break_minutes;

  SELECT COALESCE(
    (SELECT CASE WHEN base_rate IS NOT NULL THEN 480 ELSE 480 END FROM users WHERE id = v_user_id),
    480
  ) INTO v_daily_norm;

  v_overtime := GREATEST(0, v_work_minutes - v_daily_norm);

  UPDATE worker_days SET
    total_time_minutes = v_total_minutes,
    work_time_minutes = v_work_minutes,
    break_time_minutes = v_break_minutes,
    overtime_minutes = v_overtime,
    finished = true,
    updated_at = NOW()
  WHERE id = p_worker_day_id;
END;
$$;


-- ============================================================
-- МОДУЛЬ 2: Отпуска и отсутствия (Time Off)
-- ============================================================

CREATE TABLE IF NOT EXISTS time_off_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#4b88fe',
  icon TEXT DEFAULT 'calendar',
  is_paid BOOLEAN DEFAULT true,
  requires_approval BOOLEAN DEFAULT true,
  allows_half_day BOOLEAN DEFAULT false,
  allows_hourly BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS time_off_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  time_off_type_id UUID NOT NULL REFERENCES time_off_types(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  total_days NUMERIC(5,1) DEFAULT 0,
  used_days NUMERIC(5,1) DEFAULT 0,
  carried_over_days NUMERIC(5,1) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, time_off_type_id, year)
);

CREATE TABLE IF NOT EXISTS time_off_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  time_off_type_id UUID NOT NULL REFERENCES time_off_types(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  all_day BOOLEAN DEFAULT true,
  start_time TIME,
  end_time TIME,
  hourly BOOLEAN DEFAULT false,
  amount NUMERIC(5,1) NOT NULL,
  status TEXT DEFAULT 'pending',
  note_worker TEXT,
  note_reviewer TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_off_types_company ON time_off_types(company_id);
CREATE INDEX IF NOT EXISTS idx_time_off_limits_user_year ON time_off_limits(user_id, year);
CREATE INDEX IF NOT EXISTS idx_time_off_limits_company ON time_off_limits(company_id, year);
CREATE INDEX IF NOT EXISTS idx_time_off_requests_company ON time_off_requests(company_id, status);
CREATE INDEX IF NOT EXISTS idx_time_off_requests_user ON time_off_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_time_off_requests_dates ON time_off_requests(company_id, start_date, end_date);

ALTER TABLE time_off_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_off_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_off_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "toff_types_select" ON time_off_types FOR SELECT USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "toff_types_manage" ON time_off_types FOR ALL USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid() AND role IN ('company_admin', 'hr'))
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "toff_limits_select" ON time_off_limits FOR SELECT USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
    AND (
      user_id = auth.uid()
      OR (SELECT role FROM users WHERE id = auth.uid()) IN ('company_admin', 'hr')
      OR (SELECT is_global_user FROM users WHERE id = auth.uid()) = true
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "toff_limits_manage" ON time_off_limits FOR ALL USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid() AND role IN ('company_admin', 'hr'))
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "toff_requests_select" ON time_off_requests FOR SELECT USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
    AND (
      user_id = auth.uid()
      OR (SELECT role FROM users WHERE id = auth.uid()) IN ('company_admin', 'hr')
      OR (SELECT is_global_user FROM users WHERE id = auth.uid()) = true
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "toff_requests_insert" ON time_off_requests FOR INSERT WITH CHECK (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
    AND user_id = auth.uid()
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "toff_requests_update" ON time_off_requests FOR UPDATE USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
    AND (
      user_id = auth.uid()
      OR (SELECT role FROM users WHERE id = auth.uid()) IN ('company_admin', 'hr')
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- МОДУЛЬ 3: Графики работ (Work Schedule)
-- ============================================================

CREATE TABLE IF NOT EXISTS schedule_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_minutes INTEGER DEFAULT 0,
  color TEXT DEFAULT '#4b88fe',
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schedule_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES schedule_templates(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  custom_start_time TIME,
  custom_end_time TIME,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_schedule_templates_company ON schedule_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_schedule_assignments_company_date ON schedule_assignments(company_id, date);
CREATE INDEX IF NOT EXISTS idx_schedule_assignments_user_date ON schedule_assignments(user_id, date);

ALTER TABLE schedule_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_assignments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "sched_templates_select" ON schedule_templates FOR SELECT USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "sched_templates_manage" ON schedule_templates FOR ALL USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid() AND role IN ('company_admin', 'hr', 'coordinator'))
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "sched_assignments_select" ON schedule_assignments FOR SELECT USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
    AND (
      user_id = auth.uid()
      OR (SELECT role FROM users WHERE id = auth.uid()) IN ('company_admin', 'hr', 'coordinator')
      OR (SELECT is_global_user FROM users WHERE id = auth.uid()) = true
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "sched_assignments_manage" ON schedule_assignments FOR ALL USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid() AND role IN ('company_admin', 'hr', 'coordinator'))
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- МОДУЛЬ 4: Проекты (Tasks & Projects)
-- ============================================================

CREATE TABLE IF NOT EXISTS project_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  note TEXT,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES project_customers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  color TEXT DEFAULT '#4b88fe',
  budget_hours NUMERIC(10,1),
  budget_amount NUMERIC(12,2),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo',
  priority TEXT DEFAULT 'medium',
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id),
  due_date DATE,
  estimated_hours NUMERIC(6,1),
  tags TEXT[],
  is_archived BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  minutes INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_company ON projects(company_id, status);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_company ON tasks(company_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_task_time_logs_task ON task_time_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_time_logs_user ON task_time_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_project_customers_company ON project_customers(company_id);

ALTER TABLE project_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "projects_select" ON projects FOR SELECT USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "projects_manage" ON projects FOR ALL USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid() AND role IN ('company_admin', 'hr', 'coordinator'))
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "tasks_select" ON tasks FOR SELECT USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
    AND (
      assigned_to = auth.uid()
      OR created_by = auth.uid()
      OR (SELECT role FROM users WHERE id = auth.uid()) IN ('company_admin', 'hr', 'coordinator')
      OR (SELECT is_global_user FROM users WHERE id = auth.uid()) = true
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "tasks_manage" ON tasks FOR ALL USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "time_logs_select" ON task_time_logs FOR SELECT USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "time_logs_manage" ON task_time_logs FOR ALL USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "customers_select" ON project_customers FOR SELECT USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "customers_manage" ON project_customers FOR ALL USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid() AND role IN ('company_admin', 'hr', 'coordinator'))
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "members_select" ON project_members FOR SELECT USING (
    project_id IN (SELECT id FROM projects WHERE company_id = (SELECT company_id FROM users WHERE id = auth.uid()))
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "members_manage" ON project_members FOR ALL USING (
    project_id IN (SELECT id FROM projects WHERE company_id = (SELECT company_id FROM users WHERE id = auth.uid() AND role IN ('company_admin', 'hr', 'coordinator')))
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "attachments_select" ON task_attachments FOR SELECT USING (
    task_id IN (SELECT id FROM tasks WHERE company_id = (SELECT company_id FROM users WHERE id = auth.uid()))
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "attachments_manage" ON task_attachments FOR ALL USING (
    task_id IN (SELECT id FROM tasks WHERE company_id = (SELECT company_id FROM users WHERE id = auth.uid()))
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- МОДУЛЬ 5: Отчёты и Payroll
-- ============================================================

CREATE TABLE IF NOT EXISTS timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  total_work_days INTEGER DEFAULT 0,
  total_work_minutes INTEGER DEFAULT 0,
  total_break_minutes INTEGER DEFAULT 0,
  total_overtime_minutes INTEGER DEFAULT 0,
  total_night_minutes INTEGER DEFAULT 0,
  total_weekend_minutes INTEGER DEFAULT 0,
  total_holiday_minutes INTEGER DEFAULT 0,
  total_time_off_days NUMERIC(5,1) DEFAULT 0,
  base_salary NUMERIC(10,2) DEFAULT 0,
  overtime_salary NUMERIC(10,2) DEFAULT 0,
  night_salary NUMERIC(10,2) DEFAULT 0,
  weekend_salary NUMERIC(10,2) DEFAULT 0,
  holiday_salary NUMERIC(10,2) DEFAULT 0,
  bonus_salary NUMERIC(10,2) DEFAULT 0,
  total_salary NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'draft',
  confirmed_by UUID REFERENCES users(id),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, year, month)
);

CREATE TABLE IF NOT EXISTS saved_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  parameters JSONB NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timesheets_company ON timesheets(company_id, year, month);
CREATE INDEX IF NOT EXISTS idx_timesheets_user ON timesheets(user_id, year, month);
CREATE INDEX IF NOT EXISTS idx_saved_reports_company ON saved_reports(company_id);

ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "timesheets_select" ON timesheets FOR SELECT USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
    AND (
      user_id = auth.uid()
      OR (SELECT role FROM users WHERE id = auth.uid()) IN ('company_admin', 'hr', 'coordinator', 'brigadir')
      OR (SELECT is_global_user FROM users WHERE id = auth.uid()) = true
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "timesheets_manage" ON timesheets FOR ALL USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid() AND role IN ('company_admin', 'hr'))
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "reports_select" ON saved_reports FOR SELECT USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "reports_manage" ON saved_reports FOR ALL USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid() AND role IN ('company_admin', 'hr'))
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- РАЗДЕЛ I: Праздничный календарь
-- ============================================================

CREATE TABLE IF NOT EXISTS holiday_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  name TEXT NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  country_code TEXT DEFAULT 'PL',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, date)
);

CREATE INDEX IF NOT EXISTS idx_holiday_days_company ON holiday_days(company_id, date);

ALTER TABLE holiday_days ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "holidays_select" ON holiday_days FOR SELECT USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "holidays_manage" ON holiday_days FOR ALL USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid() AND role IN ('company_admin', 'hr'))
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- РАЗДЕЛ J: Центр уведомлений (Notification Hub)
-- ============================================================

-- If notifications table already exists (from earlier migration), add missing columns
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    -- Add company_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'company_id') THEN
      ALTER TABLE notifications ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
    END IF;
    -- Add type if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'type') THEN
      ALTER TABLE notifications ADD COLUMN type TEXT DEFAULT 'general';
    END IF;
    -- Add read_at if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'read_at') THEN
      ALTER TABLE notifications ADD COLUMN read_at TIMESTAMPTZ;
    END IF;
    -- Add entity_type if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'entity_type') THEN
      ALTER TABLE notifications ADD COLUMN entity_type TEXT;
    END IF;
    -- Add entity_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'entity_id') THEN
      ALTER TABLE notifications ADD COLUMN entity_id UUID;
    END IF;
    -- Make user_id NOT NULL if it's nullable
    ALTER TABLE notifications ALTER COLUMN user_id SET NOT NULL;
    -- Backfill company_id from users table for existing rows
    UPDATE notifications SET company_id = (SELECT company_id FROM users WHERE users.id = notifications.user_id) WHERE company_id IS NULL;
    -- Now make company_id NOT NULL
    ALTER TABLE notifications ALTER COLUMN company_id SET NOT NULL;
  ELSE
    -- Create fresh if table doesn't exist
    CREATE TABLE notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'general',
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link TEXT,
      is_read BOOLEAN DEFAULT false,
      read_at TIMESTAMPTZ,
      entity_type TEXT,
      entity_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_company ON notifications(company_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (
    user_id = auth.uid()
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "notifications_update" ON notifications FOR UPDATE USING (
    user_id = auth.uid()
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "notifications_insert" ON notifications FOR INSERT WITH CHECK (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- РЕГИСТРАЦИЯ МОДУЛЕЙ
-- ============================================================

INSERT INTO modules (code, name_pl, name_en, description_pl, available_roles, base_price_per_user, is_active, display_order, icon)
VALUES
  ('time_attendance', 'Czas pracy', 'Time & Attendance', 'Rejestracja czasu pracy, obecność, nadgodziny, wnioski o korekty', ARRAY['company_admin', 'hr', 'coordinator', 'brigadir', 'employee'], 49, true, 3, 'Clock'),
  ('time_off', 'Urlopy i nieobecności', 'Time Off', 'Zarządzanie urlopami, zwolnieniami, limitami dni wolnych', ARRAY['company_admin', 'hr', 'coordinator', 'brigadir', 'employee'], 29, true, 4, 'CalendarOff'),
  ('work_schedule', 'Grafik pracy', 'Work Schedule', 'Planowanie zmian, szablony grafików, przypisania pracowników', ARRAY['company_admin', 'hr', 'coordinator', 'brigadir', 'employee'], 39, true, 5, 'CalendarRange'),
  ('tasks_projects', 'Zadania i projekty', 'Tasks & Projects', 'Zarządzanie zadaniami, projektami, klientami, logowanie czasu', ARRAY['company_admin', 'hr', 'coordinator', 'brigadir', 'employee'], 39, true, 6, 'FolderKanban'),
  ('reports_payroll', 'Raporty i rozliczenia', 'Reports & Payroll', 'Tabele czasu pracy, raporty obecności, rozliczenia wynagrodzeń', ARRAY['company_admin', 'hr', 'coordinator', 'brigadir'], 49, true, 7, 'BarChart3')
ON CONFLICT (code) DO NOTHING;


-- ============================================================
-- DONE
-- ============================================================
