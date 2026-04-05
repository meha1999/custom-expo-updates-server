import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

type UserRole = 'admin' | 'viewer';
type ApiKeyScope = 'telemetry:write' | 'logs:write' | 'admin';

const DATA_DIRECTORY = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIRECTORY, 'control-plane.sqlite');
const UPDATES_DIRECTORY = path.resolve(process.cwd(), 'updates');
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface AuthUser {
  id: number;
  username: string;
  role: UserRole;
  createdAt: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
  expiresAt: string;
}

export interface AppRecord {
  id: number;
  slug: string;
  name: string;
  createdAt: string;
  codeSigningKeyId: string;
  hasCodeSigningPrivateKey: boolean;
}

export interface ChannelRecord {
  id: number;
  appId: number;
  name: string;
  createdAt: string;
}

export interface ReleaseRecord {
  id: number;
  appId: number;
  runtimeVersion: string;
  bundleId: string;
  updatePath: string;
  manifestId: string | null;
  isRollback: boolean;
  createdAt: string;
  metadataJson: string | null;
}

export interface RuntimePolicyRecord {
  id: number;
  channelId: number;
  runtimeVersion: string;
  activeReleaseId: number | null;
  rolloutPercentage: number;
  allowlistJson: string;
  blocklistJson: string;
  rollbackToEmbedded: boolean;
  updatedAt: string;
}

export interface ApiKeyRecord {
  id: number;
  name: string;
  keyPrefix: string;
  scopes: ApiKeyScope[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface CreateApiKeyResult {
  id: number;
  name: string;
  scopes: ApiKeyScope[];
  keyPrefix: string;
  apiKey: string;
  createdAt: string;
}

export interface DashboardLogEvent {
  timestamp: string;
  eventType:
    | 'manifest_update'
    | 'manifest_rollback'
    | 'manifest_no_update'
    | 'manifest_error'
    | 'asset_success'
    | 'asset_error'
    | 'ack_success'
    | 'ack_error';
  requestPath: string;
  method: string;
  status: number;
  appSlug: string;
  channelName?: string;
  platform?: string;
  runtimeVersion?: string;
  updateId?: string;
  bundlePath?: string;
  assetName?: string;
  message?: string;
  ip?: string;
  userAgent?: string;
  deviceId: string;
  appVersion?: string;
}

export interface LogFilters {
  appSlug?: string;
  channelName?: string;
  eventType?: string;
  status?: number;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface UpdateAckEvent {
  appSlug: string;
  deviceId: string;
  runtimeVersion?: string;
  updateId?: string;
  status: 'downloaded' | 'applied' | 'failed' | 'rolled_back';
  reason?: string;
  detailsJson?: string;
}

export interface DeviceUpsertContext {
  appSlug: string;
  deviceId: string;
  platform?: string;
  runtimeVersion?: string;
  appVersion?: string;
  channelName?: string;
}

export interface RuntimePolicyInput {
  appSlug: string;
  channelName: string;
  runtimeVersion: string;
  activeReleaseId?: number | null;
  rolloutPercentage?: number;
  allowlist?: string[];
  blocklist?: string[];
  rollbackToEmbedded?: boolean;
}

export interface DashboardSnapshot {
  summary: {
    totalEvents: number;
    uniqueDevices: number;
    uniqueRuntimeVersions: number;
    manifestRequests: number;
    assetRequests: number;
    updateResponses: number;
    rollbackResponses: number;
    noUpdateResponses: number;
    errorResponses: number;
    totalBundles: number;
    ackSuccess: number;
    ackFailures: number;
  };
  platformBreakdown: {
    ios: number;
    android: number;
    unknown: number;
  };
  recentEvents: Array<{
    id: number;
    timestamp: string;
    eventType: string;
    requestPath: string;
    status: number;
    appSlug: string;
    channelName: string | null;
    platform: string | null;
    runtimeVersion: string | null;
    deviceId: string;
    message: string | null;
  }>;
  recentUpdates: Array<{
    id: number;
    appSlug: string;
    runtimeVersion: string;
    bundleId: string;
    createdAt: string;
    isRollback: boolean;
    manifestId: string | null;
  }>;
  devices: Array<{
    id: number;
    appSlug: string;
    deviceId: string;
    platform: string | null;
    runtimeVersion: string | null;
    channelName: string | null;
    appVersion: string | null;
    firstSeen: string;
    lastSeen: string;
    totalRequests: number;
  }>;
  recentAuditLogs: Array<{
    id: number;
    timestamp: string;
    actorUsername: string;
    action: string;
    appSlug: string;
    detailsJson: string;
  }>;
}

declare global {
  // eslint-disable-next-line no-var
  var __controlPlaneDb: Database.Database | undefined;
  // eslint-disable-next-line no-var
  var __controlPlaneSeeded: boolean | undefined;
}

function ensureInitialized(): Database.Database {
  if (!global.__controlPlaneDb) {
    fs.mkdirSync(DATA_DIRECTORY, { recursive: true });
    const db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    runMigrations(db);
    global.__controlPlaneDb = db;
  }

  const db = global.__controlPlaneDb;
  if (!db) {
    throw new Error('Database not initialized');
  }

  if (!global.__controlPlaneSeeded) {
    seedDefaults(db);
    global.__controlPlaneSeeded = true;
  }

  return db;
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      scopes_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      revoked_at TEXT
    );

    CREATE TABLE IF NOT EXISTS apps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      code_signing_private_key TEXT,
      code_signing_key_id TEXT NOT NULL DEFAULT 'main',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(app_id, name),
      FOREIGN KEY (app_id) REFERENCES apps(id)
    );

    CREATE TABLE IF NOT EXISTS releases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id INTEGER NOT NULL,
      runtime_version TEXT NOT NULL,
      bundle_id TEXT NOT NULL,
      update_path TEXT NOT NULL,
      manifest_id TEXT,
      is_rollback INTEGER NOT NULL DEFAULT 0,
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(app_id, runtime_version, bundle_id),
      FOREIGN KEY (app_id) REFERENCES apps(id)
    );

