begin;

create table public.private_attachments (
    id uuid primary key default gen_random_uuid(),

    participation_request_id uuid
        references public.participation_requests(id)
        on delete restrict,

    pitch_application_id uuid
        references public.pitch_applications(id)
        on delete restrict,

    payment_id uuid
        references public.payments(id)
        on delete restrict,

    bucket_id text not null default 'sascoa-private'
        check (bucket_id = 'sascoa-private'),

    storage_path text not null unique
        check (
            length(trim(storage_path)) > 0
            and storage_path = trim(storage_path)
        ),

    original_filename text not null
        check (
            length(trim(original_filename)) between 1 and 255
        ),

    mime_type text not null
        check (
            mime_type in (
                'image/jpeg',
                'image/png',
                'image/webp',
                'application/pdf'
            )
        ),

    file_size_bytes bigint not null
        check (
            file_size_bytes > 0
            and file_size_bytes <= 10485760
        ),

    -- Renseigné si le dépôt est effectué par un administrateur.
    -- Peut rester vide pour un dépôt via un formulaire public.
    uploaded_by uuid
        references public.admin_profiles(user_id)
        on delete restrict,

    created_at timestamptz not null default now(),

    -- Chaque fichier appartient à un seul dossier.
    constraint private_attachment_single_parent
        check (
            num_nonnulls(
                participation_request_id,
                pitch_application_id,
                payment_id
            ) = 1
        )
);

create index private_attachments_participation_idx
on public.private_attachments (participation_request_id);

create index private_attachments_pitch_idx
on public.private_attachments (pitch_application_id);

create index private_attachments_payment_idx
on public.private_attachments (payment_id);

alter table public.private_attachments
enable row level security;

-- Aucun accès direct pour les visiteurs.
revoke all on table public.private_attachments
from public, anon, authenticated;

-- Consultation réservée aux administrateurs actifs.
grant select on public.private_attachments
to authenticated;

create policy private_attachments_admin_read
on public.private_attachments
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