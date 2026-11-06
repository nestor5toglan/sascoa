-- Lot 36. Règles de lecture publique de content_entries et couvertures Pitch/Hackathon.
-- Aucune table recréée, aucun contenu inséré, aucun accès public à admin_profiles.
-- Les règles d'écriture administrateur existantes sont conservées.
begin;

do $$
declare p record;
begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'content_entries' and c.relrowsecurity
  ) then raise exception 'content_entries doit exister avec RLS activée. Vérifier les migrations précédentes.'; end if;

  -- Corriger la même dépendance admin_profiles que pour companies/events au lot 34.
  for p in select policyname, roles::text[] as roles from pg_policies
    where schemaname = 'public' and tablename = 'content_entries' and cmd = 'SELECT'
      and roles::text[] && array['anon','public'] and qual ilike '%admin_profiles%'
  loop
    if not p.roles <@ array['anon','authenticated','public'] then
      raise exception 'Politique personnalisée % : vérifier ses rôles avant adaptation.', p.policyname;
    end if;
    execute format('alter policy %I on public.content_entries to authenticated', p.policyname);
  end loop;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='content_entries' and policyname='content_entries_anon_published_v36') then
    create policy content_entries_anon_published_v36 on public.content_entries
      for select to anon using (status = 'published' and published_at <= now());
  else
    alter policy content_entries_anon_published_v36 on public.content_entries
      to anon using (status = 'published' and published_at <= now());
  end if;

  if not exists (select 1 from storage.buckets where id='sascoa-media' and public=false) then
    raise exception 'Le bucket sascoa-media doit exister et rester privé.';
  end if;

  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='sascoa_public_program_pages_media_v36') then
    create policy sascoa_public_program_pages_media_v36 on storage.objects
      for select to anon, authenticated using (
        bucket_id='sascoa-media' and exists (
          select 1 from public.content_entries c
          where c.content_type='page' and c.slug in ('pitch','hackathon')
            and c.status='published' and c.published_at <= now()
            and c.cover_image_path = storage.objects.name
        )
      );
  end if;
end;
$$;

-- La RLS ci-dessus limite les lignes ; cette permission n'accorde aucune écriture.
grant select on public.content_entries to anon, authenticated;
commit;

select tablename, policyname, roles, cmd, qual
from pg_policies
where (schemaname='public' and tablename='content_entries')
   or (schemaname='storage' and policyname='sascoa_public_program_pages_media_v36')
order by tablename, policyname;
