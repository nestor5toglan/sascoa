import { safeHttpUrl } from './presentation'
import type { PartnerInput } from '../types/partners'
export function validatePartner(value: PartnerInput) {
  if (!value.name.trim() || value.name.length > 200)
    return 'Renseigne un nom de 200 caractères maximum.'
  if (!value.category.trim() || value.category.length > 100)
    return 'Renseigne une catégorie de 100 caractères maximum.'
  if (value.website_url && !safeHttpUrl(value.website_url))
    return 'Utilise une adresse de site http:// ou https:// valide.'
  if (
    !Number.isInteger(value.display_order) ||
    value.display_order < 0 ||
    value.display_order > 2147483647
  )
    return 'L’ordre doit être un entier positif ou nul.'
  if ((value.description?.length || 0) > 5000) return 'Limite la description à 5 000 caractères.'
  if (
    value.logo_path &&
    (!/^[a-zA-Z0-9_./-]+$/.test(value.logo_path) ||
      value.logo_path.includes('..') ||
      value.logo_path.startsWith('/'))
  )
    return 'Le logo doit être un chemin relatif au stockage.'
  if (value.is_visible && !value.logo_path)
    return 'Ajoute un logo avant de rendre ce partenaire visible.'
  return ''
}
