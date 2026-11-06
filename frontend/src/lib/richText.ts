import DOMPurify from 'dompurify'
import { safeHttpUrl } from './presentation'
export const richMediaPath = /^rich\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/i
export function plainText(value: string | null | undefined): string {
  if (!value) return ''
  if (!/^\s*<(?:p|h[2-4]|ul|ol|blockquote|div|img|hr|strong|em)(?:\s|>)/i.test(value)) return value
  const doc = new DOMParser().parseFromString(
    DOMPurify.sanitize(value, {
      ALLOWED_TAGS: [
        'p',
        'h2',
        'h3',
        'h4',
        'ul',
        'ol',
        'li',
        'blockquote',
        'br',
        'strong',
        'em',
        'u',
        's',
        'a',
      ],
      ALLOWED_ATTR: [],
    }),
    'text/html',
  )
  doc.querySelectorAll('p,h2,h3,h4,li,br').forEach((n) => n.append(' '))
  return doc.body.textContent?.replace(/\s+/g, ' ').trim() || ''
}
export function safeRichHtml(value: string | null | undefined): string {
  if (!value) return ''
  let input = value
  if (!/^\s*<(?:p|h[2-4]|ul|ol|blockquote|div|img|hr|strong|em)(?:\s|>)/i.test(value)) {
    const escape = (s: string) =>
      s.replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
      )
    input = value
      .split(/\n\s*\n/)
      .map((p) => `<p>${escape(p).replace(/\n/g, '<br>')}</p>`)
      .join('')
  }
  const clean = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [
      'p',
      'h2',
      'h3',
      'h4',
      'ul',
      'ol',
      'li',
      'blockquote',
      'br',
      'strong',
      'em',
      'u',
      's',
      'a',
      'img',
      'hr',
    ],
    ALLOWED_ATTR: ['href', 'alt', 'title', 'data-media-path'],
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['data-media-path'],
  })
  const doc = new DOMParser().parseFromString(clean, 'text/html')
  doc.querySelectorAll('a').forEach((a) => {
    const href = a.getAttribute('href') || ''
    if (safeHttpUrl(href)) {
      a.setAttribute('href', safeHttpUrl(href)!)
      a.setAttribute('target', '_blank')
      a.setAttribute('rel', 'noopener noreferrer')
    } else if (
      /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(href) ||
      /^tel:\+?[0-9 ]{5,24}$/.test(href)
    ) {
      a.setAttribute('href', href)
    } else a.removeAttribute('href')
  })
  doc.querySelectorAll('img').forEach((img) => {
    const path = img.getAttribute('data-media-path') || ''
    if (!richMediaPath.test(path)) {
      img.remove()
      return
    }
    img.removeAttribute('src')
    img.setAttribute('alt', (img.getAttribute('alt') || 'Illustration').slice(0, 300))
  })
  return doc.body.innerHTML
}
