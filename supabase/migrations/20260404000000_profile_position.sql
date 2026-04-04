-- profiles.role has a CHECK constraint limiting values to the system enum
-- (researcher, pi, coordinator, admin). The portfolio "Role" field is free-text
-- (e.g. "PhD Candidate"), so we store it in a separate column: position.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS position TEXT;
