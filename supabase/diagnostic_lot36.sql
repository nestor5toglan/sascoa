-- Lecture seule, si une erreur de colonne ou de permission apparaît.
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema='public' and table_name in ('events','content_entries')
order by table_name, ordinal_position;
select c.relname, c.relrowsecurity,
  has_table_privilege('anon',c.oid,'SELECT') as anon_select,
  has_table_privilege('authenticated',c.oid,'SELECT') as authenticated_select,
  has_table_privilege('authenticated',c.oid,'INSERT') as authenticated_insert,
  has_table_privilege('authenticated',c.oid,'UPDATE') as authenticated_update
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('events','content_entries');
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname='public' and tablename in ('events','content_entries');
