-- ════════════════════════════════════════════════════════════════════════════
-- THESIS METADATA — INSTITUTION + POLICY SNAPSHOT AUTO-FILL
--
-- The existing ThesisCreationWizard inserts thesis_metadata without setting
-- institution_id or the policy snapshot columns. Rather than touching every
-- caller, this trigger does it on the database side:
--
--   1. If institution_id is NULL, derive it from the project owner's profile
--   2. If policy_snapshot is NULL and the institution has a policy row,
--      freeze that policy's current version onto the thesis
--   3. If the institution has no policy row yet, auto-create one with
--      permissive defaults so future updates have something to bump
--
-- Result: existing wizard code keeps working; every new thesis gets a
-- policy snapshot transparently.
-- ════════════════════════════════════════════════════════════════════════════

SET search_path = public;

CREATE OR REPLACE FUNCTION snapshot_thesis_policy_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_institution UUID;
  v_policy            institution_thesis_policy%ROWTYPE;
BEGIN
  -- 1. Resolve institution_id from the project owner's profile
  IF NEW.institution_id IS NULL THEN
    SELECT pr.institution_id INTO v_owner_institution
    FROM projects p
    JOIN profiles pr ON pr.id = p.owner_id
    WHERE p.id = NEW.project_id;

    NEW.institution_id := v_owner_institution;
  END IF;

  -- Nothing more to do if the student isn't in an institution
  IF NEW.institution_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 2. Auto-create a permissive default policy if none exists yet
  INSERT INTO institution_thesis_policy (institution_id)
  VALUES (NEW.institution_id)
  ON CONFLICT (institution_id) DO NOTHING;

  -- 3. Snapshot the current policy
  SELECT * INTO v_policy
  FROM institution_thesis_policy
  WHERE institution_id = NEW.institution_id;

  IF FOUND AND NEW.policy_snapshot IS NULL THEN
    NEW.policy_version_snapshot := v_policy.policy_version;
    NEW.policy_snapshot := to_jsonb(v_policy) - 'created_at' - 'updated_at' - 'updated_by';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS thesis_metadata_snapshot_policy ON thesis_metadata;
CREATE TRIGGER thesis_metadata_snapshot_policy
  BEFORE INSERT ON thesis_metadata
  FOR EACH ROW EXECUTE FUNCTION snapshot_thesis_policy_on_insert();
