begin;

create table public.campaigns (
    id uuid primary key default gen_random_uuid(),

    title text not null
        check (length(trim(title)) > 0),

    slug text not null unique
        check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),

    campaign_type text not null
        check (
            campaign_type in ('custom', 'thematic')
        ),

    description text not null
        check (length(trim(description)) > 0),

    banner_image_path text,

    starts_at timestamptz,
    ends_at timestamptz,

    status text not null default 'draft'
        check (
            status in ('draft', 'published', 'archived')
        ),

    created_by uuid
        references public.admin_profiles(user_id)
        on delete restrict,

    updated_by uuid
        references public.admin_profiles(user_id)
        on delete restrict,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint campaigns_dates_valid
        check (
            starts_at is null
            or ends_at is null
            or ends_at > starts_at
        )
);

create index campaigns_type_status_idx
on public.campaigns (campaign_type, status);

create function public.set_campaign_audit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if TG_OP = 'INSERT' then
        new.created_by = auth.uid();
        new.created_at = now();
    else
        new.created_by = old.created_by;
        new.created_at = old.created_at;
    end if;

    new.updated_by = auth.uid();
    new.updated_at = now();

    return new;
end;
$$;

revoke all on function public.set_campaign_audit()
from public, anon, authenticated;

create trigger campaigns_audit
before insert or update on public.campaigns
for each row
execute function public.set_campaign_audit();

alter table public.campaigns
enable row level security;

revoke all on table public.campaigns
from public, anon, authenticated;

grant select on public.campaigns
to anon, authenticated;

-- Archivage plutôt que suppression depuis l'application.
grant insert, update on public.campaigns
to authenticated;

create policy campaigns_read
on public.campaigns
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

create policy campaigns_admin_insert
on public.campaigns
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

create policy campaigns_admin_update
on public.campaigns
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