-- ════════════════════════════════════════
-- PLEXUS — Atomic institution link RPC
-- Wraps the 4-step "approve a link request" transition in a single
-- transaction so a partial failure can't leave a profile pointing at an
-- institution without a matching workspace_memberships row. Replaces the
-- sequential writes that previously lived in src/lib/institutionLinking.ts.
-- ════════════════════════════════════════

CREATE OR REPLACE FUNCTION link_user_to_institution(
  p_user_id        UUID,
  p_institution_id UUID,
  p_decided_by     UUID,
  p_auto_approved  BOOLEAN,
  p_message        TEXT DEFAULT NULL,
  p_request_id     UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id UUID;
  v_request_id   UUID;
BEGIN
  -- 1. Find the institutional workspace.
  SELECT id INTO v_workspace_id
  FROM workspaces
  WHERE institution_id = p_institution_id
    AND type = 'institutional'
  LIMIT 1;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Institutional workspace not found for institution %', p_institution_id
      USING ERRCODE = 'P0002';
  END IF;

  -- 2. Set profile.institution_id.
  UPDATE profiles
    SET institution_id = p_institution_id
    WHERE id = p_user_id;

  -- 3. Upsert the workspace_memberships row.
  INSERT INTO workspace_memberships (workspace_id, user_id, role, status, invited_by)
    VALUES (v_workspace_id, p_user_id, 'researcher', 'active', p_decided_by)
    ON CONFLICT (workspace_id, user_id) DO UPDATE
      SET role       = 'researcher',
          status     = 'active',
          invited_by = EXCLUDED.invited_by;

  -- 4. Mark the link request approved (or create one for the auto-approval path).
  IF p_request_id IS NOT NULL THEN
    UPDATE institution_link_requests
      SET status        = 'approved',
          decided_by    = p_decided_by,
          decided_at    = NOW(),
          auto_approved = p_auto_approved
      WHERE id = p_request_id;
    v_request_id := p_request_id;
  ELSE
    INSERT INTO institution_link_requests (
      user_id, institution_id, status, message,
      auto_approved, decided_by, decided_at
    ) VALUES (
      p_user_id, p_institution_id, 'approved', p_message,
      p_auto_approved, p_decided_by, NOW()
    ) RETURNING id INTO v_request_id;
  END IF;

  RETURN v_request_id;
END;
$$;

-- Only the service-role key invokes this today (server-side approval paths).
-- Revoke from PUBLIC and grant explicitly so we don't widen access by accident.
REVOKE ALL ON FUNCTION link_user_to_institution(UUID, UUID, UUID, BOOLEAN, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION link_user_to_institution(UUID, UUID, UUID, BOOLEAN, TEXT, UUID) TO service_role;
