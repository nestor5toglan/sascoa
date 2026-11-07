export type Sector = { id: string; name: string; slug: string; parent_id?: string | null }
export type Company = {
  id: string
  name: string
  slug: string
  description: string
  sector_id: string
  structure_type: 'private' | 'public' | 'individual'
  services: string | null
  specificities: string | null
  logo_path: string | null
  address: string | null
  phone: string | null
  public_email: string | null
  website_url: string | null
  sector: { name: string } | null
}
export type SalonEvent = {
  id: string
  title: string
  slug: string
  description: string
  event_type: 'salon' | 'forum' | 'conference' | 'other'
  starts_at: string
  ends_at: string
  timezone: string
  location: string | null
  cover_image_path: string | null
  program_text: string | null
  program_pdf_path: string | null
  speakers: unknown
  registrations_open: boolean
  registration_deadline: string | null
  is_demo: boolean
}
export type Partner = {
  id: string
  name: string
  category: string
  logo_path: string | null
  website_url: string | null
  description: string | null
}
export type PageResult<T> = { items: T[]; count: number }
