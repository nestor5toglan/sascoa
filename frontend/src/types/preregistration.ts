export interface PreregConfig {
  event_id: string
  title: string
  starts_at: string
  ends_at: string
  notice: string
  notice_version: string
}
export interface PreregSettings {
  id: boolean
  event_id: string | null
  enabled: boolean
  notice: string
  notice_version: string
  updated_at: string
}
export interface PreregRequest {
  id: string
  reference: string
  event_id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  organization: string
  interest: string
  message: string
  notice: string
  notice_version: string
  consent_at: string
  status: string
  internal_note: string
  created_at: string
  updated_at: string
}
export const preregStatuses = {
  received: 'Reçue',
  under_review: 'À étudier',
  contacted: 'Contact établi',
  archived: 'Archivée',
} as const
export const preregInterests = {
  visitor: 'Visiteur',
  exhibitor: 'Exposant',
  partner: 'Partenaire',
  press: 'Presse',
} as const
