import { beforeEach, describe, it, expect, vi } from 'vitest'
const mock = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  signed: vi.fn(),
}))
vi.mock('../stores/auth', () => ({ useAuthStore: () => ({ requireAdmin: mock.requireAdmin }) }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc: mock.rpc, storage: { from: mock.from } } }))
import {
  applicationPdfLink,
  getApplicationConfig,
  reviewApplication,
} from '../services/applications'
import type { ProgramApplication } from '../types/applications'
const path = 'applications/00000000-0000-4000-8000-000000000001.pdf'
beforeEach(() => {
  vi.clearAllMocks()
  mock.requireAdmin.mockResolvedValue(undefined)
  mock.from.mockReturnValue({ createSignedUrl: mock.signed })
  mock.signed.mockResolvedValue({
    data: { signedUrl: 'https://sascoa-test.supabase.co/private?token=demo' },
    error: null,
  })
  mock.rpc.mockResolvedValue({ data: null, error: null })
})
describe('Accès client aux candidatures', () => {
  it('lit seulement la configuration publique sans exiger un compte', async () => {
    await getApplicationConfig('pitch')
    expect(mock.requireAdmin).not.toHaveBeenCalled()
    expect(mock.rpc).toHaveBeenCalledWith('get_program_application_config', { p_program: 'pitch' })
  })
  it('signe le PDF privé pour une minute et force le téléchargement', async () => {
    await applicationPdfLink(path)
    expect(mock.requireAdmin).toHaveBeenCalled()
    expect(mock.from).toHaveBeenCalledWith('sascoa-private')
    expect(mock.signed).toHaveBeenCalledWith(path, 60, { download: true })
  })
  it('refuse un chemin extérieur aux candidatures', async () => {
    await expect(applicationPdfLink('justificatifs/confidentiel.pdf')).rejects.toThrow(/Chemin/)
    expect(mock.signed).not.toHaveBeenCalled()
  })
  it('ne signe pas après une révocation du rôle', async () => {
    mock.requireAdmin.mockRejectedValue(new Error('Accès refusé'))
    await expect(applicationPdfLink(path)).rejects.toThrow(/refusé/)
    expect(mock.from).not.toHaveBeenCalled()
  })
  it('ne transmet que le suivi et sa version lors d’une décision', async () => {
    await reviewApplication({
      id: 'id',
      updated_at: 'version',
      status: 'accepted',
      internal_note: 'Test',
      full_name: 'INJECTION',
      email: 'change@example.invalid',
      file_path: 'change.pdf',
    } as ProgramApplication)
    expect(mock.rpc).toHaveBeenCalledWith('review_program_application', {
      p_id: 'id',
      p_version: 'version',
      p_status: 'accepted',
      p_note: 'Test',
    })
  })
})