    CREATE TABLE IF NOT EXISTS channel_runtime_policies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id INTEGER NOT NULL,
      runtime_version TEXT NOT NULL,
      active_release_id INTEGER,
      rollout_percentage INTEGER NOT NULL DEFAULT 100,
      allowlist_json TEXT NOT NULL DEFAULT '[]',
      blocklist_json TEXT NOT NULL DEFAULT '[]',
      rollback_to_embedded INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      UNIQUE(channel_id, runtime_version),
      FOREIGN KEY (channel_id) REFERENCES channels(id),
      FOREIGN KEY (active_release_id) REFERENCES releases(id)
    );

    CREATE TABLE IF NOT EXISTS devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id INTEGER NOT NULL,
      device_id TEXT NOT NULL,
      platform TEXT,
      runtime_version TEXT,
      app_version TEXT,
      channel_name TEXT,
      first_seen TEXT NOT NULL,
      last_seen TEXT NOT NULL,
      total_requests INTEGER NOT NULL DEFAULT 0,
      UNIQUE(app_id, device_id),
      FOREIGN KEY (app_id) REFERENCES apps(id)
    );

    CREATE TABLE IF NOT EXISTS request_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      event_type TEXT NOT NULL,
      request_path TEXT NOT NULL,
      method TEXT NOT NULL,
      status INTEGER NOT NULL,
      channel_name TEXT,
      platform TEXT,
      runtime_version TEXT,
      update_id TEXT,
      bundle_path TEXT,
      asset_name TEXT,
      message TEXT,
      ip TEXT,
      user_agent TEXT,
      device_id TEXT NOT NULL,
      FOREIGN KEY (app_id) REFERENCES apps(id)
    );

    CREATE TABLE IF NOT EXISTS update_acks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      device_id TEXT NOT NULL,
      runtime_version TEXT,
      update_id TEXT,
      status TEXT NOT NULL,
      reason TEXT,
      details_json TEXT,
      FOREIGN KEY (app_id) REFERENCES apps(id)
    );

    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      actor_username TEXT NOT NULL,
      action TEXT NOT NULL,
      app_id INTEGER NOT NULL,
      details_json TEXT NOT NULL,
      FOREIGN KEY (app_id) REFERENCES apps(id)
    );

    CREATE INDEX IF NOT EXISTS idx_request_logs_timestamp ON request_logs(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_request_logs_event_type ON request_logs(event_type);
    CREATE INDEX IF NOT EXISTS idx_request_logs_status ON request_logs(status);
    CREATE INDEX IF NOT EXISTS idx_request_logs_device ON request_logs(device_id);
    CREATE INDEX IF NOT EXISTS idx_releases_runtime ON releases(app_id, runtime_version, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_acks_timestamp ON update_acks(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_admin_audit_timestamp ON admin_audit_logs(timestamp DESC);
  `);

  ensureAppSigningColumns(db);
}

function ensureAppSigningColumns(db: Database.Database): void {
  const columns = db.prepare(`PRAGMA table_info(apps)`).all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));
  if (!columnNames.has('code_signing_private_key')) {
    db.exec(`ALTER TABLE apps ADD COLUMN code_signing_private_key TEXT`);
  }
  if (!columnNames.has('code_signing_key_id')) {
    db.exec(`ALTER TABLE apps ADD COLUMN code_signing_key_id TEXT NOT NULL DEFAULT 'main'`);
  }
}

function seedDefaults(db: Database.Database): void {
  const now = new Date().toISOString();
  const adminUsername = process.env.DASHBOARD_ADMIN_USERNAME ?? 'admin';
  const adminPassword = process.env.DASHBOARD_ADMIN_PASSWORD;

  const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get(adminUsername) as
    | { id: number }
    | undefined;
  if (!existingAdmin) {
    if (!adminPassword) {
      throw new Error(
        'DASHBOARD_ADMIN_PASSWORD is required to bootstrap the first admin account.',
      );
    }
    if (adminPassword === 'change-me-now') {
      throw new Error('DASHBOARD_ADMIN_PASSWORD cannot be "change-me-now".');
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(adminPassword, salt);
    db.prepare(
      'INSERT INTO users (username, password_hash, password_salt, role, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(adminUsername, passwordHash, salt, 'admin', now);
  }

  const defaultApp = db.prepare('SELECT id FROM apps WHERE slug = ?').get('default') as
    | { id: number }
    | undefined;
  if (!defaultApp) {
    const result = db.prepare('INSERT INTO apps (slug, name, created_at) VALUES (?, ?, ?)').run(
      'default',
      'Default App',
      now,
    );
    ensureDefaultChannels(db, Number(result.lastInsertRowid), now);
  } else {
    ensureDefaultChannels(db, defaultApp.id, now);
  }
}

function ensureDefaultChannels(db: Database.Database, appId: number, now: string): void {
  const defaultChannels = ['production', 'development'];
  for (const channelName of defaultChannels) {
    db.prepare('INSERT OR IGNORE INTO channels (app_id, name, created_at) VALUES (?, ?, ?)').run(
      appId,
      channelName,
      now,
    );
  }
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const calculatedHash = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(calculatedHash, 'hex'), Buffer.from(expectedHash, 'hex'));
}

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function sanitizeSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
}

function createApiKeyMaterial(): { plain: string; hash: string; prefix: string } {
  const plain = `cp_${crypto.randomBytes(24).toString('hex')}`;
  const hash = crypto.createHash('sha256').update(plain).digest('hex');
  const prefix = plain.slice(0, 10);
  return { plain, hash, prefix };
}

function toAppRecord(row: any): AppRecord {
  const storedKeyId = typeof row.code_signing_key_id === 'string' ? row.code_signing_key_id.trim() : '';
  const rawPrivateKey =
    typeof row.code_signing_private_key === 'string' ? row.code_signing_private_key.trim() : '';
  const hasCodeSigningPrivateKey =
    typeof row.has_code_signing_private_key === 'number'
      ? row.has_code_signing_private_key === 1
      : rawPrivateKey.length > 0;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    createdAt: row.created_at,
    codeSigningKeyId: storedKeyId || 'main',
    hasCodeSigningPrivateKey,
  };
}

function toChannelRecord(row: any): ChannelRecord {
  return {
    id: row.id,
    appId: row.app_id,
    name: row.name,
    createdAt: row.created_at,
  };
}

function toReleaseRecord(row: any): ReleaseRecord {
  return {
    id: row.id,
    appId: row.app_id,
    runtimeVersion: row.runtime_version,
    bundleId: row.bundle_id,
    updatePath: row.update_path,
    manifestId: row.manifest_id,
    isRollback: row.is_rollback === 1,
    createdAt: row.created_at,
    metadataJson: row.metadata_json,
  };
}

function toPolicyRecord(row: any): RuntimePolicyRecord {
  return {
    id: row.id,
    channelId: row.channel_id,
    runtimeVersion: row.runtime_version,
    activeReleaseId: row.active_release_id,
    rolloutPercentage: row.rollout_percentage,
    allowlistJson: row.allowlist_json,
    blocklistJson: row.blocklist_json,
    rollbackToEmbedded: row.rollback_to_embedded === 1,
    updatedAt: row.updated_at,
  };
}

export function listUsers(): AuthUser[] {
  const db = ensureInitialized();
  const rows = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY id ASC').all() as any[];
  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    role: row.role,
    createdAt: row.created_at,
  }));
}

export function getUserRoleCounts(): { total: number; admins: number; viewers: number } {
  const db = ensureInitialized();
  const totalRow = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  const adminRow = db
    .prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'")
    .get() as { count: number };
  const viewerRow = db
    .prepare("SELECT COUNT(*) as count FROM users WHERE role = 'viewer'")
    .get() as { count: number };
  return {
    total: totalRow.count ?? 0,
    admins: adminRow.count ?? 0,
    viewers: viewerRow.count ?? 0,
  };
}

export function createUser(input: {
  username: string;
  password: string;
  role: UserRole;
}): AuthUser {
  const db = ensureInitialized();
  const now = new Date().toISOString();
  const username = input.username.trim().toLowerCase();
  if (!username) {
    throw new Error('Username is required');
  }
  if (input.password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(input.password, salt);

  const result = db
    .prepare('INSERT INTO users (username, password_hash, password_salt, role, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(username, passwordHash, salt, input.role, now);

  return {
    id: Number(result.lastInsertRowid),
    username,
    role: input.role,
    createdAt: now,
  };
}

export function changeUserPassword(input: {
  userId: number;
  currentPassword: string;
  newPassword: string;
}): void {
  const db = ensureInitialized();
  const currentPassword = `${input.currentPassword ?? ''}`;
  const newPassword = `${input.newPassword ?? ''}`;
  if (!currentPassword || !newPassword) {
    throw new Error('currentPassword and newPassword are required');
  }
  if (newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const user = db
    .prepare('SELECT id, password_hash, password_salt FROM users WHERE id = ?')
    .get(input.userId) as
    | {
        id: number;
        password_hash: string;
        password_salt: string;
      }
    | undefined;

  if (!user) {
    throw new Error('User not found');
  }
  if (!verifyPassword(currentPassword, user.password_salt, user.password_hash)) {
    throw new Error('Current password is incorrect');
  }

  const nextSalt = crypto.randomBytes(16).toString('hex');
  const nextHash = hashPassword(newPassword, nextSalt);
  db.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').run(
    nextHash,
    nextSalt,
    input.userId,
  );
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(input.userId);
}

export function authenticateUser(username: string, password: string): AuthSession {
  const db = ensureInitialized();
  const normalizedUsername = username.trim().toLowerCase();
  const user = db
    .prepare('SELECT id, username, password_hash, password_salt, role, created_at FROM users WHERE username = ?')
    .get(normalizedUsername) as
    | {
        id: number;
        username: string;
        password_hash: string;
        password_salt: string;
        role: UserRole;
        created_at: string;
      }
    | undefined;

  if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
    throw new Error('Invalid username or password');
  }

  const token = crypto.randomBytes(48).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
    token,
    user.id,
    now.toISOString(),
    expiresAt,
  );

  return {
    token,
    expiresAt,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.created_at,
    },
  };
}

export function getUserBySessionToken(token: string): AuthUser | null {
  const db = ensureInitialized();
  const row = db
    .prepare(
      `
      SELECT users.id, users.username, users.role, users.created_at, sessions.expires_at
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.token = ?
      `,
    )
    .get(token) as
    | {
        id: number;
        username: string;
        role: UserRole;
        created_at: string;
        expires_at: string;
      }
    | undefined;

  if (!row) {
    return null;
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }

  return {
    id: row.id,
    username: row.username,
    role: row.role,
    createdAt: row.created_at,
  };
}

export function invalidateSession(token: string): void {
  const db = ensureInitialized();
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function listApiKeys(): ApiKeyRecord[] {
  const db = ensureInitialized();
  const rows = db
    .prepare(
      'SELECT id, name, key_prefix, scopes_json, created_at, last_used_at, revoked_at FROM api_keys ORDER BY id DESC',
    )
    .all() as any[];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    keyPrefix: row.key_prefix,
    scopes: parseJsonArray(row.scopes_json) as ApiKeyScope[],
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  }));
}

export function createApiKey(name: string, scopes: ApiKeyScope[]): CreateApiKeyResult {
  const db = ensureInitialized();
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new Error('API key name is required');
  }
  const uniqueScopes = Array.from(new Set(scopes));
  if (uniqueScopes.length === 0) {
    throw new Error('At least one scope is required');
  }

  const now = new Date().toISOString();
  const material = createApiKeyMaterial();
  const result = db
    .prepare(
      'INSERT INTO api_keys (name, key_prefix, key_hash, scopes_json, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run(normalizedName, material.prefix, material.hash, JSON.stringify(uniqueScopes), now);

  return {
    id: Number(result.lastInsertRowid),
    name: normalizedName,
    scopes: uniqueScopes,
    keyPrefix: material.prefix,
    apiKey: material.plain,
    createdAt: now,
  };
}

export function revokeApiKey(id: number): void {
  const db = ensureInitialized();
  db.prepare('UPDATE api_keys SET revoked_at = ? WHERE id = ?').run(new Date().toISOString(), id);
}

export function insertAdminAuditLog(input: {
  actorUsername: string;
  action: string;
  appSlug: string;
  details: Record<string, unknown>;
}): void {
  const db = ensureInitialized();
  const app = getOrCreateAppBySlug(input.appSlug);
  db.prepare(
    `
    INSERT INTO admin_audit_logs (timestamp, actor_username, action, app_id, details_json)
    VALUES (?, ?, ?, ?, ?)
    `,
  ).run(
    new Date().toISOString(),
    input.actorUsername,
    input.action,
    app.id,
    JSON.stringify(input.details ?? {}),
  );
}

export function listAdminAuditLogs(input: { appSlug: string; limit: number }): Array<{
  id: number;
  timestamp: string;
  actorUsername: string;
  action: string;
  appSlug: string;
  detailsJson: string;
}> {
  const db = ensureInitialized();
  const app = getOrCreateAppBySlug(input.appSlug);
  const limit = Math.max(1, Math.min(200, input.limit));
  const rows = db
    .prepare(
      `
      SELECT
        admin_audit_logs.id,
        admin_audit_logs.timestamp,
        admin_audit_logs.actor_username,
        admin_audit_logs.action,
        admin_audit_logs.details_json,
        apps.slug as app_slug
      FROM admin_audit_logs
      JOIN apps ON apps.id = admin_audit_logs.app_id
      WHERE admin_audit_logs.app_id = ?
      ORDER BY admin_audit_logs.timestamp DESC
      LIMIT ?
      `,
    )
    .all(app.id, limit) as any[];
  return rows.map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    actorUsername: row.actor_username,
    action: row.action,
    appSlug: row.app_slug,
    detailsJson: row.details_json,
  }));
}

export function validateApiKey(
  rawApiKey: string | undefined,
  requiredScope: ApiKeyScope,
): ApiKeyRecord | null {
  if (!rawApiKey) {
    return null;
  }
  const db = ensureInitialized();
  const hash = crypto.createHash('sha256').update(rawApiKey).digest('hex');
  const row = db
    .prepare(
      'SELECT id, name, key_prefix, scopes_json, created_at, last_used_at, revoked_at FROM api_keys WHERE key_hash = ?',
    )
    .get(hash) as any | undefined;
  if (!row) {
    return null;
  }
  if (row.revoked_at) {
    return null;
  }
  const scopes = parseJsonArray(row.scopes_json) as ApiKeyScope[];
  if (!scopes.includes(requiredScope) && !scopes.includes('admin')) {
    return null;
  }

  db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?').run(new Date().toISOString(), row.id);

  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.key_prefix,
    scopes,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  };
}

export function listApps(): AppRecord[] {
  const db = ensureInitialized();
  const rows = db
    .prepare(
      `
      SELECT
        id,
        slug,
        name,
        created_at,
        code_signing_key_id,
        CASE
          WHEN code_signing_private_key IS NOT NULL AND TRIM(code_signing_private_key) != '' THEN 1
          ELSE 0
        END AS has_code_signing_private_key
      FROM apps
      ORDER BY slug ASC
      `,
    )
    .all() as any[];
  return rows.map(toAppRecord);
}

export function createApp(name: string, slug?: string): AppRecord {
  const db = ensureInitialized();
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new Error('App name is required');
  }
  const derivedSlug = sanitizeSlug(slug?.trim() || normalizedName);
  if (!derivedSlug) {
    throw new Error('Invalid app slug');
  }

  const now = new Date().toISOString();
  const result = db
    .prepare('INSERT INTO apps (slug, name, code_signing_key_id, created_at) VALUES (?, ?, ?, ?)')
    .run(derivedSlug, normalizedName, 'main', now);
  const appId = Number(result.lastInsertRowid);
  ensureDefaultChannels(db, appId, now);

  return {
    id: appId,
    slug: derivedSlug,
    name: normalizedName,
    createdAt: now,
    codeSigningKeyId: 'main',
    hasCodeSigningPrivateKey: false,
  };
}

export function getOrCreateAppBySlug(appSlug: string): AppRecord {
  const db = ensureInitialized();
  const normalizedSlug = sanitizeSlug(appSlug || 'default') || 'default';
  const existing = db
    .prepare(
      `
      SELECT
        id,
        slug,
        name,
        created_at,
        code_signing_private_key,
        code_signing_key_id,
        CASE
          WHEN code_signing_private_key IS NOT NULL AND TRIM(code_signing_private_key) != '' THEN 1
          ELSE 0
        END AS has_code_signing_private_key
      FROM apps
      WHERE slug = ?
      `,
    )
    .get(normalizedSlug) as any | undefined;
  if (existing) {
    return toAppRecord(existing);
  }
  return createApp(normalizedSlug, normalizedSlug);
}

export function updateAppCodeSigning(input: {
  appSlug: string;
  keyId?: string;
  privateKeyPem?: string;
  clearPrivateKey?: boolean;
}): AppRecord {
  const db = ensureInitialized();
  const app = getOrCreateAppBySlug(input.appSlug);
  const updates: string[] = [];
  const params: Array<string | null | number> = [];

  if (typeof input.keyId === 'string') {
    const keyId = input.keyId.trim() || 'main';
    updates.push('code_signing_key_id = ?');
    params.push(keyId);
  }

  if (typeof input.privateKeyPem === 'string') {
    const privateKeyPem = input.privateKeyPem.trim();
    if (privateKeyPem.length > 0) {
      updates.push('code_signing_private_key = ?');
      params.push(privateKeyPem);
    }
  }

  if (input.clearPrivateKey) {
    updates.push('code_signing_private_key = NULL');
  }

  if (updates.length === 0) {
    throw new Error('No code signing fields provided');
  }

  db.prepare(`UPDATE apps SET ${updates.join(', ')} WHERE id = ?`).run(...params, app.id);
  return getOrCreateAppBySlug(app.slug);
}

export function getAppCodeSigningConfig(appSlug: string): {
  keyId: string;
  privateKeyPem: string | null;
} {
  const db = ensureInitialized();
  const app = getOrCreateAppBySlug(appSlug);
  const row = db
    .prepare('SELECT code_signing_private_key, code_signing_key_id FROM apps WHERE id = ?')
    .get(app.id) as
    | {
        code_signing_private_key: string | null;
        code_signing_key_id: string | null;
      }
    | undefined;

  const keyId = row?.code_signing_key_id?.trim() || 'main';
  const privateKeyPem = row?.code_signing_private_key?.trim() || null;
  return { keyId, privateKeyPem };
}

export function listChannels(appSlug: string): ChannelRecord[] {
  const db = ensureInitialized();
  const app = getOrCreateAppBySlug(appSlug);
  const rows = db
    .prepare('SELECT id, app_id, name, created_at FROM channels WHERE app_id = ? ORDER BY name ASC')
    .all(app.id) as any[];
  return rows.map(toChannelRecord);
}

export function createChannel(appSlug: string, channelName: string): ChannelRecord {
  const db = ensureInitialized();
  const app = getOrCreateAppBySlug(appSlug);
  const name = channelName.trim();
  if (!name) {
    throw new Error('Channel name is required');
  }
  const now = new Date().toISOString();
  const result = db
    .prepare('INSERT INTO channels (app_id, name, created_at) VALUES (?, ?, ?)')
    .run(app.id, name, now);
  return {
    id: Number(result.lastInsertRowid),
    appId: app.id,
    name,
    createdAt: now,
  };
}

function getChannelByName(appId: number, name: string): ChannelRecord {
  const db = ensureInitialized();
  const existing = db
    .prepare('SELECT id, app_id, name, created_at FROM channels WHERE app_id = ? AND name = ?')
    .get(appId, name) as any | undefined;
  if (existing) {
    return toChannelRecord(existing);
  }
  const now = new Date().toISOString();
  const result = db
    .prepare('INSERT INTO channels (app_id, name, created_at) VALUES (?, ?, ?)')
    .run(appId, name, now);
  return {
    id: Number(result.lastInsertRowid),
    appId,
    name,
    createdAt: now,
  };
}

export function listReleases(input: { appSlug: string; runtimeVersion?: string }): ReleaseRecord[] {
  const db = ensureInitialized();
  const app = getOrCreateAppBySlug(input.appSlug);

  const rows = input.runtimeVersion
    ? (db
        .prepare(
          `
          SELECT id, app_id, runtime_version, bundle_id, update_path, manifest_id, is_rollback, metadata_json, created_at
          FROM releases
          WHERE app_id = ? AND runtime_version = ?
          ORDER BY created_at DESC
          `,
        )
        .all(app.id, input.runtimeVersion) as any[])
    : (db
        .prepare(
          `
          SELECT id, app_id, runtime_version, bundle_id, update_path, manifest_id, is_rollback, metadata_json, created_at
          FROM releases
          WHERE app_id = ?
          ORDER BY created_at DESC
          `,
        )
        .all(app.id) as any[]);

  return rows.map(toReleaseRecord);
}

function makeUpdatePath(runtimeVersion: string, bundleId: string): string {
  return path.join('updates', runtimeVersion, bundleId);
}

function computeManifestIdFromMetadata(metadataPath: string): string | null {
  if (!fs.existsSync(metadataPath)) {
    return null;
  }
  const metadataBuffer = fs.readFileSync(metadataPath);
  const hash = crypto.createHash('sha256').update(metadataBuffer).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

function isRollbackBundle(updatePath: string): boolean {
  return fs.existsSync(path.join(updatePath, 'rollback'));
}

function fileBirthtimeISO(filePath: string): string {
  const stat = fs.statSync(filePath);
  return stat.birthtime.toISOString();
}

export function registerRelease(input: {
  appSlug: string;
  runtimeVersion: string;
  bundleId: string;
}): ReleaseRecord {
  const db = ensureInitialized();
  const app = getOrCreateAppBySlug(input.appSlug);
  const updatePath = makeUpdatePath(input.runtimeVersion, input.bundleId);
  const absoluteUpdatePath = path.resolve(process.cwd(), updatePath);
  if (!fs.existsSync(absoluteUpdatePath)) {
    throw new Error(`Update bundle path not found: ${updatePath}`);
  }
  const metadataPath = path.join(absoluteUpdatePath, 'metadata.json');
  const manifestId = computeManifestIdFromMetadata(metadataPath);
  const rollback = isRollbackBundle(absoluteUpdatePath);
  const metadataJson = fs.existsSync(metadataPath) ? fs.readFileSync(metadataPath, 'utf8') : null;
  const createdAt = fs.existsSync(metadataPath)
    ? fileBirthtimeISO(metadataPath)
    : fileBirthtimeISO(path.join(absoluteUpdatePath, 'rollback'));

  db.prepare(
    `
    INSERT INTO releases (app_id, runtime_version, bundle_id, update_path, manifest_id, is_rollback, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(app_id, runtime_version, bundle_id) DO UPDATE SET
      update_path = excluded.update_path,
      manifest_id = excluded.manifest_id,
      is_rollback = excluded.is_rollback,
      metadata_json = excluded.metadata_json
    `,
  ).run(
    app.id,
    input.runtimeVersion,
    input.bundleId,
    updatePath.replace(/\\/g, '/'),
    manifestId,
    rollback ? 1 : 0,
    metadataJson,
    createdAt,
  );

  const row = db
    .prepare(
      `
      SELECT id, app_id, runtime_version, bundle_id, update_path, manifest_id, is_rollback, metadata_json, created_at
      FROM releases
      WHERE app_id = ? AND runtime_version = ? AND bundle_id = ?
      `,
    )
    .get(app.id, input.runtimeVersion, input.bundleId) as any;
  return toReleaseRecord(row);
}

export function syncFilesystemReleases(input: { appSlug: string; runtimeVersion?: string }): number {
  const app = getOrCreateAppBySlug(input.appSlug);
  const appSlug = app.slug;
  let syncedCount = 0;
  if (!fs.existsSync(UPDATES_DIRECTORY)) {
    return 0;
  }

  const runtimeDirs = input.runtimeVersion ? [input.runtimeVersion] : fs.readdirSync(UPDATES_DIRECTORY);
  for (const runtimeVersion of runtimeDirs) {
    const runtimePath = path.join(UPDATES_DIRECTORY, runtimeVersion);
    if (!fs.existsSync(runtimePath) || !fs.statSync(runtimePath).isDirectory()) {
      continue;
    }
    const bundleDirs = fs.readdirSync(runtimePath);
    for (const bundleId of bundleDirs) {
      const bundlePath = path.join(runtimePath, bundleId);
      if (!fs.statSync(bundlePath).isDirectory()) {
        continue;
      }
      const hasMetadata = fs.existsSync(path.join(bundlePath, 'metadata.json'));
      const hasRollback = fs.existsSync(path.join(bundlePath, 'rollback'));
      if (!hasMetadata && !hasRollback) {
        continue;
      }
      registerRelease({
        appSlug,
        runtimeVersion,
        bundleId,
      });
      syncedCount += 1;
    }
  }
  return syncedCount;
}

export function setRuntimePolicy(input: RuntimePolicyInput): RuntimePolicyRecord {
  const db = ensureInitialized();
  const app = getOrCreateAppBySlug(input.appSlug);
  const channel = getChannelByName(app.id, input.channelName);
  const now = new Date().toISOString();

  const existing = db
    .prepare(
      `
      SELECT id, channel_id, runtime_version, active_release_id, rollout_percentage, allowlist_json, blocklist_json, rollback_to_embedded, updated_at
      FROM channel_runtime_policies
      WHERE channel_id = ? AND runtime_version = ?
      `,
    )
    .get(channel.id, input.runtimeVersion) as any | undefined;

  if (!existing) {
    db.prepare(
      `
      INSERT INTO channel_runtime_policies
      (channel_id, runtime_version, active_release_id, rollout_percentage, allowlist_json, blocklist_json, rollback_to_embedded, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      channel.id,
      input.runtimeVersion,
      input.activeReleaseId ?? null,
      clampRollout(input.rolloutPercentage ?? 100),
      JSON.stringify(input.allowlist ?? []),
      JSON.stringify(input.blocklist ?? []),
      input.rollbackToEmbedded ? 1 : 0,
      now,
    );
  } else {
    const nextActiveReleaseId =
      input.activeReleaseId === undefined ? existing.active_release_id : input.activeReleaseId;
    const nextRolloutPercentage =
      input.rolloutPercentage === undefined
        ? existing.rollout_percentage
        : clampRollout(input.rolloutPercentage);
    const nextAllowlist =
      input.allowlist === undefined ? parseJsonArray(existing.allowlist_json) : input.allowlist;
    const nextBlocklist =
      input.blocklist === undefined ? parseJsonArray(existing.blocklist_json) : input.blocklist;
    const nextRollbackToEmbedded =
      input.rollbackToEmbedded === undefined
        ? existing.rollback_to_embedded
        : input.rollbackToEmbedded
        ? 1
        : 0;

    db.prepare(
      `
      UPDATE channel_runtime_policies
      SET active_release_id = ?,
          rollout_percentage = ?,
          allowlist_json = ?,
          blocklist_json = ?,
          rollback_to_embedded = ?,
          updated_at = ?
      WHERE id = ?
      `,
    ).run(
      nextActiveReleaseId,
      nextRolloutPercentage,
      JSON.stringify(nextAllowlist),
      JSON.stringify(nextBlocklist),
      nextRollbackToEmbedded,
      now,
      existing.id,
    );
  }

  const row = db
    .prepare(
      `
      SELECT id, channel_id, runtime_version, active_release_id, rollout_percentage, allowlist_json, blocklist_json, rollback_to_embedded, updated_at
      FROM channel_runtime_policies
      WHERE channel_id = ? AND runtime_version = ?
      `,
    )
    .get(channel.id, input.runtimeVersion) as any;
  return toPolicyRecord(row);
}

function clampRollout(input: number): number {
  if (!Number.isFinite(input)) {
    return 100;
  }
  return Math.max(0, Math.min(100, Math.floor(input)));
}

export function getRuntimePolicy(input: {
  appSlug: string;
  channelName: string;
  runtimeVersion: string;
}): RuntimePolicyRecord | null {
  const db = ensureInitialized();
  const app = getOrCreateAppBySlug(input.appSlug);
  const channel = getChannelByName(app.id, input.channelName);
  const row = db
    .prepare(
      `
      SELECT id, channel_id, runtime_version, active_release_id, rollout_percentage, allowlist_json, blocklist_json, rollback_to_embedded, updated_at
      FROM channel_runtime_policies
      WHERE channel_id = ? AND runtime_version = ?
      `,
    )
    .get(channel.id, input.runtimeVersion) as any | undefined;
  return row ? toPolicyRecord(row) : null;
}

export function listRuntimePolicies(input: {
  appSlug: string;
  channelName?: string;
}): Array<
  RuntimePolicyRecord & {
    channelName: string;
  }
> {
  const db = ensureInitialized();
  const app = getOrCreateAppBySlug(input.appSlug);
  const rows = input.channelName
    ? (db
        .prepare(
          `
          SELECT
            channel_runtime_policies.id,
            channel_runtime_policies.channel_id,
            channel_runtime_policies.runtime_version,
            channel_runtime_policies.active_release_id,
            channel_runtime_policies.rollout_percentage,
            channel_runtime_policies.allowlist_json,
            channel_runtime_policies.blocklist_json,
            channel_runtime_policies.rollback_to_embedded,
            channel_runtime_policies.updated_at,
            channels.name AS channel_name
          FROM channel_runtime_policies
          JOIN channels ON channels.id = channel_runtime_policies.channel_id
          WHERE channels.app_id = ? AND channels.name = ?
          ORDER BY channel_runtime_policies.runtime_version ASC
          `,
        )
        .all(app.id, input.channelName) as any[])
    : (db
        .prepare(
          `
          SELECT
            channel_runtime_policies.id,
            channel_runtime_policies.channel_id,
            channel_runtime_policies.runtime_version,
            channel_runtime_policies.active_release_id,
            channel_runtime_policies.rollout_percentage,
            channel_runtime_policies.allowlist_json,
            channel_runtime_policies.blocklist_json,
            channel_runtime_policies.rollback_to_embedded,
            channel_runtime_policies.updated_at,
            channels.name AS channel_name
          FROM channel_runtime_policies
          JOIN channels ON channels.id = channel_runtime_policies.channel_id
          WHERE channels.app_id = ?
          ORDER BY channels.name ASC, channel_runtime_policies.runtime_version ASC
          `,
        )
        .all(app.id) as any[]);

  return rows.map((row) => ({
    ...toPolicyRecord(row),
    channelName: row.channel_name,
  }));
}

export function assignReleaseToChannel(input: {
  appSlug: string;
  channelName: string;
  runtimeVersion: string;
  releaseId: number;
  rolloutPercentage?: number;
  allowlist?: string[];
  blocklist?: string[];
}): RuntimePolicyRecord {
  return setRuntimePolicy({
    appSlug: input.appSlug,
    channelName: input.channelName,
    runtimeVersion: input.runtimeVersion,
    activeReleaseId: input.releaseId,
    rolloutPercentage: input.rolloutPercentage,
    allowlist: input.allowlist,
    blocklist: input.blocklist,
    rollbackToEmbedded: false,
  });
}

export function rollbackChannel(input: {
  appSlug: string;
  channelName: string;
  runtimeVersion: string;
}): RuntimePolicyRecord {
  return setRuntimePolicy({
    appSlug: input.appSlug,
    channelName: input.channelName,
    runtimeVersion: input.runtimeVersion,
    activeReleaseId: null,
    rollbackToEmbedded: true,
  });
}

export function promoteRelease(input: {
  appSlug: string;
  sourceChannelName: string;
  targetChannelName: string;
  runtimeVersion: string;
}): RuntimePolicyRecord {
  const sourcePolicy = getRuntimePolicy({
    appSlug: input.appSlug,
    channelName: input.sourceChannelName,
    runtimeVersion: input.runtimeVersion,
  });
  if (!sourcePolicy?.activeReleaseId) {
    throw new Error('Source channel has no active release for runtime');
  }

  return setRuntimePolicy({
    appSlug: input.appSlug,
    channelName: input.targetChannelName,
    runtimeVersion: input.runtimeVersion,
    activeReleaseId: sourcePolicy.activeReleaseId,
    rolloutPercentage: sourcePolicy.rolloutPercentage,
    allowlist: parseJsonArray(sourcePolicy.allowlistJson),
    blocklist: parseJsonArray(sourcePolicy.blocklistJson),
    rollbackToEmbedded: false,
  });
}

function getReleaseById(releaseId: number): ReleaseRecord | null {
  const db = ensureInitialized();
  const row = db
    .prepare(
      `
      SELECT id, app_id, runtime_version, bundle_id, update_path, manifest_id, is_rollback, metadata_json, created_at
      FROM releases
      WHERE id = ?
      `,
    )
    .get(releaseId) as any | undefined;
  return row ? toReleaseRecord(row) : null;
}

function getLatestReleaseByRuntime(appId: number, runtimeVersion: string): ReleaseRecord | null {
  const db = ensureInitialized();
  const row = db
    .prepare(
      `
      SELECT id, app_id, runtime_version, bundle_id, update_path, manifest_id, is_rollback, metadata_json, created_at
      FROM releases
      WHERE app_id = ? AND runtime_version = ?
      ORDER BY created_at DESC
      LIMIT 1
      `,
    )
    .get(appId, runtimeVersion) as any | undefined;
  return row ? toReleaseRecord(row) : null;
}

function deterministicPercent(input: string): number {
  const hash = crypto.createHash('sha1').update(input).digest('hex').slice(0, 8);
  const numeric = Number.parseInt(hash, 16);
  return numeric % 100;
}

function isDeviceEligibleForRollout(
  deviceId: string,
  releaseId: number,
  rolloutPercentage: number,
  allowlist: string[],
  blocklist: string[],
): boolean {
  if (blocklist.includes(deviceId)) {
    return false;
  }
  if (allowlist.includes(deviceId)) {
    return true;
  }
  if (rolloutPercentage >= 100) {
    return true;
  }
  if (rolloutPercentage <= 0) {
    return false;
  }
  const bucket = deterministicPercent(`${deviceId}:${releaseId}`);
  return bucket < rolloutPercentage;
}

export function resolveReleaseForRequest(input: {
  appSlug: string;
  channelName: string;
  runtimeVersion: string;
  deviceId: string;
}):
  | {
      kind: 'rollback';
      policy: RuntimePolicyRecord;
    }
  | {
      kind: 'no_update';
      reason: string;
      policy: RuntimePolicyRecord | null;
    }
  | {
      kind: 'update';
      release: ReleaseRecord;
      policy: RuntimePolicyRecord | null;
    } {
  const app = getOrCreateAppBySlug(input.appSlug);
  syncFilesystemReleases({ appSlug: app.slug, runtimeVersion: input.runtimeVersion });

  const policy = getRuntimePolicy({
    appSlug: app.slug,
    channelName: input.channelName,
    runtimeVersion: input.runtimeVersion,
  });

  if (policy?.rollbackToEmbedded) {
    return {
      kind: 'rollback',
      policy,
    };
  }

  const policyRelease = policy?.activeReleaseId ? getReleaseById(policy.activeReleaseId) : null;
  const release = policyRelease ?? getLatestReleaseByRuntime(app.id, input.runtimeVersion);
  if (!release) {
    return {
      kind: 'no_update',
      reason: 'No release found for runtime',
      policy,
    };
  }

  if (policy) {
    const allowlist = parseJsonArray(policy.allowlistJson);
    const blocklist = parseJsonArray(policy.blocklistJson);
    const eligible = isDeviceEligibleForRollout(
      input.deviceId,
      release.id,
      policy.rolloutPercentage,
      allowlist,
      blocklist,
    );
    if (!eligible) {
      return {
        kind: 'no_update',
        reason: 'Device not in rollout cohort',
        policy,
      };
    }
  }

  return {
    kind: 'update',
    release,
    policy,
  };
}

export function upsertDeviceActivity(input: DeviceUpsertContext): void {
  const db = ensureInitialized();
  const now = new Date().toISOString();
  const app = getOrCreateAppBySlug(input.appSlug);
  db.prepare(
    `
    INSERT INTO devices
    (app_id, device_id, platform, runtime_version, app_version, channel_name, first_seen, last_seen, total_requests)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(app_id, device_id) DO UPDATE SET
      platform = COALESCE(excluded.platform, devices.platform),
      runtime_version = COALESCE(excluded.runtime_version, devices.runtime_version),
      app_version = COALESCE(excluded.app_version, devices.app_version),
      channel_name = COALESCE(excluded.channel_name, devices.channel_name),
      last_seen = excluded.last_seen,
      total_requests = devices.total_requests + 1
    `,
  ).run(
    app.id,
    input.deviceId,
    input.platform ?? null,
    input.runtimeVersion ?? null,
    input.appVersion ?? null,
    input.channelName ?? null,
    now,
    now,
  );
}

export function insertRequestLog(event: DashboardLogEvent): void {
  const db = ensureInitialized();
  const app = getOrCreateAppBySlug(event.appSlug);
  db.prepare(
    `
    INSERT INTO request_logs
    (app_id, timestamp, event_type, request_path, method, status, channel_name, platform, runtime_version, update_id, bundle_path, asset_name, message, ip, user_agent, device_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    app.id,
    event.timestamp,
    event.eventType,
    event.requestPath,
    event.method,
    event.status,
    event.channelName ?? null,
    event.platform ?? null,
    event.runtimeVersion ?? null,
    event.updateId ?? null,
    event.bundlePath ?? null,
    event.assetName ?? null,
    event.message ?? null,
    event.ip ?? null,
    event.userAgent ?? null,
    event.deviceId,
  );

  upsertDeviceActivity({
    appSlug: event.appSlug,
    deviceId: event.deviceId,
    platform: event.platform,
    runtimeVersion: event.runtimeVersion,
    channelName: event.channelName,
    appVersion: event.appVersion,
  });
}

export function insertUpdateAck(event: UpdateAckEvent): void {
  const db = ensureInitialized();
  const app = getOrCreateAppBySlug(event.appSlug);
  const timestamp = new Date().toISOString();
  db.prepare(
    `
    INSERT INTO update_acks
    (app_id, timestamp, device_id, runtime_version, update_id, status, reason, details_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    app.id,
    timestamp,
    event.deviceId,
    event.runtimeVersion ?? null,
    event.updateId ?? null,
    event.status,
    event.reason ?? null,
    event.detailsJson ?? null,
  );

  upsertDeviceActivity({
    appSlug: event.appSlug,
    deviceId: event.deviceId,
    runtimeVersion: event.runtimeVersion,
  });
}

function buildLogWhereClause(filters: LogFilters): { where: string; params: any[] } {
  const where: string[] = [];
  const params: any[] = [];

  if (filters.appSlug) {
    where.push('apps.slug = ?');
    params.push(filters.appSlug);
  }
  if (filters.channelName) {
    where.push('request_logs.channel_name = ?');
    params.push(filters.channelName);
  }
  if (filters.eventType) {
    where.push('request_logs.event_type = ?');
    params.push(filters.eventType);
  }
  if (filters.status) {
    where.push('request_logs.status = ?');
    params.push(filters.status);
  }
  if (filters.search) {
    where.push(
      '(request_logs.device_id LIKE ? OR request_logs.message LIKE ? OR request_logs.runtime_version LIKE ? OR request_logs.update_id LIKE ?)',
    );
    const query = `%${filters.search}%`;
    params.push(query, query, query, query);
  }
  return {
    where: where.length > 0 ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

export function listRequestLogs(filters: LogFilters): {
  total: number;
  page: number;
  pageSize: number;
  items: any[];
} {
  const db = ensureInitialized();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, Math.min(200, filters.pageSize ?? 50));
  const offset = (page - 1) * pageSize;
  const clause = buildLogWhereClause(filters);

  const totalRow = db
    .prepare(
      `
      SELECT COUNT(*) as count
      FROM request_logs
      JOIN apps ON apps.id = request_logs.app_id
      ${clause.where}
      `,
    )
    .get(...clause.params) as { count: number };

  const rows = db
    .prepare(
      `
      SELECT
        request_logs.id,
        request_logs.timestamp,
        request_logs.event_type,
        request_logs.request_path,
        request_logs.method,
        request_logs.status,
        request_logs.channel_name,
        request_logs.platform,
        request_logs.runtime_version,
        request_logs.update_id,
        request_logs.bundle_path,
        request_logs.asset_name,
        request_logs.message,
        request_logs.ip,
        request_logs.user_agent,
        request_logs.device_id,
        apps.slug AS app_slug
      FROM request_logs
      JOIN apps ON apps.id = request_logs.app_id
      ${clause.where}
      ORDER BY request_logs.timestamp DESC
      LIMIT ? OFFSET ?
      `,
    )
    .all(...clause.params, pageSize, offset) as any[];

  return {
    total: totalRow.count,
    page,
    pageSize,
    items: rows,
  };
}

function csvEscape(value: unknown): string {
  const raw = `${value ?? ''}`;
  const safePrefix = /^[\s]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  const text = safePrefix.replace(/"/g, '""');
  return `"${text}"`;
}

export function exportRequestLogsCsv(filters: LogFilters): string {
  const db = ensureInitialized();
  const clause = buildLogWhereClause(filters);
  const rows = db
    .prepare(
      `
      SELECT
        request_logs.id,
        request_logs.timestamp,
        request_logs.event_type,
        request_logs.request_path,
        request_logs.method,
        request_logs.status,
        request_logs.channel_name,
        request_logs.platform,
        request_logs.runtime_version,
        request_logs.update_id,
        request_logs.bundle_path,
        request_logs.asset_name,
        request_logs.message,
        request_logs.ip,
        request_logs.user_agent,
        request_logs.device_id,
        apps.slug AS app_slug
      FROM request_logs
      JOIN apps ON apps.id = request_logs.app_id
      ${clause.where}
      ORDER BY request_logs.timestamp DESC
      `,
    )
    .all(...clause.params) as any[];

  const headers = [
    'id',
    'timestamp',
    'event_type',
    'request_path',
    'method',
    'status',
    'app_slug',
    'channel_name',
    'platform',
    'runtime_version',
    'update_id',
    'bundle_path',
    'asset_name',
    'message',
    'ip',
    'user_agent',
    'device_id',
  ];
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(
      [
        csvEscape(row.id),
        csvEscape(row.timestamp),
        csvEscape(row.event_type),
        csvEscape(row.request_path),
        csvEscape(row.method),
        csvEscape(row.status),
        csvEscape(row.app_slug),
        csvEscape(row.channel_name),
        csvEscape(row.platform),
        csvEscape(row.runtime_version),
        csvEscape(row.update_id),
        csvEscape(row.bundle_path),
        csvEscape(row.asset_name),
        csvEscape(row.message),
        csvEscape(row.ip),
        csvEscape(row.user_agent),
        csvEscape(row.device_id),
      ].join(','),
    );
  }
  return lines.join('\n');
}

export function getDashboardSnapshot(input: { appSlug: string; limit: number }): DashboardSnapshot {
  const db = ensureInitialized();
  const app = getOrCreateAppBySlug(input.appSlug);
  const limit = Math.max(1, Math.min(500, input.limit));

  const summaryRow = db
    .prepare(
      `
      SELECT
        COUNT(*) as total_events,
        SUM(CASE WHEN request_path LIKE '%/manifest%' THEN 1 ELSE 0 END) AS manifest_requests,
        SUM(CASE WHEN request_path LIKE '%/assets%' THEN 1 ELSE 0 END) AS asset_requests,
        SUM(CASE WHEN event_type = 'manifest_update' THEN 1 ELSE 0 END) AS update_responses,
        SUM(CASE WHEN event_type = 'manifest_rollback' THEN 1 ELSE 0 END) AS rollback_responses,
        SUM(CASE WHEN event_type = 'manifest_no_update' THEN 1 ELSE 0 END) AS no_update_responses,
        SUM(CASE WHEN status >= 400 OR event_type LIKE '%error%' THEN 1 ELSE 0 END) AS error_responses
      FROM request_logs
      WHERE app_id = ?
      `,
    )
    .get(app.id) as any;

  const uniqueDevicesRow = db
    .prepare('SELECT COUNT(*) as count FROM devices WHERE app_id = ?')
    .get(app.id) as { count: number };
  const uniqueRuntimeRow = db
    .prepare('SELECT COUNT(DISTINCT runtime_version) as count FROM releases WHERE app_id = ?')
    .get(app.id) as { count: number };
  const totalBundlesRow = db
    .prepare('SELECT COUNT(*) as count FROM releases WHERE app_id = ?')
    .get(app.id) as { count: number };

  const ackSummaryRow = db
    .prepare(
      `
      SELECT
        SUM(CASE WHEN status IN ('applied','downloaded') THEN 1 ELSE 0 END) AS ack_success,
        SUM(CASE WHEN status IN ('failed') THEN 1 ELSE 0 END) AS ack_failures
      FROM update_acks
      WHERE app_id = ?
      `,
    )
    .get(app.id) as any;

  const platformRows = db
    .prepare(
      `
      SELECT platform, COUNT(*) AS count
      FROM request_logs
      WHERE app_id = ?
      GROUP BY platform
      `,
    )
    .all(app.id) as Array<{ platform: string | null; count: number }>;

  const platformBreakdown = {
    ios: 0,
    android: 0,
    unknown: 0,
  };
  for (const row of platformRows) {
    if (row.platform === 'ios') {
      platformBreakdown.ios = row.count;
    } else if (row.platform === 'android') {
      platformBreakdown.android = row.count;
    } else {
      platformBreakdown.unknown += row.count;
    }
  }

  const recentEvents = db
    .prepare(
      `
      SELECT
        request_logs.id,
        request_logs.timestamp,
        request_logs.event_type,
        request_logs.request_path,
        request_logs.status,
        apps.slug AS app_slug,
        request_logs.channel_name,
        request_logs.platform,
        request_logs.runtime_version,
        request_logs.device_id,
        request_logs.message
      FROM request_logs
      JOIN apps ON apps.id = request_logs.app_id
      WHERE request_logs.app_id = ?
      ORDER BY request_logs.timestamp DESC
      LIMIT ?
      `,
    )
    .all(app.id, limit) as any[];

  const recentUpdates = db
    .prepare(
      `
      SELECT
        releases.id,
        apps.slug AS app_slug,
        releases.runtime_version,
        releases.bundle_id,
        releases.created_at,
        releases.is_rollback,
        releases.manifest_id
      FROM releases
      JOIN apps ON apps.id = releases.app_id
      WHERE releases.app_id = ?
      ORDER BY releases.created_at DESC
      LIMIT 50
      `,
    )
    .all(app.id) as any[];

  const devices = db
    .prepare(
      `
      SELECT
        devices.id,
        apps.slug AS app_slug,
        devices.device_id,
        devices.platform,
        devices.runtime_version,
        devices.channel_name,
        devices.app_version,
        devices.first_seen,
        devices.last_seen,
        devices.total_requests
      FROM devices
      JOIN apps ON apps.id = devices.app_id
      WHERE devices.app_id = ?
      ORDER BY devices.last_seen DESC
      LIMIT 50
      `,
    )
    .all(app.id) as any[];

  const recentAuditLogs = db
    .prepare(
      `
      SELECT
        admin_audit_logs.id,
        admin_audit_logs.timestamp,
        admin_audit_logs.actor_username,
        admin_audit_logs.action,
        admin_audit_logs.details_json,
        apps.slug as app_slug
      FROM admin_audit_logs
      JOIN apps ON apps.id = admin_audit_logs.app_id
      WHERE admin_audit_logs.app_id = ?
      ORDER BY admin_audit_logs.timestamp DESC
      LIMIT 50
      `,
    )
    .all(app.id) as any[];

  return {
    summary: {
      totalEvents: summaryRow?.total_events ?? 0,
      uniqueDevices: uniqueDevicesRow.count ?? 0,
      uniqueRuntimeVersions: uniqueRuntimeRow.count ?? 0,
      manifestRequests: summaryRow?.manifest_requests ?? 0,
      assetRequests: summaryRow?.asset_requests ?? 0,
      updateResponses: summaryRow?.update_responses ?? 0,
      rollbackResponses: summaryRow?.rollback_responses ?? 0,
      noUpdateResponses: summaryRow?.no_update_responses ?? 0,
      errorResponses: summaryRow?.error_responses ?? 0,
      totalBundles: totalBundlesRow.count ?? 0,
      ackSuccess: ackSummaryRow?.ack_success ?? 0,
      ackFailures: ackSummaryRow?.ack_failures ?? 0,
    },
    platformBreakdown,
    recentEvents: recentEvents.map((row) => ({
      id: row.id,
      timestamp: row.timestamp,
      eventType: row.event_type,
      requestPath: row.request_path,
      status: row.status,
      appSlug: row.app_slug,
      channelName: row.channel_name,
      platform: row.platform,
      runtimeVersion: row.runtime_version,
      deviceId: row.device_id,
      message: row.message,
    })),
    recentUpdates: recentUpdates.map((row) => ({
      id: row.id,
      appSlug: row.app_slug,
      runtimeVersion: row.runtime_version,
      bundleId: row.bundle_id,
      createdAt: row.created_at,
      isRollback: row.is_rollback === 1,
      manifestId: row.manifest_id,
    })),
    devices: devices.map((row) => ({
      id: row.id,
      appSlug: row.app_slug,
      deviceId: row.device_id,
      platform: row.platform,
      runtimeVersion: row.runtime_version,
      channelName: row.channel_name,
      appVersion: row.app_version,
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
      totalRequests: row.total_requests,
    })),
    recentAuditLogs: recentAuditLogs.map((row) => ({
      id: row.id,
      timestamp: row.timestamp,
      actorUsername: row.actor_username,
      action: row.action,
      appSlug: row.app_slug,
      detailsJson: row.details_json,
    })),
  };
}
