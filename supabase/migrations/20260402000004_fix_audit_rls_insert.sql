-- Fix: Allow authenticated users to insert audit log entries for their own actions.
-- The service_role-only INSERT policy meant all browser-client audit writes were
-- silently rejected by RLS, leaving the audit trail empty for dataset uploads,
-- duplicate resolutions, and any other client-side operations.

CREATE POLICY "Authenticated users can insert their own audit logs"
  ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());
