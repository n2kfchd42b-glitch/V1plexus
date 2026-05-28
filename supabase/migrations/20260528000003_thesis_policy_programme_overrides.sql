-- ════════════════════════════════════════
-- PLEXUS — Programme-level thesis policy overrides (Phase 3, PR H)
--
-- Today institution_thesis_policy is keyed only on institution_id, so each
-- institution has exactly one policy that applies to every thesis. This
-- migration allows a per-programme override that wins when present, while
-- the institution-wide row remains the fallback default.
--
-- Schema:
--   * institution_thesis_policy gains
--       - id            UUID PK         (new — replaces the PK that was on institution_id alone)
--       - programme_id  UUID NULL FK    (NULL = institution default; non-NULL = programme override)
--   * Two partial unique indexes:
--       - one institution-default row per institution
--       - one override per (institution_id, programme_id) pair
--
-- Resolution:
--   * RPC resolve_thesis_policy_for_user(user_id, institution_id) returns the
--     full policy row that should apply to a *new* thesis for that user:
--     active-enrollment programme override → institution default → NULL.
--   * snapshot_thesis_policy_on_insert() trigger is rewritten to call the
--     RPC, so theses pick up the right policy at creation transparently.
-- ════════════════════════════════════════

SET search_path = public;


-- ── 1. Schema additions ──────────────────────────────────────────────────────

ALTER TABLE institution_thesis_policy
  ADD COLUMN IF NOT EXISTS id            UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS programme_id  UUID REFERENCES institution_programmes(id) ON DELETE CASCADE;

-- Backfill any pre-existing rows that were inserted before the default
-- expression fired (defensive — DEFAULT covers new inserts, this catches the
-- legacy rows whose CREATE TABLE shape predates this column).
UPDATE institution_thesis_policy SET id = gen_random_uuid() WHERE id IS NULL;

ALTER TABLE institution_thesis_policy
  ALTER COLUMN id SET NOT NULL;

-- Swap the primary key. Old PK was (institution_id) — that's no longer
-- valid since (institution_id, NULL) and (institution_id, programme_id) are
-- separate rows for the same institution.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'institution_thesis_policy'::regclass
      AND conname  = 'institution_thesis_policy_pkey'
  ) THEN
    ALTER TABLE institution_thesis_policy DROP CONSTRAINT institution_thesis_policy_pkey;
  END IF;
END $$;

ALTER TABLE institution_thesis_policy
  ADD CONSTRAINT institution_thesis_policy_pkey PRIMARY KEY (id);

-- One institution default per institution (programme_id IS NULL).
CREATE UNIQUE INDEX IF NOT EXISTS ux_institution_thesis_policy_default
  ON institution_thesis_policy (institution_id)
  WHERE programme_id IS NULL;

-- One override per (institution_id, programme_id) pair.
CREATE UNIQUE INDEX IF NOT EXISTS ux_institution_thesis_policy_programme
  ON institution_thesis_policy (institution_id, programme_id)
  WHERE programme_id IS NOT NULL;

-- Index supports the "list overrides for this institution" query path.
CREATE INDEX IF NOT EXISTS idx_institution_thesis_policy_lookup
  ON institution_thesis_policy (institution_id, programme_id);


-- ── 2. Policy resolution RPC ─────────────────────────────────────────────────
-- Returns the row that should govern a new thesis for the given user. The
-- resolution rule is: programme override (if the user has an active
-- enrollment in a programme that has an override) → institution default →
-- NULL. SECURITY DEFINER because the trigger calls it from a context where
-- the calling user's RLS would block reads of other tables.

CREATE OR REPLACE FUNCTION resolve_thesis_policy_for_user(
  p_user_id        UUID,
  p_institution_id UUID
)
RETURNS institution_thesis_policy
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_programme_id UUID;
  v_policy       institution_thesis_policy%ROWTYPE;
BEGIN
  IF p_institution_id IS NULL THEN
    RETURN v_policy;  -- empty row; caller sees NULL fields
  END IF;

  -- Pick the user's active enrollment programme at this institution.
  -- Most recent active row wins if a user happens to have multiple.
  SELECT programme_id INTO v_programme_id
  FROM institution_enrollments
  WHERE user_id        = p_user_id
    AND institution_id = p_institution_id
    AND status         = 'active'
  ORDER BY enrolled_at DESC NULLS LAST
  LIMIT 1;

  -- Try the programme override first.
  IF v_programme_id IS NOT NULL THEN
    SELECT * INTO v_policy
    FROM institution_thesis_policy
    WHERE institution_id = p_institution_id
      AND programme_id   = v_programme_id;
    IF FOUND THEN
      RETURN v_policy;
    END IF;
  END IF;

  -- Fall back to the institution default.
  SELECT * INTO v_policy
  FROM institution_thesis_policy
  WHERE institution_id = p_institution_id
    AND programme_id IS NULL;

  RETURN v_policy;  -- v_policy may be empty if no default exists yet
END;
$$;

REVOKE ALL ON FUNCTION resolve_thesis_policy_for_user(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_thesis_policy_for_user(UUID, UUID) TO authenticated, service_role;


-- ── 3. Rewrite the snapshot trigger to use the resolver ──────────────────────

CREATE OR REPLACE FUNCTION snapshot_thesis_policy_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id          UUID;
  v_owner_institution UUID;
  v_policy            institution_thesis_policy%ROWTYPE;
BEGIN
  -- 1. Resolve project owner + their institution
  SELECT p.owner_id, pr.institution_id
    INTO v_owner_id, v_owner_institution
  FROM projects p
  JOIN profiles pr ON pr.id = p.owner_id
  WHERE p.id = NEW.project_id;

  IF NEW.institution_id IS NULL THEN
    NEW.institution_id := v_owner_institution;
  END IF;

  IF NEW.institution_id IS NULL THEN
    RETURN NEW;  -- student isn't in an institution
  END IF;

  -- 2. Ensure an institution default exists (lazy create with permissive
  --    settings). Programme overrides remain opt-in — never auto-created.
  INSERT INTO institution_thesis_policy (institution_id, programme_id)
  VALUES (NEW.institution_id, NULL)
  ON CONFLICT DO NOTHING;

  -- 3. Resolve the most-specific policy for the project owner.
  v_policy := resolve_thesis_policy_for_user(v_owner_id, NEW.institution_id);

  IF v_policy.id IS NOT NULL AND NEW.policy_snapshot IS NULL THEN
    NEW.policy_version_snapshot := v_policy.policy_version;
    NEW.policy_snapshot         := to_jsonb(v_policy)
                                    - 'created_at' - 'updated_at' - 'updated_by';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger object itself is unchanged; the function body above is what runs.
-- DROP/CREATE to make this migration idempotent on re-apply.
DROP TRIGGER IF EXISTS thesis_metadata_snapshot_policy ON thesis_metadata;
CREATE TRIGGER thesis_metadata_snapshot_policy
  BEFORE INSERT ON thesis_metadata
  FOR EACH ROW EXECUTE FUNCTION snapshot_thesis_policy_on_insert();


-- ── 4. Audit registry ────────────────────────────────────────────────────────

INSERT INTO public.audit_action_registry (action) VALUES
  ('thesis.policy.deleted')
ON CONFLICT (action) DO NOTHING;
