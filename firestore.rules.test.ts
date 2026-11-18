/**
 * Phase 0 Security Test Suite Specification ("Dirty Dozen" Payloads)
 * Verifies RBAC enforcement across /admins, /admin_audit_logs, /platform_settings,
 * /platform_notifications, /user_moderation, and /users.
 */
export const DIRTY_DOZEN_ADMIN_CASES = [
  {
    id: 'DD-01',
    name: 'Standard user self-assigns SUPER_ADMIN in /admins/{uid}',
    collection: 'admins',
    operation: 'create',
    actor: { uid: 'user_1', email: 'attacker@example.com', email_verified: true },
    payload: {
      id: 'user_1',
      email: 'attacker@example.com',
      displayName: 'Attacker',
      role: 'SUPER_ADMIN',
      isActive: true,
      permissions: { manageAdmins: true },
      assignedBy: 'user_1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 'DD-02',
    name: 'Moderator elevates own role to ADMIN',
    collection: 'admins',
    operation: 'update',
    actor: { uid: 'mod_1', role: 'MODERATOR' },
    payload: { role: 'ADMIN' },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 'DD-03',
    name: 'Admin elevates own role to SUPER_ADMIN',
    collection: 'admins',
    operation: 'update',
    actor: { uid: 'admin_1', role: 'ADMIN' },
    payload: { role: 'SUPER_ADMIN' },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 'DD-04',
    name: 'Admin attempts to assign a new SUPER_ADMIN',
    collection: 'admins',
    operation: 'create',
    actor: { uid: 'admin_1', role: 'ADMIN' },
    payload: { id: 'user_2', role: 'SUPER_ADMIN', isActive: true },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 'DD-05',
    name: 'Unverified bootstrap email spoof attempt',
    collection: 'admins',
    operation: 'create',
    actor: { uid: 'spoof_uid', email: 'mahamadougarbamoussa8080@gmail.com', email_verified: false },
    payload: { id: 'spoof_uid', role: 'SUPER_ADMIN', isActive: true },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 'DD-06',
    name: 'User attempts shadow field injection on /users/{uid}',
    collection: 'users',
    operation: 'update',
    actor: { uid: 'user_1' },
    payload: { isAdmin: true, role: 'mentor' },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 'DD-07',
    name: 'Admin forges another actorId in /admin_audit_logs',
    collection: 'admin_audit_logs',
    operation: 'create',
    actor: { uid: 'admin_1', role: 'ADMIN' },
    payload: {
      id: 'log_1',
      actorId: 'other_admin',
      actorName: 'Other',
      actorRole: 'SUPER_ADMIN',
      action: 'DELETE_USER',
      module: 'users',
      targetType: 'user',
      targetId: 'user_9',
      details: 'Forged entry',
      createdAt: '2026-01-01T00:00:00Z'
    },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 'DD-08',
    name: 'SUPER_ADMIN attempts to delete or update audit log',
    collection: 'admin_audit_logs',
    operation: 'delete',
    actor: { uid: 'super_1', role: 'SUPER_ADMIN' },
    payload: null,
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 'DD-09',
    name: 'MODERATOR attempts to list private /users collection',
    collection: 'users',
    operation: 'list',
    actor: { uid: 'mod_1', role: 'MODERATOR' },
    payload: null,
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 'DD-10',
    name: 'MODERATOR attempts to modify /platform_settings/global',
    collection: 'platform_settings',
    operation: 'update',
    actor: { uid: 'mod_1', role: 'MODERATOR' },
    payload: { maintenanceMode: true },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 'DD-11',
    name: 'Standard user creates /platform_notifications broadcast',
    collection: 'platform_notifications',
    operation: 'create',
    actor: { uid: 'user_1' },
    payload: { id: 'notif_1', title: 'Fake alert', message: 'Phishing' },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 'DD-12',
    name: 'Oversized document ID or undeclared ghost field on /user_moderation',
    collection: 'user_moderation',
    operation: 'create',
    actor: { uid: 'admin_1', role: 'ADMIN' },
    payload: { userId: 'u1', status: 'suspended', ghostFlag: true },
    expected: 'PERMISSION_DENIED'
  }
] as const;
