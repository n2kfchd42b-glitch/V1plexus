-- ════════════════════════════════════════
-- PLEXUS Phase 2 — Documents & Ethics
-- ════════════════════════════════════════

-- ════════════════════════════════════════
-- DOCUMENT TEMPLATES (referenced by documents)
-- ════════════════════════════════════════
CREATE TABLE document_templates (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name           TEXT NOT NULL,
  doc_type       TEXT NOT NULL,
  content        JSONB NOT NULL,
  standard       TEXT,
  description    TEXT,
  institution_id UUID REFERENCES institutions(id),
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- ════════════════════════════════════════
-- DOCUMENTS
-- ════════════════════════════════════════
CREATE TABLE documents (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  doc_type        TEXT DEFAULT 'general' CHECK (doc_type IN (
                    'protocol', 'manuscript', 'thesis_chapter',
                    'ethics_application', 'analysis_plan', 'general'
                  )),
  content         JSONB DEFAULT '{}',
  template_id     UUID REFERENCES document_templates(id),
  status          TEXT DEFAULT 'draft' CHECK (status IN (
                    'draft', 'in_review', 'revision_requested', 'approved', 'locked'
                  )),
  current_version INTEGER DEFAULT 1,
  locked_by       UUID REFERENCES profiles(id),
  locked_at       TIMESTAMPTZ,
  created_by      UUID NOT NULL REFERENCES profiles(id),
  word_count      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_documents_project ON documents(project_id);

CREATE TABLE document_versions (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id    UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content        JSONB NOT NULL,
  created_by     UUID REFERENCES profiles(id),
  change_summary TEXT,
  word_count     INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(document_id, version_number)
);

-- ════════════════════════════════════════
-- ETHICS / IRB TRACKING
-- ════════════════════════════════════════
CREATE TABLE ethics_applications (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  application_ref TEXT,
  status          TEXT DEFAULT 'draft' CHECK (status IN (
                    'draft', 'submitted', 'under_review', 'approved',
                    'conditionally_approved', 'rejected', 'expired', 'renewal_pending'
                  )),
  board_name      TEXT,
  submitted_at    TIMESTAMPTZ,
  approved_at     TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  conditions      TEXT,
  notes           TEXT,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ethics_project ON ethics_applications(project_id);
CREATE INDEX idx_ethics_status ON ethics_applications(status);

CREATE TABLE ethics_amendments (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES ethics_applications(id) ON DELETE CASCADE,
  amendment_ref  TEXT,
  description    TEXT NOT NULL,
  justification  TEXT,
  submitted_at   TIMESTAMPTZ,
  approved_at    TIMESTAMPTZ,
  status         TEXT DEFAULT 'draft' CHECK (status IN (
                   'draft', 'submitted', 'approved', 'rejected'
                 )),
  created_by     UUID REFERENCES profiles(id),
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE ethics_documents (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID REFERENCES ethics_applications(id),
  amendment_id   UUID REFERENCES ethics_amendments(id),
  file_name      TEXT NOT NULL,
  file_path      TEXT NOT NULL,
  file_size      BIGINT,
  uploaded_by    UUID REFERENCES profiles(id),
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- updated_at triggers
CREATE TRIGGER set_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON ethics_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ════════════════════════════════════════
-- RLS
-- ════════════════════════════════════════
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ethics_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ethics_amendments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ethics_documents ENABLE ROW LEVEL SECURITY;

-- Document templates: global read
CREATE POLICY "Templates are publicly readable" ON document_templates
  FOR SELECT USING (true);

-- Documents: project members can read
CREATE POLICY "Documents visible to project members" ON documents
  FOR SELECT TO authenticated USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
      UNION SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );
CREATE POLICY "Project members can create documents" ON documents
  FOR INSERT TO authenticated WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
      UNION SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );
CREATE POLICY "Document creators can update" ON documents
  FOR UPDATE TO authenticated USING (created_by = auth.uid());

-- Document versions: follow document visibility
CREATE POLICY "Document versions visible to project members" ON document_versions
  FOR SELECT TO authenticated USING (
    document_id IN (
      SELECT id FROM documents WHERE project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
        UNION SELECT id FROM projects WHERE owner_id = auth.uid()
      )
    )
  );
CREATE POLICY "Document creators can create versions" ON document_versions
  FOR INSERT TO authenticated WITH CHECK (
    document_id IN (
      SELECT id FROM documents WHERE created_by = auth.uid()
    )
  );

-- Ethics applications
CREATE POLICY "Ethics visible to project members" ON ethics_applications
  FOR SELECT TO authenticated USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
      UNION SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );
CREATE POLICY "Project members can manage ethics" ON ethics_applications
  FOR ALL TO authenticated USING (
    project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );

-- Ethics amendments
CREATE POLICY "Amendments visible to project members" ON ethics_amendments
  FOR SELECT TO authenticated USING (
    application_id IN (
      SELECT id FROM ethics_applications WHERE project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
        UNION SELECT id FROM projects WHERE owner_id = auth.uid()
      )
    )
  );
