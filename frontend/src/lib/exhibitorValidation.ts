import { safeHttpUrl } from './presentation'
import type { ExhibitorFile } from '../types/exhibitors'
export const money = (value: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    maximumFractionDigits: 0,
  }).format(value)
export function validateExhibitor(value: ExhibitorFile) {
  if (!value.public_name.trim() || value.public_name.length > 200)
    return 'Renseigne un nom public de 200 caractères maximum.'
  if (!value.stand_number.trim() || value.stand_number.length > 40)
    return 'Renseigne un numéro de stand de 40 caractères maximum.'
  if (value.public_description.length > 2000) return 'Limite la présentation à 2 000 caractères.'
  if (value.public_website && !safeHttpUrl(value.public_website))
    return 'Renseigne un site HTTP(S) valide.'
  if (value.publication_consent && value.consent_note.trim().length < 5)
    return 'Consigne la source et la date de l’accord de publication.'
  if (value.is_public && (value.status !== 'admitted' || !value.publication_consent))
    return 'La publication exige une admission et un accord consigné.'
  return ''
}
export function validateFullPayment(
  amount: number,
  expected: number,
  date: string,
  reference: string,
) {
  if (!Number.isInteger(amount) || amount !== expected)
    return 'Le montant doit correspondre au tarif intégral enregistré.'
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date ||
    date > new Date().toISOString().slice(0, 10)
  )
    return 'Renseigne une date de paiement non future.'
  if (!reference.trim() || reference.length > 200)
    return 'Renseigne une référence de 200 caractères maximum.'
  return ''
}
