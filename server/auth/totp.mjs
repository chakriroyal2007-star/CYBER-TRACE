import { createHmac, randomBytes } from 'node:crypto';

// Base32 alphabet (RFC 4648)
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

export function base32Decode(base32) {
  const clean = base32.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];

  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Generate a new random secret key for TOTP enrollment
 */
export function generateTotpSecret(length = 20) {
  const random = randomBytes(length);
  return base32Encode(random);
}

/**
 * Computes the 6-digit TOTP code for a given secret and counter
 */
export function computeTotp(secret, timeStep = Math.floor(Date.now() / 1000 / 30)) {
  const key = base32Decode(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(timeStep), 0);

  const hmac = createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  ) % 1000000;

  return code.toString().padStart(6, '0');
}

/**
 * Verifies a 6-digit TOTP code against a secret key with time drift tolerance
 */
export function verifyTotp(arg1, arg2, window = 1) {
  if (!arg1 || !arg2) return false;
  // Gracefully handle either (inputCode, secret) or (secret, inputCode)
  let inputCode = String(arg1).trim();
  let secret = String(arg2).trim();
  if (/^\d{6}$/.test(secret) && !/^\d{6}$/.test(inputCode)) {
    const tmp = inputCode;
    inputCode = secret;
    secret = tmp;
  }
  if (!/^\d{6}$/.test(inputCode)) return false;

  const currentStep = Math.floor(Date.now() / 1000 / 30);
  for (let drift = -window; drift <= window; drift++) {
    const valid = computeTotp(secret, currentStep + drift);
    if (valid === inputCode) return true;
  }
  return false;
}

/**
 * Builds standard otpauth:// URL for QR code generation
 */
export function getTotpUri(secret, accountName, issuer = 'CYBER-TRACE India') {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(accountName);
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

export const generateTotpUri = getTotpUri;
