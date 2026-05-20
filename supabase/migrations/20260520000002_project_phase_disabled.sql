-- Allow students to mark individual phases as not applicable to their project
ALTER TABLE project_phases ADD COLUMN IF NOT EXISTS disabled boolean NOT NULL DEFAULT false;
