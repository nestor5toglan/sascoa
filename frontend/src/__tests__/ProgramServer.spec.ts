// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { handle } from '../../../supabase/functions/program-application/handler'
const uuid = '00000000-0000-4000-8000-000000000001',
  intent = '00000000-0000-4000-8000-000000000002'
const env = {
  ALLOWED_ORIGINS: 'http://localhost:5173',
  SUPABASE_URL: 'https://sascoa-test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'server-only-test',
  TURNSTILE_SECRET_KEY: 'captcha-server-test',
}
const input = {
  program: 'pitch',
  submission_key: uuid,
  notice_version: uuid,
  consent: true,
  full_name: ' Alice Test ',
  email: ' ALICE@EXAMPLE.INVALID ',
  phone: '',
  organization: 'Fictive',
  project_name: 'Test',
  description: 'Projet fictif',
  objective: 'Objectif fictif',
  skills: '',
  participation_mode: 'individual',
  team_name: '',
  members: [],
  members_authorized: false,
  document: null,
  token: 'captcha-test',
}
const pdf = { name: 'projet.pdf', base64: Buffer.from('%PDF-1.7\n%%EOF').toString('base64') }
function req(data: unknown = input, origin = 'http://localhost:5173', type = 'application/json') {
  return new Request('https://demo.invalid/program-application', {
    method: 'POST',
    headers: { origin, 'content-type': type },
    body: JSON.stringify(data),
  })
}
function backend(
  options: {
    captcha?: Record<string, unknown>
    reserve?: unknown
    uploadStatus?: number
    uploadBody?: unknown
    final?: unknown
    finalStatus?: number
    reserveStatus?: number
  } = {},
) {
  return vi.fn(async (url: RequestInfo | URL, _options?: RequestInit) => {
    const path = String(url)
    if (path.includes('siteverify'))
      return Response.json({
        success: true,
        hostname: 'localhost',
        action: 'program-application',
        ...options.captcha,
      })
    if (path.includes('reserve_program_application'))
      return Response.json(
        options.reserve || { intent_id: intent, file_path: `applications/${intent}.pdf` },
        { status: options.reserveStatus || 200 },
      )
    if (path.includes('/storage/'))
      return Response.json(options.uploadBody || { Key: 'private' }, {
        status: options.uploadStatus || 200,
      })
    if (path.includes('finalize_program_application'))
      return Response.json(options.final || { reference: 'PITCH-TEST' }, {
        status: options.finalStatus || 200,
      })
    throw new Error('Appel réseau inattendu')
  })
}
describe('Réception serveur des candidatures et PDF', () => {
  it('refuse une origine étrangère avant tout appel réseau', async () => {
    const net = backend()
    expect((await handle(req(input, 'https://foreign.invalid'), env, net)).status).toBe(403)
    expect(net).not.toHaveBeenCalled()
  })
  it('répond au prévol sans captcha ni base', async () => {
    const net = backend()
    expect(
      (
        await handle(
          new Request('https://demo.invalid', {
            method: 'OPTIONS',
            headers: { origin: 'http://localhost:5173' },
          }),
          env,
          net,
        )
      ).status,
    ).toBe(204)
    expect(net).not.toHaveBeenCalled()
  })
  it('refuse une méthode différente', async () =>
    expect(
      (
        await handle(
          new Request('https://demo.invalid', { headers: { origin: 'http://localhost:5173' } }),
          env,
          backend(),
        )
      ).status,
    ).toBe(405))
  it('refuse de démarrer sans secret', async () =>
    expect((await handle(req(), { ...env, TURNSTILE_SECRET_KEY: '' }, backend())).status).toBe(503))
  it('refuse un format non JSON', async () =>
    expect(
      (await handle(req(input, 'http://localhost:5173', 'text/plain'), env, backend())).status,
    ).toBe(415))
  it.each([
    { consent: false },
    { program: 'other' },
    { submission_key: 'incorrect' },
    { objective: '' },
    { email: 'invalide' },
    { members: [{ full_name: 'Bob', skills: '' }] },
  ])('refuse les champs invalides %j', async (patch) => {
    const net = backend()
    expect((await handle(req({ ...input, ...patch }), env, net)).status).toBe(400)
    expect(net).not.toHaveBeenCalled()
  })
  it('refuse une équipe Pitch', async () =>
    expect(
      (
        await handle(
          req({
            ...input,
            participation_mode: 'team',
            team_name: 'Test',
            members: [{ full_name: 'Bob', skills: '' }],
            members_authorized: true,
          }),
          env,
          backend(),
        )
      ).status,
    ).toBe(400))
  it('refuse une équipe Hackathon sans autorisation', async () =>
    expect(
      (
        await handle(
          req({
            ...input,
            program: 'hackathon',
            skills: 'Design',
            participation_mode: 'team',
            team_name: 'Test',
            members: [{ full_name: 'Bob', skills: '' }],
          }),
          env,
          backend(),
        )
      ).status,
    ).toBe(400))
  it('accepte une équipe Hackathon et retire les clés non autorisées', async () => {
    const net = backend()
    const response = await handle(
      req({
        ...input,
        program: 'hackathon',
        skills: 'Design',
        participation_mode: 'team',
        team_name: 'Test',
        members: [{ full_name: ' Bob ', skills: ' Code ', private: 'inject' }],
        members_authorized: true,
        role: 'root',
        status: 'accepted',
      }),
      env,
      net,
    )
    expect(response.status).toBe(200)
    const init = net.mock.calls.find(([url]) =>
      String(url).includes('reserve_program_application'),
    )![1] as RequestInit
    const body = JSON.parse(String(init.body))
    expect(body.p_payload.email).toBe('alice@example.invalid')
    expect(body.p_payload.members).toEqual([{ full_name: 'Bob', skills: 'Code' }])
    expect(body.p_payload).not.toHaveProperty('role')
    expect(body.p_payload).not.toHaveProperty('status')
  })
  it.each([{ success: false }, { action: 'other' }, { hostname: 'foreign.invalid' }])(
    'refuse le captcha incohérent %j',
    async (captcha) => {
      const net = backend({ captcha })
      expect((await handle(req(), env, net)).status).toBe(400)
      expect(net).toHaveBeenCalledTimes(1)
    },
  )
  it('accepte une candidature sans PDF sans appeler Storage', async () => {
    const net = backend()
    const result = await handle(req(), env, net)
    expect(await result.json()).toEqual({ reference: 'PITCH-TEST' })
    expect(net.mock.calls.some(([url]) => String(url).includes('/storage/'))).toBe(false)
  })
  it('dépose le PDF dans le bucket privé sans écrasement et finalise ensuite', async () => {
    const net = backend()
    expect((await handle(req({ ...input, document: pdf }), env, net)).status).toBe(200)
    const urls = net.mock.calls.map((c) => String(c[0]))
    expect(urls[2]).toContain(`/storage/v1/object/sascoa-private/applications/${intent}.pdf`)
    expect(urls[3]).toContain('finalize_program_application')
    const options = net.mock.calls[2]![1] as RequestInit
    expect((options.headers as Record<string, string>)['x-upsert']).toBe('false')
    expect(new TextDecoder().decode(options.body as ArrayBuffer)).toContain('%PDF-1.7')
  })
  it('refuse un faux PDF avant la réservation', async () => {
    const net = backend()
    expect(
      (
        await handle(
          req({
            ...input,
            document: {
              name: 'faux.pdf',
              base64: Buffer.from('<svg>test</svg>').toString('base64'),
            },
          }),
          env,
          net,
        )
      ).status,
    ).toBe(400)
    expect(net).not.toHaveBeenCalled()
  })
  it('borne la lecture des corps trop grands', async () => {
    const net = backend()
    expect(
      (await handle(req({ ...input, extra: 'x'.repeat(8 * 1024 * 1024) }), env, net)).status,
    ).toBe(413)
    expect(net).not.toHaveBeenCalled()
  })
  it('refuse un PDF surdimensionné', async () => {
    const bytes = Buffer.alloc(5 * 1024 * 1024 + 1)
    bytes.write('%PDF-1.7')
    const net = backend()
    expect(
      (
        await handle(
          req({ ...input, document: { name: 'gros.pdf', base64: bytes.toString('base64') } }),
          env,
          net,
        )
      ).status,
    ).toBe(400)
    expect(net).not.toHaveBeenCalled()
  })
  it('retourne la référence existante sans redéposer un document', async () => {
    const net = backend({ reserve: { reference: 'PITCH-EXISTANT' } })
    expect(await (await handle(req({ ...input, document: pdf }), env, net)).json()).toEqual({
      reference: 'PITCH-EXISTANT',
    })
    expect(net).toHaveBeenCalledTimes(2)
  })
  it('reprend un upload identique déjà existant', async () => {
    const net = backend({
      uploadStatus: 400,
      uploadBody: { error: 'Duplicate', message: 'The resource already exists' },
    })
    expect((await handle(req({ ...input, document: pdf }), env, net)).status).toBe(200)
  })
  it('ne finalise pas après un upload en erreur', async () => {
    const net = backend({ uploadStatus: 503 })
    expect((await handle(req({ ...input, document: pdf }), env, net)).status).toBe(503)
    expect(
      net.mock.calls.some(([url]) => String(url).includes('finalize_program_application')),
    ).toBe(false)
  })
  it('refuse un chemin de stockage inattendu renvoyé par la base', async () => {
    const net = backend({ reserve: { intent_id: intent, file_path: '../../private.pdf' } })
    expect((await handle(req({ ...input, document: pdf }), env, net)).status).toBe(503)
    expect(net.mock.calls.some(([url]) => String(url).includes('/storage/'))).toBe(false)
  })
  it('applique la limite avant le dépôt', async () => {
    const net = backend({ reserveStatus: 400, reserve: { code: 'P0001' } })
    expect((await handle(req({ ...input, document: pdf }), env, net)).status).toBe(429)
    expect(net).toHaveBeenCalledTimes(2)
  })
  it('signale une configuration changée sans publier les détails SQL', async () => {
    const net = backend({
      finalStatus: 400,
      final: { code: '22023', details: 'information privée' },
    })
    const response = await handle(req(), env, net)
    expect(response.status).toBe(409)
    expect(JSON.stringify(await response.json())).not.toContain('information privée')
  })
  it('conserve un hash indépendant du jeton anti-robot', async () => {
    const net = backend()
    await handle(req(), env, net)
    await handle(req({ ...input, token: 'autre-token' }), env, net)
    const calls = net.mock.calls.filter(([url]) =>
      String(url).includes('reserve_program_application'),
    )
    expect(JSON.parse(String((calls[0]![1] as RequestInit).body)).p_hash).toBe(
      JSON.parse(String((calls[1]![1] as RequestInit).body)).p_hash,
    )
  })
})
