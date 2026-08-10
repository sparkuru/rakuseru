import { randomUUID } from 'node:crypto'
import type { Kysely, Transaction } from 'kysely'
import type { ApiConfig } from '../../config/config.js'
import {
  normalizeScopes,
  parseCredentialScopes,
  resolveWorkspacePolicy,
  type AuthenticatedPrincipal,
  type CredentialScope,
  type RequestContext,
  type WorkspacePolicy,
  type WorkspaceRole,
} from '../../contracts.js'
import type { DatabaseSchema } from '../../db/types.js'
import { ApiError } from '../../http/errors.js'
import { writeAudit } from '../audit/audit.js'
import {
  credentialAad,
  decryptCredential,
  digestSecret,
  encryptCredential,
  generateOpaqueToken,
  type PasswordHasher,
} from '../../security/crypto.js'

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1_000

type SecurityTransaction = Transaction<DatabaseSchema>
type SessionPrincipal = Extract<AuthenticatedPrincipal, { kind: 'session' }>

function requireSessionPrincipal(principal: AuthenticatedPrincipal): SessionPrincipal {
  if (principal.kind !== 'session') throw new ApiError(401, 'unauthenticated', 'Session required')
  return principal
}

export interface SessionAuthentication {
  readonly principal: AuthenticatedPrincipal
  readonly csrfDigest: Buffer
  readonly expiresAt: Date
}

export interface SessionIssue {
  readonly principal: AuthenticatedPrincipal
  readonly sessionToken: string
  readonly csrfToken: string
  readonly expiresAt: Date
}

export interface CredentialView {
  readonly id: string
  readonly workspaceId: string
  readonly name: string
  readonly scopes: readonly CredentialScope[]
  readonly expiresAt: Date | null
  readonly revokedAt: Date | null
  readonly lastUsedAt: Date | null
  readonly createdAt: Date
}

export interface CreatedCredential extends CredentialView {
  readonly secret: string
}

export interface InvitationView {
  readonly id: string
  readonly workspaceId: string
  readonly email: string
  readonly role: WorkspaceRole
  readonly expiresAt: Date
}

export interface InvitationPreview {
  readonly workspaceId: string
  readonly workspaceName: string
  readonly maskedEmail: string
  readonly role: WorkspaceRole
  readonly expiresAt: Date
}

export interface WorkspaceSummary {
  readonly id: string
  readonly name: string
  readonly role: WorkspaceRole
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface MemberSummary {
  readonly id: string
  readonly userId: string
  readonly email: string
  readonly role: WorkspaceRole
  readonly active: number
  readonly createdAt: Date
}

export interface InvitationSummary {
  readonly id: string
  readonly email: string
  readonly role: WorkspaceRole
  readonly expiresAt: Date
  readonly acceptedAt: Date | null
  readonly revokedAt: Date | null
  readonly createdAt: Date
}

function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase()
  if (normalized.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new ApiError(400, 'bad_request', 'A valid email address is required')
  }
  return normalized
}

function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@', 2)
  const visible = local.slice(0, 1)
  return `${visible}${'*'.repeat(Math.max(3, local.length - 1))}@${domain}`
}

function activeAt(expiresAt: Date | null, revokedAt: Date | null, now: Date): boolean {
  return revokedAt === null && (expiresAt === null || expiresAt.getTime() > now.getTime())
}

function credentialView(row: {
  id: string
  workspace_id: string
  name: string
  scopes: string
  expires_at: Date | null
  revoked_at: Date | null
  last_used_at: Date | null
  created_at: Date
}): CredentialView {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    scopes: parseCredentialScopes(row.scopes),
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
  }
}

export class SecurityService {
  constructor(
    private readonly db: Kysely<DatabaseSchema>,
    private readonly passwords: PasswordHasher,
    private readonly config: ApiConfig,
  ) {}

