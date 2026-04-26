alter table profiles
  add column if not exists city text,
  add column if not exists country text,
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists show_on_globe boolean not null default true,
  add column if not exists last_seen_at timestamptz;
