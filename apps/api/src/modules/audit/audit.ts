import { randomUUID } from 'node:crypto'
import type { Kysely, Transaction } from 'kysely'
import { CREDENTIAL_SCOPES, WORKSPACE_ROLES } from '../../contracts.js'
import type { DatabaseSchema } from '../../db/types.js'
import { redact } from '../../observability/logger.js'

export type AuditActorType = 'system' | 'user' | 'credential'

export const AUDIT_ACTIONS = [
  'instance.bootstrap',
  'auth.sign_in',
  'auth.sign_in_rejected',
  'auth.sign_out',
  'invitation.create',
  'invitation.accept',
  'invitation.revoke',
  'membership.role_change',
  'membership.remove',
  'credential.create',
  'credential.reveal',
  'credential.rotate',
  'credential.revoke',
  'credential.authenticate',
  'credential.authentication_rejected',
] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function hasExactKeys(details: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(details).sort()
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index])
}

function isIsoTimestampOrNull(value: unknown): boolean {
  return value === null || (
    typeof value === 'string' &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  )
}

function validateDetails(action: AuditAction, details: Record<string, unknown>): void {
  let valid = false
  switch (action) {
    case 'instance.bootstrap':
      valid = hasExactKeys(details, ['ownerUserId']) && typeof details.ownerUserId === 'string' && UUID_PATTERN.test(details.ownerUserId)
      break
    case 'invitation.create':
    case 'invitation.accept':
    case 'membership.role_change':
      valid = hasExactKeys(details, ['role']) && typeof details.role === 'string' && WORKSPACE_ROLES.includes(details.role as (typeof WORKSPACE_ROLES)[number])
      break
    case 'credential.create':
      valid = hasExactKeys(details, ['expiresAt', 'scopes']) &&
        Array.isArray(details.scopes) &&
        details.scopes.length > 0 &&
        details.scopes.every((scope) => typeof scope === 'string' && CREDENTIAL_SCOPES.includes(scope as (typeof CREDENTIAL_SCOPES)[number])) &&
        new Set(details.scopes).size === details.scopes.length &&
        isIsoTimestampOrNull(details.expiresAt)
      break
    case 'credential.rotate':
      valid = hasExactKeys(details, ['secretVersion']) && Number.isSafeInteger(details.secretVersion) && Number(details.secretVersion) > 0
      break
    case 'credential.authenticate':
    case 'credential.authentication_rejected':
      valid = hasExactKeys(details, ['requiredScope']) && typeof details.requiredScope === 'string' && CREDENTIAL_SCOPES.includes(details.requiredScope as (typeof CREDENTIAL_SCOPES)[number])
      break
    case 'auth.sign_in':
    case 'auth.sign_in_rejected':
    case 'auth.sign_out':
    case 'invitation.revoke':
    case 'membership.remove':
    case 'credential.reveal':
    case 'credential.revoke':
      valid = hasExactKeys(details, [])
      break
  }
  if (!valid) throw new Error(`Invalid audit details for ${action}`)
}

export interface AuditInput {
  readonly workspaceId: string | null
  readonly actorType: AuditActorType
  readonly actorUserId: string | null
  readonly action: AuditAction
  readonly targetType: string
  readonly targetId: string | null
  readonly requestId: string
  readonly details?: Record<string, unknown>
  readonly now: Date
}

export type AuditDatabase = Kysely<DatabaseSchema> | Transaction<DatabaseSchema>

export async function writeAudit(db: AuditDatabase, input: AuditInput): Promise<void> {
  const rawDetails = input.details ?? {}
  validateDetails(input.action, rawDetails)
  const details = JSON.stringify(redact(rawDetails))
  if (Buffer.byteLength(details, 'utf8') > 8_192) throw new Error('Audit details exceed 8192 bytes')
  await db
    .insertInto('audit_events')
    .values({
      id: randomUUID(),
      workspace_id: input.workspaceId,
      actor_type: input.actorType,
      actor_user_id: input.actorUserId,
      action: input.action,
      target_type: input.targetType,
      target_id: input.targetId,
      request_id: input.requestId,
      details,
      created_at: input.now,
    })
    .executeTakeFirstOrThrow()
}
