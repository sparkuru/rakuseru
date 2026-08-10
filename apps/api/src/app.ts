import { node } from '@elysiajs/node'
import { openapi } from '@elysiajs/openapi'
import { Elysia, t } from 'elysia'
import type { ApiConfig } from './config/config.js'
import { ApiError, errorEnvelope } from './http/errors.js'
import {
  assertAllowedOrigin,
  csrfCookieName,
  readCookie,
  requestId,
  requireMutationSession,
  sessionFromRequest,
} from './http/security.js'
import type { SecurityService } from './modules/security/security-service.js'
import type { StructuredLogger } from './observability/logger.js'
import { digestsEqual, digestSecret } from './security/crypto.js'

const roleSchema = t.Union([t.Literal('owner'), t.Literal('administrator'), t.Literal('member')])
const errorSchema = t.Object({ error: t.Object({ code: t.String(), message: t.String(), requestId: t.String() }) })
const workspaceParams = t.Object({ workspaceId: t.String({ format: 'uuid' }) })
const workspaceTargetParams = t.Object({ workspaceId: t.String({ format: 'uuid' }), userId: t.String({ format: 'uuid' }) })
const invitationParams = t.Object({ workspaceId: t.String({ format: 'uuid' }), invitationId: t.String({ format: 'uuid' }) })
const credentialParams = t.Object({ workspaceId: t.String({ format: 'uuid' }), credentialId: t.String({ format: 'uuid' }) })
const errorResponses = { 400: errorSchema, 401: errorSchema, 403: errorSchema, 404: errorSchema, 409: errorSchema, 500: errorSchema, 503: errorSchema }
const workspaceSummarySchema = t.Object({ id: t.String({ format: 'uuid' }), name: t.String(), role: roleSchema, createdAt: t.String({ format: 'date-time' }), updatedAt: t.String({ format: 'date-time' }) })
const memberSummarySchema = t.Object({ id: t.String({ format: 'uuid' }), userId: t.String({ format: 'uuid' }), email: t.String(), role: roleSchema, active: t.Boolean(), createdAt: t.String({ format: 'date-time' }) })
const invitationSummarySchema = t.Object({ id: t.String({ format: 'uuid' }), email: t.String(), role: roleSchema, expiresAt: t.String({ format: 'date-time' }), acceptedAt: t.Union([t.String({ format: 'date-time' }), t.Null()]), revokedAt: t.Union([t.String({ format: 'date-time' }), t.Null()]), createdAt: t.String({ format: 'date-time' }) })
const credentialSummarySchema = t.Object({ id: t.String({ format: 'uuid' }), workspaceId: t.String({ format: 'uuid' }), name: t.String(), scopes: t.Array(t.String()), expiresAt: t.Union([t.String({ format: 'date-time' }), t.Null()]), revokedAt: t.Union([t.String({ format: 'date-time' }), t.Null()]), lastUsedAt: t.Union([t.String({ format: 'date-time' }), t.Null()]), createdAt: t.String({ format: 'date-time' }) })

export interface AppDependencies {
  readonly config: ApiConfig
  readonly security: SecurityService
  readonly ready: () => Promise<boolean>
  readonly logger: StructuredLogger
}

