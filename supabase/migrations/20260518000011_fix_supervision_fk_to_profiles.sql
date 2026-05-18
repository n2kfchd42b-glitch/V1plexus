-- supervision_annotations and supervision_records were created with
-- supervisor_id/student_id referencing auth.users(id).
-- PostgREST cannot resolve the profiles!supervisor_id join across the
-- auth schema boundary, so the select query returns a 400/500 and the
-- student-side feedback panel never renders.
-- Fix: point both FKs to profiles(id) which IS auth.uid() (same UUID).

ALTER TABLE supervision_annotations
  DROP CONSTRAINT IF EXISTS supervision_annotations_supervisor_id_fkey,
  DROP CONSTRAINT IF EXISTS supervision_annotations_student_id_fkey;

ALTER TABLE supervision_annotations
  ADD CONSTRAINT supervision_annotations_supervisor_id_fkey
    FOREIGN KEY (supervisor_id) REFERENCES profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT supervision_annotations_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE supervision_records
  DROP CONSTRAINT IF EXISTS supervision_records_supervisor_id_fkey,
  DROP CONSTRAINT IF EXISTS supervision_records_student_id_fkey;

ALTER TABLE supervision_records
  ADD CONSTRAINT supervision_records_supervisor_id_fkey
    FOREIGN KEY (supervisor_id) REFERENCES profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT supervision_records_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
