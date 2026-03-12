-- Add unit text column to offer_items for storing unit codes (szt., m, m2, etc.)
-- This is needed by the PdfTakeoffWizard and PlansWorkspace BOQ functionality.
ALTER TABLE offer_items ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'szt.';

-- Index for common queries grouping by unit  
CREATE INDEX IF NOT EXISTS idx_offer_items_unit ON offer_items(unit);
