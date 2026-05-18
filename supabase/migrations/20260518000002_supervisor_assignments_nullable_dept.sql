-- department_id is not required for the supervisor-student model
ALTER TABLE supervisor_assignments
  ALTER COLUMN department_id DROP NOT NULL;
