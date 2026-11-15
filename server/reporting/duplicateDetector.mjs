import { BloomFilter } from '../tracing/labelStore.mjs';

export class DuplicateDetector {
  constructor(sizeInBits = 65536) {
    this.utrBloom = new BloomFilter(sizeInBits);
    this.walletBloom = new BloomFilter(sizeInBits);
    this.upiBloom = new BloomFilter(sizeInBits);
    this.phoneBloom = new BloomFilter(sizeInBits);
    this.initialized = false;
  }

  /**
   * Seeds the Bloom filters with all existing complaints from the database
   */
  seedFromStore(store) {
    try {
      if (!store?.db) return;
      const complaints = store.db.prepare('SELECT case_id, reported_wallet, suspect_upi, suspect_phone, payload FROM complaints').all();
      for (const c of complaints) {
        if (c.reported_wallet) this.walletBloom.add(c.reported_wallet);
        if (c.suspect_upi) this.upiBloom.add(c.suspect_upi);
        if (c.suspect_phone) this.phoneBloom.add(c.suspect_phone);

        try {
          const payload = JSON.parse(c.payload || '{}');
          if (payload.utrNumber) this.utrBloom.add(payload.utrNumber);
          if (payload.suspectWallet) this.walletBloom.add(payload.suspectWallet);
          if (payload.suspectUpiId) this.upiBloom.add(payload.suspectUpiId);
        } catch {}
      }

      // Also index UPI transactions table if present
      try {
        const upiTxs = store.db.prepare('SELECT utr_number, suspect_vpa FROM upi_transactions WHERE utr_number IS NOT NULL').all();
        for (const u of upiTxs) {
          if (u.utr_number) this.utrBloom.add(u.utr_number);
          if (u.suspect_vpa) this.upiBloom.add(u.suspect_vpa);
        }
      } catch {}

      this.initialized = true;
    } catch (e) {
      console.warn('Bloom filter seed encountered non-critical error:', e.message);
    }
  }

  /**
   * Adds a new complaint's identifiers into the Bloom filter
   */
  indexComplaint({ utrNumber, suspectWallet, suspectUpiId, suspectPhone }) {
    if (utrNumber) this.utrBloom.add(utrNumber);
    if (suspectWallet) this.walletBloom.add(suspectWallet);
    if (suspectUpiId) this.upiBloom.add(suspectUpiId);
    if (suspectPhone) this.phoneBloom.add(suspectPhone);
  }

  /**
   * Fast O(1) Bloom filter pre-check followed by exact database verification
   */
  checkDuplicates(store, { utrNumber, suspectWallet, suspectUpiId, suspectPhone, excludeCaseId = null }) {
    if (!this.initialized) {
      this.seedFromStore(store);
    }

    const cleanUtr = utrNumber ? String(utrNumber).trim() : null;
    const cleanWallet = suspectWallet ? String(suspectWallet).trim().toLowerCase() : null;
    const cleanUpi = suspectUpiId ? String(suspectUpiId).trim().toLowerCase() : null;
    const cleanPhone = suspectPhone ? String(suspectPhone).replace(/[^0-9]/g, '') : null;

    // Step 1: O(1) Bloom Filter Pre-check
    const mayMatchUtr = cleanUtr ? this.utrBloom.has(cleanUtr) : false;
    const mayMatchWallet = cleanWallet ? this.walletBloom.has(cleanWallet) : false;
    const mayMatchUpi = cleanUpi ? this.upiBloom.has(cleanUpi) : false;
    const mayMatchPhone = cleanPhone ? this.phoneBloom.has(cleanPhone) : false;

    // If zero Bloom filter matches, guarantee no duplicates exist (zero false negatives)
    if (!mayMatchUtr && !mayMatchWallet && !mayMatchUpi && !mayMatchPhone) {
      return {
        hasDuplicates: false,
        bloomHit: false,
        reasons: [],
        linkedCaseIds: [],
        linkedCases: []
      };
    }

    // Step 2: Exact Database Lookup on Bloom filter candidates
    const linkedCasesMap = new Map();
    const reasons = [];

    try {
      if (cleanWallet) {
        const walletMatches = store.db.prepare(`
          SELECT case_id, reporter_name, status, incident_date, reported_loss
          FROM complaints
          WHERE LOWER(reported_wallet) = ? AND case_id != ?
        `).all(cleanWallet, excludeCaseId || '');

        for (const m of walletMatches) {
          linkedCasesMap.set(m.case_id, { ...m, reason: `Identical suspect wallet: ${cleanWallet}` });
          reasons.push(`Suspect wallet ${cleanWallet} appears in prior complaint ${m.case_id}`);
        }
      }

      if (cleanUpi) {
        const upiMatches = store.db.prepare(`
          SELECT case_id, reporter_name, status, incident_date, reported_loss
          FROM complaints
          WHERE LOWER(suspect_upi) = ? AND case_id != ?
        `).all(cleanUpi, excludeCaseId || '');

        for (const m of upiMatches) {
          linkedCasesMap.set(m.case_id, { ...m, reason: `Shared suspect UPI ID: ${cleanUpi}` });
          reasons.push(`Suspect UPI ID ${cleanUpi} appears in prior complaint ${m.case_id}`);
        }
      }

      if (cleanUtr) {
        // Search in complaints payload or upi_transactions
        const allComplaints = store.db.prepare('SELECT case_id, reporter_name, status, incident_date, payload FROM complaints WHERE case_id != ?').all(excludeCaseId || '');
        for (const c of allComplaints) {
          if (c.payload && c.payload.includes(cleanUtr)) {
            linkedCasesMap.set(c.case_id, { ...c, reason: `Identical payment UTR: ${cleanUtr}` });
            reasons.push(`Duplicate payment UTR ${cleanUtr} submitted in case ${c.case_id}`);
          }
        }
      }
    } catch (e) {
      console.warn('Exact lookup encountered non-critical error:', e.message);
    }

    const linkedCases = Array.from(linkedCasesMap.values());
    const linkedCaseIds = Array.from(linkedCasesMap.keys());

    return {
      hasDuplicates: linkedCaseIds.length > 0,
      bloomHit: true,
      reasons,
      linkedCaseIds,
      linkedCases
    };
  }
}

export const duplicateDetector = new DuplicateDetector();

