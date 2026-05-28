-- ════════════════════════════════════════
-- PLEXUS — Privacy-by-default for public_affiliation_visible
--
-- PR G shipped public_affiliation_visible NOT NULL DEFAULT TRUE on profiles,
-- which retroactively opted every existing researcher into the public
-- /institutions/<slug> member list with no notification. This migration
-- corrects the privacy posture:
--   1. Backfill all existing rows to FALSE.
--   2. Flip the column default to FALSE so future signups are also opt-in.
--
-- After this lands, the AffiliationPanel toggle is the only way to appear
-- on the public page. The previous smoke-test members will be hidden until
-- they re-enable the toggle.
-- ════════════════════════════════════════

SET search_path = public;

-- 1. Backfill: every existing profile becomes private.
UPDATE profiles SET public_affiliation_visible = FALSE
  WHERE public_affiliation_visible = TRUE;

-- 2. Flip the column default for future inserts.
ALTER TABLE profiles
  ALTER COLUMN public_affiliation_visible SET DEFAULT FALSE;
