-- ════════════════════════════════════════════════════════════════════════════
-- THESIS LIFECYCLE FOUNDATION
--
-- Layer 1 of the institutional thesis workflow. Strictly additive — every
-- existing thesis_metadata row gets a derived lifecycle_state plus a
-- permissive snapshot of its institution's policy. No existing API behavior
-- changes; no rows fail to insert under the new column.
--
-- Pieces:
--   1. thesis_metadata.lifecycle_state                — single source of truth
--   2. allowed_thesis_transitions                     — declarative FSM table
--   3. validate_thesis_state_transition()             — guard trigger
--   4. institution_thesis_policy                      — per-institution config
--   5. thesis_metadata.policy_version_snapshot
--      thesis_metadata.policy_snapshot                — frozen at creation
--   6. notification_preferences                       — digest scaffolding
--   7. Audit registry entries for new actions
-- ════════════════════════════════════════════════════════════════════════════

SET search_path = public;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. DEFENSIVE COLUMN ADDS
--
-- Earlier migrations created thesis_metadata with slightly different shapes
-- depending on apply order (20260323000000 vs 20260523000001 both have
-- CREATE TABLE IF NOT EXISTS so whichever ran first wins). Make sure all the
-- columns this migration depends on actually exist before touching them.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE thesis_metadata
  ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supervisor_id  UUID REFERENCES profiles(id)     ON DELETE SET NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. LIFECYCLE STATE COLUMN
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE thesis_metadata
  ADD COLUMN IF NOT EXISTS lifecycle_state TEXT NOT NULL DEFAULT 'matched'
    CHECK (lifecycle_state IN (
      'matched',
      'proposal_draft',
      'proposal_review',
      'active',
      'chapter_review',
      'submitted',
      'approved',
      'archived'
    ));

CREATE INDEX IF NOT EXISTS idx_thesis_metadata_lifecycle_state
  ON thesis_metadata (lifecycle_state);

-- Backfill from existing signals so existing rows land in a sensible state.
-- Order matters — most-advanced state wins.
UPDATE thesis_metadata SET lifecycle_state = 'approved'
  WHERE defense_status IN ('passed', 'passed_with_corrections')
    AND lifecycle_state = 'matched';

UPDATE thesis_metadata SET lifecycle_state = 'submitted'
  WHERE defense_status IN ('final_scheduled', 'final_completed')
    AND lifecycle_state = 'matched';

UPDATE thesis_metadata tm SET lifecycle_state = 'chapter_review'
  WHERE lifecycle_state = 'matched'
    AND EXISTS (
      SELECT 1 FROM thesis_chapters tc
      WHERE tc.project_id = tm.project_id
        AND tc.status = 'submitted_for_review'
    );

UPDATE thesis_metadata tm SET lifecycle_state = 'active'
  WHERE lifecycle_state = 'matched'
    AND EXISTS (
      SELECT 1 FROM thesis_chapters tc
      WHERE tc.project_id = tm.project_id
        AND tc.status IN ('drafting', 'approved', 'locked')
    );

UPDATE thesis_metadata SET lifecycle_state = 'proposal_draft'
  WHERE lifecycle_state = 'matched'
    AND supervisor_id IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ALLOWED TRANSITIONS TABLE
--
-- One row per legal (from, to, actor_role) edge. Gate columns describe
-- conditions that must also hold (checked by the trigger). Reverse edges
-- (e.g. proposal_review → proposal_draft on revision) are first-class rows.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS allowed_thesis_transitions (
  from_state                      TEXT NOT NULL,
  to_state                        TEXT NOT NULL,
  required_role                   TEXT NOT NULL
    CHECK (required_role IN (
      'student', 'primary_supervisor', 'coordinator', 'admin', 'system'
    )),
  requires_ethics_gate            BOOLEAN NOT NULL DEFAULT FALSE,
  requires_all_chapters_approved  BOOLEAN NOT NULL DEFAULT FALSE,
  requires_defense_pass           BOOLEAN NOT NULL DEFAULT FALSE,
  description                     TEXT,
  PRIMARY KEY (from_state, to_state, required_role)
);

