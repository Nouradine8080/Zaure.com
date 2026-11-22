import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  updateEmail,
  updatePassword,
  deleteUser,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  fetchSignInMethodsForEmail,
  EmailAuthProvider,
  reauthenticateWithCredential
} from 'firebase/auth';
import { 
  initializeFirestore,
  getFirestore, 
  setLogLevel,
  doc, 
  getDoc, 
  getDocFromServer,
  setDoc, 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  deleteDoc,
  updateDoc,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  increment,
  limit
} from 'firebase/firestore';
import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL
} from 'firebase/storage';
import { 
  UserProfile, 
  Circle, 
  CircleMember, 
  Capsule, 
  Comment, 
  Reaction, 
  Message, 
  UserSettings, 
  DEFAULT_USER_SETTINGS,
  Conversation,
  ConversationParticipant,
  MessageAttachment,
  MessageReplyInfo,
  UserReport,
  UserPrivacySettings,
  DEFAULT_PRIVACY_SETTINGS
} from './types';

// Firebase Project Config
const firebaseConfig = {
  apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY || 'AIzaSyDhuMBmcKHsoESsknVacAy5haI6PmK6aw8',
  authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN || 'zaure-com.firebaseapp.com',
  projectId: (import.meta as any).env.VITE_FIREBASE_PROJECT_ID || 'zaure-com',
  storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET || 'zaure-com.firebasestorage.app',
  messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID || '893077823490',
  appId: (import.meta as any).env.VITE_FIREBASE_APP_ID || '1:893077823490:web:af344c02ef2e2ab492071b'
};

export const isFirebaseConfigured = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

export let auth: any = null;
export let dbFirestore: any = null;
export let storage: any = null;

if (isFirebaseConfigured) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    try {
      dbFirestore = initializeFirestore(app, {
        experimentalAutoDetectLongPolling: true
      });
    } catch {
      dbFirestore = getFirestore(app);
    }
    try {
      storage = getStorage(app);
    } catch (sErr) {
      console.warn('Info - initialisation Storage:', sErr);
    }
    setLogLevel('silent');
  } catch (error) {
    console.warn('Info - initialisation Firebase:', error);
  }
}

let currentUser: UserProfile | null = null;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  if (!dbFirestore) return;
  try {
    await getDocFromServer(doc(dbFirestore, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export function sanitizeUsername(raw: string | undefined | null, fallbackName?: string): string {
  const source = (raw && raw.trim()) ? raw.trim() : (fallbackName || 'membre_zaure');
  const clean = source
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9._]+/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, 32);
  return clean || 'membre_zaure';
}

export function sanitizeWebsiteUrl(raw: string | undefined | null): string {
  const val = (raw || '').trim();
  if (!val) return '';
  const withProto = /^https?:\/\//i.test(val) ? val : `https://${val}`;
  try {
    const parsed = new URL(withProto);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString().slice(0, 300);
    }
    return '';
  } catch {
    return '';
  }
}

export function normalizePrivacySettings(raw: any): UserPrivacySettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_PRIVACY_SETTINGS };
  }
  const validAud = new Set(['public', 'followers', 'cercles', 'private']);
  const validMsg = new Set(['tous', 'followers', 'cercles', 'mentors', 'personne']);
  const validInt = new Set(['tous', 'followers', 'cercles', 'personne']);
  return {
    profileMode: raw.profileMode === 'private' ? 'private' : 'public',
    infoVisibility: validAud.has(raw.infoVisibility) ? raw.infoVisibility : 'public',
    postsVisibility: validAud.has(raw.postsVisibility) ? raw.postsVisibility : 'public',
    followersVisibility: validAud.has(raw.followersVisibility) ? raw.followersVisibility : 'public',
    followingVisibility: validAud.has(raw.followingVisibility) ? raw.followingVisibility : 'public',
    communitiesVisibility: validAud.has(raw.communitiesVisibility) ? raw.communitiesVisibility : 'public',
    allowMessages: validMsg.has(raw.allowMessages) ? raw.allowMessages : 'tous',
    allowComments: validInt.has(raw.allowComments) ? raw.allowComments : 'tous',
    allowMentions: validInt.has(raw.allowMentions) ? raw.allowMentions : 'tous'
  };
}

function mapPublicProfileData(id: string, data: any): UserProfile {
  return {
    id: data?.id || id,
    nom: data?.nom || 'Membre Zaure',
    username: data?.username || sanitizeUsername(undefined, data?.nom),
    email: '',
    bio: data?.bio || null,
    avatar_url: data?.avatar_url || null,
    cover_url: data?.cover_url || null,
    profession: data?.profession || '',
    formation: data?.formation || '',
    localisation: data?.localisation || '',
    site_web: data?.site_web || '',
    infos_complementaires: data?.infos_complementaires || '',
    privacy_settings: normalizePrivacySettings(data?.privacy_settings),
    role: data?.role || 'utilisateur',
    langue_preferee: data?.langue_preferee || 'fr',
    availability: data?.availability || 'online',
    status_message: data?.status_message || '',
    last_active: data?.last_active,
    created_at: data?.created_at
  };
}

function buildPublicProfilePayload(profile: UserProfile) {
  const payload: Record<string, any> = {
    id: profile.id,
    nom: (profile.nom || 'Membre Zaure').slice(0, 120),
    username: sanitizeUsername(profile.username, profile.nom).slice(0, 40),
    bio: profile.bio ? profile.bio.slice(0, 1000) : null,
    avatar_url: profile.avatar_url || null,
    cover_url: profile.cover_url || null,
    profession: (profile.profession || '').slice(0, 120),
    formation: (profile.formation || '').slice(0, 160),
    localisation: (profile.localisation || '').slice(0, 120),
    site_web: sanitizeWebsiteUrl(profile.site_web).slice(0, 300),
    infos_complementaires: (profile.infos_complementaires || '').slice(0, 1000),
    privacy_settings: normalizePrivacySettings(profile.privacy_settings),
    role: profile.role || 'utilisateur',
    langue_preferee: profile.langue_preferee || 'fr',
    availability: profile.availability || 'online',
    status_message: (profile.status_message || '').slice(0, 160),
    last_active: profile.last_active || new Date().toISOString(),
    created_at: profile.created_at || new Date().toISOString()
  };
  return payload;
}

async function syncPublicProfile(profile: UserProfile): Promise<void> {
  if (!dbFirestore || !auth?.currentUser || auth.currentUser.uid !== profile.id) return;
  try {
    await setDoc(doc(dbFirestore, 'public_profiles', profile.id), buildPublicProfilePayload(profile), { merge: true });
  } catch (err) {
    console.warn('Info - sync public_profiles:', err);
  }
}

// Helper pour traduire les erreurs Firebase Auth en français clair
export const formatFirebaseAuthError = (err: any): string => {
  if (!err) return "Une erreur d'authentification est survenue.";
  const code = err.code || '';
  switch (code) {
    case 'auth/user-not-found':
      return "Aucun compte n'est associé à cette adresse e-mail.";
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return "Adresse e-mail ou mot de passe incorrect.";
    case 'auth/email-already-in-use':
      return "Cette adresse e-mail est déjà utilisée par un autre compte. Veuillez vous connecter.";
    case 'auth/weak-password':
      return "Le mot de passe doit comporter au moins 6 caractères.";
    case 'auth/invalid-email':
      return "Le format de l'adresse e-mail est invalide.";
    case 'auth/popup-closed-by-user':
      return "La fenêtre de connexion Google a été fermée avant la validation.";
    case 'auth/popup-blocked':
      return "La fenêtre popup a été bloquée par le navigateur. Autorisez les popups pour continuer.";
    case 'auth/too-many-requests':
      return "Trop de tentatives infructueuses. Veuillez patienter quelques instants avant de réessayer.";
    case 'auth/network-request-failed':
      return "Problème de connexion réseau. Vérifiez votre accès internet.";
    case 'auth/operation-not-allowed':
      return "Cette méthode de connexion n'est pas encore activée dans votre console Firebase.";
    case 'auth/billing-not-enabled':
      return "L'envoi de SMS par Firebase nécessite l'activation de la facturation (Plan Blaze) sur la console Firebase, ou l'utilisation de numéros de test. Veuillez utiliser la connexion par e-mail ou Google.";
    case 'auth/invalid-phone-number':
      return "Format du numéro de téléphone invalide. Utilisez le format international (ex: +227 90 12 34 56).";
    case 'auth/quota-exceeded':
      return "Quota SMS Firebase dépassé. Veuillez réessayez plus tard ou utiliser la connexion par e-mail.";
    case 'auth/captcha-check-failed':
      return "La vérification de sécurité reCAPTCHA a échoué. Veuillez rafraîchir et réessayez.";
    case 'auth/argument-error':
      return "Numéro de téléphone ou paramètre SMS invalide. Vérifiez le format international.";
    default:
      return err.message || "Une erreur d'authentification est survenue.";
  }
};

