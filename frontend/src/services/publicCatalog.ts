import { supabase } from '../lib/supabase'
import { searchTerm } from '../lib/presentation'
import type { Company, Partner, Sector, SalonEvent, PageResult } from '../types/public'

export const PAGE_SIZE = 9
const COMPANY_FIELDS =
  'id,name,slug,description,sector_id,structure_type,services,specificities,logo_path,address,phone,public_email,website_url,sector:activity_sectors(name)'
const EVENT_FIELDS =
  'id,title,slug,description,event_type,starts_at,ends_at,timezone,location,cover_image_path,program_text,program_pdf_path,speakers,registrations_open,registration_deadline,is_demo'

export async function getSectors(): Promise<Sector[]> {
  const all: Sector[] = []
  for (let start = 0; ; start += 200) {
    const { data, error } = await supabase
      .from('activity_sectors')
      .select('id,name,slug,parent_id')
      .order('name')
      .order('id')
      .range(start, start + 199)
    if (error) throw error
    all.push(...(data ?? []))
    if (!data || data.length < 200) return all
  }
}

export async function getCompanies(
  page: number,
  text = '',
  sectorId = '',
): Promise<PageResult<Company>> {
  if (sectorId) {
    const { data, error } = await supabase.rpc('search_public_companies_by_sector', {
      p_sector: sectorId,
      p_search: searchTerm(text),
      p_page: Math.max(1, page),
      p_size: PAGE_SIZE,
    })
    if (error) throw error
    return data as PageResult<Company>
  }
  let query = supabase
    .from('companies')
    .select(COMPANY_FIELDS, { count: 'exact' })
    .eq('status', 'published')
  const term = searchTerm(text)
  if (term)
    query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%,services.ilike.%${term}%`)
  if (sectorId) query = query.eq('sector_id', sectorId)
  const start = (Math.max(1, page) - 1) * PAGE_SIZE
  const { data, count, error } = await query
    .order('name')
    .order('id')
    .range(start, start + PAGE_SIZE - 1)
    .returns<Company[]>()
  if (error) throw error
  return { items: data ?? [], count: count ?? 0 }
}

export async function getEvents(
  page: number,
  period: 'upcoming' | 'past' | 'all' = 'upcoming',
  text = '',
  size = PAGE_SIZE,
  scope: 'all' | 'salon' | 'other' = 'all',
): Promise<PageResult<SalonEvent>> {
  let query = supabase
    .from('events')
    .select(EVENT_FIELDS, { count: 'exact' })
    .eq('status', 'published')
  if (scope === 'salon') query = query.eq('event_type', 'salon')
  if (scope === 'other') query = query.neq('event_type', 'salon')
  const now = new Date().toISOString()
  if (period === 'upcoming') query = query.gte('ends_at', now)
  if (period === 'past') query = query.lt('ends_at', now)
  const term = searchTerm(text)
  if (term) query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`)
  const start = (Math.max(1, page) - 1) * size
  const { data, count, error } = await query
    .order('starts_at', { ascending: period !== 'past' })
    .order('id')
    .range(start, start + size - 1)
    .returns<SalonEvent[]>()
  if (error) throw error
  return { items: data ?? [], count: count ?? 0 }
}

export async function getPartners(): Promise<Partner[]> {
  const items: Partner[] = []
  for (let start = 0; ; start += 200) {
    const { data, error } = await supabase
      .from('partners')
      .select('id,name,category,logo_path,website_url,description')
      .eq('is_visible', true)
      .order('display_order')
      .order('name')
      .order('id')
      .range(start, start + 199)
    if (error) throw error
    items.push(...(data ?? []))
    if (!data || data.length < 200) return items
  }
}

export async function getEvent(id: string): Promise<SalonEvent | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_FIELDS)
    .eq('status', 'published')
    .eq('id', id)
    .maybeSingle<SalonEvent>()
  if (error) throw error
  return data
}
