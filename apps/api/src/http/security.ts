import { randomUUID } from 'node:crypto'
import type { ApiConfig } from '../config/config.js'
import { ApiError } from './errors.js'
import { digestsEqual, digestSecret } from '../security/crypto.js'
import type { SecurityService, SessionAuthentication } from '../modules/security/security-service.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const generatedRequestIds = new WeakMap<Request, string>()

export function requestId(request: Request): string {
  const existing = generatedRequestIds.get(request)
  if (existing) return existing
  const supplied = request.headers.get('x-request-id')?.trim()
  const id = supplied && UUID_PATTERN.test(supplied) ? supplied : randomUUID()
  generatedRequestIds.set(request, id)
  return id
}

export function readCookie(request: Request, name: string): string | undefined {
  const cookie = request.headers.get('cookie')
  if (!cookie) return undefined
  for (const part of cookie.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1 || part.slice(0, separator).trim() !== name) continue
    try { return decodeURIComponent(part.slice(separator + 1).trim()) } catch { return undefined }
  }
  return undefined
}

export function csrfCookieName(config: ApiConfig): string {
  return `${config.session.cookieName}_csrf`
}

export function assertAllowedOrigin(request: Request, config: ApiConfig): void {
  if (request.headers.get('origin') !== config.publicOrigin) {
    throw new ApiError(403, 'forbidden', 'Request origin is not allowed')
  }
}

export async function sessionFromRequest(
  request: Request,
  config: ApiConfig,
  service: SecurityService,
  required = true,
): Promise<SessionAuthentication | undefined> {
  const rawToken = readCookie(request, config.session.cookieName)
  if (!rawToken) {
    if (required) throw new ApiError(401, 'unauthenticated', 'Session required')
    return undefined
  }
  return service.authenticateSession(rawToken, new Date())
}

export async function requireMutationSession(
  request: Request,
  config: ApiConfig,
  service: SecurityService,
): Promise<SessionAuthentication> {
  assertAllowedOrigin(request, config)
  const session = await sessionFromRequest(request, config, service, true)
  if (!session) throw new ApiError(401, 'unauthenticated', 'Session required')
  const csrfHeader = request.headers.get('x-rakuseru-csrf')
  const csrfCookie = readCookie(request, csrfCookieName(config))
  if (
    !csrfHeader ||
    !csrfCookie ||
    !digestsEqual(session.csrfDigest, digestSecret(csrfHeader)) ||
    !digestsEqual(session.csrfDigest, digestSecret(csrfCookie))
  ) {
    throw new ApiError(403, 'forbidden', 'CSRF token is invalid')
  }
  return session
}

export function sessionCookie(config: ApiConfig, token: string, expiresAt: Date): string {
  const values = [
    `${config.session.cookieName}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Expires=${expiresAt.toUTCString()}`,
  ]
  if (config.session.secure) values.push('Secure')
  return values.join('; ')
}

export function expiredSessionCookie(config: ApiConfig): string {
  const values = [
    `${config.session.cookieName}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'Max-Age=0',
  ]
  if (config.session.secure) values.push('Secure')
  return values.join('; ')
}
