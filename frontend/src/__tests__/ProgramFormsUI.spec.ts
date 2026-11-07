import { beforeEach, describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, onMounted } from 'vue'
import { webcrypto } from 'node:crypto'
const state = vi.hoisted(() => ({
  config: vi.fn(),
  submit: vi.fn(),
  review: vi.fn(),
  link: vi.fn(),
}))
vi.mock('../services/applications', () => ({
  getApplicationConfig: state.config,
  submitApplication: state.submit,
  getProgramSettings: async () => ({
    program: 'hackathon',
    event_id: 'salon',
    enabled: true,
    deadline: null,
    team_max_size: 5,
    daily_limit: 100,
    notice: 'Notice de candidature suffisamment détaillée pour le test.',
    notice_version: 'notice',
    updated_at: 'v1',
  }),
  saveProgramSettings: vi.fn(),
  listApplications: async () => ({ items: [], count: 0 }),
  reviewApplication: state.review,
  applicationPdfLink: state.link,
}))
vi.mock('../services/exhibitors', () => ({
  exhibitorSalons: async () => [{ id: 'salon', title: 'Salon fictif', is_demo: true }],
}))
vi.mock('../stores/auth', () => ({ useAuthStore: () => ({ isAdmin: true, busy: false }) }))
vi.mock('../lib/applicationValidation', async () => ({
  ...(await vi.importActual('../lib/applicationValidation')),
  inspectApplicationPdf: vi.fn(),
  encodePdf: async () => ({ name: 'test.pdf', base64: 'JVBERi0xLjc=' }),
}))
import Form from '../components/ProgramApplicationForm.vue'
import Admin from '../views/admin/AdminApplications.vue'
import { validateApplication } from '../lib/applicationValidation'
const challenge = defineComponent({
  emits: ['token'],
  setup(_, ctx) {
    ctx.expose({ reset: () => ctx.emit('token', 'captcha-test') })
    onMounted(() => ctx.emit('token', 'captcha-test'))
    return () => null
  },
})
const label = (w: any, text: string) => {
  const l = w.findAll('label').find((l: any) => l.text().startsWith(text))
  if (!l) throw new Error('Label absent : ' + text)
  return l.find('input,select,textarea')
}
const click = async (w: any, text: string) => {
  const b = w.findAll('button').find((b: any) => b.text() === text)
  if (!b) throw new Error('Bouton absent : ' + text)
  await b.trigger('click')
  await flushPromises()
}
async function form(program: 'pitch' | 'hackathon' = 'hackathon') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: Form, props: { program } }],
  })
  await router.push('/')
  await router.isReady()
  const w = mount(
    { template: '<RouterView />' },
    { global: { plugins: [router], stubs: { TurnstileChallenge: challenge } } },
  )
  await flushPromises()
  return w
}

