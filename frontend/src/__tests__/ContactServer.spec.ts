// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { handle } from '../../../supabase/functions/contact-message/handler'
const env = {
  ALLOWED_ORIGINS: 'http://localhost:5173',
  SUPABASE_URL: 'https://sascoa-test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'server-only-demo',
  TURNSTILE_SECRET_KEY: 'server-only-captcha-demo',
}
const uuid = '00000000-0000-4000-8000-000000000001'
const payload = {
  submission_key: uuid,
  event_id: uuid,
  notice_version: uuid,
  consent: true,
  full_name: ' Alice Test ',
  email: ' ALICE@EXAMPLE.INVALID ',
  phone: '',
  organization: '',
  subject: 'Test de contact',
  message: 'Bonjour SASCOA',
  token: 'captcha-demo',
}
function request(data: unknown = payload, origin = 'http://localhost:5173') {
  return new Request('http://localhost/functions/v1/salon-preregistration', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(data),
  })
}
const ok = () =>
  vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({ success: true, hostname: 'localhost', action: 'contact-message' }),
    )
    .mockResolvedValueOnce(Response.json({ reference: 'PRE-DEMO' }))
describe('Collecte serveur des messages de contact', () => {
  it('refuse une origine étrangère avant tout appel réseau', async () => {
    const network = ok()
    expect((await handle(request(payload, 'https://foreign.invalid'), env, network)).status).toBe(
      403,
    )
    expect(network).not.toHaveBeenCalled()
  })
  it('répond aux prévols CORS sans accès à la base', async () => {
    expect(
      (
        await handle(
          new Request('https://demo.invalid', {
            method: 'OPTIONS',
            headers: { origin: 'http://localhost:5173' },
          }),
          env,
          ok(),
        )
      ).status,
    ).toBe(204)
  })
  it('refuse de démarrer sans secret serveur', async () => {
    expect((await handle(request(), { ...env, TURNSTILE_SECRET_KEY: '' }, ok())).status).toBe(503)
  })
  it.each([
    { ...payload, consent: false },
    { ...payload, email: 'invalide' },
    { ...payload, submission_key: 'invalide' },
    { ...payload, message: 'x'.repeat(10001) },
    { ...payload, token: '' },
  ])('refuse un formulaire invalide', async (input) => {
    const network = ok()
    expect((await handle(request(input), env, network)).status).toBe(400)
    expect(network).not.toHaveBeenCalled()
  })
  it('borne le corps sans Content-Length', async () => {
    expect((await handle(request({ message: 'x'.repeat(65000) }), env, ok())).status).toBe(413)
  })
  it.each([
    { success: false },
    { success: true, hostname: 'foreign.invalid', action: 'contact-message' },
    { success: true, hostname: 'localhost', action: 'other' },
  ])('contrôle le captcha côté serveur, son hôte et son action', async (result) => {
    const network = vi.fn().mockResolvedValue(Response.json(result))
    expect((await handle(request(), env, network)).status).toBe(400)
    expect(network).toHaveBeenCalledTimes(1)
  })
  it('normalise et limite les champs transmis sans accepter de statut client', async () => {
    const network = ok()
    const response = await handle(
      request({ ...payload, status: 'accepted', internal_note: 'inject' }),
      env,
      network,
    )
    expect(await response.json()).toEqual({ reference: 'PRE-DEMO' })
    const args = JSON.parse(network.mock.calls[1]![1].body)
    expect(args.p_email).toBe('alice@example.invalid')
    expect(args.p_name).toBe('Alice Test')
    expect(args).not.toHaveProperty('status')
    expect(args).not.toHaveProperty('internal_note')
    expect(args.p_hash).toMatch(/^[a-f0-9]{64}$/)
  })
  it('ne divulgue pas les messages de la base', async () => {
    const network = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ success: true, hostname: 'localhost', action: 'contact-message' }),
      )
      .mockResolvedValueOnce(
        Response.json({ code: 'XX000', message: 'PRIVATE DETAILS' }, { status: 500 }),
      )
    const response = await handle(request(), env, network)
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('PRIVATE')
  })
  it('préserve le signalement de limite horaire', async () => {
    const network = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ success: true, hostname: 'localhost', action: 'contact-message' }),
      )
      .mockResolvedValueOnce(Response.json({ code: 'P0001' }, { status: 400 }))
    expect((await handle(request(), env, network)).status).toBe(429)
  })
})
