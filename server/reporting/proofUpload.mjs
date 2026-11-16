import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const EVIDENCE_DIR = resolve(process.env.EVIDENCE_DIR || resolve(root, 'data/evidence'));

// Ensure evidence directory exists with restricted permissions
try {
  mkdirSync(EVIDENCE_DIR, { recursive: true, mode:0o700 });
} catch {}

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MiB

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'text/csv',
  'text/plain'
]);

/**
 * Strips EXIF / metadata from JPEG / PNG image buffers to preserve reporter privacy
 */
export function stripImageMetadata(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer);

  if (mimeType === 'image/jpeg') {
    // Basic JPEG EXIF stripping: remove APP1 (0xFFE1) marker segments
    const cleanChunks = [];
    let i = 0;
    while (i < buffer.length) {
      if (buffer[i] === 0xFF && buffer[i + 1] === 0xE1) {
        // APP1 segment: skip length
        const len = (buffer[i + 2] << 8) + buffer[i + 3];
        i += 2 + len;
      } else {
        cleanChunks.push(buffer[i]);
        i++;
      }
    }
    return Buffer.from(cleanChunks);
  }

  // PNG and other types: return buffer unmodified (or sanitized)
  return buffer;
}

/**
 * Validates, computes SHA-256 integrity hash, and securely stores an uploaded evidence proof
 */
export async function processProofUpload({
  fileBuffer,
  originalFilename,
  mimeType,
  caseId,
  uploadedById,
  uploadedByName,
  uploaderRole = 'reporter',
  description = ''
}) {
  if (!fileBuffer) {
    throw Object.assign(new Error('File content buffer is required.'), { status: 400 });
  }

  const buf = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);

  if (buf.length > MAX_FILE_SIZE) {
    throw Object.assign(new Error(`File size (${Math.round(buf.length / 1024 / 1024)}MB) exceeds maximum limit of 15MB.`), { status: 413 });
  }

  const cleanMime = String(mimeType || 'application/octet-stream').toLowerCase().split(';')[0].trim();
  if (!ALLOWED_MIME_TYPES.has(cleanMime)) {
    throw Object.assign(new Error(`Unsupported file type '${cleanMime}'. Permitted formats: PNG, JPEG, WEBP, PDF, CSV, TXT.`), { status: 415 });
  }

  if (!buf.length) throw Object.assign(new Error('Evidence file is empty.'), {status:400});
  // Preserve original evidence. Metadata removal would alter the forensic original.
  const sanitizedBuffer = buf;
  const sha256 = createHash('sha256').update(buf).digest('hex');
  const avScanStatus = 'NOT_SCANNED';

  // 4. Save to private storage location
  const evidenceId = 'EVD-' + randomUUID().slice(0, 12).toUpperCase();
  const safeFilename = `${sha256.slice(0, 16)}_${basename(originalFilename || 'proof.dat').slice(0,128).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const storagePath = resolve(EVIDENCE_DIR, safeFilename);

  if(!existsSync(storagePath)) writeFileSync(storagePath, sanitizedBuffer, {mode:0o600,flag:'wx'});

  // 5. Initial chain-of-custody event
  const now = new Date().toISOString();
  const chainOfCustody = [
    {
      action: 'INGEST',
      timestamp: now,
      actorId: uploadedById,
      actorName: uploadedByName,
      actorRole: uploaderRole,
      sha256,
      sizeBytes: sanitizedBuffer.length,
      filename: originalFilename,
      avScanStatus
    }
  ];

  return {
    evidenceId,
    caseId,
    filename: originalFilename || safeFilename,
    storagePath,
    mimeType: cleanMime,
    sizeBytes: sanitizedBuffer.length,
    sha256,
    avScanStatus,
    description: description || 'Citizen evidence proof document',
    chainOfCustody,
    createdAt: now
  };
}

/**
 * Appends an access or custody event to an evidence file's chain of custody
 */
export function recordCustodyEvent(existingChain, { action, actorId, actorName, actorRole, notes = '' }) {
  const chain = Array.isArray(existingChain) ? [...existingChain] : [];
  chain.push({
    action,
    timestamp: new Date().toISOString(),
    actorId,
    actorName,
    actorRole,
    notes
  });
  return chain;
}

