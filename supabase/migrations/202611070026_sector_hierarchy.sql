begin;

-- Les secteurs actuels deviennent des racines, sans déplacer les entreprises.
alter table public.activity_sectors add column parent_id uuid;
alter table public.activity_sectors add constraint activity_sectors_parent_fk
  foreign key(parent_id) references public.activity_sectors(id) on delete restrict;
alter table public.activity_sectors add constraint activity_sectors_not_own_parent
  check(parent_id is distinct from id);
create index activity_sectors_parent_idx on public.activity_sectors(parent_id);

-- Une ligne de garde sérialise toutes les modifications de parent. L'écriture
-- impose aussi un conflit de sérialisation aux snapshots REPEATABLE READ anciens.
create table public.activity_sector_tree_guard (
  singleton boolean primary key default true check(singleton),
  revision bigint not null default 0
);
insert into public.activity_sector_tree_guard(singleton) values(true);
alter table public.activity_sector_tree_guard enable row level security;
revoke all on public.activity_sector_tree_guard from public,anon,authenticated;
-- La fonction de trigger ne modifie que cette garde ; le droit de modifier
-- les secteurs reste contrôlé par les politiques RLS existantes.

create function public.check_activity_sector_parent() returns trigger
language plpgsql volatile security definer set search_path = pg_catalog, public as $$
begin
  update public.activity_sector_tree_guard set revision = revision + 1 where singleton;
  if new.parent_id is null then return new; end if;
  if new.parent_id = new.id then
    raise exception 'Un secteur ne peut pas être son propre parent.' using errcode='23514';
  end if;
  if exists (
    with recursive ancestors as (
      select s.id, s.parent_id from public.activity_sectors s where s.id = new.parent_id
      union
      select s.id, s.parent_id from public.activity_sectors s join ancestors a on s.id = a.parent_id
    ) select 1 from ancestors where id = new.id
  ) then
    raise exception 'Ce parent appartient aux descendants du secteur. Choisissez une autre branche.' using errcode='23514';
  end if;
  return new;
end $$;
revoke all on function public.check_activity_sector_parent() from public, anon, authenticated;
create trigger activity_sectors_check_parent
  before insert or update of parent_id on public.activity_sectors
  for each row execute function public.check_activity_sector_parent();

-- Recherche de tout un sous-arbre côté PostgreSQL : pagination et comptage
-- cohérents, pas de longue liste d'identifiants dans l'URL publique.
create function public.search_public_companies_by_sector(
  p_sector uuid, p_search text default '', p_page integer default 1, p_size integer default 9
) returns jsonb language sql stable security invoker
set search_path = pg_catalog, public as $$
  with recursive descendants as (
    select s.id from public.activity_sectors s where s.id = p_sector
    union
    select s.id from public.activity_sectors s join descendants d on s.parent_id = d.id
  ), filtered as materialized (
    select c.id,c.name,c.slug,c.description,c.sector_id,c.structure_type,c.services,
      c.specificities,c.logo_path,c.address,c.phone,c.public_email,c.website_url,
      jsonb_build_object('name',s.name) as sector
    from public.companies c
    join public.activity_sectors s on s.id = c.sector_id
    where c.status = 'published' and c.sector_id in (select id from descendants)
      and (coalesce(p_search,'') = '' or
        position(lower(left(p_search,100)) in lower(concat_ws(' ',c.name,c.description,c.services))) > 0)
  ), page_rows as (
    select * from filtered order by name,id
    offset ((greatest(coalesce(p_page,1),1)::bigint-1)*least(greatest(coalesce(p_size,9),1),100))
    limit least(greatest(coalesce(p_size,9),1),100)
  )
  select jsonb_build_object(
    'items',coalesce((select jsonb_agg(to_jsonb(p) order by p.name,p.id) from page_rows p),'[]'::jsonb),
    'count',(select count(*) from filtered)
  );
$$;
revoke all on function public.search_public_companies_by_sector(uuid,text,integer,integer) from public;
grant execute on function public.search_public_companies_by_sector(uuid,text,integer,integer) to anon,authenticated;
-- RLS et droits existants inchangés. Aucun accès aux dossiers ou médias privés.
commit;

-- Contrôles à exécuter après la migration.
select column_name,data_type from information_schema.columns
where table_schema='public' and table_name='activity_sectors' and column_name='parent_id';
select policyname,roles,cmd from pg_policies where schemaname='public' and tablename='activity_sectors';
