import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'
export const MAX_LOGO_SIZE = 2 * 1024 * 1024
export async function inspectLogo(file: File): Promise<{ mime: string; extension: string }> {
  if (!file.size || file.size > MAX_LOGO_SIZE) throw new Error('Choisis une image de 2 Mo maximum.')
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  let type: { mime: string; extension: string } | undefined
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte))
    type = { mime: 'image/png', extension: 'png' }
  else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    type = { mime: 'image/jpeg', extension: 'jpg' }
  else if (
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  )
    type = { mime: 'image/webp', extension: 'webp' }
  if (!type || (file.type && file.type !== type.mime))
    throw new Error('Choisis une véritable image JPEG, PNG ou WebP.')
  return type
}
export async function uploadCompanyLogo(file: File) {
  const type = await inspectLogo(file)
  await useAuthStore().requireAdmin()
  const path = `companies/${crypto.randomUUID()}.${type.extension}`
  const { error } = await supabase.storage.from('sascoa-media').upload(path, file, {
    contentType: type.mime,
    upsert: false,
    cacheControl: '3600',
  })
  if (error) throw error
  return path
}

/** Fichiers éditoriaux publics après rattachement à un contenu publié. */
export async function uploadEditorialFile(
  file: File,
  folder: 'events' | 'pages' | 'rich' | 'partners' | 'exhibitors',
  kind: 'image' | 'pdf',
) {
  let type: { mime: string; extension: string }
  if (kind === 'image') type = await inspectLogo(file)
  else {
    if (!file.size || file.size > 10 * 1024 * 1024)
      throw new Error('Choisis un PDF de 10 Mo maximum.')
    const header = new Uint8Array(await file.slice(0, 5).arrayBuffer())
    if (
      String.fromCharCode(...header) !== '%PDF-' ||
      (file.type && file.type !== 'application/pdf')
    )
      throw new Error('Choisis un véritable fichier PDF.')
    type = { mime: 'application/pdf', extension: 'pdf' }
  }
  await useAuthStore().requireAdmin()
  const path = `${folder}/${crypto.randomUUID()}.${type.extension}`
  const { error } = await supabase.storage
    .from('sascoa-media')
    .upload(path, file, { contentType: type.mime, upsert: false, cacheControl: '3600' })
  if (error) throw error
  return path
}
