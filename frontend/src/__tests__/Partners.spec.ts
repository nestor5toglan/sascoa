import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PartnerInput } from '../types/partners'
const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  result: vi.fn(),
}))
vi.mock('../stores/auth', () => ({ useAuthStore: () => ({ requireAdmin: mocks.requireAdmin }) }))
vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
import { savePartner } from '../services/adminPartners'
import { validatePartner } from '../lib/partnerValidation'
const input: PartnerInput = {
  name: 'Partenaire de test',
  category: 'Institution',
  description: null,
  website_url: 'https://example.org',
  logo_path: 'partners/00000000-0000-4000-8000-000000000001.png',
  display_order: 0,
  is_visible: true,
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAdmin.mockResolvedValue(undefined)
  const chain = {
    insert: mocks.insert,
    update: mocks.update,
    eq: mocks.eq,
    select: mocks.select,
    maybeSingle: mocks.result,
  }
  for (const m of [mocks.from, mocks.insert, mocks.update, mocks.eq, mocks.select])
    m.mockReturnValue(chain)
  mocks.result.mockResolvedValue({
    data: { ...input, id: 'id', updated_at: 'date-2' },
    error: null,
  })
})
describe('Gestion des partenaires', () => {
  it('autorise une fiche visible avec logo et lien sûr', () =>
    expect(validatePartner(input)).toBe(''))
  it('refuse une publication sans logo', () =>
    expect(validatePartner({ ...input, logo_path: null })).toMatch(/logo/))
  it('autorise un brouillon sans logo', () =>
    expect(validatePartner({ ...input, logo_path: null, is_visible: false })).toBe(''))
  it.each(['javascript:alert(1)', 'https://user:password@example.org', 'data:text/html,test'])(
    'refuse un lien dangereux %s',
    (url) => expect(validatePartner({ ...input, website_url: url })).not.toBe(''),
  )
  it.each([-1, 1.5, NaN, 2147483648])('refuse un ordre invalide %s', (display_order) =>
    expect(validatePartner({ ...input, display_order })).not.toBe(''),
  )
  it.each(['../confidentiel.png', '/partners/logo.png', 'https://example.org/logo.png'])(
    'refuse un chemin invalide %s',
    (logo_path) => expect(validatePartner({ ...input, logo_path })).not.toBe(''),
  )
  it('requiert un nom et une catégorie', () => {
    expect(validatePartner({ ...input, name: ' ' })).not.toBe('')
    expect(validatePartner({ ...input, category: ' ' })).not.toBe('')
  })
  it('envoie seulement les colonnes éditables', async () => {
    await savePartner({ ...input, created_by: 'inject' } as PartnerInput)
    expect(mocks.requireAdmin).toHaveBeenCalled()
    expect(mocks.insert).toHaveBeenCalledWith(input)
  })
  it('protège les modifications concurrentes', async () => {
    mocks.result.mockResolvedValue({ data: null, error: null })
    await expect(savePartner(input, { id: 'id', updated_at: 'date-1' })).rejects.toThrow(
      /modifié ailleurs/,
    )
    expect(mocks.eq).toHaveBeenCalledWith('updated_at', 'date-1')
  })
  it('arrête avant une écriture si accès admin refusé', async () => {
    mocks.requireAdmin.mockRejectedValue(new Error('Interdit'))
    await expect(savePartner(input)).rejects.toThrow('Interdit')
    expect(mocks.insert).not.toHaveBeenCalled()
  })
})
