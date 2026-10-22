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
  signInWithPhoneNumber
} from 'firebase/auth';
import { 
  initializeFirestore,
  getFirestore, 
  setLogLevel,
  doc, 
  getDoc, 
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
  UserReport
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
          }
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
        
        // Mettre à jour le profil standard Firebase Auth (displayName et photoURL)
        try {
          await updateProfile(firebaseUser, {
            displayName: nom,
            photoURL: finalAvatar
          });
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
          nom,
          email,
          phone: phone || undefined,
          bio: bio || null,
          avatar_url: finalAvatar,
          role,
          langue_preferee: langue,
          created_at: new Date().toISOString()
        };
        
        await setDoc(doc(dbFirestore, 'users', firebaseUser.uid), profile);
        currentUser = profile;
        return { user: profile, error: null };
      }
      return { user: null, error: 'L\'inscription a échoué.' };
    } catch (err: any) {
      return { user: null, error: formatFirebaseAuthError(err) };
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
          return { user: profile, error: null };
        }
        const profile: UserProfile = {
          id: firebaseUser.uid,
          nom: firebaseUser.displayName || email.split('@')[0],
          email: firebaseUser.email || email,
          bio: 'Inscrit via email',
          avatar_url: firebaseUser.photoURL || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200`,
          role: 'utilisateur',
          langue_preferee: 'fr',
          created_at: new Date().toISOString()
        };
        await setDoc(doc(dbFirestore, 'users', firebaseUser.uid), profile);
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
            nom: firebaseUser.displayName || 'Utilisateur Google',
            email: firebaseUser.email || '',
            bio: 'Inscrit via Google',
            avatar_url: firebaseUser.photoURL || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200`,
            role: 'utilisateur',
            langue_preferee: 'fr',
            created_at: new Date().toISOString()
          };
          await setDoc(doc(dbFirestore, 'users', firebaseUser.uid), profile);
        }
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
    if (!dbFirestore) return [];
    try {
      const snap = await getDocs(collection(dbFirestore, 'users'));
      const list: UserProfile[] = [];
      snap.forEach(d => list.push(d.data() as UserProfile));
      return list;
    } catch (e) {
      console.warn('Info - Chargement utilisateurs:', e);
      return [];
    }
  },

  // --- CIRCLES ---
  getCircles: async (): Promise<Circle[]> => {
    if (!dbFirestore) return [];
    try {
      const querySnapshot = await getDocs(collection(dbFirestore, 'circles'));
      const cloudCircles: Circle[] = [];
      querySnapshot.forEach((docSnap) => {
        const c = docSnap.data() as Circle;
        // Filter out explicit demo/test circles
        const isDemo = c.id.startsWith('demo-') || 
                       c.id.startsWith('mock-') || 
                       c.id.includes('demo') ||
                       (c.nom && (
                         c.nom.toLowerCase().includes('démo') || 
                         c.nom.toLowerCase().includes('demo') ||
                         c.nom.toLowerCase().includes('exemple')
                       ));
        if (!isDemo) {
          cloudCircles.push(c);
        } else {
          deleteDoc(doc(dbFirestore, 'circles', docSnap.id)).catch(() => {});
        }
      });

      if (cloudCircles.length === 0) {
        const initialCircles: Circle[] = [
          {
            id: 'circle-sante-premiers-secours',
            nom: 'Santé & Premiers secours',
            description: 'Gestes de premiers secours, prise en charge des urgences communautaires, brûlures et soins de santé primaire en Afrique de l\'Ouest.',
            categorie: 'Médecine',
            image: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&q=80&w=600',
            created_at: new Date().toISOString()
          },
          {
            id: 'circle-langues-locales',
            nom: 'Langues & Proverbes Africains',
            description: 'Apprentissage, vocabulaire et sagesse des langues régionales (Haoussa, Zarma, Bambara, Fulfulde).',
            categorie: 'Langues',
            image: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&q=80&w=600',
            created_at: new Date().toISOString()
          },
          {
            id: 'circle-agri-sahel',
            nom: 'Agriculture & Sols du Sahel',
            description: 'Pratiques d\'irrigation durable, conservation de l\'eau et fertilisation biologique.',
            categorie: 'Sciences',
            image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=600',
            created_at: new Date().toISOString()
          }
        ];

        for (const circleItem of initialCircles) {
          try {
            await setDoc(doc(dbFirestore, 'circles', circleItem.id), circleItem);
            cloudCircles.push(circleItem);
          } catch (err) {
            console.warn('Error seeding initial circle:', err);
          }
        }
      }

      return cloudCircles.sort((a, b) => a.nom.localeCompare(b.nom));
    } catch (error) {
      console.warn('Info - Chargement cercles:', error);
      return [];
    }
  },

  deleteCircle: async (circleId: string): Promise<boolean> => {
    if (!dbFirestore) return false;
    try {
      await deleteDoc(doc(dbFirestore, 'circles', circleId));
      try {
        const q = query(collection(dbFirestore, 'circle_members'), where('circle_id', '==', circleId));
        const snap = await getDocs(q);
        snap.forEach(async (d) => {
          await deleteDoc(d.ref);
        });
      } catch {
        // ignore
      }
      return true;
    } catch (error) {
      console.warn('Info - Supprimer cercle:', error);
      return false;
    }
  },

  createCircle: async (nom: string, description: string, categorie: string, image: string): Promise<Circle> => {
    if (!dbFirestore) throw new Error('Firestore non connecté.');
    const newCircle: Circle = {
      id: `circle-${Date.now()}`,
      nom,
      description,
      categorie,
      image: image || 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&q=80&w=600',
      created_at: new Date().toISOString()
    };

    await setDoc(doc(dbFirestore, 'circles', newCircle.id), newCircle);

    if (currentUser) {
      const member: CircleMember = {
        user_id: currentUser.id,
        circle_id: newCircle.id,
        role: 'moderateur',
        joined_at: new Date().toISOString()
      };
      await setDoc(doc(dbFirestore, 'circle_members', `${currentUser.id}_${newCircle.id}`), member);
    }
    return newCircle;
  },

  // --- CIRCLE MEMBERSHIP ---
  getJoinedCircleIds: async (userId: string): Promise<string[]> => {
    if (!dbFirestore) return [];
    try {
      const q = query(collection(dbFirestore, 'circle_members'), where('user_id', '==', userId));
      const querySnapshot = await getDocs(q);
      const joined: string[] = [];
      querySnapshot.forEach((docSnap) => {
        const m = docSnap.data() as CircleMember;
        joined.push(m.circle_id);
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
    if (!dbFirestore) return [];
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

      // Filter out demo capsules
      capsulesData = capsulesData.filter(c => {
        const isDemo = c.id.startsWith('demo-') || 
                       c.id.startsWith('mock-') || 
                       c.id.includes('demo') ||
                       (c.contenu && (
                         c.contenu.toLowerCase().includes('démo') || 
                         c.contenu.toLowerCase().includes('demo') ||
                         c.contenu.toLowerCase().includes('bienvenue sur zaure')
                       ));
        if (isDemo) {
          deleteDoc(doc(dbFirestore, 'capsules', c.id)).catch(() => {});
          return false;
        }
        return true;
      });

      // Seed burns capsule for Santé & Premiers secours if empty
      if (
        capsulesData.length === 0 && 
        circleIds && 
        circleIds.length === 1 && 
        (circleIds[0] === 'circle-sante-premiers-secours' || circleIds[0].includes('sante'))
      ) {
        const seedCapsule: Capsule = {
          id: `capsule-brulures-${Date.now()}`,
          auteur_id: 'dr-mahamadou-medecin',
          circle_id: circleIds[0],
          type: 'texte',
          contenu: 'Prise en charge immédiate des brûlures thermiques : Refroidir immédiatement la zone brûlée avec de l\'eau propre à température ambiante (15-20°C) pendant au moins 15 minutes. Ne jamais appliquer d\'huile, dentifrice ou glace. Couvrir avec un linge propre et consulter un centre de santé.',
          langue_dorigine: 'fr',
          created_at: new Date().toISOString(),
          auteur_nom: 'Dr. Mahamadou',
          auteur_role: 'verifie',
          circle_nom: 'Santé & Premiers secours'
        };

        try {
          await setDoc(doc(dbFirestore, 'capsules', seedCapsule.id), {
            id: seedCapsule.id,
            auteur_id: seedCapsule.auteur_id,
            circle_id: seedCapsule.circle_id,
            circleId: seedCapsule.circle_id,
            type: seedCapsule.type,
            contenu: seedCapsule.contenu,
            langue_dorigine: seedCapsule.langue_dorigine,
            created_at: seedCapsule.created_at
          });
          capsulesData.push(seedCapsule);
        } catch (err) {
          console.warn('Error seeding burn capsule:', err);
        }
      }

      // Sort descending by date
      capsulesData.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

      const circlesData = await zaureService.getCircles();
      const finalCapsules: Capsule[] = [];

      for (const c of capsulesData) {
        let auteurNom = c.auteur_nom || 'Auteur inconnu';
        let auteurRole = c.auteur_role || 'utilisateur';
        let auteurAvatar = c.auteur_avatar || '';

        try {
          const uDoc = await getDoc(doc(dbFirestore, 'users', c.auteur_id));
          if (uDoc.exists()) {
            const profile = uDoc.data() as UserProfile;
            auteurNom = profile.nom;
            auteurRole = profile.role;
            auteurAvatar = profile.avatar_url || '';
          }
        } catch (e) {
          // ignore profile fetch error
        }

        const cid = c.circle_id || (c as any).circleId;
        finalCapsules.push({
          ...c,
          circle_id: cid,
          auteur_nom: auteurNom,
          auteur_role: auteurRole,
          auteur_avatar: auteurAvatar,
          circle_nom: circlesData.find(circ => circ.id === cid)?.nom || c.circle_nom || 'Cercle'
        });
      }

      return finalCapsules.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    } catch (e) {
      console.warn('Info - Chargement capsules:', e);
      return [];
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

    const circlesData = await zaureService.getCircles();
    const circleNom = circlesData.find(c => c.id === circleId)?.nom || 'Cercle';

    const newCapsule: Capsule = {
      id: `capsule-${Date.now()}`,
      auteur_id: currentUser.id,
      circle_id: circleId,
      type,
      contenu,
      langue_dorigine: langue,
      created_at: new Date().toISOString(),
      auteur_nom: currentUser.nom,
      auteur_role: currentUser.role,
      auteur_avatar: currentUser.avatar_url || '',
      circle_nom: circleNom
    };

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

    return newCapsule;
  },

  deleteCapsule: async (capsuleId: string): Promise<boolean> => {
    if (!dbFirestore) return false;
    try {
      await deleteDoc(doc(dbFirestore, 'capsules', capsuleId));
      return true;
    } catch (e) {
      console.warn('Info - Supprimer capsule:', e);
      return false;
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
      }

      return await zaureService.getReactions(capsuleId);
    } catch (error) {
      console.warn('Info - Bascule réaction:', error);
      return [];
    }
  },

  // --- COMMENTS ---
  getComments: async (capsuleId: string): Promise<Comment[]> => {
    if (!dbFirestore) return [];
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
          const uDoc = await getDoc(doc(dbFirestore, 'users', c.auteur_id));
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
      console.warn('Info - Commentaires:', error);
      return [];
    }
  },

  addComment: async (capsuleId: string, contenu: string): Promise<Comment> => {
    if (!currentUser) throw new Error('Utilisateur non connecté.');
    if (!dbFirestore) throw new Error('Firestore non connecté.');

    const newComment: Comment = {
      id: `comment-${Date.now()}`,
      capsule_id: capsuleId,
      auteur_id: currentUser.id,
      contenu,
      created_at: new Date().toISOString(),
      auteur_nom: currentUser.nom,
      auteur_avatar: currentUser.avatar_url || ''
    };

    await setDoc(doc(dbFirestore, 'comments', newComment.id), {
      id: newComment.id,
      capsule_id: newComment.capsule_id,
      auteur_id: newComment.auteur_id,
      contenu: newComment.contenu,
      created_at: newComment.created_at
    });

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
              console.warn('Info - Storage upload error, using local data URL fallback:', error);
              const reader = new FileReader();
              reader.onloadend = () => {
                resolve({
                  type: attType,
                  url: reader.result as string,
                  name: safeName,
                  size: file.size,
                  mime_type: file.type
                });
              };
              reader.onerror = () => reject(error);
              reader.readAsDataURL(file);
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
                console.warn('Info - getDownloadURL failed, using fallback:', err);
                const reader = new FileReader();
                reader.onloadend = () => {
                  resolve({
                    type: attType,
                    url: reader.result as string,
                    name: safeName,
                    size: file.size,
                    mime_type: file.type
                  });
                };
                reader.readAsDataURL(file);
              }
            }
          );
        });
      } catch (e) {
        console.warn('Info - Storage init error, fallback data URL:', e);
      }
    }

    return new Promise<MessageAttachment>((resolve) => {
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
      reader.readAsDataURL(file);
    });
  },

  // --- CONVERSATIONS TEMPS RÉEL (STYLE MESSENGER) ---
  subscribeUserConversations: (userId: string, callback: (conversations: Conversation[]) => void): (() => void) => {
    if (!dbFirestore || !userId) {
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
            is_muted_by: data.is_muted_by || []
          });
        });

        list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        callback(list);
      }, (error) => {
        console.warn('Info - Listener conversations:', error);
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
    if (!dbFirestore || !convId) {
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
            is_deleted: data.is_deleted || false
          });
        });
        callback(list);
      }, (error) => {
        console.warn('Info - Listener messages:', error);
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
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    const newMessage: Message = {
      id: messageId,
      conversation_id: conversationId,
      sender_id: currentUser.id,
      receiver_id: receiverId,
      content,
      created_at: nowIso,
      sender_nom: currentUser.nom,
      sender_avatar: currentUser.avatar_url || undefined,
      type,
      attachments,
      reply_to: replyTo,
      reactions: {},
      read_by: [currentUser.id],
      status: 'sent',
      is_edited: false,
      is_deleted: false
    };

    const msgDocRef = doc(dbFirestore, 'conversations', conversationId, 'messages', messageId);
    await setDoc(msgDocRef, newMessage);

    let displayPreview = content;
    if (type === 'image') displayPreview = '📷 Photo';
    else if (type === 'video') displayPreview = '🎥 Vidéo';
    else if (type === 'audio') displayPreview = '🎤 Note vocale';
    else if (type === 'file') displayPreview = `📎 ${attachments[0]?.name || 'Fichier'}`;

    const convDocRef = doc(dbFirestore, 'conversations', conversationId);
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
          avatar_url: currentUser.avatar_url,
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
        is_muted_by: []
      });
    }

    return newMessage;
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
    const uniqueMemberIds = Array.from(new Set([currentUser.id, ...params.memberIds]));

    const participantsMap: Record<string, ConversationParticipant> = {
      [currentUser.id]: {
        id: currentUser.id,
        nom: currentUser.nom,
        avatar_url: currentUser.avatar_url,
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
            avatar_url: u.avatar_url,
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
      group_name: params.groupName,
      group_description: params.groupDescription || '',
      group_photo: params.groupPhoto || '',
      admin_ids: [currentUser.id],
      last_message: {
        content: `${currentUser.nom} a créé le groupe « ${params.groupName} »`,
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
      is_muted_by: []
    };

    const groupRef = doc(dbFirestore, 'conversations', groupId);
    await setDoc(groupRef, newGroup);

    const msgId = `msg-sys-${Date.now()}`;
    await setDoc(doc(dbFirestore, 'conversations', groupId, 'messages', msgId), {
      id: msgId,
      conversation_id: groupId,
      sender_id: currentUser.id,
      sender_nom: currentUser.nom,
      content: `${currentUser.nom} a créé le groupe « ${params.groupName} »`,
      type: 'system',
      created_at: nowIso,
      read_by: [currentUser.id]
    });

    return newGroup;
  },

  updateGroupDetails: async (convId: string, updates: Partial<Conversation>): Promise<void> => {
    if (!dbFirestore) return;
    const ref = doc(dbFirestore, 'conversations', convId);
    await updateDoc(ref, {
      ...updates,
      updated_at: new Date().toISOString()
    });
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
          is_deleted: data.is_deleted || false
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
  },

  editChatMessage: async (convId: string, messageId: string, newContent: string): Promise<void> => {
    if (!currentUser || !dbFirestore) return;
    const msgRef = doc(dbFirestore, 'conversations', convId, 'messages', messageId);
    await updateDoc(msgRef, {
      content: newContent,
      is_edited: true,
      updated_at: new Date().toISOString()
    });
  },

  deleteChatMessage: async (convId: string, messageId: string): Promise<void> => {
    if (!currentUser || !dbFirestore) return;
    const msgRef = doc(dbFirestore, 'conversations', convId, 'messages', messageId);
    await updateDoc(msgRef, {
      content: 'Ce message a été supprimé',
      attachments: [],
      is_deleted: true,
      updated_at: new Date().toISOString()
    });
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
      email: currentUser?.email || '',
      bio: currentUser?.bio || '',
      avatar_url: currentUser?.avatar_url || '',
      langue_preferee: currentUser?.langue_preferee || 'fr',
      langue_interface: currentUser?.langue_preferee || 'fr'
    };

    if (!dbFirestore) return baseSettings;

    try {
      const settingsDoc = await getDoc(doc(dbFirestore, 'user_settings', userId));
      if (settingsDoc.exists()) {
        return { ...baseSettings, ...settingsDoc.data() as UserSettings };
      }
    } catch (error) {
      console.error('Erreur lors du chargement des préférences:', error);
    }

    return baseSettings;
  },

  saveUserSettings: async (userId: string, newSettings: Partial<UserSettings>): Promise<boolean> => {
    if (!dbFirestore) return false;
    try {
      await setDoc(doc(dbFirestore, 'user_settings', userId), newSettings, { merge: true });
      return true;
    } catch (error) {
      console.error('Erreur sauvegarde des préférences:', error);
      return false;
    }
  },

  updateUserProfile: async (
    userId: string, 
    updates: { nom?: string; bio?: string; avatar_url?: string; langue_preferee?: 'fr' | 'ha' | 'en' }
  ): Promise<{ user: UserProfile | null, error: string | null }> => {
    if (!dbFirestore) return { user: null, error: 'Firestore non connecté' };

    try {
      await updateDoc(doc(dbFirestore, 'users', userId), updates);
      if (currentUser && currentUser.id === userId) {
        currentUser = { ...currentUser, ...updates };
      }
      return { user: currentUser, error: null };
    } catch (error: any) {
      return { user: null, error: error.message || 'Erreur lors de la mise à jour' };
    }
  },

  // --- USER AVAILABILITY & PROFILE MANAGEMENT (ÉTAPE 2) ---
  setUserAvailability: async (status: 'online' | 'busy' | 'offline', statusMessage?: string): Promise<void> => {
    if (!currentUser || !dbFirestore) return;
    try {
      const updates: any = {
        availability: status,
        last_active: new Date().toISOString()
      };
      if (statusMessage !== undefined) updates.status_message = statusMessage;
      await updateDoc(doc(dbFirestore, 'users', currentUser.id), updates);
      currentUser.availability = status;
      if (statusMessage !== undefined) currentUser.status_message = statusMessage;
      currentUser.last_active = updates.last_active;
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
    if (!dbFirestore) return null;
    try {
      const userDoc = await getDoc(doc(dbFirestore, 'users', userId));
      if (!userDoc.exists()) return null;
      const data = userDoc.data();
      return {
        id: userDoc.id,
        nom: data.nom || 'Membre Zaure',
        email: data.email || '',
        bio: data.bio || null,
        avatar_url: data.avatar_url || null,
        role: data.role || 'utilisateur',
        langue_preferee: data.langue_preferee || 'fr',
        created_at: data.created_at || undefined,
        availability: data.availability || 'online',
        status_message: data.status_message || '',
        last_active: data.last_active || undefined
      };
    } catch (e) {
      console.error('Erreur profil public:', e);
      return null;
    }
  },

  changeUserEmail: async (newEmail: string): Promise<{ success: boolean; error: string | null }> => {
    if (!currentUser) return { success: false, error: 'Utilisateur non connecté' };
    if (!auth || !auth.currentUser || !dbFirestore) {
      return { success: false, error: 'Firebase non disponible' };
    }

    try {
      await updateEmail(auth.currentUser, newEmail);
      await updateDoc(doc(dbFirestore, 'users', currentUser.id), { email: newEmail });
      currentUser.email = newEmail;
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur lors de la mise à jour de l\'email' };
    }
  },

  changeUserPassword: async (newPassword: string): Promise<{ success: boolean; error: string | null }> => {
    if (!auth || !auth.currentUser) {
      return { success: false, error: 'Utilisateur non connecté' };
    }

    try {
      await updatePassword(auth.currentUser, newPassword);
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur lors du changement de mot de passe.' };
    }
  },

  deleteAccount: async (userId: string): Promise<{ success: boolean; error: string | null }> => {
    if (!dbFirestore) return { success: false, error: 'Firestore non disponible' };

    try {
      await deleteDoc(doc(dbFirestore, 'users', userId));
      await deleteDoc(doc(dbFirestore, 'user_settings', userId));
      if (auth && auth.currentUser) {
        await deleteUser(auth.currentUser);
      }
      currentUser = null;
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur lors de la suppression du compte' };
    }
  },

  getAllUsersList: async (): Promise<UserProfile[]> => {
    return zaureService.getAvailableUsers();
  },

  addGroupMember: async (convId: string, userToAdd: UserProfile): Promise<void> => {
    if (!dbFirestore || !currentUser) return;
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
  },

  removeGroupMember: async (convId: string, userIdToRemove: string, targetName: string): Promise<void> => {
    if (!dbFirestore || !currentUser) return;
    const ref = doc(dbFirestore, 'conversations', convId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data() as Conversation;

    const newParticipantIds = (data.participant_ids || []).filter((id) => id !== userIdToRemove);
    const newParticipants = { ...(data.participants || {}) };
    delete newParticipants[userIdToRemove];

    const newAdmins = (data.admin_ids || []).filter((id) => id !== userIdToRemove);

    const nowIso = new Date().toISOString();
    await updateDoc(ref, {
      participant_ids: newParticipantIds,
      participants: newParticipants,
      admin_ids: newAdmins,
      updated_at: nowIso
    });

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
  },

  toggleGroupAdmin: async (convId: string, userId: string, makeAdmin: boolean, targetName: string): Promise<void> => {
    if (!dbFirestore || !currentUser) return;
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
      return { avatarUrl: dataUrl, url: dataUrl, error: null };
    } catch (err: any) {
      return { avatarUrl: null, url: null, error: err.message || 'Erreur lors de la mise à jour de la photo.' };
    }
  }
};
