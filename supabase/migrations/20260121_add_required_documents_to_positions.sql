-- Migration: Add required_document_ids column to positions table
-- Date: 2026-01-21
-- Description: Adds optional field to store required documents/certifications for each position

-- Add the new column
ALTER TABLE positions
ADD COLUMN IF NOT EXISTS required_document_ids TEXT[];

-- Add comment for documentation
COMMENT ON COLUMN positions.required_document_ids IS 'Optional: Array of required document/certification IDs for this position. Used in hourly wage range calculations.';
