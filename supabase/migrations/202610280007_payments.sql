begin;

create table public.payments (
    id uuid primary key default gen_random_uuid(),

    participation_request_id uuid not null
        references public.participation_requests(id)
        on delete restrict,

    -- Identifiant conservé lors d'une nouvelle tentative
    -- d'enregistrement du même versement.
    submission_key uuid not null unique,

    amount numeric(14, 2) not null
        check (amount > 0),

    currency text not null default 'XOF'
        check (currency ~ '^[A-Z]{3}$'),

    payment_method text not null
        check (
            payment_method in (
                'bank_transfer',
                'cash',
                'mobile_money',
                'card',
                'other'
            )
        ),

    paid_on date not null,
    transaction_reference text,

    status text not null default 'pending'
        check (
            status in ('pending', 'confirmed', 'cancelled')
        ),

    internal_note text,

    created_by uuid not null
        references public.admin_profiles(user_id)
        on delete restrict,

    confirmed_by uuid
        references public.admin_profiles(user_id)
        on delete restrict,

    confirmed_at timestamptz,

    cancelled_by uuid
        references public.admin_profiles(user_id)
        on delete restrict,

    cancelled_at timestamptz,
    cancellation_reason text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint payments_confirmation_pair
        check (
            (confirmed_by is null and confirmed_at is null)
            or
            (confirmed_by is not null and confirmed_at is not null)
        ),

    constraint payments_confirmed_requires_author
        check (
            status <> 'confirmed'
            or (
                confirmed_by is not null
                and confirmed_at is not null
            )
        ),

    constraint payments_pending_not_confirmed
        check (
            status <> 'pending'
            or (
                confirmed_by is null
                and confirmed_at is null
            )
        ),

    constraint payments_cancellation_consistent
        check (
            (
                status = 'cancelled'
                and cancelled_by is not null
                and cancelled_at is not null
                and cancellation_reason is not null
                and length(trim(cancellation_reason)) > 0
            )
            or
            (
                status <> 'cancelled'
                and cancelled_by is null
                and cancelled_at is null
                and cancellation_reason is null
            )
        )
);

create index payments_request_status_idx
on public.payments (participation_request_id, status);

create index payments_created_at_idx
on public.payments (created_at desc);

create trigger payments_updated_at
before update on public.payments
for each row
execute function public.set_updated_at();

alter table public.payments
enable row level security;

-- Aucun accès direct pour les visiteurs.
revoke all on table public.payments
from public, anon, authenticated;

-- Lecture administrative uniquement pour cette étape.
grant select on public.payments
to authenticated;

create policy payments_admin_read
on public.payments
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