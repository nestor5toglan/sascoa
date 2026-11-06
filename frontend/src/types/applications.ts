export type Program = 'pitch' | 'hackathon'
export type ApplicationConfig = {
  program: Program
  event_id: string
  event_title: string
  deadline: string | null
  team_max_size: number
  notice: string
  notice_version: string
}
export type ProgramSettings = {
  program: Program
  event_id: string | null
  enabled: boolean
  deadline: string | null
  team_max_size: number
  daily_limit: number
  notice: string
  notice_version: string
  updated_at: string
}
export type TeamMember = { full_name: string; skills: string }
export type ApplicationInput = {
  full_name: string
  email: string
  phone: string
  organization: string
  project_name: string
  description: string
  objective: string
  skills: string
  participation_mode: 'individual' | 'team'
  team_name: string
  members: TeamMember[]
  members_authorized: boolean
  consent: boolean
}
export type ProgramApplication = Omit<ApplicationInput, 'consent'> & {
  id: string
  reference: string
  program: Program
  event_id: string
  file_path: string | null
  file_name: string | null
  file_size: number
  status: ApplicationStatus
  internal_note: string
  created_at: string
  updated_at: string
  notice: string
  notice_version: string
  consent_at: string
  reviewed_at: string | null
}
export type ApplicationStatus = 'received' | 'under_review' | 'accepted' | 'rejected' | 'archived'
export const applicationStatuses = {
  received: 'Reçue',
  under_review: 'À étudier',
  accepted: 'Acceptée',
  rejected: 'Refusée',
  archived: 'Archivée',
} as const
