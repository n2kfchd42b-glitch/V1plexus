-- ════════════════════════════════════════
-- Fix: Allow users to insert/update their own project_members row when accepting invitations
-- ════════════════════════════════════════

-- Add INSERT policy for users accepting invitations
DROP POLICY IF EXISTS "Users can insert their own project membership" ON project_members;
CREATE POLICY "Users can insert their own project membership" ON project_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Add UPDATE policy so users can update their own membership
DROP POLICY IF EXISTS "Users can update their own project membership" ON project_members;
CREATE POLICY "Users can update their own project membership" ON project_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

