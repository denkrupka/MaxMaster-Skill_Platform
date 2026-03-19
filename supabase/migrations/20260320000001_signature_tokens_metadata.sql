ALTER TABLE signature_tokens ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';
ALTER TABLE signature_requests ADD COLUMN IF NOT EXISTS signer_phone text;
ALTER TABLE signature_requests ADD COLUMN IF NOT EXISTS signer_name text;
