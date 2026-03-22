-- ════════════════════════════════════════
-- Fix handle_new_user trigger
-- Add ON CONFLICT DO NOTHING and exception handling
-- to prevent "Database error saving new user" on signup
-- ════════════════════════════════════════

-- Also add INSERT policy on profiles so authenticated users can insert their own
-- (as a safety net alongside the SECURITY DEFINER trigger)
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- Rewrite handle_new_user with conflict handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't block signup
  RAISE WARNING 'handle_new_user failed for %: % %', NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;
