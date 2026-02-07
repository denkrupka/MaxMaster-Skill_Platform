-- =====================================================
-- Migration: Approvals Module (Uzgodnienia)
-- Date: 2026-02-07
-- Description: Approval workflows and requests
-- =====================================================

-- 1. Approval Workflow Templates
CREATE TABLE IF NOT EXISTS approval_workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  allow_modification BOOLEAN DEFAULT FALSE,
  notify_involved BOOLEAN DEFAULT TRUE,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- steps: [{step: 1, name: "Kierownik projektu", approvers: [{user_id: ...}, {role_id: ...}], require_all: false}]
  is_active BOOLEAN DEFAULT TRUE,
  created_by_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Approval Requests
DO $$ BEGIN
  CREATE TYPE approval_request_status AS ENUM ('pending', 'in_progress', 'approved', 'rejected', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE approval_entity_type AS ENUM ('estimate', 'act', 'document', 'change_request', 'offer', 'order');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  workflow_template_id UUID REFERENCES approval_workflow_templates(id) ON DELETE SET NULL,
  entity_type approval_entity_type NOT NULL,
  entity_id UUID NOT NULL,
  subject TEXT NOT NULL,
  message TEXT,
  current_step INTEGER DEFAULT 1,
  status approval_request_status DEFAULT 'pending',
  due_date DATE,
  completed_at TIMESTAMPTZ,
  initiated_by_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Approval Actions (history of approvals)
DO $$ BEGIN
  CREATE TYPE approval_action_type AS ENUM ('approved', 'rejected', 'returned', 'delegated');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS approval_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  step INTEGER NOT NULL,
  user_id UUID NOT NULL,
  action approval_action_type NOT NULL,
  comment TEXT,
  delegated_to_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Approval Pending (кто должен согласовать на текущем шаге)
CREATE TABLE IF NOT EXISTS approval_pending (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  step INTEGER NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notified_at TIMESTAMPTZ,
  reminded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(request_id, step, user_id)
);

-- 5. Approval Attachments
CREATE TABLE IF NOT EXISTS approval_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  action_id UUID REFERENCES approval_actions(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  uploaded_by_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Approval Comments
CREATE TABLE IF NOT EXISTS approval_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Enable RLS
ALTER TABLE approval_workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_pending ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_comments ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies
CREATE POLICY "approval_workflow_templates_company_access" ON approval_workflow_templates
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "approval_requests_company_access" ON approval_requests
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "approval_actions_access" ON approval_actions
  FOR ALL USING (request_id IN (
    SELECT id FROM approval_requests WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY "approval_pending_access" ON approval_pending
  FOR ALL USING (request_id IN (
    SELECT id FROM approval_requests WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY "approval_attachments_access" ON approval_attachments
  FOR ALL USING (request_id IN (
    SELECT id FROM approval_requests WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY "approval_comments_access" ON approval_comments
  FOR ALL USING (request_id IN (
    SELECT id FROM approval_requests WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

-- 9. Indexes
CREATE INDEX IF NOT EXISTS idx_approval_workflow_templates_company ON approval_workflow_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_company ON approval_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_project ON approval_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_entity ON approval_requests(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_initiated_by ON approval_requests(initiated_by_id);
CREATE INDEX IF NOT EXISTS idx_approval_actions_request ON approval_actions(request_id);
CREATE INDEX IF NOT EXISTS idx_approval_actions_user ON approval_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_approval_pending_request ON approval_pending(request_id);
CREATE INDEX IF NOT EXISTS idx_approval_pending_user ON approval_pending(user_id);
CREATE INDEX IF NOT EXISTS idx_approval_attachments_request ON approval_attachments(request_id);
CREATE INDEX IF NOT EXISTS idx_approval_comments_request ON approval_comments(request_id);

-- 10. Triggers
CREATE TRIGGER update_approval_workflow_templates_updated_at BEFORE UPDATE ON approval_workflow_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_approval_requests_updated_at BEFORE UPDATE ON approval_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 11. Function to process approval action
CREATE OR REPLACE FUNCTION process_approval_action()
RETURNS TRIGGER AS $$
DECLARE
  v_request RECORD;
  v_template RECORD;
  v_current_step JSONB;
  v_require_all BOOLEAN;
  v_total_approvers INTEGER;
  v_approved_count INTEGER;
  v_next_step INTEGER;
BEGIN
  -- Get the request
  SELECT * INTO v_request FROM approval_requests WHERE id = NEW.request_id;

  IF v_request.workflow_template_id IS NOT NULL THEN
    SELECT * INTO v_template FROM approval_workflow_templates WHERE id = v_request.workflow_template_id;

    -- Get current step config
    SELECT step_config INTO v_current_step
    FROM jsonb_array_elements(v_template.steps) AS step_config
    WHERE (step_config->>'step')::INTEGER = NEW.step;

    v_require_all := COALESCE((v_current_step->>'require_all')::BOOLEAN, FALSE);
  ELSE
    v_require_all := FALSE;
  END IF;

  IF NEW.action = 'rejected' THEN
    -- Reject the whole request
    UPDATE approval_requests SET
      status = 'rejected',
      completed_at = NOW()
    WHERE id = NEW.request_id;

    -- Remove pending approvals
    DELETE FROM approval_pending WHERE request_id = NEW.request_id;

  ELSIF NEW.action = 'returned' THEN
    -- Return to previous step or keep current
    UPDATE approval_requests SET
      current_step = GREATEST(1, NEW.step - 1),
      status = 'in_progress'
    WHERE id = NEW.request_id;

  ELSIF NEW.action = 'approved' THEN
    -- Remove this user from pending
    DELETE FROM approval_pending
    WHERE request_id = NEW.request_id AND step = NEW.step AND user_id = NEW.user_id;

    IF v_require_all THEN
      -- Check if all approvers for this step have approved
      SELECT COUNT(*) INTO v_approved_count
      FROM approval_pending
      WHERE request_id = NEW.request_id AND step = NEW.step;

      IF v_approved_count > 0 THEN
        -- Still waiting for more approvals
        RETURN NEW;
      END IF;
    END IF;

    -- Move to next step or complete
    v_next_step := NEW.step + 1;

    IF v_request.workflow_template_id IS NOT NULL THEN
      IF v_next_step > jsonb_array_length(v_template.steps) THEN
        -- All steps completed
        UPDATE approval_requests SET
          status = 'approved',
          completed_at = NOW()
        WHERE id = NEW.request_id;
      ELSE
        -- Move to next step
        UPDATE approval_requests SET
          current_step = v_next_step,
          status = 'in_progress'
        WHERE id = NEW.request_id;
      END IF;
    ELSE
      -- Simple approval without workflow
      UPDATE approval_requests SET
        status = 'approved',
        completed_at = NOW()
      WHERE id = NEW.request_id;
    END IF;

  ELSIF NEW.action = 'delegated' THEN
    -- Add delegated user to pending
    INSERT INTO approval_pending (request_id, step, user_id)
    VALUES (NEW.request_id, NEW.step, NEW.delegated_to_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER process_approval_action_trigger
  AFTER INSERT ON approval_actions
  FOR EACH ROW EXECUTE FUNCTION process_approval_action();

-- 12. Function to initialize approval pending users
CREATE OR REPLACE FUNCTION initialize_approval_pending()
RETURNS TRIGGER AS $$
DECLARE
  v_template RECORD;
  v_first_step JSONB;
  v_approver JSONB;
BEGIN
  IF NEW.workflow_template_id IS NOT NULL THEN
    SELECT * INTO v_template FROM approval_workflow_templates WHERE id = NEW.workflow_template_id;

    -- Get first step
    SELECT step_config INTO v_first_step
    FROM jsonb_array_elements(v_template.steps) AS step_config
    WHERE (step_config->>'step')::INTEGER = 1;

    -- Add approvers to pending
    FOR v_approver IN SELECT * FROM jsonb_array_elements(v_first_step->'approvers')
    LOOP
      IF v_approver->>'user_id' IS NOT NULL THEN
        INSERT INTO approval_pending (request_id, step, user_id)
        VALUES (NEW.id, 1, (v_approver->>'user_id')::UUID)
        ON CONFLICT DO NOTHING;
      ELSIF v_approver->>'role_id' IS NOT NULL THEN
        -- Add all users with this role
        INSERT INTO approval_pending (request_id, step, user_id)
        SELECT NEW.id, 1, u.id
        FROM users u
        WHERE u.company_id = NEW.company_id
          AND u.role = (SELECT role FROM roles WHERE id = (v_approver->>'role_id')::INTEGER)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;

    UPDATE approval_requests SET status = 'in_progress' WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER initialize_approval_pending_trigger
  AFTER INSERT ON approval_requests
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION initialize_approval_pending();

-- 13. Insert default workflow templates
INSERT INTO approval_workflow_templates (company_id, name, description, steps, is_active, created_by_id)
SELECT
  c.id,
  'Standardowe zatwierdzenie kosztorysu',
  'Dwuetapowe zatwierdzenie: kierownik projektu, następnie dyrektor',
  '[
    {"step": 1, "name": "Kierownik projektu", "approvers": [], "require_all": false},
    {"step": 2, "name": "Dyrektor", "approvers": [], "require_all": false}
  ]'::jsonb,
  TRUE,
  (SELECT id FROM users WHERE company_id = c.id AND role = 'company_admin' LIMIT 1)
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM approval_workflow_templates WHERE company_id = c.id
)
AND EXISTS (
  SELECT 1 FROM users WHERE company_id = c.id AND role = 'company_admin'
);
