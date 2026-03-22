-- ════════════════════════════════════════
-- Backfill profiles for auth.users created before
-- the on_auth_user_created trigger was applied.
-- Uses ON CONFLICT DO NOTHING so existing profiles
-- are never overwritten.
-- ════════════════════════════════════════

INSERT INTO profiles (id, email, full_name, avatar_url)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
  u.raw_user_meta_data->>'avatar_url'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;