CREATE POLICY "Project owners can manage amendments" ON ethics_amendments
  FOR ALL TO authenticated USING (
    application_id IN (
      SELECT id FROM ethics_applications WHERE project_id IN (
        SELECT id FROM projects WHERE owner_id = auth.uid()
      )
    )
  );

-- Ethics documents
CREATE POLICY "Ethics documents visible to project members" ON ethics_documents
  FOR SELECT TO authenticated USING (
    application_id IN (
      SELECT id FROM ethics_applications WHERE project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
        UNION SELECT id FROM projects WHERE owner_id = auth.uid()
      )
    )
  );
CREATE POLICY "Project members can upload ethics documents" ON ethics_documents
  FOR INSERT TO authenticated WITH CHECK (
    application_id IN (
      SELECT id FROM ethics_applications WHERE project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
        UNION SELECT id FROM projects WHERE owner_id = auth.uid()
      )
    )
  );

-- ════════════════════════════════════════
-- SEED: Document Templates
-- ════════════════════════════════════════
INSERT INTO document_templates (name, doc_type, standard, description, content) VALUES
(
  'STROBE Protocol',
  'protocol',
  'STROBE',
  'STrengthening the Reporting of OBservational studies in Epidemiology',
  '{
    "type": "doc",
    "content": [
      {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "Title"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Provide a title that indicates the study design (cohort, case-control, or cross-sectional study)."}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Background / Rationale"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Explain the scientific background and rationale for the investigation being reported."}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Objectives"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "State specific objectives, including any prespecified hypotheses."}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Methods"}]},
      {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Study Design"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Present key elements of study design early in the paper."}]},
      {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Setting"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Describe the setting, locations, and relevant dates, including periods of recruitment, exposure, follow-up, and data collection."}]},
      {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Participants"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Describe eligibility criteria and sources and methods of selection of participants."}]},
      {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Variables"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Clearly define all outcomes, exposures, predictors, potential confounders, and effect modifiers."}]},
      {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Data Sources / Measurement"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "For each variable of interest, give sources of data and details of methods of assessment."}]},
      {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Bias"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Describe any efforts to address potential sources of bias."}]},
      {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Study Size"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Explain how the study size was arrived at."}]},
      {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Statistical Methods"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Describe all statistical methods, including those used to control for confounding."}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Results"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Report results here."}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Discussion"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Summarise key results, discuss limitations, give a cautious overall interpretation."}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Limitations"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Discuss limitations of the study, taking into account sources of potential bias or imprecision."}]}
    ]
  }'
),
(
  'CONSORT Protocol',
  'protocol',
  'CONSORT',
  'Consolidated Standards of Reporting Trials',
  '{
    "type": "doc",
    "content": [
      {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "Title"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Identification as randomised trial in the title."}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Introduction"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Scientific background and explanation of rationale."}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Methods"}]},
      {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Trial Design"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Description of trial design (parallel, factorial) including allocation ratio."}]},
      {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Participants"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Eligibility criteria for participants and settings and locations where the data were collected."}]},
      {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Interventions"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "The interventions for each group with sufficient details to allow replication."}]},
      {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Outcomes"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Completely defined pre-specified primary and secondary outcome measures."}]},
      {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Sample Size"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "How sample size was determined and explanation of any interim analyses and stopping guidelines."}]},
      {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Randomisation"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Method used to generate the random allocation sequence and mechanism used to implement the allocation concealment."}]},
      {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Blinding"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Who was blinded after assignment to interventions, how blinding was implemented."}]},
      {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "Statistical Methods"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Statistical methods used to compare groups for primary and secondary outcomes."}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Results"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Report results here."}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Discussion"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Interpretation consistent with results, balancing benefits and harms."}]}
    ]
  }'
),
(
  'General Manuscript',
  'manuscript',
  NULL,
  'Standard academic manuscript structure',
  '{
    "type": "doc",
    "content": [
      {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "Title"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Your manuscript title here."}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Abstract"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "A concise summary of the research (150–300 words)."}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Introduction"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Background, rationale, and objectives of the study."}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Methods"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Study design, data collection, and analysis methods."}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Results"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Present findings without interpretation."}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Discussion"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Interpret results in the context of existing literature."}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Conclusion"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Summarise the key findings and implications."}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "References"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "List references in the required citation style."}]}
    ]
  }'
),
(
  'Thesis Chapter',
  'thesis_chapter',
  NULL,
  'Standard thesis chapter structure',
  '{
    "type": "doc",
    "content": [
      {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "Chapter Title"}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Introduction"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Introduce the chapter topic and its relevance to the broader thesis."}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Literature Review"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Critical review of existing literature relevant to this chapter."}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Methodology"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Research approach and methods used in this chapter."}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Findings"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Present findings specific to this chapter."}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Discussion"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Interpret findings and relate to the broader research questions."}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Summary"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Summarise the chapter and link to the next chapter."}]}
    ]
  }'
);

-- ════════════════════════════════════════
-- STORAGE: ethics-documents bucket
-- (Run in Supabase Dashboard or via CLI)
-- insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- values (
--   'ethics-documents', 'ethics-documents', false, 10485760,
--   '{application/pdf,image/png,image/jpeg,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document}'
-- );
-- ════════════════════════════════════════
