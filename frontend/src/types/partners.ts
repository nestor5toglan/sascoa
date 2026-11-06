import type { Partner } from './public'
export type AdminPartner = Partner & {
  is_visible: boolean
  display_order: number
  updated_at: string
}
export type PartnerInput = Omit<AdminPartner, 'id' | 'updated_at'>