export function createApp(dependencies: AppDependencies) {
  const { config, security, logger } = dependencies
  const requestStartedAt = new WeakMap<Request, number>()
  return new Elysia({ adapter: node() })
    .use(openapi({
      path: '/openapi',
      specPath: '/openapi/json',
      documentation: {
        info: { title: 'Rakuseru hosted service foundation', version: '0.1.0' },
        tags: [{ name: 'health' }, { name: 'session' }, { name: 'workspace' }, { name: 'credentials' }],
      },
    }))
    .onRequest(({ request, set }) => {
      const id = requestId(request)
      requestStartedAt.set(request, performance.now())
      set.headers['x-request-id'] = id
      logger.log('info', 'http.request', { requestId: id, method: request.method, path: new URL(request.url).pathname })
    })
    .onError(({ error, request, set, code }) => {
      const id = requestId(request)
      const mapped = code === 'VALIDATION'
        ? errorEnvelope(new ApiError(400, 'bad_request', 'Request validation failed'), id)
        : errorEnvelope(error, id)
      set.status = mapped.status
      set.headers['x-request-id'] = id
      logger.log(mapped.status >= 500 ? 'error' : 'warn', 'http.error', {
        requestId: id,
        method: request.method,
        path: new URL(request.url).pathname,
        status: mapped.status,
        errorCode: mapped.body.error.code,
      })
      return mapped.body
    })
    .onAfterResponse(({ request, set }) => {
      logger.log('info', 'http.response', {
        requestId: requestId(request),
        method: request.method,
        path: new URL(request.url).pathname,
        status: set.status || 200,
        durationMs: Math.max(0, performance.now() - (requestStartedAt.get(request) ?? performance.now())),
      })
    })
    .get('/health/live', () => ({ status: 'live' as const }), {
      response: { 200: t.Object({ status: t.Literal('live') }), 500: errorSchema },
      detail: { tags: ['health'], summary: 'Process liveness' },
    })
    .get('/health/ready', async ({ set }) => {
      if (!await dependencies.ready()) {
        set.status = 503
        return { status: 'not_ready' as const }
      }
      return { status: 'ready' as const }
    }, {
      response: {
        200: t.Object({ status: t.Literal('ready') }),
        500: errorSchema,
        503: t.Object({ status: t.Literal('not_ready') }),
      },
      detail: { tags: ['health'], summary: 'Database and migration readiness' },
    })
    .group('/api/app', (app) => app
      .post('/auth/sign-in', async ({ body, request, cookie }) => {
        assertAllowedOrigin(request, config)
        const issued = await security.signIn(body.email, body.password, { requestId: requestId(request), now: new Date() })
        cookie[config.session.cookieName]?.set({ value: issued.sessionToken, path: '/', httpOnly: true, sameSite: 'lax', secure: config.session.secure, expires: issued.expiresAt })
        cookie[csrfCookieName(config)]?.set({ value: issued.csrfToken, path: '/', httpOnly: false, sameSite: 'lax', secure: config.session.secure, expires: issued.expiresAt })
        return { userId: issued.principal.userId, csrfToken: issued.csrfToken, expiresAt: issued.expiresAt.toISOString() }
      }, {
        body: t.Object({ email: t.String({ maxLength: 320 }), password: t.String({ minLength: 12, maxLength: 1024 }) }),
        response: { 200: t.Object({ userId: t.String({ format: 'uuid' }), csrfToken: t.String(), expiresAt: t.String({ format: 'date-time' }) }), ...errorResponses },
        detail: { tags: ['session'], summary: 'Sign in with local credentials' },
      })
      .get('/session', async ({ request }) => {
        const authenticated = await sessionFromRequest(request, config, security, true)
        if (!authenticated) throw new ApiError(401, 'unauthenticated', 'Session required')
        const csrfToken = readCookie(request, csrfCookieName(config))
        if (!csrfToken || !digestsEqual(authenticated.csrfDigest, digestSecret(csrfToken))) {
          throw new ApiError(401, 'unauthenticated', 'CSRF recovery cookie is invalid')
        }
        return { userId: authenticated.principal.userId, csrfToken, expiresAt: authenticated.expiresAt.toISOString() }
      }, {
        response: { 200: t.Object({ userId: t.String({ format: 'uuid' }), csrfToken: t.String(), expiresAt: t.String({ format: 'date-time' }) }), ...errorResponses },
        detail: { tags: ['session'], summary: 'Inspect active session' },
      })
      .post('/auth/sign-out', async ({ request, set, cookie }) => {
        const authenticated = await requireMutationSession(request, config, security)
        await security.signOut(authenticated.principal, { requestId: requestId(request), now: new Date(), principal: authenticated.principal })
        cookie[config.session.cookieName]?.set({ value: '', path: '/', httpOnly: true, sameSite: 'lax', secure: config.session.secure, expires: new Date(0), maxAge: 0 })
        cookie[csrfCookieName(config)]?.set({ value: '', path: '/', httpOnly: false, sameSite: 'lax', secure: config.session.secure, expires: new Date(0), maxAge: 0 })
        set.status = 204
      }, {
        response: { 204: t.Void(), ...errorResponses },
        detail: { tags: ['session'], summary: 'Revoke current session' },
      })
      .get('/workspaces', async ({ request }) => {
        const authenticated = await sessionFromRequest(request, config, security, true)
        if (!authenticated) throw new ApiError(401, 'unauthenticated', 'Session required')
        const workspaces = await security.listWorkspaces(authenticated.principal)
        return workspaces.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() }))
      }, {
        response: { 200: t.Array(workspaceSummarySchema), ...errorResponses },
        detail: { tags: ['workspace'], summary: 'List active workspaces' },
      })
      .post('/invitations/preview', async ({ body }) => {
        const invite = await security.previewInvitation(body.token, new Date())
        return { ...invite, expiresAt: invite.expiresAt.toISOString() }
      }, {
        body: t.Object({ token: t.String({ minLength: 20 }) }),
        response: { 200: t.Object({ workspaceId: t.String({ format: 'uuid' }), workspaceName: t.String(), maskedEmail: t.String(), role: roleSchema, expiresAt: t.String({ format: 'date-time' }) }), ...errorResponses },
        detail: { tags: ['workspace'], summary: 'Preview an invitation' },
      })
      .post('/invitations/accept', async ({ body, request }) => {
        assertAllowedOrigin(request, config)
        const authenticated = await sessionFromRequest(request, config, security, false)
        if (authenticated) {
          const csrf = request.headers.get('x-rakuseru-csrf')
          if (!csrf) throw new ApiError(403, 'forbidden', 'CSRF token is required')
          await requireMutationSession(request, config, security)
        }
        return security.acceptInvitation(body.token, body.password, authenticated?.principal, { requestId: requestId(request), now: new Date(), ...(authenticated ? { principal: authenticated.principal } : {}) })
      }, {
        body: t.Object({ token: t.String({ minLength: 20 }), password: t.Optional(t.String({ minLength: 12, maxLength: 1024 })) }),
        response: { 200: t.Object({ workspaceId: t.String({ format: 'uuid' }), userId: t.String({ format: 'uuid' }) }), ...errorResponses },
        detail: { tags: ['workspace'], summary: 'Accept an invitation' },
      })
      .get('/workspaces/:workspaceId/invitations', async ({ params, request }) => {
        const authenticated = await sessionFromRequest(request, config, security, true)
        if (!authenticated) throw new ApiError(401, 'unauthenticated', 'Session required')
        const invitations = await security.listInvitations(authenticated.principal, params.workspaceId)
        return invitations.map((item) => ({ ...item, expiresAt: item.expiresAt.toISOString(), acceptedAt: item.acceptedAt?.toISOString() ?? null, revokedAt: item.revokedAt?.toISOString() ?? null, createdAt: item.createdAt.toISOString() }))
      }, {
        params: workspaceParams,
        response: { 200: t.Array(invitationSummarySchema), ...errorResponses },
        detail: { tags: ['workspace'], summary: 'List workspace invitations' },
      })
      .post('/workspaces/:workspaceId/invitations', async ({ params, body, request }) => {
        const authenticated = await requireMutationSession(request, config, security)
        const invite = await security.createInvitation(authenticated.principal, params.workspaceId, body.email, body.role, { requestId: requestId(request), now: new Date(), principal: authenticated.principal })
        return { ...invite, expiresAt: invite.expiresAt.toISOString() }
      }, {
        params: workspaceParams,
        body: t.Object({ email: t.String({ maxLength: 320 }), role: roleSchema }),
        response: { 200: t.Intersect([t.Object({ token: t.String() }), t.Object({ id: t.String({ format: 'uuid' }), workspaceId: t.String({ format: 'uuid' }), email: t.String(), role: roleSchema, expiresAt: t.String({ format: 'date-time' }) })]), ...errorResponses },
        detail: { tags: ['workspace'], summary: 'Create a single-use invitation' },
      })
      .delete('/workspaces/:workspaceId/invitations/:invitationId', async ({ params, request, set }) => {
        const authenticated = await requireMutationSession(request, config, security)
        await security.revokeInvitation(authenticated.principal, params.workspaceId, params.invitationId, { requestId: requestId(request), now: new Date(), principal: authenticated.principal })
        set.status = 204
      }, {
        params: invitationParams,
        response: { 204: t.Void(), ...errorResponses },
        detail: { tags: ['workspace'], summary: 'Revoke an invitation' },
      })
      .get('/workspaces/:workspaceId/members', async ({ params, request }) => {
        const authenticated = await sessionFromRequest(request, config, security, true)
        if (!authenticated) throw new ApiError(401, 'unauthenticated', 'Session required')
        const members = await security.listMembers(authenticated.principal, params.workspaceId)
        return members.map((item) => ({ ...item, active: Boolean(item.active), createdAt: item.createdAt.toISOString() }))
      }, { params: workspaceParams, response: { 200: t.Array(memberSummarySchema), ...errorResponses }, detail: { tags: ['workspace'], summary: 'List workspace members' } })
      .patch('/workspaces/:workspaceId/members/:userId', async ({ params, body, request, set }) => {
        const authenticated = await requireMutationSession(request, config, security)
        await security.changeMemberRole(authenticated.principal, params.workspaceId, params.userId, body.role, { requestId: requestId(request), now: new Date(), principal: authenticated.principal })
        set.status = 204
      }, { params: workspaceTargetParams, body: t.Object({ role: roleSchema }), response: { 204: t.Void(), ...errorResponses }, detail: { tags: ['workspace'], summary: 'Change a member role' } })
      .delete('/workspaces/:workspaceId/members/:userId', async ({ params, request, set }) => {
        const authenticated = await requireMutationSession(request, config, security)
        await security.removeMember(authenticated.principal, params.workspaceId, params.userId, { requestId: requestId(request), now: new Date(), principal: authenticated.principal })
        set.status = 204
      }, { params: workspaceTargetParams, response: { 204: t.Void(), ...errorResponses }, detail: { tags: ['workspace'], summary: 'Remove a member' } })
      .post('/workspaces/:workspaceId/credentials', async ({ params, body, request }) => {
        const authenticated = await requireMutationSession(request, config, security)
        const credential = await security.createCredential(authenticated.principal, params.workspaceId, body.name, body.scopes, body.expiresAt ? new Date(body.expiresAt) : null, { requestId: requestId(request), now: new Date(), principal: authenticated.principal })
        return { ...credential, scopes: [...credential.scopes], expiresAt: credential.expiresAt?.toISOString() ?? null, revokedAt: null, lastUsedAt: null, createdAt: credential.createdAt.toISOString() }
      }, {
        params: workspaceParams,
        body: t.Object({ name: t.String({ minLength: 1, maxLength: 160 }), scopes: t.Array(t.String(), { minItems: 1, uniqueItems: true }), expiresAt: t.Union([t.String({ format: 'date-time' }), t.Null()]) }),
        response: { 200: t.Intersect([credentialSummarySchema, t.Object({ secret: t.String() })]), ...errorResponses },
        detail: { tags: ['credentials'], summary: 'Create a workspace-bound credential' },
      })
      .get('/workspaces/:workspaceId/credentials', async ({ params, request }) => {
        const authenticated = await sessionFromRequest(request, config, security, true)
        if (!authenticated) throw new ApiError(401, 'unauthenticated', 'Session required')
        const credentials = await security.listCredentials(authenticated.principal, params.workspaceId)
        return credentials.map((item) => ({ ...item, scopes: [...item.scopes], expiresAt: item.expiresAt?.toISOString() ?? null, revokedAt: item.revokedAt?.toISOString() ?? null, lastUsedAt: item.lastUsedAt?.toISOString() ?? null, createdAt: item.createdAt.toISOString() }))
      }, { params: workspaceParams, response: { 200: t.Array(credentialSummarySchema), ...errorResponses }, detail: { tags: ['credentials'], summary: 'List own credentials' } })
      .post('/workspaces/:workspaceId/credentials/:credentialId/reveal', async ({ params, request }) => {
        const authenticated = await requireMutationSession(request, config, security)
        return { secret: await security.revealCredential(authenticated.principal, params.workspaceId, params.credentialId, { requestId: requestId(request), now: new Date(), principal: authenticated.principal }) }
      }, { params: credentialParams, response: { 200: t.Object({ secret: t.String() }), ...errorResponses }, detail: { tags: ['credentials'], summary: 'Audit and reveal own credential' } })
      .post('/workspaces/:workspaceId/credentials/:credentialId/rotate', async ({ params, request }) => {
        const authenticated = await requireMutationSession(request, config, security)
        return { secret: await security.rotateCredential(authenticated.principal, params.workspaceId, params.credentialId, { requestId: requestId(request), now: new Date(), principal: authenticated.principal }) }
      }, { params: credentialParams, response: { 200: t.Object({ secret: t.String() }), ...errorResponses }, detail: { tags: ['credentials'], summary: 'Rotate own credential' } })
      .post('/workspaces/:workspaceId/credentials/:credentialId/revoke', async ({ params, request, set }) => {
        const authenticated = await requireMutationSession(request, config, security)
        await security.revokeCredential(authenticated.principal, params.workspaceId, params.credentialId, { requestId: requestId(request), now: new Date(), principal: authenticated.principal })
        set.status = 204
      }, { params: credentialParams, response: { 204: t.Void(), ...errorResponses }, detail: { tags: ['credentials'], summary: 'Revoke own credential' } }),
    )
}

export type ApiApp = ReturnType<typeof createApp>
