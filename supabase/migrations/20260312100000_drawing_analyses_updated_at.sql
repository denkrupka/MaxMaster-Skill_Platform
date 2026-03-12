-- Migration: Add updated_at column to drawing_analyses
ALTER TABLE drawing_analyses ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_da_updated_at ON drawing_analyses;
CREATE TRIGGER trg_da_updated_at BEFORE UPDATE ON drawing_analyses
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
