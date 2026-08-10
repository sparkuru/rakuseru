import { describe, expect, it } from 'vitest'
import type { Kysely } from 'kysely'
import { normalizeScopes, parseCredentialScopes, resolveWorkspacePolicy } from '../src/contracts.js'
import type { DatabaseSchema } from '../src/db/types.js'
import { writeAudit } from '../src/modules/audit/audit.js'
import { redact } from '../src/observability/logger.js'

describe('workspace policy', () => {
  it('keeps administrators from owner/admin management and implicit resources', () => {
    const owner = resolveWorkspacePolicy('w', 'owner', 'owner')
    const administrator = resolveWorkspacePolicy('w', 'admin', 'administrator')
    const member = resolveWorkspacePolicy('w', 'member', 'member')
    expect(owner.canManageOwners).toBe(true)
    expect(administrator).toMatchObject({ canInviteMembers: true, canManageAdministrators: false, canManageOwners: false, implicitResourcePermission: 'none' })
    expect(member).toMatchObject({ canInviteMembers: false, canManageMembers: false, implicitResourcePermission: 'none' })
  })

  it('normalizes only registered foundation scopes and defaults unknown values to deny', () => {
    expect(normalizeScopes(['workspace:metadata:read', 'workspace:metadata:read'])).toEqual(['workspace:metadata:read'])
    expect(parseCredentialScopes('["workspace:metadata:read"]')).toEqual(['workspace:metadata:read'])
    expect(parseCredentialScopes(['workspace:metadata:read'])).toEqual(['workspace:metadata:read'])
    expect(() => normalizeScopes(['sheets:read'])).toThrow('Unsupported credential scope')
  })
})

describe('secret redaction', () => {
  it('redacts sensitive keys and known raw-token patterns recursively', () => {
    const value = {
      headers: { authorization: 'Bearer sentinel-auth' },
      nested: [{ csrfToken: 'sentinel-csrf' }, { note: 'rkc_sentinel-secret' }],
      safe: 'visible',
    }
    const encoded = JSON.stringify(redact(value))
    expect(encoded).toContain('visible')
    expect(encoded).not.toContain('sentinel-auth')
    expect(encoded).not.toContain('sentinel-csrf')
    expect(encoded).not.toContain('sentinel-secret')
  })

  it('rejects action details that use an allowed key with an unsafe value shape', async () => {
    const unavailableDatabase = {} as Kysely<DatabaseSchema>
    await expect(writeAudit(unavailableDatabase, {
      workspaceId: null,
      actorType: 'system',
      actorUserId: null,
      action: 'instance.bootstrap',
      targetType: 'workspace',
      targetId: null,
      requestId: 'f4ff6bd4-5160-4e10-9b37-ed0d2a748141',
      details: { ownerUserId: { password: 'sentinel-password' } },
      now: new Date(),
    })).rejects.toThrow('Invalid audit details for instance.bootstrap')
  })
})
