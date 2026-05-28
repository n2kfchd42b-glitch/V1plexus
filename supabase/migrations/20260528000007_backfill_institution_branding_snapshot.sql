-- ════════════════════════════════════════
-- PLEXUS — Backfill institution_branding_snapshot for in-flight theses
--
-- The PR G trigger (snapshot_thesis_institution_branding) fires only on the
-- transition INTO lifecycle_state='submitted'. Theses already in submitted/
-- approved/archived before PR G shipped therefore have a NULL snapshot and
-- no future code path will fill it — the trigger checks OLD.lifecycle_state
-- and short-circuits if it was already 'submitted'.
--
-- That leaves /verify/<root_hash> and /api/journal/report/<hash> showing
-- "no institution branding" for every pre-PR-G certified output even though
-- the project's owner is still affiliated.
--
-- This migration backfills the snapshot from the project owner's current
-- institution (same fallback path the trigger uses). It is one-shot and
-- safe to re-run (only touches rows where the snapshot is NULL).
-- ════════════════════════════════════════

SET search_path = public;

WITH source AS (
  SELECT
    tm.project_id,
    COALESCE(tm.institution_id, p.institution_id) AS institution_id
  FROM thesis_metadata tm
  JOIN projects pr ON pr.id = tm.project_id
  JOIN profiles p  ON p.id  = pr.owner_id
  WHERE tm.institution_branding_snapshot IS NULL
    AND tm.lifecycle_state IN ('submitted', 'approved', 'archived')
    AND COALESCE(tm.institution_id, p.institution_id) IS NOT NULL
)
UPDATE thesis_metadata tm
SET
  institution_id_at_submission = src.institution_id,
  institution_branding_snapshot = jsonb_build_object(
    'id',                i.id,
    'slug',              i.slug,
    'name',              i.name,
    'short_name',        i.short_name,
    'logo_url',          i.logo_url,
    'brand_color',       i.brand_color,
    'motto',             i.motto,
    'verification_tier', i.verification_tier,
    'snapshotted_at',    NOW()
  )
FROM source src
JOIN institutions i ON i.id = src.institution_id
WHERE tm.project_id = src.project_id
  AND tm.institution_branding_snapshot IS NULL;
