import { beforeAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
const api = vi.hoisted(() => ({ getEvents: vi.fn(), getEvent: vi.fn(), getPreregConfig: vi.fn() }))
vi.mock('../services/publicCatalog', () => ({ ...api, PAGE_SIZE: 9 }))
vi.mock('../services/preregistration', () => api)
vi.mock('../lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        createSignedUrl: vi
          .fn()
          .mockResolvedValue({ data: { signedUrl: 'https://example.com/image.png' } }),
      }),
    },
  },
}))
import SalonView from '../views/SalonView.vue'
import SiteHeader from '../components/layout/SiteHeader.vue'
import EventsView from '../views/EventsView.vue'
const salon = {
  id: '00000000-0000-4000-8000-000000000001',
  title: 'Salon de test',
  event_type: 'salon',
  starts_at: '2027-04-15T09:00:00Z',
  ends_at: '2027-04-18T17:00:00Z',
  timezone: 'Africa/Lome',
  location: 'Lomé',
  description: 'Présentation',
  cover_image_path: 'events/test.png',
  program_text: 'Programme test',
  speakers: [],
  is_demo: true,
}
let wrappers: VueWrapper[] = []
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
})
beforeEach(() => {
  vi.clearAllMocks()
  api.getEvents.mockResolvedValue({ items: [salon], count: 1 })
  api.getEvent.mockResolvedValue(salon)
  api.getPreregConfig.mockResolvedValue(null)
})
afterEach(() => {
  wrappers.forEach((w) => w.unmount())
  wrappers = []
  document.body.style.overflow = ''
})
async function render(
  component: typeof SalonView | typeof SiteHeader | typeof EventsView,
  path = '/salon',
) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(component, {
    attachTo: document.body,
    global: {
      plugins: [createPinia(), router],
      stubs: { PageArtwork: true, SalonExhibitors: true },
    },
  })
  wrappers.push(wrapper)
  await flushPromises()
  return { wrapper, router }
}
describe('Page Salon et navigation lot 43', () => {
  it('sépare les salons, affiche le programme et agrandit le visuel sans quitter la page', async () => {
    const { wrapper } = await render(SalonView)
    expect(api.getEvents).toHaveBeenCalledWith(1, 'upcoming', '', 9, 'salon')
    expect(wrapper.text()).toContain('Programme test')
    const trigger = wrapper.get('button[aria-label^="Agrandir"]')
    await trigger.trigger('click')
    expect(wrapper.get('dialog').element.open).toBe(true)
    expect(document.body.style.overflow).toBe('hidden')
    await wrapper.get('.lightbox-close').trigger('click')
    expect(wrapper.get('dialog').element.open).toBe(false)
    expect(document.body.style.overflow).toBe('')
    expect(wrapper.find('a[href="/pitch/"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/hackathon/"]').exists()).toBe(true)
  })
  it('ne présente pas un forum comme un salon via un lien direct', async () => {
    api.getEvent.mockResolvedValue({ ...salon, event_type: 'forum' })
    const { wrapper } = await render(SalonView, `/salon?evenement=${salon.id}`)
    expect(wrapper.get('[role="alert"]').text()).toContain('Ce salon n’est pas disponible')
    expect(wrapper.find('.salon-feature').exists()).toBe(false)
  })
  it('redirige les anciens liens de salon vers la page dédiée', async () => {
    const { router } = await render(EventsView, `/salons?evenement=${salon.id}`)
    expect(router.currentRoute.value.path).toBe('/salon/')
    expect(router.currentRoute.value.query.evenement).toBe(salon.id)
  })
  it('affiche un état vide et conserve les accès aux programmes', async () => {
    api.getEvents.mockResolvedValue({ items: [], count: 0 })
    const { wrapper } = await render(SalonView)
    expect(wrapper.text()).toContain('Le prochain salon se prépare')
    expect(wrapper.find('.salon-feature').exists()).toBe(false)
    expect(wrapper.text()).toContain('Business Pitch')
  })
  it('ouvre le formulaire global uniquement pour le salon configuré', async () => {
    api.getPreregConfig.mockResolvedValue({ event_id: salon.id })
    const listener = vi.fn()
    window.addEventListener('sascoa:open-preregistration', listener)
    const { wrapper } = await render(SalonView)
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Se préinscrire'))!
      .trigger('click')
    expect(listener).toHaveBeenCalledOnce()
    window.removeEventListener('sascoa:open-preregistration', listener)
  })
  it('rend le sous-menu utilisable au clic, à Échap et après navigation', async () => {
    const { wrapper, router } = await render(SiteHeader)
    expect(wrapper.text()).not.toContain('L’annuaire')
    const button = wrapper.get('.submenu-toggle')
    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('#events-submenu').text()).toContain('Hackathon')
    await wrapper.get('.nav-events').trigger('keydown', { key: 'Escape' })
    expect(button.attributes('aria-expanded')).toBe('false')
    await button.trigger('click')
    await router.push('/pitch')
    await flushPromises()
    expect(button.attributes('aria-expanded')).toBe('false')
  })
})