  async bootstrap(
    emailInput: string,
    password: string,
    workspaceNameInput: string,
    requestId: string,
  ): Promise<'created' | 'already_initialized'> {
    const email = normalizeEmail(emailInput)
    const workspaceName = workspaceNameInput.trim()
    if (!workspaceName || workspaceName.length > 160) {
      throw new ApiError(400, 'bad_request', 'Workspace name is required')
    }
    const passwordHash = await this.passwords.hash(password)
    return this.db.transaction().execute(async (trx) => {
      const state = await trx.selectFrom('instance_state').selectAll().where('id', '=', 1).forUpdate().executeTakeFirstOrThrow()
      const userCount = Number((await trx.selectFrom('users').select(({ fn }) => fn.countAll().as('count')).executeTakeFirstOrThrow()).count)
      const workspaceCount = Number((await trx.selectFrom('workspaces').select(({ fn }) => fn.countAll().as('count')).executeTakeFirstOrThrow()).count)
      if (userCount || workspaceCount) {
        const existing = await trx
          .selectFrom('users as u')
          .innerJoin('workspace_members as m', 'm.user_id', 'u.id')
          .innerJoin('workspaces as w', 'w.id', 'm.workspace_id')
          .select(['u.id as user_id', 'u.email', 'u.password_hash', 'u.enabled', 'm.role', 'm.active', 'w.id as workspace_id', 'w.name'])
          .execute()
        if (
          Boolean(state.initialized) &&
          userCount === 1 &&
          workspaceCount === 1 &&
          existing.length === 1 &&
          state.owner_user_id === existing[0]?.user_id &&
          state.workspace_id === existing[0]?.workspace_id &&
          existing[0]?.email === email &&
          existing[0].name === workspaceName &&
          existing[0].role === 'owner' &&
          Boolean(existing[0].enabled) &&
          Boolean(existing[0].active) &&
          await this.passwords.verify(existing[0].password_hash, password)
        ) return 'already_initialized'
        throw new ApiError(409, 'conflict', 'The instance is already initialized with different settings')
      }
      if (state.initialized || state.owner_user_id || state.workspace_id || state.initialized_at) {
        throw new ApiError(409, 'conflict', 'The instance state is inconsistent')
      }
      const now = new Date()
      const userId = randomUUID()
      const workspaceId = randomUUID()
      await trx.insertInto('users').values({ id: userId, email, password_hash: passwordHash, enabled: true, created_at: now, updated_at: now }).executeTakeFirstOrThrow()
      await trx.insertInto('workspaces').values({ id: workspaceId, name: workspaceName, created_at: now, updated_at: now }).executeTakeFirstOrThrow()
      await trx.insertInto('workspace_members').values({ id: randomUUID(), workspace_id: workspaceId, user_id: userId, role: 'owner', active: true, created_by_user_id: null, created_at: now, updated_at: now }).executeTakeFirstOrThrow()
      await trx.updateTable('instance_state').set({ initialized: true, owner_user_id: userId, workspace_id: workspaceId, initialized_at: now }).where('id', '=', 1).executeTakeFirstOrThrow()
      await writeAudit(trx, { workspaceId, actorType: 'system', actorUserId: null, action: 'instance.bootstrap', targetType: 'workspace', targetId: workspaceId, requestId, details: { ownerUserId: userId }, now })
      return 'created'
    })
  }

  async signIn(emailInput: string, password: string, context: RequestContext): Promise<SessionIssue> {
    const email = normalizeEmail(emailInput)
    const user = await this.db.selectFrom('users').selectAll().where('email', '=', email).executeTakeFirst()
    if (!user || !user.enabled || !await this.passwords.verify(user.password_hash, password)) {
      await this.bestEffortAudit({ workspaceId: null, actorType: 'system', actorUserId: null, action: 'auth.sign_in_rejected', targetType: 'user', targetId: user?.id ?? null, requestId: context.requestId, now: context.now })
      throw new ApiError(401, 'unauthenticated', 'Email or password is invalid')
    }
    const session = generateOpaqueToken()
    const csrf = generateOpaqueToken()
    const sessionId = randomUUID()
    const expiresAt = new Date(context.now.getTime() + this.config.session.ttlSeconds * 1_000)
    await this.db.transaction().execute(async (trx) => {
      await trx.insertInto('sessions').values({ id: sessionId, token_digest: session.digest, csrf_digest: csrf.digest, user_id: user.id, issued_at: context.now, last_seen_at: context.now, expires_at: expiresAt, revoked_at: null, client_ip: null, user_agent: null }).executeTakeFirstOrThrow()
      await writeAudit(trx, { workspaceId: null, actorType: 'user', actorUserId: user.id, action: 'auth.sign_in', targetType: 'session', targetId: sessionId, requestId: context.requestId, now: context.now })
    })
    return { principal: { kind: 'session', userId: user.id, sessionId }, sessionToken: session.raw, csrfToken: csrf.raw, expiresAt }
  }

