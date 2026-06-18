-- Fix: snapshot_thesis_policy_on_insert was not SECURITY DEFINER, so it ran
-- as the calling authenticated user. The RLS policy_write_admin on
-- institution_thesis_policy blocks INSERT for non-admin/coordinator roles,
-- causing thesis_metadata inserts to fail for regular students — which meant
-- thesis_chapters never got inserted either ("No chapters yet").
--
-- Setting SECURITY DEFINER makes the trigger execute as the function owner
-- (postgres), bypassing RLS for the lazy policy-creation step only.

SET search_path = public;

CREATE OR REPLACE FUNCTION snapshot_thesis_policy_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id          UUID;
  v_owner_institution UUID;
  v_policy            institution_thesis_policy%ROWTYPE;
BEGIN
  -- 1. Resolve project owner + their institution
  SELECT p.owner_id, pr.institution_id
    INTO v_owner_id, v_owner_institution
  FROM projects p
  JOIN profiles pr ON pr.id = p.owner_id
  WHERE p.id = NEW.project_id;

  IF NEW.institution_id IS NULL THEN
    NEW.institution_id := v_owner_institution;
  END IF;

  IF NEW.institution_id IS NULL THEN
    RETURN NEW;  -- student isn't in an institution
  END IF;

  -- 2. Ensure an institution default exists (lazy create with permissive
  --    settings). Programme overrides remain opt-in — never auto-created.
  INSERT INTO institution_thesis_policy (institution_id, programme_id)
  VALUES (NEW.institution_id, NULL)
  ON CONFLICT DO NOTHING;

  -- 3. Resolve the most-specific policy for the project owner.
  v_policy := resolve_thesis_policy_for_user(v_owner_id, NEW.institution_id);

  IF v_policy.id IS NOT NULL AND NEW.policy_snapshot IS NULL THEN
    NEW.policy_version_snapshot := v_policy.policy_version;
    NEW.policy_snapshot         := to_jsonb(v_policy)
                                    - 'created_at' - 'updated_at' - 'updated_by';
  END IF;

  RETURN NEW;
END;
$$;

-- Re-attach the trigger (idempotent).
DROP TRIGGER IF EXISTS thesis_metadata_snapshot_policy ON thesis_metadata;
CREATE TRIGGER thesis_metadata_snapshot_policy
  BEFORE INSERT ON thesis_metadata
  FOR EACH ROW EXECUTE FUNCTION snapshot_thesis_policy_on_insert();
