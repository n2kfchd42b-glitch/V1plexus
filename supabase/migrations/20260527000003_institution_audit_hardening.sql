-- ════════════════════════════════════════
-- PLEXUS — PR D hardening (audit follow-ups)
-- 1. Restrict the user UPDATE on institution_link_requests to cancel-only:
--    tighten the WITH CHECK to status='cancelled' AND add a BEFORE UPDATE
--    trigger that blocks mutation of user_id, institution_id, message, etc.
--    when the caller isn't service_role.
-- 2. Add an expression index on lower(institution_inquiries.institution_name)
--    so the per-institution inquiry ilike runs on every overview / inquiries
--    page load no longer scans the whole table.
-- ════════════════════════════════════════

-- ── 1. Lock down user UPDATE on institution_link_requests ───────────────────

DROP POLICY IF EXISTS "Users cancel own pending link requests" ON institution_link_requests;
CREATE POLICY "Users cancel own pending link requests" ON institution_link_requests
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (user_id = auth.uid() AND status = 'cancelled');

-- Belt-and-braces trigger: even if the policy ever drifts, non-service-role
-- callers can't change anything other than `status`. (Service role bypasses
-- RLS entirely; the trigger short-circuits for it so the API approval path
-- still works.)
CREATE OR REPLACE FUNCTION institution_link_requests_user_mutation_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id        IS DISTINCT FROM OLD.user_id        THEN RAISE EXCEPTION 'user_id is immutable'; END IF;
  IF NEW.institution_id IS DISTINCT FROM OLD.institution_id THEN RAISE EXCEPTION 'institution_id is immutable'; END IF;
  IF NEW.message        IS DISTINCT FROM OLD.message        THEN RAISE EXCEPTION 'message is immutable after submit'; END IF;
  IF NEW.auto_approved  IS DISTINCT FROM OLD.auto_approved  THEN RAISE EXCEPTION 'auto_approved is immutable'; END IF;
  IF NEW.decided_by     IS DISTINCT FROM OLD.decided_by     THEN RAISE EXCEPTION 'decided_by is service-role only'; END IF;
  IF NEW.decided_at     IS DISTINCT FROM OLD.decided_at     THEN RAISE EXCEPTION 'decided_at is service-role only'; END IF;
  IF NEW.decline_reason IS DISTINCT FROM OLD.decline_reason THEN RAISE EXCEPTION 'decline_reason is service-role only'; END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS institution_link_requests_user_mutation_guard ON institution_link_requests;
CREATE TRIGGER institution_link_requests_user_mutation_guard
  BEFORE UPDATE ON institution_link_requests
  FOR EACH ROW EXECUTE FUNCTION institution_link_requests_user_mutation_guard();

-- ── 2. Index lower(institution_name) on institution_inquiries ───────────────
-- /api/institution/overview and /api/institution/inquiries both ilike on
-- institution_name on every page load. ilike uses lower() under the hood
-- (with the default ICU collation); a functional index makes the lookup
-- index-only instead of a sequential scan.

CREATE INDEX IF NOT EXISTS idx_institution_inquiries_name_lower
  ON institution_inquiries (lower(institution_name));
