import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { flushPromises } from '@vue/test-utils'
const api = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChange: vi.fn(),
  from: vi.fn(),
  profile: vi.fn(),
  unsubscribe: vi.fn(),
}))
vi.mock('../lib/supabase', () => ({ supabase: { auth: api, from: api.from } }))
import { useAuthStore } from '../stores/auth'
import { adminNavigationGuard } from '../router/adminGuard'
let event: (event: AuthChangeEvent, session: Session | null) => void
let auth: ReturnType<typeof useAuthStore>
const session = { user: { id: 'admin-a' } } as Session
const active = { username: 'sasco-root', display_name: 'Racine', role: 'root', is_active: true }
beforeEach(() => {
  vi.useRealTimers()
  setActivePinia(createPinia())
  api.onAuthStateChange.mockImplementation((callback) => {
    event = callback
    return { data: { subscription: { unsubscribe: api.unsubscribe } } }
  })
  api.getSession.mockResolvedValue({ data: { session }, error: null })
  api.getUser.mockResolvedValue({ data: { user: session.user }, error: null })
  api.signInWithPassword.mockResolvedValue({ error: null })
  api.signOut.mockResolvedValue({ error: null })
  api.profile.mockResolvedValue({ data: active, error: null })
  api.from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: api.profile }) }) })
  auth = useAuthStore()
})
afterEach(() => {
  auth.dispose()
  vi.useRealTimers()
})
describe('Session et autorisation partagées', () => {
  it.each(['root', 'director'])(
    'valide le rôle actif %s et restaure la session depuis Auth',
    async (role) => {
      api.profile.mockResolvedValue({ data: { ...active, role }, error: null })
      expect(await auth.initialize()).toBe(true)
      expect(auth.profile?.role).toBe(role)
      expect(api.getUser).toHaveBeenCalledOnce()
      expect(api.onAuthStateChange).toHaveBeenCalledOnce()
      await auth.initialize()
      expect(api.onAuthStateChange).toHaveBeenCalledOnce()
    },
  )
  it.each([null, { ...active, is_active: false }, { ...active, role: 'visitor' }])(
    'refuse un profil absent, inactif ou non administrateur',
    async (profile) => {
      api.profile.mockResolvedValue({ data: profile, error: null })
      expect(await auth.initialize()).toBe(false)
      expect(auth.isAdmin).toBe(false)
      expect(auth.state).toBe('denied')
    },
  )
  it('redirige un visiteur sans charger une page privée', async () => {
    api.getSession.mockResolvedValue({ data: { session: null }, error: null })
    const decision = await adminNavigationGuard(
      { path: '/administration/entreprises', meta: { requiresAdmin: true }, query: {} },
      auth,
    )
    expect(decision).toEqual({
      path: '/administration/connexion',
      query: { redirect: '/administration/entreprises' },
    })
    expect(api.profile).not.toHaveBeenCalled()
  })
  it('autorise la navigation publique sans demander un profil', async () => {
    expect(await adminNavigationGuard({ path: '/annuaire', meta: {}, query: {} }, auth)).toBe(true)
    expect(api.getUser).not.toHaveBeenCalled()
  })
  it('n’accepte aucune redirection externe après connexion', async () => {
    expect(
      await adminNavigationGuard(
        { path: '/administration/connexion', meta: {}, query: { redirect: 'https://example.com' } },
        auth,
      ),
    ).toBe('/administration/tableau-de-bord')
  })
  it('efface immédiatement le profil lors d’une déconnexion dans un autre onglet', async () => {
    await auth.initialize()
    event('SIGNED_OUT', null)
    expect(auth.profile).toBeNull()
    expect(auth.isAdmin).toBe(false)
  })
  it('ne réautorise pas un profil dont la réponse arrive après la déconnexion', async () => {
    let finish!: (result: unknown) => void
    api.profile.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const pending = auth.initialize()
    await flushPromises()
    event('SIGNED_OUT', null)
    finish({ data: active, error: null })
    expect(await pending).toBe(false)
    expect(auth.isAdmin).toBe(false)
  })
  it('revalide un profil devenu inactif avant une écriture', async () => {
    await auth.initialize()
    api.profile.mockResolvedValue({ data: { ...active, is_active: false }, error: null })
    await expect(auth.requireAdmin()).rejects.toThrow('profil administrateur actif')
    expect(auth.isAdmin).toBe(false)
  })
  it('diffère les appels Auth hors du callback de renouvellement', async () => {
    await auth.initialize()
    vi.useFakeTimers()
    const calls = api.getUser.mock.calls.length
    event('TOKEN_REFRESHED', session)
    expect(api.getUser).toHaveBeenCalledTimes(calls)
    await vi.runOnlyPendingTimersAsync()
    expect(api.getUser).toHaveBeenCalledTimes(calls + 1)
  })
  it('préserve la session affichée si la demande de déconnexion échoue', async () => {
    await auth.initialize()
    api.signOut.mockResolvedValue({ error: new Error('Réseau indisponible') })
    expect(await auth.signOut()).toBe(false)
    expect(auth.isAdmin).toBe(true)
    expect(auth.error).toContain('Réseau')
  })
  it('refuse un mauvais mot de passe et accepte une nouvelle connexion valide', async () => {
    api.getSession.mockResolvedValue({ data: { session: null }, error: null })
    await auth.initialize()
    api.signInWithPassword.mockResolvedValueOnce({ error: new Error('Identifiants invalides') })
    expect(await auth.signIn('test@example.com', 'incorrect')).toBe(false)
    expect(auth.isAdmin).toBe(false)
    api.signInWithPassword.mockImplementation(async () => {
      api.getSession.mockResolvedValue({ data: { session }, error: null })
      return { error: null }
    })
    expect(await auth.signIn(' test@example.com ', 'test')).toBe(true)
    expect(api.signInWithPassword).toHaveBeenLastCalledWith({
      email: 'test@example.com',
      password: 'test',
    })
  })
})
