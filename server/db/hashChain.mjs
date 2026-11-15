import { createHash } from 'node:crypto';

export const GENESIS_HASH = '0'.repeat(64);

/**
 * Calculates cryptographic SHA-256 hash for an audit log entry chained to previous hash
 */
export function computeAuditEntryHash(prevHash, id, timestamp, userId, action, object, metadata) {
  const metaStr = typeof metadata === 'string' ? metadata : JSON.stringify(metadata || {});
  const payload = `${prevHash || GENESIS_HASH}:${id}:${timestamp}:${userId || ''}:${action}:${object}:${metaStr}`;
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * Verifies the integrity of an append-only audit log chain
 * Returns { valid: boolean, totalEntries: number, error?: string, tamperedEntryId?: string }
 */
export function verifyAuditChain(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { valid: true, totalEntries: 0 };
  }

  // Ensure entries are ordered chronologically by timestamp/sequence
  const sorted = [...entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  let expectedPrevHash = GENESIS_HASH;

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];

    // Check previous hash link
    if (entry.prev_hash && entry.prev_hash !== expectedPrevHash) {
      return {
        valid: false,
        totalEntries: sorted.length,
        tamperedIndex: i,
        brokenAtIndex: i,
        tamperedEntryId: entry.id,
        error: `Broken chain link at entry ${entry.id}: prev_hash does not match preceding entry's hash.`
      };
    }

    // Recompute current entry hash
    const recomputed = computeAuditEntryHash(
      entry.prev_hash || expectedPrevHash,
      entry.id,
      entry.timestamp,
      entry.user_id,
      entry.action,
      entry.object,
      entry.metadata
    );

    if (entry.entry_hash && entry.entry_hash !== recomputed) {
      return {
        valid: false,
        totalEntries: sorted.length,
        tamperedIndex: i,
        brokenAtIndex: i,
        tamperedEntryId: entry.id,
        error: `Payload tamper detected at entry ${entry.id}: signature mismatch.`
      };
    }

    expectedPrevHash = entry.entry_hash || recomputed;
  }

  return {
    valid: true,
    totalEntries: sorted.length,
    headHash: expectedPrevHash,
    verifiedAt: new Date().toISOString()
  };
}