async function identity(w: any) {
  await label(w, 'Nom et prénom').setValue('Alice Test')
  await label(w, 'Email de contact').setValue('alice@example.invalid')
}
beforeEach(() => {
  vi.clearAllMocks()
  state.submit.mockReset()
  state.config.mockReset()
  vi.stubGlobal('crypto', webcrypto)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  state.config.mockImplementation(async (program: string) => ({
    program,
    event_id: 'salon',
    event_title: 'Salon fictif',
    deadline: null,
    team_max_size: 3,
    notice: 'Notice privée de candidature pour le test.',
    notice_version: 'notice',
  }))
  state.submit.mockResolvedValue('HACKATHON-TEST')
})
describe('Formulaires Pitch et Hackathon', () => {
  it('actualise la limite sans effacer la saisie et demande une nouvelle lecture de la notice', async () => {
    const w = await form()
    await identity(w)
    await label(w, 'J’ai pris connaissance').setValue(true)
    state.config.mockResolvedValue({
      program: 'hackathon',
      event_id: 'salon',
      event_title: 'Salon fictif',
      deadline: null,
      team_max_size: 2,
      notice: 'Nouvelle notice de candidature.',
      notice_version: 'notice-2',
    })
    await click(w, 'Actualiser les règles du formulaire')
    expect(label(w, 'Email de contact').element.value).toBe('alice@example.invalid')
    expect(label(w, 'J’ai pris connaissance').element.checked).toBe(false)
    w.unmount()
  })
  it('change de référence technique si les informations sont modifiées après une coupure', async () => {
    state.submit
      .mockRejectedValueOnce(new Error('Coupure réseau'))
      .mockResolvedValue('HACKATHON-TEST')
    const w = await form()
    await identity(w)
    await label(w, 'Vos compétences').setValue('Design')
    await label(w, 'J’ai pris connaissance').setValue(true)
    await w.find('form').trigger('submit')
    await vi.waitFor(() => expect(state.submit.mock.calls.length).toBeGreaterThan(0))
    await flushPromises()
    await label(w, 'Vos compétences').setValue('Design et code')
    await w.find('form').trigger('submit')
    await vi.waitFor(() => expect(state.submit).toHaveBeenCalledTimes(2))
    await flushPromises()
    expect(state.submit.mock.calls[0]![0].submission_key).not.toBe(
      state.submit.mock.calls[1]![0].submission_key,
    )
    w.unmount()
  })

  it('compte le responsable dans la limite d’équipe', async () => {
    const w = await form()
    await label(w, 'Participation').setValue('team')
    await flushPromises()
    await click(w, 'Ajouter un membre')
    const add = w.findAll('button').find((b) => b.text() === 'Ajouter un membre')!
    expect(add.attributes()).toHaveProperty('disabled')
    expect(w.text()).toContain('Maximum 3 personnes, responsable inclus')
    expect(w.findAll('.program-member')).toHaveLength(2)
    w.unmount()
  })
  it('efface les membres quand on revient en individuel', async () => {
    const w = await form()
    await label(w, 'Participation').setValue('team')
    await flushPromises()
    await label(w, 'Nom de l’équipe').setValue('Équipe fictive')
    await label(w, 'Participation').setValue('individual')
    await flushPromises()
    expect(w.findAll('.program-member')).toHaveLength(0)
    expect(w.text()).not.toContain('Nom de l’équipe')
    w.unmount()
  })
  it('envoie une candidature individuelle sans PDF ni compte', async () => {
    const w = await form()
    await identity(w)
    await label(w, 'Vos compétences').setValue('Design')
    await label(w, 'J’ai pris connaissance').setValue(true)
    await w.find('form').trigger('submit')
    await vi.waitFor(() => expect(state.submit).toHaveBeenCalledTimes(1))
    await flushPromises()
    expect(state.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        participation_mode: 'individual',
        members: [],
        document: null,
        program: 'hackathon',
        consent: true,
      }),
    )
    expect(w.text()).toContain('HACKATHON-TEST')
    w.unmount()
  })
  it('conserve la référence technique sur un nouvel essai identique', async () => {
    state.submit
      .mockRejectedValueOnce(new Error('Coupure réseau'))
      .mockResolvedValue('HACKATHON-TEST')
    const w = await form()
    await identity(w)
    await label(w, 'Vos compétences').setValue('Design')
    await label(w, 'J’ai pris connaissance').setValue(true)
    await w.find('form').trigger('submit')
    await vi.waitFor(() => expect(state.submit).toHaveBeenCalledTimes(1))
    await flushPromises()
    expect(label(w, 'Email de contact').element.value).toBe('alice@example.invalid')
    await w.find('form').trigger('submit')
    await vi.waitFor(() => expect(state.submit).toHaveBeenCalledTimes(2))
    await flushPromises()
    expect(state.submit.mock.calls[0]![0].submission_key).toBe(
      state.submit.mock.calls[1]![0].submission_key,
    )
    w.unmount()
  })
  it('signale les fermetures sans afficher un faux formulaire', async () => {
    state.config.mockResolvedValue(null)
    const w = await form()
    expect(w.find('form').exists()).toBe(false)
    expect(w.text()).toContain('ne sont pas ouvertes')
    w.unmount()
  })
  it('exige le projet et son objectif pour Pitch', () => {
    expect(
      validateApplication(
        'pitch',
        {
          full_name: 'Alice',
          email: 'alice@example.invalid',
          phone: '',
          organization: '',
          project_name: 'Test',
          description: 'Projet',
          objective: '',
          skills: '',
          participation_mode: 'individual',
          team_name: '',
          members: [],
          members_authorized: false,
          consent: true,
        },
        5,
      ),
    ).toMatch(/objectif/)
  })
  it('rejette une équipe au-dessus de la limite côté client', () => {
    expect(
      validateApplication(
        'hackathon',
        {
          full_name: 'Alice',
          email: 'alice@example.invalid',
          phone: '',
          organization: '',
          project_name: '',
          description: '',
          objective: '',
          skills: 'Code',
          participation_mode: 'team',
          team_name: 'Test',
          members: [
            { full_name: 'Bob', skills: '' },
            { full_name: 'Chris', skills: '' },
          ],
          members_authorized: true,
          consent: true,
        },
        2,
      ),
    ).toMatch(/Maximum/)
  })
  it('affiche un réglage de taille d’équipe dans l’administration', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div/>' } }],
    })
    await router.push('/')
    const w = mount(Admin, { props: { program: 'hackathon' }, global: { plugins: [router] } })
    await flushPromises()
    expect(label(w, 'Maximum de personnes').element.value).toBe('5')
    expect(label(w, 'Maximum de personnes').attributes('max')).toBe('20')
    w.unmount()
  })
})
