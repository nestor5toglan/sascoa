import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
const api = vi.hoisted(() => ({
  sign: vi.fn(),
  listAdminSectors: vi.fn(),
  sectorOptions: vi.fn(),
  saveSector: vi.fn(),
}))
vi.mock('../lib/supabase', () => ({
  supabase: { storage: { from: () => ({ createSignedUrl: api.sign }) } },
}))
vi.mock('../services/adminCatalog', () => ({ ...api, ADMIN_PAGE_SIZE: 10 }))
import DocumentLink from '../components/ui/DocumentLink.vue'
import PartnerCarousel from '../components/PartnerCarousel.vue'
import SiteHeader from '../components/layout/SiteHeader.vue'
import AdminSectors from '../views/admin/AdminSectors.vue'
const wrappers: VueWrapper[] = []
let motion = false
beforeEach(() => {
  vi.clearAllMocks()
  motion = false
  vi.stubGlobal(
    'matchMedia',
    vi.fn((q: string) => ({
      matches: q.includes('hover') || motion,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
  api.sign.mockImplementation(async (_path: string, _time: number, opts?: unknown) => ({
    data: { signedUrl: opts ? 'https://example.com/download.pdf' : 'https://example.com/view.pdf' },
    error: null,
  }))
  const sector = {
    id: 'a',
    name: 'Services',
    slug: 'services',
    description: '',
    parent_id: null,
    updated_at: '2026-01-01',
  }
  api.listAdminSectors.mockResolvedValue({ items: [sector], count: 1 })
  api.sectorOptions.mockResolvedValue([
    sector,
    { id: 'b', name: 'Conseil', parent_id: 'a' },
    { id: 'c', name: 'Juridique', parent_id: 'b' },
    { id: 'd', name: 'Autre', parent_id: null },
  ])
  api.saveSector.mockImplementation(async (x) => ({ ...sector, ...x }))
})
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount())
  vi.unstubAllGlobals()
})
async function render(component: any, props = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/')
  await router.isReady()
  const wrapper = mount(component, {
    props,
    global: {
      plugins: [createPinia(), router],
      stubs: { MediaImage: { template: '<div class="image-stub" />' } },
    },
  })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}
describe('Programme PDF', () => {
  it('conserve l’ouverture et ajoute un téléchargement signé avec disposition pièce jointe', async () => {
    const w = await render(DocumentLink, { path: 'events/programme.pdf' })
    expect(api.sign).toHaveBeenCalledWith('events/programme.pdf', 3600, {
      download: 'programme-sascoa.pdf',
    })
    expect(w.get('a[download]').text()).toContain('Télécharger le programme')
    expect(w.get('a[download]').attributes('href')).toBe('https://example.com/download.pdf')
    expect(w.get('a[target="_blank"]').attributes('href')).toBe('https://example.com/view.pdf')
  })
  it('refuse un chemin de document hors du bucket', async () => {
    const w = await render(DocumentLink, { path: '../private/justificatif.pdf' })
    expect(api.sign).not.toHaveBeenCalled()
    expect(w.text()).toContain('indisponible')
  })
  it('conserve la consultation si seule la signature du téléchargement échoue', async () => {
    api.sign
      .mockResolvedValueOnce({ data: { signedUrl: 'https://example.com/view.pdf' }, error: null })
      .mockRejectedValueOnce(new Error('Réseau'))
    const w = await render(DocumentLink, { path: 'events/programme.pdf' })
    expect(w.find('a[target="_blank"]').exists()).toBe(true)
    expect(w.find('a[download]').exists()).toBe(false)
  })
})
describe('Logos en défilement continu', () => {
  const partners = [
    {
      id: 'p',
      name: 'Partenaire',
      category: 'Institution',
      logo_path: 'partners/p.png',
      website_url: 'https://example.com',
      description: null,
    },
  ]
  it('ne montre ni flèches ni commande visuelle et rend la copie de boucle inerte', async () => {
    const w = await render(PartnerCarousel, { partners })
    expect(w.find('.partner-controls').exists()).toBe(false)
    expect(w.findAll('.partner-marquee-group')).toHaveLength(2)
    expect(w.findAll('.partner-marquee-group')[1]!.attributes('inert')).toBeDefined()
    expect(w.findAll('.partner-marquee-group')[1]!.findAll('a')).toHaveLength(0)
  })
  it('conserve une pause accessible au clavier et met le mouvement en pause lors du focus', async () => {
    const w = await render(PartnerCarousel, { partners })
    await w.get('.partner-marquee').trigger('focusin')
    expect(w.get('.partner-marquee-track').attributes('style')).toContain(
      'animation-play-state: paused',
    )
    await w.get('.marquee-accessible-pause').trigger('click')
    expect(w.get('.marquee-accessible-pause').attributes('aria-pressed')).toBe('true')
  })
  it('désactive le mouvement et les copies pour la préférence réduire les animations', async () => {
    motion = true
    const w = await render(PartnerCarousel, { partners })
    expect(w.classes()).toContain('is-reduced')
    expect(w.findAll('.partner-marquee-group')).toHaveLength(1)
  })
})
describe('Sous-menu et secteurs dans l’administration', () => {
  it('ouvre le sous-menu au survol d’une souris', async () => {
    const w = await render(SiteHeader)
    await w.get('.nav-events').trigger('mouseenter')
    expect(w.get('.submenu-toggle').attributes('aria-expanded')).toBe('true')
    expect(w.find('.submenu-toggle svg').exists()).toBe(true)
    await w.get('.nav-events').trigger('mouseleave')
    expect(w.get('.submenu-toggle').attributes('aria-expanded')).toBe('false')
  })
  it('exclut le secteur modifié et tous ses descendants des parents possibles', async () => {
    const w = await render(AdminSectors)
    await w
      .findAll('button')
      .find((b) => b.text().startsWith('Modifier'))!
      .trigger('click')
    await flushPromises()
    const choices = w
      .get('#sector-parent')
      .findAll('option')
      .map((o) => o.attributes('value'))
    expect(choices).not.toContain('a')
    expect(choices).not.toContain('b')
    expect(choices).not.toContain('c')
    expect(choices).toContain('d')
  })
  it('enregistre le nouveau parent et conserve le contrôle de version de la fiche', async () => {
    const w = await render(AdminSectors)
    await w
      .findAll('button')
      .find((b) => b.text().startsWith('Modifier'))!
      .trigger('click')
    await flushPromises()
    await w.get('#sector-parent').setValue('d')
    await w.get('.admin-editor form').trigger('submit')
    await flushPromises()
    expect(api.saveSector).toHaveBeenCalledWith(
      expect.objectContaining({ parent_id: 'd' }),
      expect.objectContaining({ id: 'a', updated_at: '2026-01-01' }),
    )
  })
})
