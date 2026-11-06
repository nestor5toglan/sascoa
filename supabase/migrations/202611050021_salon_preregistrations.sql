-- Lot 37 : préinscriptions distinctes des participations confirmées.
begin;
create table public.salon_preregistration_settings (
 id boolean primary key default true check(id),
 event_id uuid references public.events(id), enabled boolean not null default false,
 notice text not null default 'Les informations saisies seront transmises à l’organisation SASCOA pour traiter votre préinscription et vous recontacter à ce sujet.' check(length(trim(notice)) between 30 and 3000),
 notice_version uuid not null default gen_random_uuid(),
 updated_at timestamptz not null default now()
);
insert into public.salon_preregistration_settings(id) values(true);
create table public.salon_preregistrations (
 id uuid primary key default gen_random_uuid(),
 reference text not null unique default ('PRE-' || upper(gen_random_uuid()::text)),
 submission_key uuid not null unique,
 payload_hash text not null check(length(payload_hash)=64),
 event_id uuid not null references public.events(id),
 first_name text not null check(length(trim(first_name)) between 1 and 100),
 last_name text not null check(length(trim(last_name)) between 1 and 100),
 email text not null check(length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 phone text not null default '' check(length(phone)<=60),
 organization text not null default '' check(length(organization)<=200),
 interest text not null check(interest in ('visitor','exhibitor','partner','press')),
 message text not null default '' check(length(message)<=2000),
 notice text not null, notice_version uuid not null, consent_at timestamptz not null default now(),
 status text not null default 'received' check(status in ('received','under_review','contacted','archived')),
 internal_note text not null default '' check(length(internal_note)<=5000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.salon_preregistrations(created_at desc,id);
create index on public.salon_preregistrations(email,created_at desc);
alter table public.salon_preregistration_settings enable row level security;
alter table public.salon_preregistrations enable row level security;
revoke all on public.salon_preregistration_settings,public.salon_preregistrations from anon,authenticated;
grant select on public.salon_preregistration_settings,public.salon_preregistrations to authenticated;
grant update(event_id,enabled,notice) on public.salon_preregistration_settings to authenticated;
grant update(status,internal_note) on public.salon_preregistrations to authenticated;
create policy prereg_settings_admin_read on public.salon_preregistration_settings for select to authenticated using
 (exists(select 1 from public.admin_profiles p where p.user_id=(select auth.uid()) and p.is_active and p.role in ('root','director')));
create policy prereg_settings_admin_update on public.salon_preregistration_settings for update to authenticated using
 (exists(select 1 from public.admin_profiles p where p.user_id=(select auth.uid()) and p.is_active and p.role in ('root','director'))) with check
 (exists(select 1 from public.admin_profiles p where p.user_id=(select auth.uid()) and p.is_active and p.role in ('root','director')));
create policy prereg_admin_read on public.salon_preregistrations for select to authenticated using
 (exists(select 1 from public.admin_profiles p where p.user_id=(select auth.uid()) and p.is_active and p.role in ('root','director')));
create policy prereg_admin_update on public.salon_preregistrations for update to authenticated using
 (exists(select 1 from public.admin_profiles p where p.user_id=(select auth.uid()) and p.is_active and p.role in ('root','director'))) with check
 (exists(select 1 from public.admin_profiles p where p.user_id=(select auth.uid()) and p.is_active and p.role in ('root','director')));
create function public.prereg_touch() returns trigger language plpgsql set search_path='' as $$
begin
 new.updated_at:=clock_timestamp();
 if tg_table_name='salon_preregistration_settings' then
  if new.event_id is distinct from old.event_id or new.notice is distinct from old.notice then new.notice_version:=gen_random_uuid(); end if;
  if new.enabled and not exists(select 1 from public.events e where e.id=new.event_id and e.event_type='salon' and e.status='published' and e.ends_at>now()) then
   raise exception 'Choisis un salon publié dont la date de fin est à venir.' using errcode='23514';
  end if;
 end if;
 return new;
end $$;
create trigger prereg_settings_touch before update on public.salon_preregistration_settings for each row execute function public.prereg_touch();
create trigger prereg_touch before update on public.salon_preregistrations for each row execute function public.prereg_touch();
-- Aucune donnée personnelle ni liste des demandes dans cette fonction publique.
create function public.get_salon_preregistration() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('event_id',e.id,'title',e.title,'starts_at',e.starts_at,'ends_at',e.ends_at,'notice',s.notice,'notice_version',s.notice_version)
 from public.salon_preregistration_settings s join public.events e on e.id=s.event_id
 where s.enabled and e.status='published' and e.event_type='salon' and e.ends_at>now()
$$;
revoke all on function public.get_salon_preregistration() from public;
grant execute on function public.get_salon_preregistration() to anon,authenticated;
-- Appel réservé à l’Edge Function après validation anti-robot côté serveur.
create function public.submit_salon_preregistration(p_key uuid,p_hash text,p_event uuid,p_version uuid,p_first text,p_last text,p_email text,p_phone text,p_organization text,p_interest text,p_message text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare existing public.salon_preregistrations%rowtype; cfg public.salon_preregistration_settings%rowtype; receipt text;
begin
 -- Sérialise les répétitions d’une même demande, puis les limites par adresse.
 perform pg_advisory_xact_lock(hashtextextended(p_key::text,37));
 select * into existing from public.salon_preregistrations where submission_key=p_key;
 if found then
  if existing.payload_hash<>p_hash then raise exception 'Cette référence technique a déjà été utilisée.' using errcode='22023'; end if;
  return jsonb_build_object('reference',existing.reference);
 end if;
 select * into cfg from public.salon_preregistration_settings where id=true for share;
 if not cfg.enabled or cfg.event_id is distinct from p_event or cfg.notice_version is distinct from p_version or not exists
 (select 1 from public.events where id=p_event and status='published' and event_type='salon' and ends_at>now()) then
  raise exception 'Préinscription fermée ou formulaire modifié. Recharge la page.' using errcode='22023';
 end if;
 if p_email is null or p_email<>lower(trim(p_email)) or p_hash !~ '^[0-9a-f]{64}$' then raise exception 'Données invalides.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_email,38));
 if (select count(*) from public.salon_preregistrations where email=p_email and created_at>now()-interval '1 hour')>=3 then
  raise exception 'Trop de demandes pour cette adresse. Réessaie dans une heure.' using errcode='P0001';
 end if;
 insert into public.salon_preregistrations(submission_key,payload_hash,event_id,first_name,last_name,email,phone,organization,interest,message,notice,notice_version)
 values(p_key,p_hash,p_event,trim(p_first),trim(p_last),p_email,p_phone,p_organization,p_interest,p_message,cfg.notice,cfg.notice_version) returning reference into receipt;
 return jsonb_build_object('reference',receipt);
end $$;
revoke all on function public.submit_salon_preregistration(uuid,text,uuid,uuid,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_salon_preregistration(uuid,text,uuid,uuid,text,text,text,text,text,text,text) to service_role;
commit;
