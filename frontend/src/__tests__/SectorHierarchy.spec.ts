import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sectorTree, descendantIds } from '../lib/sectorTree'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: mocks }))
import { getCompanies, getSectors } from '../services/publicCatalog'
const nodes = [
  { id: 'c', name: 'Juridique', parent_id: 'b' },
  { id: 'd', name: 'Numérique', parent_id: null },
  { id: 'b', name: 'Conseil', parent_id: 'a' },
  { id: 'a', name: 'Services', parent_id: null },
]
beforeEach(() => vi.clearAllMocks())
describe('Arbre des secteurs', () => {
  it('ordonne les parents avant tous leurs descendants et produit le chemin complet', () => {
    const result = sectorTree(nodes)
    expect(result.map((n) => n.id)).toEqual(['d', 'a', 'b', 'c'])
    expect(result[result.length - 1]?.label).toBe('Services › Conseil › Juridique')
  })
  it('inclut le parent, les enfants et les petits-enfants sans prendre une autre branche', () => {
    expect([...descendantIds(nodes, 'a')].sort()).toEqual(['a', 'b', 'c'])
    expect([...descendantIds(nodes, 'b')].sort()).toEqual(['b', 'c'])
  })
  it('termine même avec des données importées cycliques ou orphelines', () => {
    const corrupt = [
      { id: 'a', name: 'A', parent_id: 'b' },
      { id: 'b', name: 'B', parent_id: 'a' },
      { id: 'c', name: 'C', parent_id: 'absent' },
    ]
    expect(sectorTree(corrupt)).toHaveLength(3)
    expect(descendantIds(corrupt, 'a').size).toBe(2)
  })
  it('ne limite pas la profondeur à deux ou trois niveaux', () => {
    const deep = Array.from({ length: 30 }, (_, i) => ({
      id: String(i),
      name: 'N' + i,
      parent_id: i ? String(i - 1) : null,
    }))
    expect(sectorTree(deep)[29]?.depth).toBe(29)
    expect(descendantIds(deep, '0').size).toBe(30)
  })
  it('conserve les anciens secteurs sans parent explicite comme racines', () => {
    expect(sectorTree([{ id: 'a', name: 'Conseil' }])[0]?.label).toBe('Conseil')
  })
})
describe('Annuaire filtré par sous-arbre', () => {
  it('demande au serveur la pagination et le comptage du parent et de ses descendants', async () => {
    mocks.rpc.mockResolvedValue({ data: { items: [{ id: 'public' }], count: 14 }, error: null })
    const result = await getCompanies(2, 'conseil', '00000000-0000-4000-8000-000000000001')
    expect(mocks.rpc).toHaveBeenCalledWith('search_public_companies_by_sector', {
      p_sector: '00000000-0000-4000-8000-000000000001',
      p_search: 'conseil',
      p_page: 2,
      p_size: 9,
    })
    expect(result.count).toBe(14)
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('remonte une erreur de filtrage sans la transformer en résultat vide', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error('Indisponible') })
    await expect(getCompanies(1, '', 'secteur')).rejects.toThrow('Indisponible')
  })
  it('charge aussi les secteurs au-delà des 200 premiers', async () => {
    const page = Array.from({ length: 200 }, (_, i) => ({
      id: String(i),
      name: 'Secteur ' + i,
      parent_id: null,
    }))
    const range = vi
      .fn()
      .mockResolvedValueOnce({ data: page, error: null })
      .mockResolvedValueOnce({
        data: [{ id: 'dernier', name: 'Dernier', parent_id: '0' }],
        error: null,
      })
    const chain = { select: vi.fn(), order: vi.fn(), range }
    chain.select.mockReturnValue(chain)
    chain.order.mockReturnValue(chain)
    mocks.from.mockReturnValue(chain)
    const sectors = await getSectors()
    expect(sectors).toHaveLength(201)
    expect(range).toHaveBeenLastCalledWith(200, 399)
  })
})
