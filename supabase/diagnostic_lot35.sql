-- Lecture seule. Aucun GRANT, aucune création/modification/suppression de données.
select c.relname as table_name, c.relrowsecurity as rls_active,
  has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
  has_table_privilege('anon', c.oid, 'INSERT') as anon_insert,
  has_table_privilege('anon', c.oid, 'UPDATE') as anon_update,
  has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select,
  has_table_privilege('authenticated', c.oid, 'INSERT') as authenticated_insert,
  has_table_privilege('authenticated', c.oid, 'UPDATE') as authenticated_update,
  (select jsonb_agg(jsonb_build_object('name', p.policyname, 'roles', p.roles,
    'operation', p.cmd, 'using', p.qual, 'with_check', p.with_check))
   from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and c.relname in ('admin_profiles', 'activity_sectors', 'companies')
order by c.relname;

-- Les colonnes attendues par les éditeurs :
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('admin_profiles', 'activity_sectors', 'companies')
order by table_name, ordinal_position;

-- Paramètres et règles Storage existants :
select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id in ('sascoa-media', 'sascoa-private');
select policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'storage' and tablename = 'objects';
