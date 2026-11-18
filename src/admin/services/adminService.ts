import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendEmailVerification,
  signOut as firebaseSignOut,
  User as FirebaseUser
} from 'firebase/auth';
import {
  auth,
  dbFirestore,
  handleFirestoreError,
  OperationType,
  formatFirebaseAuthError
} from '../../firebaseClient';
import {
  UserProfile,
  Capsule,
  Comment,
  CommunityGroup,
  Circle,
  GroupPost,
  PostComment,
  UserReport,
  GroupReport,
  Conversation,
  Message
} from '../../types';
import {
  AdminAccount,
  AdminAuditLog,
  AdminModuleId,
  AdminPermissionsMap,
  AdminRole,
  AdminSessionContext,
  AuthUserSummary,
  BOOTSTRAP_OWNER_EMAIL,
  DEFAULT_PLATFORM_SETTINGS,
  IndexedZaureFile,
  PlatformNotification,
  PlatformSettings,
  ROLE_PRESET_PERMISSIONS,
  StaffRole,
  UserModeration,
  ZERO_PERMISSIONS
} from '../types';

function makeAdminId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

interface AdminApiResult<T> {
  ok: boolean;
  data?: T;
  status?: number;
  code?: string;
  message?: string;
}

async function callAdminApi<T>(
  path: string,
  options: RequestInit = {}
): Promise<AdminApiResult<T>> {
  if (!auth?.currentUser) {
    return { ok: false, status: 401, code: 'NO_AUTH', message: 'Utilisateur non authentifié.' };
  }
  try {
    const idToken = await auth.currentUser.getIdToken();
    const res = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
        ...(options.headers || {})
      }
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        code: String(body?.error || 'API_ERROR'),
        message: String(body?.message || `Erreur serveur (${res.status})`)
      };
    }
    return { ok: true, data: body as T };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      code: 'NETWORK_ERROR',
      message: err?.message || 'Serveur API inaccessible.'
    };
  }
}

