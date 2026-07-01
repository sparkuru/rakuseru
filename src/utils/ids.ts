export function createId(prefix: string): string {
  const randomId = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 10)
  return `${prefix}_${randomId.replace(/-/g, '').slice(0, 12)}`
}
