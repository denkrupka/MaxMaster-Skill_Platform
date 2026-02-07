-- Migration: Night hours period fields
-- Replace single night_hours with start/end hour for night period
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS night_start_hour NUMERIC(4,2),
  ADD COLUMN IF NOT EXISTS night_end_hour NUMERIC(4,2);
