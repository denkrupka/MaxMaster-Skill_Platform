-- Add CUSTOM to allowed form_type values for empty/custom forms

-- Drop the existing constraint
ALTER TABLE kosztorys_forms DROP CONSTRAINT IF EXISTS kosztorys_forms_form_type_check;

-- Add new constraint with CUSTOM included
ALTER TABLE kosztorys_forms ADD CONSTRAINT kosztorys_forms_form_type_check
  CHECK (form_type IN ('PREM-IE', 'PREM-IT', 'MIESZK-IE', 'MIESZK-IT', 'CUSTOM'));
