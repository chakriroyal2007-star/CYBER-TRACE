import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;
const MAX_MEM = 64 * 1024 * 1024;

/**
 * Validates password strength policy (Min 12 characters)
 */
export function validatePasswordPolicy(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required.' };
  }
  if (password.length < 12) {
    return { valid: false, message: 'Password must be at least 12 characters long.' };
  }
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const criteriaMet = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;
  if (criteriaMet < 3) {
    return {
      valid: false,
      message: 'Password must include at least 3 of: uppercase letters, lowercase letters, numbers, and symbols.'
    };
  }

  return { valid: true };
}

/**
 * Checks HaveIBeenPwned k-Anonymity API for breached passwords
 */
export async function checkPwnedPassword(password) {
  try {
    const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'CYBER-TRACE-Security-Audit' }
    });
    clearTimeout(timeout);

    if (!res.ok) return { breached: false, count: 0 };
    const text = await res.text();
    const lines = text.split('\r\n');

    for (const line of lines) {
      const [hashSuffix, countStr] = line.split(':');
      if (hashSuffix === suffix) {
        return { breached: true, count: parseInt(countStr, 10) };
      }
    }
    return { breached: false, count: 0 };
  } catch {
    // Graceful degradation when offline or unconfigured
    return { breached: false, count: 0 };
  }
}

/**
 * Hashes password using high-work-factor scrypt with unique salt
 */
export function hashPasswordSecure(password, salt = null) {
  const saltBuf = salt ? Buffer.from(salt, 'hex') : randomBytes(16);
  const derived = scryptSync(password, saltBuf, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: MAX_MEM
  });
  return `scrypt$${SCRYPT_N}$${saltBuf.toString('hex')}$${derived.toString('hex')}`;
}

/**
 * Constant-time verification of password against stored hash (scrypt or legacy sha256)
 */
export function verifyPasswordSecure(password, storedHash) {
  if (!password || !storedHash) return false;

  if (storedHash.startsWith('scrypt$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 4) return false;
    const [, nStr, saltHex, hashHex] = parts;
    const saltBuf = Buffer.from(saltHex, 'hex');
    const expectedBuf = Buffer.from(hashHex, 'hex');

    const derived = scryptSync(password, saltBuf, expectedBuf.length, {
      N: parseInt(nStr, 10),
      r: SCRYPT_R,
      p: SCRYPT_P,
      maxmem: MAX_MEM
    });

    return timingSafeEqual(derived, expectedBuf);
  }

  // Legacy SHA-256 fallback compatibility for existing test sessions
  const legacySalt = 'ct-salt-2026';
  const legacyHash = createHash('sha256').update(`${legacySalt}:${password}`).digest('hex');
  const bufA = Buffer.from(legacyHash, 'hex');
  const bufB = Buffer.from(storedHash, 'hex');
  if (bufA.length === bufB.length && timingSafeEqual(bufA, bufB)) {
    return true;
  }

  return false;
}
