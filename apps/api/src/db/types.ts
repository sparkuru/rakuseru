import type { ColumnType, Generated } from 'kysely'

export type DatabaseTimestamp = ColumnType<Date, Date | string, Date | string>
export type NullableTimestamp = ColumnType<Date | null, Date | string | null, Date | string | null>

export interface UsersTable {
  id: string
  email: string
  password_hash: string
  enabled: ColumnType<number, number | boolean, number | boolean>
  created_at: DatabaseTimestamp
  updated_at: DatabaseTimestamp
}

export interface InstanceStateTable {
  id: number
  initialized: ColumnType<number, number | boolean, number | boolean>
  owner_user_id: string | null
  workspace_id: string | null
  initialized_at: NullableTimestamp
}

export interface SessionsTable {
  id: string
  token_digest: Buffer
  csrf_digest: Buffer
  user_id: string
  issued_at: DatabaseTimestamp
  last_seen_at: DatabaseTimestamp
  expires_at: DatabaseTimestamp
  revoked_at: NullableTimestamp
  client_ip: string | null
  user_agent: string | null
}

export interface WorkspacesTable {
  id: string
  name: string
  created_at: DatabaseTimestamp
  updated_at: DatabaseTimestamp
}

export interface WorkspaceMembersTable {
  id: string
  workspace_id: string
  user_id: string
  role: 'owner' | 'administrator' | 'member'
  active: ColumnType<number, number | boolean, number | boolean>
  created_by_user_id: string | null
  created_at: DatabaseTimestamp
  updated_at: DatabaseTimestamp
}

export interface InvitationsTable {
  id: string
  workspace_id: string
  email: string
  role: 'owner' | 'administrator' | 'member'
  token_digest: Buffer
  created_by_user_id: string
  expires_at: DatabaseTimestamp
  accepted_at: NullableTimestamp
  revoked_at: NullableTimestamp
  created_at: DatabaseTimestamp
}

export interface ApiCredentialsTable {
  id: string
  workspace_id: string
  user_id: string
  name: string
  scopes: string
  secret_digest: Buffer
  ciphertext: Buffer
  iv: Buffer
  auth_tag: Buffer
  key_version: number
  secret_version: number
  expires_at: NullableTimestamp
  revoked_at: NullableTimestamp
  last_used_at: NullableTimestamp
  created_at: DatabaseTimestamp
  updated_at: DatabaseTimestamp
}

export interface AuditEventsTable {
  sequence_id: Generated<string>
  id: string
  workspace_id: string | null
  actor_type: 'system' | 'user' | 'credential'
  actor_user_id: string | null
  action: string
  target_type: string
  target_id: string | null
  request_id: string
  details: string
  created_at: DatabaseTimestamp
}

export interface DatabaseSchema {
  instance_state: InstanceStateTable
  users: UsersTable
  sessions: SessionsTable
  workspaces: WorkspacesTable
  workspace_members: WorkspaceMembersTable
  invitations: InvitationsTable
  api_credentials: ApiCredentialsTable
  audit_events: AuditEventsTable
}