  async authenticateSession(rawToken: string, now: Date): Promise<SessionAuthentication> {
    return this.db.transaction().execute(async (trx) => {
      const session = await trx
        .selectFrom('sessions')
        .select(['id', 'csrf_digest', 'user_id', 'expires_at', 'revoked_at'])
        .where('token_digest', '=', digestSecret(rawToken))
        .forUpdate()
        .executeTakeFirst()
      if (!session || !activeAt(session.expires_at, session.revoked_at, now)) {
        throw new ApiError(401, 'unauthenticated', 'Session is invalid or expired')
      }
      const user = await trx.selectFrom('users').select('enabled').where('id', '=', session.user_id).forUpdate().executeTakeFirst()
      if (!user?.enabled) throw new ApiError(401, 'unauthenticated', 'Session is invalid or expired')
      await trx.updateTable('sessions').set({ last_seen_at: now }).where('id', '=', session.id).executeTakeFirstOrThrow()
      return { principal: { kind: 'session', userId: session.user_id, sessionId: session.id }, csrfDigest: session.csrf_digest, expiresAt: session.expires_at }
    })
  }

  async signOut(principal: AuthenticatedPrincipal, context: RequestContext): Promise<void> {
    const sessionPrincipal = requireSessionPrincipal(principal)
    await this.db.transaction().execute(async (trx) => {
      await trx.updateTable('sessions').set({ revoked_at: context.now }).where('id', '=', sessionPrincipal.sessionId).where('revoked_at', 'is', null).execute()
      await writeAudit(trx, { workspaceId: null, actorType: 'user', actorUserId: sessionPrincipal.userId, action: 'auth.sign_out', targetType: 'session', targetId: sessionPrincipal.sessionId, requestId: context.requestId, now: context.now })
    })
  }

  async workspacePolicy(principal: AuthenticatedPrincipal, workspaceId: string): Promise<WorkspacePolicy> {
    return this.workspacePolicyUsing(this.db, principal, workspaceId, false)
  }

  private async workspacePolicyUsing(
    db: Kysely<DatabaseSchema> | SecurityTransaction,
    principal: AuthenticatedPrincipal,
    workspaceId: string,
    lock: boolean,
  ): Promise<WorkspacePolicy> {
    if (principal.kind === 'credential' && principal.workspaceId !== workspaceId) {
      throw new ApiError(403, 'forbidden', 'Credential is bound to a different workspace')
    }
    let query = db.selectFrom('workspace_members').select(['role']).where('workspace_id', '=', workspaceId).where('user_id', '=', principal.userId).where('active', '=', 1)
    if (lock) query = query.forUpdate()
    const member = await query.executeTakeFirst()
    if (!member) throw new ApiError(403, 'forbidden', 'Active workspace membership required')
    return resolveWorkspacePolicy(workspaceId, principal.userId, member.role)
  }

  async listMembers(principal: AuthenticatedPrincipal, workspaceId: string): Promise<MemberSummary[]> {
    requireSessionPrincipal(principal)
    return this.db.transaction().execute(async (trx) => {
      const policy = await this.workspacePolicyUsing(trx, principal, workspaceId, true)
      if (!policy.canManageMembers) throw new ApiError(403, 'forbidden', 'Workspace administration denied')
      return trx.selectFrom('workspace_members as m').innerJoin('users as u', 'u.id', 'm.user_id').select(['m.id', 'm.user_id as userId', 'u.email', 'm.role', 'm.active', 'm.created_at as createdAt']).where('m.workspace_id', '=', workspaceId).execute() as Promise<MemberSummary[]>
    })
  }

  async listWorkspaces(principal: AuthenticatedPrincipal): Promise<WorkspaceSummary[]> {
    requireSessionPrincipal(principal)
    return this.db
      .selectFrom('workspace_members as m')
      .innerJoin('workspaces as w', 'w.id', 'm.workspace_id')
      .select(['w.id', 'w.name', 'm.role', 'w.created_at as createdAt', 'w.updated_at as updatedAt'])
      .where('m.user_id', '=', principal.userId)
      .where('m.active', '=', 1)
      .orderBy('w.name')
      .execute() as Promise<WorkspaceSummary[]>
  }

