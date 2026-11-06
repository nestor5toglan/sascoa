import { plainText } from './richText'
import { safeHttpUrl, readableEmail } from './presentation'
import type { CompanyInput, SectorInput } from '../types/admin'
export function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100)
    .replace(/-$/g, '')
}
export function validateSector(value: SectorInput): string {
  if (!value.name.trim() || value.name.trim().length > 200)
    return 'Le nom est obligatoire, avec 200 caractères maximum.'
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value.slug) || value.slug.length > 100)
    return 'Utilise un identifiant de 100 caractères maximum : lettres minuscules sans accent, chiffres et tirets.'
  if ((value.description?.length ?? 0) > 10000) return 'La description dépasse 10 000 caractères.'
  return ''
}
export function validateCompany(value: CompanyInput): string {
  const base = validateSector(value)
  if (base) return base
  if (!plainText(value.description).trim()) return 'La description est obligatoire.'
  if (!value.sector_id) return 'Sélectionne un secteur d’activité.'
  if (!['private', 'public', 'individual'].includes(value.structure_type))
    return 'Sélectionne un type de structure valide.'
  if (!['draft', 'published', 'archived'].includes(value.status))
    return 'Sélectionne un statut valide.'
  if (value.website_url && (!safeHttpUrl(value.website_url) || value.website_url.length > 2048))
    return 'Le site web doit être une adresse HTTP ou HTTPS valide, sans identifiants.'
  if (value.public_email && (!readableEmail(value.public_email) || value.public_email.length > 254))
    return 'L’adresse email publique est invalide.'
  if ((value.services?.length ?? 0) > 5000 || (value.specificities?.length ?? 0) > 5000)
    return 'Les services et spécificités sont limités à 5 000 caractères chacun.'
  if ((value.address?.length ?? 0) > 500 || (value.phone?.length ?? 0) > 60)
    return 'L’adresse ou le téléphone est trop long.'
  if (
    value.logo_path &&
    (value.logo_path.startsWith('/') ||
      value.logo_path.includes('..') ||
      value.logo_path.includes('://'))
  )
    return 'Le chemin du logo est invalide.'
  return ''
}
export function adminError(cause: unknown): string {
  const code = cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : ''
  if (code === '23505') return 'Ce nom ou cet identifiant est déjà utilisé. Choisis-en un autre.'
  if (code === '23503')
    return 'Une référence n’est plus disponible. Recharge les secteurs puis réessaie.'
  if (code === '42501') return 'Opération refusée. Vérifie ta session et les permissions Supabase.'
  if (code === '23514')
    return 'Un champ ne respecte pas les règles de la base. Vérifie les valeurs saisies.'
  if (cause && typeof cause === 'object' && 'message' in cause) return String(cause.message)
  return 'Impossible de terminer cette opération. Réessaie dans un instant.'
}
export function safeAdminRedirect(value: unknown): string {
  if (typeof value !== 'string') return '/administration/tableau-de-bord'
  const allowed = [
    '/administration/tableau-de-bord',
    '/administration/candidatures/pitch',
    '/administration/candidatures/hackathon',
    '/administration/partenaires',
    '/administration/exposants',
    '/administration/secteurs',
    '/administration/entreprises',
    '/administration/evenements',
    '/administration/preinscriptions',
    '/administration/pages/contact',
    '/administration/pages/a-propos',
    '/administration/messages',
    '/administration/pages/pitch',
    '/administration/pages/hackathon',
  ]
  return allowed.includes(value) ? value : allowed[0]!
}
