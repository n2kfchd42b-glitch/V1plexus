-- Expand doc_type check constraint to include section-level labels
ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS documents_doc_type_check;

ALTER TABLE documents
  ADD CONSTRAINT documents_doc_type_check CHECK (doc_type IN (
    'protocol',
    'manuscript',
    'thesis_chapter',
    'ethics_application',
    'analysis_plan',
    'general',
    'introduction',
    'methodology',
    'results',
    'discussion',
    'abstract',
    'conclusion',
    'literature_review'
  ));
