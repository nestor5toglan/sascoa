import type { ApplicationInput, Program } from '../types/applications'
export const MAX_APPLICATION_PDF = 5 * 1024 * 1024
export function validateApplication(program: Program, form: ApplicationInput, max: number) {
  if (!form.full_name.trim() || !/^\S+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
    return 'Vérifiez votre nom et votre email.'
  if (
    program === 'pitch' &&
    (!form.project_name.trim() || !form.description.trim() || !form.objective.trim())
  )
    return 'Présentez votre projet et son objectif.'
  if (program === 'hackathon' && !form.skills.trim()) return 'Indiquez vos compétences.'
  if (
    form.participation_mode === 'team' &&
    (!form.team_name.trim() ||
      form.members.length < 1 ||
      form.members.length + 1 > max ||
      form.members.some((m) => !m.full_name.trim()) ||
      !form.members_authorized)
  )
    return `Vérifiez les membres et leur autorisation. Maximum : ${max} personnes, responsable inclus.`
  if (!form.consent) return 'Prenez connaissance de la notice avant l’envoi.'
  return ''
}
export async function inspectApplicationPdf(file: File) {
  if (
    !file.size ||
    file.size > MAX_APPLICATION_PDF ||
    (file.type && file.type !== 'application/pdf')
  )
    throw new Error('Choisissez un PDF de 5 Mo maximum.')
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  if (!/^%PDF-[12]\.[0-9]/.test(new TextDecoder().decode(bytes)))
    throw new Error('Le fichier sélectionné n’est pas un PDF reconnu.')
}
export async function encodePdf(file: File) {
  await inspectApplicationPdf(file)
  const bytes = new Uint8Array(await file.arrayBuffer())
  let text = ''
  for (let n = 0; n < bytes.length; n += 32768)
    text += String.fromCharCode(...bytes.subarray(n, n + 32768))
  return { name: file.name, base64: btoa(text) }
}
