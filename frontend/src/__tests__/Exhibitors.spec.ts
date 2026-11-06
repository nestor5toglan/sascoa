import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExhibitorFile } from '../types/exhibitors'
const mock = vi.hoisted(() => ({ rpc: vi.fn(), requireAdmin: vi.fn(), publicExhibitors: vi.fn() }))
vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: mock.rpc,
    storage: { from: () => ({ createSignedUrl: vi.fn().mockResolvedValue({ data: null }) }) },
  },
}))
vi.mock('../stores/auth', () => ({ useAuthStore: () => ({ requireAdmin: mock.requireAdmin }) }))
import { validateExhibitor, validateFullPayment } from '../lib/exhibitorValidation'
import { confirmExhibitorPayment, saveExhibitorFile } from '../services/exhibitors'
const input: ExhibitorFile = {
  id: 'dossier',
  request_id: 'req',
  event_id: 'salon',
  category_id: 'cat',
  stand_number: 'A-01',
  quoted_amount: 50000,
  currency: 'XOF',
  status: 'pending',
  public_name: 'Exposant fictif',
  public_description: 'Présentation',
  public_website: 'https://example.org',
  logo_path: null,
  publication_consent: false,
  consent_note: '',
  consent_recorded_at: null,
  is_public: false,
  is_demo: true,
  updated_at: 'version',
}
beforeEach(() => {
  vi.clearAllMocks()
  mock.requireAdmin.mockResolvedValue(undefined)
  mock.rpc.mockResolvedValue({ data: input, error: null })
})
describe('Exposants : règles financières et publication', () => {
  it('autorise le montant intégral exact', () =>
    expect(validateFullPayment(50000, 50000, '2026-01-01', 'TEST')).toBe(''))
  it.each([0, 1000, 49999, 50001, NaN, 50000.5])('refuse le montant %s', (n) =>
    expect(validateFullPayment(n, 50000, '2026-01-01', 'TEST')).not.toBe(''),
  )
  it('exige date non future et référence', () => {
    expect(validateFullPayment(50000, 50000, '2099-01-01', 'TEST')).not.toBe('')
    expect(validateFullPayment(50000, 50000, 'invalide', 'TEST')).not.toBe('')
    expect(validateFullPayment(50000, 50000, '2026-02-31', 'TEST')).not.toBe('')
    expect(validateFullPayment(50000, 50000, '2026-01-01', ' ')).not.toBe('')
  })
  it('accepte une fiche non publique en attente', () => expect(validateExhibitor(input)).toBe(''))
  it('refuse une publication sans admission ou accord', () => {
    expect(validateExhibitor({ ...input, is_public: true })).not.toBe('')
    expect(validateExhibitor({ ...input, status: 'admitted', is_public: true })).not.toBe('')
  })
  it('requiert la source de l’accord', () =>
    expect(validateExhibitor({ ...input, publication_consent: true, consent_note: '' })).not.toBe(
      '',
    ))
  it('accepte une admission avec accord consigné', () =>
    expect(
      validateExhibitor({
        ...input,
        status: 'admitted',
        publication_consent: true,
        consent_note: 'Accord de test reçu le 01/01',
        is_public: true,
      }),
    ).toBe(''))
  it('rejette les liens dangereux', () =>
    expect(validateExhibitor({ ...input, public_website: 'javascript:alert(1)' })).not.toBe(''))
  it('refuse un nom ou numéro vide', () => {
    expect(validateExhibitor({ ...input, public_name: ' ' })).not.toBe('')
    expect(validateExhibitor({ ...input, stand_number: ' ' })).not.toBe('')
  })
  it('n’envoie jamais une écriture pour un paiement partiel', async () => {
    await expect(confirmExhibitorPayment(input, 1, '2026-01-01', 'cash', 'TEST')).rejects.toThrow(
      /intégral/,
    )
    expect(mock.rpc).not.toHaveBeenCalled()
  })
  it('transmet la version au contrôle serveur du paiement', async () => {
    await confirmExhibitorPayment(input, 50000, '2026-01-01', 'cash', 'TEST')
    expect(mock.rpc).toHaveBeenCalledWith('expo_confirm_payment', {
      p_file: 'dossier',
      p_version: 'version',
      p_amount: 50000,
      p_paid_on: '2026-01-01',
      p_method: 'cash',
      p_reference: 'TEST',
    })
  })
  it('ne transmet aucun prix ou acteur dans la sauvegarde du dossier', async () => {
    await saveExhibitorFile({
      ...input,
      quoted_amount: 1,
      confirmed_by: 'injection',
    } as ExhibitorFile)
    const payload = mock.rpc.mock.calls[0]![1]
    expect(payload).not.toHaveProperty('quoted_amount')
    expect(payload).not.toHaveProperty('confirmed_by')
    expect(payload).not.toHaveProperty('request_id')
    expect(payload.p_version).toBe('version')
  })
  it('bloque si le rôle admin est refusé', async () => {
    mock.requireAdmin.mockRejectedValue(new Error('Interdit'))
    await expect(
      confirmExhibitorPayment(input, 50000, '2026-01-01', 'cash', 'TEST'),
    ).rejects.toThrow('Interdit')
    expect(mock.rpc).not.toHaveBeenCalled()
  })
})
