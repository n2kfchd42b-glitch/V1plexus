-- Allow students to update the status of their own milestones.
-- This is needed so the submission API can flip status to 'submitted'
-- after the student inserts a milestone_submission row.
-- Students cannot set approved_by/approved_at — those are set by the
-- review endpoint which runs under the supervisor's session.

CREATE POLICY "Students can update status of their own milestones"
  ON student_milestones FOR UPDATE
  USING (student_id = auth.uid());