  async listInvitations(principal: AuthenticatedPrincipal, workspaceId: string): Promise<InvitationSummary[]> {
    requireSessionPrincipal(principal)
    return this.db.transaction().execute(async (trx) => {
      const policy = await this.workspacePolicyUsing(trx, principal, workspaceId, true)
      if (!policy.canInviteMembers) throw new ApiError(403, 'forbidden', 'Workspace administration denied')
      return trx
        .selectFrom('invitations')
        .select(['id', 'email', 'role', 'expires_at as expiresAt', 'accepted_at as acceptedAt', 'revoked_at as revokedAt', 'created_at as createdAt'])
        .where('workspace_id', '=', workspaceId)
        .orderBy('created_at', 'desc')
        .execute() as Promise<InvitationSummary[]>
    })
  }

  async createInvitation(principal: AuthenticatedPrincipal, workspaceId: string, emailInput: string, role: WorkspaceRole, context: RequestContext): Promise<InvitationView & { token: string }> {
    requireSessionPrincipal(principal)
    const email = normalizeEmail(emailInput)
    const token = generateOpaqueToken('rki_')
    const invitation: InvitationView = { id: randomUUID(), workspaceId, email, role, expiresAt: new Date(context.now.getTime() + INVITATION_TTL_MS) }
    await this.db.transaction().execute(async (trx) => {
      const initialPolicy = await this.workspacePolicyUsing(trx, principal, workspaceId, false)
      if (!initialPolicy.canInviteMembers || (role === 'owner' && !initialPolicy.canManageOwners) || (role === 'administrator' && !initialPolicy.canManageAdministrators)) throw new ApiError(403, 'forbidden', 'Role invitation denied')
      await trx.selectFrom('workspaces').select('id').where('id', '=', workspaceId).forUpdate().executeTakeFirstOrThrow()
      const policy = await this.workspacePolicyUsing(trx, principal, workspaceId, true)
      if (!policy.canInviteMembers || (role === 'owner' && !policy.canManageOwners) || (role === 'administrator' && !policy.canManageAdministrators)) throw new ApiError(403, 'forbidden', 'Role invitation denied')
      const replacedInvitations = await trx.selectFrom('invitations').select('id').where('workspace_id', '=', workspaceId).where('email', '=', email).where('accepted_at', 'is', null).where('revoked_at', 'is', null).forUpdate().execute()
      if (replacedInvitations.length > 0) {
        await trx.updateTable('invitations').set({ revoked_at: context.now }).where('workspace_id', '=', workspaceId).where('email', '=', email).where('accepted_at', 'is', null).where('revoked_at', 'is', null).execute()
        for (const replaced of replacedInvitations) {
          await writeAudit(trx, { workspaceId, actorType: 'user', actorUserId: principal.userId, action: 'invitation.revoke', targetType: 'invitation', targetId: replaced.id, requestId: context.requestId, now: context.now })
        }
      }
      await trx.insertInto('invitations').values({ id: invitation.id, workspace_id: workspaceId, email, role, token_digest: token.digest, created_by_user_id: principal.userId, expires_at: invitation.expiresAt, accepted_at: null, revoked_at: null, created_at: context.now }).executeTakeFirstOrThrow()
      await writeAudit(trx, { workspaceId, actorType: 'user', actorUserId: principal.userId, action: 'invitation.create', targetType: 'invitation', targetId: invitation.id, requestId: context.requestId, details: { role }, now: context.now })
    })
    return { ...invitation, token: token.raw }
  }

  async previewInvitation(rawToken: string, now: Date): Promise<InvitationPreview> {
    const invite = await this.db.selectFrom('invitations as i').innerJoin('workspaces as w', 'w.id', 'i.workspace_id').select(['i.workspace_id', 'w.name as workspace_name', 'i.email', 'i.role', 'i.expires_at', 'i.accepted_at', 'i.revoked_at']).where('i.token_digest', '=', digestSecret(rawToken)).executeTakeFirst()
    if (!invite || invite.accepted_at || !activeAt(invite.expires_at, invite.revoked_at, now)) throw new ApiError(404, 'not_found', 'Invitation is not available')
    return { workspaceId: invite.workspace_id, workspaceName: invite.workspace_name, maskedEmail: maskEmail(invite.email), role: invite.role, expiresAt: invite.expires_at }
  }

