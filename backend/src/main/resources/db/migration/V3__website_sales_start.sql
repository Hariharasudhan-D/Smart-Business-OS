-- The OS starts from zero: every website order that exists when this runs is ignored,
-- and only orders placed afterwards (higher order numbers) count as sales.
-- Order numbers always go up, so this does not depend on time zones.
create table website_sync (
  after_order_id bigint not null
);
insert into website_sync (after_order_id) select coalesce(max(id), 0) from public.orders;
