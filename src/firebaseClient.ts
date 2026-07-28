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
  onAuthStateChanged
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
  onSnapshot
} from 'firebase/firestore';
import { UserProfile, Circle, CircleMember, Capsule, Comment, Reaction, Message, UserSettings, DEFAULT_USER_SETTINGS } from './types';

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
    setLogLevel('silent');
  } catch (error) {
    console.warn('Info - initialisation Firebase:', error);
  }
}

let currentUser: UserProfile | null = null;

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
    password?: string
  ): Promise<{ user: UserProfile | null, error: string | null }> => {
    if (!auth || !dbFirestore) {
      return { user: null, error: 'Firebase n\'est pas connecté.' };
    }
    try {
      const securePassword = password || 'Password123!';
      const { user: firebaseUser } = await createUserWithEmailAndPassword(auth, email, securePassword);
      if (firebaseUser) {
        const profile: UserProfile = {
          id: firebaseUser.uid,
          nom,
          email,
          bio: bio || null,
          avatar_url: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200`,
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
      return { user: null, error: err.message || 'Erreur lors de l\'inscription.' };
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
      return { user: null, error: err.message || 'Identifiants invalides.' };
    }
  },

  signInWithGoogle: async (): Promise<{ user: UserProfile | null, error: string | null }> => {
    if (!auth || !dbFirestore) {
      return { user: null, error: 'Firebase n\'est pas connecté.' };
    }
    try {
      const provider = new GoogleAuthProvider();
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
      return { user: null, error: err.message || 'Erreur d\'authentification Google.' };
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

  // --- PRIVATE MESSAGES ---
  subscribePrivateMessages: (otherUserId: string, callback: (messages: Message[]) => void): (() => void) => {
    if (!currentUser || !dbFirestore) {
      callback([]);
      return () => {};
    }

    const convId = [currentUser.id, otherUserId].sort().join('_');

    try {
      const messagesRef = collection(dbFirestore, 'conversations', convId, 'messages');
      const q = query(messagesRef, orderBy('created_at', 'asc'));

      const unsubscribe = onSnapshot(q, (snapshot) => {
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
    if (!dbFirestore) throw new Error('Firestore non connecté.');

    const convId = [currentUser.id, receiverId].sort().join('_');
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    const newMessage: Message = {
      id: messageId,
      sender_id: currentUser.id,
      receiver_id: receiverId,
      content,
      created_at: nowIso,
      sender_nom: currentUser.nom
    };

    const docRef = doc(dbFirestore, 'conversations', convId, 'messages', messageId);
    await setDoc(docRef, {
      id: messageId,
      conversation_id: convId,
      sender_id: currentUser.id,
      senderId: currentUser.id,
      receiver_id: receiverId,
      receiverId: receiverId,
      content: content,
      created_at: nowIso,
      createdAt: nowIso,
      sender_nom: currentUser.nom,
      senderNom: currentUser.nom
    });

    return newMessage;
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
  }
};
