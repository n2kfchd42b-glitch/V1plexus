-- ════════════════════════════════════════
-- PLEXUS H1: Schema Additions
-- Add phase + department_id to projects,
-- fix status constraint, add missing columns
-- to institutions and departments
-- ════════════════════════════════════════


-- ════════════════════════════════════════
-- PROJECTS
-- ════════════════════════════════════════

-- Add research phase column
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS phase TEXT DEFAULT 'design'
    CHECK (phase IN ('design', 'data_collection', 'analysis', 'writing', 'submitted', 'published'));

-- Add department linkage
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL;

-- Fix status: drop old constraint, add canonical set (draft + on_hold included)
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects
  ADD CONSTRAINT projects_status_check
    CHECK (status IN ('draft', 'active', 'on_hold', 'completed', 'archived'));

-- Update default from 'active' → 'draft' for new projects
ALTER TABLE projects ALTER COLUMN status SET DEFAULT 'draft';

CREATE INDEX IF NOT EXISTS idx_projects_department ON projects(department_id)
  WHERE department_id IS NOT NULL;


-- ════════════════════════════════════════
-- INSTITUTIONS
-- ════════════════════════════════════════

ALTER TABLE institutions
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'university'
    CHECK (type IN ('university', 'hospital', 'research_institute', 'ngo', 'government', 'other'));

ALTER TABLE institutions
  ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE institutions
  ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE institutions
  ADD COLUMN IF NOT EXISTS logo_url TEXT;


-- ════════════════════════════════════════
-- DEPARTMENTS
-- ════════════════════════════════════════

ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS head_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Backfill updated_at for existing rows
UPDATE departments SET updated_at = created_at WHERE updated_at IS NULL;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
