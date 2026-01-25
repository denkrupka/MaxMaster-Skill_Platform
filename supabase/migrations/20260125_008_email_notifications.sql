-- =============================================
-- Email Notifications Schema
-- =============================================

-- Email logs table
CREATE TABLE IF NOT EXISTS email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient TEXT NOT NULL,
    template VARCHAR(100) NOT NULL,
    subject VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, failed, bounced
    provider_id VARCHAR(255), -- External email service ID
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification preferences for users
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,

    -- Email notifications
    email_skill_confirmed BOOLEAN DEFAULT TRUE,
    email_payment_receipt BOOLEAN DEFAULT TRUE,
    email_payment_failed BOOLEAN DEFAULT TRUE,
    email_trial_reminder BOOLEAN DEFAULT TRUE,
    email_module_updates BOOLEAN DEFAULT TRUE,
    email_marketing BOOLEAN DEFAULT FALSE,

    -- In-app notifications
    inapp_skill_updates BOOLEAN DEFAULT TRUE,
    inapp_task_reminders BOOLEAN DEFAULT TRUE,
    inapp_system_updates BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient);
CREATE INDEX IF NOT EXISTS idx_email_logs_template ON email_logs(template);
CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id);

-- RLS for email_logs
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email logs" ON email_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role IN ('superadmin', 'admin', 'company_admin')
        )
    );

-- RLS for notification_preferences
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification preferences" ON notification_preferences
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notification preferences" ON notification_preferences
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert own notification preferences" ON notification_preferences
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Trigger to update updated_at
CREATE TRIGGER notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_crm_updated_at();

-- Grant permissions
GRANT SELECT ON email_logs TO authenticated;
GRANT ALL ON notification_preferences TO authenticated;

-- Create default notification preferences for existing users
INSERT INTO notification_preferences (user_id)
SELECT id FROM users
WHERE id NOT IN (SELECT user_id FROM notification_preferences WHERE user_id IS NOT NULL)
ON CONFLICT DO NOTHING;
