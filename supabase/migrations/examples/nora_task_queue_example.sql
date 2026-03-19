-- Example usage for Nora v2 minimal task queue
-- Assumes migration 20260316082300_nora_task_queue_minimal.sql is already applied.

-- 1) Create a task in the inbox
INSERT INTO public.tasks (
  company_id,
  title,
  status,
  priority,
  owner,
  depends_on,
  acceptance,
  last_action_at,
  next_step,
  metadata,
  created_by
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Подготовить task queue schema для Норы v2',
  'inbox',
  'high',
  'kodogriz-db',
  '[]'::jsonb,
  '["Есть tasks/task_events schema", "Есть миграция", "Ничего не сломано"]'::jsonb,
  NOW(),
  'Создать минимальную SQL migration',
  '{"source":"telegram","queue":"nora-v2"}'::jsonb,
  NULL
);

-- 2) Log event after triage
INSERT INTO public.task_events (
  task_id,
  company_id,
  event_type,
  from_status,
  to_status,
  actor_label,
  payload
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000001',
  'status_changed',
  'inbox',
  'triaged',
  'planogryz',
  '{"note":"Задача разобрана и готова к исполнителю"}'::jsonb
);

-- 3) Typical queue read
SELECT
  id,
  title,
  status,
  priority,
  owner,
  depends_on AS "dependsOn",
  acceptance,
  last_action_at AS "lastActionAt",
  next_step AS "nextStep"
FROM public.tasks
WHERE status IN ('inbox', 'triaged', 'ready', 'assigned', 'in_progress', 'blocked', 'review')
ORDER BY
  CASE priority
    WHEN 'urgent' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
    ELSE 5
  END,
  last_action_at DESC;
