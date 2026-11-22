import {
  multiFactor,
  reload,
  TotpMultiFactorGenerator,
  TotpSecret
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { auth, dbFirestore } from '../firebaseClient';
import {
  SupportTicket,
  SupportTicketCategory,
  UserProfile,
  UserSessionRecord
} from '../types';

const DEVICE_ID_STORAGE_KEY = 'zaure_device_session_id';

export function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing && /^[a-zA-Z0-9_-]{6,48}$/.test(existing)) {
      return existing;
    }
    const rand = Math.random().toString(36).slice(2, 10);
    const created = `dev_${Date.now().toString(36)}_${rand}`.slice(0, 40);
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, created);
    return created;
  } catch {
    return `dev_${Date.now().toString(36)}`;
  }
}

export function getSessionDocId(userId: string, deviceId = getOrCreateDeviceId()): string {
  return `${userId}_${deviceId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
}

export function parseClientDeviceInfo(): {
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  os: string;
  browser: string;
} {
  if (typeof navigator === 'undefined') {
    return {
      deviceName: 'Navigateur Web',
      deviceType: 'desktop',
      os: 'Système inconnu',
      browser: 'Navigateur'
    };
  }
  const ua = navigator.userAgent || '';

  let os = 'Système inconnu';
  if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPod/i.test(ua)) os = 'iOS';
  else if (/iPad/i.test(ua)) os = 'iPadOS';
  else if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Navigateur Web';
  if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Google Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Mozilla Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';

  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
    deviceType = 'tablet';
  } else if (/Mobile|iPhone|iPod|Android.*Mobile/i.test(ua)) {
    deviceType = 'mobile';
  }

  const deviceName = `${browser} sur ${os}`;
  return { deviceName, deviceType, os, browser };
}

export interface EnrolledMfaFactorInfo {
  uid: string;
  displayName: string;
  factorId: string;
  enrollmentTime?: string;
}

export interface MfaCapabilitiesState {
  supported: boolean;
  emailVerified: boolean;
  enrolledFactors: EnrolledMfaFactorInfo[];
  unsupportedReason?: string;
}

export const settingsService = {
  // ---------------------------------------------------------------------------
  // 1. SESSIONS & APPAREILS CONNECTÉS
  // ---------------------------------------------------------------------------
  registerCurrentSession: async (userId: string): Promise<UserSessionRecord | null> => {
    if (!dbFirestore || !auth?.currentUser || auth.currentUser.uid !== userId) return null;
    const deviceId = getOrCreateDeviceId();
    const sessionId = getSessionDocId(userId, deviceId);
    const info = parseClientDeviceInfo();
    const now = new Date().toISOString();
    const ref = doc(dbFirestore, 'user_sessions', sessionId);

    try {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const existing = snap.data() as UserSessionRecord;
        const nextRecord: UserSessionRecord = {
          id: sessionId,
          userId,
          deviceId,
          deviceName: info.deviceName.slice(0, 120),
          deviceType: info.deviceType,
          os: info.os.slice(0, 64),
          browser: info.browser.slice(0, 64),
          createdAt: existing.revoked ? now : existing.createdAt || now,
          lastActiveAt: now,
          revoked: false
        };
        await setDoc(ref, nextRecord);
        return nextRecord;
      }

      const record: UserSessionRecord = {
        id: sessionId,
        userId,
        deviceId,
        deviceName: info.deviceName.slice(0, 120),
        deviceType: info.deviceType,
        os: info.os.slice(0, 64),
        browser: info.browser.slice(0, 64),
        createdAt: now,
        lastActiveAt: now,
        revoked: false
      };
      await setDoc(ref, record);
      return record;
    } catch (error) {
      console.warn('Info - Enregistrement session:', error);
      return null;
    }
  },

  subscribeUserSessions: (
    userId: string,
    callback: (sessions: UserSessionRecord[]) => void
  ): (() => void) => {
    if (!dbFirestore || !auth?.currentUser || auth.currentUser.uid !== userId) {
      callback([]);
      return () => {};
    }
    const q = query(collection(dbFirestore, 'user_sessions'), where('userId', '==', userId));
    return onSnapshot(
      q,
      (snap) => {
        const list: UserSessionRecord[] = [];
        snap.forEach((d) => list.push(d.data() as UserSessionRecord));
        list.sort((a, b) => (b.lastActiveAt || '').localeCompare(a.lastActiveAt || ''));
        callback(list);
      },
      (err) => console.warn('Info - subscribeUserSessions:', err)
    );
  },

  watchCurrentSessionRevocation: (
    userId: string,
    onRevoked: () => void
  ): (() => void) => {
    if (!dbFirestore || !auth?.currentUser || auth.currentUser.uid !== userId) {
      return () => {};
    }
    const sessionId = getSessionDocId(userId);
    const ref = doc(dbFirestore, 'user_sessions', sessionId);
    let armed = false;
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as UserSessionRecord;
        if (!armed) {
          if (data.revoked === false) armed = true;
          return;
        }
        if (data.revoked === true) {
          onRevoked();
        }
      },
      () => {
        // ignore transient listener disconnects
      }
    );
  },

  revokeOtherSessions: async (userId: string): Promise<number> => {
    if (!dbFirestore || !auth?.currentUser || auth.currentUser.uid !== userId) return 0;
    const currentDeviceId = getOrCreateDeviceId();
    const q = query(collection(dbFirestore, 'user_sessions'), where('userId', '==', userId));
    const snap = await getDocs(q);
    const batch = writeBatch(dbFirestore);
    const now = new Date().toISOString();
    let count = 0;

    snap.forEach((d) => {
      const s = d.data() as UserSessionRecord;
      if (s.deviceId !== currentDeviceId && !s.revoked) {
        batch.update(d.ref, {
          revoked: true,
          revokedAt: now,
          lastActiveAt: s.lastActiveAt || now
        });
        count += 1;
      }
    });

    if (count > 0) {
      await batch.commit();
    }
    return count;
  },

  revokeSessionById: async (sessionId: string): Promise<void> => {
    if (!dbFirestore || !auth?.currentUser) return;
    const now = new Date().toISOString();
    await updateDoc(doc(dbFirestore, 'user_sessions', sessionId), {
      revoked: true,
      revokedAt: now
    });
  },

  // ---------------------------------------------------------------------------
  // 2. VÉRIFICATION EMAIL & 2FA (FIREBASE MULTI-FACTOR HONNÊTE)
  // ---------------------------------------------------------------------------
  refreshEmailVerificationStatus: async (): Promise<{ emailVerified: boolean; email: string }> => {
    if (!auth?.currentUser) return { emailVerified: false, email: '' };
    await reload(auth.currentUser);
    return {
      emailVerified: Boolean(auth.currentUser.emailVerified),
      email: auth.currentUser.email || ''
    };
  },

  getMfaStatus: async (): Promise<MfaCapabilitiesState> => {
    if (!auth?.currentUser) {
      return {
        supported: false,
        emailVerified: false,
        enrolledFactors: [],
        unsupportedReason: 'Utilisateur non connecté.'
      };
    }

    try {
      const mfaUser = multiFactor(auth.currentUser);
      const enrolledFactors: EnrolledMfaFactorInfo[] = (mfaUser.enrolledFactors || []).map((f) => ({
        uid: f.uid,
        displayName: f.displayName || 'Application d’authentification',
        factorId: f.factorId,
        enrollmentTime: f.enrollmentTime
      }));

      return {
        supported: true,
        emailVerified: Boolean(auth.currentUser.emailVerified),
        enrolledFactors
      };
    } catch {
      return {
        supported: false,
        emailVerified: Boolean(auth.currentUser.emailVerified),
        enrolledFactors: [],
        unsupportedReason:
          "L'authentification multifacteur (MFA) n'est pas activée sur ce projet Firebase."
      };
    }
  },

  startTotpMfaEnrollment: async (): Promise<{
    secret?: TotpSecret;
    otpAuthUri?: string;
    manualKey?: string;
    error?: string;
    unsupported?: boolean;
  }> => {
    if (!auth?.currentUser) return { error: 'Utilisateur non connecté.' };
    if (!auth.currentUser.emailVerified) {
      return {
        error:
          'Veuillez d’abord vérifier votre adresse e-mail avant d’activer la double authentification.'
      };
    }

    try {
      const session = await multiFactor(auth.currentUser).getSession();
      const totpSecret = await TotpMultiFactorGenerator.generateSecret(session);
      const accountName = auth.currentUser.email || auth.currentUser.uid;
      const otpAuthUri = totpSecret.generateQrCodeUrl(accountName, 'ZAURE');
      return {
        secret: totpSecret,
        otpAuthUri,
        manualKey: totpSecret.secretKey
      };
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/operation-not-allowed' || code === 'auth/unsupported-first-factor') {
        return {
          unsupported: true,
          error:
            "Le fournisseur TOTP (2FA) nécessite Firebase Identity Platform sur le serveur. Contactez l'administrateur du projet ou activez Identity Platform MFA dans la console Firebase."
        };
      }
      if (code === 'auth/requires-recent-login') {
        return {
          error:
            'Par mesure de sécurité, veuillez vous reconnecter récemment avant de configurer la double authentification.'
        };
      }
      return { error: err?.message || 'Impossible de préparer la double authentification.' };
    }
  },

  finalizeTotpMfaEnrollment: async (
    secret: TotpSecret,
    verificationCode: string,
    displayName = 'Application TOTP'
  ): Promise<{ success: boolean; error?: string }> => {
    if (!auth?.currentUser) return { success: false, error: 'Utilisateur non connecté.' };
    try {
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(
        secret,
        verificationCode.trim()
      );
      await multiFactor(auth.currentUser).enroll(assertion, displayName);
      return { success: true };
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/invalid-verification-code') {
        return { success: false, error: 'Code à 6 chiffres invalide ou expiré.' };
      }
      return { success: false, error: err?.message || 'Échec de validation du code 2FA.' };
    }
  },

  unenrollMfaFactor: async (factorUid: string): Promise<{ success: boolean; error?: string }> => {
    if (!auth?.currentUser) return { success: false, error: 'Utilisateur non connecté.' };
    try {
      await multiFactor(auth.currentUser).unenroll(factorUid);
      return { success: true };
    } catch (err: any) {
      if (err?.code === 'auth/requires-recent-login') {
        return {
          success: false,
          error: 'Veuillez vous reconnecter récemment avant de désactiver la double authentification.'
        };
      }
      return { success: false, error: err?.message || 'Impossible de désactiver la 2FA.' };
    }
  },

  // ---------------------------------------------------------------------------
  // 3. AIDE, SUPPORT & TICKETS
  // ---------------------------------------------------------------------------
  submitSupportTicket: async (
    user: UserProfile,
    input: {
      category: SupportTicketCategory;
      subject: string;
      description: string;
    }
  ): Promise<{ ticket?: SupportTicket; error?: string }> => {
    if (!dbFirestore || !auth?.currentUser || auth.currentUser.uid !== user.id) {
      return { error: 'Vous devez être connecté pour envoyer une demande.' };
    }
    const safeSubject = input.subject.trim().slice(0, 160);
    const safeDesc = input.description.trim().slice(0, 3000);
    if (safeSubject.length < 2) {
      return { error: 'Le sujet doit contenir au moins 2 caractères.' };
    }
    if (safeDesc.length < 5) {
      return { error: 'Veuillez décrire votre demande (au moins 5 caractères).' };
    }

    const now = new Date().toISOString();
    const ticketId = `tkt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const info = parseClientDeviceInfo();
    const ticket: SupportTicket = {
      id: ticketId,
      userId: user.id,
      userName: (user.nom || 'Membre Zaure').slice(0, 120),
      userEmail: (user.email || auth.currentUser.email || '').slice(0, 200),
      category: input.category,
      subject: safeSubject,
      description: safeDesc,
      deviceInfo: `${info.deviceName} (${info.deviceType})`.slice(0, 200),
      status: 'open',
      createdAt: now,
      updatedAt: now
    };

    try {
      await setDoc(doc(dbFirestore, 'support_tickets', ticketId), ticket);
      return { ticket };
    } catch (err: any) {
      return { error: err?.message || "Impossible d'envoyer votre demande." };
    }
  },

  getUserSupportTickets: async (userId: string): Promise<SupportTicket[]> => {
    if (!dbFirestore || !auth?.currentUser || auth.currentUser.uid !== userId) return [];
    try {
      const q = query(collection(dbFirestore, 'support_tickets'), where('userId', '==', userId));
      const snap = await getDocs(q);
      const list: SupportTicket[] = [];
      snap.forEach((d) => list.push(d.data() as SupportTicket));
      return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } catch {
      return [];
    }
  }
};
