export interface ContactSettings {
  id: boolean
  email: string
  phone_primary: string
  phone_secondary: string
  location: string
  website_url: string
  facebook_url: string
  form_enabled: boolean
  notice: string
  notice_version: string
  updated_at: string
}
export interface ContactMessage {
  id: string
  reference: string
  full_name: string
  email: string
  phone: string | null
  organization: string | null
  subject: string
  message: string
  status: string
  internal_note: string | null
  notice: string | null
  consent_at: string | null
  created_at: string
  updated_at: string
}
export const contactStatuses = {
  new: 'Nouveau',
  in_progress: 'En cours',
  resolved: 'Traité',
  archived: 'Archivé',
} as const
