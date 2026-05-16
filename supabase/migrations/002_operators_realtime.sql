-- Operators (linked to Supabase Auth)
create table operators (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz default now()
);

-- Enable realtime
alter publication supabase_realtime add table ledger;
alter publication supabase_realtime add table payments;
alter publication supabase_realtime add table escalations;
