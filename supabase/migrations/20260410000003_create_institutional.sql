-- ════════════════════════════════════════════════════════════════
-- PLEXUS Phase 2, Prompt 6: Institutional Service Tables
-- ════════════════════════════════════════════════════════════════

-- ── Table: institutional_policies ────────────────────────────────

CREATE TABLE public.institutional_policies (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id              UUID NOT NULL REFERENCES institutions(id),
  workspace_id                UUID NOT NULL REFERENCES workspaces(id),
  min_trust_level             INTEGER NOT NULL DEFAULT 1
                                CHECK (min_trust_level BETWEEN 0 AND 3),
  min_dqi_score               NUMERIC(4,3) NOT NULL DEFAULT 0.70
                                CHECK (min_dqi_score BETWEEN 0 AND 1),
  supervisor_signing_required BOOLEAN NOT NULL DEFAULT true,
  institution_signing_required BOOLEAN NOT NULL DEFAULT false,
  require_assumption_checks   BOOLEAN NOT NULL DEFAULT true,
  require_ethics_reference    BOOLEAN NOT NULL DEFAULT false,
  allowed_event_types         JSONB,
  created_by                  UUID NOT NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(institution_id, workspace_id)
);

ALTER TABLE public.institutional_policies ENABLE ROW LEVEL SECURITY;

-- SELECT: workspace members
CREATE POLICY "Workspace members can view institutional policies"
  ON public.institutional_policies
  FOR SELECT TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- INSERT: owner, admin, department_head roles only
CREATE POLICY "Admins can create institutional policies"
  ON public.institutional_policies
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_memberships
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin', 'department_head')
    )
  );

-- UPDATE: owner, admin, department_head roles only
CREATE POLICY "Admins can update institutional policies"
  ON public.institutional_policies
  FOR UPDATE TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_memberships
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin', 'department_head')
    )
  );

-- DELETE: DENY ALL (no policy = deny)


-- ── Table: supervisor_signing_authorisations ──────────────────────

CREATE TABLE public.supervisor_signing_authorisations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id    UUID NOT NULL REFERENCES supervisor_assignments(id),
  supervisor_id    UUID NOT NULL REFERENCES profiles(id),
  student_id       UUID NOT NULL REFERENCES profiles(id),
  project_id       UUID NOT NULL REFERENCES projects(id),
  workspace_id     UUID NOT NULL REFERENCES workspaces(id),
  institution_id   UUID NOT NULL REFERENCES institutions(id),
  attestation_id   UUID REFERENCES identity_attestations(id),
  signing_authorised BOOLEAN NOT NULL DEFAULT true,
  authorised_by    UUID NOT NULL,
  authorised_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked          BOOLEAN DEFAULT false,
  revoked_at       TIMESTAMPTZ,
  revocation_reason TEXT,
  UNIQUE(assignment_id, project_id)
);

ALTER TABLE public.supervisor_signing_authorisations ENABLE ROW LEVEL SECURITY;

-- SELECT: supervisor, student, workspace admins
CREATE POLICY "Supervisors students and admins can view signing authorisations"
  ON public.supervisor_signing_authorisations
  FOR SELECT TO authenticated
  USING (
    supervisor_id = auth.uid()
    OR student_id = auth.uid()
    OR workspace_id IN (
      SELECT workspace_id FROM workspace_memberships
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin', 'department_head')
    )
  );

-- INSERT: workspace admins only
CREATE POLICY "Workspace admins can create signing authorisations"
  ON public.supervisor_signing_authorisations
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_memberships
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin', 'department_head')
    )
  );

-- UPDATE: workspace admins only
CREATE POLICY "Workspace admins can update signing authorisations"
  ON public.supervisor_signing_authorisations
  FOR UPDATE TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_memberships
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin', 'department_head')
    )
  );

-- DELETE: DENY ALL


-- ── Table: institutional_compliance_events ────────────────────────