ALTER TABLE allowed_thesis_transitions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'allowed_thesis_transitions' AND policyname = 'read_transitions'
  ) THEN
    CREATE POLICY "read_transitions" ON allowed_thesis_transitions
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- Seed the canonical workflow. Coordinator / admin can always force any
-- transition (handled in the trigger), so we don't seed every from/to pair
-- for them — only the meaningful ones (archive).
INSERT INTO allowed_thesis_transitions
  (from_state, to_state, required_role, requires_ethics_gate, requires_all_chapters_approved, requires_defense_pass, description)
VALUES
  ('matched',          'proposal_draft',   'primary_supervisor', FALSE, FALSE, FALSE, 'Supervisor accepts and opens proposal drafting'),
  ('matched',          'proposal_draft',   'student',            FALSE, FALSE, FALSE, 'Student begins proposal after supervisor confirmation'),

  ('proposal_draft',   'proposal_review',  'student',            FALSE, FALSE, FALSE, 'Student submits proposal for supervisor review'),

  ('proposal_review',  'proposal_draft',   'primary_supervisor', FALSE, FALSE, FALSE, 'Supervisor requests revisions to proposal'),
  ('proposal_review',  'active',           'primary_supervisor', FALSE, FALSE, FALSE, 'Supervisor approves proposal — research begins'),

  ('active',           'chapter_review',   'student',            FALSE, TRUE,  FALSE, 'Student submits all chapters for final review'),

  ('chapter_review',   'active',           'primary_supervisor', FALSE, FALSE, FALSE, 'Supervisor requests revisions on chapters'),
  ('chapter_review',   'submitted',        'primary_supervisor', FALSE, FALSE, FALSE, 'Supervisor signs off on chapters — ready for defense'),

  ('submitted',        'approved',         'primary_supervisor', FALSE, FALSE, FALSE, 'Supervisor records pass (when no oral defense required)'),

  ('approved',         'archived',         'coordinator',        FALSE, FALSE, FALSE, 'Coordinator archives completed thesis'),
  ('approved',         'archived',         'admin',              FALSE, FALSE, FALSE, 'Admin archives completed thesis')
