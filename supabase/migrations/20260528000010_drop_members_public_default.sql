-- ════════════════════════════════════════
-- PLEXUS — Drop institutions.members_public_default
--
-- The flag was added in PR G as a per-institution privacy default but never
-- actually changed query behavior — the public page query always filtered
-- on per-user `public_affiliation_visible`. After SED-3 made privacy opt-in
-- across the board, the only meaningful privacy lever is the per-user
-- toggle. The field is now redundant; remove the column to prevent future
-- code from re-introducing the no-op coupling.
--
-- The branding-snapshot trigger does NOT capture members_public_default, so
-- no thesis snapshots need to be migrated.
-- ════════════════════════════════════════

SET search_path = public;

ALTER TABLE institutions DROP COLUMN IF EXISTS members_public_default;
