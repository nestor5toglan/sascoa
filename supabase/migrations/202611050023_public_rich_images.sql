begin;
-- Seuls les nouveaux fichiers image du dossier rich/ peuvent être référencés par le texte.
create policy sascoa_public_rich_images on storage.objects for select to anon,authenticated using (
 bucket_id='sascoa-media' and name ~ '^rich/[0-9a-f-]{36}\.(jpg|png|webp)$' and (
 exists(select 1 from public.content_entries c where c.status='published' and c.published_at<=now() and position(('data-media-path="'||name||'"') in c.body)>0)
 or exists(select 1 from public.companies c where c.status='published' and (position(('data-media-path="'||name||'"') in c.description)>0 or position(('data-media-path="'||name||'"') in coalesce(c.services,''))>0 or position(('data-media-path="'||name||'"') in coalesce(c.specificities,''))>0))
 or exists(select 1 from public.events e where e.status='published' and (position(('data-media-path="'||name||'"') in e.description)>0 or position(('data-media-path="'||name||'"') in coalesce(e.program_text,''))>0))
 ));
commit;
