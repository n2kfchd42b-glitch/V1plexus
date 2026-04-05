-- ════════════════════════════════════════════════════════════════
-- PILLARS 3, 4, 6: Analysis Embeds, Security Gate, Translation
-- Date: 2026-04-05
-- ════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════
-- PILLAR 3: Data Integration & Reproducibility
-- Tracks which analysis runs are embedded in a document
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS document_analysis_embeds (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  analysis_run_id  UUID NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  show_summary     BOOLEAN NOT NULL DEFAULT true,
  show_key_stats   BOOLEAN NOT NULL DEFAULT true,
  added_by         UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(document_id, analysis_run_id)
);

CREATE INDEX idx_doc_analysis_embeds_document ON document_analysis_embeds(document_id);
CREATE INDEX idx_doc_analysis_embeds_run     ON document_analysis_embeds(analysis_run_id);

ALTER TABLE document_analysis_embeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view embeds in accessible documents" ON document_analysis_embeds
  FOR SELECT TO authenticated USING (
    document_id IN (
      SELECT d.id FROM documents d
      WHERE d.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
        UNION SELECT id FROM projects WHERE owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Members can add analysis embeds" ON document_analysis_embeds
  FOR INSERT TO authenticated WITH CHECK (
    added_by = auth.uid()
    AND document_id IN (
      SELECT d.id FROM documents d
      WHERE d.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
        UNION SELECT id FROM projects WHERE owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Embed adder can remove their embeds" ON document_analysis_embeds
  FOR DELETE TO authenticated USING (added_by = auth.uid());

GRANT SELECT, INSERT, DELETE ON document_analysis_embeds TO authenticated;

-- ════════════════════════════════════════════════════════════════
-- PILLAR 4: Security — document-level access override
-- Allows project owners to restrict a document beyond default RLS
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS document_access_overrides (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL DEFAULT 'read' CHECK (access_level IN ('read', 'edit', 'none')),
  granted_by   UUID NOT NULL REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(document_id, user_id)
);

CREATE INDEX idx_doc_access_overrides_document ON document_access_overrides(document_id);
CREATE INDEX idx_doc_access_overrides_user     ON document_access_overrides(user_id);

ALTER TABLE document_access_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project owners can manage access overrides" ON document_access_overrides
  FOR ALL TO authenticated USING (
    document_id IN (
      SELECT d.id FROM documents d
      JOIN projects p ON p.id = d.project_id
      WHERE p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can see their own access overrides" ON document_access_overrides
  FOR SELECT TO authenticated USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON document_access_overrides TO authenticated;

-- ════════════════════════════════════════════════════════════════
-- PILLAR 6: Translation log (optional audit of AI translations)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS document_translations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  target_language VARCHAR(10) NOT NULL,
  language_name   TEXT NOT NULL,
  translated_by   UUID REFERENCES auth.users(id),
  was_truncated   BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_doc_translations_document ON document_translations(document_id);

ALTER TABLE document_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can see translation history" ON document_translations
  FOR SELECT TO authenticated USING (
    document_id IN (
      SELECT d.id FROM documents d
      WHERE d.project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
        UNION SELECT id FROM projects WHERE owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Authenticated users can log translations" ON document_translations
  FOR INSERT TO authenticated WITH CHECK (translated_by = auth.uid());

GRANT SELECT, INSERT ON document_translations TO authenticated;
