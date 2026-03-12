-- =====================================================
-- Migration: Uzgodnienia Enhancements
-- Date: 2026-03-12
-- Description: Group approval, template types, canvas annotations
-- =====================================================

ALTER TABLE uzgodnienia ADD COLUMN IF NOT EXISTS approval_mode TEXT DEFAULT 'single';
ALTER TABLE uzgodnienia ADD COLUMN IF NOT EXISTS template_type TEXT;
ALTER TABLE uzgodnienia ADD COLUMN IF NOT EXISTS plan_annotations JSONB DEFAULT '[]';
ALTER TABLE uzgodnienia ADD COLUMN IF NOT EXISTS escalation_notified_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS uzgodnienia_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uzgodnienie_id UUID NOT NULL REFERENCES uzgodnienia(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  decision TEXT DEFAULT NULL,
  decided_at TIMESTAMPTZ,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(uzgodnienie_id, user_id)
);

ALTER TABLE uzgodnienia_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uzgodnienia_participants_access" ON uzgodnienia_participants
  FOR ALL USING (uzgodnienie_id IN (
    SELECT id FROM uzgodnienia 
    WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

CREATE INDEX IF NOT EXISTS idx_uzg_participants_uzg ON uzgodnienia_participants(uzgodnienie_id);
CREATE INDEX IF NOT EXISTS idx_uzg_participants_user ON uzgodnienia_participants(user_id);

CREATE OR REPLACE VIEW uzgodnienia_stats AS
SELECT
  u.id AS user_id,
  u.first_name || ' ' || u.last_name AS user_name,
  COUNT(DISTINCT uz.id) AS total_assigned,
  COUNT(DISTINCT CASE WHEN uz.status = 'approved' THEN uz.id END) AS total_approved,
  COUNT(DISTINCT CASE WHEN uz.status = 'rejected' THEN uz.id END) AS total_rejected,
  COUNT(DISTINCT CASE WHEN uz.status IN ('new', 'in_review', 'escalated') 
    AND uz.sla_deadline < NOW() THEN uz.id END) AS total_overdue,
  ROUND(AVG(
    CASE WHEN uz.resolved_at IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (uz.resolved_at - uz.created_at)) / 3600 
    END
  )::NUMERIC, 1) AS avg_response_hours
FROM users u
JOIN uzgodnienia uz ON uz.assigned_to_id = u.id
WHERE uz.deleted_at IS NULL
GROUP BY u.id, u.first_name, u.last_name;
