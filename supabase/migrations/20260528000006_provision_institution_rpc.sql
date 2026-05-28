-- ════════════════════════════════════════
-- PLEXUS — Atomic institution provisioning RPC
--
-- Wraps the 3 sequential writes that POST /api/admin/institutions
-- (institutions → workspaces → workspace_invitations) into a single
-- transaction. Previously, a workspace insert failure would orphan the
-- institution row; an invitation failure would orphan both. Mirror of the
-- link_user_to_institution / claim_roster_seat pattern.
--
-- The function does NOT send the invite email — Resend stays in the API
-- route — and it does NOT audit (audit writes are also issued from the
-- route via writeAuditEntry so prev_hash chaining stays correct).
-- ════════════════════════════════════════

SET search_path = public;

CREATE OR REPLACE FUNCTION provision_institution(
  p_actor_id            UUID,
  p_institution_name    TEXT,
  p_short_name          TEXT,
  p_type                TEXT,
  p_country             TEXT,
  p_email_domain        TEXT,
  p_auto_link_domains   TEXT[],
  p_workspace_slug      TEXT,
  p_admin_email         TEXT,
  p_invite_token        TEXT
) RETURNS TABLE (
  institution_id UUID,
  workspace_id   UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_institution_id UUID;
  v_workspace_id   UUID;
BEGIN
  IF p_institution_name IS NULL OR length(trim(p_institution_name)) = 0 THEN
    RAISE EXCEPTION 'institution_name is required' USING ERRCODE = '22023';
  END IF;
  IF p_admin_email IS NULL OR length(trim(p_admin_email)) = 0 THEN
    RAISE EXCEPTION 'admin_email is required' USING ERRCODE = '22023';
  END IF;
  IF p_invite_token IS NULL OR length(trim(p_invite_token)) = 0 THEN
    RAISE EXCEPTION 'invite_token is required' USING ERRCODE = '22023';
  END IF;

  -- 1. Institution
  INSERT INTO institutions (
    name, short_name, type, country, email_domain, auto_link_domains,
    verification_tier, provisioned_at, provisioned_by
  ) VALUES (
    p_institution_name,
    NULLIF(p_short_name, ''),
    NULLIF(p_type, ''),
    NULLIF(p_country, ''),
    NULLIF(p_email_domain, ''),
    COALESCE(p_auto_link_domains, '{}'::text[]),
    'SELF_ATTESTED',
    NOW(),
    p_actor_id
  )
  RETURNING id INTO v_institution_id;

  -- 2. Institutional workspace
  INSERT INTO workspaces (type, name, slug, institution_id)
  VALUES ('institutional', p_institution_name, p_workspace_slug, v_institution_id)
  RETURNING id INTO v_workspace_id;

  -- 3. First-admin invitation
  INSERT INTO workspace_invitations (
    workspace_id, email, role, token, invited_by, status
  ) VALUES (
    v_workspace_id, p_admin_email, 'admin', p_invite_token, p_actor_id, 'pending'
  );

  RETURN QUERY SELECT v_institution_id, v_workspace_id;
END;
$$;

REVOKE ALL ON FUNCTION provision_institution(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION provision_institution(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, TEXT
) TO service_role;
