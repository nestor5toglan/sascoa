import { createPinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { Company, SalonEvent } from '../types/public'

const catalog = vi.hoisted(() => ({
  getCompanies: vi.fn(),
  getSectors: vi.fn(),
  getEvents: vi.fn(),
  getEvent: vi.fn(),
}))
vi.mock('../services/publicCatalog', () => ({ ...catalog, PAGE_SIZE: 9 }))
vi.mock('../lib/supabase', () => ({
  supabase: { storage: { from: () => ({ createSignedUrl: vi.fn() }) } },
}))
import DirectoryView from '../views/DirectoryView.vue'
import EventsView from '../views/EventsView.vue'
import SiteHeader from '../components/layout/SiteHeader.vue'

const company: Company = {
  id: 'structure-test',
  name: 'Structure fictive',
  slug: 'structure-test',
  description: 'Description de test',
  sector_id: 'secteur-test',
  sector: { name: 'Conseil' },
  structure_type: 'private',
  services: 'Formation',
  specificities: null,
  logo_path: null,
  address: null,
  phone: null,
  public_email: null,
  website_url: 'javascript:alert(1)',
}
const event: SalonEvent = {
  id: '00000000-0000-4000-8000-000000000001',
  title: 'Salon fictif',
  slug: 'salon-test',
  description: 'Événement de démonstration',
  event_type: 'salon',
  starts_at: '2027-04-15T09:00:00Z',
  ends_at: '2027-04-18T17:00:00Z',
  timezone: 'Africa/Lome',
  location: 'Lieu fictif',
  cover_image_path: null,
  program_text: 'Programme de démonstration',
  program_pdf_path: null,
  speakers: [],
  registrations_open: false,
  registration_deadline: null,
  is_demo: true,
}
const wrappers: VueWrapper[] = []
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
  // jsdom n'implémente pas le comportement natif des modales : le rendu est testé,
  // pas le piège de focus ni l'affichage dans un navigateur réel.
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
  }
})
beforeEach(() => {
  catalog.getSectors.mockResolvedValue([{ id: 'secteur-test', name: 'Conseil', slug: 'conseil' }])
  catalog.getCompanies.mockResolvedValue({ items: [company], count: 12 })
  catalog.getEvents.mockResolvedValue({ items: [event], count: 12 })
  catalog.getEvent.mockResolvedValue(event)
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
})
async function render(
  component: typeof DirectoryView | typeof EventsView | typeof SiteHeader,
  url = '/',
) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  await router.push(url)
  await router.isReady()
  const wrapper = mount(component, {
    attachTo: document.body,
    global: { plugins: [createPinia(), router] },
  })
  wrappers.push(wrapper)
  await flushPromises()
  return { wrapper, router }
}
function button(wrapper: VueWrapper, text: string) {
  const item = wrapper.findAll('button').find((b) => b.text().includes(text))
  if (!item) throw new Error(`Bouton manquant : ${text}`)
  return item
}

describe('Annuaire public', () => {
  it('applique la recherche et le secteur, puis revient à la première page', async () => {
    const { wrapper } = await render(DirectoryView)
    await button(wrapper, 'Suivant').trigger('click')
    await flushPromises()
    expect(catalog.getCompanies).toHaveBeenLastCalledWith(2, '', '')
    await wrapper.get('#company-search').setValue('conseil')
    await wrapper.get('#company-sector').setValue('secteur-test')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(catalog.getCompanies).toHaveBeenLastCalledWith(1, 'conseil', 'secteur-test')
    await button(wrapper, 'Effacer').trigger('click')
    await flushPromises()
    expect(catalog.getCompanies).toHaveBeenLastCalledWith(1, '', '')
  })
  it('montre la fiche, refuse un lien dangereux et ferme les détails', async () => {
    const { wrapper } = await render(DirectoryView)
    await button(wrapper, 'Découvrir la structure').trigger('click')
    await flushPromises()
    expect(wrapper.get('dialog').element.open).toBe(true)
    expect(wrapper.get('dialog').text()).toContain('Formation')
    expect(wrapper.find('a[href^="javascript:"]').exists()).toBe(false)
    await wrapper.get('button[aria-label="Fermer les détails"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('dialog').element.open).toBe(false)
  })
  it('affiche une erreur distincte, réessaie, puis affiche un résultat vide', async () => {
    catalog.getCompanies.mockRejectedValueOnce(new Error('Indisponible'))
    const { wrapper } = await render(DirectoryView)
    expect(wrapper.get('[role="alert"]').text()).toContain('Indisponible')
    catalog.getCompanies.mockResolvedValue({ items: [], count: 0 })
    await button(wrapper, 'Réessayer').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('L’annuaire se prépare')
  })
})

describe('Salons et navigation', () => {
  it('garde la période appliquée pour la pagination puis applique la nouvelle sélection', async () => {
    const { wrapper } = await render(EventsView)
    await wrapper.get('#event-period').setValue('past')
    await button(wrapper, 'Suivant').trigger('click')
    await flushPromises()
    expect(catalog.getEvents).toHaveBeenLastCalledWith(2, 'upcoming', '', 9, 'other')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(catalog.getEvents).toHaveBeenLastCalledWith(1, 'past', '', 9, 'other')
    await button(wrapper, 'Réinitialiser').trigger('click')
    await flushPromises()
    expect(catalog.getEvents).toHaveBeenLastCalledWith(1, 'upcoming', '', 9, 'other')
  })
  it('ouvre le lien depuis l’accueil et identifie explicitement la démonstration', async () => {
    catalog.getEvent.mockResolvedValueOnce({ ...event, event_type: 'forum' })
    const { wrapper, router } = await render(EventsView, `/salons?evenement=${event.id}`)
    expect(catalog.getEvent).toHaveBeenLastCalledWith(event.id)
    expect(wrapper.get('dialog').element.open).toBe(true)
    expect(wrapper.get('dialog').text()).toContain('Dates fictives')
    expect(wrapper.find('form[action]').exists()).toBe(false)
    await wrapper.get('button[aria-label="Fermer les détails"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.evenement).toBeUndefined()
  })
  it('ferme le menu après navigation et ne transforme pas le lien d’évitement en route', async () => {
    const { wrapper, router } = await render(SiteHeader)
    const toggle = wrapper.get('.menu-toggle')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    await router.push('/annuaire')
    await flushPromises()
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await wrapper.get('.skip-link').trigger('click')
    expect(router.currentRoute.value.path).toBe('/annuaire')
  })
})
