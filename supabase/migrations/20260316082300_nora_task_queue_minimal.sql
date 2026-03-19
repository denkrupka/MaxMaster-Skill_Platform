-- Nora v2 minimal task queue schema
-- Safe additive migration: reuses existing public.tasks table and adds a new public.task_events table.
-- No destructive changes, no deploy, no status enum/constraint enforcement to avoid breaking current app flows.

BEGIN;

-- 1) Extend existing tasks table with Nora / Planogryz queue fields
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS owner TEXT,
  ADD COLUMN IF NOT EXISTS depends_on JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS acceptance JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_action_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS next_step TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.tasks.owner IS 'Nora queue owner label (agent, human, team, or freeform assignee name).';
COMMENT ON COLUMN public.tasks.depends_on IS 'JSONB array of task ids or external dependency labels. Example: ["uuid-1", "waiting:spec"]';
COMMENT ON COLUMN public.tasks.acceptance IS 'JSONB array of acceptance criteria strings or structured checklist objects.';
COMMENT ON COLUMN public.tasks.last_action_at IS 'Last meaningful activity timestamp for queue ordering and stale-task detection.';
COMMENT ON COLUMN public.tasks.next_step IS 'Single explicit next action for the task queue.';
COMMENT ON COLUMN public.tasks.metadata IS 'Optional freeform JSON for Nora-specific queue context.';

-- Backfill Nora-friendly defaults for existing rows where useful
UPDATE public.tasks
SET
  owner = COALESCE(owner, CASE WHEN assigned_to IS NOT NULL THEN assigned_to::text ELSE NULL END),
  last_action_at = COALESCE(updated_at, created_at, NOW())
WHERE owner IS NULL
   OR last_action_at IS NULL;

-- 2) Add lightweight task event stream
CREATE TABLE IF NOT EXISTS public.task_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actor_label TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.task_events IS 'Append-only event log for Nora task queue actions and status transitions.';
COMMENT ON COLUMN public.task_events.event_type IS 'Examples: created, status_changed, assigned, comment, acceptance_updated, next_step_updated.';
COMMENT ON COLUMN public.task_events.payload IS 'Structured event details (diff, note, dependsOn update, acceptance update, etc.).';

-- 3) Indexes for queue reads
CREATE INDEX IF NOT EXISTS idx_tasks_nora_status_priority_last_action
  ON public.tasks(status, priority, last_action_at DESC);

CREATE INDEX IF NOT EXISTS idx_tasks_nora_owner
  ON public.tasks(owner);

CREATE INDEX IF NOT EXISTS idx_tasks_nora_last_action
  ON public.tasks(last_action_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_events_task_created_at
  ON public.task_events(task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_events_company_created_at
  ON public.task_events(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_events_type
  ON public.task_events(event_type);

-- 4) RLS for task_events mirrors existing company-based task access
ALTER TABLE public.task_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "task_events_select" ON public.task_events
    FOR SELECT USING (
      company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "task_events_manage" ON public.task_events
    FOR ALL USING (
      company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
    )
    WITH CHECK (
      company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5) Guardrails documentation via CHECKs that do not block legacy rows too aggressively
DO $$ BEGIN
  ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_nora_depends_on_is_array
    CHECK (jsonb_typeof(depends_on) = 'array');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_nora_acceptance_is_array
    CHECK (jsonb_typeof(acceptance) = 'array');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allowed Nora statuses (documentation only; not enforced globally to avoid breaking existing task flows).
COMMENT ON COLUMN public.tasks.status IS 'Nora queue preferred statuses: inbox, triaged, ready, assigned, in_progress, blocked, review, done, cancelled. Legacy statuses may still exist.';
COMMENT ON COLUMN public.tasks.priority IS 'Recommended queue priorities: low, medium, high, urgent.';

COMMIT;