export const adminService = {
  // ---------------------------------------------------------------------------
  // 1. AUTHENTICATION & RBAC SESSION RESOLUTION
  // ---------------------------------------------------------------------------
  signInAdminWithEmail: async (email: string, password: string): Promise<{ error: string | null }> => {
    if (!auth) return { error: 'Firebase Auth indisponible.' };
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      return { error: null };
    } catch (err: any) {
      return { error: formatFirebaseAuthError(err) };
    }
  },

  signInAdminWithGoogle: async (): Promise<{ error: string | null }> => {
    if (!auth) return { error: 'Firebase Auth indisponible.' };
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      return { error: null };
    } catch (err: any) {
      return { error: formatFirebaseAuthError(err) };
    }
  },

  resendAdminVerificationEmail: async (): Promise<{ error: string | null }> => {
    if (!auth?.currentUser) return { error: 'Aucun utilisateur connecté.' };
    try {
      await sendEmailVerification(auth.currentUser);
      return { error: null };
    } catch (err: any) {
      return { error: formatFirebaseAuthError(err) };
    }
  },

  signOutAdmin: async (): Promise<void> => {
    if (!auth) return;
    await firebaseSignOut(auth);
  },

  resolveAdminSession: async (firebaseUser: FirebaseUser | null): Promise<AdminSessionContext | null> => {
    if (!firebaseUser || !dbFirestore) return null;

    const email = (firebaseUser.email || '').trim().toLowerCase();
    const isBootstrapOwner =
      email === BOOTSTRAP_OWNER_EMAIL.toLowerCase() && firebaseUser.emailVerified === true;

    let claimsRole: AdminRole = 'USER';
    try {
      const tokenRes = await firebaseUser.getIdTokenResult();
      const rawClaim = tokenRes.claims?.zaureRole;
      if (rawClaim === 'SUPER_ADMIN' || rawClaim === 'ADMIN' || rawClaim === 'MODERATOR') {
        claimsRole = rawClaim;
      }
    } catch {
      claimsRole = 'USER';
    }

    let adminAccount: AdminAccount | null = null;
    try {
      const adminSnap = await getDoc(doc(dbFirestore, 'admins', firebaseUser.uid));
      if (adminSnap.exists()) {
        adminAccount = adminSnap.data() as AdminAccount;
      }
    } catch {
      adminAccount = null;
    }

    if (adminAccount && adminAccount.isActive) {
      const basePerms = ROLE_PRESET_PERMISSIONS[adminAccount.role] || ZERO_PERMISSIONS;
      const mergedPerms: AdminPermissionsMap = {
        ...basePerms,
        ...(adminAccount.permissions || {})
      };
      if (adminAccount.role === 'SUPER_ADMIN') {
        Object.keys(mergedPerms).forEach((k) => {
          (mergedPerms as any)[k] = true;
        });
      }
      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: adminAccount.displayName || firebaseUser.displayName || email.split('@')[0],
        emailVerified: firebaseUser.emailVerified,
        role: adminAccount.role,
        claimsRole,
        isAuthorized: true,
        isBootstrapOwner,
        adminAccount,
        permissions: mergedPerms
      };
    }

    // If explicitly deactivated in /admins, block unless bootstrap owner
    if (adminAccount && !adminAccount.isActive && !isBootstrapOwner) {
      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || email.split('@')[0] || 'Utilisateur',
        emailVerified: firebaseUser.emailVerified,
        role: 'USER',
        claimsRole,
        isAuthorized: false,
        isBootstrapOwner: false,
        adminAccount,
        permissions: { ...ZERO_PERMISSIONS }
      };
    }

    if (claimsRole !== 'USER') {
      const staffClaimsRole = claimsRole as StaffRole;
      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || email.split('@')[0],
        emailVerified: firebaseUser.emailVerified,
        role: staffClaimsRole,
        claimsRole,
        isAuthorized: true,
        isBootstrapOwner,
        adminAccount,
        permissions: { ...ROLE_PRESET_PERMISSIONS[staffClaimsRole] }
      };
    }

    if (isBootstrapOwner) {
      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email || BOOTSTRAP_OWNER_EMAIL,
        displayName: firebaseUser.displayName || 'Super Administrateur',
        emailVerified: firebaseUser.emailVerified,
        role: 'SUPER_ADMIN',
        claimsRole,
        isAuthorized: true,
        isBootstrapOwner: true,
        adminAccount: null,
        permissions: { ...ROLE_PRESET_PERMISSIONS.SUPER_ADMIN }
      };
    }

    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || email.split('@')[0] || 'Utilisateur',
      emailVerified: firebaseUser.emailVerified,
      role: 'USER',
      claimsRole,
      isAuthorized: false,
      isBootstrapOwner: email === BOOTSTRAP_OWNER_EMAIL.toLowerCase(),
      adminAccount,
      permissions: { ...ZERO_PERMISSIONS }
    };
  },

  verifySessionOnServer: async (): Promise<{
    serverReachable: boolean;
    iamRequired: boolean;
    claimsRole: AdminRole;
    effectiveRole: AdminRole;
    message?: string;
  }> => {
    const res = await callAdminApi<{
      claimsRole: AdminRole;
      effectiveRole: AdminRole;
      serverVerified: boolean;
    }>('/api/admin/me');
    if (!res.ok) {
      return {
        serverReachable: res.status !== 0,
        iamRequired: res.code === 'IAM_PERMISSION_REQUIRED',
        claimsRole: 'USER',
        effectiveRole: 'USER',
        message: res.message
      };
    }
    return {
      serverReachable: true,
      iamRequired: false,
      claimsRole: res.data.claimsRole,
      effectiveRole: res.data.effectiveRole
    };
  },

  getAuthUsersMetadata: async (): Promise<{
    users: AuthUserSummary[];
    iamRequired: boolean;
    errorMessage?: string;
  }> => {
    const res = await callAdminApi<{ users: AuthUserSummary[] }>('/api/admin/auth-users');
    if (!res.ok) {
      return {
        users: [],
        iamRequired: res.code === 'IAM_PERMISSION_REQUIRED',
        errorMessage: res.message
      };
    }
    return { users: res.data.users || [], iamRequired: false };
  },

  toggleAuthUserDisabled: async (
    targetUid: string,
    disabled: boolean
  ): Promise<{ ok: boolean; iamRequired?: boolean; message?: string }> => {
    const res = await callAdminApi<{ ok: boolean }>('/api/admin/toggle-auth-disable', {
      method: 'POST',
      body: JSON.stringify({ targetUid, disabled })
    });
    if (!res.ok) {
      return {
        ok: false,
        iamRequired: res.code === 'IAM_PERMISSION_REQUIRED',
        message: res.message
      };
    }
    return { ok: true };
  },

  bootstrapFirstSuperAdmin: async (
    session: AdminSessionContext
  ): Promise<{ account: AdminAccount; claimsSynced: boolean }> => {
    if (!dbFirestore || !auth?.currentUser) {
      throw new Error('Connexion Firebase requise.');
    }
    if (!session.isBootstrapOwner) {
      throw new Error('Seul le propriétaire vérifié de la plateforme peut initialiser le premier Super Administrateur.');
    }

    // Attempt secure server Custom Claims assignment first
    const serverRes = await callAdminApi<{ ok: boolean; account: AdminAccount }>(
      '/api/admin/bootstrap-super-admin',
      { method: 'POST' }
    );
    if (serverRes.ok) {
      await auth.currentUser.getIdToken(true);
      return { account: serverRes.data.account, claimsSynced: true };
    }

    if (serverRes.code !== 'IAM_PERMISSION_REQUIRED' && serverRes.status !== 0) {
      throw new Error(serverRes.message);
    }

    // Hardened Firestore fallback while GCP IAM permissions are pending
    const now = nowIso();
    const uid = auth.currentUser.uid;
    const account: AdminAccount = {
      id: uid,
      email: (auth.currentUser.email || BOOTSTRAP_OWNER_EMAIL).slice(0, 200),
      displayName: (auth.currentUser.displayName || session.displayName || 'Super Administrateur').slice(0, 120),
      role: 'SUPER_ADMIN',
      isActive: true,
      permissions: { ...ROLE_PRESET_PERMISSIONS.SUPER_ADMIN },
      assignedBy: 'SYSTEM_BOOTSTRAP',
      createdAt: now,
      updatedAt: now
    };

    try {
      await setDoc(doc(dbFirestore, 'admins', uid), account);

      const currentSettings = await adminService.getPlatformSettings();
      await setDoc(
        doc(dbFirestore, 'platform_settings', 'global'),
        {
          ...currentSettings,
          id: 'global',
          superAdminBootstrapped: true,
          updatedBy: uid,
          updatedAt: now
        },
        { merge: true }
      );

      await adminService.recordAuditLog(
        {
          ...session,
          role: 'SUPER_ADMIN',
          adminAccount: account
        },
        {
          action: 'BOOTSTRAP_SUPER_ADMIN',
          module: 'admins',
          targetType: 'admin',
          targetId: uid,
          details: `Initialisation sécurisée du premier Super Administrateur (${account.email}).`
        }
      );

      return { account, claimsSynced: false };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `admins/${uid}`);
    }
  },

  // ---------------------------------------------------------------------------
  // 2. AUDIT LOGS (IMMUTABLE)
  // ---------------------------------------------------------------------------
  recordAuditLog: async (
    session: AdminSessionContext,
    entry: {
      action: string;
      module: AdminModuleId | string;
      targetType: string;
      targetId: string;
      details: string;
    }
  ): Promise<void> => {
    if (!dbFirestore || !auth?.currentUser) return;
    if (session.role === 'USER') return;

    const id = makeAdminId('audit');
    const log: AdminAuditLog = {
      id,
      actorId: auth.currentUser.uid,
      actorName: (session.displayName || 'Administrateur').slice(0, 120),
      actorEmail: (session.email || '').slice(0, 200),
      actorRole: session.role as StaffRole,
      action: entry.action.slice(0, 120),
      module: String(entry.module).slice(0, 64),
      targetType: entry.targetType.slice(0, 64),
      targetId: entry.targetId.slice(0, 128),
      details: entry.details.slice(0, 1000),
      createdAt: nowIso()
    };

    try {
      await setDoc(doc(dbFirestore, 'admin_audit_logs', id), log);
    } catch (err) {
      console.warn('Info - écriture audit log:', err);
    }
  },

  getAuditLogs: async (maxCount = 200): Promise<AdminAuditLog[]> => {
    if (!dbFirestore) return [];
    try {
      const q = query(
        collection(dbFirestore, 'admin_audit_logs'),
        orderBy('createdAt', 'desc'),
        limit(maxCount)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as AdminAuditLog);
    } catch {
      const snap = await getDocs(collection(dbFirestore, 'admin_audit_logs'));
      return snap.docs
        .map((d) => d.data() as AdminAuditLog)
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    }
  },

  // ---------------------------------------------------------------------------
  // 3. USERS & MODERATION FLAGS
  // ---------------------------------------------------------------------------
  getAllUsers: async (role: AdminRole): Promise<{
    users: UserProfile[];
    moderationMap: Record<string, UserModeration>;
  }> => {
    if (!dbFirestore) return { users: [], moderationMap: {} };

    let users: UserProfile[] = [];
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
      try {
        const snap = await getDocs(collection(dbFirestore, 'users'));
        users = snap.docs.map((d) => d.data() as UserProfile);
      } catch {
        const pubSnap = await getDocs(collection(dbFirestore, 'public_profiles'));
        users = pubSnap.docs.map((d) => ({
          ...(d.data() as any),
          email: ''
        }));
      }
    } else {
      const pubSnap = await getDocs(collection(dbFirestore, 'public_profiles'));
      users = pubSnap.docs.map((d) => ({
        ...(d.data() as any),
        email: ''
      }));
    }

    users.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

    const moderationMap: Record<string, UserModeration> = {};
    try {
      const modSnap = await getDocs(collection(dbFirestore, 'user_moderation'));
      modSnap.docs.forEach((d) => {
        const item = d.data() as UserModeration;
        moderationMap[item.userId] = item;
      });
    } catch {
      // Optional collection empty or restricted
    }

    return { users, moderationMap };
  },

  setUserModerationStatus: async (
    session: AdminSessionContext,
    user: UserProfile,
    status: 'active' | 'warned' | 'suspended',
    reason: string
  ): Promise<UserModeration> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Firestore indisponible');
    const record: UserModeration = {
      userId: user.id,
      status,
      reason: reason.trim().slice(0, 500) || (status === 'active' ? 'Compte réactivé' : 'Décision administrative'),
      updatedBy: auth.currentUser.uid,
      updatedAt: nowIso()
    };
    try {
      await setDoc(doc(dbFirestore, 'user_moderation', user.id), record);
      await adminService.recordAuditLog(session, {
        action: `USER_MODERATION_${status.toUpperCase()}`,
        module: 'users',
        targetType: 'user',
        targetId: user.id,
        details: `Statut utilisateur (${user.nom}) défini sur "${status}" — Motif: ${record.reason}`
      });
      return record;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `user_moderation/${user.id}`);
    }
  },

  updateUserBadgeRole: async (
    session: AdminSessionContext,
    user: UserProfile,
    newRole: 'utilisateur' | 'mentor' | 'verifie'
  ): Promise<void> => {
    if (!dbFirestore) return;
    try {
      await updateDoc(doc(dbFirestore, 'users', user.id), { role: newRole });
      try {
        await updateDoc(doc(dbFirestore, 'public_profiles', user.id), { role: newRole });
      } catch {
        // public profile may not exist yet
      }
      await adminService.recordAuditLog(session, {
        action: 'UPDATE_USER_BADGE',
        module: 'users',
        targetType: 'user',
        targetId: user.id,
        details: `Badge communautaire de ${user.nom} modifié de "${user.role}" à "${newRole}".`
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.id}`);
    }
  },

  deleteUserAccountData: async (session: AdminSessionContext, user: UserProfile): Promise<void> => {
    if (!dbFirestore) return;
    try {
      await deleteDoc(doc(dbFirestore, 'users', user.id));
      try {
        await deleteDoc(doc(dbFirestore, 'public_profiles', user.id));
      } catch {
        // ignore if missing
      }
      try {
        await deleteDoc(doc(dbFirestore, 'user_moderation', user.id));
      } catch {
        // ignore if missing
      }
      await adminService.recordAuditLog(session, {
        action: 'DELETE_USER_PROFILE',
        module: 'users',
        targetType: 'user',
        targetId: user.id,
        details: `Suppression des données de profil utilisateur : ${user.nom} (${user.email || user.id}).`
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.id}`);
    }
  },

  // ---------------------------------------------------------------------------
  // 4. POSTS (GROUP_POSTS + CAPSULES) & COMMENTS
  // ---------------------------------------------------------------------------
  getAllPublications: async (): Promise<{
    groupPosts: GroupPost[];
    capsules: Capsule[];
  }> => {
    if (!dbFirestore) return { groupPosts: [], capsules: [] };
    let groupPosts: GroupPost[] = [];
    let capsules: Capsule[] = [];

    try {
      const snap = await getDocs(collection(dbFirestore, 'group_posts'));
      groupPosts = snap.docs
        .map((d) => d.data() as GroupPost)
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } catch (err) {
      console.warn('Info - chargement group_posts:', err);
    }

    try {
      const capSnap = await getDocs(collection(dbFirestore, 'capsules'));
      capsules = capSnap.docs
        .map((d) => d.data() as Capsule)
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    } catch (err) {
      console.warn('Info - chargement capsules:', err);
    }

    return { groupPosts, capsules };
  },

  updateGroupPostStatus: async (
    session: AdminSessionContext,
    post: GroupPost,
    status: 'published' | 'pending' | 'scheduled'
  ): Promise<void> => {
    if (!dbFirestore) return;
    try {
      await updateDoc(doc(dbFirestore, 'group_posts', post.id), {
        status,
        updatedAt: nowIso()
      });
      await adminService.recordAuditLog(session, {
        action: `POST_STATUS_${status.toUpperCase()}`,
        module: 'moderation',
        targetType: 'group_post',
        targetId: post.id,
        details: `Statut de la publication de ${post.authorName} modifié vers "${status}".`
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `group_posts/${post.id}`);
    }
  },

  toggleGroupPostPin: async (session: AdminSessionContext, post: GroupPost): Promise<boolean> => {
    if (!dbFirestore) return post.isPinned;
    const next = !post.isPinned;
    try {
      await updateDoc(doc(dbFirestore, 'group_posts', post.id), {
        isPinned: next,
        updatedAt: nowIso()
      });
      await adminService.recordAuditLog(session, {
        action: next ? 'PIN_POST' : 'UNPIN_POST',
        module: 'posts',
        targetType: 'group_post',
        targetId: post.id,
        details: `Publication ${next ? 'épinglée' : 'désépinglée'} (${post.authorName}).`
      });
      return next;
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `group_posts/${post.id}`);
    }
  },

  deleteGroupPostAdmin: async (session: AdminSessionContext, post: GroupPost): Promise<void> => {
    if (!dbFirestore) return;
    try {
      await deleteDoc(doc(dbFirestore, 'group_posts', post.id));
      await adminService.recordAuditLog(session, {
        action: 'DELETE_POST',
        module: 'posts',
        targetType: 'group_post',
        targetId: post.id,
        details: `Suppression définitive de la publication de ${post.authorName} (cercle: ${post.groupId}).`
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `group_posts/${post.id}`);
    }
  },

  deleteCapsuleAdmin: async (session: AdminSessionContext, capsule: Capsule): Promise<void> => {
    if (!dbFirestore) return;
    try {
      await deleteDoc(doc(dbFirestore, 'capsules', capsule.id));
      await adminService.recordAuditLog(session, {
        action: 'DELETE_CAPSULE',
        module: 'posts',
        targetType: 'capsule',
        targetId: capsule.id,
        details: `Suppression définitive de la capsule de ${capsule.auteur_nom || capsule.auteur_id}.`
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `capsules/${capsule.id}`);
    }
  },

  getAllComments: async (): Promise<{
    postComments: PostComment[];
    capsuleComments: Comment[];
  }> => {
    if (!dbFirestore) return { postComments: [], capsuleComments: [] };
    let postComments: PostComment[] = [];
    let capsuleComments: Comment[] = [];

    try {
      const snap = await getDocs(collection(dbFirestore, 'post_comments'));
      postComments = snap.docs
        .map((d) => d.data() as PostComment)
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } catch {
      // ignore
    }

    try {
      const snap = await getDocs(collection(dbFirestore, 'comments'));
      capsuleComments = snap.docs
        .map((d) => d.data() as Comment)
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    } catch {
      // ignore
    }

    return { postComments, capsuleComments };
  },

  deletePostCommentAdmin: async (session: AdminSessionContext, comment: PostComment): Promise<void> => {
    if (!dbFirestore) return;
    try {
      await deleteDoc(doc(dbFirestore, 'post_comments', comment.id));
      await adminService.recordAuditLog(session, {
        action: 'DELETE_POST_COMMENT',
        module: 'comments',
        targetType: 'post_comment',
        targetId: comment.id,
        details: `Suppression du commentaire de ${comment.authorName} sur le post ${comment.postId}.`
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `post_comments/${comment.id}`);
    }
  },

  deleteCapsuleCommentAdmin: async (session: AdminSessionContext, comment: Comment): Promise<void> => {
    if (!dbFirestore) return;
    try {
      await deleteDoc(doc(dbFirestore, 'comments', comment.id));
      await adminService.recordAuditLog(session, {
        action: 'DELETE_CAPSULE_COMMENT',
        module: 'comments',
        targetType: 'comment',
        targetId: comment.id,
        details: `Suppression du commentaire de ${comment.auteur_nom || comment.auteur_id} sur la capsule ${comment.capsule_id}.`
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `comments/${comment.id}`);
    }
  },

  // ---------------------------------------------------------------------------
  // 5. CIRCLES (GROUPS + LEGACY CIRCLES)
  // ---------------------------------------------------------------------------
  getAllCircles: async (): Promise<{
    groups: CommunityGroup[];
    legacyCircles: Circle[];
  }> => {
    if (!dbFirestore) return { groups: [], legacyCircles: [] };
    let groups: CommunityGroup[] = [];
    let legacyCircles: Circle[] = [];

    try {
      const snap = await getDocs(collection(dbFirestore, 'groups'));
      groups = snap.docs
        .map((d) => d.data() as CommunityGroup)
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } catch {
      // ignore
    }

    try {
      const snap = await getDocs(collection(dbFirestore, 'circles'));
      legacyCircles = snap.docs.map((d) => d.data() as Circle);
    } catch {
      // ignore
    }

    return { groups, legacyCircles };
  },

  updateCommunityGroupAdmin: async (
    session: AdminSessionContext,
    group: CommunityGroup,
    patch: Partial<Pick<CommunityGroup, 'privacy' | 'postPermission' | 'requirePostApproval' | 'requireMemberApproval'>>
  ): Promise<void> => {
    if (!dbFirestore) return;
    try {
      await updateDoc(doc(dbFirestore, 'groups', group.id), {
        ...patch,
        updatedAt: nowIso()
      });
      await adminService.recordAuditLog(session, {
        action: 'UPDATE_CIRCLE_GOVERNANCE',
        module: 'circles',
        targetType: 'group',
        targetId: group.id,
        details: `Paramètres de gouvernance du cercle "${group.name}" mis à jour.`
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `groups/${group.id}`);
    }
  },

  deleteCommunityGroupAdmin: async (session: AdminSessionContext, group: CommunityGroup): Promise<void> => {
    if (!dbFirestore) return;
    try {
      await deleteDoc(doc(dbFirestore, 'groups', group.id));
      await adminService.recordAuditLog(session, {
        action: 'DELETE_CIRCLE',
        module: 'circles',
        targetType: 'group',
        targetId: group.id,
        details: `Suppression du cercle "${group.name}" (${group.memberCount} membres).`
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `groups/${group.id}`);
    }
  },

  deleteLegacyCircleAdmin: async (session: AdminSessionContext, circle: Circle): Promise<void> => {
    if (!dbFirestore) return;
    try {
      await deleteDoc(doc(dbFirestore, 'circles', circle.id));
      await adminService.recordAuditLog(session, {
        action: 'DELETE_LEGACY_CIRCLE',
        module: 'circles',
        targetType: 'circle',
        targetId: circle.id,
        details: `Suppression du cercle thématique "${circle.nom}".`
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `circles/${circle.id}`);
    }
  },

  // ---------------------------------------------------------------------------
  // 6. REPORTS (USER REPORTS + GROUP REPORTS)
  // ---------------------------------------------------------------------------
  getAllReports: async (): Promise<{
    userReports: UserReport[];
    groupReports: GroupReport[];
  }> => {
    if (!dbFirestore) return { userReports: [], groupReports: [] };
    let userReports: UserReport[] = [];
    let groupReports: GroupReport[] = [];

    try {
      const snap = await getDocs(collection(dbFirestore, 'reports'));
      userReports = snap.docs
        .map((d) => d.data() as UserReport)
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    } catch {
      // ignore
    }

    try {
      const snap = await getDocs(collection(dbFirestore, 'group_reports'));
      groupReports = snap.docs
        .map((d) => d.data() as GroupReport)
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } catch {
      // ignore
    }

    return { userReports, groupReports };
  },

  resolveUserReport: async (
    session: AdminSessionContext,
    report: UserReport,
    status: 'examine' | 'traite' | 'en_attente'
  ): Promise<void> => {
    if (!dbFirestore) return;
    try {
      await updateDoc(doc(dbFirestore, 'reports', report.id), { status });
      await adminService.recordAuditLog(session, {
        action: `USER_REPORT_${status.toUpperCase()}`,
        module: 'reports',
        targetType: 'report',
        targetId: report.id,
        details: `Signalement utilisateur (${report.reason}) marqué "${status}".`
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reports/${report.id}`);
    }
  },

  resolveGroupReport: async (
    session: AdminSessionContext,
    report: GroupReport,
    status: 'resolved' | 'dismissed' | 'pending'
  ): Promise<void> => {
    if (!dbFirestore || !auth?.currentUser) return;
    try {
      await updateDoc(doc(dbFirestore, 'group_reports', report.id), {
        status,
        resolvedBy: auth.currentUser.uid
      });
      await adminService.recordAuditLog(session, {
        action: `GROUP_REPORT_${status.toUpperCase()}`,
        module: 'reports',
        targetType: 'group_report',
        targetId: report.id,
        details: `Signalement de contenu (${report.targetType}: ${report.reason}) marqué "${status}".`
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `group_reports/${report.id}`);
    }
  },

  // ---------------------------------------------------------------------------
  // 7. CENTRALIZED FILES INDEX (POSTS + CAPSULES + CIRCLES + CONVERSATIONS)
  // ---------------------------------------------------------------------------
  getCentralizedFiles: async (role: AdminRole): Promise<IndexedZaureFile[]> => {
    if (!dbFirestore) return [];
    const files: IndexedZaureFile[] = [];

    // A. Group Posts Media
    try {
      const postsSnap = await getDocs(collection(dbFirestore, 'group_posts'));
      postsSnap.docs.forEach((d) => {
        const post = d.data() as GroupPost;
        (post.media || []).forEach((m, idx) => {
          files.push({
            id: `post_${post.id}_${idx}`,
            name: m.name || `Media_Post_${idx + 1}`,
            url: m.url,
            origin: 'post',
            originLabel: post.groupId === 'public' ? 'Fil public' : `Cercle (${post.groupId})`,
            mediaType: m.type === 'video' ? 'video' : m.type === 'document' ? 'document' : 'image',
            mimeType: m.mimeType || (m.type === 'video' ? 'video/mp4' : m.type === 'document' ? 'application/octet-stream' : 'image/jpeg'),
            sizeBytes: m.size,
            ownerId: post.authorId,
            ownerName: post.authorName,
            contextId: post.id,
            contextTitle: (post.content || 'Publication média').slice(0, 80),
            createdAt: post.createdAt
          });
        });
      });
    } catch {
      // ignore
    }

    // B. Capsules media/audio
    try {
      const capSnap = await getDocs(collection(dbFirestore, 'capsules'));
      capSnap.docs.forEach((d) => {
        const cap = d.data() as Capsule;
        if (cap.type !== 'texte' && cap.contenu) {
          const mType = cap.type === 'audio' ? 'audio' : cap.type === 'video' ? 'video' : 'image';
          files.push({
            id: `cap_${cap.id}`,
            name: `Capsule_${cap.type}_${cap.id.slice(0, 8)}`,
            url: cap.contenu,
            origin: 'capsule',
            originLabel: `Capsule (${cap.circle_nom || cap.circle_id})`,
            mediaType: mType,
            mimeType: mType === 'audio' ? 'audio/webm' : mType === 'video' ? 'video/mp4' : 'image/jpeg',
            ownerId: cap.auteur_id,
            ownerName: cap.auteur_nom || cap.auteur_id,
            contextId: cap.id,
            contextTitle: `Capsule ${cap.type}`,
            createdAt: cap.created_at
          });
        }
      });
    } catch {
      // ignore
    }

    // C. Circles branding media
    try {
      const groupsSnap = await getDocs(collection(dbFirestore, 'groups'));
      groupsSnap.docs.forEach((d) => {
        const g = d.data() as CommunityGroup;
        if (g.coverPhoto) {
          files.push({
            id: `group_cover_${g.id}`,
            name: `Couverture_${g.name.replace(/\s+/g, '_')}`,
            url: g.coverPhoto,
            origin: 'circle',
            originLabel: 'Cercle communautaire',
            mediaType: 'image',
            mimeType: 'image/jpeg',
            ownerId: g.createdBy,
            ownerName: g.name,
            contextId: g.id,
            contextTitle: `Couverture du cercle ${g.name}`,
            createdAt: g.createdAt
          });
        }
        if (g.avatarPhoto) {
          files.push({
            id: `group_avatar_${g.id}`,
            name: `Avatar_${g.name.replace(/\s+/g, '_')}`,
            url: g.avatarPhoto,
            origin: 'circle',
            originLabel: 'Cercle communautaire',
            mediaType: 'image',
            mimeType: 'image/jpeg',
            ownerId: g.createdBy,
            ownerName: g.name,
            contextId: g.id,
            contextTitle: `Icône du cercle ${g.name}`,
            createdAt: g.createdAt
          });
        }
      });
    } catch {
      // ignore
    }

    // D. Conversation Attachments (ADMIN / SUPER_ADMIN only)
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
      try {
        const convSnap = await getDocs(collection(dbFirestore, 'conversations'));
        const convDocs = convSnap.docs.slice(0, 40);
        for (const cDoc of convDocs) {
          const conv = cDoc.data() as Conversation;
          try {
            const msgSnap = await getDocs(collection(dbFirestore, 'conversations', conv.id, 'messages'));
            msgSnap.docs.forEach((mDoc) => {
              const msg = mDoc.data() as Message;
              (msg.attachments || []).forEach((att, idx) => {
                files.push({
                  id: `msg_${conv.id}_${msg.id}_${idx}`,
                  name: att.name || `Fichier_Chat_${idx + 1}`,
                  url: att.url,
                  origin: 'conversation',
                  originLabel: conv.type === 'group' ? `Groupe Chat (${conv.group_name || conv.id})` : 'Conversation directe',
                  mediaType:
                    att.type === 'video'
                      ? 'video'
                      : att.type === 'audio'
                        ? 'audio'
                        : att.type === 'image'
                          ? 'image'
                          : 'document',
                  mimeType: att.mime_type || 'application/octet-stream',
                  sizeBytes: att.size,
                  ownerId: msg.sender_id,
                  ownerName: msg.sender_nom || msg.sender_id,
                  contextId: conv.id,
                  contextTitle: conv.group_name || 'Messagerie privée',
                  createdAt: msg.created_at
                });
              });
            });
          } catch {
            // ignore inaccessible subcollection
          }
        }
      } catch {
        // ignore if restricted
      }
    }

    return files.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  },

  // ---------------------------------------------------------------------------
  // 8. ADMIN TEAM & RBAC MANAGEMENT (SUPER_ADMIN ONLY)
  // ---------------------------------------------------------------------------
  getAdminAccounts: async (): Promise<AdminAccount[]> => {
    if (!dbFirestore) return [];
    try {
      const snap = await getDocs(collection(dbFirestore, 'admins'));
      return snap.docs
        .map((d) => d.data() as AdminAccount)
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } catch (err) {
      console.warn('Info - lecture admins:', err);
      return [];
    }
  },

  assignAdminRole: async (
    session: AdminSessionContext,
    targetUser: UserProfile,
    role: StaffRole,
    customPermissions?: AdminPermissionsMap
  ): Promise<{ account: AdminAccount; claimsSynced: boolean }> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Firestore indisponible');
    if (session.role !== 'SUPER_ADMIN') {
      throw new Error('Seul un Super Administrateur peut attribuer des rôles administratifs.');
    }
    if (targetUser.id === auth.currentUser.uid) {
      throw new Error('Un utilisateur ne peut pas modifier son propre rôle.');
    }

    const perms = customPermissions || { ...ROLE_PRESET_PERMISSIONS[role] };
    const serverRes = await callAdminApi<{ ok: boolean }>('/api/admin/set-role', {
      method: 'POST',
      body: JSON.stringify({
        targetUid: targetUser.id,
        role,
        email: (targetUser.email || '').slice(0, 200),
        displayName: (targetUser.nom || 'Membre Zaure').slice(0, 120),
        isActive: true,
        permissions: perms
      })
    });

    const now = nowIso();
    const account: AdminAccount = {
      id: targetUser.id,
      email: (targetUser.email || '').slice(0, 200),
      displayName: (targetUser.nom || 'Membre Zaure').slice(0, 120),
      role,
      isActive: true,
      permissions: perms,
      assignedBy: auth.currentUser.uid,
      createdAt: now,
      updatedAt: now
    };

    if (serverRes.ok) {
      return { account, claimsSynced: true };
    }
    if (serverRes.code !== 'IAM_PERMISSION_REQUIRED' && serverRes.status !== 0) {
      throw new Error(serverRes.message);
    }

    try {
      await setDoc(doc(dbFirestore, 'admins', targetUser.id), account);
      await adminService.recordAuditLog(session, {
        action: 'ASSIGN_ADMIN_ROLE',
        module: 'admins',
        targetType: 'admin',
        targetId: targetUser.id,
        details: `Attribution du rôle ${role} à ${account.displayName} (${account.email}).`
      });
      return { account, claimsSynced: false };
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `admins/${targetUser.id}`);
    }
  },

  updateAdminAccount: async (
    session: AdminSessionContext,
    target: AdminAccount,
    updates: Partial<Pick<AdminAccount, 'role' | 'isActive' | 'permissions'>>
  ): Promise<{ account: AdminAccount; claimsSynced: boolean }> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Firestore indisponible');
    if (session.role !== 'SUPER_ADMIN') {
      throw new Error('Action réservée au Super Administrateur.');
    }
    if (target.id === auth.currentUser.uid && (updates.role || updates.isActive === false)) {
      throw new Error('Vous ne pouvez pas modifier votre propre rôle ou désactiver votre propre accès.');
    }

    const updated: AdminAccount = {
      ...target,
      ...updates,
      updatedAt: nowIso()
    };

    const serverRes = await callAdminApi<{ ok: boolean }>('/api/admin/set-role', {
      method: 'POST',
      body: JSON.stringify({
        targetUid: target.id,
        role: updated.role,
        email: updated.email,
        displayName: updated.displayName,
        isActive: updated.isActive,
        permissions: updated.permissions
      })
    });

    if (serverRes.ok) {
      return { account: updated, claimsSynced: true };
    }
    if (serverRes.code !== 'IAM_PERMISSION_REQUIRED' && serverRes.status !== 0) {
      throw new Error(serverRes.message);
    }

    try {
      await setDoc(doc(dbFirestore, 'admins', target.id), updated);
      await adminService.recordAuditLog(session, {
        action: 'UPDATE_ADMIN_PERMISSIONS',
        module: 'security',
        targetType: 'admin',
        targetId: target.id,
        details: `Mise à jour des droits de ${target.displayName} (rôle: ${updated.role}, actif: ${updated.isActive}).`
      });
      return { account: updated, claimsSynced: false };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `admins/${target.id}`);
    }
  },

  revokeAdminAccount: async (
    session: AdminSessionContext,
    target: AdminAccount
  ): Promise<{ claimsSynced: boolean }> => {
    if (!dbFirestore || !auth?.currentUser) return { claimsSynced: false };
    if (session.role !== 'SUPER_ADMIN') {
      throw new Error('Action réservée au Super Administrateur.');
    }
    if (target.id === auth.currentUser.uid) {
      throw new Error('Impossible de révoquer votre propre accès Super Administrateur.');
    }

    const serverRes = await callAdminApi<{ ok: boolean }>('/api/admin/set-role', {
      method: 'POST',
      body: JSON.stringify({
        targetUid: target.id,
        role: 'USER',
        isActive: false
      })
    });

    if (serverRes.ok) {
      return { claimsSynced: true };
    }
    if (serverRes.code !== 'IAM_PERMISSION_REQUIRED' && serverRes.status !== 0) {
      throw new Error(serverRes.message);
    }

    try {
      await deleteDoc(doc(dbFirestore, 'admins', target.id));
      await adminService.recordAuditLog(session, {
        action: 'REVOKE_ADMIN',
        module: 'admins',
        targetType: 'admin',
        targetId: target.id,
        details: `Révocation de l'accès administratif de ${target.displayName} (${target.email}).`
      });
      return { claimsSynced: false };
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `admins/${target.id}`);
    }
  },

  // ---------------------------------------------------------------------------
  // 9. PLATFORM NOTIFICATIONS & SETTINGS
  // ---------------------------------------------------------------------------
  getPlatformNotifications: async (): Promise<PlatformNotification[]> => {
    if (!dbFirestore) return [];
    try {
      const snap = await getDocs(collection(dbFirestore, 'platform_notifications'));
      return snap.docs
        .map((d) => d.data() as PlatformNotification)
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } catch {
      return [];
    }
  },

  createPlatformNotification: async (
    session: AdminSessionContext,
    payload: {
      title: string;
      message: string;
      priority: 'info' | 'warning' | 'urgent';
      audience: 'all' | 'mentors' | 'admins';
      isActive: boolean;
    }
  ): Promise<PlatformNotification> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Firestore indisponible');
    const id = makeAdminId('pnotif');
    const now = nowIso();
    const notif: PlatformNotification = {
      id,
      title: payload.title.trim().slice(0, 160),
      message: payload.message.trim().slice(0, 2000),
      priority: payload.priority,
      audience: payload.audience,
      isActive: payload.isActive,
      createdBy: auth.currentUser.uid,
      createdByName: session.displayName.slice(0, 120),
      createdAt: now,
      updatedAt: now
    };
    try {
      await setDoc(doc(dbFirestore, 'platform_notifications', id), notif);
      await adminService.recordAuditLog(session, {
        action: 'CREATE_PLATFORM_NOTIFICATION',
        module: 'notifications',
        targetType: 'platform_notification',
        targetId: id,
        details: `Diffusion notification "${notif.title}" (audience: ${notif.audience}, priorité: ${notif.priority}).`
      });
      return notif;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `platform_notifications/${id}`);
    }
  },

  togglePlatformNotification: async (
    session: AdminSessionContext,
    notif: PlatformNotification
  ): Promise<PlatformNotification> => {
    if (!dbFirestore) return notif;
    const updated: PlatformNotification = {
      ...notif,
      isActive: !notif.isActive,
      updatedAt: nowIso()
    };
    try {
      await setDoc(doc(dbFirestore, 'platform_notifications', notif.id), updated);
      await adminService.recordAuditLog(session, {
        action: updated.isActive ? 'ENABLE_NOTIFICATION' : 'DISABLE_NOTIFICATION',
        module: 'notifications',
        targetType: 'platform_notification',
        targetId: notif.id,
        details: `Notification "${notif.title}" ${updated.isActive ? 'activée' : 'désactivée'}.`
      });
      return updated;
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `platform_notifications/${notif.id}`);
    }
  },

  deletePlatformNotification: async (session: AdminSessionContext, notif: PlatformNotification): Promise<void> => {
    if (!dbFirestore) return;
    try {
      await deleteDoc(doc(dbFirestore, 'platform_notifications', notif.id));
      await adminService.recordAuditLog(session, {
        action: 'DELETE_PLATFORM_NOTIFICATION',
        module: 'notifications',
        targetType: 'platform_notification',
        targetId: notif.id,
        details: `Suppression de la notification "${notif.title}".`
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `platform_notifications/${notif.id}`);
    }
  },

  getPlatformSettings: async (): Promise<PlatformSettings> => {
    if (!dbFirestore) return DEFAULT_PLATFORM_SETTINGS;
    try {
      const snap = await getDoc(doc(dbFirestore, 'platform_settings', 'global'));
      if (snap.exists()) {
        return {
          ...DEFAULT_PLATFORM_SETTINGS,
          ...(snap.data() as PlatformSettings),
          id: 'global'
        };
      }
      return DEFAULT_PLATFORM_SETTINGS;
    } catch {
      return DEFAULT_PLATFORM_SETTINGS;
    }
  },

  savePlatformSettings: async (
    session: AdminSessionContext,
    settings: PlatformSettings
  ): Promise<PlatformSettings> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Firestore indisponible');
    const clean: PlatformSettings = {
      id: 'global',
      platformName: (settings.platformName || 'Zaure').trim().slice(0, 80),
      maintenanceMode: Boolean(settings.maintenanceMode),
      maintenanceMessage: (settings.maintenanceMessage || '').trim().slice(0, 500),
      registrationOpen: Boolean(settings.registrationOpen),
      requirePostModerationByDefault: Boolean(settings.requirePostModerationByDefault),
      maxUploadSizeMb: Math.max(1, Math.min(500, Math.round(Number(settings.maxUploadSizeMb) || 15))),
      forbiddenKeywords: (settings.forbiddenKeywords || [])
        .map((w) => String(w).trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 100),
      driveRootFolderName: (settings.driveRootFolderName || 'Zaure-Admin-Storage').trim().slice(0, 120),
      superAdminBootstrapped: Boolean(settings.superAdminBootstrapped),
      updatedBy: auth.currentUser.uid,
      updatedAt: nowIso()
    };

    try {
      await setDoc(doc(dbFirestore, 'platform_settings', 'global'), clean);
      await adminService.recordAuditLog(session, {
        action: 'UPDATE_PLATFORM_SETTINGS',
        module: 'settings',
        targetType: 'platform_settings',
        targetId: 'global',
        details: `Paramètres plateforme enregistrés (maintenance: ${clean.maintenanceMode ? 'ON' : 'OFF'}, inscriptions: ${clean.registrationOpen ? 'OUVERTES' : 'FERMÉES'}).`
      });
      return clean;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'platform_settings/global');
    }
  }
};
