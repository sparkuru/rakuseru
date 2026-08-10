const SENSITIVE_KEY = /authorization|cookie|password|secret|token|csrf|ciphertext|plaintext/i

export type LogLevel = 'info' | 'warn' | 'error'

export interface StructuredLogger {
  log(level: LogLevel, event: string, fields?: Record<string, unknown>): void
}

export function redact(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string' && /(?:^|\s)(?:rkc_|rki_|Bearer\s+)[A-Za-z0-9._~-]+/i.test(value)) return '[REDACTED]'
  if (Array.isArray(value)) return value.map((item) => redact(item, seen))
  if (!value || typeof value !== 'object') return value
  if (seen.has(value)) return '[CIRCULAR]'
  seen.add(value)
  const output: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    output[key] = SENSITIVE_KEY.test(key) ? '[REDACTED]' : redact(item, seen)
  }
  return output
}

export class JsonLogger implements StructuredLogger {
  constructor(private readonly sink: (line: string) => void = (line) => process.stdout.write(`${line}\n`)) {}

  log(level: LogLevel, event: string, fields: Record<string, unknown> = {}): void {
    this.sink(JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...redact(fields) as object }))
  }
}
