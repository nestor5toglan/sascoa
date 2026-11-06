begin;

create table public.event_partners (
    event_id uuid not null
        references public.events(id)
        on delete restrict,

    partner_id uuid not null
        references public.partners(id)
        on delete restrict,

    -- Catégorie propre à cet événement, si différente
    -- de la catégorie générale du partenaire.
    partnership_category text
        check (
            partnership_category is null
            or length(trim(partnership_category)) > 0
        ),

    display_order integer not null default 0
        check (display_order >= 0),

    created_by uuid default auth.uid()
        references public.admin_profiles(user_id)
        on delete restrict,

    created_at timestamptz not null default now(),

    primary key (event_id, partner_id)
);

create index event_partners_partner_id_idx
on public.event_partners (partner_id);

create index event_partners_event_order_idx
on public.event_partners (event_id, display_order);

alter table public.event_partners
enable row level security;

revoke all on table public.event_partners
from public, anon, authenticated;

grant select on public.event_partners
to anon, authenticated;

grant insert (
    event_id,
    partner_id,
    partnership_category,
    display_order
)
on public.event_partners
to authenticated;

grant update (
    partnership_category,
    display_order
)
on public.event_partners
to authenticated;

grant delete on public.event_partners
to authenticated;

-- Le public voit seulement les associations entre
-- un événement publié et un partenaire visible.
create policy event_partners_public_read
on public.event_partners
for select
to anon, authenticated
using (
    exists (
        select 1
        from public.events as e
        where e.id = event_partners.event_id
          and e.status = 'published'
    )
    and exists (
        select 1
        from public.partners as p
        where p.id = event_partners.partner_id
          and p.is_visible = true
    )
);

create policy event_partners_admin_read
on public.event_partners
for select
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

create policy event_partners_admin_insert
on public.event_partners
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

create policy event_partners_admin_update
on public.event_partners
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

create policy event_partners_admin_delete
on public.event_partners
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