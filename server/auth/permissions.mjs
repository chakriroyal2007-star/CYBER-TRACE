/**
 * CYBER-TRACE: Role-Based Access Control (RBAC) & Maker-Checker Policy
 */

export const ROLES = {
  REPORTER: 'reporter',
  INVESTIGATING_OFFICER: 'investigating_officer',
  SUPERVISOR: 'supervisor',
  BANK_NODAL: 'bank_nodal',
  AUDITOR: 'auditor',
  ADMIN: 'admin'
};

export const PERMISSIONS_MATRIX = {
  [ROLES.REPORTER]: [
    'complaint:create',
    'complaint:view_own',
    'complaint:submit_proof',
    'complaint:respond_request'
  ],
  [ROLES.INVESTIGATING_OFFICER]: [
    'complaint:claim',
    'complaint:view_unit',
    'case:trace',
    'case:dsa_analysis',
    'case:ml_inference',
    'request:prepare',           // Officer prepares Section 91 information request
    'freeze:prepare',            // Officer prepares Section 102 freeze requisition
    'freeze_request:prepare',
    'report:generate_draft',
    'evidence:request',
    'evidence:inspect',
    'notes:create_internal'
  ],
  [ROLES.SUPERVISOR]: [
    'complaint:claim',
    'complaint:assign',
    'complaint:view_unit',
    'complaint:view_all',
    'case:trace',
    'case:dsa_analysis',
    'case:ml_inference',
    'request:prepare',
    'request:approve',           // Maker-Checker: Supervisor approves Section 91 notice
    'freeze:prepare',
    'freeze:approve',            // Maker-Checker: Supervisor approves statutory freeze requisition
    'freeze_request:prepare',
    'freeze_request:approve',
    'report:generate_draft',
    'report:seal_final',
    'evidence:request',
    'evidence:inspect',
    'notes:create_internal',
    'audit:read'
  ],
  [ROLES.BANK_NODAL]: [
    'request:view_dispatched',
    'response:upload_statement',
    'response:record_action'
  ],
  [ROLES.AUDITOR]: [
    'audit:read',
    'audit:verify_chain',
    'case:view_summary'
  ],
  [ROLES.ADMIN]: [
    'system:configure',
    'officer:invite',
    'officer:manage_roles',
    'audit:read',
    'audit:verify_chain',
    'complaint:view_all',
    'request:approve',
    'freeze:approve'
  ]
};

/**
 * Checks if a given role possesses a specific permission
 */
export function hasPermission(role, permission) {
  if (!role || !permission) return false;
  // Normalize legacy aliases
  let normRole = role;
  if (role === 'officer' || role === 'official-investigator') normRole = ROLES.INVESTIGATING_OFFICER;
  if (role === 'demo-investigator') normRole = ROLES.INVESTIGATING_OFFICER;

  const permissions = PERMISSIONS_MATRIX[normRole] || [];
  return permissions.includes(permission);
}

/**
 * Enforces Case Scoping Boundary:
 * - Reporters can ONLY access their own complaints
 * - Investigating Officers can access cases assigned to them, claimed by their unit, or unassigned inbox
 * - Supervisors, Auditors, and Admins can view cases across the department
 */
export function canAccessCase(user, caseRecord) {
  if (!user || !caseRecord) return false;

  const role = user.role;
  if (role === ROLES.ADMIN || role === ROLES.SUPERVISOR || role === ROLES.AUDITOR) {
    return true;
  }

  if (role === ROLES.REPORTER) {
    return caseRecord.reporter_id === user.id || caseRecord.reporter_email === user.email;
  }

  if (role === ROLES.INVESTIGATING_OFFICER || role === 'officer' || role === 'demo-investigator') {
    // If case is unassigned or assigned to this officer, or shares the unit allowlist
    if (!caseRecord.assigned_officer_id) return true; // Available in unit queue to claim
    if (caseRecord.assigned_officer_id === user.id) return true;
    if (user.unit && caseRecord.unit && user.unit === caseRecord.unit) return true;
    return false;
  }

  if (role === ROLES.BANK_NODAL) {
    return Boolean(caseRecord.has_bank_request);
  }

  return false;
}
