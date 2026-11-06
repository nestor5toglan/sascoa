import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'
import { validateEditorial } from '../lib/eventValidation'
import type { EditorialSlug, EditorialPage, EditorialInput } from '../types/admin'
const FIELDS =
  'id,content_type,slug,title,summary,body,cover_image_path,status,published_at,updated_at'
export async function getPublicEditorial(slug: EditorialSlug): Promise<EditorialPage | null> {
  const { data, error } = await supabase
    .from('content_entries')
    .select(FIELDS)
    .eq('content_type', 'page')
    .eq('slug', slug)
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .maybeSingle<EditorialPage>()
  if (error) throw error
  return data
}
export async function getAdminEditorial(slug: EditorialSlug) {
  await useAuthStore().requireAdmin()
  const { data, error } = await supabase
    .from('content_entries')
    .select(FIELDS)
    .eq('content_type', 'page')
    .eq('slug', slug)
    .maybeSingle<EditorialPage>()
  if (error) throw error
  return data
}
export async function saveEditorial(
  input: EditorialInput,
  original?: Pick<EditorialPage, 'id' | 'updated_at'>,
) {
  const validation = validateEditorial(input)
  if (validation) throw new Error(validation)
  await useAuthStore().requireAdmin()
  const payload = {
    content_type: 'page',
    slug: input.slug,
    title: input.title.trim(),
    summary: input.summary?.trim() || null,
    body: input.body.trim(),
    cover_image_path: input.cover_image_path || null,
    status: input.status,
  }
  const query = original
    ? supabase
        .from('content_entries')
        .update(payload)
        .eq('id', original.id)
        .eq('updated_at', original.updated_at)
        .eq('content_type', 'page')
        .eq('slug', input.slug)
    : supabase.from('content_entries').insert(payload)
  const { data, error } = await query.select(FIELDS).maybeSingle<EditorialPage>()
  if (error) throw error
  if (!data)
    throw new Error(
      'La page a été modifiée ailleurs ou n’est plus accessible. Copie tes modifications, recharge la page puis compare avant de réessayer.',
    )
  return data
}
