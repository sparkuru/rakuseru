export const WORKSPACE_ROLES = ['owner', 'administrator', 'member'] as const
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number]

export const CREDENTIAL_SCOPES = [
  'workspace:metadata:read',
] as const
export type CredentialScope = (typeof CREDENTIAL_SCOPES)[number]

export type AuthenticatedPrincipal =
  | {
      readonly kind: 'session'
      readonly userId: string
      readonly sessionId: string
    }
  | {
      readonly kind: 'credential'
      readonly userId: string
      readonly credentialId: string
      readonly workspaceId: string
      readonly scopes: readonly CredentialScope[]
    }

export interface WorkspacePolicy {
  readonly workspaceId: string
  readonly userId: string
  readonly role: WorkspaceRole
  readonly canInviteMembers: boolean
  readonly canManageMembers: boolean
  readonly canManageAdministrators: boolean
  readonly canManageOwners: boolean
  readonly implicitResourcePermission: 'none'
}

export interface RequestContext {
  readonly requestId: string
  readonly now: Date
  readonly principal?: AuthenticatedPrincipal
}

export function isWorkspaceRole(value: string): value is WorkspaceRole {
  return WORKSPACE_ROLES.some((role) => role === value)
}

export function normalizeScopes(values: readonly string[]): CredentialScope[] {
  const allowed = new Set<string>(CREDENTIAL_SCOPES)
  const normalized = [...new Set(values)]
  if (normalized.some((scope) => !allowed.has(scope))) {
    throw new Error('Unsupported credential scope')
  }
  return normalized.sort() as CredentialScope[]
}

export function parseCredentialScopes(input: unknown): CredentialScope[] {
  const decoded: unknown = typeof input === 'string' ? JSON.parse(input) : input
  if (!Array.isArray(decoded) || decoded.some((scope) => typeof scope !== 'string')) {
    throw new Error('Credential scopes must be a string array')
  }
  return normalizeScopes(decoded)
}

export function resolveWorkspacePolicy(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
): WorkspacePolicy {
  return {
    workspaceId,
    userId,
    role,
    canInviteMembers: role !== 'member',
    canManageMembers: role !== 'member',
    canManageAdministrators: role === 'owner',
    canManageOwners: role === 'owner',
    implicitResourcePermission: 'none',
  }
}

export function requireCredentialScope(
  principal: AuthenticatedPrincipal,
  scope: CredentialScope,
): void {
  if (principal.kind !== 'credential' || !principal.scopes.includes(scope)) {
    throw new Error('Credential scope denied')
  }
}