  async acceptInvitation(rawToken: string, password: string | undefined, principal: AuthenticatedPrincipal | undefined, context: RequestContext): Promise<{ workspaceId: string; userId: string }> {
    if (principal) requireSessionPrincipal(principal)
    return this.db.transaction().execute(async (trx) => {
      const candidate = await trx.selectFrom('invitations').select(['id', 'workspace_id']).where('token_digest', '=', digestSecret(rawToken)).executeTakeFirst()
      if (!candidate) throw new ApiError(404, 'not_found', 'Invitation is not available')
      await trx.selectFrom('workspaces').select('id').where('id', '=', candidate.workspace_id).forUpdate().executeTakeFirstOrThrow()
      const invite = await trx.selectFrom('invitations').selectAll().where('id', '=', candidate.id).where('token_digest', '=', digestSecret(rawToken)).forUpdate().executeTakeFirst()
      if (!invite || invite.accepted_at || !activeAt(invite.expires_at, invite.revoked_at, context.now)) throw new ApiError(404, 'not_found', 'Invitation is not available')
      const user = await trx.selectFrom('users').selectAll().where('email', '=', invite.email).forUpdate().executeTakeFirst()
      let userId: string
      if (user) {
        if (!principal || principal.userId !== user.id || !user.enabled) throw new ApiError(401, 'unauthenticated', 'Sign in as the invited email to accept')
        userId = user.id
      } else {
        if (!password) throw new ApiError(400, 'bad_request', 'A password is required for a new user')
        userId = randomUUID()
        const passwordHash = await this.passwords.hash(password)
        await trx.insertInto('users').values({ id: userId, email: invite.email, password_hash: passwordHash, enabled: true, created_at: context.now, updated_at: context.now }).executeTakeFirstOrThrow()
      }
      const membership = await trx.selectFrom('workspace_members').selectAll().where('workspace_id', '=', invite.workspace_id).where('user_id', '=', userId).forUpdate().executeTakeFirst()
      if (membership?.active) throw new ApiError(409, 'conflict', 'User is already an active workspace member')
      if (membership) await trx.updateTable('workspace_members').set({ active: true, role: invite.role, updated_at: context.now }).where('id', '=', membership.id).executeTakeFirstOrThrow()
      else await trx.insertInto('workspace_members').values({ id: randomUUID(), workspace_id: invite.workspace_id, user_id: userId, role: invite.role, active: true, created_by_user_id: invite.created_by_user_id, created_at: context.now, updated_at: context.now }).executeTakeFirstOrThrow()
      await trx.updateTable('invitations').set({ accepted_at: context.now }).where('id', '=', invite.id).executeTakeFirstOrThrow()
      await writeAudit(trx, { workspaceId: invite.workspace_id, actorType: 'user', actorUserId: userId, action: 'invitation.accept', targetType: 'invitation', targetId: invite.id, requestId: context.requestId, details: { role: invite.role }, now: context.now })
      return { workspaceId: invite.workspace_id, userId }
    })
  }

  async revokeInvitation(principal: AuthenticatedPrincipal, workspaceId: string, invitationId: string, context: RequestContext): Promise<void> {
    requireSessionPrincipal(principal)
    await this.db.transaction().execute(async (trx) => {
      const initialPolicy = await this.workspacePolicyUsing(trx, principal, workspaceId, false)
      if (!initialPolicy.canInviteMembers) throw new ApiError(403, 'forbidden', 'Workspace administration denied')
      await trx.selectFrom('workspaces').select('id').where('id', '=', workspaceId).forUpdate().executeTakeFirstOrThrow()
      const invitation = await trx
        .selectFrom('invitations')
        .select(['id', 'accepted_at', 'revoked_at'])
        .where('id', '=', invitationId)
        .where('workspace_id', '=', workspaceId)
        .forUpdate()
        .executeTakeFirst()
      if (!invitation || invitation.accepted_at || invitation.revoked_at) throw new ApiError(404, 'not_found', 'Invitation not found')
      const policy = await this.workspacePolicyUsing(trx, principal, workspaceId, true)
      if (!policy.canInviteMembers) throw new ApiError(403, 'forbidden', 'Workspace administration denied')
      const result = await trx.updateTable('invitations').set({ revoked_at: context.now }).where('id', '=', invitationId).where('workspace_id', '=', workspaceId).where('accepted_at', 'is', null).where('revoked_at', 'is', null).executeTakeFirst()
      if (Number(result.numUpdatedRows) !== 1) throw new ApiError(404, 'not_found', 'Invitation not found')
      await writeAudit(trx, { workspaceId, actorType: 'user', actorUserId: principal.userId, action: 'invitation.revoke', targetType: 'invitation', targetId: invitationId, requestId: context.requestId, now: context.now })
    })
  }

