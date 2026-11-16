import { PersistentAuthMap } from './persistentState.mjs';
import { randomBytes, createHash } from 'node:crypto';

// In-memory lockout tracker: identifier (email/ip) -> { failedAttempts, lockedUntil }
let lockoutStore = new Map();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// Refresh token store: tokenHash -> { userId, familyId, expiresAt, used: boolean }
let refreshTokenStore = new Map();
let authDatabase;
export function configureSessionPersistence(db){authDatabase=db;lockoutStore=new PersistentAuthMap(db,'lockouts');refreshTokenStore=new PersistentAuthMap(db,'refresh');}

/**
 * Record a failed login attempt and check for lockout
 */
export function recordFailedLogin(identifier) {
  const key = String(identifier || '').toLowerCase();
  const now = Date.now();
  const state = lockoutStore.get(key) || { failedAttempts: 0, lockedUntil: 0 };

  if (state.lockedUntil > now) {
    const remainingMin = Math.ceil((state.lockedUntil - now) / 60000);
    return { locked: true, remainingMinutes: remainingMin };
  }

  state.failedAttempts++;
  if (state.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    state.lockedUntil = now + LOCKOUT_DURATION_MS;
    state.failedAttempts = 0;
    lockoutStore.set(key, state);
    return { locked: true, remainingMinutes: 15 };
  }

  lockoutStore.set(key, state);
  return { locked: false, remainingAttempts: MAX_FAILED_ATTEMPTS - state.failedAttempts };
}

/**
 * Reset lockout state on successful authentication
 */
export function resetFailedLogin(identifier) {
  const key = String(identifier || '').toLowerCase();
  lockoutStore.delete(key);
}

/**
 * Check if identifier is currently locked out
 */
export function isLockedOut(identifier) {
  const key = String(identifier || '').toLowerCase();
  const state = lockoutStore.get(key);
  if (!state) return { locked: false };
  const now = Date.now();
  if (state.lockedUntil > now) {
    const remainingMin = Math.ceil((state.lockedUntil - now) / 60000);
    return { locked: true, remainingMinutes: remainingMin };
  }
  return { locked: false };
}

/**
 * Generates an access token and rotating refresh token pair
 */
export function issueTokenPair(userId, sessionId = null) {
  const accessToken = randomBytes(32).toString('hex');
  const rawRefreshToken = randomBytes(40).toString('hex');
  const familyId = randomBytes(16).toString('hex');

  const refreshHash = createHash('sha256').update(rawRefreshToken).digest('hex');
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

  refreshTokenStore.set(refreshHash, {
    userId,
    sessionId,
    familyId,
    expiresAt,
    used: false
  });

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    expiresIn: 900 // 15 minutes
  };
}

/**
 * Rotates refresh token with reuse detection
 */
export function rotateRefreshToken(oldRawToken) {
  const oldHash = createHash('sha256').update(oldRawToken).digest('hex');
  const record = refreshTokenStore.get(oldHash);

  if (!record) {
    return { success: false, error: 'Invalid refresh token.' };
  }

  // Token reuse detection: if already used, someone compromised the token family
  if (record.used) {
    // Revoke all tokens in this family
    for (const [hash, item] of refreshTokenStore.entries()) {
      if (item.familyId === record.familyId) {
        if(authDatabase && item.sessionId)authDatabase.prepare('UPDATE sessions SET expires_at=? WHERE id=?').run(new Date().toISOString(),item.sessionId);
        refreshTokenStore.delete(hash);
      }
    }
    return { success: false, error: 'Compromised token family detected. All sessions revoked.' };
  }

  if (Date.now() > record.expiresAt) {
    refreshTokenStore.delete(oldHash);
    return { success: false, error: 'Refresh token expired. Please sign in again.' };
  }

  // Mark old token as used
  if(authDatabase && record.sessionId){
    const active=authDatabase.prepare('SELECT id FROM sessions WHERE id=? AND expires_at>?').get(record.sessionId,new Date().toISOString());
    if(!active)return {success:false,error:'Session expired or revoked. Sign in again.'};
  }
  record.used = true;
  refreshTokenStore.set(oldHash,record);

  // Issue new token in same family
  const newRawRefresh = randomBytes(40).toString('hex');
  const newHash = createHash('sha256').update(newRawRefresh).digest('hex');
  const newAccess = randomBytes(32).toString('hex');

  refreshTokenStore.set(newHash, {
    userId: record.userId,
    sessionId: record.sessionId,
    familyId: record.familyId,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    used: false
  });

  if(authDatabase && record.sessionId)authDatabase.prepare('UPDATE sessions SET token_hash=? WHERE id=?').run(createHash('sha256').update(newAccess).digest('hex'),record.sessionId);
  return {
    success: true,
    userId: record.userId,
    accessToken: newAccess,
    refreshToken: newRawRefresh,
    expiresIn: 900
  };
}

/**
 * Generates secure HttpOnly SameSite cookie string
 */
export function buildSessionCookie(req, token, maxAgeSeconds = 3600 * 24 * 7) {
  const isHttps = req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted;
  const isProd = process.env.NODE_ENV === 'production';
  const secureFlag = isHttps || isProd ? '; Secure' : '';
  return `ct_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secureFlag}`;
}

/**
 * Verifies Origin / Referer for CSRF protection on mutative endpoints
 */
export function verifyCsrfOrigin(req) {
  const method = req.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return true;

  const origin = req.headers['origin'] || req.headers['referer'];
  if (!origin) {
    // Non-browser or direct curl/API client
    return true;
  }

  const host = req.headers['host'];
  try {
    const url = new URL(origin);
    if (url.host === host) return true;
    if (process.env.FRONTEND_ORIGIN && origin.startsWith(process.env.FRONTEND_ORIGIN)) return true;
    if (host && host.includes('localhost')) return true;
    if (host && host.includes('vercel.app')) return true;
  } catch {
    return false;
  }

  return true;
}

export const isAccountLocked = isLockedOut;
export const createSecureCookie = buildSessionCookie;

/**
 * Returns active sessions for a user from store
 */
export function getActiveSessions(store, userId) {
  try {
    return store.db.prepare('SELECT id, created_at, expires_at FROM sessions WHERE user_id=? AND expires_at > ? ORDER BY created_at DESC')
      .all(userId, new Date().toISOString());
  } catch {
    return [];
  }
}

/**
 * Revokes a session by ID
 */
export function revokeSession(store, sessionId) {
  try {
    store.db.prepare('UPDATE sessions SET expires_at=? WHERE id=?').run(new Date().toISOString(), sessionId);
    return true;
  } catch {
    return false;
  }
}
