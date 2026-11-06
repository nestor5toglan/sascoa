begin;

create table public.admin_audit_log (
    id uuid primary key default gen_random_uuid(),

    actor_id uuid not null
        references public.admin_profiles(user_id)
        on delete restrict,

    action text not null
        check (
            length(trim(action)) between 1 and 100
        ),

    entity_type text not null
        check (
            length(trim(entity_type)) between 1 and 100
        ),

    entity_id uuid not null,

    summary text not null
        check (
            length(trim(summary)) between 1 and 1000
        ),

    -- Informations utiles à la compréhension de l'action.
    -- Ne pas enregistrer de mots de passe ou clés secrètes.
    details jsonb not null default '{}'::jsonb
        check (
            jsonb_typeof(details) = 'object'
        ),

    created_at timestamptz not null default now()
);

create index admin_audit_log_created_at_idx
on public.admin_audit_log (created_at desc);

create index admin_audit_log_actor_date_idx
on public.admin_audit_log (actor_id, created_at desc);

create index admin_audit_log_entity_date_idx
on public.admin_audit_log (
    entity_type,
    entity_id,
    created_at desc
);

alter table public.admin_audit_log
enable row level security;

-- Aucune écriture directe depuis le navigateur.
revoke all on table public.admin_audit_log
from public, anon, authenticated;

grant select on public.admin_audit_log
to authenticated;

create policy admin_audit_log_admin_read
on public.admin_audit_log
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