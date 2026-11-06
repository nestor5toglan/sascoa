begin;
-- Nouveau flux explicite, sans réécriture des tables historiques de participation/paiement.
create table public.salon_stand_categories(
 id uuid primary key default gen_random_uuid(),event_id uuid not null references public.events(id),
 name text not null check(length(trim(name)) between 1 and 100),price_amount bigint not null check(price_amount between 1 and 1000000000),
 currency text not null default 'XOF' check(currency='XOF'),capacity integer not null check(capacity between 1 and 10000),
 is_active boolean not null default true,is_demo boolean not null default true,updated_at timestamptz not null default clock_timestamp(),updated_by uuid not null,
 unique(event_id,name)
);
create table public.salon_exhibitor_files(
 id uuid primary key default gen_random_uuid(),request_id uuid unique references public.salon_preregistrations(id) on delete set null,
 event_id uuid not null references public.events(id),category_id uuid not null references public.salon_stand_categories(id),
 stand_number text not null check(length(trim(stand_number)) between 1 and 40),
 quoted_amount bigint not null check(quoted_amount>0),currency text not null check(currency='XOF'),
 status text not null default 'pending' check(status in('pending','admitted','cancelled')),
 public_name text not null check(length(trim(public_name)) between 1 and 200),public_description text not null default '' check(length(public_description)<=2000),
 public_website text not null default '' check(length(public_website)<=2000 and (public_website='' or public_website ~ '^https?://[^[:space:]]+$')),
 logo_path text check(logo_path is null or logo_path ~ '^exhibitors/[0-9a-f-]{36}\.(jpg|png|webp)$'),
 publication_consent boolean not null default false,consent_note text not null default '' check(length(consent_note)<=500),
 consent_recorded_at timestamptz,consent_recorded_by uuid,is_public boolean not null default false,is_demo boolean not null,
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),updated_by uuid not null,
 check(not is_public or (status='admitted' and publication_consent)),check(not publication_consent or length(trim(consent_note))>=5)
);
create unique index salon_exhibitor_stand_unique on public.salon_exhibitor_files(event_id,lower(trim(stand_number))) where status<>'cancelled';
create index on public.salon_exhibitor_files(event_id,category_id,status);
create table public.salon_exhibitor_payments(
 id uuid primary key default gen_random_uuid(),file_id uuid not null references public.salon_exhibitor_files(id),
 amount bigint not null check(amount>0),currency text not null check(currency='XOF'),paid_on date not null,
 method text not null check(method in('cash','bank_transfer','mobile_money','other')),
 reference text not null check(length(trim(reference)) between 1 and 200),
 confirmed_at timestamptz not null default clock_timestamp(),confirmed_by uuid not null,
 voided_at timestamptz,voided_by uuid,void_reason text check(length(void_reason)<=500)
);
create unique index salon_exhibitor_single_payment on public.salon_exhibitor_payments(file_id) where voided_at is null;
create table public.salon_exhibitor_audit(id uuid primary key default gen_random_uuid(),event_id uuid not null,entity_id uuid not null,action text not null,actor_id uuid not null,created_at timestamptz not null default clock_timestamp());
alter table public.salon_stand_categories enable row level security;
alter table public.salon_exhibitor_files enable row level security;
alter table public.salon_exhibitor_payments enable row level security;
alter table public.salon_exhibitor_audit enable row level security;
revoke all on public.salon_stand_categories,public.salon_exhibitor_files,public.salon_exhibitor_payments,public.salon_exhibitor_audit from public,anon,authenticated;
grant select on public.salon_stand_categories,public.salon_exhibitor_files,public.salon_exhibitor_payments,public.salon_exhibitor_audit to authenticated;
create policy expo_categories_admin on public.salon_stand_categories for select to authenticated using(exists(select 1 from public.admin_profiles where user_id=auth.uid() and is_active and role in('root','director')));
create policy expo_files_admin on public.salon_exhibitor_files for select to authenticated using(exists(select 1 from public.admin_profiles where user_id=auth.uid() and is_active and role in('root','director')));
create policy expo_payments_admin on public.salon_exhibitor_payments for select to authenticated using(exists(select 1 from public.admin_profiles where user_id=auth.uid() and is_active and role in('root','director')));
create policy expo_audit_admin on public.salon_exhibitor_audit for select to authenticated using(exists(select 1 from public.admin_profiles where user_id=auth.uid() and is_active and role in('root','director')));
create function public.expo_require_admin() returns void language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from public.admin_profiles where user_id=auth.uid() and is_active and role in('root','director')) then raise exception 'Accès administrateur actif requis.' using errcode='42501';end if;
end$$;
revoke all on function public.expo_require_admin() from public,anon,authenticated;
create function public.expo_save_category(p_id uuid,p_version timestamptz,p_event uuid,p_name text,p_price bigint,p_capacity integer,p_active boolean,p_demo boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result public.salon_stand_categories;begin
 perform public.expo_require_admin();perform pg_advisory_xact_lock(hashtextextended(p_event::text,41));
 if not exists(select 1 from public.events where id=p_event and event_type='salon') then raise exception 'Choisis un événement de type Salon.' using errcode='23514';end if;
 if p_id is null then
 insert into public.salon_stand_categories(event_id,name,price_amount,capacity,is_active,is_demo,updated_by) values(p_event,trim(p_name),p_price,p_capacity,p_active,p_demo,auth.uid()) returning * into result;
 else
 if (select count(*) from public.salon_exhibitor_files where category_id=p_id and status<>'cancelled')>p_capacity then raise exception 'Capacité inférieure aux stands déjà réservés.' using errcode='23514';end if;
 update public.salon_stand_categories set name=trim(p_name),price_amount=p_price,capacity=p_capacity,is_active=p_active,is_demo=p_demo,updated_at=clock_timestamp(),updated_by=auth.uid() where id=p_id and event_id=p_event and updated_at=p_version returning * into result;
 if not found then raise exception 'Catégorie modifiée ailleurs. Recharge.' using errcode='40001';end if;
 end if;
 insert into public.salon_exhibitor_audit(event_id,entity_id,action,actor_id) values(p_event,result.id,'category_saved',auth.uid());return to_jsonb(result);
end$$;
create function public.expo_create_file(p_request uuid,p_version timestamptz,p_category uuid,p_stand text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare req public.salon_preregistrations;cat public.salon_stand_categories;result public.salon_exhibitor_files;begin
 perform public.expo_require_admin();select * into req from public.salon_preregistrations where id=p_request;
 if not found then raise exception 'Demande indisponible.' using errcode='40001';end if;
 perform pg_advisory_xact_lock(hashtextextended(req.event_id::text,41));
 select * into req from public.salon_preregistrations where id=p_request and updated_at=p_version for update;
 if not found then raise exception 'Demande modifiée ailleurs. Recharge.' using errcode='40001';end if;
 if not exists(select 1 from public.events where id=req.event_id and event_type='salon') then raise exception 'Cet événement n’est plus de type Salon.' using errcode='23514';end if;
 if req.interest<>'exhibitor' or req.status='archived' then raise exception 'Choisis une demande Exposant non archivée.' using errcode='23514';end if;
 select * into cat from public.salon_stand_categories where id=p_category and event_id=req.event_id and is_active;
 if not found then raise exception 'Catégorie inactive ou liée à un autre salon.' using errcode='23514';end if;
 if (select count(*) from public.salon_exhibitor_files where category_id=cat.id and status<>'cancelled')>=cat.capacity then raise exception 'Cette catégorie est complète.' using errcode='23514';end if;
 insert into public.salon_exhibitor_files(request_id,event_id,category_id,stand_number,quoted_amount,currency,public_name,is_demo,updated_by)
 values(req.id,req.event_id,cat.id,trim(p_stand),cat.price_amount,cat.currency,coalesce(nullif(trim(req.organization),''),'Exposant à renseigner'),cat.is_demo or (select is_demo from public.events where id=req.event_id),auth.uid()) returning * into result;
 insert into public.salon_exhibitor_audit(event_id,entity_id,action,actor_id) values(result.event_id,result.id,'file_created',auth.uid());return to_jsonb(result);
end$$;
create function public.expo_save_file(p_id uuid,p_version timestamptz,p_category uuid,p_stand text,p_name text,p_description text,p_website text,p_logo text,p_consent boolean,p_consent_note text,p_status text,p_public boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare row_data public.salon_exhibitor_files;cat public.salon_stand_categories;result public.salon_exhibitor_files;paid boolean;begin
 perform public.expo_require_admin();select * into row_data from public.salon_exhibitor_files where id=p_id;
 if not found then raise exception 'Dossier indisponible.' using errcode='40001';end if;
 perform pg_advisory_xact_lock(hashtextextended(row_data.event_id::text,41));
 select * into row_data from public.salon_exhibitor_files where id=p_id and updated_at=p_version for update;
 if not found then raise exception 'Dossier modifié ailleurs. Recharge.' using errcode='40001';end if;
 select * into cat from public.salon_stand_categories where id=p_category and event_id=row_data.event_id;
 if not found or (not cat.is_active and cat.id<>row_data.category_id) then raise exception 'Catégorie indisponible pour ce salon.' using errcode='23514';end if;
 select exists(select 1 from public.salon_exhibitor_payments where file_id=p_id and voided_at is null) into paid;
 if paid and cat.id<>row_data.category_id then raise exception 'Annule la confirmation du paiement avant de changer de catégorie.' using errcode='23514';end if;
 if p_status='admitted' and not paid then raise exception 'Confirme le paiement intégral avant l’admission.' using errcode='23514';end if;
 if p_status<>'cancelled' and (select count(*) from public.salon_exhibitor_files where category_id=cat.id and id<>p_id and status<>'cancelled')>=cat.capacity then raise exception 'Cette catégorie est complète.' using errcode='23514';end if;
 update public.salon_exhibitor_files set category_id=cat.id,stand_number=trim(p_stand),quoted_amount=case when cat.id<>row_data.category_id then cat.price_amount else row_data.quoted_amount end,
 public_name=trim(p_name),public_description=coalesce(p_description,''),public_website=trim(coalesce(p_website,'')),logo_path=nullif(p_logo,''),
 publication_consent=p_consent,consent_note=trim(coalesce(p_consent_note,'')),consent_recorded_at=case when p_consent and (not row_data.publication_consent or p_consent_note is distinct from row_data.consent_note) then clock_timestamp() when p_consent then row_data.consent_recorded_at else null end,
 consent_recorded_by=case when p_consent then auth.uid() else null end,status=p_status,is_public=p_public,is_demo=row_data.is_demo or cat.is_demo,updated_at=clock_timestamp(),updated_by=auth.uid() where id=p_id returning * into result;
 insert into public.salon_exhibitor_audit(event_id,entity_id,action,actor_id) values(result.event_id,result.id,'file_saved',auth.uid());return to_jsonb(result);
end$$;
create function public.expo_confirm_payment(p_file uuid,p_version timestamptz,p_amount bigint,p_paid_on date,p_method text,p_reference text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare row_data public.salon_exhibitor_files;begin
 perform public.expo_require_admin();select * into row_data from public.salon_exhibitor_files where id=p_file;
 if not found then raise exception 'Dossier indisponible.' using errcode='40001';end if;
 perform pg_advisory_xact_lock(hashtextextended(row_data.event_id::text,41));
 select * into row_data from public.salon_exhibitor_files where id=p_file and updated_at=p_version for update;
 if not found then raise exception 'Dossier modifié ailleurs. Recharge.' using errcode='40001';end if;
 if row_data.status='cancelled' or p_amount is distinct from row_data.quoted_amount or p_paid_on is null or p_paid_on>current_date then raise exception 'Renseigne le paiement intégral exact et une date non future sur un dossier actif.' using errcode='23514';end if;
 insert into public.salon_exhibitor_payments(file_id,amount,currency,paid_on,method,reference,confirmed_by) values(p_file,row_data.quoted_amount,row_data.currency,p_paid_on,p_method,trim(p_reference),auth.uid());
 update public.salon_exhibitor_files set updated_at=clock_timestamp(),updated_by=auth.uid() where id=p_file returning * into row_data;
 insert into public.salon_exhibitor_audit(event_id,entity_id,action,actor_id) values(row_data.event_id,p_file,'payment_confirmed',auth.uid());return to_jsonb(row_data);
end$$;
create function public.expo_void_payment(p_file uuid,p_version timestamptz,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare row_data public.salon_exhibitor_files;begin
 perform public.expo_require_admin();select * into row_data from public.salon_exhibitor_files where id=p_file;
 if not found then raise exception 'Dossier indisponible.' using errcode='40001';end if;
 perform pg_advisory_xact_lock(hashtextextended(row_data.event_id::text,41));
 select * into row_data from public.salon_exhibitor_files where id=p_file and updated_at=p_version for update;
 if not found then raise exception 'Dossier modifié ailleurs. Recharge.' using errcode='40001';end if;
 if p_reason is null or length(trim(p_reason)) not between 5 and 500 then raise exception 'Explique la correction du paiement (5 à 500 caractères).' using errcode='23514';end if;
 update public.salon_exhibitor_payments set voided_at=clock_timestamp(),voided_by=auth.uid(),void_reason=trim(p_reason) where file_id=p_file and voided_at is null;
 if not found then raise exception 'Aucun paiement confirmé à corriger.' using errcode='23514';end if;
 update public.salon_exhibitor_files set status=case when status='admitted' then 'pending' else status end,is_public=false,updated_at=clock_timestamp(),updated_by=auth.uid() where id=p_file returning * into row_data;
 insert into public.salon_exhibitor_audit(event_id,entity_id,action,actor_id) values(row_data.event_id,p_file,'payment_voided',auth.uid());return to_jsonb(row_data);
end$$;
create function public.get_salon_exhibitors(p_event uuid) returns table(id uuid,public_name text,public_description text,public_website text,logo_path text,stand_number text,category_name text,is_demo boolean)
language sql stable security definer set search_path='' as $$
 select f.id,f.public_name,f.public_description,f.public_website,f.logo_path,f.stand_number,c.name,(f.is_demo or e.is_demo)
 from public.salon_exhibitor_files f join public.events e on e.id=f.event_id join public.salon_stand_categories c on c.id=f.category_id
 where e.id=p_event and e.status='published' and e.event_type='salon' and f.status='admitted' and f.is_public and f.publication_consent
 and exists(select 1 from public.salon_exhibitor_payments p where p.file_id=f.id and p.voided_at is null and p.amount=f.quoted_amount and p.currency=f.currency)
 order by f.public_name,f.id
$$;
create function public.is_public_exhibitor_logo(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select p_path ~ '^exhibitors/[0-9a-f-]{36}\.(jpg|png|webp)$' and exists(
 select 1 from public.salon_exhibitor_files f join public.events e on e.id=f.event_id
 where f.logo_path=p_path and e.status='published' and e.event_type='salon' and f.status='admitted' and f.is_public and f.publication_consent
 and exists(select 1 from public.salon_exhibitor_payments p where p.file_id=f.id and p.voided_at is null and p.amount=f.quoted_amount and p.currency=f.currency))
$$;
create policy sascoa_public_exhibitor_logos on storage.objects for select to anon,authenticated using(bucket_id='sascoa-media' and public.is_public_exhibitor_logo(name));
revoke all on function public.expo_save_category(uuid,timestamptz,uuid,text,bigint,integer,boolean,boolean),public.expo_create_file(uuid,timestamptz,uuid,text),public.expo_save_file(uuid,timestamptz,uuid,text,text,text,text,text,boolean,text,text,boolean),public.expo_confirm_payment(uuid,timestamptz,bigint,date,text,text),public.expo_void_payment(uuid,timestamptz,text) from public,anon,authenticated;
grant execute on function public.expo_save_category(uuid,timestamptz,uuid,text,bigint,integer,boolean,boolean),public.expo_create_file(uuid,timestamptz,uuid,text),public.expo_save_file(uuid,timestamptz,uuid,text,text,text,text,text,boolean,text,text,boolean),public.expo_confirm_payment(uuid,timestamptz,bigint,date,text,text),public.expo_void_payment(uuid,timestamptz,text) to authenticated;
revoke all on function public.get_salon_exhibitors(uuid),public.is_public_exhibitor_logo(text) from public,anon,authenticated;
grant execute on function public.get_salon_exhibitors(uuid),public.is_public_exhibitor_logo(text) to anon,authenticated;
commit;
