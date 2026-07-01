-- Collector groups: generic org types, flexible split methods, member weights

alter table buildings
  add column if not exists group_type text not null default 'building'
    check (group_type in ('building', 'school', 'association', 'other')),
  add column if not exists split_method text not null default 'by_area'
    check (split_method in ('by_area', 'equal', 'custom_weight'));

alter table units
  add column if not exists weight numeric default 1 check (weight > 0);

alter table units alter column area_m2 drop not null;

alter table units drop constraint if exists units_area_m2_check;
alter table units add constraint units_area_or_equal check (
  area_m2 is null or area_m2 > 0
);

-- Generic expense categories for collector use cases
update expenses set category = 'utilities' where category in ('electricity', 'water', 'elevator');
update expenses set category = 'maintenance' where category in ('cleaning', 'reserve');
update expenses set category = 'other' where category not in (
  'maintenance', 'utilities', 'dues', 'event', 'insurance', 'other'
);

alter table expenses drop constraint if exists expenses_category_check;
alter table expenses add constraint expenses_category_check check (category in (
  'maintenance', 'utilities', 'dues', 'event', 'insurance', 'other'
));
