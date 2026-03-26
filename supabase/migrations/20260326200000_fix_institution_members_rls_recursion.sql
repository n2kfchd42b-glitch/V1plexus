-- ════════════════════════════════════════════════════════════════
-- Fix recursive RLS policies on institution_members.
--
-- Root cause (same pattern as workspace_memberships fix):
--   "Institution members can view membership" queries institution_members
--   within institution_members' own SELECT policy → 42P17 infinite
--   recursion → PostgREST 500 on any institutions INSERT...SELECT.
--
-- Additionally, "Institution admins can manage members" (ALL) also
-- queries institution_members recursively.
--
-- Fix 1: institution_members SELECT — user sees only their own rows
--   (no subquery on institution_members or institutions needed).
--
-- Fix 2: institution_members ALL (admin) — check via profiles.institution_id
--   instead of querying institution_members itself.
--
-- Fix 3: Drop the redundant "Institution members can view their institution"
--   SELECT policy on institutions — it's covered by the existing
--   "Institutions are publicly visible" (USING true) policy AND it was
--   triggering the institution_members recursion chain on every
--   institutions INSERT...SELECT.
-- ════════════════════════════════════════════════════════════════

-- ── 1. Fix institution_members SELECT ────────────────────────────
DROP POLICY IF EXISTS "Institution members can view membership" ON institution_members;
CREATE POLICY "Institution members can view membership" ON institution_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ── 2. Fix institution_members ALL (admin) ───────────────────────
DROP POLICY IF EXISTS "Institution admins can manage members" ON institution_members;
CREATE POLICY "Institution admins can manage members" ON institution_members
  FOR ALL TO authenticated
  USING (
    institution_id IN (
      SELECT institution_id FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'owner')
    )
  );

-- ── 3. Drop the recursion-inducing institutions SELECT policy ─────
-- "Institutions are publicly visible" (USING true) already grants
-- read access to all institutions, so this policy is redundant.
DROP POLICY IF EXISTS "Institution members can view their institution" ON institutions;
