import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fromUtcInput, utcInput, validateEditorial, validateEvent } from '../lib/eventValidation'
import type { EditorialInput, EventInput } from '../types/admin'
const api = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  lte: vi.fn(),
  select: vi.fn(),
  result: vi.fn(),
}))
vi.mock('../stores/auth', () => ({ useAuthStore: () => ({ requireAdmin: api.requireAdmin }) }))
vi.mock('../lib/supabase', () => ({ supabase: { from: api.from } }))
import { saveEvent } from '../services/adminEvents'
import { getPublicEditorial, saveEditorial } from '../services/editorial'
const event: EventInput = {
  title: 'Rencontre fictive',
  slug: 'rencontre-fictive',
  description: 'Présentation de test',
  event_type: 'other',
  starts_at: '2027-04-15T09:00:00Z',
  ends_at: '2027-04-15T17:00:00Z',
  timezone: 'Africa/Lome',
  location: null,
  program_text: null,
  program_pdf_path: null,
  cover_image_path: null,
  speakers: [],
  registrations_open: false,
  registration_deadline: null,
  is_demo: true,
  status: 'draft',
}
const editorial: EditorialInput = {
  slug: 'pitch',
  title: 'Pitch',
  summary: null,
  body: 'Présentation approuvée de démonstration.',
  cover_image_path: null,
  status: 'published',
}
beforeEach(() => {
  api.requireAdmin.mockResolvedValue(undefined)
  const chain = {
    insert: api.insert,
    update: api.update,
    eq: api.eq,
    lte: api.lte,
    select: api.select,
    maybeSingle: api.result,
  }
  api.from.mockReturnValue(chain)
  api.insert.mockReturnValue(chain)
  api.update.mockReturnValue(chain)
  api.eq.mockReturnValue(chain)
  api.lte.mockReturnValue(chain)
  api.select.mockReturnValue(chain)
  api.result.mockResolvedValue({
    data: { ...event, id: 'event', updated_at: 'version-2' },
    error: null,
  })
})
describe('Dates UTC et informations événement', () => {
  it('convertit les heures UTC sans utiliser le fuseau du navigateur', () => {
    expect(fromUtcInput('2027-04-15T09:00')).toBe('2027-04-15T09:00:00.000Z')
    expect(utcInput('2027-04-15T11:00:00+02:00')).toBe('2027-04-15T09:00:00')
  })
  it.each(['2027-02-30T09:00', '2027-04-15T25:00', '15/04/2027 09:00'])(
    'refuse la date invalide %s',
    (value) => {
      expect(() => fromUtcInput(value)).toThrow()
    },
  )
  it('refuse une fin avant le début et un fuseau inconnu', () => {
    expect(validateEvent({ ...event, ends_at: event.starts_at })).toContain('postérieure')
    expect(validateEvent({ ...event, timezone: 'Fuseau/inconnu' })).toContain('fuseau')
  })
  it('refuse une échéance après la fin et un intervenant sans nom', () => {
    expect(validateEvent({ ...event, registration_deadline: '2028-01-01T00:00:00Z' })).toContain(
      'date limite',
    )
    expect(validateEvent({ ...event, speakers: [{ name: '', role: 'Test' }] })).toContain(
      'intervenant',
    )
  })
  it('enregistre un événement fictif sans champs auteur injectés ni ouverture implicite des inscriptions', async () => {
    await saveEvent({ ...event, created_by: 'usurpé' } as EventInput)
    expect(api.insert).toHaveBeenCalledWith(
      expect.objectContaining({ is_demo: true, registrations_open: false }),
    )
    expect(api.insert.mock.calls[0]![0]).not.toHaveProperty('created_by')
  })
  it('protège la version et ne traite pas un conflit comme une réussite', async () => {
    api.result.mockResolvedValue({ data: null, error: null })
    await expect(saveEvent(event, { id: 'event', updated_at: 'version-1' })).rejects.toThrow(
      'modifié ailleurs',
    )
    expect(api.eq).toHaveBeenCalledWith('updated_at', 'version-1')
  })
})
describe('Pages Pitch et Hackathon', () => {
  it('interdit de publier une page vide mais autorise un brouillon', () => {
    expect(validateEditorial({ ...editorial, body: '' })).toContain('contenu')
    expect(validateEditorial({ ...editorial, body: '', status: 'draft' })).toBe('')
  })
  it('limite l’éditeur aux deux slugs prévus', () => {
    expect(
      validateEditorial({ ...editorial, slug: 'page-inconnue' } as unknown as EditorialInput),
    ).toContain('pas gérée')
  })
  it('la lecture publique exclut explicitement brouillons et dates futures même pour un admin connecté', async () => {
    await getPublicEditorial('hackathon')
    expect(api.eq).toHaveBeenCalledWith('status', 'published')
    expect(api.eq).toHaveBeenCalledWith('content_type', 'page')
    expect(api.eq).toHaveBeenCalledWith('slug', 'hackathon')
    expect(api.lte).toHaveBeenCalledWith('published_at', expect.any(String))
    expect(api.requireAdmin).not.toHaveBeenCalled()
  })
  it('conserve les métadonnées de publication existantes et n’envoie pas d’auteur', async () => {
    await saveEditorial(
      { ...editorial, published_at: '2099-01-01', created_by: 'usurpé' } as EditorialInput,
      { id: 'page', updated_at: 'version-1' },
    )
    const payload = api.update.mock.calls[0]![0]
    expect(payload).not.toHaveProperty('published_at')
    expect(payload).not.toHaveProperty('created_by')
    expect(api.eq).toHaveBeenCalledWith('slug', 'pitch')
  })
  it('ne publie rien quand la revalidation administrateur échoue', async () => {
    api.requireAdmin.mockRejectedValue(new Error('Accès refusé'))
    await expect(saveEditorial(editorial)).rejects.toThrow('Accès refusé')
    expect(api.insert).not.toHaveBeenCalled()
  })
})
