import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'
import { descendantIds } from '../lib/sectorTree'
import { searchTerm } from '../lib/presentation'
import { validateCompany, validateSector } from '../lib/adminValidation'
import type {
  AdminCompany,
  AdminSector,
  CompanyInput,
  SectorInput,
  PublicationStatus,
} from '../types/admin'
import type { PageResult } from '../types/public'
export const ADMIN_PAGE_SIZE = 10
const SECTOR_FIELDS = 'id,name,slug,description,parent_id,updated_at'
const COMPANY_FIELDS =
  'id,name,slug,description,sector_id,structure_type,services,specificities,logo_path,address,phone,public_email,website_url,status,updated_at,sector:activity_sectors(name)'
const conflict = () =>
  new Error(
    'Cette fiche a été modifiée ailleurs ou n’est plus accessible. Actualise la liste, puis rouvre la fiche avec Modifier avant de réessayer. Tes saisies sont conservées pour comparaison.',
  )
const clean = (value: string | null) => value?.trim() || null

export async function listAdminSectors(page = 1, search = ''): Promise<PageResult<AdminSector>> {
  await useAuthStore().requireAdmin()
  let query = supabase.from('activity_sectors').select(SECTOR_FIELDS, { count: 'exact' })
  const term = searchTerm(search)
  if (term) query = query.ilike('name', `%${term}%`)
  const start = (Math.max(page, 1) - 1) * ADMIN_PAGE_SIZE
  const { data, error, count } = await query
    .order('name')
    .order('id')
    .range(start, start + ADMIN_PAGE_SIZE - 1)
    .returns<AdminSector[]>()
  if (error) throw error
  return { items: data ?? [], count: count ?? 0 }
}
export async function sectorOptions(): Promise<Pick<AdminSector, 'id' | 'name' | 'parent_id'>[]> {
  await useAuthStore().requireAdmin()
  const all: Pick<AdminSector, 'id' | 'name' | 'parent_id'>[] = []
  for (let start = 0; ; start += 200) {
    const { data, error } = await supabase
      .from('activity_sectors')
      .select('id,name,parent_id')
      .order('name')
      .order('id')
      .range(start, start + 199)
    if (error) throw error
    all.push(...(data ?? []))
    if (!data || data.length < 200) return all
  }
}
export async function saveSector(
  input: SectorInput,
  original?: Pick<AdminSector, 'id' | 'updated_at'>,
) {
  const validation = validateSector(input)
  if (validation) throw new Error(validation)
  await useAuthStore().requireAdmin()
  const payload = {
    name: input.name.trim(),
    slug: input.slug,
    description: clean(input.description),
    parent_id: input.parent_id || null,
  }
  const query = original
    ? supabase
        .from('activity_sectors')
        .update(payload)
        .eq('id', original.id)
        .eq('updated_at', original.updated_at)
    : supabase.from('activity_sectors').insert(payload)
  const { data, error } = await query.select(SECTOR_FIELDS).maybeSingle<AdminSector>()
  if (error) throw error
  if (!data) throw conflict()
  return data
}
export async function listAdminCompanies(
  page = 1,
  search = '',
  status: PublicationStatus | 'all' = 'all',
  sectorId = '',
): Promise<PageResult<AdminCompany>> {
  await useAuthStore().requireAdmin()
  let query = supabase.from('companies').select(COMPANY_FIELDS, { count: 'exact' })
  const term = searchTerm(search)
  if (term) query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`)
  if (status !== 'all') query = query.eq('status', status)
  if (sectorId) query = query.in('sector_id', [...descendantIds(await sectorOptions(), sectorId)])
  const start = (Math.max(page, 1) - 1) * ADMIN_PAGE_SIZE
  const { data, error, count } = await query
    .order('name')
    .order('id')
    .range(start, start + ADMIN_PAGE_SIZE - 1)
    .returns<AdminCompany[]>()
  if (error) throw error
  return { items: data ?? [], count: count ?? 0 }
}
export async function saveCompany(
  input: CompanyInput,
  original?: Pick<AdminCompany, 'id' | 'updated_at'>,
) {
  const validation = validateCompany(input)
  if (validation) throw new Error(validation)
  await useAuthStore().requireAdmin()
  // Liste blanche : aucun rôle/auteur/date technique ou champ caché reçu du formulaire.
  const payload = {
    name: input.name.trim(),
    slug: input.slug,
    description: input.description.trim(),
    sector_id: input.sector_id,
    structure_type: input.structure_type,
    status: input.status,
    services: clean(input.services),
    specificities: clean(input.specificities),
    logo_path: clean(input.logo_path),
    address: clean(input.address),
    phone: clean(input.phone),
    public_email: clean(input.public_email),
    website_url: clean(input.website_url),
  }
  const query = original
    ? supabase
        .from('companies')
        .update(payload)
        .eq('id', original.id)
        .eq('updated_at', original.updated_at)
    : supabase.from('companies').insert(payload)
  const { data, error } = await query.select(COMPANY_FIELDS).maybeSingle<AdminCompany>()
  if (error) throw error
  if (!data) throw conflict()
  return data
}
export async function getAdminCounts() {
  await useAuthStore().requireAdmin()
  const results = await Promise.all([
    supabase.from('activity_sectors').select('id', { count: 'exact', head: true }),
    supabase.from('companies').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
    supabase
      .from('companies')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published'),
    supabase
      .from('companies')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'archived'),
  ])
  for (const result of results) if (result.error) throw result.error
  return {
    sectors: results[0]!.count ?? 0,
    drafts: results[1]!.count ?? 0,
    published: results[2]!.count ?? 0,
    archived: results[3]!.count ?? 0,
  }
}
