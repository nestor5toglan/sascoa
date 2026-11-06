import { plainText } from './richText'
import type { EditorialInput, EventInput } from '../types/admin'
/** L'éditeur manipule explicitement les heures UTC, indépendamment du navigateur. */
export function utcInput(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 19) : ''
}
export function fromUtcInput(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value))
    throw new Error('Renseigne une date et une heure UTC valides.')
  const normalized = value.length === 16 ? `${value}:00` : value
  const date = new Date(`${normalized}Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 19) !== normalized)
    throw new Error('La date saisie n’existe pas.')
  return date.toISOString()
}
export function validateEvent(value: EventInput): string {
  if (!value.title.trim() || value.title.length > 200)
    return 'Le titre est obligatoire, avec 200 caractères maximum.'
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value.slug) || value.slug.length > 100)
    return 'L’identifiant doit contenir des minuscules sans accent, chiffres et tirets (100 caractères maximum).'
  if (!plainText(value.description).trim() || value.description.length > 10000)
    return 'La présentation est obligatoire (10 000 caractères maximum).'
  const start = Date.parse(value.starts_at),
    end = Date.parse(value.ends_at)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    return 'La fin doit être strictement postérieure au début.'
  if (!['salon', 'forum', 'conference', 'other'].includes(value.event_type))
    return 'Le type d’événement est invalide.'
  if (!['draft', 'published', 'archived'].includes(value.status)) return 'Le statut est invalide.'
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone: value.timezone }).format(new Date())
  } catch {
    return 'Le fuseau horaire n’est pas reconnu. Exemple : Africa/Lome.'
  }
  if (
    value.registration_deadline &&
    (!Number.isFinite(Date.parse(value.registration_deadline)) ||
      Date.parse(value.registration_deadline) > end)
  )
    return 'La date limite doit être antérieure ou égale à la fin de l’événement.'
  if ((value.location?.length ?? 0) > 500 || (value.program_text?.length ?? 0) > 30000)
    return 'Le lieu ou le programme est trop long.'
  if (
    !Array.isArray(value.speakers) ||
    value.speakers.length > 50 ||
    value.speakers.some(
      (s) =>
        !s ||
        typeof s.name !== 'string' ||
        !s.name.trim() ||
        s.name.length > 200 ||
        (s.role !== undefined && (typeof s.role !== 'string' || s.role.length > 200)),
    )
  )
    return 'Chaque intervenant doit avoir un nom (200 caractères maximum). Limite : 50 intervenants.'
  for (const path of [value.cover_image_path, value.program_pdf_path]) {
    if (path && (path.startsWith('/') || path.includes('..') || path.includes('://')))
      return 'Un chemin de fichier est invalide.'
  }
  return ''
}
function safeImageBody(value: string) {
  return /data-media-path="rich\/[0-9a-f-]{36}\.(?:png|jpg|webp)"/i.test(value)
}
export function validateEditorial(value: EditorialInput): string {
  if (!['pitch', 'hackathon', 'contact', 'a-propos'].includes(value.slug))
    return 'Cette page n’est pas gérée dans cet éditeur.'
  if (!value.title.trim() || value.title.length > 200)
    return 'Le titre est obligatoire (200 caractères maximum).'
  if ((value.summary?.length ?? 0) > 1000 || value.body.length > 50000)
    return 'Le résumé ou le contenu est trop long.'
  if (value.status === 'published' && !plainText(value.body).trim() && !safeImageBody(value.body))
    return 'Rédige le contenu avant de publier la page.'
  if (!['draft', 'published', 'archived'].includes(value.status)) return 'Le statut est invalide.'
  if (
    value.cover_image_path &&
    (value.cover_image_path.startsWith('/') ||
      value.cover_image_path.includes('..') ||
      value.cover_image_path.includes('://'))
  )
    return 'Le chemin de couverture est invalide.'
  return ''
}
