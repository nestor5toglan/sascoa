import { describe, it, expect } from 'vitest'
import { safeRichHtml, plainText, richMediaPath } from '../lib/richText'
const image = 'rich/00000000-0000-4000-8000-000000000001.png'
describe('Contenus enrichis : conservation et sécurité', () => {
  it('préserve paragraphes et retours à la ligne des anciens textes', () => {
    expect(safeRichHtml('Bonjour\nSASCOA\n\nAu revoir')).toBe(
      '<p>Bonjour<br>SASCOA</p><p>Au revoir</p>',
    )
  })
  it('échappe les caractères d’un ancien texte brut', () => {
    expect(safeRichHtml('2 < 3 & 4')).toBe('<p>2 &lt; 3 &amp; 4</p>')
  })
  it('conserve titres, listes, gras et italiques', () => {
    const html = safeRichHtml(
      '<h2>Titre</h2><ul><li><strong>Texte</strong> <em>utile</em></li></ul>',
    )
    expect(html).toContain('<h2>Titre</h2>')
    expect(html).toContain('<strong>Texte</strong>')
  })
  it('retire scripts, événements, styles et iframes', () => {
    const html = safeRichHtml(
      '<p style="color:red" onclick="alert(1)">Texte<script>alert(1)</script><iframe src="https://example.com"></iframe></p>',
    )
    expect(html).toBe('<p>Texte</p>')
  })
  it.each(['javascript:alert(1)', 'data:text/html,test', 'https://user:pass@example.com'])(
    'retire le lien dangereux %s',
    (href) => {
      expect(safeRichHtml(`<p><a href="${href}">Lien</a></p>`)).not.toContain('href=')
    },
  )
  it('sécurise les liens HTTPS ouverts dans un nouvel onglet', () => {
    const html = safeRichHtml('<p><a href="https://example.com">Lien</a></p>')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('target="_blank"')
  })
  it('conserve les liens email et téléphone', () => {
    expect(
      safeRichHtml(
        '<p><a href="mailto:contact@sascoa.com">Email</a><a href="tel:+22898932000">Tel</a></p>',
      ),
    ).toContain('mailto:contact@sascoa.com')
  })
  it('ne stocke pas les URLs signées des images', () => {
    const html = safeRichHtml(
      `<p>Illustration</p><img data-media-path="${image}" src="https://storage.invalid?token=secret" onerror="alert(1)" alt="Texte">`,
    )
    expect(html).toContain(`data-media-path="${image}"`)
    expect(html).not.toContain('src=')
    expect(html).not.toContain('secret')
    expect(html).not.toContain('onerror')
  })
  it.each(['sascoa-private/document.pdf', '../secret.png', 'rich/not-uuid.png'])(
    'rejette la référence image %s',
    (path) => {
      expect(safeRichHtml(`<p>Texte</p><img data-media-path="${path}">`)).not.toContain('<img')
    },
  )
  it('refuse les images externes ou collées en base64', () => {
    expect(
      safeRichHtml(
        '<p>Texte</p><img src="data:image/png;base64,abc"><img src="https://example.com/photo.jpg">',
      ),
    ).toBe('<p>Texte</p>')
  })
  it('retire la mise en forme pour les résumés de cartes', () => {
    expect(plainText('<h2>Notre offre</h2><p>Conseil <strong>et services</strong></p>')).toBe(
      'Notre offre Conseil et services',
    )
  })
  it('reconnaît une présentation vide malgré ses balises', () => {
    expect(plainText('<p><br></p>')).toBe('')
    expect(richMediaPath.test(image)).toBe(true)
  })
})
