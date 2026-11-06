import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '../lib/supabase'
import { errorText } from '../lib/presentation'
import type { AdminProfile } from '../types/admin'

export const useAuthStore = defineStore('auth', () => {
  const profile = ref<AdminProfile | null>(null)
  const sessionPresent = ref(false)
  const checking = ref(false)
  const busy = ref(false)
  const error = ref('')
  const state = ref<'idle' | 'anonymous' | 'authorized' | 'denied' | 'error'>('idle')
  const isAdmin = computed(() => state.value === 'authorized' && profile.value !== null)
  let userId = ''
  let generation = 0
  let verifiedAt = 0
  let boot: Promise<boolean> | undefined
  let flight: { generation: number; promise: Promise<boolean> } | undefined
  let subscription: { unsubscribe: () => void } | undefined
  let timer: ReturnType<typeof setTimeout> | undefined

  function invalidate(message = '') {
    generation += 1
    flight = undefined
    userId = ''
    verifiedAt = 0
    profile.value = null
    sessionPresent.value = false
    checking.value = false
    state.value = 'anonymous'
    error.value = message
  }

  function verifyAccess(force = false): Promise<boolean> {
    if (flight?.generation === generation) return flight.promise
    if (!force && verifiedAt && Date.now() - verifiedAt < 3000)
      return Promise.resolve(isAdmin.value)
    const version = generation
    checking.value = true
    const promise = (async () => {
      try {
        const session = await supabase.auth.getSession()
        if (session.error) throw session.error
        if (version !== generation) return false
        sessionPresent.value = Boolean(session.data.session)
        if (!session.data.session) {
          invalidate(error.value)
          return false
        }
        userId = session.data.session.user.id
        const user = await supabase.auth.getUser()
        if (user.error) throw user.error
        if (!user.data.user) throw new Error('Ta session a expiré. Reconnecte-toi.')
        const result = await supabase
          .from('admin_profiles')
          .select('username,display_name,role,is_active')
          .eq('user_id', user.data.user.id)
          .maybeSingle()
        if (result.error) throw result.error
        if (version !== generation) return false
        userId = user.data.user.id
        const data = result.data as AdminProfile | null
        if (!data?.is_active || !['root', 'director'].includes(data.role)) {
          profile.value = null
          state.value = 'denied'
          error.value = 'Ce compte ne possède pas de profil administrateur actif.'
          return false
        }
        profile.value = data
        state.value = 'authorized'
        error.value = ''
        verifiedAt = Date.now()
        return true
      } catch (cause) {
        if (version === generation) {
          profile.value = null
          state.value = 'error'
          error.value = errorText(cause)
        }
        return false
      } finally {
        if (version === generation) {
          checking.value = false
          flight = undefined
        }
      }
    })()
    flight = { generation: version, promise }
    return promise
  }

  function scheduleVerification() {
    clearTimeout(timer)
    // Rester hors du callback Auth synchrone pour éviter les verrous du client.
    timer = setTimeout(() => {
      void verifyAccess(true)
    }, 0)
  }
  function onFocus() {
    if (sessionPresent.value && Date.now() - verifiedAt > 3000) scheduleVerification()
  }
  function onVisibility() {
    if (document.visibilityState === 'visible') onFocus()
  }

  function initialize(): Promise<boolean> {
    if (boot) return boot
    const listener = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        clearTimeout(timer)
        invalidate('La session est terminée. Reconnecte-toi pour continuer.')
        return
      }
      if (event === 'INITIAL_SESSION') return // La vérification initiale est ci-dessous.
      if (session && ['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) {
        if (userId && userId !== session.user.id) invalidate()
        sessionPresent.value = true
        if (!checking.value && !busy.value) scheduleVerification()
      }
    })
    subscription = listener.data.subscription
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    boot = verifyAccess(true)
    return boot
  }

  async function signIn(email: string, password: string): Promise<boolean> {
    if (busy.value) return false
    busy.value = true
    error.value = ''
    try {
      await initialize()
      invalidate()
      const result = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (result.error) throw result.error
      return await verifyAccess(true)
    } catch (cause) {
      error.value = errorText(cause)
      return false
    } finally {
      busy.value = false
    }
  }

  async function signOut(): Promise<boolean> {
    if (busy.value) return false
    busy.value = true
    error.value = ''
    try {
      const result = await supabase.auth.signOut({ scope: 'local' })
      if (result.error) throw result.error
      invalidate()
      return true
    } catch (cause) {
      error.value = errorText(cause)
      return false
    } finally {
      busy.value = false
    }
  }

  async function requireAdmin() {
    await initialize()
    if (!(await verifyAccess(true)))
      throw new Error(error.value || 'Connecte-toi avec un compte administrateur actif.')
  }
  function dispose() {
    subscription?.unsubscribe()
    clearTimeout(timer)
    window.removeEventListener('focus', onFocus)
    document.removeEventListener('visibilitychange', onVisibility)
    invalidate()
    boot = undefined
  }
  return {
    profile,
    sessionPresent,
    checking,
    busy,
    error,
    state,
    isAdmin,
    initialize,
    verifyAccess,
    signIn,
    signOut,
    requireAdmin,
    dispose,
  }
})
