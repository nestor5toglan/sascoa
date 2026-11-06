begin;

create table public.companies (
    id uuid primary key default gen_random_uuid(),

    name text not null
        check (length(trim(name)) > 0),

    slug text not null unique
        check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),

    description text not null
        check (length(trim(description)) > 0),

    sector_id uuid not null
        references public.activity_sectors(id)
        on delete restrict,

    structure_type text not null
        check (
            structure_type in ('private', 'public', 'individual')
        ),

    services text,
    specificities text,
    logo_path text,
    address text,
    phone text,
    public_email text,

    website_url text
        check (
            website_url is null
            or website_url ~* '^https?://[^[:space:]]+$'
        ),

    social_links jsonb not null default '[]'::jsonb
        check (jsonb_typeof(social_links) = 'array'),

    status text not null default 'draft'
        check (status in ('draft', 'published', 'archived')),

    created_by uuid default auth.uid()
        references public.admin_profiles(user_id)
        on delete restrict,

    updated_by uuid default auth.uid()
        references public.admin_profiles(user_id)
        on delete restrict,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index companies_sector_id_idx
on public.companies (sector_id);

create index companies_status_name_idx
on public.companies (status, name);

-- Enregistrer l'auteur des changements effectués depuis l'application.
create function public.set_company_audit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if TG_OP = 'INSERT' then
        new.created_by = auth.uid();
        new.updated_by = auth.uid();
        new.created_at = now();
    else
        new.created_by = old.created_by;
        new.created_at = old.created_at;
        new.updated_by = auth.uid();
    end if;

    new.updated_at = now();
    return new;
end;
$$;

revoke all on function public.set_company_audit()
from public, anon, authenticated;

create trigger companies_audit
before insert or update on public.companies
for each row
execute function public.set_company_audit();

alter table public.companies
enable row level security;

revoke all on table public.companies
from public, anon, authenticated;

grant select on public.companies
to anon, authenticated;

-- Pas de suppression définitive depuis l'application :
-- les administrateurs pourront archiver les fiches.
grant insert, update on public.companies
to authenticated;

create policy companies_read
on public.companies
for select
to anon, authenticated
using (
    status = 'published'
    or exists (
        select 1
        from public.admin_profiles as p
        where p.user_id = (select auth.uid())
          and p.is_active = true
          and p.role in ('root', 'director')
    )
);

create policy companies_admin_insert
on public.companies
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

create policy companies_admin_update
on public.companies
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

commit;