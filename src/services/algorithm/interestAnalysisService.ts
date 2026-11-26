import { doc, getDoc } from 'firebase/firestore';
import { auth, dbFirestore } from '../../firebaseClient';
import type { AlgorithmEvent, UserInterestProfile } from '../../types/algorithm';
import {
  ALGORITHM_DECAY_VERSION,
  computeDecayFactor,
  foldEventIntoInterestProfile,
  INTEREST_TOPIC_LABELS,
  MAX_TOP_TOPICS,
  normalizeInterestMap
} from './algorithmConfig';

const STORAGE_PREFIX = 'zaure_alg_interests_';

function safeGetStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

class InterestAnalysisServiceImpl {
  private memoryCache = new Map<string, UserInterestProfile>();
  private firestoreFetchedAt = new Map<string, number>();

  private getStorageKey(userId: string): string {
    return `${STORAGE_PREFIX}${userId}`;
  }

  createEmptyProfile(userId: string): UserInterestProfile {
    return {
      userId,
      interests: {},
      topTopics: [],
      affinityAuthors: {},
      affinityCircles: {},
      decayVersion: ALGORITHM_DECAY_VERSION,
      totalSignals: 0,
      updatedAt: new Date().toISOString()
    };
  }

  private readLocalProfile(userId: string): UserInterestProfile | null {
    const inMem = this.memoryCache.get(userId);
    if (inMem) return inMem;

    const storage = safeGetStorage();
    if (!storage || !userId) return null;
    try {
      const raw = storage.getItem(this.getStorageKey(userId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as UserInterestProfile;
      if (parsed && parsed.userId === userId && typeof parsed.interests === 'object') {
        this.memoryCache.set(userId, parsed);
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  saveLocalProfile(profile: UserInterestProfile): void {
    if (!profile.userId) return;
    this.memoryCache.set(profile.userId, profile);
    const storage = safeGetStorage();
    if (!storage) return;
    try {
      storage.setItem(this.getStorageKey(profile.userId), JSON.stringify(profile));
    } catch {
      // Ignore quota errors
    }
  }

  /**
   * Applies time decay so older habits fade naturally as new interests emerge.
   */
  applyDecay(profile: UserInterestProfile, referenceIso = new Date().toISOString()): UserInterestProfile {
    const decay = computeDecayFactor(profile.updatedAt, referenceIso);
    if (decay >= 0.999) return profile;

    const decayedInterests: Record<string, number> = {};
    for (const [k, v] of Object.entries(profile.interests || {})) {
      const next = v * decay;
      if (next > 0.05) decayedInterests[k] = next;
    }

    const normalized = normalizeInterestMap(decayedInterests);
    const topTopics = Object.entries(normalized)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_TOP_TOPICS)
      .map(([k]) => k);

    return {
      ...profile,
      interests: normalized,
      topTopics,
      updatedAt: referenceIso
    };
  }

  /**
   * Analyzes a sequence of interaction events and updates the user's interest profile cleanly.
   */
  analyzeEvents(
    userId: string,
    events: AlgorithmEvent[],
    seedProfile?: UserInterestProfile | null
  ): UserInterestProfile {
    let current = seedProfile || this.readLocalProfile(userId) || this.createEmptyProfile(userId);
    for (const evt of events) {
      if (evt.userId !== userId) continue;
      current = foldEventIntoInterestProfile(current, evt);
    }
    this.saveLocalProfile(current);
    return current;
  }

  updateFromSingleEvent(event: AlgorithmEvent): UserInterestProfile {
    const current = this.readLocalProfile(event.userId) || this.createEmptyProfile(event.userId);
    const updated = foldEventIntoInterestProfile(current, event);
    this.saveLocalProfile(updated);
    return updated;
  }

  /**
   * Fetches user interests using SWR cache + minimal Firestore reads (60s TTL).
   */
  async getUserInterests(userId: string, forceRefresh = false): Promise<UserInterestProfile> {
    const local = this.readLocalProfile(userId);
    const lastFetch = this.firestoreFetchedAt.get(userId) || 0;
    const isFresh = !forceRefresh && Date.now() - lastFetch < 60_000;

    if (local && isFresh) {
      return this.applyDecay(local);
    }

    if (dbFirestore && auth?.currentUser?.uid === userId) {
      try {
        const snap = await getDoc(doc(dbFirestore, 'user_interests', userId));
        this.firestoreFetchedAt.set(userId, Date.now());
        if (snap.exists()) {
          const remote = snap.data() as UserInterestProfile;
          // Prefer whichever has more recent or higher signal count when local has optimistic updates
          if (!local || (remote.totalSignals || 0) >= (local.totalSignals || 0)) {
            this.saveLocalProfile(remote);
            return this.applyDecay(remote);
          }
        }
      } catch {
        // Offline or permission fallback uses local profile cleanly
      }
    }

    return local ? this.applyDecay(local) : this.createEmptyProfile(userId);
  }

  getReadableTopInterests(
    profile: UserInterestProfile,
    maxItems = 5
  ): Array<{ id: string; label: string; score: number }> {
    return Object.entries(profile.interests || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxItems)
      .map(([id, score]) => ({
        id,
        label: INTEREST_TOPIC_LABELS[id as keyof typeof INTEREST_TOPIC_LABELS] || id,
        score: Math.round(score * 100) / 100
      }));
  }

  clearUserCache(userId?: string): void {
    if (userId) {
      this.memoryCache.delete(userId);
      this.firestoreFetchedAt.delete(userId);
      const storage = safeGetStorage();
      storage?.removeItem(this.getStorageKey(userId));
    } else {
      this.memoryCache.clear();
      this.firestoreFetchedAt.clear();
    }
  }
}

export const interestAnalysisService = new InterestAnalysisServiceImpl();
