-- Create sms_logs table for tracking SMS notifications
-- Simple version without RLS policies

CREATE TABLE IF NOT EXISTS sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  phone_number VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  template_code VARCHAR(100),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  sms_id VARCHAR(100),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_sms_logs_user_id ON sms_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_status ON sms_logs(status);
CREATE INDEX IF NOT EXISTS idx_sms_logs_created_at ON sms_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_logs_template_code ON sms_logs(template_code);

-- Add comments
COMMENT ON TABLE sms_logs IS 'Logs of all SMS notifications sent through SMSAPI.pl';
COMMENT ON COLUMN sms_logs.status IS 'Status: pending, sent, delivered, failed';
COMMENT ON COLUMN sms_logs.sms_id IS 'Message ID returned by SMSAPI.pl';
