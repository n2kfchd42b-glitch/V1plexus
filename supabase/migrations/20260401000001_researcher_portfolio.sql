-- Researcher Portfolio Feature
-- Adds portfolio-specific columns and creates portfolio tables

-- =====================================================================
-- EXTEND profiles TABLE
-- =====================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS
    username TEXT UNIQUE COLLATE NOCASE,
  ADD COLUMN IF NOT EXISTS
    portfolio_public BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS
    bio TEXT,
  ADD COLUMN IF NOT EXISTS
    institution TEXT,
  ADD COLUMN IF NOT EXISTS
    role TEXT,
  ADD COLUMN IF NOT EXISTS
    research_areas TEXT[],
  ADD COLUMN IF NOT EXISTS
    orcid_id TEXT,
  ADD COLUMN IF NOT EXISTS
    google_scholar_url TEXT,
  ADD COLUMN IF NOT EXISTS
    researchgate_url TEXT,
  ADD COLUMN IF NOT EXISTS
    personal_website TEXT,
  ADD COLUMN IF NOT EXISTS
    portfolio_headline TEXT;

-- Create unique index on lowercase username for case-insensitive uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower
  ON public.profiles(LOWER(username))
  WHERE username IS NOT NULL;

-- =====================================================================
-- TABLE: portfolio_publications
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.portfolio_publications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  profile_id UUID NOT NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  dataset_id UUID
    REFERENCES public.datasets(id) ON DELETE SET NULL,
  
  version_id UUID
    REFERENCES public.dataset_versions(id) ON DELETE SET NULL,
  
  verification_token_id UUID
    REFERENCES public.verification_tokens(id) ON DELETE SET NULL,
  
  -- Publication details
  title TEXT NOT NULL,
  journal TEXT,
  year INTEGER,
  doi TEXT,
  authors TEXT[],
  abstract TEXT,
  
  -- Study metadata
  study_type TEXT,
  study_population TEXT,
  sample_size INTEGER,
  
  -- PLEXUS integrity markers (snapshots at time of adding)
  dqi_score INTEGER,
  certificate_hash TEXT,
  reporting_guideline TEXT,
  supervisor_approved BOOLEAN NOT NULL DEFAULT false,
  assumption_checks_conducted BOOLEAN NOT NULL DEFAULT false,
  reentry_conducted BOOLEAN NOT NULL DEFAULT false,
  
  -- Visibility
  is_public BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pub_profile
  ON public.portfolio_publications(profile_id, is_public, year DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_pub_doi
  ON public.portfolio_publications(doi)
  WHERE doi IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS set_portfolio_pub_updated_at
  BEFORE UPDATE ON public.portfolio_publications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================================
-- TABLE: portfolio_certificates
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.portfolio_certificates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  profile_id UUID NOT NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  dataset_id UUID NOT NULL
    REFERENCES public.datasets(id) ON DELETE CASCADE,
  
  version_id UUID NOT NULL
    REFERENCES public.dataset_versions(id) ON DELETE CASCADE,
  
  verification_token_id UUID
    REFERENCES public.verification_tokens(id) ON DELETE SET NULL,
  
  -- Display
  display_title TEXT,
  context_note TEXT,
  
  -- Integrity markers snapshot
  dqi_score_snapshot INTEGER,
  supervisor_approved BOOLEAN NOT NULL DEFAULT false,
  assumption_checks_conducted BOOLEAN NOT NULL DEFAULT false,
  reentry_conducted BOOLEAN NOT NULL DEFAULT false,
  chain_verified BOOLEAN NOT NULL DEFAULT false,
  
  -- Visibility
  is_public BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cert_profile
  ON public.portfolio_certificates(profile_id, is_public);

CREATE INDEX IF NOT EXISTS idx_cert_dataset
  ON public.portfolio_certificates(dataset_id);

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

ALTER TABLE public.portfolio_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_certificates ENABLE ROW LEVEL SECURITY;

-- Public can read public publications
CREATE POLICY IF NOT EXISTS "Public can see public publications"
  ON public.portfolio_publications
  FOR SELECT
  USING (
    is_public = true
    AND profile_id IN (
      SELECT id FROM public.profiles
      WHERE portfolio_public = true
    )
  );

-- Owners see all their publications
CREATE POLICY IF NOT EXISTS "Owners see all publications"
  ON public.portfolio_publications
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

-- Owners manage publications
CREATE POLICY IF NOT EXISTS "Owners manage publications"
  ON public.portfolio_publications
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Owners update publications"
  ON public.portfolio_publications
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Owners delete publications"
  ON public.portfolio_publications
  FOR DELETE TO authenticated
  USING (profile_id = auth.uid());

-- Public can see public certificates
CREATE POLICY IF NOT EXISTS "Public can see public certificates"
  ON public.portfolio_certificates
  FOR SELECT
  USING (
    is_public = true
    AND profile_id IN (
      SELECT id FROM public.profiles
      WHERE portfolio_public = true
    )
  );

-- Owners see all certificates
CREATE POLICY IF NOT EXISTS "Owners see all certificates"
  ON public.portfolio_certificates
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

-- Owners manage certificates
CREATE POLICY IF NOT EXISTS "Owners manage certificates"
  ON public.portfolio_certificates
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Owners update certificates"
  ON public.portfolio_certificates
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Owners delete certificates"
  ON public.portfolio_certificates
  FOR DELETE TO authenticated
  USING (profile_id = auth.uid());