  async changeMemberRole(principal: AuthenticatedPrincipal, workspaceId: string, targetUserId: string, role: WorkspaceRole, context: RequestContext): Promise<void> {
    await this.mutateMember(principal, workspaceId, targetUserId, role, true, context)
  }

  async removeMember(principal: AuthenticatedPrincipal, workspaceId: string, targetUserId: string, context: RequestContext): Promise<void> {
    await this.mutateMember(principal, workspaceId, targetUserId, null, false, context)
  }

  private async mutateMember(principal: AuthenticatedPrincipal, workspaceId: string, targetUserId: string, nextRole: WorkspaceRole | null, nextActive: boolean, context: RequestContext): Promise<void> {
    requireSessionPrincipal(principal)
    await this.db.transaction().execute(async (trx) => {
      const members = await trx.selectFrom('workspace_members').selectAll().where('workspace_id', '=', workspaceId).where('active', '=', 1).forUpdate().execute()
      const actor = members.find((member) => member.user_id === principal.userId)
      if (!actor) throw new ApiError(403, 'forbidden', 'Active workspace membership required')
      const policy = resolveWorkspacePolicy(workspaceId, principal.userId, actor.role)
      if (!policy.canManageMembers) throw new ApiError(403, 'forbidden', 'Workspace administration denied')
      const target = members.find((member) => member.user_id === targetUserId)
      if (!target) throw new ApiError(404, 'not_found', 'Workspace member not found')
      if ((target.role === 'owner' || nextRole === 'owner') && !policy.canManageOwners) throw new ApiError(403, 'forbidden', 'Owner management denied')
      if ((target.role === 'administrator' || nextRole === 'administrator') && !policy.canManageAdministrators) throw new ApiError(403, 'forbidden', 'Administrator management denied')
      const ownerCount = members.filter((member) => member.role === 'owner').length
      if (target.role === 'owner' && ownerCount === 1 && (!nextActive || nextRole !== 'owner')) throw new ApiError(409, 'conflict', 'The final owner cannot be removed or demoted')
      const changes = nextRole ? { role: nextRole, active: nextActive, updated_at: context.now } : { active: nextActive, updated_at: context.now }
      await trx.updateTable('workspace_members').set(changes).where('id', '=', target.id).executeTakeFirstOrThrow()
      await writeAudit(trx, { workspaceId, actorType: 'user', actorUserId: principal.userId, action: nextActive ? 'membership.role_change' : 'membership.remove', targetType: 'user', targetId: targetUserId, requestId: context.requestId, details: nextRole ? { role: nextRole } : {}, now: context.now })
    })
  }

  async createCredential(principal: AuthenticatedPrincipal, workspaceId: string, nameInput: string, scopesInput: readonly string[], expiresAt: Date | null, context: RequestContext): Promise<CreatedCredential> {
    requireSessionPrincipal(principal)
    const name = nameInput.trim()
    if (!name || name.length > 160) throw new ApiError(400, 'bad_request', 'Credential name is required')
    if (expiresAt && expiresAt.getTime() <= context.now.getTime()) throw new ApiError(400, 'bad_request', 'Credential expiry must be in the future')
    const scopes = normalizeScopes(scopesInput)
    if (!scopes.length) throw new ApiError(400, 'bad_request', 'At least one credential scope is required')
    const id = randomUUID()
    const token = generateOpaqueToken(`rkc_${id}.`)
    const aad = credentialAad(id, workspaceId, principal.userId, 1, this.config.credentialKeyVersion)
    const envelope = encryptCredential(token.raw, this.config.credentialEncryptionKey, this.config.credentialKeyVersion, aad)
    await this.db.transaction().execute(async (trx) => {
      await this.workspacePolicyUsing(trx, principal, workspaceId, true)
      await trx.insertInto('api_credentials').values({ id, workspace_id: workspaceId, user_id: principal.userId, name, scopes: JSON.stringify(scopes), secret_digest: token.digest, ciphertext: envelope.ciphertext, iv: envelope.iv, auth_tag: envelope.tag, key_version: envelope.keyVersion, secret_version: 1, expires_at: expiresAt, revoked_at: null, last_used_at: null, created_at: context.now, updated_at: context.now }).executeTakeFirstOrThrow()
      await writeAudit(trx, { workspaceId, actorType: 'user', actorUserId: principal.userId, action: 'credential.create', targetType: 'credential', targetId: id, requestId: context.requestId, details: { scopes, expiresAt: expiresAt?.toISOString() ?? null }, now: context.now })
    })
    return { id, workspaceId, name, scopes, expiresAt, revokedAt: null, lastUsedAt: null, createdAt: context.now, secret: token.raw }
  }

