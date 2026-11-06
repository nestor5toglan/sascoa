begin;

create table public.events (
    id uuid primary key default gen_random_uuid(),

    title text not null
        check (length(trim(title)) > 0),

    slug text not null unique
        check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),

    description text not null
        check (length(trim(description)) > 0),

    event_type text not null
        check (
            event_type in (
                'salon', 'forum', 'conference', 'other'
            )
        ),

    starts_at timestamptz not null,
    ends_at timestamptz not null,

    timezone text not null default 'Africa/Lome'
        check (length(trim(timezone)) > 0),

    location text,
    cover_image_path text,
    program_text text,
    program_pdf_path text,

    speakers jsonb not null default '[]'::jsonb
        check (jsonb_typeof(speakers) = 'array'),

    registrations_open boolean not null default false,
    registration_deadline timestamptz,

    is_demo boolean not null default false,

    status text not null default 'draft'
        check (
            status in ('draft', 'published', 'archived')
        ),

    created_by uuid default auth.uid()
        references public.admin_profiles(user_id)
        on delete restrict,

    updated_by uuid default auth.uid()
        references public.admin_profiles(user_id)
        on delete restrict,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint events_dates_valid
        check (ends_at > starts_at),

    constraint events_registration_deadline_valid
        check (
            registration_deadline is null
            or registration_deadline <= ends_at
        )
);

create index events_status_starts_at_idx
on public.events (status, starts_at);

-- Vérifier le fuseau et enregistrer les auteurs des changements.
create function public.set_event_audit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if not exists (
        select 1
        from pg_catalog.pg_timezone_names
        where name = new.timezone
    ) then
        raise exception 'Fuseau horaire invalide : %', new.timezone;
    end if;

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

revoke all on function public.set_event_audit()
from public, anon, authenticated;

create trigger events_audit
before insert or update on public.events
for each row
execute function public.set_event_audit();

alter table public.events
enable row level security;

revoke all on table public.events
from public, anon, authenticated;

grant select on public.events
to anon, authenticated;

-- Les événements seront archivés plutôt que supprimés.
grant insert, update on public.events
to authenticated;

create policy events_read
on public.events
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

create policy events_admin_insert
on public.events
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

create policy events_admin_update
on public.events
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