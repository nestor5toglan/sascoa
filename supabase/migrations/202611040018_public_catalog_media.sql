-- Lot 34 : lecture des seuls fichiers utilisés par les trois pages publiques.
-- À appliquer UNE FOIS dans SQL Editor, après les migrations 1 à 17 existantes.
-- Les migrations existantes ne sont pas incluses dans cette livraison.
-- Ne change ni le statut des buckets, ni les permissions d'écriture.
begin;

do $$
begin
  if not exists (
    select 1 from storage.buckets where id = 'sascoa-media' and public = false
  ) then
    raise exception 'Le bucket sascoa-media doit exister et rester privé.';
  end if;
end;
$$;

create policy sascoa_public_catalog_media_read
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'sascoa-media'
  and (
    exists (
      select 1 from public.companies c
      where c.status = 'published'
        and c.logo_path = storage.objects.name
    )
    or exists (
      select 1 from public.events e
      where e.status = 'published'
        and (
          e.cover_image_path = storage.objects.name
          or e.program_pdf_path = storage.objects.name
        )
    )
    or exists (
      select 1 from public.partners p
      where p.is_visible = true
        and p.logo_path = storage.objects.name
    )
  )
);

commit;

-- Vérifications en lecture seule :
select id, public from storage.buckets
where id in ('sascoa-media', 'sascoa-private');

select policyname, roles, cmd, qual from pg_policies
where schemaname = 'storage' and tablename = 'objects';

-- Le bucket sascoa-private ne reçoit AUCUNE règle supplémentaire.
-- Une URL déjà signée reste utilisable jusqu'à son expiration (1 heure).
-- Un fichier référencé dans une fiche publique est intentionnellement lisible
-- publiquement. Ne jamais réutiliser le chemin d'un document confidentiel.
-- Les tables sources conservent leurs RLS existantes ; aucun SECURITY DEFINER.
