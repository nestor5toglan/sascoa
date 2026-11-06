begin;

create table public.content_entries (
    id uuid primary key default gen_random_uuid(),

    content_type text not null
        check (content_type in ('page', 'news')),

    title text not null
        check (length(trim(title)) > 0),

    slug text not null unique
        check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),

    body text not null default '',
    summary text,
    cover_image_path text,

    -- Une actualité peut être associée à un événement.
    event_id uuid
        references public.events(id)
        on delete restrict,

    seo_title text,
    seo_description text,

    status text not null default 'draft'
        check (
            status in ('draft', 'published', 'archived')
        ),

    published_at timestamptz,

    created_by uuid
        references public.admin_profiles(user_id)
        on delete restrict,

    updated_by uuid
        references public.admin_profiles(user_id)
        on delete restrict,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint content_event_news_only
        check (
            event_id is null
            or content_type = 'news'
        ),

    constraint content_published_complete
        check (
            status <> 'published'
            or (
                length(trim(body)) > 0
                and published_at is not null
            )
        )
);

create index content_entries_type_status_date_idx
on public.content_entries (
    content_type,
    status,
    published_at desc
);

create index content_entries_event_id_idx
on public.content_entries (event_id);

create function public.set_content_entry_audit()
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

    -- Première publication : attribuer la date si elle manque.
    if new.status = 'published'
       and new.published_at is null then
        new.published_at = now();
    end if;

    return new;
end;
$$;

revoke all on function public.set_content_entry_audit()
from public, anon, authenticated;

create trigger content_entries_audit
before insert or update on public.content_entries
for each row
execute function public.set_content_entry_audit();

alter table public.content_entries
enable row level security;

revoke all on table public.content_entries
from public, anon, authenticated;

grant select on public.content_entries
to anon, authenticated;

-- Archivage plutôt que suppression depuis l'application.
grant insert, update on public.content_entries
to authenticated;

create policy content_entries_read
on public.content_entries
for select
to anon, authenticated
using (
    (
        status = 'published'
        and published_at <= now()
    )
    or exists (
        select 1
        from public.admin_profiles as p
        where p.user_id = (select auth.uid())
          and p.is_active = true
          and p.role in ('root', 'director')
    )
);

create policy content_entries_admin_insert
on public.content_entries
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

create policy content_entries_admin_update
on public.content_entries
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