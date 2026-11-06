import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'
import type {
  Program,
  ProgramSettings,
  ApplicationConfig,
  ProgramApplication,
  ApplicationStatus,
} from '../types/applications'
export async function getApplicationConfig(program: Program): Promise<ApplicationConfig | null> {
  const { data, error } = await supabase.rpc('get_program_application_config', {
    p_program: program,
  })
  if (error) throw error
  return data
}
export async function submitApplication(value: Record<string, unknown>): Promise<string> {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/program-application`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(value),
      signal: AbortSignal.timeout(90000),
    },
  )
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Envoi impossible. Réessayez.')
  if (typeof data.reference !== 'string')
    throw new Error('Réponse inattendue. Réessayez avec les mêmes informations.')
  return data.reference
}
export async function getProgramSettings(program: Program): Promise<ProgramSettings> {
  await useAuthStore().requireAdmin()
  const { data, error } = await supabase
    .from('program_application_settings')
    .select(
      'program,event_id,enabled,deadline,team_max_size,daily_limit,notice,notice_version,updated_at',
    )
    .eq('program', program)
    .single()
  if (error) throw error
  return data
}
export async function saveProgramSettings(value: ProgramSettings) {
  await useAuthStore().requireAdmin()
  const { data, error } = await supabase.rpc('save_program_application_settings', {
    p_program: value.program,
    p_version: value.updated_at,
    p_event: value.event_id || null,
    p_enabled: value.enabled,
    p_deadline: value.deadline,
    p_team_max: value.team_max_size,
    p_daily_limit: value.daily_limit,
    p_notice: value.notice,
  })
  if (error) throw error
  return data as ProgramSettings
}
export async function listApplications(
  program: Program,
  page = 1,
  status: ApplicationStatus | 'all' = 'all',
) {
  await useAuthStore().requireAdmin()
  let q = supabase
    .from('program_applications')
    .select(
      'id,reference,program,event_id,full_name,email,phone,organization,project_name,description,objective,skills,participation_mode,team_name,members,members_authorized,notice,notice_version,consent_at,file_path,file_name,file_size,status,internal_note,created_at,updated_at,reviewed_at',
      { count: 'exact' },
    )
    .eq('program', program)
  if (status !== 'all') q = q.eq('status', status)
  const { data, error, count } = await q
    .order('created_at', { ascending: false })
    .order('id')
    .range((page - 1) * 10, page * 10 - 1)
  if (error) throw error
  return { items: (data || []) as ProgramApplication[], count: count || 0 }
}
export async function reviewApplication(value: ProgramApplication) {
  await useAuthStore().requireAdmin()
  const { data, error } = await supabase.rpc('review_program_application', {
    p_id: value.id,
    p_version: value.updated_at,
    p_status: value.status,
    p_note: value.internal_note || '',
  })
  if (error) throw error
  return data as ProgramApplication
}
export async function applicationPdfLink(path: string) {
  await useAuthStore().requireAdmin()
  if (!/^applications\/[0-9a-f-]{36}\.pdf$/i.test(path))
    throw new Error('Chemin de document invalide.')
  const { data, error } = await supabase.storage
    .from('sascoa-private')
    .createSignedUrl(path, 60, { download: true })
  if (error || !data?.signedUrl)
    throw new Error('Document inaccessible. Vérifie la session et les permissions.')
  return data.signedUrl
}
