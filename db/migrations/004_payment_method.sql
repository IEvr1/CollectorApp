-- Bank transfer payment method (bank transfer only)

alter table payments
  add column if not exists payment_method text not null default 'bank_transfer'
    check (payment_method = 'bank_transfer');
