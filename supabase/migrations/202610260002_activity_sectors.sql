begin;

create table public.activity_sectors (
    id uuid primary key default gen_random_uuid(),

    name text not null,
    slug text not null unique,
    description text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint activity_sector_name_not_empty
        check (length(trim(name)) > 0),

    constraint activity_sector_slug_format
        check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

-- Empêcher les doublons de nom, même avec une casse différente.
create unique index activity_sectors_name_unique
on public.activity_sectors (lower(trim(name)));

-- Réutiliser la fonction créée à l'étape 8.
create trigger activity_sectors_updated_at
before update on public.activity_sectors
for each row
execute function public.set_updated_at();

alter table public.activity_sectors
enable row level security;

revoke all on table public.activity_sectors
from public, anon, authenticated;

-- Les secteurs sont consultables dans l'annuaire public.
grant select on public.activity_sectors
to anon, authenticated;

-- Les opérations d'écriture restent soumises aux règles ci-dessous.
grant insert, update, delete on public.activity_sectors
to authenticated;

create policy activity_sectors_public_read
on public.activity_sectors
for select
to anon, authenticated
using (true);

create policy activity_sectors_admin_insert
on public.activity_sectors
for insert
to authenticated
with check (
    exists (
        select 1
        from public.admin_profiles as p
        where p.user_id = (select auth.uid())
          and p.is_active = true
          and p.role in ('root', 'director')
    )
);

create policy activity_sectors_admin_update
on public.activity_sectors
for update
to authenticated
using (
    exists (
        select 1
        from public.admin_profiles as p
        where p.user_id = (select auth.uid())
          and p.is_active = true
          and p.role in ('root', 'director')
    )
)
with check (
    exists (
        select 1
        from public.admin_profiles as p
        where p.user_id = (select auth.uid())
          and p.is_active = true
          and p.role in ('root', 'director')
    )
);

create policy activity_sectors_admin_delete
on public.activity_sectors
for delete
to authenticated
using (
    exists (
        select 1
        from public.admin_profiles as p
        where p.user_id = (select auth.uid())
          and p.is_active = true
          and p.role in ('root', 'director')
    )
);

commit;