begin;
-- Flux indépendant des anciennes tables pitch_applications non migrées.
create table public.program_application_settings(
 program text primary key check(program in('pitch','hackathon')),event_id uuid references public.events(id),enabled boolean not null default false,
 deadline timestamptz,team_max_size integer not null default 5 check(team_max_size between 2 and 20),
 daily_limit integer not null default 100 check(daily_limit between 1 and 500),
 notice text not null default 'Les informations et le document transmis seront consultés uniquement par les administrateurs SASCOA pour étudier votre candidature et vous recontacter. Aucune information n’est publiée automatiquement.' check(length(trim(notice)) between 30 and 3000),
 notice_version uuid not null default gen_random_uuid(),updated_at timestamptz not null default clock_timestamp()
);
insert into public.program_application_settings(program) values('pitch'),('hackathon');
create table public.program_application_intents(
 id uuid primary key default gen_random_uuid(),submission_key uuid not null unique,payload_hash text not null check(payload_hash ~ '^[0-9a-f]{64}$'),
 program text not null references public.program_application_settings(program),event_id uuid not null references public.events(id),notice_version uuid not null,notice text not null,
 email text not null,payload jsonb,file_path text unique,file_name text,file_size integer not null default 0 check(file_size between 0 and 5242880),file_hash text,
 created_at timestamptz not null default clock_timestamp(),completed_at timestamptz,
 check((file_path is null and file_size=0 and file_hash is null and file_name is null) or (file_path ~ '^applications/[0-9a-f-]{36}\.pdf$' and file_size>0 and file_hash ~ '^[0-9a-f]{64}$' and length(file_name) between 1 and 120))
);
create index on public.program_application_intents(program,email,created_at);
create index on public.program_application_intents(program,created_at);
create table public.program_applications(
 id uuid primary key references public.program_application_intents(id),reference text not null unique,program text not null references public.program_application_settings(program),event_id uuid not null references public.events(id),
 full_name text not null,email text not null,phone text not null,organization text not null,project_name text not null,description text not null,objective text not null,skills text not null,
 participation_mode text not null check(participation_mode in('individual','team')),team_name text not null,members jsonb not null,
 members_authorized boolean not null,notice text not null,notice_version uuid not null,consent_at timestamptz not null,
 file_path text,file_name text,file_size integer not null,file_hash text,
 status text not null default 'received' check(status in('received','under_review','accepted','rejected','archived')),
 internal_note text not null default '' check(length(internal_note)<=5000),reviewed_by uuid,reviewed_at timestamptz,
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp()
);
create index on public.program_applications(program,status,created_at desc,id);
create table public.program_application_audit(id uuid primary key default gen_random_uuid(),application_id uuid,program text not null,action text not null,actor_id uuid not null,created_at timestamptz not null default clock_timestamp());
alter table public.program_application_settings enable row level security;
alter table public.program_application_intents enable row level security;
alter table public.program_applications enable row level security;
alter table public.program_application_audit enable row level security;
revoke all on public.program_application_settings,public.program_application_intents,public.program_applications,public.program_application_audit from public,anon,authenticated;
grant select on public.program_application_settings,public.program_applications,public.program_application_audit to authenticated;
create policy program_settings_admin on public.program_application_settings for select to authenticated using(exists(select 1 from public.admin_profiles where user_id=auth.uid() and is_active and role in('root','director')));
create policy program_applications_admin on public.program_applications for select to authenticated using(exists(select 1 from public.admin_profiles where user_id=auth.uid() and is_active and role in('root','director')));
create policy program_audit_admin on public.program_application_audit for select to authenticated using(exists(select 1 from public.admin_profiles where user_id=auth.uid() and is_active and role in('root','director')));
create function public.get_program_application_config(p_program text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('program',s.program,'event_id',e.id,'event_title',e.title,'deadline',s.deadline,'team_max_size',s.team_max_size,'notice',s.notice,'notice_version',s.notice_version)
 from public.program_application_settings s join public.events e on e.id=s.event_id
 where s.program=p_program and s.enabled and e.event_type='salon' and e.status='published' and e.ends_at>now() and (s.deadline is null or s.deadline>now())
 and exists(select 1 from public.content_entries c where c.content_type='page' and c.slug=s.program and c.status='published' and c.published_at<=now())
$$;
create function public.save_program_application_settings(p_program text,p_version timestamptz,p_event uuid,p_enabled boolean,p_deadline timestamptz,p_team_max integer,p_daily_limit integer,p_notice text) returns jsonb language plpgsql security definer set search_path='' as $$
declare result public.program_application_settings;begin
 perform public.expo_require_admin();
 if p_enabled and (not exists(select 1 from public.events where id=p_event and event_type='salon' and status='published' and ends_at>now()) or (p_deadline is not null and p_deadline<=now())) then raise exception 'Choisis un salon publié à venir et une date de clôture future.' using errcode='23514';end if;
 update public.program_application_settings set event_id=p_event,enabled=p_enabled,deadline=p_deadline,team_max_size=p_team_max,daily_limit=p_daily_limit,notice=trim(p_notice),notice_version=gen_random_uuid(),updated_at=clock_timestamp()
 where program=p_program and updated_at=p_version returning * into result;
 if not found then raise exception 'Configuration modifiée ailleurs. Recharge.' using errcode='40001';end if;
 insert into public.program_application_audit(program,action,actor_id) values(p_program,'settings_saved',auth.uid());return to_jsonb(result);
end$$;
-- Même validation dans la base : l’Edge Function n’est pas l’unique autorité métier.
create function public.validate_program_payload(p_program text,p_payload jsonb,p_team_max integer) returns void language plpgsql set search_path='' as $$
declare field text;member jsonb;max_len integer;begin
 if p_program not in('pitch','hackathon') or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Candidature invalide.' using errcode='22023';end if;
 for field,max_len in select * from (values('full_name',200),('email',254),('phone',60),('organization',200),('project_name',200),('description',5000),('objective',3000),('skills',1000),('team_name',120)) as v(f,m) loop
 if jsonb_typeof(p_payload->field) is distinct from 'string' or length(p_payload->>field)>max_len then raise exception 'Champ absent ou trop long.' using errcode='22023';end if;
 end loop;
 if length(trim(p_payload->>'full_name'))=0 or (p_payload->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p_payload->>'email'<>lower(trim(p_payload->>'email')) then raise exception 'Coordonnées invalides.' using errcode='22023';end if;
 if p_payload->>'participation_mode' not in('individual','team') or p_payload->>'participation_mode' is null or jsonb_typeof(p_payload->'members') is distinct from 'array' or jsonb_typeof(p_payload->'members_authorized') is distinct from 'boolean' then raise exception 'Composition invalide.' using errcode='22023';end if;
 if p_program='pitch' and (p_payload->>'participation_mode'<>'individual' or length(trim(p_payload->>'project_name'))=0 or length(trim(p_payload->>'description'))=0 or length(trim(p_payload->>'objective'))=0) then raise exception 'Renseigne le projet, sa présentation et son objectif.' using errcode='22023';end if;
 if p_program='hackathon' and length(trim(p_payload->>'skills'))=0 then raise exception 'Renseigne les compétences du candidat ou du responsable.' using errcode='22023';end if;
 if p_payload->>'participation_mode'='individual' then
 if jsonb_array_length(p_payload->'members')<>0 or length(p_payload->>'team_name')<>0 or (p_payload->>'members_authorized')::boolean then raise exception 'Une candidature individuelle ne comporte pas de membres.' using errcode='22023';end if;
 else
 if p_program<>'hackathon' or length(trim(p_payload->>'team_name'))=0 or jsonb_array_length(p_payload->'members') not between 1 and p_team_max-1 or (p_payload->>'members_authorized')::boolean is distinct from true then raise exception 'Vérifie le nom, la taille et l’autorisation de l’équipe.' using errcode='22023';end if;
 for member in select value from jsonb_array_elements(p_payload->'members') loop
 if jsonb_typeof(member) is distinct from 'object' or jsonb_typeof(member->'full_name') is distinct from 'string' or length(trim(member->>'full_name')) not between 1 and 100 or jsonb_typeof(member->'skills') is distinct from 'string' or length(member->>'skills')>500 then raise exception 'Membre invalide.' using errcode='22023';end if;
 end loop;
 end if;
end$$;
revoke all on function public.validate_program_payload(text,jsonb,integer) from public,anon,authenticated;
create function public.reserve_program_application(p_key uuid,p_hash text,p_program text,p_version uuid,p_payload jsonb,p_file_name text,p_file_size integer,p_file_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare intent public.program_application_intents;cfg public.program_application_settings;receipt text;new_id uuid:=gen_random_uuid();begin
 if p_key is null or p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then raise exception 'Référence invalide.' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_key::text,42));
 select * into intent from public.program_application_intents where submission_key=p_key;
 if found then
 if intent.payload_hash<>p_hash then raise exception 'Référence déjà utilisée avec un autre contenu.' using errcode='22023';end if;
 if intent.completed_at is not null then select reference into receipt from public.program_applications where id=intent.id;return jsonb_build_object('reference',receipt);end if;
 if intent.created_at<now()-interval '24 hours' then raise exception 'Essai expiré. Recharge le formulaire.' using errcode='22023';end if;
 end if;
 select * into cfg from public.program_application_settings where program=p_program for share;
 if not found or cfg.notice_version is distinct from p_version or public.get_program_application_config(p_program) is null then raise exception 'Candidatures fermées ou formulaire modifié.' using errcode='22023';end if;
 perform public.validate_program_payload(p_program,p_payload,cfg.team_max_size);
 if p_file_size is null or p_file_size not between 0 and 5242880 or (p_file_size=0 and (p_file_name is not null or p_file_hash is not null)) or (p_file_size>0 and (p_file_name is null or length(p_file_name) not between 1 and 120 or p_file_hash is null or p_file_hash !~ '^[0-9a-f]{64}$')) then raise exception 'Document invalide.' using errcode='22023';end if;
 if intent.id is not null then return jsonb_build_object('intent_id',intent.id,'file_path',intent.file_path);end if;
 -- Compte aussi les essais interrompus pour limiter l’abus de dépôt de PDF.
 perform pg_advisory_xact_lock(hashtextextended(p_program,420));
 if (select count(*) from public.program_application_intents where program=p_program and email=p_payload->>'email' and created_at>now()-interval '1 hour')>=3 or (select count(*) from public.program_application_intents where program=p_program and created_at>=(date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'))>=cfg.daily_limit then raise exception 'Limite de candidatures atteinte.' using errcode='P0001';end if;
 insert into public.program_application_intents(id,submission_key,payload_hash,program,event_id,notice_version,notice,email,payload,file_path,file_name,file_size,file_hash)
 values(new_id,p_key,p_hash,p_program,cfg.event_id,cfg.notice_version,cfg.notice,p_payload->>'email',p_payload,case when p_file_size>0 then 'applications/'||new_id::text||'.pdf' end,p_file_name,p_file_size,p_file_hash) returning * into intent;
 return jsonb_build_object('intent_id',intent.id,'file_path',intent.file_path);
end$$;
create function public.finalize_program_application(p_intent uuid,p_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare intent public.program_application_intents;cfg public.program_application_settings;p jsonb;receipt text;begin
 select * into intent from public.program_application_intents where id=p_intent for update;
 if not found or intent.payload_hash is distinct from p_hash then raise exception 'Essai introuvable.' using errcode='22023';end if;
 if intent.completed_at is not null then select reference into receipt from public.program_applications where id=intent.id;return jsonb_build_object('reference',receipt);end if;
 select * into cfg from public.program_application_settings where program=intent.program for share;
 if intent.created_at<now()-interval '24 hours' or cfg.notice_version is distinct from intent.notice_version or public.get_program_application_config(intent.program) is null then raise exception 'Formulaire modifié ou candidatures fermées.' using errcode='22023';end if;
 perform public.validate_program_payload(intent.program,intent.payload,cfg.team_max_size);
 if intent.file_path is not null and not exists(select 1 from storage.objects where bucket_id='sascoa-private' and name=intent.file_path) then raise exception 'Document non enregistré.' using errcode='23514';end if;
 p:=intent.payload;receipt:=upper(intent.program)||'-'||upper(intent.id::text);
 insert into public.program_applications(id,reference,program,event_id,full_name,email,phone,organization,project_name,description,objective,skills,participation_mode,team_name,members,members_authorized,notice,notice_version,consent_at,file_path,file_name,file_size,file_hash)
 values(intent.id,receipt,intent.program,intent.event_id,p->>'full_name',p->>'email',p->>'phone',p->>'organization',p->>'project_name',p->>'description',p->>'objective',p->>'skills',p->>'participation_mode',p->>'team_name',p->'members',(p->>'members_authorized')::boolean,intent.notice,intent.notice_version,intent.created_at,intent.file_path,intent.file_name,intent.file_size,intent.file_hash);
 update public.program_application_intents set completed_at=clock_timestamp(),payload=null where id=intent.id;
 return jsonb_build_object('reference',receipt);
end$$;
create function public.review_program_application(p_id uuid,p_version timestamptz,p_status text,p_note text) returns jsonb language plpgsql security definer set search_path='' as $$
declare result public.program_applications;begin
 perform public.expo_require_admin();
 update public.program_applications set status=p_status,internal_note=coalesce(p_note,''),reviewed_by=auth.uid(),reviewed_at=clock_timestamp(),updated_at=clock_timestamp() where id=p_id and updated_at=p_version returning * into result;
 if not found then raise exception 'Candidature modifiée ailleurs. Recharge.' using errcode='40001';end if;
 insert into public.program_application_audit(application_id,program,action,actor_id) values(result.id,result.program,'review_'||result.status,auth.uid());return to_jsonb(result);
end$$;
create policy sascoa_program_pdf_admin_read on storage.objects for select to authenticated using(bucket_id='sascoa-private' and name ~ '^applications/[0-9a-f-]{36}\.pdf$' and exists(select 1 from public.admin_profiles where user_id=auth.uid() and is_active and role in('root','director')));
revoke all on function public.get_program_application_config(text) from public,anon,authenticated;
grant execute on function public.get_program_application_config(text) to anon,authenticated;
revoke all on function public.save_program_application_settings(text,timestamptz,uuid,boolean,timestamptz,integer,integer,text),public.review_program_application(uuid,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.save_program_application_settings(text,timestamptz,uuid,boolean,timestamptz,integer,integer,text),public.review_program_application(uuid,timestamptz,text,text) to authenticated;
revoke all on function public.reserve_program_application(uuid,text,text,uuid,jsonb,text,integer,text),public.finalize_program_application(uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_program_application(uuid,text,text,uuid,jsonb,text,integer,text),public.finalize_program_application(uuid,text) to service_role;
commit;
