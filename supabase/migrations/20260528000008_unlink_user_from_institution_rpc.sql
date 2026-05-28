-- ════════════════════════════════════════
-- PLEXUS — Atomic self-service unlink
--
-- Mirrors link_user_to_institution (PR D): bundles the multi-write transition
-- so a partial failure can't leave the profile pointing at no institution
-- while the workspace membership still says 'active'.
--
-- Steps:
--   1. Locate the institutional workspace
--   2. Mark workspace membership status='left'
--   3. Withdraw any active enrollments
--   4. Null out profiles.institution_id
--
-- Returns the prior institution_id so the caller can audit (and decide
-- whether to write 'institution.link.declined' or a new unlink action).
-- ════════════════════════════════════════

SET search_path = public;

CREATE OR REPLACE FUNCTION unlink_user_from_institution(
  p_user_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_institution_id UUID;
  v_workspace_id   UUID;
BEGIN
  SELECT institution_id INTO v_institution_id
  FROM profiles WHERE id = p_user_id;

  IF v_institution_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_workspace_id
  FROM workspaces
  WHERE institution_id = v_institution_id AND type = 'institutional'
  LIMIT 1;

  -- 1. Soft-leave the workspace membership.
  IF v_workspace_id IS NOT NULL THEN
    UPDATE workspace_memberships
      SET status = 'left'
      WHERE workspace_id = v_workspace_id
        AND user_id      = p_user_id
        AND status       <> 'left';
  END IF;

  -- 2. Withdraw any active enrollments. The unique index ensures only one
  --    active row per (user, programme); we close them all so future links
  --    don't trip the UQ on a re-link.
  UPDATE institution_enrollments
    SET status   = 'withdrawn',
        end_date = COALESCE(end_date, CURRENT_DATE)
    WHERE user_id        = p_user_id
      AND institution_id = v_institution_id
      AND status         = 'active';

  -- 3. Drop the institution link.
  UPDATE profiles
    SET institution_id = NULL
    WHERE id = p_user_id;

  RETURN v_institution_id;
END;
$$;

REVOKE ALL ON FUNCTION unlink_user_from_institution(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION unlink_user_from_institution(UUID) TO service_role;

-- Audit action for the new self-service path.
INSERT INTO public.audit_action_registry (action) VALUES
  ('institution.link.unlinked')
ON CONFLICT (action) DO NOTHING;
