-- Indexes for the ways the OS and the phone app read data (until now only primary keys existed):
--   * sales and purchases are listed newest first, a page at a time, and filtered by date;
--   * the report adds up sales by order day and by the day the money came in;
--   * a customer's sales, and the sales/purchases of a product, are looked up by id.
create index idx_sales_date_created on sales (sale_date, created_at);
create index idx_sales_paid_on on sales (paid_on);
create index idx_sales_customer on sales (customer_id);
create index idx_sale_items_product on sale_items (product_id);
create index idx_purchases_date_created on purchases (purchase_date, created_at);
create index idx_purchase_items_product on purchase_items (product_id);
create index idx_customers_created on customers (created_at);
create index idx_products_created on products (created_at);
create index idx_sellers_created on sellers (created_at);
