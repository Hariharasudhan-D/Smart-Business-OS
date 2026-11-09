-- The day the money came in. Pay later (Credit) sales have none until they are completed,
-- and they count towards sales and profit on that day, not on the day of the sale.
alter table sales add column paid_on date;
update sales set paid_on = sale_date where payment_mode <> 'Credit';