ON CONFLICT DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. INSTITUTION THESIS POLICY
--
-- One row per institution. policy_version increments on every update so we
-- can snapshot it onto in-flight theses (see #5) and let them finish under
-- the rules they started with.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS institution_thesis_policy (
  institution_id            UUID PRIMARY KEY REFERENCES institutions(id) ON DELETE CASCADE,
  policy_version            INTEGER NOT NULL DEFAULT 1,
  require_ethics_gate       BOOLEAN NOT NULL DEFAULT FALSE,
  allow_co_supervisors      BOOLEAN NOT NULL DEFAULT TRUE,
  max_co_supervisors        INTEGER NOT NULL DEFAULT 2 CHECK (max_co_supervisors >= 0),
  require_oral_defense      BOOLEAN NOT NULL DEFAULT FALSE,
  require_proposal_defense  BOOLEAN NOT NULL DEFAULT FALSE,
  min_chapters              INTEGER NOT NULL DEFAULT 1 CHECK (min_chapters >= 1),
  default_chapter_titles    JSONB NOT NULL DEFAULT '[]'::jsonb,
  reminder_offsets_days     INTEGER[] NOT NULL DEFAULT ARRAY[7, 2],
  escalation_delay_hours    INTEGER NOT NULL DEFAULT 24,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                UUID REFERENCES profiles(id) ON DELETE SET NULL
);

ALTER TABLE institution_thesis_policy ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'institution_thesis_policy' AND policyname = 'policy_read_members'
  ) THEN
    CREATE POLICY "policy_read_members" ON institution_thesis_policy
      FOR SELECT TO authenticated USING (
        institution_id IN (
          SELECT institution_id FROM profiles WHERE id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'institution_thesis_policy' AND policyname = 'policy_write_admin'
  ) THEN
    CREATE POLICY "policy_write_admin" ON institution_thesis_policy
      FOR ALL TO authenticated USING (
        institution_id IN (
          SELECT institution_id FROM profiles
          WHERE id = auth.uid() AND role IN ('admin', 'coordinator')
        )
      );
  END IF;
END $$;

-- updated_at + auto-increment policy_version on every UPDATE
CREATE OR REPLACE FUNCTION bump_thesis_policy_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' THEN
    NEW.policy_version := OLD.policy_version + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS institution_thesis_policy_versioning ON institution_thesis_policy;
CREATE TRIGGER institution_thesis_policy_versioning
  BEFORE UPDATE ON institution_thesis_policy
  FOR EACH ROW EXECUTE FUNCTION bump_thesis_policy_version();

-- Seed a permissive default for every existing institution. New institutions
-- will get one inserted lazily by the API.
INSERT INTO institution_thesis_policy (institution_id)
SELECT id FROM institutions
ON CONFLICT (institution_id) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. THESIS-LEVEL POLICY SNAPSHOT
--
-- Frozen at thesis creation so mid-flight policy edits don't change the rules
-- under in-progress students.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE thesis_metadata
  ADD COLUMN IF NOT EXISTS policy_version_snapshot INTEGER,
  ADD COLUMN IF NOT EXISTS policy_snapshot         JSONB;

-- Backfill snapshots for existing theses using their institution's current policy.
UPDATE thesis_metadata tm
SET policy_version_snapshot = itp.policy_version,
    policy_snapshot = to_jsonb(itp.*) - 'created_at' - 'updated_at' - 'updated_by'
FROM institution_thesis_policy itp
WHERE itp.institution_id = tm.institution_id
  AND tm.policy_version_snapshot IS NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. STATE TRANSITION GUARD TRIGGER
--
-- All lifecycle_state UPDATEs flow through this trigger. It checks:
--   a) The (from, to, role) edge exists in allowed_thesis_transitions
--   b) The conditional gates declared on that edge actually hold
--
-- The acting role is passed via a transaction-local setting
-- (`plexus.thesis_actor_role`) so RLS-bypassing service code MUST set it
-- explicitly. Coordinator / admin actors bypass the (from, to) lookup but
-- their action is still recorded by the calling API layer.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION validate_thesis_state_transition()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_role  TEXT;
  v_edge        allowed_thesis_transitions%ROWTYPE;
  v_unapproved  INTEGER;
