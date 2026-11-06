import { preregInterests } from '../types/preregistration'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'
import type { PreregConfig, PreregSettings, PreregRequest } from '../types/preregistration'
export async function getPreregConfig(): Promise<PreregConfig | null> {
  const { data, error } = await supabase.rpc('get_salon_preregistration')
  if (error) throw error
  return data
}
export async function submitPreregistration(value: Record<string, unknown>): Promise<string> {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/salon-preregistration`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(value),
      signal: AbortSignal.timeout(25000),
    },
  )
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Envoi impossible. Réessaie.')
  if (typeof data.reference !== 'string') throw new Error('Réponse inattendue. Réessaie.')
  return data.reference
}
export async function getPreregSettings(): Promise<PreregSettings> {
  await useAuthStore().requireAdmin()
  const { data, error } = await supabase
    .from('salon_preregistration_settings')
    .select('id,event_id,enabled,notice,notice_version,updated_at')
    .eq('id', true)
    .single()
  if (error) throw error
  return data
}
export async function savePreregSettings(value: PreregSettings) {
  await useAuthStore().requireAdmin()
  const { data, error } = await supabase
    .from('salon_preregistration_settings')
    .update({
      event_id: value.event_id || null,
      enabled: value.enabled,
      notice: value.notice.trim(),
    })
    .eq('id', true)
    .eq('updated_at', value.updated_at)
    .select('id,event_id,enabled,notice,notice_version,updated_at')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Configuration modifiée ailleurs : recharge avant de réessayer.')
  return data as PreregSettings
}
export async function preregSalons(): Promise<{ id: string; title: string }[]> {
  await useAuthStore().requireAdmin()
  const all: { id: string; title: string }[] = []
  for (let start = 0; ; start += 200) {
    const { data, error } = await supabase
      .from('events')
      .select('id,title')
      .eq('event_type', 'salon')
      .eq('status', 'published')
      .gt('ends_at', new Date().toISOString())
      .order('id')
      .range(start, start + 199)
    if (error) throw error
    all.push(...data)
    if (data.length < 200) return all
  }
}
export async function listPreregistrations(page = 1, status = '', interest = '') {
  await useAuthStore().requireAdmin()
  let q = supabase
    .from('salon_preregistrations')
    .select(
      'id,reference,event_id,first_name,last_name,email,phone,organization,interest,message,notice,notice_version,consent_at,status,internal_note,created_at,updated_at',
      { count: 'exact' },
    )
  if (status) q = q.eq('status', status)
  if (interest && interest in preregInterests) q = q.eq('interest', interest)
  const { data, error, count } = await q
    .order('created_at', { ascending: false })
    .order('id')
    .range((page - 1) * 10, page * 10 - 1)
  if (error) throw error
  return { items: (data || []) as PreregRequest[], count: count || 0 }
}
export async function reviewPreregistration(value: PreregRequest) {
  await useAuthStore().requireAdmin()
  const { data, error } = await supabase
    .from('salon_preregistrations')
    .update({ status: value.status, internal_note: value.internal_note.trim() })
    .eq('id', value.id)
    .eq('updated_at', value.updated_at)
    .select('id')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Demande modifiée ailleurs. Rouvre-la avant de réessayer.')
}

export async function deletePreregistration(value: PreregRequest) {
  await useAuthStore().requireAdmin()
  const { error } = await supabase.rpc('delete_salon_preregistration', {
    p_id: value.id,
    p_updated_at: value.updated_at,
  })
  if (error) throw error
}
