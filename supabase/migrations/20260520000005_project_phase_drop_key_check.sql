-- Drop the CHECK constraint that restricts phase_key to the 7 built-in values.
-- This allows students to add custom phases (phase_key like 'phase_xxxxx')
-- via the InteractivePhaseBar "+ Add" button.
ALTER TABLE project_phases DROP CONSTRAINT IF EXISTS project_phases_phase_key_check;
