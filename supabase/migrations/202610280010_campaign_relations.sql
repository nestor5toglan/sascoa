begin;

-- Entreprises associées aux campagnes.
create table public.campaign_companies (
    campaign_id uuid not null
        references public.campaigns(id)
        on delete restrict,

    company_id uuid not null
        references public.companies(id)
        on delete restrict,

    display_order integer not null default 0
        check (display_order >= 0),

    created_by uuid default auth.uid()
        references public.admin_profiles(user_id)
        on delete restrict,

    created_at timestamptz not null default now(),

    primary key (campaign_id, company_id)
);

create index campaign_companies_company_id_idx
on public.campaign_companies (company_id);

-- Événements associés aux campagnes.
create table public.campaign_events (
    campaign_id uuid not null
        references public.campaigns(id)
        on delete restrict,

    event_id uuid not null
        references public.events(id)
        on delete restrict,

    display_order integer not null default 0
        check (display_order >= 0),

    created_by uuid default auth.uid()
        references public.admin_profiles(user_id)
        on delete restrict,

    created_at timestamptz not null default now(),

    primary key (campaign_id, event_id)
);

create index campaign_events_event_id_idx
on public.campaign_events (event_id);

alter table public.campaign_companies
enable row level security;

alter table public.campaign_events
enable row level security;

revoke all on table
    public.campaign_companies,
    public.campaign_events
from public, anon, authenticated;

grant select on table
    public.campaign_companies,
    public.campaign_events
to anon, authenticated;

grant insert (campaign_id, company_id, display_order)
on public.campaign_companies to authenticated;

grant insert (campaign_id, event_id, display_order)
on public.campaign_events to authenticated;

grant update (display_order)
on public.campaign_companies to authenticated;

grant update (display_order)
on public.campaign_events to authenticated;

grant delete on table
    public.campaign_companies,
    public.campaign_events
to authenticated;

-- Le public voit uniquement les associations dont les deux
-- éléments sont publiés.
create policy campaign_companies_public_read
on public.campaign_companies
for select
to anon, authenticated
using (
    exists (
        select 1
        from public.campaigns as c
        where c.id = campaign_companies.campaign_id
          and c.status = 'published'
    )
    and exists (
        select 1
        from public.companies as e
        where e.id = campaign_companies.company_id
          and e.status = 'published'
    )
);

create policy campaign_events_public_read
on public.campaign_events
for select
to anon, authenticated
using (
    exists (
        select 1
        from public.campaigns as c
        where c.id = campaign_events.campaign_id
          and c.status = 'published'
    )
    and exists (
        select 1
        from public.events as e
        where e.id = campaign_events.event_id
          and e.status = 'published'
    )
);

-- Appliquer les mêmes règles administratives aux deux tables.
do $$
declare
    table_name text;

    admin_check text := '
        exists (
            select 1
            from public.admin_profiles as p
            where p.user_id = (select auth.uid())
              and p.is_active = true
              and p.role in (''root'', ''director'')
        )
    ';
begin
    foreach table_name in array array[
        'campaign_companies',
        'campaign_events'
    ]
    loop
        execute format(
            'create policy admin_read
             on public.%I
             for select to authenticated
             using (%s)',
            table_name, admin_check
        );

        execute format(
            'create policy admin_insert
             on public.%I
             for insert to authenticated
             with check (%s)',
            table_name, admin_check
        );

        execute format(
            'create policy admin_update
             on public.%I
             for update to authenticated
             using (%s)
             with check (%s)',
            table_name, admin_check, admin_check
        );

        execute format(
            'create policy admin_delete
             on public.%I
             for delete to authenticated
             using (%s)',
            table_name, admin_check
        );
    end loop;
end;
$$;

commit;