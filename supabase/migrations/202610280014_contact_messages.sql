begin;

create table public.contact_messages (
    id uuid primary key default gen_random_uuid(),

    reference text not null unique default (
        'CONTACT-' || upper(gen_random_uuid()::text)
    ),

    -- Réutilisée lors d'une nouvelle tentative du même envoi.
    submission_key uuid not null unique,

    full_name text not null
        check (
            length(trim(full_name)) between 1 and 200
        ),

    email text not null
        check (
            length(email) <= 254
            and email = trim(email)
            and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
        ),

    phone text
        check (
            phone is null
            or length(phone) <= 50
        ),

    organization text
        check (
            organization is null
            or length(organization) <= 200
        ),

    subject text not null
        check (
            length(trim(subject)) between 1 and 250
        ),

    message text not null
        check (
            length(trim(message)) between 1 and 10000
        ),

    status text not null default 'new'
        check (
            status in (
                'new',
                'in_progress',
                'resolved',
                'archived'
            )
        ),

    internal_note text,

    updated_by uuid
        references public.admin_profiles(user_id)
        on delete restrict,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index contact_messages_status_created_at_idx
on public.contact_messages (status, created_at desc);

create function public.set_contact_message_audit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    -- Préserver la date de réception et identifier
    -- l'administrateur lors d'une modification.
    new.created_at = old.created_at;
    new.updated_at = now();
    new.updated_by = auth.uid();

    return new;
end;
$$;

revoke all on function public.set_contact_message_audit()
from public, anon, authenticated;

create trigger contact_messages_audit
before update on public.contact_messages
for each row
execute function public.set_contact_message_audit();

alter table public.contact_messages
enable row level security;

-- Aucun accès direct pour les visiteurs.
revoke all on table public.contact_messages
from public, anon, authenticated;

-- Lecture administrative uniquement pour cette étape.
grant select on public.contact_messages
to authenticated;

create policy contact_messages_admin_read
on public.contact_messages
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