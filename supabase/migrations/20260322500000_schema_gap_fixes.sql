-- Schema gap fixes: add missing columns identified in deliverables audit
-- Migration: 20260322500000_schema_gap_fixes

-- 1. departments: add slug, settings (JSONB), deleted_at
ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Auto-generate slug from name for existing rows (lowercase, replace spaces with hyphens)
UPDATE departments
SET slug = regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')
WHERE slug IS NULL;

-- Index for department slug lookups
CREATE INDEX IF NOT EXISTS idx_departments_institution ON departments(institution_id);
CREATE INDEX IF NOT EXISTS idx_departments_slug ON departments(institution_id, slug);

-- 2. project_members: add invited_by column
ALTER TABLE project_members
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id);

-- 3. Ensure project_milestones sort_order has a default
ALTER TABLE project_milestones
  ALTER COLUMN sort_order SET DEFAULT 0;

-- 4. Add updated_at to document_templates if missing
ALTER TABLE document_templates
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

DROP TRIGGER IF EXISTS set_updated_at_document_templates ON document_templates;
CREATE TRIGGER set_updated_at_document_templates
  BEFORE UPDATE ON document_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. review_comments: add resolved_at if missing
ALTER TABLE review_comments
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
