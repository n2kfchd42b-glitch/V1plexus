-- ════════════════════════════════════════
-- PLEXUS Research Lab — Seed Data
-- ════════════════════════════════════════
-- Run after a user signs up to set up demo data.
-- Replace 'your-email@example.com' with your actual email.

-- Demo institution
INSERT INTO institutions (id, name, slug)
VALUES ('11111111-1111-1111-1111-111111111111', 'University of Ghana School of Public Health', 'ug-sph')
ON CONFLICT (id) DO NOTHING;

-- Demo departments
INSERT INTO departments (institution_id, name, slug, description) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Epidemiology', 'epidemiology', 'Department of Epidemiology and Disease Control'),
  ('11111111-1111-1111-1111-111111111111', 'Biostatistics', 'biostatistics', 'Department of Biostatistics'),
  ('11111111-1111-1111-1111-111111111111', 'Population & Family Health', 'pop-family-health', 'Department of Population, Family, and Reproductive Health')
ON CONFLICT (institution_id, slug) DO NOTHING;

-- After a user signs up, manually assign them to the institution:
-- UPDATE profiles SET institution_id = '11111111-1111-1111-1111-111111111111' WHERE email = 'your-email@example.com';
-- INSERT INTO user_roles (user_id, role, institution_id)
--   SELECT id, 'institution_admin', '11111111-1111-1111-1111-111111111111'
--   FROM profiles WHERE email = 'your-email@example.com';
