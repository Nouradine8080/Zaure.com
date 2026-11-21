import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOOTSTRAP_OWNER_EMAIL = 'mahamadougarbamoussa8080@gmail.com';
const VALID_STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MODERATOR'] as const;
const VALID_ALL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'USER'] as const;

type StaffRole = (typeof VALID_STAFF_ROLES)[number];
type AnyRole = (typeof VALID_ALL_ROLES)[number];

const ROLE_PRESET_PERMISSIONS: Record<StaffRole, Record<string, boolean>> = {
  SUPER_ADMIN: {
    viewDashboard: true,
    manageUsers: true,
    managePosts: true,
    manageComments: true,
    manageCircles: true,
    moderateContent: true,
    manageReports: true,
    manageFiles: true,
    manageDrive: true,
    sendNotifications: true,
    manageAdmins: true,
    manageSecurity: true,
    viewAuditLogs: true,
    manageSettings: true
  },
  ADMIN: {
    viewDashboard: true,
    manageUsers: true,
    managePosts: true,
    manageComments: true,
    manageCircles: true,
    moderateContent: true,
    manageReports: true,
    manageFiles: true,
    manageDrive: true,
    sendNotifications: true,
    manageAdmins: false,
    manageSecurity: false,
    viewAuditLogs: true,
    manageSettings: true
  },
  MODERATOR: {
    viewDashboard: true,
    manageUsers: false,
    managePosts: true,
    manageComments: true,
    manageCircles: false,
    moderateContent: true,
    manageReports: true,
    manageFiles: false,
    manageDrive: false,
    sendNotifications: false,
    manageAdmins: false,
    manageSecurity: false,
    viewAuditLogs: true,
    manageSettings: false
  }
};

interface FirebaseConfigFile {
  projectId?: string;
  firestoreDatabaseId?: string;
}

function loadFirebaseConfig(): FirebaseConfigFile {
  const cfgPath = path.resolve(__dirname, 'firebase-applet-config.json');
  const raw = fs.readFileSync(cfgPath, 'utf8');
  return JSON.parse(raw) as FirebaseConfigFile;
}

const firebaseConfig = loadFirebaseConfig();
if (!firebaseConfig.projectId || firebaseConfig.projectId === 'remixed-project-id') {
  throw new Error('Firebase projectId manquant ou invalide dans firebase-applet-config.json');
}

if (!process.env.GOOGLE_CLOUD_QUOTA_PROJECT) {
  process.env.GOOGLE_CLOUD_QUOTA_PROJECT = firebaseConfig.projectId;
}

const adminApp = getApps().length
  ? getApp()
  : initializeApp({ projectId: firebaseConfig.projectId });

const adminAuth = getAuth(adminApp);
const adminDb =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(adminApp, firebaseConfig.firestoreDatabaseId)
    : getFirestore(adminApp);

function isIamPermissionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('7 PERMISSION_DENIED') ||
    msg.includes('insufficient permission') ||
    msg.includes('auth/insufficient-permission') ||
    msg.includes('Caller does not have required permission') ||
    msg.includes('serviceUsageConsumer') ||
    msg.includes('serviceusage.services.use') ||
    msg.includes('iam-admin/iam?project=') ||
    msg.includes('identitytoolkit.googleapis.com')
  );
}

interface VerifiedCaller {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  claimsRole: AnyRole;
  effectiveRole: AnyRole;
  isBootstrapOwner: boolean;
  decoded: DecodedIdToken;
}

