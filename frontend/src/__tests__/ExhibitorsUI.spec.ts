import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
const state = vi.hoisted(() => ({
  files: [] as any[],
  payments: [] as any[],
  confirm: vi.fn(),
  save: vi.fn(),
  create: vi.fn(),
  publicRows: [] as any[],
}))
const category = {
  id: 'cat',
  event_id: 'salon',
  name: 'Standard test',
  price_amount: 50000,
  currency: 'XOF',
  capacity: 10,
  is_active: true,
  is_demo: true,
  updated_at: 'v1',
}
vi.mock('../stores/auth', () => ({
  useAuthStore: () => ({ isAdmin: true, busy: false, requireAdmin: async () => {} }),
}))
vi.mock('../lib/supabase', () => ({
  supabase: { storage: { from: () => ({ createSignedUrl: async () => ({ data: null }) }) } },
}))
vi.mock('../services/exhibitors', () => ({
  exhibitorSalons: async () => [{ id: 'salon', title: 'Salon fictif', is_demo: true }],
  standCategories: async () => [category],
  exhibitorRequests: async () => [
    {
      id: 'req',
      reference: 'PRE-TEST',
      organization: 'Fictive',
      first_name: 'Alice',
      last_name: 'Test',
      updated_at: '1',
    },
  ],
  listExhibitorFiles: async () => ({ items: state.files, count: state.files.length }),
  createExhibitorFile: async (r: any, c: string, s: string) => {
    state.create(r, c, s)
    const f = {
      id: 'file',
      request_id: r.id,
      event_id: 'salon',
      category_id: c,
      stand_number: s,
      quoted_amount: 50000,
      currency: 'XOF',
      status: 'pending',
      public_name: 'Fictive',
      public_description: '',
      public_website: '',
      logo_path: null,
      publication_consent: false,
      consent_note: '',
      is_public: false,
      is_demo: true,
      updated_at: '2',
    }
    state.files = [f]
    return { ...f }
  },
  exhibitorPayments: async () => state.payments,
  confirmExhibitorPayment: async (f: any, n: number, d: string, m: string, r: string) => {
    state.confirm(f, n, d, m, r)
    state.payments = [
      {
        id: 'payment',
        file_id: f.id,
        amount: n,
        paid_on: d,
        method: m,
        reference: r,
        voided_at: null,
      },
    ]
    return { ...f, updated_at: '3' }
  },
  saveExhibitorFile: async (f: any) => {
    state.save(f)
    state.files = [{ ...f, updated_at: '4' }]
    return state.files[0]
  },
  publicExhibitors: async () => state.publicRows,
  saveStandCategory: vi.fn(),
  voidExhibitorPayment: vi.fn(),
}))
import AdminExhibitors from '../views/admin/AdminExhibitors.vue'
import SalonExhibitors from '../components/SalonExhibitors.vue'
const byLabel = (w: any, text: string) => {
  const label = w.findAll('label').find((l: any) => l.text().startsWith(text))
  if (!label) throw new Error('Label absent : ' + text)
  return label.find('input,select,textarea')
}
const click = async (w: any, name: string) => {
  const b = w.findAll('button').find((x: any) => x.text() === name)
  if (!b) throw new Error('Bouton absent : ' + name)
  await b.trigger('click')
  await flushPromises()
}
async function admin() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div/>' } }],
  })
  await router.push('/')
  await router.isReady()
  const w = mount(AdminExhibitors, { global: { plugins: [router] } })
  await flushPromises()
  await byLabel(w, 'Salon à gérer').setValue('salon')
  await flushPromises()
  return w
}
beforeEach(() => {
  state.files = []
  state.payments = []
  state.publicRows = []
  state.confirm.mockClear()
  state.save.mockClear()
  state.create.mockClear()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})
describe('Parcours exposants dans l’interface', () => {
  it('crée sans payer puis confirme le paiement avant de proposer l’admission', async () => {
    const w = await admin()
    await byLabel(w, 'Demande Exposant').setValue('req')
    await byLabel(w, 'Catégorie de stand').setValue('cat')
    await byLabel(w, 'Numéro de stand').setValue('A-01')
    await w
      .findAll('form')
      .find((f) => f.text().includes('Créer le dossier exposant'))!
      .trigger('submit')
    await flushPromises()
    expect(state.create).toHaveBeenCalled()
    expect(state.confirm).not.toHaveBeenCalled()
    expect(w.find('option[value="admitted"]').attributes()).toHaveProperty('disabled')
    await byLabel(w, 'Référence interne').setValue('TEST-ONLY')
    await w
      .findAll('form')
      .find((f) => f.text().includes('Confirmer le paiement intégral'))!
      .trigger('submit')
    await flushPromises()
    expect(state.confirm).toHaveBeenCalledWith(
      expect.anything(),
      50000,
      expect.any(String),
      'mobile_money',
      'TEST-ONLY',
    )
    expect(w.find('option[value="admitted"]').attributes()).not.toHaveProperty('disabled')
    await byLabel(w, 'Admission').setValue('admitted')
    await byLabel(w, 'Accord de publication').setValue(true)
    await byLabel(w, 'Source et date').setValue('Accord fictif le 01/01/2026')
    await byLabel(w, 'Afficher sur la fiche').setValue(true)
    await w
      .findAll('form')
      .find((f) => f.text().includes('Enregistrer le dossier'))!
      .trigger('submit')
    await flushPromises()
    expect(state.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'admitted', is_public: true, publication_consent: true }),
    )
    w.unmount()
  })
  it('conserve les saisies si la fermeture est refusée', async () => {
    const w = await admin()
    await click(w, 'Ajouter une catégorie')
    await byLabel(w, 'Nom de catégorie').setValue('Brouillon à conserver')
    vi.mocked(window.confirm).mockReturnValue(false)
    await click(w, 'Fermer l’éditeur')
    expect(byLabel(w, 'Nom de catégorie').element.value).toBe('Brouillon à conserver')
    w.unmount()
  })
  it('affiche seulement la fiche publique et refuse un site dangereux', async () => {
    state.publicRows = [
      {
        id: 'public',
        public_name: 'Structure publique de démonstration',
        public_description: 'Services fictifs',
        public_website: 'javascript:alert(1)',
        logo_path: null,
        stand_number: 'A-01',
        category_name: 'Standard',
        is_demo: true,
        reference: 'PRIVÉ-NE-PAS-AFFICHER',
        quoted_amount: 50000,
      },
    ]
    const w = mount(SalonExhibitors, { props: { eventId: 'salon' } })
    await flushPromises()
    expect(w.text()).toContain('Structure publique de démonstration')
    expect(w.text()).not.toContain('PRIVÉ-NE-PAS-AFFICHER')
    expect(w.text()).not.toContain('50000')
    expect(w.find('a').exists()).toBe(false)
    w.unmount()
  })
})