BEGIN
  -- Allow same-state updates (no-op transitions used by other column writes)
  IF NEW.lifecycle_state = OLD.lifecycle_state THEN
    RETURN NEW;
  END IF;

  -- Read the actor role; default to 'system' so service-role backfills can
  -- write freely as long as they explicitly want to.
  v_actor_role := current_setting('plexus.thesis_actor_role', true);
  IF v_actor_role IS NULL OR v_actor_role = '' THEN
    v_actor_role := 'system';
  END IF;

  -- Coordinator, admin, system: skip the edge lookup. The API records the
  -- force-transition reason; the database does not block it.
  IF v_actor_role IN ('coordinator', 'admin', 'system') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_edge
  FROM allowed_thesis_transitions
  WHERE from_state    = OLD.lifecycle_state
    AND to_state      = NEW.lifecycle_state
    AND required_role = v_actor_role
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Illegal thesis transition: % → % by role %',
      OLD.lifecycle_state, NEW.lifecycle_state, v_actor_role
      USING ERRCODE = 'check_violation';
  END IF;

  -- Gate: all chapters approved
  IF v_edge.requires_all_chapters_approved THEN
    SELECT COUNT(*) INTO v_unapproved
    FROM thesis_chapters
    WHERE project_id = NEW.project_id
      AND status NOT IN ('approved', 'locked');

    IF v_unapproved > 0 THEN
      RAISE EXCEPTION
        'Transition % → % requires all chapters approved (% unapproved)',
        OLD.lifecycle_state, NEW.lifecycle_state, v_unapproved
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Gate: ethics approval (reads project's approval_gates if the table exists)
  IF v_edge.requires_ethics_gate THEN
    PERFORM 1 FROM approval_gates
    WHERE project_id = NEW.project_id
      AND gate_type  = 'ethics'
      AND status     = 'approved'
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'Transition % → % requires an approved ethics gate',
        OLD.lifecycle_state, NEW.lifecycle_state
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Gate: defense pass
  IF v_edge.requires_defense_pass THEN
    PERFORM 1 FROM thesis_defenses
    WHERE project_id = NEW.project_id
      AND outcome IN ('pass', 'pass_with_corrections')
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'Transition % → % requires a passing defense outcome',
        OLD.lifecycle_state, NEW.lifecycle_state
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS thesis_metadata_transition_guard ON thesis_metadata;
CREATE TRIGGER thesis_metadata_transition_guard
  BEFORE UPDATE OF lifecycle_state ON thesis_metadata
  FOR EACH ROW EXECUTE FUNCTION validate_thesis_state_transition();


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. NOTIFICATION PREFERENCES (digest scaffolding)
--
-- Empty table seeded only when users opt out of instant emails. Default
-- (no row) means "instant" so existing behavior is unchanged.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id           UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  digest_frequency  TEXT NOT NULL DEFAULT 'instant'
    CHECK (digest_frequency IN ('instant', 'daily', 'weekly', 'off')),
  quiet_hours_start INTEGER CHECK (quiet_hours_start BETWEEN 0 AND 23),
  quiet_hours_end   INTEGER CHECK (quiet_hours_end   BETWEEN 0 AND 23),
  timezone          TEXT NOT NULL DEFAULT 'UTC',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notification_preferences' AND policyname = 'own_prefs'
  ) THEN
    CREATE POLICY "own_prefs" ON notification_preferences
      FOR ALL TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. TRANSITION RPC
--
-- Single entry point used by the API. Sets the actor role for the trigger,
-- performs the UPDATE, returns the new row. Wrapping it in a function gives
-- us:
--   - atomicity with the setting (no pgbouncer cross-connection bugs)
--   - one place to add side-effects later (e.g. dispatch a worker event)
--   - SECURITY DEFINER so the trigger can read approval_gates etc. without
--     RLS getting in the way of pure validation logic
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION transition_thesis_state(
  p_project_id   UUID,
  p_to_state     TEXT,
  p_actor_role   TEXT,
  p_actor_id     UUID
) RETURNS thesis_metadata
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated thesis_metadata%ROWTYPE;
BEGIN
  IF p_actor_role NOT IN ('student', 'primary_supervisor', 'coordinator', 'admin', 'system') THEN
    RAISE EXCEPTION 'Invalid actor role: %', p_actor_role USING ERRCODE = 'check_violation';
  END IF;

  PERFORM set_config('plexus.thesis_actor_role', p_actor_role, true);

  UPDATE thesis_metadata
     SET lifecycle_state = p_to_state,
         updated_at      = now()
   WHERE project_id = p_project_id
   RETURNING * INTO v_updated;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Thesis not found for project %', p_project_id USING ERRCODE = 'no_data_found';
  END IF;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION transition_thesis_state(UUID, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION transition_thesis_state(UUID, TEXT, TEXT, UUID) TO service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. AUDIT REGISTRY SYNC
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.audit_action_registry (action) VALUES
  ('thesis.state.transitioned'),
  ('thesis.state.force_transitioned'),
  ('thesis.policy.updated'),
  ('thesis.policy.created'),
  ('thesis.chapter.submitted'),
  ('thesis.chapter.decided'),
  ('thesis.defense.scheduled'),
  ('thesis.defense.outcome_recorded'),
  ('thesis.deadline.reminder_sent'),
  ('thesis.deadline.escalated'),
  ('supervisor.capacity.changed')
ON CONFLICT (action) DO NOTHING;

INSERT INTO public.audit_resource_registry (resource_type) VALUES
  ('thesis_metadata'),
  ('thesis_chapter'),
  ('thesis_defense'),
  ('institution_thesis_policy'),
  ('thesis_deadline')
ON CONFLICT (resource_type) DO NOTHING;
