export function normalizeBackgroundColor(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const match = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!match) {
    return undefined
  }

  const hex = match[1].toUpperCase()
  return hex.length === 3 ? `#${hex.split('').map((character) => `${character}${character}`).join('')}` : `#${hex}`
}
