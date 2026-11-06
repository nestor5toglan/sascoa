begin;

create table public.pitch_applications (
    id uuid primary key default gen_random_uuid(),

    reference text not null unique default (
        'PITCH-' || upper(gen_random_uuid()::text)
    ),

    -- Protection contre le double envoi du même formulaire.
    submission_key uuid not null unique,

    event_id uuid not null
        references public.events(id)
        on delete restrict,

    first_name text not null
        check (length(trim(first_name)) > 0),

    last_name text not null
        check (length(trim(last_name)) > 0),

    email text not null
        check (
            email = trim(email)
            and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
        ),

    phone text,

    project_name text not null
        check (length(trim(project_name)) > 0),

    project_description text not null
        check (length(trim(project_description)) > 0),

    sector_id uuid not null
        references public.activity_sectors(id)
        on delete restrict,

    activity_started_on date,
    innovation_and_business_model text,
    results_achieved text,
    support_needs text,

    website_url text
        check (
            website_url is null
            or website_url ~* '^https?://[^[:space:]]+$'
        ),

    terms_version text not null
        check (length(trim(terms_version)) > 0),

    terms_accepted_at timestamptz not null default now(),

    status text not null default 'received'
        check (
            status in (
                'received',
                'under_review',
                'shortlisted',
                'selected',
                'rejected'
            )
        ),

    internal_note text,
    decision_reason text,

    reviewed_by uuid
        references public.admin_profiles(user_id)
        on delete restrict,

    reviewed_at timestamptz,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint pitch_review_consistent
        check (
            (reviewed_by is null and reviewed_at is null)
            or
            (reviewed_by is not null and reviewed_at is not null)
        )
);

create index pitch_applications_event_status_idx
on public.pitch_applications (event_id, status);

create index pitch_applications_sector_id_idx
on public.pitch_applications (sector_id);

create index pitch_applications_created_at_idx
on public.pitch_applications (created_at desc);

create trigger pitch_applications_updated_at
before update on public.pitch_applications
for each row
execute function public.set_updated_at();

alter table public.pitch_applications
enable row level security;

-- Aucun accès direct pour les visiteurs.
revoke all on table public.pitch_applications
from public, anon, authenticated;

-- Lecture réservée aux administrateurs actifs.
grant select on public.pitch_applications
to authenticated;

create policy pitch_applications_admin_read
on public.pitch_applications
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

commit;