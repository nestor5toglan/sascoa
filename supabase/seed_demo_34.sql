-- FACULTATIF. Données entièrement fictives, à exécuter après vérification du schéma.
-- Pas de logo partenaire inventé, aucun compte, aucun mot de passe.
-- Réexécutable sans écraser les fiches existantes portant les mêmes slugs.
-- auth.uid() est généralement NULL dans SQL Editor : auteurs non attribués.
begin;

insert into public.activity_sectors (name, slug, description)
values
  ('Démonstration — Conseil', 'demo-sascoa-conseil', 'Secteur fictif pour les tests du lot 34.'),
  ('Démonstration — Numérique', 'demo-sascoa-numerique', 'Secteur fictif pour les tests du lot 34.')
on conflict (slug) do nothing;

insert into public.companies
  (name, slug, description, sector_id, structure_type, services, specificities, status)
select
  v.name, v.slug, 'Fiche entièrement fictive pour tester l’annuaire SASCOA. Il ne s’agit pas d’une véritable organisation.',
  s.id, v.structure_type, v.services, 'Démonstration uniquement.', 'published'
from (values
  ('Structure de démonstration A', 'demo-sascoa-structure-a', 'demo-sascoa-conseil', 'private', 'Conseil et accompagnement — démonstration'),
  ('Structure de démonstration B', 'demo-sascoa-structure-b', 'demo-sascoa-numerique', 'public', 'Services numériques — démonstration'),
  ('Structure de démonstration C', 'demo-sascoa-structure-c', 'demo-sascoa-conseil', 'individual', 'Formation — démonstration')
) as v(name, slug, sector_slug, structure_type, services)
join public.activity_sectors s on s.slug = v.sector_slug
on conflict (slug) do nothing;

insert into public.events
  (title, slug, description, event_type, starts_at, ends_at, timezone, location,
   program_text, speakers, registrations_open, is_demo, status)
values (
  'SASCOA — édition de démonstration', 'demo-sascoa-edition-2027',
  'Événement entièrement fictif destiné aux tests de la plateforme. Ces dates et ce lieu ne constituent pas une annonce officielle.',
  'salon', '2027-04-15 09:00:00+00', '2027-04-18 17:00:00+00', 'Africa/Lome',
  'Lieu fictif — démonstration',
  E'Programme fictif de test uniquement.\n09 h : accueil de démonstration\n10 h : présentation de la plateforme',
  '[]'::jsonb, false, true, 'published'
)
on conflict (slug) do nothing;

commit;

-- À terme, archiver les données de démonstration avant une ouverture réelle.
-- Pas de suppression automatique, afin de préserver les références existantes.
