-- Add value column to kosztorys_form_answers
ALTER TABLE kosztorys_form_answers
ADD COLUMN IF NOT EXISTS value DECIMAL(10,2) DEFAULT 1;

-- Update existing records: set value = 1 where is_marked = true
UPDATE kosztorys_form_answers SET value = 1 WHERE is_marked = true AND value IS NULL;
UPDATE kosztorys_form_answers SET value = 0 WHERE is_marked = false AND value IS NULL;

-- Add priority column to mapping_rules if not exists
ALTER TABLE kosztorys_mapping_rules
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;

-- Add missing columns to kosztorys_form_answers
ALTER TABLE kosztorys_form_answers
ADD COLUMN IF NOT EXISTS room_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS work_code VARCHAR(100);

-- Copy work_type_code to work_code if work_code is null
UPDATE kosztorys_form_answers
SET work_code = work_type_code
WHERE work_code IS NULL AND work_type_code IS NOT NULL;
