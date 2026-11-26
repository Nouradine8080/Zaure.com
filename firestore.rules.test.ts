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

export const DIRTY_DOZEN_ALGORITHM_CASES = [
  {
    id: 'ALG-DD-01',
    name: 'User spoofs another userId when creating /algorithm_events/{id}',
    collection: 'algorithm_events',
    operation: 'create',
    actor: { uid: 'user_a' },
    payload: {
      id: 'evt_spoof_1',
      userId: 'user_b',
      eventType: 'post_like',
      targetId: 'post_1',
      targetType: 'post',
      timestamp: '2026-01-01T00:00:00Z',
      metadata: {}
    },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 'ALG-DD-02',
    name: 'User attempts to read or list another user algorithm_events',
    collection: 'algorithm_events',
    operation: 'list',
    actor: { uid: 'user_a' },
    targetUserId: 'user_b',
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 'ALG-DD-03',
    name: 'Standard user attempts to update or delete own telemetry event',
    collection: 'algorithm_events',
    operation: 'delete',
    actor: { uid: 'user_a' },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 'ALG-DD-04',
    name: 'Standard user attempts PII injection in algorithm_events.metadata',
    collection: 'algorithm_events',
    operation: 'create',
    actor: { uid: 'user_a' },
    payload: {
      id: 'evt_pii_1',
      userId: 'user_a',
      eventType: 'search',
      targetId: 'q_test',
      targetType: 'search',
      timestamp: '2026-01-01T00:00:00Z',
      metadata: { email: 'leak@zaure.com', password: 'secret' }
    },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 'ALG-DD-05',
    name: 'Standard user attempts direct write to /user_interests/{uid}',
    collection: 'user_interests',
    operation: 'create',
    actor: { uid: 'user_a' },
    payload: {
      userId: 'user_a',
      interests: { technologie: 100 },
      topTopics: ['technologie'],
      decayVersion: 1,
      totalSignals: 999,
      updatedAt: '2026-01-01T00:00:00Z'
    },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 'ALG-DD-06',
    name: 'Standard user attempts direct write to /content_signals/{contentId}',
    collection: 'content_signals',
    operation: 'create',
    actor: { uid: 'user_a' },
    payload: {
      contentId: 'post_1',
      contentKind: 'post',
      contentType: 'text',
      authorId: 'user_a',
      categories: ['technologie'],
      publishedAt: '2026-01-01T00:00:00Z',
      qualityScore: 100,
      popularityScore: 100,
      decayScore: 100,
      updatedAt: '2026-01-01T00:00:00Z'
    },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 'ALG-DD-07',
    name: 'Standard user attempts direct write to /algorithm_user_stats/{uid}',
    collection: 'algorithm_user_stats',
    operation: 'create',
    actor: { uid: 'user_a' },
    payload: {
      userId: 'user_a',
      totalEvents: 1000,
      viewsCount: 500,
      likesCount: 200,
      commentsCount: 100,
      sharesCount: 50,
      savesCount: 50,
      updatedAt: '2026-01-01T00:00:00Z'
    },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 'ALG-DD-08',
    name: 'User reads another user /user_interests/{otherUid} or /algorithm_user_stats/{otherUid}',
    collection: 'user_interests',
    operation: 'get',
    actor: { uid: 'user_a' },
    targetUserId: 'user_b',
    expected: 'PERMISSION_DENIED'
  }
] as const;

