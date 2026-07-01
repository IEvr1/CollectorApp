create index idx_units_building on units(building_id);
create index idx_ledger_building_month on ledger(building_id, month);
create index idx_ledger_status on ledger(status) where status != 'paid';
create index idx_payments_building on payments(building_id, received_at desc);
create index idx_expenses_building on expenses(building_id, date desc);
create index idx_escalations_pending on escalations(resolved) where not resolved;
