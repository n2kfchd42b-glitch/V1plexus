-- ════════════════════════════════════════════════════════════════════════════
-- SUPERVISOR CAPACITY VIEW
--
-- Single source of truth for "is this supervisor accepting students?"
--
-- Counts both primary and co-supervisor active assignments toward the cap.
-- Co-supervision is real time commitment — counting only primaries would
-- under-report load and let popular supervisors get crushed.
--
-- supervision_max_students = NULL means "no cap declared" — treated as
-- effectively unlimited so we don't accidentally block researchers who
-- opted in without specifying a limit. UI will show "Open" without a
-- numeric badge in that case.
-- ════════════════════════════════════════════════════════════════════════════

SET search_path = public;

CREATE OR REPLACE VIEW v_supervisor_capacity AS
SELECT
  p.id                                                AS supervisor_id,
  p.full_name,
  p.email,
  p.avatar_url,
  p.title,
  p.research_discipline,
  p.supervision_areas,
  p.supervision_bio,
  p.supervision_max_students                          AS slots_total,
  COALESCE(load.active_count, 0)::int                 AS slots_used,
  CASE
    WHEN p.supervision_max_students IS NULL THEN NULL
    ELSE GREATEST(p.supervision_max_students - COALESCE(load.active_count, 0), 0)::int
  END                                                 AS slots_open,
  CASE
    WHEN NOT p.available_to_supervise THEN false
    WHEN p.supervision_max_students IS NULL THEN true
    WHEN COALESCE(load.active_count, 0) < p.supervision_max_students THEN true
    ELSE false
  END                                                 AS accepting_now,
  p.available_to_supervise
FROM profiles p
LEFT JOIN (
  SELECT supervisor_id, COUNT(*) AS active_count
  FROM supervisor_assignments
  WHERE status = 'active'
  GROUP BY supervisor_id
) load ON load.supervisor_id = p.id
WHERE p.available_to_supervise = true;

-- Views inherit RLS from underlying tables in PG ≥ 15; profiles already has
-- a permissive read policy for authenticated users. The view is filtered to
-- opted-in profiles only, so no further policy is required.

COMMENT ON VIEW v_supervisor_capacity IS
  'Supervisor directory with live capacity. slots_open is NULL when no cap is declared.';
