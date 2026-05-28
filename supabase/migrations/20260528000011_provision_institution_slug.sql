-- ════════════════════════════════════════
-- PLEXUS — Fix provision_institution RPC for institutions.slug NOT NULL
--
-- PR G (20260528000002) made institutions.slug NOT NULL after backfilling
-- existing rows. The provisioning RPC introduced in 20260528000006 (and the
-- /api/admin/institutions route before it) was never updated to supply a
-- slug, so any attempt to provision a new institution fails with
-- 23502 "null value in column slug ... violates not-null constraint".
--
-- This migration:
--   1. DROPs the prior signature (different arg list → different function).
--   2. CREATEs the new signature that takes `p_institution_slug TEXT` and
--      writes it into institutions.slug. The caller is expected to have
--      checked uniqueness against both institutions.slug and workspaces.slug
--      before invoking.
-- ════════════════════════════════════════

SET search_path = public;

DROP FUNCTION IF EXISTS provision_institution(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, TEXT
);

CREATE OR REPLACE FUNCTION provision_institution(
  p_actor_id            UUID,
  p_institution_name    TEXT,
  p_institution_slug    TEXT,
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
  IF p_institution_slug IS NULL OR length(trim(p_institution_slug)) = 0 THEN
    RAISE EXCEPTION 'institution_slug is required' USING ERRCODE = '22023';
  END IF;
  IF p_admin_email IS NULL OR length(trim(p_admin_email)) = 0 THEN
    RAISE EXCEPTION 'admin_email is required' USING ERRCODE = '22023';
  END IF;
  IF p_invite_token IS NULL OR length(trim(p_invite_token)) = 0 THEN
    RAISE EXCEPTION 'invite_token is required' USING ERRCODE = '22023';
  END IF;

  -- 1. Institution
  INSERT INTO institutions (
    name, slug, short_name, type, country, email_domain, auto_link_domains,
    verification_tier, provisioned_at, provisioned_by
  ) VALUES (
    p_institution_name,
    p_institution_slug,
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
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION provision_institution(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, TEXT
) TO service_role;
