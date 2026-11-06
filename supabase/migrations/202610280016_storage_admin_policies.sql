begin;

-- Consulter et télécharger les fichiers.
create policy sascoa_storage_admin_read
on storage.objects
for select
to authenticated
using (
    bucket_id in ('sascoa-media', 'sascoa-private')
    and exists (
        select 1
        from public.admin_profiles as p
        where p.user_id = (select auth.uid())
          and p.is_active = true
          and p.role in ('root', 'director')
    )
);

-- Ajouter de nouveaux fichiers.
create policy sascoa_storage_admin_insert
on storage.objects
for insert
to authenticated
with check (
    bucket_id in ('sascoa-media', 'sascoa-private')
    and exists (
        select 1
        from public.admin_profiles as p
        where p.user_id = (select auth.uid())
          and p.is_active = true
          and p.role in ('root', 'director')
    )
);

commit;