-- ══════════════════════════════════════════════════════════════════
-- Fix institution setup flow RLS gaps
--
-- Problems:
--  1. Workspace INSERT policy blocked institutional workspaces
--     (owner_id is null for institutional workspaces, so
--      "owner_id = auth.uid()" was always false → 500/403)
--  2. No INSERT policy on departments → department creation silently failed
-- ══════════════════════════════════════════════════════════════════

-- ── 1. Fix workspace INSERT policy ───────────────────────────────
-- Allow: personal workspaces (own owner_id), institutional workspaces
-- (any authenticated user), and admin-created workspaces.
DROP POLICY IF EXISTS "Users can insert their own workspace" ON workspaces;
CREATE POLICY "Users can insert their own workspace" ON workspaces
  FOR INSERT TO authenticated WITH CHECK (
    owner_id = auth.uid()
    OR (type = 'institutional' AND auth.uid() IS NOT NULL)
    OR auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
  );

-- ── 2. Add departments INSERT + UPDATE policies ───────────────────
DROP POLICY IF EXISTS "Authenticated users can create departments" ON departments;
CREATE POLICY "Authenticated users can create departments"
  ON departments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update departments" ON departments;
CREATE POLICY "Authenticated users can update departments"
  ON departments FOR UPDATE TO authenticated
  USING (
    institution_id IN (
      SELECT institution_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ── 3. Add institutions UPDATE policy ────────────────────────────
DROP POLICY IF EXISTS "Institution admins can update their institution" ON institutions;
CREATE POLICY "Institution admins can update their institution"
  ON institutions FOR UPDATE TO authenticated
  USING (
    id IN (
      SELECT institution_id FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
