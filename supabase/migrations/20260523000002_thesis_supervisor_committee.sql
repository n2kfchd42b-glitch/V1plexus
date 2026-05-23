-- Add supervisor to thesis_metadata
ALTER TABLE thesis_metadata
  ADD COLUMN IF NOT EXISTS supervisor_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Committee table
CREATE TABLE IF NOT EXISTS thesis_committees (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  external_name   text,
  external_email  text,
  external_institution text,
  role            text NOT NULL CHECK (role IN ('chair','co_chair','member','external_examiner','advisor')),
  status          text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','confirmed','declined','removed')),
  invited_at      timestamptz NOT NULL DEFAULT now(),
  confirmed_at    timestamptz,
  invited_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE thesis_committees ENABLE ROW LEVEL SECURITY;

-- Project owner can do everything
CREATE POLICY "owner_all_committee" ON thesis_committees
  FOR ALL USING (
    project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );

-- Members can read
CREATE POLICY "member_read_committee" ON thesis_committees
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- Index
CREATE INDEX IF NOT EXISTS thesis_committees_project_id_idx ON thesis_committees(project_id);
