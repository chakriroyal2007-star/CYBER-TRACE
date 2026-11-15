import pg from 'pg';
import { DatabaseStore } from '../db.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class PostgresRepository {
  constructor(connectionString) {
    this.pool = new pg.Pool({
      connectionString: connectionString || process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });
  }

  async init() {
    const schemaFile = resolve(__dirname, 'postgres_schema.sql');
    if (existsSync(schemaFile)) {
      const sql = readFileSync(schemaFile, 'utf8');
      await this.pool.query(sql);
    }
  }

  async close() {
    await this.pool.end();
  }

  async query(text, params = []) {
    return this.pool.query(text, params);
  }

  async getSession(tokenHash) {
    const res = await this.pool.query(
      `SELECT s.*, u.display_name, u.role, u.id AS user_id, su.email, su.phone, su.agency, su.badge_number, su.unit, su.status
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN system_users su ON su.id = u.id
       WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
      [tokenHash]
    );
    return res.rows[0] || null;
  }

  async createSession({ id, tokenHash, userId, displayName, role, expiresAt, weights }) {
    await this.pool.query(
      `INSERT INTO users (id, display_name, role, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (id) DO UPDATE SET display_name = $2, role = $3`,
      [userId, displayName, role]
    );

    await this.pool.query(
      `INSERT INTO sessions (id, token_hash, user_id, created_at, expires_at, weights)
       VALUES ($1, $2, $3, NOW(), $4, $5)`,
      [id, tokenHash, userId, expiresAt, JSON.stringify(weights || {})]
    );
  }

  async insertAudit({ id, sessionId, timestamp, userId, action, object, metadata, prevHash, entryHash }) {
    await this.pool.query(
      `INSERT INTO audit_logs (id, session_id, timestamp, user_id, action, object, metadata, prev_hash, entry_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, sessionId, timestamp, userId, action, String(object), JSON.stringify(metadata || {}), prevHash, entryHash]
    );
  }

  async getAudits(sessionId, limit = 500) {
    const res = await this.pool.query(
      `SELECT a.id, a.timestamp, u.display_name AS user, a.action, a.object, a.metadata, a.prev_hash, a.entry_hash
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.session_id = $1 OR $1 IS NULL
       ORDER BY a.timestamp DESC LIMIT $2`,
      [sessionId, limit]
    );
    return res.rows.map(r => ({ ...r, metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata }));
  }

  async getAllAuditChain() {
    const res = await this.pool.query(
      `SELECT id, timestamp, user_id, action, object, metadata, prev_hash, entry_hash
       FROM audit_logs
       ORDER BY timestamp ASC`
    );
    return res.rows;
  }
}

let activeRepository = null;

export function getRepository(sqliteStore = null) {
  if (activeRepository) return activeRepository;

  if (process.env.DATABASE_URL) {
    try {
      activeRepository = new PostgresRepository(process.env.DATABASE_URL);
      return activeRepository;
    } catch (err) {
      console.warn('[DB] Failed to initialize PostgreSQL repository, falling back to SQLite:', err.message);
    }
  }

  // Fallback to SQLite store
  activeRepository = sqliteStore || new DatabaseStore();
  return activeRepository;
}

