-- Lecture seule ; ne contient pas les données personnelles des demandes.
select c.relname as table_name,c.relrowsecurity as rls_active
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('salon_preregistration_settings','salon_preregistrations');
select tablename,policyname,roles,cmd,qual,with_check from pg_policies
where schemaname='public' and tablename in ('salon_preregistration_settings','salon_preregistrations');
select table_name,grantee,privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name in ('salon_preregistration_settings','salon_preregistrations') and grantee in ('anon','authenticated');
select table_name,column_name,grantee,privilege_type from information_schema.column_privileges
where table_schema='public' and table_name in ('salon_preregistration_settings','salon_preregistrations') and grantee in ('anon','authenticated') and privilege_type='UPDATE';
select p.proname,p.prosecdef as security_definer,p.proacl from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('get_salon_preregistration','submit_salon_preregistration','prereg_touch');
select s.enabled,s.event_id,e.title,e.event_type,e.status,e.ends_at,s.notice_version from public.salon_preregistration_settings s left join public.events e on e.id=s.event_id;
select public.get_salon_preregistration() as public_configuration;
