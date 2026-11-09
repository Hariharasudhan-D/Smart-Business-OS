-- One-time cleanup (2026-11-01): remove the sales typed into the OS before website orders were linked.
-- Only the OS's own tables (schema os) are touched; website orders stay. Line items go with their sale.
delete from sales;
alter sequence invoice_seq restart with 1;
