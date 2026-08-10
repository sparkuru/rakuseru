import { randomUUID } from 'node:crypto'
import { sql } from 'kysely'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ApiConfig } from '../src/config/config.js'
import { createDatabase, databaseReady, runMigrations, type DatabaseHandle } from '../src/db/database.js'
import { SecurityService } from '../src/modules/security/security-service.js'
import { Argon2PasswordHasher } from '../src/security/crypto.js'

const integrationEnabled = process.env.DB_TEST_HOST !== undefined
const suite = describe.runIf(integrationEnabled)

function testConfig(): ApiConfig {
  return {
    environment: 'test',
    host: '127.0.0.1',
    port: 3000,
    publicOrigin: 'https://integration.example.test',
    database: {
      host: process.env.DB_TEST_HOST ?? 'mariadb',
      port: Number(process.env.DB_TEST_PORT ?? '3306'),
      name: process.env.DB_TEST_NAME ?? 'rakuseru_test',
      user: process.env.DB_TEST_USER ?? 'rakuseru_test',
      password: process.env.DB_TEST_PASSWORD ?? '',
      connectionLimit: 4,
    },
    session: { cookieName: 'rakuseru_session', ttlSeconds: 3600, secure: false },
    credentialEncryptionKey: Buffer.alloc(32, 29),
    credentialKeyVersion: 1,
  }
}

function context(principal?: Awaited<ReturnType<SecurityService['authenticateSession']>>['principal']) {
  return { requestId: randomUUID(), now: new Date(), ...(principal ? { principal } : {}) }
}

