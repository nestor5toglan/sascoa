import { describe, it, expect } from 'vitest'
import { effectScope } from 'vue'
import { safeHttpUrl, searchTerm, dateLabel, phoneLink } from '../lib/presentation'
import { useRemote } from '../composables/useRemote'

describe('Liens et recherches provenant du catalogue', () => {
  it.each([
    'javascript:alert(1)',
    'data:text/html,test',
    'https://user:password@example.com',
    '/local',
  ])('refuse %s', (url) => {
    expect(safeHttpUrl(url)).toBeNull()
  })
  it('accepte le site web facultatif et préserve les caractères français', () => {
    expect(safeHttpUrl(null)).toBeNull()
    expect(safeHttpUrl('https://example.com')).toBe('https://example.com/')
    expect(searchTerm('  Conseil, numérique%_(test)  ')).toBe('Conseil numérique test')
  })
  it('ne produit ni date invalide ni lien téléphonique arbitraire', () => {
    expect(dateLabel('invalide')).toBe('Date à confirmer')
    expect(dateLabel('2027-04-15T10:00:00Z', 'inconnu')).toContain('15 avril 2027')
    expect(phoneLink('+228 90 00 00 00')).toBe('tel:+22890000000')
    expect(phoneLink('abc')).toBeNull()
  })
})

describe('Recherches concurrentes et erreurs réseau', () => {
  it('conserve la dernière recherche même si la première arrive ensuite', async () => {
    const scope = effectScope()
    const state = scope.run(() => useRemote('initial'))!
    let finish!: (value: string) => void
    const old = state.run(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve
        }),
    )
    await state.run(async () => 'recherche récente')
    finish('ancienne recherche')
    await old
    expect(state.data.value).toBe('recherche récente')
    expect(state.loading.value).toBe(false)
    scope.stop()
  })
  it('distingue une erreur réseau d’un résultat vide et permet de réessayer', async () => {
    const scope = effectScope()
    const state = scope.run(() => useRemote<string[]>([]))!
    await state.run(async () => {
      throw new Error('Réseau indisponible')
    })
    expect(state.error.value).toBe('Réseau indisponible')
    await state.run(async () => [])
    expect(state.error.value).toBe('')
    expect(state.data.value).toEqual([])
    scope.stop()
  })
})
