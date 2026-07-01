-- Operators with local password auth (Neon Postgres)
create table operators (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  password_hash text not null,
  created_at timestamptz default now()
);
