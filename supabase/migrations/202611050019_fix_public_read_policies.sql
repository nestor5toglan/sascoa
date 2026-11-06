begin;

-- Les règles existantes restent utilisées par les comptes connectés.
alter policy companies_read
on public.companies
to authenticated;

alter policy events_read
on public.events
to authenticated;

alter policy partners_read
on public.partners
to authenticated;

-- Les visiteurs voient uniquement les fiches publiques.
create policy companies_anon_read_published
on public.companies
for select
to anon
using (status = 'published');

create policy events_anon_read_published
on public.events
for select
to anon
using (status = 'published');

create policy partners_anon_read_visible
on public.partners
for select
to anon
using (is_visible = true);

commit;