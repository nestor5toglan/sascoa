begin;
-- Les données supprimées ne réapparaissent pas lors d’un retry de l’ancien formulaire.
create table public.salon_preregistration_deleted_keys(submission_key uuid primary key,deleted_at timestamptz not null default now());
alter table public.salon_preregistration_deleted_keys enable row level security;
revoke all on public.salon_preregistration_deleted_keys from anon,authenticated;
create or replace function public.submit_salon_preregistration(p_key uuid,p_hash text,p_event uuid,p_version uuid,p_first text,p_last text,p_email text,p_phone text,p_organization text,p_interest text,p_message text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare existing public.salon_preregistrations%rowtype; cfg public.salon_preregistration_settings%rowtype; receipt text;
begin
 -- Sérialise les répétitions d’une même demande, puis les limites par adresse.
 perform pg_advisory_xact_lock(hashtextextended(p_key::text,37));
 if exists(select 1 from public.salon_preregistration_deleted_keys where submission_key=p_key) then raise exception 'Demande supprimée.' using errcode='22023'; end if;
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
create function public.delete_salon_preregistration(p_id uuid,p_updated_at timestamptz) returns void language plpgsql security definer set search_path='' as $$
declare row_data public.salon_preregistrations%rowtype; key_value uuid;
begin
 if not exists(select 1 from public.admin_profiles where user_id=auth.uid() and is_active and role in ('root','director')) then raise exception 'Accès refusé.' using errcode='42501'; end if;
 select submission_key into key_value from public.salon_preregistrations where id=p_id;
 if not found then raise exception 'Demande supprimée ou modifiée. Recharge la liste.' using errcode='40001'; end if;
 perform pg_advisory_xact_lock(hashtextextended(key_value::text,37));
 select * into row_data from public.salon_preregistrations where id=p_id and updated_at=p_updated_at for update;
 if not found then raise exception 'Demande modifiée ailleurs. Recharge avant de supprimer.' using errcode='40001'; end if;
 insert into public.salon_preregistration_deleted_keys(submission_key) values(row_data.submission_key);
 delete from public.salon_preregistrations where id=p_id;
 insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,summary,details)
 values(auth.uid(),'delete','salon_preregistration',p_id,'Suppression définitive d’une préinscription','{}'::jsonb);
end $$;
revoke all on function public.delete_salon_preregistration(uuid,timestamptz) from public,anon;
grant execute on function public.delete_salon_preregistration(uuid,timestamptz) to authenticated;
-- Lecture publique des couvertures des deux nouvelles pages uniquement si publiées.
create policy sascoa_public_information_covers on storage.objects for select to anon,authenticated using
 (bucket_id='sascoa-media' and exists(select 1 from public.content_entries c where c.content_type='page' and c.slug in ('contact','a-propos') and c.status='published' and c.published_at<=now() and c.cover_image_path=name));
