-- Weekly payout automation: batches, building destinations, ledger/payment tracking

create table payout_batches (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id) on delete cascade,
  scheduled_for date not null,
  status text not null default 'pending' check (status in (
    'pending', 'processing', 'completed', 'failed', 'skipped'
  )),
  total_amount numeric not null default 0,
  payment_count int not null default 0,
  revolut_request_id text,
  revolut_transaction_id text,
  reference text,
  error_message text,
  created_at timestamptz default now(),
  completed_at timestamptz,
  unique (building_id, scheduled_for)
);

alter table buildings
  add column payout_enabled boolean not null default false,
  add column revolut_counterparty_id text,
  add column revolut_counterparty_account_id text,
  add column payout_iban text,
  add column payout_recipient_name text;

alter table payments
  add column collected_at timestamptz,
  add column paid_out_at timestamptz,
  add column payout_batch_id uuid references payout_batches(id) on delete set null;

alter table ledger
  add column collected_at timestamptz,
  add column paid_out_at timestamptz,
  add column payout_batch_id uuid references payout_batches(id) on delete set null;

create index idx_payments_pending_payout
  on payments(building_id, received_at desc)
  where matched and paid_out_at is null;

create index idx_payout_batches_building
  on payout_batches(building_id, scheduled_for desc);

create index idx_ledger_payout_pending
  on ledger(building_id)
  where collected_at is not null and paid_out_at is null;
