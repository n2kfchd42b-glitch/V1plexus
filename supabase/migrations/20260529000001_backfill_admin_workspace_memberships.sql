-- ════════════════════════════════════════
-- PLEXUS — Backfill workspace_memberships for institution admins
--
-- Some institution admins were promoted outside the invite flow (early
-- dev seeding, manual SQL, legacy paths) and ended up with profile-level
-- admin status (profiles.role='admin' + profiles.institution_id) but no
-- corresponding workspace_memberships row. That left the older endpoints
-- that gate on workspace_memberships (e.g. /api/department/overview before
-- PR 1, and others to migrate in PR 4) rejecting them with "No active
-- workspace".
--
-- This migration creates the missing membership row(s). It is idempotent
-- (ON CONFLICT DO NOTHING) so it is safe to re-run.
--
-- New admins continue to get their membership via InvitationAccept on
-- invite acceptance — that path is unchanged.
-- ════════════════════════════════════════

SET search_path = public;

WITH backfilled AS (
  INSERT INTO workspace_memberships (workspace_id, user_id, role, status, joined_at)
  SELECT DISTINCT
    w.id                          AS workspace_id,
    p.id                          AS user_id,
    'admin'                       AS role,
    'active'                      AS status,
    COALESCE(p.created_at, NOW()) AS joined_at
  FROM profiles p
  JOIN workspaces w
    ON w.institution_id = p.institution_id
   AND w.type = 'institutional'
  WHERE p.role = 'admin'
    AND p.institution_id IS NOT NULL
  ON CONFLICT (workspace_id, user_id) DO NOTHING
  RETURNING workspace_id, user_id
)
SELECT
  COUNT(*) AS rows_backfilled,
  'backfill_admin_workspace_memberships' AS migration_name
FROM backfilled;
