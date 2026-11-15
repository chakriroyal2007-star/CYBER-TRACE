import { randomBytes } from 'node:crypto';
import { validatePasswordPolicy, hashPasswordSecure } from './password.mjs';
import { verifyTotp } from './totp.mjs';

// Default authorized government/law enforcement email domains
export const DEFAULT_ALLOWED_DOMAINS = [
  'cbi.gov.in',
  'gov.in',
  'nic.in',
  'police.gov.in',
  'fiuindia.gov.in',
  'cryptotrace.gov.in',
  'example.gov.in'
];

/**
 * Validates whether an email belongs to an authorized official domain
 */
export function isAllowedOfficerDomain(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const domain = cleanEmail.split('@')[1];
  if (!domain) return false;

  const configured = process.env.OFFICER_EMAIL_DOMAINS
    ? process.env.OFFICER_EMAIL_DOMAINS.split(',').map(d => d.trim().toLowerCase())
    : DEFAULT_ALLOWED_DOMAINS;

  return configured.some(allowed => domain === allowed || domain.endsWith('.' + allowed));
}

// In-memory officer invitations store: token -> { id, email, role, designation, unit, expiresAt, status: 'PENDING'|'ACCEPTED'|'EXPIRED' }
export const invitationStore = new Map();

/**
 * Admin creates an email-bound single-use invitation for an officer
 */
export function createOfficerInvitation(arg1, arg2, arg3) {
  const data = (arg1 && typeof arg1 === 'object' && arg1.email) ? arg1 : (arg2 && typeof arg2 === 'object' && arg2.email) ? arg2 : arg1 || {};
  const { designation, unit, role = 'investigating_officer' } = data;
  const invitedBy = typeof arg2 === 'string' ? arg2 : typeof arg3 === 'string' ? arg3 : data.invitedBy || 'Admin';
  const cleanEmail = String(data.email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw Object.assign(new Error('Valid email address is required.'), { status: 400 });
  }

  if (!isAllowedOfficerDomain(cleanEmail)) {
    throw Object.assign(
      new Error(`Email domain for "${cleanEmail}" is not authorized for officer enrollment. Must be an authorized domain (e.g. cbi.gov.in, gov.in).`),
      { status: 403 }
    );
  }

  // Check for duplicate pending invitation
  for (const inv of invitationStore.values()) {
    if (inv.email === cleanEmail && inv.status === 'PENDING' && inv.expiresAt > Date.now()) {
      return { token: inv.token, invitation: inv, existing: true };
    }
  }

  const token = 'INV-' + randomBytes(24).toString('hex');
  const now = Date.now();
  const expiresAt = now + 48 * 60 * 60 * 1000; // 48 hours

  const record = {
    id: 'INV-' + randomBytes(8).toString('hex'),
    token,
    email: cleanEmail,
    role,
    designation: designation || 'Investigating Officer',
    unit: unit || 'CBI Cyber Crime Division',
    invitedBy,
    createdAt: now,
    expiresAt,
    status: 'PENDING'
  };

  invitationStore.set(token, record);
  return { token, invitation: record };
}

/**
 * Validates an invitation token
 */
export function verifyInvitationToken(arg1, arg2) {
  const token = typeof arg1 === 'string' ? arg1 : arg2;
  const inv = invitationStore.get(token);
  if (!inv) {
    throw Object.assign(new Error('Invalid or unrecognized invitation token.'), { status: 404 });
  }
  if (inv.status !== 'PENDING') {
    throw Object.assign(new Error('Invitation token has already been accepted or revoked.'), { status: 410 });
  }
  if (inv.expiresAt < Date.now()) {
    throw Object.assign(new Error('Invitation token has expired.'), { status: 410 });
  }
  return {
    valid: true,
    email: inv.email,
    role: inv.role,
    designation: inv.designation,
    unit: inv.unit,
    expiresAt: inv.expiresAt
  };
}

/**
 * Officer accepts invitation: validates token, sets password, enrolls mandatory TOTP
 */
export async function acceptOfficerInvitation(arg1, arg2) {
  const dbStore = arg1?.db ? arg1 : arg2?.db ? arg2 : arg1;
  const data = arg1?.db ? arg2 : arg1;
  const { token, password, totpSecret, totpCode, displayName } = data || {};
  const inv = invitationStore.get(token);

  if (!inv) {
    throw Object.assign(new Error('Invalid or unrecognized invitation token.'), { status: 404 });
  }

  if (inv.status === 'ACCEPTED') {
    throw Object.assign(new Error('This invitation token has already been used and cannot be reused.'), { status: 410 });
  }

  if (Date.now() > inv.expiresAt) {
    inv.status = 'EXPIRED';
    throw Object.assign(new Error('This invitation token has expired. Please contact your administrator.'), { status: 410 });
  }

  // 1. Password policy verification
  const policy = validatePasswordPolicy(password);
  if (!policy.valid) {
    throw Object.assign(new Error(policy.message), { status: 400 });
  }

  // 2. Mandatory TOTP verification
  if (!totpSecret || !totpCode) {
    throw Object.assign(new Error('Mandatory two-factor authentication (TOTP) enrollment required for officer accounts.'), { status: 400 });
  }

  const totpValid = verifyTotp(totpCode, totpSecret);
  if (!totpValid) {
    throw Object.assign(new Error('Invalid 6-digit TOTP verification code. Please ensure your authenticator app is synced.'), { status: 400 });
  }

  // 3. Register officer in system database
  const user = dbStore.registerUser({
    email: inv.email,
    password,
    name: displayName || inv.designation,
    role: inv.role,
    agency: inv.unit,
    badgeNumber: 'CBI-' + randomBytes(3).toString('hex').toUpperCase(),
    totpSecret,
    status: 'ACTIVE'
  });

  // 4. Mark invitation as consumed (single-use)
  inv.status = 'ACCEPTED';
  inv.acceptedAt = Date.now();
  inv.userId = user.id;

  return { success: true, ok: true, user };
}
