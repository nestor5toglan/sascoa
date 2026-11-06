import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'
import { validateExhibitor, validateFullPayment } from '../lib/exhibitorValidation'
import type {
  StandCategory,
  ExhibitorFile,
  ExhibitorPayment,
  PublicExhibitor,
} from '../types/exhibitors'
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  await useAuthStore().requireAdmin()
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw error
  return data as T
}
export async function exhibitorSalons() {
  await useAuthStore().requireAdmin()
  const all: { id: string; title: string; is_demo: boolean }[] = []
  for (let n = 0; ; n += 200) {
    const { data, error } = await supabase
      .from('events')
      .select('id,title,is_demo')
      .eq('event_type', 'salon')
      .order('starts_at', { ascending: false })
      .order('id')
      .range(n, n + 199)
    if (error) throw error
    all.push(...(data || []))
    if (!data || data.length < 200) return all
  }
}
export async function standCategories(event: string) {
  await useAuthStore().requireAdmin()
  const all: StandCategory[] = []
  for (let n = 0; ; n += 200) {
    const { data, error } = await supabase
      .from('salon_stand_categories')
      .select('id,event_id,name,price_amount,currency,capacity,is_active,is_demo,updated_at')
      .eq('event_id', event)
      .order('price_amount')
      .order('id')
      .range(n, n + 199)
    if (error) throw error
    all.push(...(data || []))
    if (!data || data.length < 200) return all
  }
}
export const saveStandCategory = (
  value: Partial<StandCategory> & {
    event_id: string
    name: string
    price_amount: number
    capacity: number
    is_active: boolean
    is_demo: boolean
  },
) =>
  rpc<StandCategory>('expo_save_category', {
    p_id: value.id || null,
    p_version: value.updated_at || null,
    p_event: value.event_id,
    p_name: value.name,
    p_price: value.price_amount,
    p_capacity: value.capacity,
    p_active: value.is_active,
    p_demo: value.is_demo,
  })
export async function exhibitorRequests(event: string) {
  await useAuthStore().requireAdmin()
  const all: {
    id: string
    reference: string
    organization: string
    first_name: string
    last_name: string
    updated_at: string
  }[] = []
  for (let n = 0; ; n += 200) {
    const { data, error } = await supabase
      .from('salon_preregistrations')
      .select('id,reference,organization,first_name,last_name,updated_at')
      .eq('event_id', event)
      .eq('interest', 'exhibitor')
      .neq('status', 'archived')
      .order('created_at', { ascending: false })
      .order('id')
      .range(n, n + 199)
    if (error) throw error
    all.push(...(data || []))
    if (!data || data.length < 200) return all
  }
}
export async function listExhibitorFiles(event: string, page = 1) {
  await useAuthStore().requireAdmin()
  const { data, error, count } = await supabase
    .from('salon_exhibitor_files')
    .select('*', { count: 'exact' })
    .eq('event_id', event)
    .order('created_at', { ascending: false })
    .order('id')
    .range((page - 1) * 10, page * 10 - 1)
  if (error) throw error
  return { items: (data || []) as ExhibitorFile[], count: count || 0 }
}
export const createExhibitorFile = (
  request: { id: string; updated_at: string },
  category: string,
  stand: string,
) =>
  rpc<ExhibitorFile>('expo_create_file', {
    p_request: request.id,
    p_version: request.updated_at,
    p_category: category,
    p_stand: stand,
  })
export async function saveExhibitorFile(value: ExhibitorFile) {
  const invalid = validateExhibitor(value)
  if (invalid) throw new Error(invalid)
  return rpc<ExhibitorFile>('expo_save_file', {
    p_id: value.id,
    p_version: value.updated_at,
    p_category: value.category_id,
    p_stand: value.stand_number,
    p_name: value.public_name,
    p_description: value.public_description,
    p_website: value.public_website,
    p_logo: value.logo_path,
    p_consent: value.publication_consent,
    p_consent_note: value.consent_note,
    p_status: value.status,
    p_public: value.is_public,
  })
}
export async function exhibitorPayments(file: string) {
  await useAuthStore().requireAdmin()
  const { data, error } = await supabase
    .from('salon_exhibitor_payments')
    .select(
      'id,file_id,amount,currency,paid_on,method,reference,confirmed_at,voided_at,void_reason',
    )
    .eq('file_id', file)
    .order('confirmed_at', { ascending: false })
  if (error) throw error
  return (data || []) as ExhibitorPayment[]
}
export async function confirmExhibitorPayment(
  file: ExhibitorFile,
  amount: number,
  date: string,
  method: string,
  reference: string,
) {
  const invalid = validateFullPayment(amount, file.quoted_amount, date, reference)
  if (invalid) throw new Error(invalid)
  return rpc<ExhibitorFile>('expo_confirm_payment', {
    p_file: file.id,
    p_version: file.updated_at,
    p_amount: amount,
    p_paid_on: date,
    p_method: method,
    p_reference: reference,
  })
}
export const voidExhibitorPayment = (file: ExhibitorFile, reason: string) =>
  rpc<ExhibitorFile>('expo_void_payment', {
    p_file: file.id,
    p_version: file.updated_at,
    p_reason: reason,
  })
export async function publicExhibitors(event: string) {
  const all: PublicExhibitor[] = []
  for (let n = 0; ; n += 200) {
    const { data, error } = await supabase
      .rpc('get_salon_exhibitors', { p_event: event })
      .range(n, n + 199)
    if (error) throw error
    all.push(...(data || []))
    if (!data || data.length < 200) return all
  }
}
