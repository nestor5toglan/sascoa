import type { Company } from './public'
export type AdminProfile = {
  username: string
  display_name: string
  role: 'root' | 'director'
  is_active: boolean
}
export type PublicationStatus = 'draft' | 'published' | 'archived'
export type AdminSector = {
  parent_id?: string | null
  id: string
  name: string
  slug: string
  description: string | null
  updated_at: string
}
export type SectorInput = Pick<AdminSector, 'name' | 'slug' | 'description' | 'parent_id'>
export type AdminCompany = Company & { status: PublicationStatus; updated_at: string }
export type CompanyInput = Omit<AdminCompany, 'id' | 'updated_at' | 'sector'>

export type Speaker = { name: string; role?: string; [key: string]: unknown }
export type AdminEvent = Omit<import('./public').SalonEvent, 'speakers'> & {
  speakers: Speaker[]
  status: PublicationStatus
  updated_at: string
}
export type EventInput = Omit<AdminEvent, 'id' | 'updated_at'>
export type EditorialSlug = 'pitch' | 'hackathon' | 'contact' | 'a-propos'
export type EditorialPage = {
  id: string
  content_type: 'page'
  slug: EditorialSlug
  title: string
  summary: string | null
  body: string
  cover_image_path: string | null
  status: PublicationStatus
  published_at: string | null
  updated_at: string
}
export type EditorialInput = Pick<
  EditorialPage,
  'slug' | 'title' | 'summary' | 'body' | 'cover_image_path' | 'status'
>
