-- Create sms_logs table for tracking SMS notifications
CREATE TABLE IF NOT EXISTS sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  phone_number VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  template_code VARCHAR(100),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  sms_id VARCHAR(100), -- ID from SMSAPI.pl response
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_sms_logs_user_id ON sms_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_status ON sms_logs(status);
CREATE INDEX IF NOT EXISTS idx_sms_logs_created_at ON sms_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_logs_template_code ON sms_logs(template_code);

-- Add RLS policies (if needed)
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

-- Allow HR and ADMIN to view all SMS logs
CREATE POLICY "HR and ADMIN can view all SMS logs"
  ON sms_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('ADMIN', 'HR')
    )
  );

-- Users can view their own SMS logs
CREATE POLICY "Users can view their own SMS logs"
  ON sms_logs FOR SELECT
  USING (user_id = auth.uid());

-- Only system can insert SMS logs (via service role)
CREATE POLICY "Service role can insert SMS logs"
  ON sms_logs FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE sms_logs IS 'Logs of all SMS notifications sent through SMSAPI.pl';
COMMENT ON COLUMN sms_logs.status IS 'Status: pending, sent, delivered, failed';
COMMENT ON COLUMN sms_logs.sms_id IS 'Message ID returned by SMSAPI.pl';
