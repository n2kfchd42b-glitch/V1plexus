/**
 * Feature flags — flip to `true` when ready to deploy each feature.
 *
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