async function resolveCallerAuthorization(req: express.Request): Promise<VerifiedCaller> {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    throw new Error('UNAUTHORIZED:Jeton Bearer Firebase manquant.');
  }

  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) {
    throw new Error('UNAUTHORIZED:Jeton Bearer vide.');
  }

  const decoded = await adminAuth.verifyIdToken(idToken);
  const email = (decoded.email || '').trim().toLowerCase();
  const emailVerified = Boolean(decoded.email_verified);
  const isBootstrapOwner =
    email === BOOTSTRAP_OWNER_EMAIL.toLowerCase() && emailVerified === true;

  const rawClaimRole = decoded.zaureRole;
  const claimsRole: AnyRole = VALID_ALL_ROLES.includes(rawClaimRole)
    ? (rawClaimRole as AnyRole)
    : 'USER';

  let firestoreRole: AnyRole = 'USER';
  try {
    const adminDoc = await adminDb.collection('admins').doc(decoded.uid).get();
    if (adminDoc.exists) {
      const data = adminDoc.data();
      if (data?.isActive === true && VALID_STAFF_ROLES.includes(data.role)) {
        firestoreRole = data.role as StaffRole;
      }
    }
  } catch (err) {
    if (isIamPermissionError(err)) {
      throw err;
    }
  }

  let effectiveRole: AnyRole = 'USER';
  if (firestoreRole !== 'USER') {
    effectiveRole = firestoreRole;
  } else if (claimsRole !== 'USER') {
    effectiveRole = claimsRole;
  } else if (isBootstrapOwner) {
    effectiveRole = 'SUPER_ADMIN';
  }

  return {
    uid: decoded.uid,
    email: decoded.email || '',
    displayName: (decoded.name as string) || email.split('@')[0] || 'Administrateur',
    emailVerified,
    claimsRole,
    effectiveRole,
    isBootstrapOwner,
    decoded
  };
}

async function writeServerAuditLog(
  caller: VerifiedCaller,
  entry: {
    action: string;
    module: string;
    targetType: string;
    targetId: string;
    details: string;
  }
) {
  if (caller.effectiveRole === 'USER') return;
  const id = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await adminDb.collection('admin_audit_logs').doc(id).set({
    id,
    actorId: caller.uid,
    actorName: caller.displayName.slice(0, 120),
    actorEmail: caller.email.slice(0, 200),
    actorRole: caller.effectiveRole,
    action: entry.action.slice(0, 120),
    module: entry.module.slice(0, 64),
    targetType: entry.targetType.slice(0, 64),
    targetId: entry.targetId.slice(0, 128),
    details: entry.details.slice(0, 1000),
    createdAt: new Date().toISOString()
  });
}

