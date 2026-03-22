-- Add methodology and research objectives to projects
-- Migration: 20260322700000_project_methodology

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS methodology         TEXT,
  ADD COLUMN IF NOT EXISTS research_objectives TEXT;
