-- Store the user-defined display order for phases
ALTER TABLE project_phases ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Seed existing rows with the canonical order
UPDATE project_phases SET sort_order = CASE phase_key
  WHEN 'concept'         THEN 0
  WHEN 'protocol'        THEN 1
  WHEN 'ethics'          THEN 2
  WHEN 'data_collection' THEN 3
  WHEN 'analysis'        THEN 4
  WHEN 'writing'         THEN 5
  WHEN 'publication'     THEN 6
  ELSE 99
END;
