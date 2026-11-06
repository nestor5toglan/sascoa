import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'
import { searchTerm } from '../lib/presentation'
import { validatePartner } from '../lib/partnerValidation'
import type { AdminPartner, PartnerInput } from '../types/partners'
const fields =
  'id,name,category,description,logo_path,website_url,display_order,is_visible,updated_at'
export async function listAdminPartners(page = 1, search = '') {
  await useAuthStore().requireAdmin()
  let query = supabase.from('partners').select(fields, { count: 'exact' })
  const term = searchTerm(search)
  if (term) query = query.ilike('name', `%${term}%`)
  const { data, error, count } = await query
    .order('display_order')
    .order('name')
    .order('id')
    .range((page - 1) * 10, page * 10 - 1)
    .returns<AdminPartner[]>()
  if (error) throw error
  return { items: data || [], count: count || 0 }
}
export async function savePartner(
  input: PartnerInput,
  original?: Pick<AdminPartner, 'id' | 'updated_at'>,
) {
  const invalid = validatePartner(input)
  if (invalid) throw new Error(invalid)
  await useAuthStore().requireAdmin()
  const payload = {
    name: input.name.trim(),
    category: input.category.trim(),
    description: input.description?.trim() || null,
    logo_path: input.logo_path || null,
    website_url: input.website_url?.trim() || null,
    display_order: input.display_order,
    is_visible: input.is_visible,
  }
  const query = original
    ? supabase
        .from('partners')
        .update(payload)
        .eq('id', original.id)
        .eq('updated_at', original.updated_at)
    : supabase.from('partners').insert(payload)
  const { data, error } = await query.select(fields).maybeSingle<AdminPartner>()
  if (error) throw error
  if (!data)
    throw new Error(
      'Partenaire modifié ailleurs ou inaccessible. Recharge la liste puis rouvre sa fiche. Tes saisies sont conservées.',
    )
  return data
}
