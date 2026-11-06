export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null
  } catch {
    return null
  }
}

// Neutraliser la syntaxe spéciale PostgREST et les jokers ilike.
export function searchTerm(value: string): string {
  return value
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
}
export function errorText(value: unknown): string {
  if (value && typeof value === 'object' && 'message' in value) return String(value.message)
  return 'La connexion a été interrompue. Réessaie dans un instant.'
}
export function dateLabel(value: string, timezone = 'Africa/Lome'): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Date à confirmer'
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: timezone,
    }).format(date)
  } catch {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date)
  }
}
export function eventType(type: string): string {
  return (
    (
      {
        salon: 'Salon',
        forum: 'Forum',
        conference: 'Conférence',
        other: 'Rencontre',
      } as Record<string, string>
    )[type] ?? 'Rencontre'
  )
}
export function structureType(type: string): string {
  return (
    (
      {
        private: 'Entreprise privée',
        public: 'Structure publique',
        individual: 'Particulier',
      } as Record<string, string>
    )[type] ?? 'Structure'
  )
}
export function shortText(text: string, length = 160): string {
  return text.length > length ? `${text.slice(0, length).trimEnd()}…` : text
}
export function readableEmail(value: string | null): string | null {
  return value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null
}
export function phoneLink(value: string | null): string | null {
  const phone = value?.replace(/[^+\d]/g, '')
  return phone && /^\+?\d{5,20}$/.test(phone) ? `tel:${phone}` : null
}
