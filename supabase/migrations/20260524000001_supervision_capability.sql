-- Supervision-as-capability: any researcher can opt in to supervise.
-- Replaces the implicit "supervisor role at signup" model with a profile-level
-- opt-in flag plus discovery metadata (areas, bio, capacity).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS available_to_supervise BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS supervision_areas TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS supervision_bio TEXT,
  ADD COLUMN IF NOT EXISTS supervision_max_students INTEGER;

-- Partial index — only opted-in profiles are ever searched.
CREATE INDEX IF NOT EXISTS idx_profiles_available_to_supervise
  ON profiles (available_to_supervise)
  WHERE available_to_supervise = TRUE;
