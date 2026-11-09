-- Cakes sold by weight (1.5 kg) or by pieces, an optional typed line amount,
-- and home delivery with a delivery charge that is kept out of the sale total.
alter table sale_items alter column qty set data type numeric(10,3);
alter table sale_items add column unit varchar(10) not null default 'pcs';
alter table sale_items add column amount numeric(12,2);
alter table sales add column delivery_type varchar(20) not null default 'PICKUP';
alter table sales add column delivery_charge numeric(12,2) not null default 0;
