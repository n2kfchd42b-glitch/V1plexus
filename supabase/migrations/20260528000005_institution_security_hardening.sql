-- ════════════════════════════════════════
-- PLEXUS — Institution feature security hardening
--
-- Three tightenings to PRs G/H:
--
-- 1. storage.objects UPDATE policy for institution-logos: USING + WITH CHECK.
--    The original policy (20260528000002) had USING only; an admin could
--    UPDATE one of their own logo rows and change `name` to another
--    institution's UUID prefix, effectively re-binding their file under
--    that institution's slug URL. WITH CHECK rejects the post-update row
--    unless the new path still belongs to the caller's institution.
--
-- 2. resolve_thesis_policy_for_user RPC: revoke from `authenticated`. The
--    function is only invoked from snapshot_thesis_policy_on_insert (which
--    runs as service_role inside the trigger). Granting authenticated lets
--    a logged-in user probe enrollments via the side channel of which row
--    the resolver returns. service_role still has access via its blanket
--    grant.
--
-- 3. profiles.institution_id index. /api/institution/{overview,members},
--    /api/institutions/[slug] and the public page all filter on
--    profiles.institution_id; without an index this is a seq scan on the
--    profiles table for every page load.
-- ════════════════════════════════════════

SET search_path = public;

-- ── 1. storage UPDATE policy gets WITH CHECK ─────────────────────────────────

DROP POLICY IF EXISTS "Institution admins can update their logo" ON storage.objects;
CREATE POLICY "Institution admins can update their logo"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'institution-logos'
    AND is_admin_of_institution_by_path(name)
  )
  WITH CHECK (
    bucket_id = 'institution-logos'
    AND is_admin_of_institution_by_path(name)
  );

-- ── 2. Lock resolve_thesis_policy_for_user to service_role only ──────────────

REVOKE EXECUTE ON FUNCTION resolve_thesis_policy_for_user(UUID, UUID) FROM authenticated;
-- service_role grant from 20260528000003 stays in place.

-- ── 3. Index on profiles.institution_id ──────────────────────────────────────
-- Partial index — most profiles are unaffiliated, so the index stays small
-- and only the linked rows are visited when filtering.

CREATE INDEX IF NOT EXISTS idx_profiles_institution_id
  ON profiles (institution_id)
  WHERE institution_id IS NOT NULL;

-- ── 4. claim_roster_seat: distinguish "already claimed" from FK/UQ errors ────
-- Previously the function RAISEd with ERRCODE 23505 (unique_violation) for
-- "matric already taken", which collided with genuine UQ violations from
-- the same function's inserts (e.g. user already has an active enrollment in
-- the programme). Use a project-specific SQLSTATE so the API can map the
-- correct UX error per case.

CREATE OR REPLACE FUNCTION claim_roster_seat(
  p_user_id              UUID,
  p_institution_id       UUID,
  p_matriculation_number TEXT,
  p_decided_by           UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_roster        institution_roster_entries%ROWTYPE;
  v_workspace_id  UUID;
  v_enrollment_id UUID;
BEGIN
  IF p_matriculation_number IS NULL OR length(trim(p_matriculation_number)) = 0 THEN
    RETURN NULL;
  END IF;

  -- Look up the roster entry, locking it so concurrent claims serialise.
  SELECT * INTO v_roster
  FROM institution_roster_entries
  WHERE institution_id = p_institution_id
    AND lower(matriculation_number) = lower(trim(p_matriculation_number))
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Project-custom SQLSTATE so the API can distinguish from real UQ errors.
  IF v_roster.status <> 'unclaimed' THEN
    RAISE EXCEPTION 'Matriculation number already claimed' USING ERRCODE = 'PX001';
  END IF;

  -- Locate the institutional workspace.
  SELECT id INTO v_workspace_id
  FROM workspaces
  WHERE institution_id = p_institution_id
    AND type = 'institutional'
  LIMIT 1;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Institutional workspace not provisioned' USING ERRCODE = 'PX002';
  END IF;

  UPDATE institution_roster_entries
    SET status = 'claimed', claimed_by = p_user_id, claimed_at = now()
    WHERE id = v_roster.id;

  UPDATE profiles
    SET institution_id = p_institution_id,
        department_id  = COALESCE(v_roster.department_id, department_id)
    WHERE id = p_user_id;

  INSERT INTO workspace_memberships (workspace_id, user_id, role, status, invited_by, department_id)
    VALUES (
      v_workspace_id,
      p_user_id,
      CASE
        WHEN v_roster.intended_role IN ('admin', 'supervisor', 'coordinator', 'viewer')
          THEN v_roster.intended_role
        ELSE 'researcher'
      END,
      'active',
      p_decided_by,
      v_roster.department_id
    )
    ON CONFLICT (workspace_id, user_id) DO UPDATE
      SET status        = 'active',
          invited_by    = EXCLUDED.invited_by,
          department_id = COALESCE(EXCLUDED.department_id, workspace_memberships.department_id);

  -- Skip the dead `ON CONFLICT DO NOTHING` clause from the original — there
  -- is no unique constraint on (user_id, institution_id, status='approved'),
  -- so the conflict never fired anyway. Use a status='pending' guard if a
  -- pending row already exists (idempotency for retries).
  IF NOT EXISTS (
    SELECT 1 FROM institution_link_requests
    WHERE user_id = p_user_id
      AND institution_id = p_institution_id
      AND status = 'approved'
  ) THEN
    INSERT INTO institution_link_requests (
      user_id, institution_id, status, message,
      auto_approved, decided_by, decided_at
    ) VALUES (
      p_user_id, p_institution_id, 'approved',
      'Verified via matriculation number',
      TRUE, p_decided_by, now()
    );
  END IF;

  INSERT INTO institution_enrollments (
    user_id, institution_id, programme_id, cohort_id, department_id,
    matriculation_number, roster_entry_id, status
  ) VALUES (
    p_user_id, p_institution_id, v_roster.programme_id, v_roster.cohort_id, v_roster.department_id,
    v_roster.matriculation_number, v_roster.id, 'active'
  )
  RETURNING id INTO v_enrollment_id;

  RETURN v_enrollment_id;
END;
$$;

REVOKE ALL ON FUNCTION claim_roster_seat(UUID, UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_roster_seat(UUID, UUID, TEXT, UUID) TO service_role;
