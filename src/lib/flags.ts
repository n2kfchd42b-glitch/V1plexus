/**
 * PLEXUS Feature Flags
 *
 * V1_MODE — master toggle for the focused V1 scope.
 *   When true, only the core 6-tab research workspace is visible:
 *   Overview · Data · Analysis · Timeline · Report · Settings
 *   All institutional, compliance, and collaboration features are hidden.
 *   Flip individual flags below to unlock sections independently.
 */
export const V1_MODE = true;

// ── Core V1 sections (always enabled when V1_MODE = true) ─────────────────
// These never need a flag — they are the product.
// Overview, Data, Analysis, Timeline, Report, Settings

// ── Hidden in V1 — flip to true to unlock ────────────────────────────────

/**
 * APPROVALS_ENABLED: Supervisor/PI approval gates for datasets and analyses.
 *   - While false, /approvals routes redirect and nav links are hidden.
 */
export const APPROVALS_ENABLED = false;

/**
 * ETHICS_ENABLED: Ethics application, amendment tracking, and IRB document management.
 *   - While false, Ethics tab is hidden from project nav.
 */
export const ETHICS_ENABLED = false;

/**
 * DOCUMENTS_ENABLED: Collaborative document editor (TipTap), version history, authorship.
 *   - While false, Documents tab is hidden from project nav.
 */
export const DOCUMENTS_ENABLED = true;

/**
 * TEAM_ENABLED: Project team management, invitations, role assignment.
 *   - While false, Team tab is hidden from project nav.
 */
export const TEAM_ENABLED = false;

/**
 * REVIEWS_ENABLED: Peer review queue, feedback forms, review workspace.
 *   - While false, /reviews route is hidden from sidebar.
 */
export const REVIEWS_ENABLED = false;

/**
 * CONSENT_ENABLED: Digital consent form builder, capture, and records.
 *   - While false, /consent routes are hidden.
 */
export const CONSENT_ENABLED = false;

/**
 * NETWORK_ENABLED: Research data network, dataset sharing, access requests.
 *   - While false, /network routes are hidden.
 */
export const NETWORK_ENABLED = false;

/**
 * PORTFOLIO_ENABLED: Public researcher profile, certificates, publication list.
 *   - While false, /profile routes are hidden.
 */
export const PORTFOLIO_ENABLED = false;

/**
 * SUPERVISOR_ENABLED: Supervisor/student workflows, student progress tracking.
 *   - While false, /supervisor and /student routes are hidden.
 */
export const SUPERVISOR_ENABLED = false;

/**
 * AI_ENABLED: Anthropic API features (analysis suggestions, cover letter, translation, project suggestions).
 *   - While false, all AI API routes return 503 immediately — no credits are consumed.
 *   - Flip to true when premium user gating is in place.
 */
export const AI_ENABLED = false;

/**
 * ANALYTICS_ENABLED: the external PLEXUS Analytics (FastAPI / Fly.io) service.
 *   Powers causal inference, sensitivity analysis, data portraits, assumption
 *   checks, research-output packaging, the cryptographic ledger, verification,
 *   and the journal portal. The CORE statistical engine (descriptive, t-test,
 *   ANOVA, regression, survival, PCA, …) runs in the browser and is unaffected.
 *
 *   Controlled by NEXT_PUBLIC_ANALYTICS_ENABLED so it reads on both the server
 *   (API routes return 503 immediately when off) and the client (UI hides the
 *   dependent launchers). Defaults to enabled; set the env var to 'false' when
 *   the analytics service is taken down so the app degrades cleanly instead of
 *   throwing 500s or hanging on a dead host.
 */
export const ANALYTICS_ENABLED = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== 'false';

// ── Legacy flags (kept for backward compatibility) ────────────────────────

/**
 * FIELD_OPERATIONS_ENABLED: Phase 7 field operations layer.
 */
export const FIELD_OPERATIONS_ENABLED = false;

/**
 * THESIS_ENABLED: Phase 8 thesis & student management workspace.
 */
export const THESIS_ENABLED = true;

/**
 * THESIS_WORKFLOW_V2: New institutional thesis workflow layer (May 2026).
 *   Gates the UI surfaces added by the workflow PRs:
 *     - ThesisLifecyclePanel (state machine controls on chapters page)
 *     - ThesisAuditTimelineCard (workflow event timeline)
 *     - ChapterDecisionPanel (supervisor decide UI in doc viewer)
 *     - History drawer on ChapterCard
 *     - /institution/policy admin page (under the dedicated institution section)
 *   API routes (transition, decide, deadline-sweep) remain live regardless —
 *   the cron sweep and DB triggers keep working so deadlines accrue even when
 *   the UI is hidden. Flip to true to unlock the visible surfaces.
 */
export const THESIS_WORKFLOW_V2 = true;

/**
 * PUBLICATION_ENABLED: Phase 9 publication pipeline.
 */
export const PUBLICATION_ENABLED = false;

/**
 * INSTITUTIONAL_INTELLIGENCE_ENABLED: Phase 11 research impact, grants, knowledge base.
 */
export const INSTITUTIONAL_INTELLIGENCE_ENABLED = false;

/**
 * NETWORK_COMPLIANCE_ENABLED: Phase 12 research network, compliance engine, consent.
 */
export const NETWORK_COMPLIANCE_ENABLED = false;
