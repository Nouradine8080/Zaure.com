import { doc, getDoc } from 'firebase/firestore';
import { auth, dbFirestore } from '../../firebaseClient';
import type { AlgorithmEvent, AlgorithmUserStats } from '../../types/algorithm';
import { foldEventIntoUserStats } from './algorithmConfig';

const STORAGE_PREFIX = 'zaure_alg_user_stats_';

function safeGetStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

class AlgorithmUserServiceImpl {
  private memoryCache = new Map<string, AlgorithmUserStats>();
  private fetchedAt = new Map<string, number>();

  createEmptyStats(userId: string): AlgorithmUserStats {
    const now = new Date().toISOString();
    return {
      userId,
      totalEvents: 0,
      viewsCount: 0,
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      savesCount: 0,
      videoCompletionsCount: 0,
      searchesCount: 0,
      activeDays: 0,
      lastEventAt: '',
      updatedAt: now
    };
  }

  private getStorageKey(userId: string): string {
    return `${STORAGE_PREFIX}${userId}`;
  }

  private readLocalStats(userId: string): AlgorithmUserStats | null {
    const cached = this.memoryCache.get(userId);
    if (cached) return cached;

    const storage = safeGetStorage();
    if (!storage || !userId) return null;
    try {
      const raw = storage.getItem(this.getStorageKey(userId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as AlgorithmUserStats;
      if (parsed && parsed.userId === userId) {
        this.memoryCache.set(userId, parsed);
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  saveLocalStats(stats: AlgorithmUserStats): void {
    if (!stats.userId) return;
    this.memoryCache.set(stats.userId, stats);
    const storage = safeGetStorage();
    if (!storage) return;
    try {
      storage.setItem(this.getStorageKey(stats.userId), JSON.stringify(stats));
    } catch {
      // Ignore storage quota errors
    }
  }

  updateFromEvent(event: AlgorithmEvent): AlgorithmUserStats {
    const current = this.readLocalStats(event.userId) || this.createEmptyStats(event.userId);
    const updated = foldEventIntoUserStats(current, event);
    this.saveLocalStats(updated);
    return updated;
  }

  async getUserStats(userId: string, forceRefresh = false): Promise<AlgorithmUserStats> {
    const local = this.readLocalStats(userId);
    const last = this.fetchedAt.get(userId) || 0;
    if (local && !forceRefresh && Date.now() - last < 60_000) {
      return local;
    }

    if (dbFirestore && auth?.currentUser?.uid === userId) {
      try {
        const snap = await getDoc(doc(dbFirestore, 'algorithm_user_stats', userId));
        this.fetchedAt.set(userId, Date.now());
        if (snap.exists()) {
          const remote = snap.data() as AlgorithmUserStats;
          if (!local || (remote.totalEvents || 0) >= (local.totalEvents || 0)) {
            this.saveLocalStats(remote);
            return remote;
          }
        }
      } catch {
        // Fallback to local cache cleanly
      }
    }

    return local || this.createEmptyStats(userId);
  }

  clearUserCache(userId?: string): void {
    if (userId) {
      this.memoryCache.delete(userId);
      this.fetchedAt.delete(userId);
      safeGetStorage()?.removeItem(this.getStorageKey(userId));
    } else {
      this.memoryCache.clear();
      this.fetchedAt.clear();
    }
  }
}

export const algorithmUserService = new AlgorithmUserServiceImpl();