// ----------------------------------------------------
// DIRECT FIREBASE ZAURE SERVICE (NO LOCAL FALLBACK OR LOCALSTORAGE MOCK DATA)
// ----------------------------------------------------
export const zaureService = {
  getMode: (): 'cloud' => 'cloud',

  getCurrentUser: (): UserProfile | null => currentUser,

  onAuthStateChangedListener: (callback: (user: UserProfile | null) => void): (() => void) => {
    if (!auth) {
      callback(null);
      return () => {};
    }
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && dbFirestore) {
        try {
          const userDoc = await getDoc(doc(dbFirestore, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            currentUser = userDoc.data() as UserProfile;
          } else {
            currentUser = {
              id: firebaseUser.uid,
              nom: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Membre',
              email: firebaseUser.email || '',
              bio: null,
              avatar_url: firebaseUser.photoURL || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200`,
              role: 'utilisateur',
              langue_preferee: 'fr',
              created_at: new Date().toISOString()
            };
            await setDoc(doc(dbFirestore, 'users', firebaseUser.uid), currentUser);
          }
          await syncPublicProfile(currentUser);
        } catch (e) {
          console.warn('Erreur lors de la récupération du profil utilisateur:', e);
        }
      } else {
        currentUser = null;
      }
      callback(currentUser);
    });
  },

  // --- AUTHENTICATION ---
  signUp: async (
    nom: string, 
    email: string, 
    bio: string, 
    role: 'utilisateur' | 'mentor' | 'verifie' = 'utilisateur', 
    langue: 'fr' | 'ha' | 'en' = 'fr',
    password?: string,
    avatarUrl?: string,
    phone?: string
  ): Promise<{ user: UserProfile | null, error: string | null }> => {
    if (!auth || !dbFirestore) {
      return { user: null, error: 'Firebase n\'est pas connecté.' };
    }
    try {
      const securePassword = password || 'Password123!';
      const { user: firebaseUser } = await createUserWithEmailAndPassword(auth, email, securePassword);
      if (firebaseUser) {
        const finalAvatar = avatarUrl || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200`;
        
        // Mettre à jour le profil standard Firebase Auth (displayName et photoURL si URL courte)
        try {
          const authProfileUpdate: { displayName: string; photoURL?: string } = { displayName: nom };
          if (finalAvatar && !finalAvatar.startsWith('data:') && finalAvatar.length < 1800) {
            authProfileUpdate.photoURL = finalAvatar;
          }
          await updateProfile(firebaseUser, authProfileUpdate);
        } catch (profileErr) {
          console.warn('Note: mise à jour du displayName Firebase:', profileErr);
        }

        // Envoyer la vérification d'email de manière asynchrone sans bloquer l'inscription
        try {
          await sendEmailVerification(firebaseUser);
        } catch (verificationErr) {
          console.warn('Note: envoi de l\'email de vérification:', verificationErr);
        }

        const profile: UserProfile = {
          id: firebaseUser.uid,
          nom: nom.trim().slice(0, 120),
          email: email.trim().slice(0, 200),
          ...(phone?.trim() ? { phone: phone.trim().slice(0, 32) } : {}),
          bio: bio ? bio.trim().slice(0, 1000) : null,
          avatar_url: finalAvatar,
          role,
          langue_preferee: langue,
          created_at: new Date().toISOString()
        };
        
        await setDoc(doc(dbFirestore, 'users', firebaseUser.uid), profile);
        await syncPublicProfile(profile);
        currentUser = profile;
        return { user: profile, error: null };
      }
      return { user: null, error: 'L\'inscription a échoué.' };
    } catch (err: any) {
      return { user: null, error: formatFirebaseAuthError(err) };
    }
  },

  checkEmailAvailable: async (email: string): Promise<{ available: boolean; error: string | null }> => {
    const normalized = email.trim().toLowerCase();
    if (!auth) {
      return { available: true, error: null };
    }
    try {
      const methods = await fetchSignInMethodsForEmail(auth, normalized);
      if (Array.isArray(methods) && methods.length > 0) {
        return {
          available: false,
          error: "Cette adresse e-mail est déjà associée à un compte Zaure. Veuillez vous connecter ou utiliser une autre adresse."
        };
      }
      return { available: true, error: null };
    } catch (err: any) {
      if (err?.code === 'auth/invalid-email') {
        return { available: false, error: formatFirebaseAuthError(err) };
      }
      // If email enumeration protection or network check doesn't reveal methods, allow step progression;
      // Firebase createUserWithEmailAndPassword enforces uniqueness cleanly on finalization.
      return { available: true, error: null };
    }
  },

  signIn: async (email: string, password?: string): Promise<{ user: UserProfile | null, error: string | null }> => {
    if (!auth || !dbFirestore) {
      return { user: null, error: 'Firebase n\'est pas connecté.' };
    }
    try {
      const securePassword = password || 'Password123!';
      const { user: firebaseUser } = await signInWithEmailAndPassword(auth, email, securePassword);
      if (firebaseUser) {
        const userDoc = await getDoc(doc(dbFirestore, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const profile = userDoc.data() as UserProfile;
          currentUser = profile;
          await syncPublicProfile(profile);
          return { user: profile, error: null };
        }
        const profile: UserProfile = {
          id: firebaseUser.uid,
          nom: (firebaseUser.displayName || email.split('@')[0]).slice(0, 120),
          email: (firebaseUser.email || email).slice(0, 200),
          bio: 'Inscrit via email',
          avatar_url: firebaseUser.photoURL || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200`,
          role: 'utilisateur',
          langue_preferee: 'fr',
          created_at: new Date().toISOString()
        };
        await setDoc(doc(dbFirestore, 'users', firebaseUser.uid), profile);
        await syncPublicProfile(profile);
        currentUser = profile;
        return { user: profile, error: null };
      }
      return { user: null, error: 'La connexion a échoué.' };
    } catch (err: any) {
      return { user: null, error: formatFirebaseAuthError(err) };
    }
  },

  signInWithGoogle: async (): Promise<{ user: UserProfile | null, error: string | null }> => {
    if (!auth || !dbFirestore) {
      return { user: null, error: 'Firebase n\'est pas connecté.' };
    }
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      if (firebaseUser) {
        const userDoc = await getDoc(doc(dbFirestore, 'users', firebaseUser.uid));
        let profile: UserProfile;
        if (userDoc.exists()) {
          profile = userDoc.data() as UserProfile;
        } else {
          profile = {
            id: firebaseUser.uid,
            nom: (firebaseUser.displayName || 'Utilisateur Google').slice(0, 120),
            email: (firebaseUser.email || '').slice(0, 200),
            bio: 'Inscrit via Google',
            avatar_url: firebaseUser.photoURL || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200`,
            role: 'utilisateur',
            langue_preferee: 'fr',
            created_at: new Date().toISOString()
          };
          await setDoc(doc(dbFirestore, 'users', firebaseUser.uid), profile);
        }
        await syncPublicProfile(profile);
        currentUser = profile;
        return { user: profile, error: null };
      }
      return { user: null, error: 'La connexion Google a échoué.' };
    } catch (err: any) {
      return { user: null, error: formatFirebaseAuthError(err) };
    }
  },

  createRecaptchaVerifier: (elementId: string) => {
    if (!auth) throw new Error("Firebase Auth non initialisé");
    const el = document.getElementById(elementId);
    if (el) {
      el.innerHTML = '';
    }
    return new RecaptchaVerifier(auth, elementId, {
      size: 'normal',
      callback: () => {},
      'expired-callback': () => {}
    });
  },

  signInWithPhone: async (phoneNumber: string, recaptchaVerifier: any): Promise<{ confirmationResult: any; error: string | null }> => {
    if (!auth) {
      return { confirmationResult: null, error: 'Firebase n\'est pas connecté.' };
    }
    try {
      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
      return { confirmationResult, error: null };
    } catch (err: any) {
      return { confirmationResult: null, error: formatFirebaseAuthError(err) };
    }
  },

  confirmPhoneCode: async (
    confirmationResult: any, 
    code: string,
    profileData?: { nom: string; role: any; bio: string; langue: any; avatarUrl: string }
  ): Promise<{ user: UserProfile | null; error: string | null }> => {
    if (!auth || !dbFirestore) {
      return { user: null, error: 'Firebase n\'est pas connecté.' };
    }
    try {
      const result = await confirmationResult.confirm(code);
      const firebaseUser = result.user;
      if (firebaseUser) {
        const userDoc = await getDoc(doc(dbFirestore, 'users', firebaseUser.uid));
        let profile: UserProfile;
        if (userDoc.exists()) {
          profile = userDoc.data() as UserProfile;
        } else {
          const finalAvatar = profileData?.avatarUrl || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200`;
          profile = {
            id: firebaseUser.uid,
            nom: profileData?.nom || 'Membre Zaure',
            email: firebaseUser.email || `${firebaseUser.phoneNumber?.replace('+', '') || 'user'}@zaure.net`,
            bio: profileData?.bio || 'Inscrit par numéro de téléphone',
            avatar_url: finalAvatar,
            role: profileData?.role || 'utilisateur',
            langue_preferee: profileData?.langue || 'fr',
            created_at: new Date().toISOString()
          };
          await setDoc(doc(dbFirestore, 'users', firebaseUser.uid), profile);
        }
        await syncPublicProfile(profile);
        currentUser = profile;
        return { user: profile, error: null };
      }
      return { user: null, error: 'La validation du code SMS a échoué.' };
    } catch (err: any) {
      return { user: null, error: formatFirebaseAuthError(err) };
    }
  },

  sendPasswordReset: async (email: string): Promise<{ success: boolean; error: string | null }> => {
    if (!auth) {
      return { success: false, error: 'Firebase n\'est pas connecté.' };
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: formatFirebaseAuthError(err) };
    }
  },

  sendEmailVerificationLink: async (): Promise<{ success: boolean; error: string | null }> => {
    if (!auth || !auth.currentUser) {
      return { success: false, error: 'Aucun utilisateur connecté pour la vérification.' };
    }
    try {
      await sendEmailVerification(auth.currentUser);
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: formatFirebaseAuthError(err) };
    }
  },

  signOut: async () => {
    if (auth) {
      try {
        await firebaseSignOut(auth);
      } catch (e) {
        console.error('Erreur déconnexion Firebase:', e);
      }
    }
    currentUser = null;
  },

  getAvailableUsers: async (): Promise<UserProfile[]> => {
    if (!dbFirestore || !auth?.currentUser) return [];
    try {
      const snap = await getDocs(collection(dbFirestore, 'public_profiles'));
      const list: UserProfile[] = [];
      snap.forEach(d => {
        const data = d.data();
        list.push(mapPublicProfileData(d.id, data));
      });
      if (currentUser && !list.some(u => u.id === currentUser!.id)) {
        list.push({ ...currentUser, email: '' });
      }
      return list;
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'public_profiles');
    }
  },

  subscribePublicProfilesPresence: (callback: (users: UserProfile[]) => void): (() => void) => {
    if (!dbFirestore || !auth?.currentUser) {
      callback([]);
      return () => {};
    }
    const q = collection(dbFirestore, 'public_profiles');
    return onSnapshot(
      q,
      (snap) => {
        const list: UserProfile[] = [];
        snap.forEach((d) => {
          list.push(mapPublicProfileData(d.id, d.data()));
        });
        if (currentUser && !list.some((u) => u.id === currentUser!.id)) {
          list.push({ ...currentUser, email: '' });
        }
        callback(list);
      },
      (error) => {
        console.warn('Info - listener public_profiles:', error);
      }
    );
  },

  // --- CIRCLES ---
  getCircles: async (): Promise<Circle[]> => {
    if (!dbFirestore) return [];
    const SEEDED_FICTIONAL_CIRCLE_IDS = new Set([
      'circle-sante-premiers-secours',
      'circle-langues-locales',
      'circle-agri-sahel'
    ]);

    try {
      const querySnapshot = await getDocs(collection(dbFirestore, 'circles'));
      const cloudCircles: Circle[] = [];
      querySnapshot.forEach((docSnap) => {
        const c = docSnap.data() as Circle;
        const isFictional =
          SEEDED_FICTIONAL_CIRCLE_IDS.has(c.id) ||
          !c.created_by ||
          c.id.startsWith('demo-') ||
          c.id.startsWith('mock-') ||
          c.id.includes('demo') ||
          (c.nom &&
            (c.nom.toLowerCase().includes('démo') ||
              c.nom.toLowerCase().includes('demo') ||
              c.nom.toLowerCase().includes('exemple')));

        if (!isFictional) {
          cloudCircles.push(c);
        } else if (auth?.currentUser && c.created_by === auth.currentUser.uid) {
          deleteDoc(doc(dbFirestore, 'circles', docSnap.id)).catch(() => {});
          deleteDoc(
            doc(dbFirestore, 'circle_members', `${auth.currentUser.uid}_${docSnap.id}`)
          ).catch(() => {});
        }
      });

      return cloudCircles.sort((a, b) => a.nom.localeCompare(b.nom));
    } catch (error) {
      console.warn('Info - Chargement cercles:', error);
      return [];
    }
  },

  deleteCircle: async (circleId: string): Promise<boolean> => {
    if (!dbFirestore || !auth?.currentUser) return false;
    try {
      await deleteDoc(doc(dbFirestore, 'circles', circleId));
      try {
        const q = query(
          collection(dbFirestore, 'circle_members'),
          where('user_id', '==', auth.currentUser.uid),
          where('circle_id', '==', circleId)
        );
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          await deleteDoc(d.ref);
        }
      } catch {
        // ignore member cleanup error
      }
      return true;
    } catch (error) {
      console.warn('Info - Supprimer cercle:', error);
      return false;
    }
  },

  createCircle: async (nom: string, description: string, categorie: string, image: string): Promise<Circle> => {
    if (!dbFirestore || !currentUser) throw new Error('Utilisateur non connecté.');
    const newCircle: Circle & { created_by: string } = {
      id: `circle-${Date.now()}`,
      nom: nom.trim().slice(0, 120),
      description: description.trim().slice(0, 1000),
      categorie: categorie.trim().slice(0, 60),
      image: image || 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&q=80&w=600',
      created_by: currentUser.id,
      created_at: new Date().toISOString()
    };

    try {
      await setDoc(doc(dbFirestore, 'circles', newCircle.id), newCircle);
      const member: CircleMember = {
        user_id: currentUser.id,
        circle_id: newCircle.id,
        role: 'moderateur',
        joined_at: new Date().toISOString()
      };
      await setDoc(doc(dbFirestore, 'circle_members', `${currentUser.id}_${newCircle.id}`), member);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `circles/${newCircle.id}`);
    }
    return newCircle;
  },

  updateCircle: async (
    circleId: string,
    updates: { nom?: string; description?: string; categorie?: string; image?: string }
  ): Promise<Circle | null> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Utilisateur non connecté.');
    const circleRef = doc(dbFirestore, 'circles', circleId);
    const sanitized: Record<string, string> = {};

    if (typeof updates.nom === 'string') {
      const trimmedNom = updates.nom.trim().slice(0, 120);
      if (trimmedNom.length < 2) {
        throw new Error('Le nom du cercle doit contenir au moins 2 caractères.');
      }
      sanitized.nom = trimmedNom;
    }

    if (typeof updates.description === 'string') {
      const trimmedDesc = updates.description.trim().slice(0, 1000);
      if (trimmedDesc.length < 1) {
        throw new Error('La description du cercle est requise.');
      }
      sanitized.description = trimmedDesc;
    }

    if (typeof updates.categorie === 'string') {
      const trimmedCat = updates.categorie.trim().slice(0, 60);
      if (trimmedCat.length < 1) {
        throw new Error('La catégorie est requise.');
      }
      sanitized.categorie = trimmedCat;
    }

    if (typeof updates.image === 'string') {
      const trimmedImg = updates.image.trim();
      if (trimmedImg.length <= 350000) {
        sanitized.image = trimmedImg;
      }
    }

    try {
      await updateDoc(circleRef, sanitized);
      const updatedSnap = await getDoc(circleRef);
      if (updatedSnap.exists()) {
        return updatedSnap.data() as Circle;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `circles/${circleId}`);
      return null;
    }
  },

  // --- CIRCLE MEMBERSHIP ---
  getJoinedCircleIds: async (userId: string): Promise<string[]> => {
    if (!dbFirestore) return [];
    const SEEDED_FICTIONAL_CIRCLE_IDS = new Set([
      'circle-sante-premiers-secours',
      'circle-langues-locales',
      'circle-agri-sahel'
    ]);
    try {
      const q = query(collection(dbFirestore, 'circle_members'), where('user_id', '==', userId));
      const querySnapshot = await getDocs(q);
      const joined: string[] = [];
      querySnapshot.forEach((docSnap) => {
        const m = docSnap.data() as CircleMember;
        const isFictional =
          SEEDED_FICTIONAL_CIRCLE_IDS.has(m.circle_id) ||
          m.circle_id.startsWith('demo-') ||
          m.circle_id.startsWith('mock-');
        if (isFictional) {
          if (auth?.currentUser && m.user_id === auth.currentUser.uid) {
            deleteDoc(docSnap.ref).catch(() => {});
          }
        } else {
          joined.push(m.circle_id);
        }
      });
      return joined;
    } catch (error) {
      console.warn('Info - Membres cercles:', error);
      return [];
    }
  },

  joinCircle: async (circleId: string, userId: string): Promise<boolean> => {
    if (!dbFirestore) return false;
    const newMember: CircleMember = {
      user_id: userId,
      circle_id: circleId,
      role: 'membre',
      joined_at: new Date().toISOString()
    };

    try {
      await setDoc(doc(dbFirestore, 'circle_members', `${userId}_${circleId}`), newMember);
      return true;
    } catch (error) {
      console.warn('Info - Rejoindre cercle:', error);
      return false;
    }
  },

  leaveCircle: async (circleId: string, userId: string): Promise<boolean> => {
    if (!dbFirestore) return false;
    try {
      await deleteDoc(doc(dbFirestore, 'circle_members', `${userId}_${circleId}`));
      return true;
    } catch (error) {
      console.warn('Info - Quitter cercle:', error);
      return false;
    }
  },

  // --- CAPSULES ---
  getCapsules: async (circleIds?: string[]): Promise<Capsule[]> => {
    if (!dbFirestore || !auth?.currentUser) return [];
    try {
      let capsulesData: Capsule[] = [];

      if (circleIds && circleIds.length === 1) {
        const targetCircleId = circleIds[0];
        
        // Filtered Firestore query by circleId / circle_id
        try {
          const q1 = query(collection(dbFirestore, 'capsules'), where('circleId', '==', targetCircleId));
          const snap1 = await getDocs(q1);
          snap1.forEach((docSnap) => {
            capsulesData.push({ id: docSnap.id, ...docSnap.data() } as Capsule);
          });
        } catch (e) {
          console.warn('Query circleId:', e);
        }

        try {
          const q2 = query(collection(dbFirestore, 'capsules'), where('circle_id', '==', targetCircleId));
          const snap2 = await getDocs(q2);
          snap2.forEach((docSnap) => {
            if (!capsulesData.some(c => c.id === docSnap.id)) {
              capsulesData.push({ id: docSnap.id, ...docSnap.data() } as Capsule);
            }
          });
        } catch (e) {
          console.warn('Query circle_id:', e);
        }

        // Fallback filter if no direct query match
        if (capsulesData.length === 0) {
          const allSnap = await getDocs(collection(dbFirestore, 'capsules'));
          allSnap.forEach((docSnap) => {
            const data = docSnap.data() as any;
            if (data.circle_id === targetCircleId || data.circleId === targetCircleId) {
              capsulesData.push({ id: docSnap.id, ...data } as Capsule);
            }
          });
        }
      } else {
        const querySnapshot = await getDocs(collection(dbFirestore, 'capsules'));
        querySnapshot.forEach((docSnap) => {
          capsulesData.push({ id: docSnap.id, ...docSnap.data() } as Capsule);
        });

        if (circleIds && circleIds.length > 0) {
          capsulesData = capsulesData.filter(c => 
            circleIds.includes(c.circle_id) || circleIds.includes((c as any).circleId)
          );
        }
      }

      // Filter out demo and seeded fictional capsules
      const SEEDED_FICTIONAL_CIRCLE_IDS = new Set([
        'circle-sante-premiers-secours',
        'circle-langues-locales',
        'circle-agri-sahel'
      ]);
      capsulesData = capsulesData.filter(c => {
        const cid = c.circle_id || (c as any).circleId;
        const isDemo = c.id.startsWith('demo-') || 
                       c.id.startsWith('mock-') || 
                       c.id.startsWith('capsule-brulures-') ||
                       c.id.includes('demo') ||
                       SEEDED_FICTIONAL_CIRCLE_IDS.has(cid) ||
                       (c.contenu && (
                         c.contenu.toLowerCase().includes('démo') || 
                         c.contenu.toLowerCase().includes('demo') ||
                         c.contenu.toLowerCase().includes('bienvenue sur zaure')
                       ));
        if (isDemo) {
          if (auth?.currentUser && c.auteur_id === auth.currentUser.uid) {
            deleteDoc(doc(dbFirestore, 'capsules', c.id)).catch(() => {});
          }
          return false;
        }
        return true;
      });

      // Sort descending by date
      capsulesData.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

      const circlesData = await zaureService.getCircles();
      const finalCapsules: Capsule[] = [];

      for (const c of capsulesData) {
        let auteurNom = c.auteur_nom || 'Auteur inconnu';
        let auteurRole = c.auteur_role || 'utilisateur';
        let auteurAvatar = c.auteur_avatar || '';

        try {
          const uDoc = await getDoc(doc(dbFirestore, 'public_profiles', c.auteur_id));
          if (uDoc.exists()) {
            const profile = uDoc.data() as UserProfile;
            auteurNom = profile.nom;
            auteurRole = profile.role;
            auteurAvatar = profile.avatar_url || '';
          }
        } catch (e) {
          // ignore profile fetch error
        }

        const cid = c.circle_id || (c as any).circleId || 'public';
        finalCapsules.push({
          ...c,
          circle_id: cid,
          auteur_nom: auteurNom,
          auteur_role: auteurRole,
          auteur_avatar: auteurAvatar,
          circle_nom:
            cid === 'public'
              ? 'Fil public'
              : circlesData.find(circ => circ.id === cid)?.nom || c.circle_nom || 'Cercle'
        });
      }

      return finalCapsules.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'capsules');
    }
  },

  createCapsule: async (
    circleId: string, 
    type: 'texte' | 'audio', 
    contenu: string, 
    langue: 'fr' | 'ha' | 'en' = 'fr'
  ): Promise<Capsule> => {
    if (!currentUser) throw new Error('Utilisateur non connecté.');
    if (!dbFirestore) throw new Error('Firestore non connecté.');

    const safeContenu = (contenu || '').trim().slice(0, 650000);
    if (!safeContenu) throw new Error('Le contenu de la capsule ne peut pas être vide.');

    const targetCircleId = (circleId || '').trim() || 'public';
    let circleNom = 'Fil public';
    if (targetCircleId !== 'public') {
      const circlesData = await zaureService.getCircles();
      circleNom = circlesData.find(c => c.id === targetCircleId)?.nom || 'Cercle';
    }

    const newCapsule: Capsule = {
      id: `capsule-${Date.now()}`,
      auteur_id: currentUser.id,
      circle_id: targetCircleId,
      type,
      contenu: safeContenu,
      langue_dorigine: langue,
      created_at: new Date().toISOString(),
      auteur_nom: currentUser.nom,
      auteur_role: currentUser.role,
      auteur_avatar: currentUser.avatar_url || '',
      circle_nom: circleNom
    };

    try {
      await setDoc(doc(dbFirestore, 'capsules', newCapsule.id), {
        id: newCapsule.id,
        auteur_id: newCapsule.auteur_id,
        circle_id: newCapsule.circle_id,
        circleId: newCapsule.circle_id,
        type: newCapsule.type,
        contenu: newCapsule.contenu,
        langue_dorigine: newCapsule.langue_dorigine,
        created_at: newCapsule.created_at
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `capsules/${newCapsule.id}`);
    }

    return newCapsule;
  },

  deleteCapsule: async (capsuleId: string): Promise<boolean> => {
    if (!dbFirestore || !auth?.currentUser) return false;
    try {
      await deleteDoc(doc(dbFirestore, 'capsules', capsuleId));
      return true;
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `capsules/${capsuleId}`);
    }
  },

  // --- REACTIONS ---
  getReactions: async (capsuleId: string): Promise<Reaction[]> => {
    if (!dbFirestore) return [];
    try {
      const q = query(collection(dbFirestore, 'reactions'), where('capsule_id', '==', capsuleId));
      const querySnapshot = await getDocs(q);
      const list: Reaction[] = [];
      querySnapshot.forEach((docSnap) => {
        list.push(docSnap.data() as Reaction);
      });
      return list;
    } catch (error) {
      console.warn('Info - Réactions:', error);
      return [];
    }
  },

  toggleReaction: async (capsuleId: string, type: 'utile' | 'merci' | 'question'): Promise<Reaction[]> => {
    if (!currentUser || !dbFirestore) return [];

    const key = `${capsuleId}_${currentUser.id}_${type}`;

    try {
      const docRef = doc(dbFirestore, 'reactions', key);
      const existing = await getDoc(docRef);
      if (existing.exists()) {
        await deleteDoc(docRef);
      } else {
        const react: Reaction = { capsule_id: capsuleId, user_id: currentUser.id, type };
        await setDoc(docRef, react);

        try {
          const capSnap = await getDoc(doc(dbFirestore, 'capsules', capsuleId));
          if (capSnap.exists()) {
            const cap = capSnap.data() as Capsule;
            if (cap.auteur_id && cap.auteur_id !== currentUser.id) {
              const { notificationService, buildDeterministicNotificationId } = await import('./services/notificationService');
              const typeLabels: Record<'utile' | 'merci' | 'question', string> = {
                utile: 'a trouvé votre capsule utile 💡',
                merci: 'vous remercie pour votre capsule 🙏',
                question: 'a posé une question sur votre capsule ❓'
              };
              await notificationService.createAppNotification({
                id: buildDeterministicNotificationId(['capreact', capsuleId, currentUser.id, type]),
                userId: cap.auteur_id,
                actorId: currentUser.id,
                actorName: currentUser.nom,
                actorAvatar: currentUser.avatar_url || undefined,
                type: 'reaction',
                category: 'interactions',
                title: 'Nouvelle réaction sur capsule',
                message: `${currentUser.nom} ${typeLabels[type]}.`,
                previewText: cap.type === 'texte' ? cap.contenu.slice(0, 140) : 'Capsule audio / média',
                targetType: 'capsule',
                targetId: capsuleId
              });
            }
          }
        } catch {
          // Non-fatal
        }
      }

      return await zaureService.getReactions(capsuleId);
    } catch (error) {
      console.warn('Info - Bascule réaction:', error);
      return [];
    }
  },

  // --- COMMENTS ---
  getComments: async (capsuleId: string): Promise<Comment[]> => {
    if (!dbFirestore || !auth?.currentUser) return [];
    try {
      const q = query(collection(dbFirestore, 'comments'), where('capsule_id', '==', capsuleId));
      const querySnapshot = await getDocs(q);
      const commentsData: Comment[] = [];
      querySnapshot.forEach((docSnap) => {
        commentsData.push(docSnap.data() as Comment);
      });

      const finalComments: Comment[] = [];
      for (const c of commentsData) {
        let auteurNom = 'Utilisateur';
        let auteurAvatar = '';

        try {
          const uDoc = await getDoc(doc(dbFirestore, 'public_profiles', c.auteur_id));
          if (uDoc.exists()) {
            const profile = uDoc.data() as UserProfile;
            auteurNom = profile.nom;
            auteurAvatar = profile.avatar_url || '';
          }
        } catch (e) {
          // ignore
        }

        finalComments.push({
          ...c,
          auteur_nom: auteurNom,
          auteur_avatar: auteurAvatar
        });
      }

      return finalComments.sort((a, b) => new Date(a.created_at).getTime() - new Date(a.created_at).getTime());
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, `comments?capsule_id=${capsuleId}`);
    }
  },

  addComment: async (capsuleId: string, contenu: string): Promise<Comment> => {
    if (!currentUser) throw new Error('Utilisateur non connecté.');
    if (!dbFirestore) throw new Error('Firestore non connecté.');

    const safeContenu = (contenu || '').trim().slice(0, 2000);
    if (!safeContenu) throw new Error('Le commentaire ne peut pas être vide.');

    let cap: Capsule | null = null;
    try {
      const capSnap = await getDoc(doc(dbFirestore, 'capsules', capsuleId));
      cap = capSnap.exists() ? (capSnap.data() as Capsule) : null;
      if (cap && cap.auteur_id && cap.auteur_id !== currentUser.id) {
        const { profileService } = await import('./services/profileService');
        const perm = await profileService.checkCommentPermission(cap.auteur_id, currentUser.id);
        if (!perm.allowed) {
          throw new Error(perm.reason || 'Commentaires restreints par cet utilisateur.');
        }
      }
    } catch (permErr: any) {
      if (permErr?.message && !permErr.message.includes('Firestore')) {
        throw permErr;
      }
    }

    const newComment: Comment = {
      id: `comment-${Date.now()}`,
      capsule_id: capsuleId,
      auteur_id: currentUser.id,
      contenu: safeContenu,
      created_at: new Date().toISOString(),
      auteur_nom: currentUser.nom,
      auteur_avatar: currentUser.avatar_url || ''
    };

    try {
      await setDoc(doc(dbFirestore, 'comments', newComment.id), {
        id: newComment.id,
        capsule_id: newComment.capsule_id,
        auteur_id: newComment.auteur_id,
        contenu: newComment.contenu,
        created_at: newComment.created_at
      });

      try {
        const { notificationService, buildDeterministicNotificationId, extractMentionedUserIds } = await import('./services/notificationService');
        if (cap && cap.auteur_id && cap.auteur_id !== currentUser.id) {
          await notificationService.createAppNotification({
            id: buildDeterministicNotificationId(['capcom', newComment.id, cap.auteur_id]),
            userId: cap.auteur_id,
            actorId: currentUser.id,
            actorName: currentUser.nom,
            actorAvatar: currentUser.avatar_url || undefined,
            type: 'comment',
            category: 'interactions',
            title: 'Nouveau commentaire',
            message: `${currentUser.nom} a commenté votre capsule.`,
            previewText: safeContenu.slice(0, 140),
            targetType: 'capsule',
            targetId: capsuleId
          });
        }

        if (safeContenu.includes('@')) {
          const usersSnap = await getDocs(collection(dbFirestore, 'public_profiles'));
          const candidates: Array<{ id: string; nom: string; username?: string }> = [];
          usersSnap.forEach((u) => {
            const ud = u.data() as UserProfile;
            candidates.push({ id: ud.id, nom: ud.nom, username: ud.username });
          });
          const rawMentionedIds = extractMentionedUserIds(safeContenu, candidates);
          const { profileService } = await import('./services/profileService');
          const allowedMentionIds = await profileService.filterAllowedMentionIds(
            rawMentionedIds,
            currentUser.id
          );
          await Promise.all(
            allowedMentionIds
              .filter((uid) => uid !== currentUser?.id && uid !== cap?.auteur_id)
              .slice(0, 10)
              .map((uid) =>
                notificationService.createAppNotification({
                  id: buildDeterministicNotificationId(['capmention', newComment.id, uid]),
                  userId: uid,
                  actorId: currentUser!.id,
                  actorName: currentUser!.nom,
                  actorAvatar: currentUser!.avatar_url || undefined,
                  type: 'mention',
                  category: 'mentions',
                  title: 'Mention dans un commentaire',
                  message: `${currentUser!.nom} vous a mentionné(e) dans un commentaire.`,
                  previewText: safeContenu.slice(0, 140),
                  targetType: 'capsule',
                  targetId: capsuleId
                })
              )
          );
        }
      } catch {
        // Non-fatal
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `comments/${newComment.id}`);
    }

    return newComment;
  },

  // Helper for deterministic conversation ID
  getConversationId: (uid1: string, uid2: string): string => {
    return [uid1, uid2].sort().join('_');
  },

  // --- STORAGE MEDIA UPLOAD ---
  uploadMessageAttachment: async (
    file: File | Blob, 
    folder: 'images' | 'audio' | 'videos' | 'documents' = 'documents',
    filename?: string,
    onProgress?: (progress: number) => void
  ): Promise<MessageAttachment> => {
    const ext = filename?.split('.').pop() || (file.type ? file.type.split('/')[1] : 'bin');
    const safeName = filename || `upload_${Date.now()}.${ext}`;
    const storagePath = `chat_${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${safeName}`;

    let attType: 'image' | 'video' | 'audio' | 'file' = 'file';
    if (file.type.startsWith('image/')) attType = 'image';
    else if (file.type.startsWith('video/')) attType = 'video';
    else if (file.type.startsWith('audio/')) attType = 'audio';

    const buildSafeFallbackAttachment = (errToReject?: unknown): Promise<MessageAttachment> => {
      if (file.size > 680 * 1024) {
        return Promise.reject(
          new Error(
            'Le stockage Firebase Storage n’a pas pu finaliser le fichier. Limitez la taille à 650 Ko ou réessayez.'
          )
        );
      }
      return new Promise<MessageAttachment>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (onProgress) onProgress(100);
          resolve({
            type: attType,
            url: reader.result as string,
            name: safeName,
            size: file.size,
            mime_type: file.type
          });
        };
        reader.onerror = () => reject(errToReject || new Error('Lecture du fichier impossible.'));
        reader.readAsDataURL(file);
      });
    };

    if (storage) {
      try {
        const fileRef = storageRef(storage, storagePath);
        const uploadTask = uploadBytesResumable(fileRef, file, { contentType: file.type || undefined });

        return new Promise<MessageAttachment>((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              if (onProgress) onProgress(Math.round(progress));
            },
            (error) => {
              console.warn('Info - Storage upload error, checking fallback:', error);
              buildSafeFallbackAttachment(error).then(resolve).catch(reject);
            },
            async () => {
              try {
                const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                if (onProgress) onProgress(100);
                resolve({
                  type: attType,
                  url: downloadUrl,
                  name: safeName,
                  size: file.size,
                  mime_type: file.type
                });
              } catch (err) {
                console.warn('Info - getDownloadURL failed, checking fallback:', err);
                buildSafeFallbackAttachment(err).then(resolve).catch(reject);
              }
            }
          );
        });
      } catch (e) {
        console.warn('Info - Storage init error:', e);
      }
    }

    return buildSafeFallbackAttachment();
  },

  // --- CONVERSATIONS TEMPS RÉEL (STYLE MESSENGER) ---
  subscribeUserConversations: (userId: string, callback: (conversations: Conversation[]) => void): (() => void) => {
    if (!dbFirestore || !userId || !auth?.currentUser) {
      callback([]);
      return () => {};
    }
    try {
      const convsRef = collection(dbFirestore, 'conversations');
      const q = query(convsRef, where('participant_ids', 'array-contains', userId));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list: Conversation[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            type: data.type || 'direct',
            participant_ids: data.participant_ids || [userId],
            participants: data.participants || {},
            group_name: data.group_name || '',
            group_photo: data.group_photo || '',
            group_description: data.group_description || '',
            admin_ids: data.admin_ids || [],
            last_message: data.last_message || null,
            unread_counts: data.unread_counts || {},
            typing: data.typing || {},
            created_at: data.created_at || new Date().toISOString(),
            updated_at: data.updated_at || data.created_at || new Date().toISOString(),
            is_archived_by: data.is_archived_by || [],
            is_muted_by: data.is_muted_by || [],
            is_favorite_by: data.is_favorite_by || [],
            deleted_by: data.deleted_by || [],
            cleared_at: data.cleared_at || {}
          });
        });

        list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        callback(list);
      }, (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'conversations');
        } catch {
          // Structured error logged in handleFirestoreError
        }
        callback([]);
      });
      return unsubscribe;
    } catch (e) {
      console.warn('Info - Config listener conversations:', e);
      callback([]);
      return () => {};
    }
  },

  subscribeConversationMessages: (convId: string, callback: (messages: Message[]) => void): (() => void) => {
    if (!dbFirestore || !convId || !auth?.currentUser) {
      callback([]);
      return () => {};
    }
    try {
      const messagesRef = collection(dbFirestore, 'conversations', convId, 'messages');
      const q = query(messagesRef, orderBy('created_at', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list: Message[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id || data.id,
            conversation_id: convId,
            sender_id: data.sender_id || data.senderId || '',
            receiver_id: data.receiver_id || data.receiverId || '',
            content: data.content || '',
            created_at: data.created_at || data.createdAt || new Date().toISOString(),
            updated_at: data.updated_at || undefined,
            sender_nom: data.sender_nom || data.senderNom || 'Membre',
            sender_avatar: data.sender_avatar || data.senderAvatar || null,
            type: data.type || 'texte',
            attachments: data.attachments || [],
            reply_to: data.reply_to || null,
            reactions: data.reactions || {},
            read_by: data.read_by || [],
            status: data.status || 'sent',
            is_edited: data.is_edited || false,
            is_deleted: data.is_deleted || false,
            is_pinned: Boolean(data.is_pinned),
            pinned_by: data.pinned_by || undefined,
            pinned_at: data.pinned_at || undefined
          });
        });
        callback(list);
      }, (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, `conversations/${convId}/messages`);
        } catch {
          // Structured error logged in handleFirestoreError
        }
        callback([]);
      });
      return unsubscribe;
    } catch (e) {
      console.warn('Info - Config listener messages:', e);
      callback([]);
      return () => {};
    }
  },

  sendChatMessage: async (params: {
    conversationId: string;
    receiverId?: string;
    content: string;
    type?: 'texte' | 'image' | 'video' | 'audio' | 'file' | 'system';
    attachments?: MessageAttachment[];
    replyTo?: MessageReplyInfo | null;
    otherUser?: UserProfile | null;
  }): Promise<Message> => {
    if (!currentUser) throw new Error('Utilisateur non connecté.');
    if (!dbFirestore) throw new Error('Firestore non connecté.');

    const { conversationId, receiverId, content, type = 'texte', attachments = [], replyTo = null, otherUser } = params;
    const safeContent = (content || '').slice(0, 10000);
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    let displayPreview = safeContent.slice(0, 300);
    if (type === 'image') displayPreview = '📷 Photo';
    else if (type === 'video') displayPreview = '🎥 Vidéo';
    else if (type === 'audio') displayPreview = '🎤 Note vocale';
    else if (type === 'file') displayPreview = `📎 ${(attachments[0]?.name || 'Fichier').slice(0, 120)}`;

    // IMPORTANT (Master Gate RLS): Ensure parent conversation exists and includes currentUser BEFORE creating the message
    const convDocRef = doc(dbFirestore, 'conversations', conversationId);
    try {
      const convSnap = await getDoc(convDocRef);
      const typingResetKey = `typing.${currentUser.id}`;

      if (convSnap.exists()) {
        const updateData: any = {
          updated_at: nowIso,
          last_message: {
            content: displayPreview,
            sender_id: currentUser.id,
            sender_nom: currentUser.nom,
            type,
            created_at: nowIso
          },
          deleted_by: [],
          [typingResetKey]: false
        };

        if (receiverId) {
          updateData[`unread_counts.${receiverId}`] = increment(1);
        } else {
          const convData = convSnap.data();
          const pIds: string[] = convData.participant_ids || [];
          pIds.forEach((pid) => {
            if (pid !== currentUser.id) {
              updateData[`unread_counts.${pid}`] = increment(1);
            }
          });
        }

        await updateDoc(convDocRef, updateData);
      } else {
        const participantsMap: Record<string, ConversationParticipant> = {
          [currentUser.id]: {
            id: currentUser.id,
            nom: currentUser.nom,
            avatar_url: currentUser.avatar_url || null,
            role: currentUser.role,
            is_online: true
          }
        };

        const participantIds = [currentUser.id];
        if (receiverId) {
          participantIds.push(receiverId);
          participantsMap[receiverId] = {
            id: receiverId,
            nom: otherUser?.nom || 'Membre Zaure',
            avatar_url: otherUser?.avatar_url || null,
            role: otherUser?.role || 'utilisateur'
          };
        }

        await setDoc(convDocRef, {
          id: conversationId,
          type: 'direct',
          participant_ids: participantIds,
          participants: participantsMap,
          created_at: nowIso,
          updated_at: nowIso,
          last_message: {
            content: displayPreview,
            sender_id: currentUser.id,
            sender_nom: currentUser.nom,
            type,
            created_at: nowIso
          },
          unread_counts: receiverId ? { [receiverId]: 1, [currentUser.id]: 0 } : {},
          typing: { [currentUser.id]: false },
          is_archived_by: [],
          is_muted_by: [],
          is_favorite_by: [],
          deleted_by: []
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `conversations/${conversationId}`);
    }

    const messagePayload: Record<string, any> = {
      id: messageId,
      conversation_id: conversationId,
      sender_id: currentUser.id,
      content: safeContent,
      created_at: nowIso,
      sender_nom: currentUser.nom,
      type,
      attachments: attachments.slice(0, 5),
      reply_to: replyTo || null,
      reactions: {},
      read_by: [currentUser.id],
      status: 'sent',
      is_edited: false,
      is_deleted: false
    };
    if (receiverId) messagePayload.receiver_id = receiverId;
    if (currentUser.avatar_url) messagePayload.sender_avatar = currentUser.avatar_url;

    const msgDocRef = doc(dbFirestore, 'conversations', conversationId, 'messages', messageId);
    try {
      await setDoc(msgDocRef, messagePayload);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `conversations/${conversationId}/messages/${messageId}`);
    }

    // Notifications temps réel de messagerie (message privé & @mention dans un groupe)
    if (type !== 'system') {
      try {
        const { notificationService, buildDeterministicNotificationId, extractMentionedUserIds } =
          await import('./services/notificationService');
        const convAfterSnap = await getDoc(convDocRef);
        const convData = convAfterSnap.exists() ? (convAfterSnap.data() as Conversation) : null;
        const mutedBy = convData?.is_muted_by || [];

        if (receiverId && receiverId !== currentUser.id && !mutedBy.includes(receiverId)) {
          await notificationService.createAppNotification({
            id: buildDeterministicNotificationId(['msg', conversationId, messageId, receiverId]),
            userId: receiverId,
            actorId: currentUser.id,
            actorName: currentUser.nom,
            actorAvatar: currentUser.avatar_url || undefined,
            type: 'new_message',
            category: 'interactions',
            title: 'Nouveau message privé',
            message: `${currentUser.nom} vous a envoyé un message.`,
            previewText: displayPreview.slice(0, 140),
            targetType: 'conversation',
            targetId: conversationId
          });
        } else if (convData && convData.type === 'group' && safeContent.includes('@')) {
          const participantsMap = convData.participants || {};
          const candidates = (convData.participant_ids || [])
            .filter((pid) => pid !== currentUser?.id && !mutedBy.includes(pid))
            .map((pid) => ({
              id: pid,
              nom: participantsMap[pid]?.nom || 'Membre'
            }));
          const mentionedIds = extractMentionedUserIds(safeContent, candidates);
          await Promise.all(
            mentionedIds.slice(0, 15).map((uid) =>
              notificationService.createAppNotification({
                id: buildDeterministicNotificationId(['gmsgm', conversationId, messageId, uid]),
                userId: uid,
                actorId: currentUser!.id,
                actorName: currentUser!.nom,
                actorAvatar: currentUser!.avatar_url || undefined,
                type: 'group_mention',
                category: 'mentions',
                title: `Mention dans ${convData.group_name || 'une conversation'}`,
                message: `${currentUser!.nom} vous a mentionné(e) dans le groupe « ${convData.group_name || 'Discussion'} ».`,
                previewText: displayPreview.slice(0, 140),
                targetType: 'conversation',
                targetId: conversationId
              })
            )
          );
        }
      } catch {
        // Non-fatal
      }
    }

    return {
      ...messagePayload,
      receiver_id: receiverId,
      sender_avatar: currentUser.avatar_url || undefined
    } as Message;
  },

  createGroupConversation: async (params: {
    groupName: string;
    groupDescription?: string;
    groupPhoto?: string;
    memberIds: string[];
    allUsers?: UserProfile[];
  }): Promise<Conversation> => {
    if (!currentUser) throw new Error('Utilisateur non connecté.');
    if (!dbFirestore) throw new Error('Firestore non connecté.');

    const groupId = `grp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();
    const uniqueMemberIds = Array.from(new Set([currentUser.id, ...params.memberIds])).slice(0, 50);
    const safeGroupName = params.groupName.trim().slice(0, 120);
    const safeGroupDesc = (params.groupDescription || '').trim().slice(0, 500);

    const participantsMap: Record<string, ConversationParticipant> = {
      [currentUser.id]: {
        id: currentUser.id,
        nom: currentUser.nom,
        avatar_url: currentUser.avatar_url || null,
        role: currentUser.role,
        is_online: true
      }
    };

    if (params.allUsers) {
      params.allUsers.forEach((u) => {
        if (uniqueMemberIds.includes(u.id)) {
          participantsMap[u.id] = {
            id: u.id,
            nom: u.nom,
            avatar_url: u.avatar_url || null,
            role: u.role
          };
        }
      });
    }

    const unreadCounts: Record<string, number> = {};
    uniqueMemberIds.forEach((uid) => {
      unreadCounts[uid] = 0;
    });

    const newGroup: Conversation = {
      id: groupId,
      type: 'group',
      participant_ids: uniqueMemberIds,
      participants: participantsMap,
      group_name: safeGroupName,
      group_description: safeGroupDesc,
      group_photo: params.groupPhoto || '',
      admin_ids: [currentUser.id],
      last_message: {
        content: `${currentUser.nom} a créé le groupe « ${safeGroupName} »`,
        sender_id: currentUser.id,
        sender_nom: currentUser.nom,
        type: 'system',
        created_at: nowIso
      },
      unread_counts: unreadCounts,
      typing: {},
      created_at: nowIso,
      updated_at: nowIso,
      is_archived_by: [],
      is_muted_by: [],
      is_favorite_by: [],
      deleted_by: []
    };

    try {
      const groupRef = doc(dbFirestore, 'conversations', groupId);
      await setDoc(groupRef, newGroup);

      const msgId = `msg-sys-${Date.now()}`;
      await setDoc(doc(dbFirestore, 'conversations', groupId, 'messages', msgId), {
        id: msgId,
        conversation_id: groupId,
        sender_id: currentUser.id,
        sender_nom: currentUser.nom,
        content: `${currentUser.nom} a créé le groupe « ${safeGroupName} »`,
        type: 'system',
        created_at: nowIso,
        read_by: [currentUser.id]
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `conversations/${groupId}`);
    }

    return newGroup;
  },

  updateGroupDetails: async (convId: string, updates: Partial<Conversation>): Promise<void> => {
    if (!dbFirestore) return;
    try {
      const allowedUpdates: Record<string, any> = {
        updated_at: new Date().toISOString()
      };
      if (updates.group_name !== undefined) allowedUpdates.group_name = updates.group_name.trim().slice(0, 120);
      if (updates.group_description !== undefined) allowedUpdates.group_description = updates.group_description.trim().slice(0, 500);
      if (updates.group_photo !== undefined) allowedUpdates.group_photo = updates.group_photo;
      const ref = doc(dbFirestore, 'conversations', convId);
      await updateDoc(ref, allowedUpdates);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `conversations/${convId}`);
    }
  },

  setTypingStatus: async (convId: string, isTyping: boolean): Promise<void> => {
    if (!currentUser || !dbFirestore) return;
    try {
      const ref = doc(dbFirestore, 'conversations', convId);
      await updateDoc(ref, {
        [`typing.${currentUser.id}`]: isTyping
      });
    } catch (e) {
      // Silent
    }
  },

  markConversationAsRead: async (convId: string): Promise<void> => {
    if (!currentUser || !dbFirestore) return;
    try {
      const ref = doc(dbFirestore, 'conversations', convId);
      await updateDoc(ref, {
        [`unread_counts.${currentUser.id}`]: 0
      });

      // Synchroniser les accusés de lecture réels sur les messages récents (Étape 3)
      const messagesRef = collection(dbFirestore, 'conversations', convId, 'messages');
      const q = query(messagesRef, orderBy('created_at', 'desc'), limit(25));
      const snap = await getDocs(q);
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        const readBy: string[] = d.read_by || [];
        if (!readBy.includes(currentUser.id)) {
          updateDoc(docSnap.ref, {
            read_by: arrayUnion(currentUser.id),
            status: 'read'
          }).catch(() => {});
        }
      });
    } catch (e) {
      // Silent
    }
  },

  loadOlderMessages: async (convId: string, beforeTimestamp: string, count: number = 20): Promise<Message[]> => {
    if (!dbFirestore || !convId) return [];
    try {
      const messagesRef = collection(dbFirestore, 'conversations', convId, 'messages');
      const q = query(
        messagesRef,
        where('created_at', '<', beforeTimestamp),
        orderBy('created_at', 'desc'),
        limit(count)
      );
      const snapshot = await getDocs(q);
      const list: Message[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id || data.id,
          conversation_id: convId,
          sender_id: data.sender_id || data.senderId || '',
          receiver_id: data.receiver_id || data.receiverId || '',
          content: data.content || '',
          created_at: data.created_at || data.createdAt || new Date().toISOString(),
          updated_at: data.updated_at || undefined,
          sender_nom: data.sender_nom || data.senderNom || 'Membre',
          sender_avatar: data.sender_avatar || data.senderAvatar || null,
          type: data.type || 'texte',
          attachments: data.attachments || [],
          reply_to: data.reply_to || null,
          reactions: data.reactions || {},
          read_by: data.read_by || [],
          status: data.status || 'sent',
          is_edited: data.is_edited || false,
          is_deleted: data.is_deleted || false,
          is_pinned: Boolean(data.is_pinned),
          pinned_by: data.pinned_by || undefined,
          pinned_at: data.pinned_at || undefined
        });
      });
      list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      return list;
    } catch (e) {
      console.warn('Info - pagination anciens messages:', e);
      return [];
    }
  },

  addReactionToMessage: async (convId: string, messageId: string, emoji: string): Promise<void> => {
    if (!currentUser || !dbFirestore) return;
    try {
      const msgRef = doc(dbFirestore, 'conversations', convId, 'messages', messageId);
      const snap = await getDoc(msgRef);
      if (!snap.exists()) return;

      const data = snap.data();
      const reactions: Record<string, string[]> = data.reactions || {};
      const currentList = reactions[emoji] || [];

      if (currentList.includes(currentUser.id)) {
        reactions[emoji] = currentList.filter((id) => id !== currentUser.id);
        if (reactions[emoji].length === 0) {
          delete reactions[emoji];
        }
      } else {
        Object.keys(reactions).forEach((em) => {
          reactions[em] = (reactions[em] || []).filter((id) => id !== currentUser.id);
          if (reactions[em].length === 0) delete reactions[em];
        });
        reactions[emoji] = [...(reactions[emoji] || []), currentUser.id];
      }

      await updateDoc(msgRef, { reactions });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `conversations/${convId}/messages/${messageId}`);
    }
  },

  editChatMessage: async (convId: string, messageId: string, newContent: string): Promise<void> => {
    if (!currentUser || !dbFirestore) return;
    const safeContent = (newContent || '').trim().slice(0, 10000);
    if (!safeContent) return;
    try {
      const msgRef = doc(dbFirestore, 'conversations', convId, 'messages', messageId);
      await updateDoc(msgRef, {
        content: safeContent,
        is_edited: true,
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `conversations/${convId}/messages/${messageId}`);
    }
  },

  deleteChatMessage: async (convId: string, messageId: string): Promise<void> => {
    if (!currentUser || !dbFirestore) return;
    try {
      const msgRef = doc(dbFirestore, 'conversations', convId, 'messages', messageId);
      await updateDoc(msgRef, {
        content: 'Ce message a été supprimé',
        attachments: [],
        is_deleted: true,
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `conversations/${convId}/messages/${messageId}`);
    }
  },

  toggleArchiveConversation: async (convId: string): Promise<void> => {
    if (!currentUser || !dbFirestore) return;
    const ref = doc(dbFirestore, 'conversations', convId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const archives: string[] = data.is_archived_by || [];
    const isArchived = archives.includes(currentUser.id);
    await updateDoc(ref, {
      is_archived_by: isArchived ? arrayRemove(currentUser.id) : arrayUnion(currentUser.id)
    });
  },

  toggleMuteConversation: async (convId: string): Promise<void> => {
    if (!currentUser || !dbFirestore) return;
    const ref = doc(dbFirestore, 'conversations', convId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const mutes: string[] = data.is_muted_by || [];
    const isMuted = mutes.includes(currentUser.id);
    await updateDoc(ref, {
      is_muted_by: isMuted ? arrayRemove(currentUser.id) : arrayUnion(currentUser.id)
    });
  },

  toggleFavoriteConversation: async (convId: string): Promise<boolean> => {
    if (!currentUser || !dbFirestore) return false;
    const ref = doc(dbFirestore, 'conversations', convId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;
    const data = snap.data();
    const favs: string[] = data.is_favorite_by || [];
    const isFav = favs.includes(currentUser.id);
    await updateDoc(ref, {
      is_favorite_by: isFav ? arrayRemove(currentUser.id) : arrayUnion(currentUser.id)
    });
    return !isFav;
  },

  togglePinMessage: async (convId: string, messageId: string, currentlyPinned: boolean): Promise<boolean> => {
    if (!currentUser || !dbFirestore) return false;
    const msgRef = doc(dbFirestore, 'conversations', convId, 'messages', messageId);
    const nextPinned = !currentlyPinned;
    try {
      await updateDoc(msgRef, {
        is_pinned: nextPinned,
        pinned_by: nextPinned ? currentUser.id : '',
        pinned_at: nextPinned ? new Date().toISOString() : ''
      });
      return nextPinned;
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `conversations/${convId}/messages/${messageId}`);
      return currentlyPinned;
    }
  },

  softDeleteConversationForUser: async (convId: string): Promise<void> => {
    if (!currentUser || !dbFirestore) return;
    const ref = doc(dbFirestore, 'conversations', convId);
    const nowIso = new Date().toISOString();
    try {
      await updateDoc(ref, {
        deleted_by: arrayUnion(currentUser.id),
        [`cleared_at.${currentUser.id}`]: nowIso,
        [`unread_counts.${currentUser.id}`]: 0
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `conversations/${convId}`);
    }
  },

  deleteGroupConversation: async (convId: string): Promise<void> => {
    if (!currentUser || !dbFirestore) return;
    const ref = doc(dbFirestore, 'conversations', convId);
    try {
      await deleteDoc(ref);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `conversations/${convId}`);
    }
  },

  // Rétrocompatibilité pour les anciens appels
  subscribePrivateMessages: (otherUserId: string, callback: (messages: Message[]) => void): (() => void) => {
    if (!currentUser || !dbFirestore) {
      callback([]);
      return () => {};
    }
    const convId = [currentUser.id, otherUserId].sort().join('_');
    return zaureService.subscribeConversationMessages(convId, callback);
  },

  getPrivateMessages: async (otherUserId: string): Promise<Message[]> => {
    if (!currentUser || !dbFirestore) return [];
    const convId = [currentUser.id, otherUserId].sort().join('_');
    try {
      const messagesRef = collection(dbFirestore, 'conversations', convId, 'messages');
      const q = query(messagesRef, orderBy('created_at', 'asc'));
      const snapshot = await getDocs(q);
      const list: Message[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id || data.id,
          sender_id: data.sender_id || data.senderId || '',
          receiver_id: data.receiver_id || data.receiverId || '',
          content: data.content || '',
          created_at: data.created_at || data.createdAt || new Date().toISOString(),
          sender_nom: data.sender_nom || data.senderNom || 'Membre'
        });
      });
      return list;
    } catch (error) {
      console.warn('Info - Chargement messages:', error);
      return [];
    }
  },

  sendPrivateMessage: async (receiverId: string, content: string): Promise<Message> => {
    if (!currentUser) throw new Error('Utilisateur non connecté.');
    const convId = [currentUser.id, receiverId].sort().join('_');
    return zaureService.sendChatMessage({
      conversationId: convId,
      receiverId,
      content,
      type: 'texte'
    });
  },

  // ----------------------------------------------------
  // USER SETTINGS & PREFERENCES MANAGEMENT
  // ----------------------------------------------------
  getUserSettings: async (userId: string): Promise<UserSettings> => {
    const baseSettings: UserSettings = {
      ...DEFAULT_USER_SETTINGS,
      nom: currentUser?.nom || '',
      username: currentUser?.username || '',
      email: currentUser?.email || '',
      telephone: currentUser?.phone || '',
      date_naissance: currentUser?.date_naissance || '',
      bio: currentUser?.bio || '',
      avatar_url: currentUser?.avatar_url || '',
      langue_preferee: currentUser?.langue_preferee || 'fr',
      langue_interface: currentUser?.langue_preferee || 'fr'
    };

    if (!dbFirestore) return baseSettings;

    try {
      const settingsDoc = await getDoc(doc(dbFirestore, 'user_settings', userId));
      if (settingsDoc.exists()) {
        const merged = { ...baseSettings, ...(settingsDoc.data() as UserSettings) };
        if (merged.privacy_settings) {
          merged.privacy_settings = normalizePrivacySettings(merged.privacy_settings);
        }
        return merged;
      }
    } catch (error) {
      console.error('Erreur lors du chargement des préférences:', error);
    }

    return baseSettings;
  },

  saveUserSettings: async (userId: string, newSettings: Partial<UserSettings>): Promise<boolean> => {
    if (!dbFirestore) return false;
    try {
      const payload: Partial<UserSettings> = { ...newSettings };
      if (payload.privacy_settings) {
        payload.privacy_settings = normalizePrivacySettings(payload.privacy_settings);
      }
      await setDoc(doc(dbFirestore, 'user_settings', userId), payload, { merge: true });

      if (auth?.currentUser && auth.currentUser.uid === userId) {
        const userUpdates: Record<string, any> = {};
        if (payload.privacy_settings) {
          userUpdates.privacy_settings = payload.privacy_settings;
        }
        if (payload.langue_interface && !payload.langue_preferee) {
          userUpdates.langue_preferee = payload.langue_interface;
        } else if (payload.langue_preferee) {
          userUpdates.langue_preferee = payload.langue_preferee;
        }

        if (Object.keys(userUpdates).length > 0) {
          await updateDoc(doc(dbFirestore, 'users', userId), userUpdates).catch(() => {});
          if (currentUser && currentUser.id === userId) {
            currentUser = { ...currentUser, ...userUpdates };
            await syncPublicProfile(currentUser);
            try {
              localStorage.setItem('zaure_user_session_cache', JSON.stringify(currentUser));
            } catch {
              // ignore storage cache
            }
          }
        }
      }
      return true;
    } catch (error) {
      console.error('Erreur sauvegarde des préférences:', error);
      return false;
    }
  },

  updateUserProfile: async (
    userId: string, 
    updates: {
      nom?: string;
      username?: string;
      phone?: string;
      date_naissance?: string;
      bio?: string | null;
      avatar_url?: string | null;
      cover_url?: string | null;
      profession?: string;
      formation?: string;
      localisation?: string;
      site_web?: string;
      infos_complementaires?: string;
      privacy_settings?: UserPrivacySettings;
      langue_preferee?: 'fr' | 'ha' | 'en';
    }
  ): Promise<{ user: UserProfile | null, error: string | null }> => {
    if (!dbFirestore || !auth?.currentUser || auth.currentUser.uid !== userId) {
      return { user: null, error: 'Non autorisé ou Firestore non connecté' };
    }

    const sanitized: Record<string, any> = {};
    if (updates.nom !== undefined) {
      const trimmedNom = updates.nom.trim().slice(0, 120);
      if (!trimmedNom) {
        return { user: null, error: 'Le nom complet ne peut pas être vide.' };
      }
      sanitized.nom = trimmedNom;
    }
    if (updates.username !== undefined) {
      sanitized.username = sanitizeUsername(updates.username, updates.nom || currentUser?.nom).slice(0, 40);
    }
    if (updates.phone !== undefined) sanitized.phone = updates.phone.trim().slice(0, 32);
    if (updates.date_naissance !== undefined) sanitized.date_naissance = updates.date_naissance.trim().slice(0, 32);
    if (updates.bio !== undefined) sanitized.bio = updates.bio ? updates.bio.trim().slice(0, 1000) : null;
    if (updates.avatar_url !== undefined) {
      sanitized.avatar_url = updates.avatar_url ? updates.avatar_url.slice(0, 350000) : null;
    }
    if (updates.cover_url !== undefined) {
      sanitized.cover_url = updates.cover_url ? updates.cover_url.slice(0, 350000) : null;
    }
    if (updates.profession !== undefined) sanitized.profession = updates.profession.trim().slice(0, 120);
    if (updates.formation !== undefined) sanitized.formation = updates.formation.trim().slice(0, 160);
    if (updates.localisation !== undefined) sanitized.localisation = updates.localisation.trim().slice(0, 120);
    if (updates.site_web !== undefined) sanitized.site_web = sanitizeWebsiteUrl(updates.site_web).slice(0, 300);
    if (updates.infos_complementaires !== undefined) {
      sanitized.infos_complementaires = updates.infos_complementaires.trim().slice(0, 1000);
    }
    if (updates.privacy_settings !== undefined) {
      sanitized.privacy_settings = normalizePrivacySettings(updates.privacy_settings);
    }
    if (updates.langue_preferee !== undefined) sanitized.langue_preferee = updates.langue_preferee;

    try {
      await updateDoc(doc(dbFirestore, 'users', userId), sanitized);
      if (currentUser && currentUser.id === userId) {
        currentUser = { ...currentUser, ...sanitized };
        await syncPublicProfile(currentUser);
        try {
          localStorage.setItem('zaure_user_session_cache', JSON.stringify(currentUser));
        } catch {
          // ignore storage cache
        }
      } else {
        const publicSanitized = { ...sanitized };
        delete publicSanitized.phone;
        delete publicSanitized.date_naissance;
        delete publicSanitized.email;
        if (Object.keys(publicSanitized).length > 0) {
          await setDoc(doc(dbFirestore, 'public_profiles', userId), publicSanitized, { merge: true });
        }
      }
      return { user: currentUser, error: null };
    } catch (error: any) {
      return { user: null, error: error.message || 'Erreur lors de la mise à jour' };
    }
  },

  // --- USER AVAILABILITY & PROFILE MANAGEMENT (ÉTAPE 2) ---
  setUserAvailability: async (status: 'online' | 'busy' | 'offline', statusMessage?: string): Promise<void> => {
    if (!currentUser || !dbFirestore || !auth?.currentUser || auth.currentUser.uid !== currentUser.id) return;
    try {
      const updates: any = {
        availability: status,
        last_active: new Date().toISOString()
      };
      if (statusMessage !== undefined) updates.status_message = statusMessage.slice(0, 160);
      await updateDoc(doc(dbFirestore, 'users', currentUser.id), updates);
      currentUser.availability = status;
      if (statusMessage !== undefined) currentUser.status_message = updates.status_message;
      currentUser.last_active = updates.last_active;
      await syncPublicProfile(currentUser);
    } catch (e) {
      console.warn('Info - maj disponibilite:', e);
    }
  },

  blockUser: async (targetUserId: string): Promise<boolean> => {
    if (!currentUser || !dbFirestore) return false;
    try {
      const settingsRef = doc(dbFirestore, 'user_settings', currentUser.id);
      await updateDoc(settingsRef, {
        utilisateurs_bloques: arrayUnion(targetUserId)
      });
      return true;
    } catch (e) {
      try {
        await setDoc(doc(dbFirestore, 'user_settings', currentUser.id), {
          ...DEFAULT_USER_SETTINGS,
          utilisateurs_bloques: [targetUserId]
        }, { merge: true });
        return true;
      } catch (err) {
        console.error('Erreur blocage utilisateur:', err);
        return false;
      }
    }
  },

  unblockUser: async (targetUserId: string): Promise<boolean> => {
    if (!currentUser || !dbFirestore) return false;
    try {
      const settingsRef = doc(dbFirestore, 'user_settings', currentUser.id);
      await updateDoc(settingsRef, {
        utilisateurs_bloques: arrayRemove(targetUserId)
      });
      return true;
    } catch (err) {
      console.error('Erreur déblocage utilisateur:', err);
      return false;
    }
  },

  getBlockedUserIds: async (): Promise<string[]> => {
    if (!currentUser || !dbFirestore) return [];
    try {
      const settingsDoc = await getDoc(doc(dbFirestore, 'user_settings', currentUser.id));
      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        return data.utilisateurs_bloques || [];
      }
    } catch (e) {
      console.warn('Info - lecture utilisateurs bloques:', e);
    }
    return [];
  },

  reportUser: async (params: {
    targetUserId: string;
    targetUserNom: string;
    reason: 'spam' | 'harcelement' | 'usurpation' | 'contenu_inapproprie' | 'autre';
    details?: string;
  }): Promise<{ success: boolean; error: string | null }> => {
    if (!currentUser) return { success: false, error: 'Non connecté' };
    if (!dbFirestore) return { success: false, error: 'Firestore indisponible' };
    try {
      const reportId = `rep-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const reportData: UserReport = {
        id: reportId,
        reporter_id: currentUser.id,
        reporter_nom: currentUser.nom,
        reported_user_id: params.targetUserId,
        reason: params.reason,
        details: params.details || '',
        status: 'en_attente',
        created_at: new Date().toISOString()
      };
      await setDoc(doc(dbFirestore, 'reports', reportId), reportData);
      return { success: true, error: null };
    } catch (err: any) {
      console.error('Erreur signalement utilisateur:', err);
      return { success: false, error: err.message || 'Erreur lors du signalement' };
    }
  },

  getUserPublicProfile: async (userId: string): Promise<(UserProfile & { circles_count?: number }) | null> => {
    if (!dbFirestore || !auth?.currentUser) return null;
    try {
      const userDoc = await getDoc(doc(dbFirestore, 'public_profiles', userId));
      if (!userDoc.exists()) return null;
      return mapPublicProfileData(userDoc.id, userDoc.data());
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, `public_profiles/${userId}`);
    }
  },

  resolveUserProfileByIdentifier: async (
    identifier: string
  ): Promise<(UserProfile & { circles_count?: number }) | null> => {
    if (!dbFirestore || !auth?.currentUser) return null;
    const clean = (identifier || '').replace(/^@+/, '').trim();
    if (!clean) return null;
    try {
      const byIdDoc = await getDoc(doc(dbFirestore, 'public_profiles', clean));
      if (byIdDoc.exists()) {
        return mapPublicProfileData(byIdDoc.id, byIdDoc.data());
      }
      const normalized = clean.toLowerCase();
      const q = query(
        collection(dbFirestore, 'public_profiles'),
        where('username', '==', normalized),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const first = snap.docs[0];
        return mapPublicProfileData(first.id, first.data());
      }
      return null;
    } catch (e) {
      console.warn('Info - resolveUserProfileByIdentifier:', e);
      return null;
    }
  },

  changeUserEmail: async (
    newEmail: string,
    currentPassword?: string
  ): Promise<{ success: boolean; error: string | null }> => {
    if (!currentUser) return { success: false, error: 'Utilisateur non connecté' };
    if (!auth || !auth.currentUser || !dbFirestore) {
      return { success: false, error: 'Firebase non disponible' };
    }

    const safeEmail = newEmail.trim().slice(0, 200);
    try {
      if (currentPassword && auth.currentUser.email) {
        const cred = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
        await reauthenticateWithCredential(auth.currentUser, cred);
      }
      await updateEmail(auth.currentUser, safeEmail);
      await updateDoc(doc(dbFirestore, 'users', currentUser.id), { email: safeEmail });
      await setDoc(doc(dbFirestore, 'user_settings', currentUser.id), { email: safeEmail }, { merge: true }).catch(() => {});
      currentUser.email = safeEmail;
      try {
        const { notificationService } = await import('./services/notificationService');
        await notificationService.createAppNotification({
          userId: currentUser.id,
          actorId: currentUser.id,
          actorName: 'Sécurité Zaure',
          type: 'security_alert',
          category: 'system',
          title: 'Adresse email mise à jour',
          message: `L'adresse email de votre compte a été modifiée pour ${safeEmail}.`,
          targetType: 'settings',
          targetId: 'compte'
        });
      } catch {
        // Non-fatal
      }
      return { success: true, error: null };
    } catch (err: any) {
      if (err?.code === 'auth/requires-recent-login') {
        return {
          success: false,
          error:
            'Par mesure de sécurité, saisissez votre mot de passe actuel ou reconnectez-vous avant de changer d’adresse e-mail.'
        };
      }
      return { success: false, error: formatFirebaseAuthError(err) };
    }
  },

  changeUserPassword: async (
    newPassword: string,
    currentPassword?: string
  ): Promise<{ success: boolean; error: string | null }> => {
    if (!auth || !auth.currentUser) {
      return { success: false, error: 'Utilisateur non connecté' };
    }

    try {
      if (currentPassword && auth.currentUser.email) {
        const cred = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
        await reauthenticateWithCredential(auth.currentUser, cred);
      }
      await updatePassword(auth.currentUser, newPassword);
      if (currentUser) {
        try {
          const { notificationService } = await import('./services/notificationService');
          await notificationService.createAppNotification({
            userId: currentUser.id,
            actorId: currentUser.id,
            actorName: 'Sécurité Zaure',
            type: 'security_alert',
            category: 'system',
            title: 'Mot de passe modifié',
            message: 'Votre mot de passe Zaure vient d’être modifié avec succès.',
            targetType: 'settings',
            targetId: 'compte'
          });
        } catch {
          // Non-fatal
        }
      }
      return { success: true, error: null };
    } catch (err: any) {
      if (err?.code === 'auth/requires-recent-login') {
        return {
          success: false,
          error:
            'Par mesure de sécurité, veuillez saisir votre mot de passe actuel pour confirmer ce changement.'
        };
      }
      return { success: false, error: formatFirebaseAuthError(err) };
    }
  },

  deleteAccount: async (
    userId: string,
    currentPassword?: string
  ): Promise<{ success: boolean; error: string | null }> => {
    if (!dbFirestore) return { success: false, error: 'Firestore non disponible' };

    try {
      if (currentPassword && auth?.currentUser?.email) {
        const cred = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
        await reauthenticateWithCredential(auth.currentUser, cred);
      }

      // Clean up active session records for this user
      try {
        const sessSnap = await getDocs(
          query(collection(dbFirestore, 'user_sessions'), where('userId', '==', userId))
        );
        await Promise.all(sessSnap.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
      } catch {
        // Non-fatal
      }

      await deleteDoc(doc(dbFirestore, 'users', userId)).catch(() => {});
      await deleteDoc(doc(dbFirestore, 'public_profiles', userId)).catch(() => {});
      await deleteDoc(doc(dbFirestore, 'user_settings', userId)).catch(() => {});
      if (auth && auth.currentUser) {
        await deleteUser(auth.currentUser);
      }
      currentUser = null;
      return { success: true, error: null };
    } catch (err: any) {
      if (err?.code === 'auth/requires-recent-login') {
        return {
          success: false,
          error:
            'Par mesure de sécurité, saisissez votre mot de passe actuel ou reconnectez-vous avant de supprimer votre compte.'
        };
      }
      return { success: false, error: formatFirebaseAuthError(err) };
    }
  },

  getAllUsersList: async (): Promise<UserProfile[]> => {
    return zaureService.getAvailableUsers();
  },

  addGroupMember: async (convId: string, userToAdd: UserProfile): Promise<void> => {
    if (!dbFirestore || !currentUser) return;
    try {
      const ref = doc(dbFirestore, 'conversations', convId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const data = snap.data() as Conversation;
      if (data.participant_ids?.includes(userToAdd.id)) return;

      const newParticipantIds = [...(data.participant_ids || []), userToAdd.id];
      const newParticipants = {
        ...(data.participants || {}),
        [userToAdd.id]: {
          id: userToAdd.id,
          nom: userToAdd.nom,
          avatar_url: userToAdd.avatar_url || '',
          role: userToAdd.role || 'utilisateur',
          is_online: userToAdd.availability !== 'offline'
        }
      };
      const newUnread = {
        ...(data.unread_counts || {}),
        [userToAdd.id]: 0
      };

      const nowIso = new Date().toISOString();
      await updateDoc(ref, {
        participant_ids: newParticipantIds,
        participants: newParticipants,
        unread_counts: newUnread,
        updated_at: nowIso
      });

      const msgId = `msg-sys-${Date.now()}`;
      await setDoc(doc(dbFirestore, 'conversations', convId, 'messages', msgId), {
        id: msgId,
        conversation_id: convId,
        sender_id: currentUser.id,
        sender_nom: currentUser.nom,
        content: `${currentUser.nom} a ajouté ${userToAdd.nom} au groupe.`,
        type: 'system',
        created_at: nowIso,
        read_by: [currentUser.id]
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `conversations/${convId}`);
    }
  },

  removeGroupMember: async (convId: string, userIdToRemove: string, targetName: string): Promise<void> => {
    if (!dbFirestore || !currentUser) return;
    try {
      const ref = doc(dbFirestore, 'conversations', convId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const data = snap.data() as Conversation;

      const nowIso = new Date().toISOString();
      // If leaving self, post system message while still in participant_ids so RLS Master Gate permits it
      if (userIdToRemove === currentUser.id) {
        const msgId = `msg-sys-${Date.now()}`;
        await setDoc(doc(dbFirestore, 'conversations', convId, 'messages', msgId), {
          id: msgId,
          conversation_id: convId,
          sender_id: currentUser.id,
          sender_nom: currentUser.nom,
          content: `${currentUser.nom} a quitté le groupe.`,
          type: 'system',
          created_at: nowIso,
          read_by: [currentUser.id]
        });
      }

      const newParticipantIds = (data.participant_ids || []).filter((id) => id !== userIdToRemove);
      const newParticipants = { ...(data.participants || {}) };
      delete newParticipants[userIdToRemove];

      const newAdmins = (data.admin_ids || []).filter((id) => id !== userIdToRemove);

      await updateDoc(ref, {
        participant_ids: newParticipantIds,
        participants: newParticipants,
        admin_ids: newAdmins,
        updated_at: nowIso
      });

      if (userIdToRemove !== currentUser.id) {
        const msgId = `msg-sys-${Date.now()}`;
        await setDoc(doc(dbFirestore, 'conversations', convId, 'messages', msgId), {
          id: msgId,
          conversation_id: convId,
          sender_id: currentUser.id,
          sender_nom: currentUser.nom,
          content: `${currentUser.nom} a retiré ${targetName} du groupe.`,
          type: 'system',
          created_at: nowIso,
          read_by: [currentUser.id]
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `conversations/${convId}`);
    }
  },

  toggleGroupAdmin: async (convId: string, userId: string, makeAdmin: boolean, targetName: string): Promise<void> => {
    if (!dbFirestore || !currentUser) return;
    try {
      const ref = doc(dbFirestore, 'conversations', convId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const data = snap.data() as Conversation;

      let admins = [...(data.admin_ids || [])];
      if (makeAdmin && !admins.includes(userId)) {
        admins.push(userId);
      } else if (!makeAdmin) {
        admins = admins.filter((id) => id !== userId);
      }

      const nowIso = new Date().toISOString();
      await updateDoc(ref, {
        admin_ids: admins,
        updated_at: nowIso
      });

      const msgId = `msg-sys-${Date.now()}`;
      await setDoc(doc(dbFirestore, 'conversations', convId, 'messages', msgId), {
        id: msgId,
        conversation_id: convId,
        sender_id: currentUser.id,
        sender_nom: currentUser.nom,
        content: makeAdmin
          ? `${currentUser.nom} a promu ${targetName} administrateur du groupe.`
          : `${currentUser.nom} a retiré les droits d'administration à ${targetName}.`,
        type: 'system',
        created_at: nowIso,
        read_by: [currentUser.id]
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `conversations/${convId}`);
    }
  },

  uploadAndSetAvatar: async (file: File): Promise<{ avatarUrl: string | null; url: string | null; error: string | null }> => {
    if (!currentUser || !dbFirestore) {
      return { avatarUrl: null, url: null, error: 'Utilisateur non connecté ou Firestore indisponible.' };
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (ev) => {
          const img = new Image();
          img.src = ev.target?.result as string;
          img.onload = () => {
            const maxWidth = 250;
            const maxHeight = 250;
            let w = img.width;
            let h = img.height;
            if (w > h) {
              if (w > maxWidth) { h = Math.round((h * maxWidth) / w); w = maxWidth; }
            } else {
              if (h > maxHeight) { w = Math.round((w * maxHeight) / h); h = maxHeight; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Canvas error'));
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
          };
          img.onerror = () => reject(new Error('Erreur de traitement image'));
        };
        reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
      });

      await updateDoc(doc(dbFirestore, 'users', currentUser.id), {
        avatar_url: dataUrl
      });
      currentUser.avatar_url = dataUrl;
      await syncPublicProfile(currentUser);
      await setDoc(doc(dbFirestore, 'user_settings', currentUser.id), {
        avatar_url: dataUrl
      }, { merge: true }).catch(() => {});
      return { avatarUrl: dataUrl, url: dataUrl, error: null };
    } catch (err: any) {
      return { avatarUrl: null, url: null, error: err.message || 'Erreur lors de la mise à jour de la photo.' };
    }
  }
};
