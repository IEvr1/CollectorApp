-- Remove Revolut Merchant / card payment link support (bank transfer only)

drop table if exists payment_links;

drop index if exists payments_merchant_order_id_key;

alter table payments drop column if exists merchant_order_id;

update payments set payment_method = 'bank_transfer' where payment_method = 'payment_link';

alter table payments drop constraint if exists payments_payment_method_check;

alter table payments
  alter column payment_method set default 'bank_transfer',
  add constraint payments_payment_method_check check (payment_method = 'bank_transfer');
