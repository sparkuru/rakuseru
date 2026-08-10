import { sql, type Kysely } from 'kysely'

const statements = [
  `CREATE TABLE users (
    id CHAR(36) NOT NULL PRIMARY KEY,
    email VARCHAR(320) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL,
    updated_at DATETIME(3) NOT NULL,
    CONSTRAINT uq_users_email UNIQUE (email)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
  `CREATE TABLE workspaces (
    id CHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    created_at DATETIME(3) NOT NULL,
    updated_at DATETIME(3) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
  `CREATE TABLE sessions (
    id CHAR(36) NOT NULL PRIMARY KEY,
    token_digest BINARY(32) NOT NULL,
    csrf_digest BINARY(32) NOT NULL,
    user_id CHAR(36) NOT NULL,
    issued_at DATETIME(3) NOT NULL,
    last_seen_at DATETIME(3) NOT NULL,
    expires_at DATETIME(3) NOT NULL,
    revoked_at DATETIME(3) NULL,
    client_ip VARCHAR(64) NULL,
    user_agent VARCHAR(255) NULL,
    CONSTRAINT uq_sessions_token UNIQUE (token_digest),
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_sessions_user_active (user_id, revoked_at, expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
  `CREATE TABLE workspace_members (
    id CHAR(36) NOT NULL PRIMARY KEY,
    workspace_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    role VARCHAR(24) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_user_id CHAR(36) NULL,
    created_at DATETIME(3) NOT NULL,
    updated_at DATETIME(3) NOT NULL,
    CONSTRAINT ck_members_role CHECK (role IN ('owner','administrator','member')),
    CONSTRAINT uq_workspace_member UNIQUE (workspace_id, user_id),
    CONSTRAINT fk_members_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    CONSTRAINT fk_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_members_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_members_workspace_active (workspace_id, active, role)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
  `CREATE TABLE instance_state (
    id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
    initialized BOOLEAN NOT NULL DEFAULT FALSE,
    owner_user_id CHAR(36) NULL,
    workspace_id CHAR(36) NULL,
    initialized_at DATETIME(3) NULL,
    CONSTRAINT ck_instance_state_singleton CHECK (id = 1),
    CONSTRAINT fk_instance_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_instance_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
  `INSERT INTO instance_state (id, initialized, owner_user_id, workspace_id, initialized_at) VALUES (1, FALSE, NULL, NULL, NULL)`,
  `CREATE TABLE invitations (
    id CHAR(36) NOT NULL PRIMARY KEY,
    workspace_id CHAR(36) NOT NULL,
    email VARCHAR(320) NOT NULL,
    role VARCHAR(24) NOT NULL,
    token_digest BINARY(32) NOT NULL,
    created_by_user_id CHAR(36) NOT NULL,
    expires_at DATETIME(3) NOT NULL,
    accepted_at DATETIME(3) NULL,
    revoked_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL,
    CONSTRAINT ck_invitations_role CHECK (role IN ('owner','administrator','member')),
    CONSTRAINT uq_invitations_token UNIQUE (token_digest),
    CONSTRAINT fk_invitations_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    CONSTRAINT fk_invitations_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_invitations_workspace_email (workspace_id, email, accepted_at, revoked_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
  `CREATE TABLE api_credentials (
    id CHAR(36) NOT NULL PRIMARY KEY,
    workspace_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    name VARCHAR(160) NOT NULL,
    scopes JSON NOT NULL,
    secret_digest BINARY(32) NOT NULL,
    ciphertext VARBINARY(512) NOT NULL,
    iv BINARY(12) NOT NULL,
    auth_tag BINARY(16) NOT NULL,
    key_version INT UNSIGNED NOT NULL,
    secret_version INT UNSIGNED NOT NULL,
    expires_at DATETIME(3) NULL,
    revoked_at DATETIME(3) NULL,
    last_used_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL,
    updated_at DATETIME(3) NOT NULL,
    CONSTRAINT uq_credentials_digest UNIQUE (secret_digest),
    CONSTRAINT fk_credentials_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    CONSTRAINT fk_credentials_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_credentials_owner (workspace_id, user_id, revoked_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
  `CREATE TABLE audit_events (
    sequence_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    id CHAR(36) NOT NULL,
    workspace_id CHAR(36) NULL,
    actor_type VARCHAR(24) NOT NULL,
    actor_user_id CHAR(36) NULL,
    action VARCHAR(96) NOT NULL,
    target_type VARCHAR(64) NOT NULL,
    target_id CHAR(36) NULL,
    request_id CHAR(36) NOT NULL,
    details JSON NOT NULL,
    created_at DATETIME(3) NOT NULL,
    CONSTRAINT ck_audit_actor CHECK (actor_type IN ('system','user','credential')),
    CONSTRAINT uq_audit_id UNIQUE (id),
    CONSTRAINT fk_audit_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT,
    CONSTRAINT fk_audit_actor_user FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audit_workspace_time (workspace_id, created_at, sequence_id),
    INDEX idx_audit_request (request_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
  `CREATE TRIGGER audit_events_no_update BEFORE UPDATE ON audit_events FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit events are append-only'`,
  `CREATE TRIGGER audit_events_no_delete BEFORE DELETE ON audit_events FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit events are append-only'`,
] as const

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const statement of statements) await sql.raw(statement).execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql.raw('DROP TRIGGER IF EXISTS audit_events_no_delete').execute(db)
  await sql.raw('DROP TRIGGER IF EXISTS audit_events_no_update').execute(db)
  for (const table of [
    'audit_events',
    'api_credentials',
    'invitations',
    'instance_state',
    'workspace_members',
    'sessions',
    'workspaces',
    'users',
  ]) {
    await sql.raw(`DROP TABLE IF EXISTS ${table}`).execute(db)
  }
}
