-- ============================================================================================
-- OPTIONAL, run by hand once (NOT a Flyway migration): a database login for the OS backend that
-- can only do what the OS needs, instead of the all-powerful "postgres" user.
--
--   * full control of the OS's own schema "os" (its tables, and future migrations);
--   * READ-ONLY access to the four website tables the OS reads (users, orders, order_items, cakes);
--   * nothing else: it cannot change website data, read other website tables, or manage the database.
--
-- How to use (Supabase):
--   1. Supabase dashboard > SQL Editor, paste this file, replace CHANGE_ME with a long random
--      password (e.g. 40+ characters from a password manager), run it.
--   2. In backend/.env (and in Render's environment): set
--        DB_USERNAME=os_backend.<your-project-ref>    (the pooler needs the ".<project-ref>" suffix,
--                                                      like your current postgres.<project-ref>)
--        DB_PASSWORD=<the password from step 1>
--   3. Restart the backend and check that it signs in and loads Home. To undo: switch .env back.
-- ============================================================================================

create role os_backend login password 'CHANGE_ME' noinherit;

-- The OS schema becomes os_backend's own, so it can run future migrations (create/alter tables).
alter schema os owner to os_backend;
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'os' loop
    execute format('alter table os.%I owner to os_backend', r.tablename);
  end loop;
  for r in select sequence_name from information_schema.sequences where sequence_schema = 'os' loop
    execute format('alter sequence os.%I owner to os_backend', r.sequence_name);
  end loop;
end $$;

-- Website data: read only, and only the tables the OS uses.
grant usage on schema public to os_backend;
grant select on public.users, public.orders, public.order_items, public.cakes to os_backend;

-- Recommended on the website side as well (speeds up every website-sales and report query):
--   create index if not exists idx_order_items_order on public.order_items (order_id);
