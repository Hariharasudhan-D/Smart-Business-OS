-- Pay later no longer exists. Sales that were still marked Pay later become normal Cash sales,
-- counted on their sale day (never later than today).
update sales
set payment_mode = 'Cash',
    paid_on = case when sale_date > current_date then current_date else sale_date end
where payment_mode = 'Credit';
update sales set paid_on = case when sale_date > current_date then current_date else sale_date end where paid_on is null;
