begin;

create table public.participation_requests (
    id uuid primary key default gen_random_uuid(),

    reference text not null unique default (
        'SAS-' || upper(gen_random_uuid()::text)
    ),

    -- La même clé sera réutilisée lors d'une nouvelle tentative
    -- d'envoi du même formulaire pour éviter un doublon.
    submission_key uuid not null unique,

    event_id uuid not null
        references public.events(id)
        on delete restrict,

    participant_type text not null
        check (
            participant_type in (
                'visitor', 'exhibitor', 'partner', 'press'
            )
        ),

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
    organization text,
    job_title text,
    message text,

    -- Souhaits exprimés par l'exposant.
    requested_stand_type text,

    requested_stand_area numeric(10, 2)
        check (
            requested_stand_area is null
            or requested_stand_area > 0
        ),

    requested_stand_options text,

    -- Attribution renseignée uniquement par l'administration.
    assigned_stand_number text,
    assigned_stand_details text,

    terms_version text not null
        check (length(trim(terms_version)) > 0),

    terms_accepted_at timestamptz not null default now(),

    status text not null default 'received'
        check (
            status in (
                'received',
                'under_review',
                'accepted',
                'rejected',
                'cancelled'
            )
        ),

    -- NULL : montant pas encore déterminé.
    -- Zéro : participation sans frais.
    amount_due numeric(14, 2)
        check (
            amount_due is null
            or amount_due >= 0
        ),

    currency text not null default 'XOF'
        check (currency ~ '^[A-Z]{3}$'),

    internal_note text,
    decision_reason text,

    reviewed_by uuid
        references public.admin_profiles(user_id)
        on delete restrict,

    reviewed_at timestamptz,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint participation_organization_required
        check (
            participant_type = 'visitor'
            or (
                organization is not null
                and length(trim(organization)) > 0
            )
        ),

    constraint participation_review_consistent
        check (
            (reviewed_by is null and reviewed_at is null)
            or
            (reviewed_by is not null and reviewed_at is not null)
        )
);

create index participation_requests_event_status_idx
on public.participation_requests (event_id, status);

create index participation_requests_created_at_idx
on public.participation_requests (created_at desc);

create trigger participation_requests_updated_at
before update on public.participation_requests
for each row
execute function public.set_updated_at();

alter table public.participation_requests
enable row level security;

-- Aucun accès direct pour les visiteurs.
revoke all on table public.participation_requests
from public, anon, authenticated;

-- Lecture administrative uniquement pour cette étape.
grant select on public.participation_requests
to authenticated;

create policy participation_requests_admin_read
on public.participation_requests
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