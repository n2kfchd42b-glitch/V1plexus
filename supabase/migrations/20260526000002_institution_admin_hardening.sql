-- ════════════════════════════════════════
-- PLEXUS — PR A hardening
-- 1. Block direct anon INSERT on institution_inquiries — only the rate-limited
--    server route (using service-role) should write.
-- 2. Let invited users SELECT the workspace they were invited to, so the
--    /invite/<token> page can show the institution / workspace name before
--    the user becomes a member (RLS on workspaces was hiding it until then).
-- ════════════════════════════════════════

-- ── 1. Lock down institution_inquiries writes ────────────────────────────────

DROP POLICY IF EXISTS "Anyone can submit an inquiry" ON institution_inquiries;

-- No INSERT policy remains. With RLS enabled and no permissive INSERT policy,
-- anon and authenticated roles cannot write directly. The /api/institution-inquiry
-- route uses the service-role key and bypasses RLS.

-- ── 2. Let pending invitees see the target workspace ────────────────────────
-- Without this, the workspace_invitations → workspaces join on /invite/<token>
-- returns NULL because the invitee isn't a member yet, so the accept page shows
-- "You've been invited to workspace" instead of the actual name.

DROP POLICY IF EXISTS "Invited users see the target workspace" ON workspaces;
CREATE POLICY "Invited users see the target workspace" ON workspaces
  FOR SELECT TO authenticated USING (
    id IN (
      SELECT workspace_id FROM workspace_invitations
      WHERE LOWER(email) = LOWER(COALESCE(
              (SELECT email FROM profiles WHERE id = auth.uid()),
              ''
            ))
        AND status = 'pending'
    )
  );
