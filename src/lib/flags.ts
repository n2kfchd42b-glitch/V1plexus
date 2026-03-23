/**
 * Feature flags — flip to `true` when ready to deploy each feature.
 *
 * FIELD_OPERATIONS_ENABLED: Phase 7 field operations layer (Offline PWA, mobile data
 *   collection, coverage maps, enumerator management, field quality monitoring).
 *   - While `false`, Field Operations tab shows "coming soon" and routes are hidden.
 */
export const FIELD_OPERATIONS_ENABLED = false;

/**
 * THESIS_ENABLED: Phase 8 thesis & student management workspace.
 *   - Set to `true` to show thesis tabs, graduate dashboard, and new-thesis wizard.
 *   - While `false`, all thesis routes redirect and navigation links are hidden.
 *
 * PUBLICATION_ENABLED: Phase 9 publication pipeline.
 *   - Set to `true` to show the Publication tab on projects, journal library,
 *     citation management, submission tracker, protocol registry, and DOI minting.
 *   - While `false`, all publication routes redirect and navigation links are hidden.
 */
export const THESIS_ENABLED = false;
export const PUBLICATION_ENABLED = false;

/**
 * INSTITUTIONAL_INTELLIGENCE_ENABLED: Phase 11 research impact, grants, and knowledge base.
 *   - Set to `true` to show impact dashboard, grant management, and knowledge base pages.
 *   - While `false`, all Phase 11 routes show "coming soon" and navigation links are hidden.
 */
export const INSTITUTIONAL_INTELLIGENCE_ENABLED = false;

/**
 * NETWORK_COMPLIANCE_ENABLED: Phase 12 research network, compliance engine, consent management,
 *   DMP generator, and multi-language interface.
 *   - Set to `true` to enable the Research Network, Compliance Engine, Digital Consent,
 *     Data Management Plans, and Language Selector.
 *   - While `false`, all Phase 12 routes show "coming soon" preview pages.
 */
export const NETWORK_COMPLIANCE_ENABLED = false;
