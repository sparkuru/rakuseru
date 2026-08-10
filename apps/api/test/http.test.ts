import { describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import type { ApiConfig } from '../src/config/config.js'
import type { SecurityService } from '../src/modules/security/security-service.js'
import { digestSecret } from '../src/security/crypto.js'

const requestUuid = 'f4ff6bd4-5160-4e10-9b37-ed0d2a748141'

function config(): ApiConfig {
  return {
    environment: 'test',
    host: '127.0.0.1',
    port: 3000,
    publicOrigin: 'https://sheets.example.test',
    database: { host: 'db', port: 3306, name: 'test', user: 'test', password: 'test-value', connectionLimit: 1 },
    session: { cookieName: 'rakuseru_session', ttlSeconds: 3600, secure: false },
    credentialEncryptionKey: Buffer.alloc(32, 4),
    credentialKeyVersion: 1,
  }
}

function app(ready = true) {
  const signIn = vi.fn().mockResolvedValue({
    principal: { kind: 'session', userId: 'a4f89a16-17bb-4a4f-8799-49cd2e81b598', sessionId: '90b3e4b0-10c7-44e9-a78e-335205f8795c', scopes: [] },
    sessionToken: 'session-secret',
    csrfToken: 'csrf-secret',
    expiresAt: new Date('2030-01-01T00:00:00.000Z'),
  })
  const authenticateSession = vi.fn().mockResolvedValue({
    principal: { kind: 'session', userId: 'a4f89a16-17bb-4a4f-8799-49cd2e81b598', sessionId: '90b3e4b0-10c7-44e9-a78e-335205f8795c', scopes: [] },
    csrfDigest: digestSecret('csrf-secret'),
    expiresAt: new Date('2030-01-01T00:00:00.000Z'),
  })
  const signOut = vi.fn().mockResolvedValue(undefined)
  const security = { signIn, authenticateSession, signOut } as unknown as SecurityService
  return { instance: createApp({ config: config(), security, ready: async () => ready, logger: { log: vi.fn() } }), signIn, signOut }
}

describe('API app contract', () => {
  it('reports liveness and migration-aware readiness', async () => {
    expect(await (await app().instance.handle(new Request('http://localhost/health/live'))).json()).toEqual({ status: 'live' })
    const notReady = await app(false).instance.handle(new Request('http://localhost/health/ready'))
    expect(notReady.status).toBe(503)
    expect(await notReady.json()).toEqual({ status: 'not_ready' })
  })

  it('uses one request ID in header and error envelope', async () => {
    const response = await app().instance.handle(new Request('http://localhost/api/app/auth/sign-in', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://sheets.example.test', 'x-request-id': requestUuid },
      body: JSON.stringify({ email: 'invalid' }),
    }))
    expect(response.status).toBe(400)
    expect(response.headers.get('x-request-id')).toBe(requestUuid)
    expect((await response.json()).error.requestId).toBe(requestUuid)
  })

  it('sets HttpOnly session and recoverable CSRF cookies on sign-in', async () => {
    const response = await app().instance.handle(new Request('http://localhost/api/app/auth/sign-in', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://sheets.example.test' },
      body: JSON.stringify({ email: 'owner@example.test', password: 'a sufficiently long passphrase' }),
    }))
    expect(response.status).toBe(200)
    const cookies = response.headers.getSetCookie().join('\n')
    expect(cookies).toMatch(/rakuseru_session=.*HttpOnly.*SameSite=Lax/i)
    expect(cookies).toMatch(/rakuseru_session_csrf=.*SameSite=Lax/i)
    expect(cookies.match(/rakuseru_session_csrf=.*HttpOnly/i)).toBeNull()
  })

  it('recovers CSRF after reload and requires matching origin, cookie, and header for sign-out', async () => {
    const cookie = 'rakuseru_session=session-secret; rakuseru_session_csrf=csrf-secret'
    const recovered = await app().instance.handle(new Request('http://localhost/api/app/session', { headers: { cookie } }))
    expect(recovered.status).toBe(200)
    expect(await recovered.json()).toMatchObject({ csrfToken: 'csrf-secret' })

    const missingHeader = await app().instance.handle(new Request('http://localhost/api/app/auth/sign-out', {
      method: 'POST',
      headers: { cookie, origin: 'https://sheets.example.test' },
    }))
    expect(missingHeader.status).toBe(403)

    const wrongOrigin = await app().instance.handle(new Request('http://localhost/api/app/auth/sign-out', {
      method: 'POST',
      headers: { cookie, origin: 'https://attacker.example', 'x-rakuseru-csrf': 'csrf-secret' },
    }))
    expect(wrongOrigin.status).toBe(403)

    const fixture = app()
    const signedOut = await fixture.instance.handle(new Request('http://localhost/api/app/auth/sign-out', {
      method: 'POST',
      headers: { cookie, origin: 'https://sheets.example.test', 'x-rakuseru-csrf': 'csrf-secret' },
    }))
    expect(signedOut.status).toBe(204)
    expect(fixture.signOut).toHaveBeenCalledOnce()
    expect(signedOut.headers.getSetCookie().join('\n')).toMatch(/rakuseru_session.*Max-Age=0[\s\S]*rakuseru_session_csrf.*Max-Age=0/i)
  })

  it('publishes only the approved foundation route namespace', async () => {
    const response = await app().instance.handle(new Request('http://localhost/openapi/json'))
    expect(response.status).toBe(200)
    const document = await response.json() as { paths: Record<string, unknown> }
    const approved = [
      '/health/live',
      '/health/ready',
      '/api/app/auth/sign-in',
      '/api/app/auth/sign-out',
      '/api/app/session',
      '/api/app/workspaces',
      '/api/app/workspaces/{workspaceId}/members',
      '/api/app/workspaces/{workspaceId}/members/{userId}',
      '/api/app/workspaces/{workspaceId}/invitations',
      '/api/app/workspaces/{workspaceId}/invitations/{invitationId}',
      '/api/app/invitations/preview',
      '/api/app/invitations/accept',
      '/api/app/workspaces/{workspaceId}/credentials',
      '/api/app/workspaces/{workspaceId}/credentials/{credentialId}/reveal',
      '/api/app/workspaces/{workspaceId}/credentials/{credentialId}/rotate',
      '/api/app/workspaces/{workspaceId}/credentials/{credentialId}/revoke',
    ]
    expect(Object.keys(document.paths)).toEqual(expect.arrayContaining(approved))
    expect(Object.keys(document.paths).some((path) => path.startsWith('/api/v1'))).toBe(false)
  })
})