  async listCredentials(principal: AuthenticatedPrincipal, workspaceId: string): Promise<CredentialView[]> {
    requireSessionPrincipal(principal)
    return this.db.transaction().execute(async (trx) => {
      await this.workspacePolicyUsing(trx, principal, workspaceId, true)
      const rows = await trx.selectFrom('api_credentials').select(['id', 'workspace_id', 'name', 'scopes', 'expires_at', 'revoked_at', 'last_used_at', 'created_at']).where('workspace_id', '=', workspaceId).where('user_id', '=', principal.userId).orderBy('created_at', 'desc').execute()
      return rows.map(credentialView)
    })
  }

  async revealCredential(principal: AuthenticatedPrincipal, workspaceId: string, credentialId: string, context: RequestContext): Promise<string> {
    requireSessionPrincipal(principal)
    return this.db.transaction().execute(async (trx) => {
      const row = await this.ownedCredential(trx, principal, workspaceId, credentialId, context.now, true)
      if (row.key_version !== this.config.credentialKeyVersion) throw new ApiError(503, 'service_unavailable', 'Credential key version is unavailable')
      const aad = credentialAad(row.id, row.workspace_id, row.user_id, row.secret_version, row.key_version)
      let secret: string
      try {
        secret = decryptCredential({ ciphertext: row.ciphertext, iv: row.iv, tag: row.auth_tag, keyVersion: row.key_version }, this.config.credentialEncryptionKey, aad)
      } catch {
        throw new ApiError(503, 'service_unavailable', 'Credential cannot be decrypted with the configured key')
      }
      if (!row.secret_digest.equals(digestSecret(secret))) {
        throw new ApiError(503, 'service_unavailable', 'Credential integrity verification failed')
      }
      await writeAudit(trx, { workspaceId: row.workspace_id, actorType: 'user', actorUserId: principal.userId, action: 'credential.reveal', targetType: 'credential', targetId: row.id, requestId: context.requestId, now: context.now })
      return secret
    })
  }

  async rotateCredential(principal: AuthenticatedPrincipal, workspaceId: string, credentialId: string, context: RequestContext): Promise<string> {
    requireSessionPrincipal(principal)
    return this.db.transaction().execute(async (trx) => {
      const row = await this.ownedCredential(trx, principal, workspaceId, credentialId, context.now, true)
      if (row.key_version !== this.config.credentialKeyVersion) throw new ApiError(503, 'service_unavailable', 'Credential key version is unavailable')
      const secretVersion = row.secret_version + 1
      const token = generateOpaqueToken(`rkc_${row.id}.`)
      const aad = credentialAad(row.id, row.workspace_id, row.user_id, secretVersion, this.config.credentialKeyVersion)
      const envelope = encryptCredential(token.raw, this.config.credentialEncryptionKey, this.config.credentialKeyVersion, aad)
      await trx.updateTable('api_credentials').set({ secret_digest: token.digest, ciphertext: envelope.ciphertext, iv: envelope.iv, auth_tag: envelope.tag, key_version: envelope.keyVersion, secret_version: secretVersion, updated_at: context.now }).where('id', '=', row.id).executeTakeFirstOrThrow()
      await writeAudit(trx, { workspaceId: row.workspace_id, actorType: 'user', actorUserId: principal.userId, action: 'credential.rotate', targetType: 'credential', targetId: row.id, requestId: context.requestId, details: { secretVersion }, now: context.now })
      return token.raw
    })
  }

