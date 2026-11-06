begin;

create table public.media_assets (
    id uuid primary key default gen_random_uuid(),

    title text not null
        check (length(trim(title)) > 0),

    media_type text not null
        check (
            media_type in ('image', 'document', 'video')
        ),

    description text,
    alt_text text,

    -- Images et documents : chemin dans Supabase Storage.
    storage_path text
        check (
            storage_path is null
            or length(trim(storage_path)) > 0
        ),

    -- Vidéos : lien externe.
    external_url text
        check (
            external_url is null
            or external_url ~* '^https?://[^[:space:]]+$'
        ),

    mime_type text,

    file_size_bytes bigint
        check (
            file_size_bytes is null
            or file_size_bytes >= 0
        ),

    event_id uuid
        references public.events(id)
        on delete restrict,

    display_order integer not null default 0
        check (display_order >= 0),

    visibility text not null default 'private'
        check (
            visibility in ('private', 'public')
        ),

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

    constraint media_assets_source_valid
        check (
            (
                media_type in ('image', 'document')
                and storage_path is not null
                and external_url is null
            )
            or
            (
                media_type = 'video'
                and external_url is not null
                and storage_path is null
            )
        )
);

create index media_assets_visibility_status_idx
on public.media_assets (visibility, status);

create index media_assets_event_order_idx
on public.media_assets (event_id, display_order);

create function public.set_media_asset_audit()
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

revoke all on function public.set_media_asset_audit()
from public, anon, authenticated;

create trigger media_assets_audit
before insert or update on public.media_assets
for each row
execute function public.set_media_asset_audit();

alter table public.media_assets
enable row level security;

revoke all on table public.media_assets
from public, anon, authenticated;

grant select on public.media_assets
to anon, authenticated;

-- Archivage plutôt que suppression depuis l'application.
grant insert, update on public.media_assets
to authenticated;

create policy media_assets_read
on public.media_assets
for select
to anon, authenticated
using (
    (
        visibility = 'public'
        and status = 'published'
        and (
            event_id is null
            or exists (
                select 1
                from public.events as e
                where e.id = media_assets.event_id
                  and e.status = 'published'
            )
        )
    )
    or exists (
        select 1
        from public.admin_profiles as p
        where p.user_id = (select auth.uid())
          and p.is_active = true
          and p.role in ('root', 'director')
    )
);

create policy media_assets_admin_insert
on public.media_assets
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

create policy media_assets_admin_update
on public.media_assets
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