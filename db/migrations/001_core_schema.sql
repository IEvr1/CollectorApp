-- Core schema for CollectorApp

create extension if not exists "pgcrypto";

-- Buildings
create table buildings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  virtual_iban text unique,
  total_area_m2 numeric default 0,
  monthly_budget numeric default 0,
  reserve_fund_target numeric default 0,
  reserve_fund_current numeric default 0,
  reserve_contribution_per_unit numeric default 0,
  created_at timestamptz default now()
);

-- Units
create table units (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id) on delete cascade,
  unit_number text not null,
  owner_name text,
  email text,
  phone text,
  area_m2 numeric not null check (area_m2 > 0),
  share_percentage numeric default 0,
  floor integer,
  preferred_locale text default 'el' check (preferred_locale in ('el', 'en')),
  dashboard_public boolean default false,
  created_at timestamptz default now(),
  unique (building_id, unit_number)
);

-- Expenses
create table expenses (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id) on delete cascade,
  date date not null,
  category text not null check (category in (
    'electricity', 'water', 'elevator', 'cleaning', 'insurance', 'reserve', 'other'
  )),
  vendor text,
  amount numeric not null check (amount > 0),
  invoice_pdf_url text,
  extracted_by_ai boolean default false,
  approved boolean default true,
  created_at timestamptz default now()
);

-- Ledger
create table ledger (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  building_id uuid not null references buildings(id) on delete cascade,
  month date not null,
  line_type text default 'common_expense' check (line_type in ('common_expense', 'reserve_contribution')),
  amount_due numeric not null default 0,
  amount_paid numeric default 0,
  balance numeric generated always as (amount_due - amount_paid) stored,
  due_date date,
  payment_date timestamptz,
  payment_reference text,
  status text default 'pending' check (status in (
    'pending', 'paid', 'overdue', 'escalated', 'legal'
  )),
  created_at timestamptz default now(),
  unique (unit_id, month, line_type)
);

-- Escalations (Phase 2 ready)
create table escalations (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  ledger_id uuid not null references ledger(id) on delete cascade,
  level integer not null check (level between 1 and 6),
  triggered_at timestamptz default now(),
  message_sent boolean default false,
  next_action_date date,
  operator_approved boolean default false,
  resolved boolean default false,
  unique (ledger_id, level)
);

-- Payments
create table payments (
  id uuid primary key default gen_random_uuid(),
  building_id uuid references buildings(id) on delete cascade,
  unit_id uuid references units(id) on delete set null,
  ledger_id uuid references ledger(id) on delete set null,
  amount numeric not null,
  payment_reference text,
  revolut_transaction_id text unique,
  received_at timestamptz default now(),
  matched boolean default false
);

-- Notification log
create table notification_log (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid references units(id) on delete set null,
  ledger_id uuid references ledger(id) on delete set null,
  channel text not null check (channel in ('sms', 'email')),
  template_key text not null,
  recipient text not null,
  twilio_message_sid text,
  sendgrid_message_id text,
  status text default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
  error_message text,
  created_at timestamptz default now()
);

-- Partial unique for notification idempotency when ledger_id is set
create unique index notification_log_ledger_template_channel
  on notification_log (ledger_id, template_key, channel)
  where ledger_id is not null;

-- Recalculate building total_area_m2 and unit share_percentage
create or replace function refresh_building_areas()
returns trigger as $$
declare
  bid uuid;
  total numeric;
begin
  bid := coalesce(new.building_id, old.building_id);

  select coalesce(sum(area_m2), 0) into total
  from units where building_id = bid;

  update buildings set total_area_m2 = total where id = bid;

  update units u
  set share_percentage = case
    when total > 0 then round((u.area_m2 / total) * 100, 4)
    else 0
  end
  where u.building_id = bid;

  return coalesce(new, old);
end;
$$ language plpgsql;

create trigger units_area_changed
  after insert or update of area_m2, building_id or delete on units
  for each row execute function refresh_building_areas();
