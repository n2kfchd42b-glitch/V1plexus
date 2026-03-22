-- Extended profile fields for rich researcher profiles
-- Migration: 20260322600000_profile_extended_fields

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS title       TEXT,           -- e.g. "Dr.", "Prof.", "Mr."
  ADD COLUMN IF NOT EXISTS bio         TEXT,           -- short researcher bio
  ADD COLUMN IF NOT EXISTS orcid_id    TEXT,           -- ORCID iD (format: 0000-0000-0000-0000)
  ADD COLUMN IF NOT EXISTS phone       TEXT,
  ADD COLUMN IF NOT EXISTS website     TEXT,
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free' NOT NULL;

-- Validate ORCID format when provided (16 digits in groups of 4)
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_orcid_format;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_orcid_format
    CHECK (
      orcid_id IS NULL OR
      orcid_id ~ '^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$'
    );
