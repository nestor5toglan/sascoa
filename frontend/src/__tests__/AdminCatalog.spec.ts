import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CompanyInput } from '../types/admin'
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
import { saveCompany, saveSector } from '../services/adminCatalog'
import { slugify, validateCompany } from '../lib/adminValidation'
const input: CompanyInput = {
  name: 'Structure fictive',
  slug: 'structure-fictive',
  description: 'Fiche de test',
  sector_id: 'secteur',
  structure_type: 'private',
  status: 'draft',
  services: null,
  specificities: null,
  logo_path: null,
  address: null,
  phone: null,
  public_email: null,
  website_url: null,
}
beforeEach(() => {
  mocks.requireAdmin.mockResolvedValue(undefined)
  const chain = {
    insert: mocks.insert,
    update: mocks.update,
    eq: mocks.eq,
    select: mocks.select,
    maybeSingle: mocks.result,
  }
  mocks.from.mockReturnValue(chain)
  mocks.insert.mockReturnValue(chain)
  mocks.update.mockReturnValue(chain)
  mocks.eq.mockReturnValue(chain)
  mocks.select.mockReturnValue(chain)
  mocks.result.mockResolvedValue({
    data: { ...input, id: 'entreprise', updated_at: 'date-2' },
    error: null,
  })
})
describe('Édition du catalogue', () => {
  it('crée un brouillon avec le site web facultatif', async () => {
    expect(validateCompany(input)).toBe('')
    await saveCompany(input)
    expect(mocks.requireAdmin).toHaveBeenCalledOnce()
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'draft', website_url: null }),
    )
  })
  it('ne transmet pas de champs administratifs injectés dans le formulaire', async () => {
    await saveCompany({ ...input, created_by: 'usurpé', role: 'root' } as CompanyInput)
    const payload = mocks.insert.mock.calls[0]![0]
    expect(payload).not.toHaveProperty('created_by')
    expect(payload).not.toHaveProperty('role')
  })
  it('n’écrit rien si la vérification administrateur échoue', async () => {
    mocks.requireAdmin.mockRejectedValue(new Error('Accès refusé'))
    await expect(saveCompany(input)).rejects.toThrow('Accès refusé')
    expect(mocks.insert).not.toHaveBeenCalled()
  })
  it('protège la modification concurrente et refuse une mise à jour sans ligne affectée', async () => {
    mocks.result.mockResolvedValue({ data: null, error: null })
    await expect(saveCompany(input, { id: 'entreprise', updated_at: 'date-1' })).rejects.toThrow(
      'modifiée ailleurs',
    )
    expect(mocks.eq).toHaveBeenCalledWith('updated_at', 'date-1')
  })
  it.each(['javascript:alert(1)', 'https://user:password@example.com'])(
    'refuse le site web %s avant toute écriture',
    async (url) => {
      await expect(saveCompany({ ...input, website_url: url })).rejects.toThrow('HTTP ou HTTPS')
      expect(mocks.insert).not.toHaveBeenCalled()
    },
  )
  it('fait remonter un doublon sans annoncer de réussite', async () => {
    mocks.result.mockResolvedValue({ data: null, error: { code: '23505', message: 'Doublon' } })
    await expect(
      saveSector({ name: 'Conseil', slug: 'conseil', description: '' }),
    ).rejects.toMatchObject({ code: '23505' })
  })
  it('génère un identifiant stable à partir du nom français', () => {
    expect(slugify(' Conseil & numérique — Togo ')).toBe('conseil-numerique-togo')
  })
})
