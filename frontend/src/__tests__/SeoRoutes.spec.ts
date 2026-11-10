import { createApp, h } from 'vue'
import { createPinia } from 'pinia'
import { expect, it, vi } from 'vitest'
import router from '../router'

vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../stores/auth', () => ({
  useAuthStore: () => ({
    initialize: async () => {},
    verifyAccess: async () => false,
  }),
}))

it('convertit les anciennes URL, préserve les paramètres et actualise les métadonnées', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  const app = createApp({ render: () => h('div') })
  app.use(createPinia()).use(router)
  try {
    await router.isReady()
    await router.push('/#/salon?evenement=exemple#programme')
    expect(router.currentRoute.value.fullPath).toBe('/salon/?evenement=exemple#programme')
    expect(document.title).toContain('Salon professionnel SASCOA')
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://sascoa.com/salon/',
    )

    await router.push('/#/administration/pages/pitch')
    expect(router.currentRoute.value.name).toBe('admin-login')
    expect(router.currentRoute.value.query.redirect).toBe('/administration/pages/pitch')
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex')
    expect(document.querySelector('link[rel="canonical"]')).toBeNull()
  } finally {
    app.mount(document.createElement('div'))
    app.unmount()
    vi.restoreAllMocks()
  }
})
