-- ════════════════════════════════════════
-- PLEXUS — Institution branding + verification tier (Phase 3, PR G)
--
-- Closes the public face of an institution end-to-end. New surfaces:
--   * /institutions/<slug>            — public branded page (logo, motto, bio,
--                                         tier badge, members, departments,
--                                         certified outputs)
--   * /institution/branding           — admin editor for the above
--   * /admin/institutions             — platform admin can elevate
--                                         verification_tier (audited)
--   * /verify/<root_hash>             — wordmark stamp when the certificate
--                                         belongs to a thesis that snapshotted
--                                         institution branding at submission
--
-- Schema changes:
--   * institutions: slug (unique), brand_color, motto, public_bio,
--                   members_public_default
--   * profiles:     public_affiliation_visible (opt-out per user)
--   * thesis_metadata: institution_id_at_submission,
--                     institution_branding_snapshot (frozen at the
--                     'submitted' transition, mirrors the policy_snapshot
--                     pattern from 20260524000005)
--   * Storage:      institution-logos bucket + policies (anyone reads;
--                   only the institution's admins write its prefix)
--   * Audit:        institution.branding.updated,
--                   institution.verification_tier.changed
-- ════════════════════════════════════════

SET search_path = public;


-- ── 1. institutions: branding columns + slug ─────────────────────────────────

ALTER TABLE institutions
  ADD COLUMN IF NOT EXISTS slug                   TEXT,
  ADD COLUMN IF NOT EXISTS brand_color            TEXT,
  ADD COLUMN IF NOT EXISTS motto                  TEXT,
  ADD COLUMN IF NOT EXISTS public_bio             TEXT,
  ADD COLUMN IF NOT EXISTS members_public_default BOOLEAN NOT NULL DEFAULT TRUE;

-- Brand colour must be a #rrggbb hex when set.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'institutions'::regclass
      AND conname = 'institutions_brand_color_format'
  ) THEN
    ALTER TABLE institutions
      ADD CONSTRAINT institutions_brand_color_format
      CHECK (brand_color IS NULL OR brand_color ~ '^#[0-9a-fA-F]{6}$');
  END IF;
END $$;

-- Slug shape: lowercase, alphanumerics + dashes, 2–60 chars, no leading/trailing dash.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'institutions'::regclass
      AND conname = 'institutions_slug_format'
  ) THEN
    ALTER TABLE institutions
      ADD CONSTRAINT institutions_slug_format
      CHECK (slug IS NULL OR slug ~ '^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$');
  END IF;
END $$;

-- Backfill slugs deterministically from existing rows.
UPDATE institutions i
   SET slug = sub.candidate
  FROM (
    SELECT
      id,
      -- Take name → lowercase → strip diacritics by leaving only safe chars →
      -- collapse runs to '-' → trim → truncate to 60 → fall back to short id
      CASE
        WHEN trimmed_slug = '' THEN substring(id::text, 1, 8)
        ELSE substring(trimmed_slug, 1, 60)
      END AS candidate
    FROM (
      SELECT
        id,
        regexp_replace(
          regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'),
          '(^-+|-+$)', '', 'g'
        ) AS trimmed_slug
      FROM institutions
      WHERE slug IS NULL
    ) inner_slug
  ) sub
  WHERE i.id = sub.id;

-- Resolve dupes by suffixing a short id chunk.
WITH dupes AS (
  SELECT id, slug,
         row_number() OVER (PARTITION BY slug ORDER BY created_at) AS rn
  FROM institutions
  WHERE slug IS NOT NULL
)
UPDATE institutions i
   SET slug = d.slug || '-' || substring(i.id::text, 1, 6)
  FROM dupes d
 WHERE i.id = d.id AND d.rn > 1;

ALTER TABLE institutions
  ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_institutions_slug ON institutions (slug);

CREATE INDEX IF NOT EXISTS idx_institutions_active_listing
  ON institutions (active, name)
  WHERE active IS TRUE;


-- ── 2. profiles: public-affiliation opt-out ──────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS public_affiliation_visible BOOLEAN NOT NULL DEFAULT TRUE;


-- ── 3. thesis_metadata: branding snapshot ────────────────────────────────────
-- Mirrors policy_snapshot (20260524000005): frozen at submission so a verified
-- thesis keeps its institutional wordmark even if the author later leaves.

ALTER TABLE thesis_metadata
  ADD COLUMN IF NOT EXISTS institution_id_at_submission     UUID
    REFERENCES institutions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS institution_branding_snapshot    JSONB;

