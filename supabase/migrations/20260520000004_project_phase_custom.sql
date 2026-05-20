-- Add display name and colour to project_phases so students can fully customise their phase list
ALTER TABLE project_phases ADD COLUMN IF NOT EXISTS name  text;
ALTER TABLE project_phases ADD COLUMN IF NOT EXISTS color text;

-- Backfill names and colours for any existing rows using the canonical defaults
UPDATE project_phases SET
  name = CASE phase_key
    WHEN 'concept'         THEN 'Concept'
    WHEN 'protocol'        THEN 'Protocol'
    WHEN 'ethics'          THEN 'Ethics'
    WHEN 'data_collection' THEN 'Data Collection'
    WHEN 'analysis'        THEN 'Analysis'
    WHEN 'writing'         THEN 'Writing'
    WHEN 'publication'     THEN 'Publication'
    ELSE phase_key
  END,
  color = CASE phase_key
    WHEN 'concept'         THEN '#A1A1AA'
    WHEN 'protocol'        THEN '#3B82F6'
    WHEN 'ethics'          THEN '#F59E0B'
    WHEN 'data_collection' THEN '#8B5CF6'
    WHEN 'analysis'        THEN '#EC4899'
    WHEN 'writing'         THEN '#14B8A6'
    WHEN 'publication'     THEN '#22C55E'
    ELSE '#A1A1AA'
  END
WHERE name IS NULL;