-- Coordonnées publiques configurables. Aucun secret dans cette table.
create table public.site_contact_settings(
 id boolean primary key default true check(id),email text not null default 'contact@sascoa.com' check(length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 phone_primary text not null default '+228 98 93 20 00' check(length(phone_primary)<=60),phone_secondary text not null default '+228 93 36 38 38' check(length(phone_secondary)<=60),
 location text not null default 'Lomé, Togo' check(length(location)<=500),
 website_url text not null default 'https://www.sascoa.com' check(length(website_url)<=2048 and website_url ~ '^https?://'),
 facebook_url text not null default 'https://www.facebook.com/61579215915639/' check(length(facebook_url)<=2048 and facebook_url ~ '^https?://'),
 form_enabled boolean not null default false,
 notice text not null default 'Les informations saisies seront transmises à l’organisation SASCOA pour répondre à votre message.' check(length(trim(notice)) between 30 and 3000),
 notice_version uuid not null default gen_random_uuid(),updated_at timestamptz not null default now()
);
insert into public.site_contact_settings(id) values(true);
alter table public.site_contact_settings enable row level security;
revoke all on public.site_contact_settings from anon,authenticated;
grant select on public.site_contact_settings to anon,authenticated;
grant update(email,phone_primary,phone_secondary,location,website_url,facebook_url,form_enabled,notice) on public.site_contact_settings to authenticated;
create policy contact_settings_read on public.site_contact_settings for select to anon,authenticated using(true);
create policy contact_settings_admin_update on public.site_contact_settings for update to authenticated using
 (exists(select 1 from public.admin_profiles where user_id=auth.uid() and is_active and role in ('root','director'))) with check
 (exists(select 1 from public.admin_profiles where user_id=auth.uid() and is_active and role in ('root','director')));
create function public.contact_settings_touch() returns trigger language plpgsql set search_path='' as $$begin
 new.updated_at:=clock_timestamp();if new.notice is distinct from old.notice then new.notice_version:=gen_random_uuid();end if;return new;end $$;
create trigger contact_settings_touch before update on public.site_contact_settings for each row execute function public.contact_settings_touch();
-- Les messages privés existants restent dans leur table, sans nouvelle copie parallèle.
alter table public.contact_messages add column payload_hash text,add column notice text,add column notice_version uuid,add column consent_at timestamptz;
create index contact_messages_email_created_at on public.contact_messages(email,created_at desc);
create function public.submit_contact_message(p_key uuid,p_hash text,p_version uuid,p_name text,p_email text,p_phone text,p_organization text,p_subject text,p_message text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare existing public.contact_messages%rowtype;cfg public.site_contact_settings%rowtype;receipt text;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_key::text,39));
 select * into existing from public.contact_messages where submission_key=p_key;
 if found then
  if existing.payload_hash is distinct from p_hash then raise exception 'Clé déjà utilisée.' using errcode='22023';end if;
  return jsonb_build_object('reference',existing.reference);
 end if;
 select * into cfg from public.site_contact_settings where id=true for share;
 if not cfg.form_enabled or cfg.notice_version is distinct from p_version or not exists(select 1 from public.content_entries where content_type='page' and slug='contact' and status='published' and published_at<=now()) then raise exception 'Formulaire fermé ou modifié.' using errcode='22023';end if;
 if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' or p_email is null or p_email<>lower(trim(p_email)) then raise exception 'Champs invalides.' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_email,40));
 if (select count(*) from public.contact_messages where email=p_email and created_at>now()-interval '1 hour')>=3 then raise exception 'Limite horaire atteinte.' using errcode='P0001';end if;
 insert into public.contact_messages(submission_key,payload_hash,full_name,email,phone,organization,subject,message,notice,notice_version,consent_at)
 values(p_key,p_hash,trim(p_name),p_email,nullif(p_phone,''),nullif(p_organization,''),trim(p_subject),trim(p_message),cfg.notice,cfg.notice_version,now()) returning reference into receipt;
 return jsonb_build_object('reference',receipt);
end $$;
revoke all on function public.submit_contact_message(uuid,text,uuid,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_contact_message(uuid,text,uuid,text,text,text,text,text,text) to service_role;
create function public.review_contact_message(p_id uuid,p_updated_at timestamptz,p_status text,p_note text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.admin_profiles where user_id=auth.uid() and is_active and role in ('root','director')) then raise exception 'Accès refusé.' using errcode='42501';end if;
 if p_status not in ('new','in_progress','resolved','archived') or p_status is null or length(p_note)>5000 or p_note is null then raise exception 'Suivi invalide.' using errcode='22023';end if;
 update public.contact_messages set status=p_status,internal_note=p_note,updated_by=auth.uid(),updated_at=clock_timestamp() where id=p_id and updated_at=p_updated_at;
 if not found then raise exception 'Message modifié ailleurs. Recharge la liste.' using errcode='40001';end if;
end $$;
revoke all on function public.review_contact_message(uuid,timestamptz,text,text) from public,anon;
grant execute on function public.review_contact_message(uuid,timestamptz,text,text) to authenticated;
commit;