suite('MariaDB security integration', () => {
  let database: DatabaseHandle
  let service: SecurityService
  let ownerUserId: string
  let workspaceId: string
  let ownerPrincipal: Awaited<ReturnType<SecurityService['authenticateSession']>>['principal']
  let ownerSessionToken: string
  let ownerCsrfToken: string
  let memberUserId: string
  let existingUserId: string
  let memberPrincipal: Awaited<ReturnType<SecurityService['authenticateSession']>>['principal']
  let rawCredential: string
  let credentialId: string

  beforeAll(async () => {
    database = createDatabase(testConfig())
    await runMigrations(database.db)
    await runMigrations(database.db)
    service = new SecurityService(database.db, new Argon2PasswordHasher(), testConfig())
  }, 30_000)

  afterAll(async () => {
    await database?.destroy()
  })

  it('migrates zero-to-head and a repeated migration is a no-op', async () => {
    await expect(databaseReady(database.db)).resolves.toBe(true)
    const rows = await database.db.selectFrom('kysely_migration').selectAll().execute()
    expect(rows).toHaveLength(1)
  })

  it('bootstraps once, is idempotent, rejects conflicting settings, and audits once', async () => {
    await expect(service.bootstrap('OWNER@EXAMPLE.TEST', 'owner integration password', 'Integration Workspace', randomUUID())).resolves.toBe('created')
    await database.db.updateTable('instance_state').set({ initialized: false }).where('id', '=', 1).execute()
    await expect(service.bootstrap('owner@example.test', 'owner integration password', 'Integration Workspace', randomUUID())).rejects.toMatchObject({ status: 409 })
    await database.db.updateTable('instance_state').set({ initialized: true }).where('id', '=', 1).execute()
    await expect(service.bootstrap('owner@example.test', 'owner integration password', 'Integration Workspace', randomUUID())).resolves.toBe('already_initialized')
    await expect(service.bootstrap('other@example.test', 'another integration password', 'Other Workspace', randomUUID())).rejects.toMatchObject({ status: 409 })

    const owner = await database.db.selectFrom('users').select('id').where('email', '=', 'owner@example.test').executeTakeFirstOrThrow()
    const workspace = await database.db.selectFrom('workspaces').select('id').executeTakeFirstOrThrow()
    ownerUserId = owner.id
    workspaceId = workspace.id
    const bootstrapAudits = await database.db.selectFrom('audit_events').select('id').where('action', '=', 'instance.bootstrap').execute()
    expect(bootstrapAudits).toHaveLength(1)
  }, 30_000)

  it('enforces session expiry, revocation, disabled users, and sign-out audit', async () => {
    const issued = await service.signIn('owner@example.test', 'owner integration password', context())
    ownerSessionToken = issued.sessionToken
    ownerCsrfToken = issued.csrfToken
    ownerPrincipal = (await service.authenticateSession(issued.sessionToken, new Date())).principal

    await database.db.updateTable('users').set({ enabled: false }).where('id', '=', ownerUserId).execute()
    await expect(service.authenticateSession(issued.sessionToken, new Date())).rejects.toMatchObject({ status: 401 })
    await database.db.updateTable('users').set({ enabled: true }).where('id', '=', ownerUserId).execute()

    await database.db.updateTable('sessions').set({ expires_at: new Date(0) }).where('id', '=', ownerPrincipal.sessionId as string).execute()
    await expect(service.authenticateSession(issued.sessionToken, new Date())).rejects.toMatchObject({ status: 401 })
    await database.db.updateTable('sessions').set({ expires_at: new Date(Date.now() + 60_000) }).where('id', '=', ownerPrincipal.sessionId as string).execute()

    await service.signOut(ownerPrincipal, context(ownerPrincipal))
    await expect(service.authenticateSession(issued.sessionToken, new Date())).rejects.toMatchObject({ status: 401 })
    const replacement = await service.signIn('owner@example.test', 'owner integration password', context())
    ownerSessionToken = replacement.sessionToken
    ownerCsrfToken = replacement.csrfToken
    ownerPrincipal = (await service.authenticateSession(replacement.sessionToken, new Date())).principal
  }, 30_000)

  it('enforces invitation expiry, single use, and existing-user acceptance', async () => {
    const newInvite = await service.createInvitation(ownerPrincipal, workspaceId, 'member@example.test', 'member', context(ownerPrincipal))
    const accepted = await service.acceptInvitation(newInvite.token, 'member integration password', undefined, context())
    memberUserId = accepted.userId
    await expect(service.acceptInvitation(newInvite.token, 'member integration password', undefined, context())).rejects.toMatchObject({ status: 404 })

    const expired = await service.createInvitation(ownerPrincipal, workspaceId, 'expired@example.test', 'member', context(ownerPrincipal))
    await database.db.updateTable('invitations').set({ expires_at: new Date(0) }).where('id', '=', expired.id).execute()
    await expect(service.acceptInvitation(expired.token, 'expired integration password', undefined, context())).rejects.toMatchObject({ status: 404 })

    const revoked = await service.createInvitation(ownerPrincipal, workspaceId, 'revoked@example.test', 'member', context(ownerPrincipal))
    await service.revokeInvitation(ownerPrincipal, workspaceId, revoked.id, context(ownerPrincipal))
    await expect(service.acceptInvitation(revoked.token, 'revoked integration password', undefined, context())).rejects.toMatchObject({ status: 404 })
    const revokeAudits = await database.db.selectFrom('audit_events').select('id').where('action', '=', 'invitation.revoke').where('target_id', '=', revoked.id).execute()
    expect(revokeAudits).toHaveLength(1)

    const replaced = await service.createInvitation(ownerPrincipal, workspaceId, 'replacement@example.test', 'member', context(ownerPrincipal))
    await service.createInvitation(ownerPrincipal, workspaceId, 'replacement@example.test', 'member', context(ownerPrincipal))
    await expect(service.previewInvitation(replaced.token, new Date())).rejects.toMatchObject({ status: 404 })
    const replacementAudits = await database.db.selectFrom('audit_events').select('id').where('action', '=', 'invitation.revoke').where('target_id', '=', replaced.id).execute()
    expect(replacementAudits).toHaveLength(1)

    const hasher = new Argon2PasswordHasher()
    existingUserId = randomUUID()
    const now = new Date()
    await database.db.insertInto('users').values({ id: existingUserId, email: 'existing@example.test', password_hash: await hasher.hash('existing integration password'), enabled: true, created_at: now, updated_at: now }).execute()
    const existingInvite = await service.createInvitation(ownerPrincipal, workspaceId, 'existing@example.test', 'member', context(ownerPrincipal))
    await expect(service.acceptInvitation(existingInvite.token, undefined, undefined, context())).rejects.toMatchObject({ status: 401 })
    const existingSession = await service.signIn('existing@example.test', 'existing integration password', context())
    const existingPrincipal = (await service.authenticateSession(existingSession.sessionToken, new Date())).principal
    await expect(service.acceptInvitation(existingInvite.token, undefined, existingPrincipal, context(existingPrincipal))).resolves.toMatchObject({ userId: existingUserId, workspaceId })
  }, 30_000)

  it('enforces workspace isolation, administrator boundaries, and final-owner protection', async () => {
    const memberSession = await service.signIn('member@example.test', 'member integration password', context())
    memberPrincipal = (await service.authenticateSession(memberSession.sessionToken, new Date())).principal
    await expect(service.workspacePolicy(memberPrincipal, randomUUID())).rejects.toMatchObject({ status: 403 })
    await service.changeMemberRole(ownerPrincipal, workspaceId, memberUserId, 'administrator', context(ownerPrincipal))
    const administratorPolicy = await service.workspacePolicy(memberPrincipal, workspaceId)
    expect(administratorPolicy).toMatchObject({ canManageMembers: true, canManageOwners: false, canManageAdministrators: false, implicitResourcePermission: 'none' })
    await expect(service.createInvitation(memberPrincipal, workspaceId, 'admin-target@example.test', 'administrator', context(memberPrincipal))).rejects.toMatchObject({ status: 403 })
    await expect(service.removeMember(ownerPrincipal, workspaceId, ownerUserId, context(ownerPrincipal))).rejects.toMatchObject({ status: 409 })
    const removeAudits = await database.db.selectFrom('audit_events').select('id').where('action', '=', 'membership.remove').where('target_id', '=', ownerUserId).execute()
    expect(removeAudits).toHaveLength(0)
    await service.removeMember(ownerPrincipal, workspaceId, existingUserId, context(ownerPrincipal))
    const successfulRemoveAudits = await database.db.selectFrom('audit_events').select('id').where('action', '=', 'membership.remove').where('target_id', '=', existingUserId).execute()
    expect(successfulRemoveAudits).toHaveLength(1)
  })

  it('serializes concurrent final-owner removals and preserves one active owner', async () => {
    const raceWorkspaceId = randomUUID()
    const now = new Date()
    await database.db.insertInto('workspaces').values({ id: raceWorkspaceId, name: 'Owner race', created_at: now, updated_at: now }).execute()
    await database.db.insertInto('workspace_members').values([
      { id: randomUUID(), workspace_id: raceWorkspaceId, user_id: ownerUserId, role: 'owner', active: true, created_by_user_id: ownerUserId, created_at: now, updated_at: now },
      { id: randomUUID(), workspace_id: raceWorkspaceId, user_id: memberUserId, role: 'owner', active: true, created_by_user_id: ownerUserId, created_at: now, updated_at: now },
    ]).execute()

    const results = await Promise.allSettled([
      service.removeMember(ownerPrincipal, raceWorkspaceId, memberUserId, context(ownerPrincipal)),
      service.removeMember(memberPrincipal, raceWorkspaceId, ownerUserId, context(memberPrincipal)),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    const activeOwners = await database.db.selectFrom('workspace_members').select('id').where('workspace_id', '=', raceWorkspaceId).where('active', '=', 1).where('role', '=', 'owner').execute()
    expect(activeOwners).toHaveLength(1)
  })

  it('rolls back a security mutation when its append-only audit write fails', async () => {
    await sql.raw("CREATE TRIGGER audit_events_force_failure BEFORE INSERT ON audit_events FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced audit failure'").execute(database.db)
    try {
      await expect(service.createInvitation(ownerPrincipal, workspaceId, 'rollback@example.test', 'member', context(ownerPrincipal))).rejects.toBeDefined()
    } finally {
      await sql.raw('DROP TRIGGER IF EXISTS audit_events_force_failure').execute(database.db)
    }
    const invitations = await database.db.selectFrom('invitations').select('id').where('workspace_id', '=', workspaceId).where('email', '=', 'rollback@example.test').execute()
    expect(invitations).toHaveLength(0)
  })

  it('binds credentials to user/workspace/scope and enforces tamper, rotation, expiry, and revocation', async () => {
    const created = await service.createCredential(ownerPrincipal, workspaceId, 'Integration credential', ['workspace:metadata:read'], null, context(ownerPrincipal))
    rawCredential = created.secret
    credentialId = created.id
    await expect(service.revealCredential(ownerPrincipal, workspaceId, credentialId, context(ownerPrincipal))).resolves.toBe(rawCredential)
    await expect(service.revealCredential(memberPrincipal, workspaceId, credentialId, context(memberPrincipal))).rejects.toMatchObject({ status: 404 })
    await expect(service.revealCredential(ownerPrincipal, randomUUID(), credentialId, context(ownerPrincipal))).rejects.toMatchObject({ status: 404 })

    const row = await database.db.selectFrom('api_credentials').select(['ciphertext', 'secret_digest']).where('id', '=', credentialId).executeTakeFirstOrThrow()
    const tampered = Buffer.from(row.ciphertext)
    tampered[0] ^= 1
    await database.db.updateTable('api_credentials').set({ ciphertext: tampered }).where('id', '=', credentialId).execute()
    await expect(service.revealCredential(ownerPrincipal, workspaceId, credentialId, context(ownerPrincipal))).rejects.toMatchObject({ status: 503 })
    await database.db.updateTable('api_credentials').set({ ciphertext: row.ciphertext }).where('id', '=', credentialId).execute()

    await database.db.updateTable('api_credentials').set({ secret_digest: Buffer.alloc(32, 91) }).where('id', '=', credentialId).execute()
    await expect(service.revealCredential(ownerPrincipal, workspaceId, credentialId, context(ownerPrincipal))).rejects.toMatchObject({ status: 503 })
    await database.db.updateTable('api_credentials').set({ secret_digest: row.secret_digest }).where('id', '=', credentialId).execute()

    const rotated = await service.rotateCredential(ownerPrincipal, workspaceId, credentialId, context(ownerPrincipal))
    await expect(service.authenticateCredential(rawCredential, 'workspace:metadata:read', context())).rejects.toMatchObject({ status: 401 })
    const credentialPrincipal = await service.authenticateCredential(rotated, 'workspace:metadata:read', context())
    expect(credentialPrincipal).toMatchObject({ workspaceId, credentialId })
    const otherWorkspaceId = randomUUID()
    const otherWorkspaceNow = new Date()
    await database.db.insertInto('workspaces').values({ id: otherWorkspaceId, name: 'Credential isolation', created_at: otherWorkspaceNow, updated_at: otherWorkspaceNow }).execute()
    await database.db.insertInto('workspace_members').values({ id: randomUUID(), workspace_id: otherWorkspaceId, user_id: ownerUserId, role: 'owner', active: true, created_by_user_id: ownerUserId, created_at: otherWorkspaceNow, updated_at: otherWorkspaceNow }).execute()
    await expect(service.workspacePolicy(credentialPrincipal, otherWorkspaceId)).rejects.toMatchObject({ status: 403 })
    await expect(service.listWorkspaces(credentialPrincipal)).rejects.toMatchObject({ status: 401 })
    rawCredential = rotated

    await database.db.updateTable('api_credentials').set({ scopes: '[]' }).where('id', '=', credentialId).execute()
    await expect(service.authenticateCredential(rotated, 'workspace:metadata:read', context())).rejects.toMatchObject({ status: 401 })
    await database.db.updateTable('api_credentials').set({ scopes: JSON.stringify(['workspace:metadata:read']) }).where('id', '=', credentialId).execute()

    await database.db.updateTable('api_credentials').set({ expires_at: new Date(0) }).where('id', '=', credentialId).execute()
    await expect(service.authenticateCredential(rotated, 'workspace:metadata:read', context())).rejects.toMatchObject({ status: 401 })
    await database.db.updateTable('api_credentials').set({ expires_at: null }).where('id', '=', credentialId).execute()
    await service.revokeCredential(ownerPrincipal, workspaceId, credentialId, context(ownerPrincipal))
    await expect(service.authenticateCredential(rotated, 'workspace:metadata:read', context())).rejects.toMatchObject({ status: 401 })
  })

  it('records request metadata without raw security values', async () => {
    const audits = await database.db.selectFrom('audit_events').selectAll().execute()
    expect(audits.length).toBeGreaterThan(10)
    expect(audits.every((event) => event.request_id.length === 36 && event.action.length > 0)).toBe(true)
    const snapshot = JSON.stringify(audits)
    expect(snapshot).not.toContain('owner integration password')
    expect(snapshot).not.toContain(ownerSessionToken)
    expect(snapshot).not.toContain(ownerCsrfToken)
    expect(snapshot).not.toContain(rawCredential)
  })
})

if (!integrationEnabled) {
  describe('MariaDB security integration', () => {
    it.skip('requires DB_TEST_HOST and an empty disposable database', () => undefined)
  })
}
