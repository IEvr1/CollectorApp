-- Dual payment methods: bank transfer (Business API) and payment link (Merchant API)

alter table payments
  add column if not exists payment_method text not null default 'bank_transfer'
    check (payment_method in ('bank_transfer', 'payment_link')),
  add column if not exists merchant_order_id text;

create unique index if not exists payments_merchant_order_id_key
  on payments (merchant_order_id)
  where merchant_order_id is not null;

create table if not exists payment_links (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  building_id uuid not null references buildings(id) on delete cascade,
  ledger_id uuid references ledger(id) on delete set null,
  month date not null,
  revolut_order_id text not null unique,
  checkout_url text not null,
  merchant_reference text not null,
  amount numeric not null,
  currency text not null default 'EUR',
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'cancelled', 'failed')),
  created_at timestamptz default now(),
  completed_at timestamptz
);

create index if not exists idx_payment_links_unit_month on payment_links (unit_id, month);

alter publication supabase_realtime add table payment_links;
