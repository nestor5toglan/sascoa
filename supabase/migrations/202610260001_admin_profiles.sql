begin;

-- Profils des administrateurs.
-- Les mots de passe restent gérés par Supabase Auth.
create table public.admin_profiles (
    user_id uuid primary key
        references auth.users(id) on delete restrict,

    username text not null unique,
    display_name text not null,

    role text not null
        check (role in ('root', 'director')),

    is_active boolean not null default false,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint admin_username_format
        check (username ~ '^[a-z0-9][a-z0-9_-]{2,49}$'),

    constraint admin_display_name_not_empty
        check (length(trim(display_name)) > 0)
);

-- Mettre à jour automatiquement la date de modification.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

revoke all on function public.set_updated_at()
from public, anon, authenticated;

create trigger admin_profiles_updated_at
before update on public.admin_profiles
for each row
execute function public.set_updated_at();

-- Activer la protection des lignes.
alter table public.admin_profiles
enable row level security;

-- Aucun accès public et aucune modification depuis le navigateur.
revoke all on table public.admin_profiles
from public, anon, authenticated;

-- Un utilisateur connecté peut uniquement lire son propre profil.
grant select on table public.admin_profiles
to authenticated;

create policy admin_profiles_read_own
on public.admin_profiles
for select
to authenticated
using (
    user_id = (select auth.uid())
);

commit;