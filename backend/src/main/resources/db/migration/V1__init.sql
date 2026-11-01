create table products (
  id            uuid primary key,
  name          varchar(200)  not null,
  sku           varchar(60)   not null unique,
  cost_price    numeric(12,2) not null,
  selling_price numeric(12,2) not null,
  qty           integer       not null default 0,
  reorder_level integer       not null default 10,
  unit          varchar(20)   not null,
  kind          varchar(20)   not null,
  image         varchar(2048) not null default '',
  created_at    timestamp     not null
);

create table sellers (
  id         uuid primary key,
  name       varchar(200) not null,
  phone      varchar(40)  not null default '',
  email      varchar(200) not null default '',
  address    varchar(500) not null default '',
  gstin      varchar(30)  not null default '',
  created_at timestamp    not null
);

create table customers (
  id         uuid primary key,
  name       varchar(200) not null,
  phone      varchar(40)  not null default '',
  email      varchar(200) not null default '',
  address    varchar(500) not null default '',
  type       varchar(20)  not null,
  created_at timestamp    not null
);

create table purchases (
  id         uuid primary key,
  purchase_date date       not null,
  supplier   varchar(200)  not null,
  invoice_no varchar(80)   not null,
  tax_rate   numeric(5,2)  not null default 0,
  subtotal   numeric(12,2) not null,
  tax        numeric(12,2) not null,
  total      numeric(12,2) not null,
  created_at timestamp     not null
);

create table purchase_items (
  purchase_id uuid          not null references purchases (id) on delete cascade,
  product_id  uuid          not null,
  qty         integer       not null,
  unit_cost   numeric(12,2) not null
);
create index idx_purchase_items_purchase on purchase_items (purchase_id);

create sequence invoice_seq start with 1;

create table sales (
  id           uuid primary key,
  invoice_no   varchar(40)   not null unique,
  sale_date    date          not null,
  customer_id  uuid          not null references customers (id),
  subtotal     numeric(12,2) not null,
  discount     numeric(12,2) not null,
  total        numeric(12,2) not null,
  payment_mode varchar(20)   not null,
  created_at   timestamp     not null
);

create table sale_items (
  sale_id    uuid          not null references sales (id) on delete cascade,
  product_id uuid          not null,
  qty        integer       not null,
  price      numeric(12,2) not null,
  discount   numeric(5,2)  not null default 0
);
create index idx_sale_items_sale on sale_items (sale_id);