CREATE TABLE public.institutional_compliance_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id),
  workspace_id   UUID NOT NULL REFERENCES workspaces(id),
  project_id     UUID NOT NULL REFERENCES projects(id),
  actor_id       UUID NOT NULL,
  event_type     TEXT NOT NULL CHECK (
                   event_type IN (
                     'policy_violation',
                     'dqi_threshold_breach',
                     'missing_assumption_check',
                     'unauthorised_signing_attempt',
                     'researcher_departed',
                     'supervisor_reassigned',
                     'package_retracted',
                     'integrity_flag'
                   )
                 ),
  severity       TEXT NOT NULL CHECK (
                   severity IN ('info', 'warning', 'critical')
                 ),
  detail         JSONB NOT NULL,
  resolved       BOOLEAN DEFAULT false,
  resolved_at    TIMESTAMPTZ,
  resolved_by    UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.institutional_compliance_events ENABLE ROW LEVEL SECURITY;

-- SELECT: workspace admins and department_head
CREATE POLICY "Admins can view compliance events"
  ON public.institutional_compliance_events
  FOR SELECT TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_memberships
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin', 'department_head')
    )
  );

-- INSERT: service role only (via service key, not user JWT)
-- No authenticated INSERT policy — service role bypasses RLS

-- UPDATE: workspace admins (resolved field only — enforced in service layer)
CREATE POLICY "Workspace admins can resolve compliance events"
  ON public.institutional_compliance_events
  FOR UPDATE TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_memberships
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin', 'department_head')
    )
  );

-- DELETE: DENY ALL


-- ── Table: researcher_departures ──────────────────────────────────

CREATE TABLE public.researcher_departures (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id             UUID NOT NULL,
  institution_id       UUID NOT NULL REFERENCES institutions(id),
  workspace_id         UUID NOT NULL REFERENCES workspaces(id),
  departed_by          UUID NOT NULL,
  departure_reason     TEXT NOT NULL CHECK (
                         departure_reason IN (
                           'graduated',
                           'resigned',
                           'terminated',
                           'transferred',
                           'deceased',
                           'admin_removal'
                         )
                       ),
  cascade_revocations  BOOLEAN NOT NULL DEFAULT true,
  attestations_revoked INTEGER DEFAULT 0,
  keys_revoked         INTEGER DEFAULT 0,
  projects_sealed      INTEGER DEFAULT 0,
  departed_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.researcher_departures ENABLE ROW LEVEL SECURITY;

-- SELECT: workspace admins
CREATE POLICY "Workspace admins can view researcher departures"
  ON public.researcher_departures
  FOR SELECT TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_memberships
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin', 'department_head')
    )
  );

-- INSERT: workspace admins only
CREATE POLICY "Workspace admins can record researcher departures"
  ON public.researcher_departures
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_memberships
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin', 'department_head')
    )
  );

-- UPDATE: DENY ALL
-- DELETE: DENY ALL


-- ── Indexes ───────────────────────────────────────────────────────

CREATE INDEX idx_institutional_policies_workspace
  ON public.institutional_policies(workspace_id);

CREATE INDEX idx_institutional_policies_institution
  ON public.institutional_policies(institution_id);

CREATE INDEX idx_ssa_supervisor
  ON public.supervisor_signing_authorisations(supervisor_id, revoked);

CREATE INDEX idx_ssa_project
  ON public.supervisor_signing_authorisations(project_id, revoked);

CREATE INDEX idx_ssa_assignment
  ON public.supervisor_signing_authorisations(assignment_id);

CREATE INDEX idx_compliance_events_workspace
  ON public.institutional_compliance_events(workspace_id, resolved, created_at DESC);

CREATE INDEX idx_compliance_events_institution
  ON public.institutional_compliance_events(institution_id, severity);

CREATE INDEX idx_researcher_departures_workspace
  ON public.researcher_departures(workspace_id, departed_at DESC);

CREATE INDEX idx_researcher_departures_actor
  ON public.researcher_departures(actor_id);