  async revokeCredential(principal: AuthenticatedPrincipal, workspaceId: string, credentialId: string, context: RequestContext): Promise<void> {
    requireSessionPrincipal(principal)
    await this.db.transaction().execute(async (trx) => {
      const row = await this.ownedCredential(trx, principal, workspaceId, credentialId, context.now, true)
      await trx.updateTable('api_credentials').set({ revoked_at: context.now, updated_at: context.now }).where('id', '=', row.id).executeTakeFirstOrThrow()
      await writeAudit(trx, { workspaceId: row.workspace_id, actorType: 'user', actorUserId: principal.userId, action: 'credential.revoke', targetType: 'credential', targetId: row.id, requestId: context.requestId, now: context.now })
    })
  }

  async authenticateCredential(rawToken: string, requiredScope: CredentialScope, context: RequestContext): Promise<AuthenticatedPrincipal> {
    let rejected: { workspaceId: string | null; userId: string | null; credentialId: string | null } | undefined
    try {
      return await this.db.transaction().execute(async (trx) => {
        const row = await trx
          .selectFrom('api_credentials')
          .select(['id', 'workspace_id', 'user_id', 'scopes', 'expires_at', 'revoked_at'])
          .where('secret_digest', '=', digestSecret(rawToken))
          .forUpdate()
          .executeTakeFirst()
        rejected = {
          workspaceId: row?.workspace_id ?? null,
          userId: row?.user_id ?? null,
          credentialId: row?.id ?? null,
        }
        if (!row || !activeAt(row.expires_at, row.revoked_at, context.now)) {
          throw new ApiError(401, 'unauthenticated', 'Credential is invalid or insufficiently scoped')
        }
        const user = await trx.selectFrom('users').select('enabled').where('id', '=', row.user_id).forUpdate().executeTakeFirst()
        const membership = await trx
          .selectFrom('workspace_members')
          .select('active')
          .where('workspace_id', '=', row.workspace_id)
          .where('user_id', '=', row.user_id)
          .forUpdate()
          .executeTakeFirst()
        let scopes: CredentialScope[] = []
        try { scopes = parseCredentialScopes(row.scopes) } catch { /* Invalid stored scopes fail closed. */ }
        if (!user?.enabled || !membership?.active || !scopes.includes(requiredScope)) {
          throw new ApiError(401, 'unauthenticated', 'Credential is invalid or insufficiently scoped')
        }
        await trx.updateTable('api_credentials').set({ last_used_at: context.now }).where('id', '=', row.id).executeTakeFirstOrThrow()
        await writeAudit(trx, { workspaceId: row.workspace_id, actorType: 'credential', actorUserId: row.user_id, action: 'credential.authenticate', targetType: 'credential', targetId: row.id, requestId: context.requestId, details: { requiredScope }, now: context.now })
        return { kind: 'credential', userId: row.user_id, workspaceId: row.workspace_id, credentialId: row.id, scopes }
      })
    } catch (error) {
      if (error instanceof ApiError && error.code === 'unauthenticated' && rejected) {
        await this.bestEffortAudit({ workspaceId: rejected.workspaceId, actorType: 'credential', actorUserId: rejected.userId, action: 'credential.authentication_rejected', targetType: 'credential', targetId: rejected.credentialId, requestId: context.requestId, details: { requiredScope }, now: context.now })
      }
      throw error
    }
  }

  private async ownedCredential(trx: SecurityTransaction, principal: AuthenticatedPrincipal, workspaceId: string, credentialId: string, now: Date, lock: boolean) {
    let query = trx.selectFrom('api_credentials').selectAll().where('id', '=', credentialId).where('workspace_id', '=', workspaceId).where('user_id', '=', principal.userId)
    if (lock) query = query.forUpdate()
    const row = await query.executeTakeFirst()
    if (!row || !activeAt(row.expires_at, row.revoked_at, now)) throw new ApiError(404, 'not_found', 'Active credential not found')
    const membership = await trx.selectFrom('workspace_members').select('id').where('workspace_id', '=', row.workspace_id).where('user_id', '=', principal.userId).where('active', '=', 1).forUpdate().executeTakeFirst()
    if (!membership) throw new ApiError(403, 'forbidden', 'Active workspace membership required')
    return row
  }

  private async bestEffortAudit(input: Parameters<typeof writeAudit>[1]): Promise<void> {
    try { await writeAudit(this.db, input) } catch { /* Audit rejection must not expose or replace the authentication failure. */ }
  }
}
