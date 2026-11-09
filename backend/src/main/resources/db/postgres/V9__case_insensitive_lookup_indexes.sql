-- PostgreSQL only (the H2 test database has no expression indexes, so tests do not load this folder).
-- Website orders and cakes are matched to OS customers by lower(email) and to OS products by lower(name),
-- for every website order and on every cake sync; without these indexes each match scanned the table.
create index idx_customers_email_lower on customers (lower(email));
create index idx_products_name_lower on products (lower(name));
