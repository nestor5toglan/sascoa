export type StandCategory = {
  id: string
  event_id: string
  name: string
  price_amount: number
  currency: 'XOF'
  capacity: number
  is_active: boolean
  is_demo: boolean
  updated_at: string
}
export type ExhibitorFile = {
  id: string
  request_id: string | null
  event_id: string
  category_id: string
  stand_number: string
  quoted_amount: number
  currency: 'XOF'
  status: 'pending' | 'admitted' | 'cancelled'
  public_name: string
  public_description: string
  public_website: string
  logo_path: string | null
  publication_consent: boolean
  consent_note: string
  consent_recorded_at: string | null
  is_public: boolean
  is_demo: boolean
  updated_at: string
}
export type ExhibitorPayment = {
  id: string
  file_id: string
  amount: number
  currency: string
  paid_on: string
  method: string
  reference: string
  confirmed_at: string
  voided_at: string | null
  void_reason: string | null
}
export type PublicExhibitor = Pick<
  ExhibitorFile,
  | 'id'
  | 'public_name'
  | 'public_description'
  | 'public_website'
  | 'logo_path'
  | 'stand_number'
  | 'is_demo'
> & { category_name: string }
export const exhibitStatuses = {
  pending: 'En attente',
  admitted: 'Admis',
  cancelled: 'Annulé',
} as const
export const paymentMethods = {
  cash: 'Espèces',
  bank_transfer: 'Virement',
  mobile_money: 'Mobile Money',
  other: 'Autre',
} as const
