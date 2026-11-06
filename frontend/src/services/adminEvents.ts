import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'
import { searchTerm } from '../lib/presentation'
import { validateEvent } from '../lib/eventValidation'
import { ADMIN_PAGE_SIZE } from './adminCatalog'
import type { AdminEvent, EventInput, PublicationStatus } from '../types/admin'
import type { PageResult } from '../types/public'
const FIELDS =
  'id,title,slug,description,event_type,starts_at,ends_at,timezone,location,cover_image_path,program_text,program_pdf_path,speakers,registrations_open,registration_deadline,is_demo,status,updated_at'
export async function listAdminEvents(
  page = 1,
  search = '',
  status: PublicationStatus | 'all' = 'all',
): Promise<PageResult<AdminEvent>> {
  await useAuthStore().requireAdmin()
  let query = supabase.from('events').select(FIELDS, { count: 'exact' })
  const term = searchTerm(search)
  if (term) query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`)
  if (status !== 'all') query = query.eq('status', status)
  const start = (Math.max(page, 1) - 1) * ADMIN_PAGE_SIZE
  const { data, error, count } = await query
    .order('starts_at', { ascending: false })
    .order('id')
    .range(start, start + ADMIN_PAGE_SIZE - 1)
    .returns<AdminEvent[]>()
  if (error) throw error
  return { items: data ?? [], count: count ?? 0 }
}
export async function saveEvent(
  input: EventInput,
  original?: Pick<AdminEvent, 'id' | 'updated_at'>,
) {
  const validation = validateEvent(input)
  if (validation) throw new Error(validation)
  await useAuthStore().requireAdmin()
  const payload = {
    title: input.title.trim(),
    slug: input.slug,
    description: input.description.trim(),
    event_type: input.event_type,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    timezone: input.timezone.trim(),
    location: input.location?.trim() || null,
    program_text: input.program_text?.trim() || null,
    cover_image_path: input.cover_image_path || null,
    program_pdf_path: input.program_pdf_path || null,
    speakers: input.speakers.map((s) => ({
      ...s,
      name: s.name.trim(),
      role: s.role?.trim() || '',
    })),
    is_demo: input.is_demo,
    status: input.status,
    // Le booléen existant est préservé ; aucun bouton d'ouverture des inscriptions avant le module serveur.
    registrations_open: input.registrations_open,
    registration_deadline: input.registration_deadline,
  }
  const query = original
    ? supabase
        .from('events')
        .update(payload)
        .eq('id', original.id)
        .eq('updated_at', original.updated_at)
    : supabase.from('events').insert(payload)
  const { data, error } = await query.select(FIELDS).maybeSingle<AdminEvent>()
  if (error) throw error
  if (!data)
    throw new Error(
      'Cet événement a été modifié ailleurs ou n’est plus accessible. Actualise la liste puis rouvre-le avec Modifier. Tes saisies sont conservées.',
    )
  return data
}