CREATE INDEX IF NOT EXISTS idx_thesis_metadata_institution_at_submission
  ON thesis_metadata (institution_id_at_submission)
  WHERE institution_id_at_submission IS NOT NULL;


-- ── 4. Snapshot trigger: freeze branding on transition to 'submitted' ────────
-- Only fires when lifecycle_state moves into 'submitted' AND no snapshot has
-- been written yet (idempotent — reruns are no-ops, archived theses keep
-- their original wordmark).

CREATE OR REPLACE FUNCTION snapshot_thesis_institution_branding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_institution_id UUID;
  v_branding             JSONB;
BEGIN
  -- Only act on the transition INTO 'submitted'.
  IF NEW.lifecycle_state <> 'submitted'
     OR OLD.lifecycle_state = 'submitted'
     OR NEW.institution_branding_snapshot IS NOT NULL
  THEN
    RETURN NEW;
  END IF;

  -- Prefer the thesis's own institution_id; fall back to the project owner's
  -- profile institution (covers theses created before institution_id was set).
  v_owner_institution_id := COALESCE(
    NEW.institution_id,
    (SELECT p.institution_id
       FROM projects pr
       JOIN profiles p ON p.id = pr.owner_id
      WHERE pr.id = NEW.project_id)
  );

  IF v_owner_institution_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT jsonb_build_object(
    'id',                id,
    'slug',              slug,
    'name',              name,
    'short_name',        short_name,
    'logo_url',          logo_url,
    'brand_color',       brand_color,
    'motto',             motto,
    'verification_tier', verification_tier,
    'snapshotted_at',    now()
  )
  INTO v_branding
  FROM institutions
  WHERE id = v_owner_institution_id;

  IF v_branding IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.institution_id_at_submission  := v_owner_institution_id;
  NEW.institution_branding_snapshot := v_branding;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS thesis_metadata_institution_branding_snapshot ON thesis_metadata;
CREATE TRIGGER thesis_metadata_institution_branding_snapshot
  BEFORE UPDATE OF lifecycle_state ON thesis_metadata
  FOR EACH ROW EXECUTE FUNCTION snapshot_thesis_institution_branding();


-- ── 5. Audit registry sync ───────────────────────────────────────────────────

INSERT INTO public.audit_action_registry (action) VALUES
  ('institution.branding.updated'),
  ('institution.verification_tier.changed')
ON CONFLICT (action) DO NOTHING;


-- ── 6. Storage bucket: institution-logos ─────────────────────────────────────
-- Public read (logos are shown on the public /institutions/<slug> page).
-- Writes restricted to the institution's admins via per-row check below.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'institution-logos',
  'institution-logos',
  TRUE,
  -- 4 MB cap — logos should be tiny SVGs / optimised PNGs
  4194304,
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/svg+xml',
    'image/webp'
  ]
) ON CONFLICT (id) DO NOTHING;

-- Public read for the bucket.
DROP POLICY IF EXISTS "Public can read institution logos" ON storage.objects;
CREATE POLICY "Public can read institution logos"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'institution-logos');

-- Only an admin of the institution may write under its prefix.
-- Path convention: <institution_id>/<filename>.
CREATE OR REPLACE FUNCTION is_admin_of_institution_by_path(p_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inst_id UUID;
BEGIN
  BEGIN
    v_inst_id := split_part(p_name, '/', 1)::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
  END;
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND institution_id = v_inst_id
  );
END;
$$;

REVOKE ALL ON FUNCTION is_admin_of_institution_by_path(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_admin_of_institution_by_path(TEXT) TO authenticated;

DROP POLICY IF EXISTS "Institution admins can upload their logo" ON storage.objects;
CREATE POLICY "Institution admins can upload their logo"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'institution-logos'
    AND is_admin_of_institution_by_path(name)
  );

DROP POLICY IF EXISTS "Institution admins can update their logo" ON storage.objects;
CREATE POLICY "Institution admins can update their logo"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'institution-logos'
    AND is_admin_of_institution_by_path(name)
  );

DROP POLICY IF EXISTS "Institution admins can delete their logo" ON storage.objects;
CREATE POLICY "Institution admins can delete their logo"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'institution-logos'
    AND is_admin_of_institution_by_path(name)
  );


-- ── 7. Notes ─────────────────────────────────────────────────────────────────
-- RLS on `institutions` already allows public SELECT for the linker UI
-- (PR B: 20260527000001) — the new branding columns ride along, no extra
-- policy needed.
-- RLS on `profiles` exposes only fields read by the existing public-page
-- query (see /api/institutions/[slug]/public); the new
-- `public_affiliation_visible` flag gates whether a row appears at all.
