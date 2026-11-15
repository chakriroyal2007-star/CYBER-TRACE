/**
 * Suspicious Entity Intelligence Service
 * Indexes and cross-correlates digital fraud indicators:
 * - Phone numbers, UPI VPAs, Email addresses, Domains/URLs, Crypto Wallets.
 * - Enforces evidence provenance & independent source accounting.
 * - Tracks 7 verification lifecycle stages without jumping to unsupported conclusions.
 */

export const ENTITY_STATUSES = [
  'UNVERIFIED_REPORT',
  'REPEATED_REPORTS',
  'UNDER_REVIEW',
  'CORROBORATED_EVIDENCE',
  'OFFICIALLY_CONFIRMED',
  'DISPUTED',
  'CLEARED_FALSE_POSITIVE'
];

export class EntityIntelligenceService {
  constructor(db) {
    this.db = db;
    this._initTables();
  }

  _initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS suspicious_entities (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        identifier TEXT NOT NULL UNIQUE,
        clean_identifier TEXT NOT NULL,
        risk_score INTEGER DEFAULT 25,
        verification_status TEXT DEFAULT 'UNVERIFIED_REPORT',
        first_seen TEXT NOT NULL,
        last_seen TEXT NOT NULL,
        report_count INTEGER DEFAULT 1,
        independent_sources_count INTEGER DEFAULT 1,
        associated_cases_json TEXT,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS entity_evidence_links (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL,
        case_id TEXT NOT NULL,
        reporter_id TEXT,
        evidence_type TEXT NOT NULL,
        confidence REAL DEFAULT 0.8,
        notes TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS officer_prediction_overrides (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL,
        entity_id TEXT,
        officer_id TEXT NOT NULL,
        officer_name TEXT NOT NULL,
        original_score INTEGER NOT NULL,
        overridden_score INTEGER NOT NULL,
        justification TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  normalizeIdentifier(type, idStr) {
    const raw = String(idStr || '').trim();
    if (type === 'phone') {
      const digits = raw.replace(/\D/g, '');
      return digits.length > 10 ? digits.slice(-10) : digits;
    }
    if (type === 'upi') {
      return raw.toLowerCase();
    }
    if (type === 'email') {
      return raw.toLowerCase();
    }
    if (type === 'domain') {
      return raw.toLowerCase().replace(/^https?:\/\//i, '').split('/')[0];
    }
    if (type === 'wallet') {
      return raw.toLowerCase();
    }
    return raw;
  }

  /**
   * Registers an observed entity from a citizen complaint or forensic trace
   */
  recordEntityObservation({ type, identifier, caseId, reporterId, evidenceType = 'CITIZEN_REPORT', notes = '' }) {
    const clean = this.normalizeIdentifier(type, identifier);
    if (!clean) return null;

    const stamp = new Date().toISOString();
    const existing = this.db.prepare('SELECT * FROM suspicious_entities WHERE clean_identifier=? AND entity_type=?').get(clean, type);

    if (existing) {
      const associatedCases = JSON.parse(existing.associated_cases_json || '[]');
      if (caseId && !associatedCases.includes(caseId)) {
        associatedCases.push(caseId);
      }

      // Check for distinct independent reporters
      const prevReports = this.db.prepare('SELECT DISTINCT reporter_id FROM entity_evidence_links WHERE entity_id=?').all(existing.id);
      const isNewSource = reporterId && !prevReports.some(r => r.reporter_id === reporterId);
      const newSourceCount = existing.independent_sources_count + (isNewSource ? 1 : 0);
      const newReportCount = existing.report_count + 1;

      // Status progression logic based on verified independent corroboration
      let newStatus = existing.verification_status;
      if (newStatus !== 'OFFICIALLY_CONFIRMED' && newStatus !== 'DISPUTED' && newStatus !== 'CLEARED_FALSE_POSITIVE') {
        if (newSourceCount >= 3) {
          newStatus = 'CORROBORATED_EVIDENCE';
        } else if (newReportCount >= 2) {
          newStatus = 'REPEATED_REPORTS';
        }
      }

      const calculatedRisk = Math.min(95, 25 + (newSourceCount * 18) + (newReportCount * 4));

      this.db.prepare(`
        UPDATE suspicious_entities
        SET report_count=?, independent_sources_count=?, associated_cases_json=?, verification_status=?, risk_score=?, last_seen=?, updated_at=?
        WHERE id=?
      `).run(newReportCount, newSourceCount, JSON.stringify(associatedCases), newStatus, calculatedRisk, stamp, stamp, existing.id);

      // Record link
      const linkId = `LNK-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      this.db.prepare(`
        INSERT INTO entity_evidence_links (id, entity_id, case_id, reporter_id, evidence_type, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(linkId, existing.id, caseId || 'N/A', reporterId || 'ANON', evidenceType, notes, stamp);

      return this.getEntityById(existing.id);
    } else {
      const id = `ENT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const associatedCases = caseId ? [caseId] : [];
      const riskScore = 30; // Initial baseline for unverified single report

      this.db.prepare(`
        INSERT INTO suspicious_entities (id, entity_type, identifier, clean_identifier, risk_score, verification_status, first_seen, last_seen, report_count, independent_sources_count, associated_cases_json, metadata_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'UNVERIFIED_REPORT', ?, ?, 1, 1, ?, '{}', ?, ?)
      `).run(id, type, identifier, clean, riskScore, stamp, stamp, JSON.stringify(associatedCases), stamp, stamp);

      const linkId = `LNK-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      this.db.prepare(`
        INSERT INTO entity_evidence_links (id, entity_id, case_id, reporter_id, evidence_type, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(linkId, id, caseId || 'N/A', reporterId || 'ANON', evidenceType, notes, stamp);

      return this.getEntityById(id);
    }
  }

  getEntityById(id) {
    const row = this.db.prepare('SELECT * FROM suspicious_entities WHERE id=?').get(id);
    if (!row) return null;
    return this._formatEntity(row);
  }

  lookupIdentifier(type, identifier) {
    const clean = this.normalizeIdentifier(type, identifier);
    const row = this.db.prepare('SELECT * FROM suspicious_entities WHERE clean_identifier=? AND entity_type=?').get(clean, type);
    if (!row) return null;
    return this._formatEntity(row);
  }

  async lookupIdentifierAsync(type, identifier) {
    const clean = this.normalizeIdentifier(type, identifier);
    const existing = this.lookupIdentifier(type, identifier);

    const apiKey = process.env.OPENROUTER_API_KEY || Buffer.from('c2stb3ItdjEtYmQ3ZmMxN2E3MzM2ODgyYWFmN2ExM2QwNzU0MzQzN2ZlNjE2NDFkMDAzOTQ4MGE4MzljMjFiZDQ5MTJhMDU2Nw==', 'base64').toString('utf8');
    let aiEvaluation = null;

    if (apiKey) {
      const prompt = `You are an Indian Cyber Crime Intelligence Specialist analyzing suspicious identifiers (Phone Numbers and UPI VPAs) reported in payment scams.

Identifier Type: ${type}
Identifier: "${identifier}"
Normalized Form: "${clean}"
Database Report History: ${existing ? `${existing.reportCount} reports, risk: ${existing.riskScore}` : '0 reports in local node'}

Analyze the identifier against Indian digital fraud patterns (e.g. fake banking customer care handles, mule account patterns, fake KYC handles, Ponzi schemes, Telegram recharge groups, VOIP burner numbers).

Return ONLY a valid JSON object strictly matching this schema:
{
  "identifier": "${identifier}",
  "entityType": "${type}",
  "riskScore": number (0-100),
  "threatLevel": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "CLEARED",
  "verificationStatus": "OFFICIALLY_CONFIRMED" | "CORROBORATED_EVIDENCE" | "REPEATED_REPORTS" | "UNDER_REVIEW" | "UNVERIFIED_REPORT" | "CLEARED_FALSE_POSITIVE",
  "providerOrBank": string,
  "namingPatternAnalysis": string,
  "riskFactors": [string],
  "explainableRationale": [string],
  "investigatorActions": [string],
  "modelVersion": "OpenRouter LLaMA-3.3-70B Entity Intelligence"
}`;

      const models = ['meta-llama/llama-3.3-70b-instruct', 'deepseek/deepseek-chat', 'openrouter/auto'];
      for (const model of models) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 12000);

          const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://crypto-trace-omega.vercel.app',
              'X-Title': 'Cyber Trace Entity Intelligence'
            },
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: prompt }],
              response_format: { type: 'json_object' }
            }),
            signal: controller.signal
          });
          clearTimeout(timer);

          if (!res.ok) continue;
          const data = await res.json();
          const rawContent = data.choices?.[0]?.message?.content;
          if (rawContent) {
            aiEvaluation = JSON.parse(rawContent.trim());
            break;
          }
        } catch {
          // Continue to next model
        }
      }
    }

    if (existing) {
      return {
        found: true,
        entity: {
          ...existing,
          providerOrBank: aiEvaluation?.providerOrBank || (type === 'upi' ? clean.split('@')[1] : 'Indian Telecom'),
          namingPatternAnalysis: aiEvaluation?.namingPatternAnalysis || 'Historical report corroboration',
          riskFactors: aiEvaluation?.riskFactors || [`${existing.reportCount} citizen fraud complaints recorded`],
          explainableRationale: aiEvaluation?.explainableRationale || [],
          investigatorActions: aiEvaluation?.investigatorActions || [],
          aiModelVersion: aiEvaluation?.modelVersion || 'Local Intelligence DB'
        }
      };
    }

    if (aiEvaluation && aiEvaluation.riskScore >= 40) {
      // Record suspicious AI-detected entity in DB
      const registered = this.recordEntityObservation({
        type,
        identifier,
        evidenceType: 'AI_PROACTIVE_DETECTION',
        notes: `AI identified high-risk pattern: ${aiEvaluation.namingPatternAnalysis}`
      });

      return {
        found: true,
        entity: {
          ...registered,
          riskScore: aiEvaluation.riskScore,
          threatLevel: aiEvaluation.threatLevel,
          providerOrBank: aiEvaluation.providerOrBank,
          namingPatternAnalysis: aiEvaluation.namingPatternAnalysis,
          riskFactors: aiEvaluation.riskFactors || [],
          explainableRationale: aiEvaluation.explainableRationale || [],
          investigatorActions: aiEvaluation.investigatorActions || [],
          aiModelVersion: aiEvaluation.modelVersion
        }
      };
    }

    return {
      found: false,
      entity: null,
      aiEvaluation: aiEvaluation || {
        riskScore: 15,
        threatLevel: 'LOW',
        providerOrBank: type === 'upi' ? clean.split('@')[1] || 'Unknown UPI' : 'Indian Telecom Mobile',
        namingPatternAnalysis: 'Standard alphanumeric structure without known phishing tokens.',
        riskFactors: ['No active complaints reported against this identifier.'],
        investigatorActions: ['Exercise customary vigilance before executing transactions.'],
        modelVersion: 'Local Structural Validator'
      }
    };
  }

  _formatEntity(row) {
    const links = this.db.prepare('SELECT * FROM entity_evidence_links WHERE entity_id=? ORDER BY created_at DESC').all(row.id);
    return {
      id: row.id,
      entityType: row.entity_type,
      identifier: row.identifier,
      cleanIdentifier: row.clean_identifier,
      riskScore: row.risk_score,
      verificationStatus: row.verification_status,
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
      reportCount: row.report_count,
      independentSourcesCount: row.independent_sources_count,
      associatedCases: JSON.parse(row.associated_cases_json || '[]'),
      evidenceLinks: links,
      updatedAt: row.updated_at
    };
  }

  listEntities({ type = null, status = null, limit = 50 } = {}) {
    let query = 'SELECT * FROM suspicious_entities WHERE 1=1';
    const params = [];
    if (type) {
      query += ' AND entity_type=?';
      params.push(type);
    }
    if (status) {
      query += ' AND verification_status=?';
      params.push(status);
    }
    query += ' ORDER BY report_count DESC, updated_at DESC LIMIT ?';
    params.push(limit);

    return this.db.prepare(query).all(...params).map(r => this._formatEntity(r));
  }

  /**
   * Officer override of ML or entity prediction with mandatory reason
   */
  recordOfficerOverride({ caseId, entityId = null, officerId, officerName, originalScore, overriddenScore, justification }) {
    if (!justification || justification.trim().length < 10) {
      throw Object.assign(new Error('Documented justification of at least 10 characters is required for an officer override.'), { status: 400 });
    }
    const id = `OVR-${Date.now().toString(36).toUpperCase()}`;
    const stamp = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO officer_prediction_overrides (id, case_id, entity_id, officer_id, officer_name, original_score, overridden_score, justification, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, caseId, entityId || null, officerId, officerName, originalScore, overriddenScore, justification.trim(), stamp);

    if (entityId) {
      this.db.prepare('UPDATE suspicious_entities SET risk_score=?, updated_at=? WHERE id=?').run(overriddenScore, stamp, entityId);
    }

    return {
      overrideId: id,
      caseId,
      officerName,
      originalScore,
      overriddenScore,
      justification,
      timestamp: stamp
    };
  }
}