function handleServerError(res: express.Response, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.startsWith('UNAUTHORIZED:')) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: msg.replace('UNAUTHORIZED:', '') });
  }
  if (msg.startsWith('FORBIDDEN:')) {
    return res.status(403).json({ error: 'FORBIDDEN', message: msg.replace('FORBIDDEN:', '') });
  }
  if (isIamPermissionError(err)) {
    return res.status(403).json({
      error: 'IAM_PERMISSION_REQUIRED',
      message:
        "Le compte de service serveur n'a pas encore les rôles IAM requis (roles/datastore.user et roles/firebaseauth.admin) sur le projet Firebase."
    });
  }
  return res.status(500).json({ error: 'INTERNAL_ERROR', message: msg });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // -------------------------------------------------------------------------
  // ADMIN RBAC & CUSTOM CLAIMS SERVER API (VERIFIED WITH FIREBASE ADMIN SDK)
  // -------------------------------------------------------------------------

  // 1. Verify current admin caller token, Custom Claims & Firestore role
  app.get('/api/admin/me', async (req, res) => {
    try {
      const caller = await resolveCallerAuthorization(req);
      return res.json({
        uid: caller.uid,
        email: caller.email,
        emailVerified: caller.emailVerified,
        claimsRole: caller.claimsRole,
        effectiveRole: caller.effectiveRole,
        isBootstrapOwner: caller.isBootstrapOwner,
        serverVerified: true
      });
    } catch (err) {
      return handleServerError(res, err);
    }
  });

  // 2. Securely designate the first Super Administrator & assign Firebase Custom Claims
  app.post('/api/admin/bootstrap-super-admin', async (req, res) => {
    try {
      const caller = await resolveCallerAuthorization(req);
      if (!caller.isBootstrapOwner) {
        throw new Error(
          'FORBIDDEN:Seul le propriétaire vérifié de la plateforme peut initialiser le premier Super Administrateur.'
        );
      }

      const existingSupers = await adminDb
        .collection('admins')
        .where('role', '==', 'SUPER_ADMIN')
        .where('isActive', '==', true)
        .get();

      if (!existingSupers.empty && !existingSupers.docs.some((d) => d.id === caller.uid)) {
        throw new Error('FORBIDDEN:Un Super Administrateur actif est déjà désigné.');
      }

      await adminAuth.setCustomUserClaims(caller.uid, {
        zaureRole: 'SUPER_ADMIN',
        admin: true
      });

      const now = new Date().toISOString();
      const account = {
        id: caller.uid,
        email: caller.email.slice(0, 200),
        displayName: caller.displayName.slice(0, 120),
        role: 'SUPER_ADMIN' as const,
        isActive: true,
        permissions: ROLE_PRESET_PERMISSIONS.SUPER_ADMIN,
        assignedBy: 'SYSTEM_BOOTSTRAP_CLAIMS',
        createdAt: now,
        updatedAt: now
      };

      await adminDb.collection('admins').doc(caller.uid).set(account, { merge: true });
      await adminDb.collection('platform_settings').doc('global').set(
        {
          id: 'global',
          superAdminBootstrapped: true,
          updatedBy: caller.uid,
          updatedAt: now
        },
        { merge: true }
      );

      await writeServerAuditLog(
        { ...caller, effectiveRole: 'SUPER_ADMIN' },
        {
          action: 'BOOTSTRAP_SUPER_ADMIN_CLAIMS',
          module: 'admins',
          targetType: 'admin',
          targetId: caller.uid,
          details: `Attribution serveur des Firebase Custom Claims SUPER_ADMIN pour ${caller.email}.`
        }
      );

      return res.json({ ok: true, account, customClaims: { zaureRole: 'SUPER_ADMIN', admin: true } });
    } catch (err) {
      return handleServerError(res, err);
    }
  });

  // 3. Assign or update role & Custom Claims (SUPER_ADMIN only, strictly blocks self-elevation)
  app.post('/api/admin/set-role', async (req, res) => {
    try {
      const caller = await resolveCallerAuthorization(req);
      if (caller.effectiveRole !== 'SUPER_ADMIN') {
        throw new Error('FORBIDDEN:Seul un Super Administrateur peut modifier les rôles et Custom Claims.');
      }

      const { targetUid, role, email, displayName, isActive, permissions } = req.body as {
        targetUid?: string;
        role?: AnyRole;
        email?: string;
        displayName?: string;
        isActive?: boolean;
        permissions?: Record<string, boolean>;
      };

      if (!targetUid || typeof targetUid !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(targetUid)) {
        return res.status(400).json({ error: 'INVALID_TARGET', message: 'Identifiant utilisateur cible invalide.' });
      }
      if (!role || !VALID_ALL_ROLES.includes(role)) {
        return res.status(400).json({ error: 'INVALID_ROLE', message: 'Rôle invalide.' });
      }
      if (targetUid === caller.uid) {
        throw new Error('FORBIDDEN:Un utilisateur ne peut jamais modifier son propre rôle.');
      }

      if (role === 'USER' || isActive === false) {
        await adminAuth.setCustomUserClaims(targetUid, {
          zaureRole: 'USER',
          admin: false
        });
        if (role === 'USER') {
          await adminDb.collection('admins').doc(targetUid).delete();
        } else {
          await adminDb.collection('admins').doc(targetUid).set(
            {
              isActive: false,
              updatedAt: new Date().toISOString()
            },
            { merge: true }
          );
        }
      } else {
        const staffRole = role as StaffRole;
        await adminAuth.setCustomUserClaims(targetUid, {
          zaureRole: staffRole,
          admin: true
        });
        const now = new Date().toISOString();
        const existingDoc = await adminDb.collection('admins').doc(targetUid).get();
        const existingData = existingDoc.exists ? existingDoc.data() : null;

        await adminDb.collection('admins').doc(targetUid).set({
          id: targetUid,
          email: (email || existingData?.email || '').slice(0, 200),
          displayName: (displayName || existingData?.displayName || 'Administrateur').slice(0, 120),
          role: staffRole,
          isActive: true,
          permissions: permissions || ROLE_PRESET_PERMISSIONS[staffRole],
          assignedBy: caller.uid,
          createdAt: existingData?.createdAt || now,
          updatedAt: now
        });
      }

      await writeServerAuditLog(caller, {
        action: 'SERVER_SET_CUSTOM_CLAIMS_ROLE',
        module: 'admins',
        targetType: 'admin',
        targetId: targetUid,
        details: `Custom Claims serveur mis à jour : rôle=${role}, actif=${isActive !== false} (par ${caller.email}).`
      });

      return res.json({ ok: true, targetUid, role });
    } catch (err) {
      return handleServerError(res, err);
    }
  });

  // 4. List Firebase Auth user metadata & custom claims (ADMIN / SUPER_ADMIN only)
  app.get('/api/admin/auth-users', async (req, res) => {
    try {
      const caller = await resolveCallerAuthorization(req);
      if (caller.effectiveRole !== 'SUPER_ADMIN' && caller.effectiveRole !== 'ADMIN') {
        throw new Error('FORBIDDEN:Accès réservé aux administrateurs.');
      }

      const listResult = await adminAuth.listUsers(200);
      const users = listResult.users.map((u) => ({
        uid: u.uid,
        email: u.email || '',
        emailVerified: u.emailVerified,
        disabled: u.disabled,
        customClaims: u.customClaims || {},
        lastSignInTime: u.metadata.lastSignInTime || null,
        creationTime: u.metadata.creationTime || null
      }));

      return res.json({ users });
    } catch (err) {
      return handleServerError(res, err);
    }
  });

  // 5. Disable/enable Firebase Auth account & revoke refresh tokens on suspension
  app.post('/api/admin/toggle-auth-disable', async (req, res) => {
    try {
      const caller = await resolveCallerAuthorization(req);
      if (caller.effectiveRole !== 'SUPER_ADMIN' && caller.effectiveRole !== 'ADMIN') {
        throw new Error('FORBIDDEN:Accès réservé aux administrateurs.');
      }

      const { targetUid, disabled } = req.body as { targetUid?: string; disabled?: boolean };
      if (!targetUid || typeof targetUid !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(targetUid)) {
        return res.status(400).json({ error: 'INVALID_TARGET', message: 'UID invalide.' });
      }
      if (targetUid === caller.uid) {
        throw new Error('FORBIDDEN:Vous ne pouvez pas désactiver votre propre compte.');
      }

      await adminAuth.updateUser(targetUid, { disabled: Boolean(disabled) });
      if (disabled) {
        await adminAuth.revokeRefreshTokens(targetUid);
      }

      await writeServerAuditLog(caller, {
        action: disabled ? 'AUTH_DISABLE_USER' : 'AUTH_ENABLE_USER',
        module: 'users',
        targetType: 'firebase_auth_user',
        targetId: targetUid,
        details: `Compte Firebase Auth ${disabled ? 'désactivé et sessions révoquées' : 'réactivé'} côté serveur.`
      });

      return res.json({ ok: true, targetUid, disabled: Boolean(disabled) });
    } catch (err) {
      return handleServerError(res, err);
    }
  });

  // -------------------------------------------------------------------------
  // VITE MIDDLEWARE (DEV) OR STATIC DIST SERVING (PRODUCTION)
  // -------------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null
      },
      appType: 'spa'
    });

    app.get('/@vite/client', (_req, res) => {
      res.type('application/javascript').send(`
const sheetsMap = new Map();
if (typeof document !== 'undefined') {
  document.querySelectorAll('style[data-vite-dev-id]').forEach((el) => {
    sheetsMap.set(el.getAttribute('data-vite-dev-id'), el);
  });
}
const cspNonce =
  typeof document !== 'undefined'
    ? document.querySelector('meta[property=csp-nonce]')?.nonce
    : undefined;
let lastInsertedStyle;

export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    if (cspNonce) {
      style.setAttribute('nonce', cspNonce);
    }
    if (!lastInsertedStyle) {
      document.head.appendChild(style);
      setTimeout(() => {
        lastInsertedStyle = undefined;
      }, 0);
    } else {
      lastInsertedStyle.insertAdjacentElement('afterend', style);
    }
    lastInsertedStyle = style;
  } else {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}

export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}

export function createHotContext() {
  const noop = () => {};
  return {
    data: {},
    accept: noop,
    acceptExports: noop,
    dispose: noop,
    prune: noop,
    decline: noop,
    invalidate: noop,
    on: noop,
    off: noop,
    send: noop
  };
}

export function injectQuery(url, queryToInject) {
  if (url[0] !== '.' && url[0] !== '/') {
    return url;
  }
  const pathname = url.replace(/[?#].*$/, '');
  const { search, hash } = new URL(url, 'http://vite.dev');
  return \`\${pathname}?\${queryToInject}\${search ? '&' + search.slice(1) : ''}\${hash || ''}\`;
}

export class ErrorOverlay extends (typeof HTMLElement !== 'undefined' ? HTMLElement : class {}) {}
`);
    });

    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Zaure server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
