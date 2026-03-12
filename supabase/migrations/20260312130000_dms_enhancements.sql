-- =============================================================
-- DMS Enhancements: Notifications, Signature Metadata, Folders
-- =============================================================

-- Add missing columns to document_instances if not exist
ALTER TABLE document_instances 
  ADD COLUMN IF NOT EXISTS folder_name text DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS signature_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS signature_metadata jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS qr_token text UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex');

-- Document notifications log
CREATE TABLE IF NOT EXISTS document_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES document_instances(id) ON DELETE CASCADE,
  type text NOT NULL, -- 'sent', 'signed', 'rejected', 'reminder'
  recipient_email text,
  recipient_name text,
  sent_at timestamptz DEFAULT now(),
  success boolean DEFAULT true,
  error_msg text
);

-- RLS for notifications
ALTER TABLE document_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doc_notifications_access" ON document_notifications
  FOR ALL USING (
    document_id IN (
      SELECT id FROM document_instances
      WHERE company_id = (SELECT company_id FROM users WHERE id = auth.uid())
    )
  );

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_doc_notifications_doc ON document_notifications(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_instances_folder ON document_instances(folder_name);
CREATE INDEX IF NOT EXISTS idx_doc_instances_qr ON document_instances(qr_token);

-- Update existing document_instances to have qr_token if null
UPDATE document_instances 
SET qr_token = encode(gen_random_bytes(16), 'hex') 
WHERE qr_token IS NULL;

-- View: documents with version count (useful for dashboard)
CREATE OR REPLACE VIEW document_instances_summary AS
SELECT 
  di.*,
  COUNT(dv.id) as version_count,
  MAX(dv.created_at) as last_version_at
FROM document_instances di
LEFT JOIN document_versions dv ON dv.document_id = di.id
GROUP BY di.id;

-- Grant access to view
GRANT SELECT ON document_instances_summary TO authenticated;
