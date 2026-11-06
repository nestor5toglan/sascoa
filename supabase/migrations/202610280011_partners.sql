begin;

create table public.partners (
    id uuid primary key default gen_random_uuid(),

    name text not null
        check (length(trim(name)) > 0),

    category text not null
        check (length(trim(category)) > 0),

    description text,
    logo_path text,

    website_url text
        check (
            website_url is null
            or website_url ~* '^https?://[^[:space:]]+$'
        ),

    display_order integer not null default 0
        check (display_order >= 0),

    is_visible boolean not null default false,

    created_by uuid
        references public.admin_profiles(user_id)
        on delete restrict,

    updated_by uuid
        references public.admin_profiles(user_id)
        on delete restrict,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index partners_visibility_order_idx
on public.partners (is_visible, display_order, name);

create function public.set_partner_audit()
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

revoke all on function public.set_partner_audit()
from public, anon, authenticated;

create trigger partners_audit
before insert or update on public.partners
for each row
execute function public.set_partner_audit();

alter table public.partners
enable row level security;

revoke all on table public.partners
from public, anon, authenticated;

grant select on public.partners
to anon, authenticated;

-- Un partenaire peut être masqué plutôt que supprimé.
grant insert, update on public.partners
to authenticated;

create policy partners_read
on public.partners
for select
to anon, authenticated
using (
    is_visible = true
    or exists (
        select 1
        from public.admin_profiles as p
        where p.user_id = (select auth.uid())
          and p.is_active = true
          and p.role in ('root', 'director')
    )
);

create policy partners_admin_insert
on public.partners
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

create policy partners_admin_update
on public.partners
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