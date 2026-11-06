import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'
import { safeHttpUrl, readableEmail } from '../lib/presentation'
import type { ContactSettings, ContactMessage } from '../types/contact'
const FIELDS =
  'id,email,phone_primary,phone_secondary,location,website_url,facebook_url,form_enabled,notice,notice_version,updated_at'
export async function getContactSettings(): Promise<ContactSettings> {
  const { data, error } = await supabase
    .from('site_contact_settings')
    .select(FIELDS)
    .eq('id', true)
    .single()
  if (error) throw error
  return data
}
export async function saveContactSettings(value: ContactSettings) {
  if (
    !readableEmail(value.email) ||
    value.email.length > 254 ||
    !safeHttpUrl(value.website_url) ||
    !safeHttpUrl(value.facebook_url)
  )
    throw new Error('Vérifie l’email et les liens HTTP ou HTTPS.')
  await useAuthStore().requireAdmin()
  const { data, error } = await supabase
    .from('site_contact_settings')
    .update({
      email: value.email.trim(),
      phone_primary: value.phone_primary.trim(),
      phone_secondary: value.phone_secondary.trim(),
      location: value.location.trim(),
      website_url: value.website_url.trim(),
      facebook_url: value.facebook_url.trim(),
      form_enabled: value.form_enabled,
      notice: value.notice.trim(),
    })
    .eq('id', true)
    .eq('updated_at', value.updated_at)
    .select(FIELDS)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Coordonnées modifiées ailleurs. Recharge avant de réessayer.')
  return data as ContactSettings
}
export async function sendContact(value: Record<string, unknown>): Promise<string> {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contact-message`,
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
export async function listContactMessages(page = 1, status = '') {
  await useAuthStore().requireAdmin()
  let q = supabase
    .from('contact_messages')
    .select(
      'id,reference,full_name,email,phone,organization,subject,message,status,internal_note,notice,consent_at,created_at,updated_at',
      { count: 'exact' },
    )
  if (status) q = q.eq('status', status)
  const { data, error, count } = await q
    .order('created_at', { ascending: false })
    .order('id')
    .range((page - 1) * 10, page * 10 - 1)
  if (error) throw error
  return { items: (data || []) as ContactMessage[], count: count || 0 }
}
export async function reviewContact(value: ContactMessage) {
  await useAuthStore().requireAdmin()
  const { error } = await supabase.rpc('review_contact_message', {
    p_id: value.id,
    p_updated_at: value.updated_at,
    p_status: value.status,
    p_note: value.internal_note || '',
  })
  if (error) throw error
}
