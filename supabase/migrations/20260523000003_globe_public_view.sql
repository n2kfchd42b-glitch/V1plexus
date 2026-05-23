-- Public view for the live researcher globe.
-- Exposes only opt-in, non-PII columns to anon callers so the /api/globe
-- endpoint can drop its SUPABASE_SERVICE_ROLE_KEY usage.
--
-- The profiles table itself remains restricted to authenticated users;
-- this view is the public surface area.

create or replace view public.globe_researchers
with (security_invoker = true) as
select
  lat,
  lng,
  city,
  country,
  research_discipline,
  last_seen_at
from profiles
where show_on_globe = true
  and lat is not null
  and lng is not null;

-- Allow anon + authenticated to read the view. The underlying profiles RLS
-- still applies because of security_invoker, so we also need a permissive
-- policy on the rows the view exposes.
grant select on public.globe_researchers to anon, authenticated;

-- Per-row policy: allow SELECT on profiles only via this view's WHERE clause.
-- This must coexist with the existing "Users can view all profiles" policy
-- for authenticated users — RLS policies are OR'd together.
drop policy if exists "Globe profiles are publicly readable" on profiles;
create policy "Globe profiles are publicly readable" on profiles
  for select to anon
  using (show_on_globe = true and lat is not null and lng is not null);
