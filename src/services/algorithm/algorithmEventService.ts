import { collection, doc, getDocs, limit, query, where, writeBatch } from 'firebase/firestore';
import { auth, dbFirestore } from '../../firebaseClient';
import type {
  AlgorithmEvent,
  AlgorithmEventType,
  TrackEventInput
} from '../../types/algorithm';
import {
  extractTopicsFromText,
  isValidFirestoreDocId,
  normalizeTextForMatching,
  sanitizeAlgorithmMetadata,
  stripSensitivePatterns,
  VALID_ALGORITHM_EVENT_TYPES
} from './algorithmConfig';

const MAX_BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 3500;
const MAX_OFFLINE_QUEUE_SIZE = 100;
const MAX_DEDUP_CACHE_ENTRIES = 600;
const OFFLINE_STORAGE_PREFIX = 'zaure_alg_offline_queue_';

const DEDUP_WINDOWS_MS: Partial<Record<AlgorithmEventType, number>> = {
  post_view: 30 * 60 * 1000, // 30 minutes per session
  video_view: 15 * 60 * 1000, // 15 minutes
  video_completion: 5 * 60 * 1000,
  profile_visit: 15 * 60 * 1000,
  search: 60 * 1000,
  post_like: 2000,
  post_save: 2000
};

function safeGetStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

function isOnline(): boolean {
  try {
    return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
  } catch {
    return true;
  }
}

function makeEventId(eventType: AlgorithmEventType): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const shortType = eventType.replace(/_/g, '').slice(0, 8);
  return `evt_${shortType}_${Date.now()}_${rand}`;
}

function normalizeSearchTargetId(rawQuery: string): string {
  const clean = normalizeTextForMatching(stripSensitivePatterns(rawQuery)).replace(/[^a-z0-9]+/g, '_');
  const trimmed = clean.replace(/^_+|_+$/g, '').slice(0, 64);
  return trimmed ? `q_${trimmed}` : 'q_general';
}

export type OnBatchCommittedListener = (
  events: AlgorithmEvent[],
  serverResult?: { persistedToFirestore?: boolean } | null
) => void | Promise<void>;

class AlgorithmEventServiceImpl {
  private memoryQueue: AlgorithmEvent[] = [];
  private dedupMap = new Map<string, number>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private isFlushing = false;
  private lastFlushAt: string | null = null;
  private serverSyncAvailable: boolean | null = null;
  private listeners = new Set<OnBatchCommittedListener>();

  onBatchCommitted(listener: OnBatchCommittedListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getQueueSnapshot(): { pendingCount: number; offlineCount: number; lastFlushAt: string | null; serverSyncAvailable: boolean | null } {
    const uid = auth?.currentUser?.uid || null;
    const offlineCount = uid ? this.readOfflineQueue(uid).length : 0;
    return {
      pendingCount: this.memoryQueue.length,
      offlineCount,
      lastFlushAt: this.lastFlushAt,
      serverSyncAvailable: this.serverSyncAvailable
    };
  }

  private getOfflineStorageKey(userId: string): string {
    return `${OFFLINE_STORAGE_PREFIX}${userId}`;
  }

  private readOfflineQueue(userId: string): AlgorithmEvent[] {
    const storage = safeGetStorage();
    if (!storage || !userId) return [];
    try {
      const raw = storage.getItem(this.getOfflineStorageKey(userId));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as AlgorithmEvent[]) : [];
    } catch {
      return [];
    }
  }

  private writeOfflineQueue(userId: string, events: AlgorithmEvent[]): void {
    const storage = safeGetStorage();
    if (!storage || !userId) return;
    try {
      if (events.length === 0) {
        storage.removeItem(this.getOfflineStorageKey(userId));
      } else {
        storage.setItem(
          this.getOfflineStorageKey(userId),
          JSON.stringify(events.slice(-MAX_OFFLINE_QUEUE_SIZE))
        );
      }
    } catch {
      // Ignore storage quota issues on low-end devices
    }
  }

  private isDuplicate(event: AlgorithmEvent): boolean {
    const windowMs = DEDUP_WINDOWS_MS[event.eventType];
    if (!windowMs) return false;

    const dedupKey = `${event.userId}:${event.eventType}:${event.targetId}`;
    const nowMs = Date.now();
    const prevMs = this.dedupMap.get(dedupKey);

    if (prevMs !== undefined && nowMs - prevMs < windowMs) {
      return true;
    }

    if (this.dedupMap.size >= MAX_DEDUP_CACHE_ENTRIES) {
      // Evict oldest 100 entries to stay memory-light on Android
      let removed = 0;
      for (const k of this.dedupMap.keys()) {
        this.dedupMap.delete(k);
        removed += 1;
        if (removed >= 100) break;
      }
    }

    this.dedupMap.set(dedupKey, nowMs);
    return false;
  }

  buildSanitizedEvent(input: TrackEventInput): AlgorithmEvent | null {
    if (!input.userId || !isValidFirestoreDocId(input.userId, 128)) return null;
    if (!VALID_ALGORITHM_EVENT_TYPES.includes(input.eventType)) return null;

    let targetId = (input.targetId || '').trim();
    if (input.eventType === 'search') {
      const cleanedQuery = stripSensitivePatterns(targetId);
      if (cleanedQuery.length < 2) return null;
      // Do not persist raw sensitive search strings if redacted
      if (cleanedQuery.includes('[email-redacted]') || cleanedQuery.includes('[phone-redacted]')) {
        return null;
      }
      targetId = normalizeSearchTargetId(cleanedQuery);
    }

    if (!targetId || targetId.length > 260) return null;

    const rawMeta: Record<string, unknown> = { ...(input.metadata || {}) };

    if (input.textSample && typeof input.textSample === 'string') {
      const extracted = extractTopicsFromText(
        input.textSample,
        typeof rawMeta.category === 'string' ? rawMeta.category : null
      );
      if (extracted.length > 0 && !Array.isArray(rawMeta.topics)) {
        rawMeta.topics = extracted;
      }
    }

    if (input.eventType === 'search' && typeof input.targetId === 'string') {
      const queryNorm = normalizeTextForMatching(stripSensitivePatterns(input.targetId)).slice(0, 80);
      if (queryNorm) {
        rawMeta.queryNormalized = queryNorm;
        const extracted = extractTopicsFromText(queryNorm);
        if (extracted.length > 0 && !Array.isArray(rawMeta.topics)) {
          rawMeta.topics = extracted;
        }
      }
    }

    const metadata = sanitizeAlgorithmMetadata(rawMeta);
    const id = makeEventId(input.eventType);
    const timestamp = input.timestamp || new Date().toISOString();

    return {
      id,
      userId: input.userId,
      eventType: input.eventType,
      targetId,
      targetType: input.targetType,
      timestamp,
      metadata
    };
  }

  /**
   * Primary entry point: validates, strips PII, deduplicates, queues in memory/offline,
   * and triggers async batched persistence without ever blocking UI threads.
   */
  trackEvent(input: TrackEventInput, options?: { flushImmediately?: boolean }): AlgorithmEvent | null {
    const event = this.buildSanitizedEvent(input);
    if (!event) return null;

    if (this.isDuplicate(event)) {
      return null;
    }

    if (!isOnline()) {
      const offline = this.readOfflineQueue(event.userId);
      offline.push(event);
      this.writeOfflineQueue(event.userId, offline);
      return event;
    }

    this.memoryQueue.push(event);

    if (options?.flushImmediately || this.memoryQueue.length >= MAX_BATCH_SIZE) {
      if (this.flushTimer) {
        clearTimeout(this.flushTimer);
        this.flushTimer = null;
      }
      queueMicrotask(() => {
        void this.flushQueue();
      });
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        void this.flushQueue();
      }, FLUSH_INTERVAL_MS);
    }

    return event;
  }

  async flushQueue(userIdOverride?: string): Promise<{ flushedCount: number; failedCount: number }> {
    if (this.isFlushing) {
      return { flushedCount: 0, failedCount: 0 };
    }

    const activeUid = userIdOverride || auth?.currentUser?.uid || null;
    if (!activeUid) {
      return { flushedCount: 0, failedCount: 0 };
    }

    const offlineStored = this.readOfflineQueue(activeUid);
    const matchingMemory = this.memoryQueue.filter((e) => e.userId === activeUid);
    const remainingOtherMemory = this.memoryQueue.filter((e) => e.userId !== activeUid);

    const combined = [...offlineStored, ...matchingMemory];
    if (combined.length === 0) {
      return { flushedCount: 0, failedCount: 0 };
    }

    if (!isOnline()) {
      this.memoryQueue = remainingOtherMemory;
      this.writeOfflineQueue(activeUid, combined);
      return { flushedCount: 0, failedCount: combined.length };
    }

    this.isFlushing = true;
    this.memoryQueue = remainingOtherMemory;
    this.writeOfflineQueue(activeUid, []);

    let flushedCount = 0;
    const failedEvents: AlgorithmEvent[] = [];

    try {
      for (let i = 0; i < combined.length; i += MAX_BATCH_SIZE) {
        const chunk = combined.slice(i, i + MAX_BATCH_SIZE);
        try {
          if (dbFirestore && auth?.currentUser?.uid === activeUid) {
            const batch = writeBatch(dbFirestore);
            chunk.forEach((evt) => {
              batch.set(doc(dbFirestore, 'algorithm_events', evt.id), evt);
            });
            await batch.commit();
          }

          flushedCount += chunk.length;
          this.lastFlushAt = new Date().toISOString();

          // Non-blocking server compute sync (updates user_interests, content_signals, algorithm_user_stats)
          const serverResult = await this.syncBatchToServer(chunk);

          for (const listener of this.listeners) {
            try {
              await listener(chunk, serverResult);
            } catch {
              // Listener error never breaks pipeline
            }
          }
        } catch {
          failedEvents.push(...chunk);
        }
      }

      if (failedEvents.length > 0) {
        const currentOffline = this.readOfflineQueue(activeUid);
        this.writeOfflineQueue(activeUid, [...currentOffline, ...failedEvents]);
      }

      return { flushedCount, failedCount: failedEvents.length };
    } finally {
      this.isFlushing = false;
    }
  }

  private async syncBatchToServer(
    events: AlgorithmEvent[]
  ): Promise<{ persistedToFirestore?: boolean } | null> {
    if (typeof fetch === 'undefined' || !auth?.currentUser) return null;
    try {
      const idToken = await auth.currentUser.getIdToken();
      const response = await fetch('/api/algorithm/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({ events }),
        keepalive: events.length <= 10
      });
      if (!response.ok) {
        this.serverSyncAvailable = false;
        return null;
      }
      this.serverSyncAvailable = true;
      return (await response.json()) as { persistedToFirestore?: boolean };
    } catch {
      this.serverSyncAvailable = false;
      return null;
    }
  }

  async fetchRecentUserEvents(userId: string, maxItems = 40): Promise<AlgorithmEvent[]> {
    if (!dbFirestore || !auth?.currentUser || auth.currentUser.uid !== userId) {
      return [];
    }
    try {
      const q = query(
        collection(dbFirestore, 'algorithm_events'),
        where('userId', '==', userId),
        limit(Math.min(100, Math.max(maxItems * 2, 50)))
      );
      const snap = await getDocs(q);
      const list: AlgorithmEvent[] = [];
      snap.forEach((d) => list.push(d.data() as AlgorithmEvent));
      list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
      return list.slice(0, maxItems);
    } catch {
      return [];
    }
  }

  clearSessionCaches(): void {
    this.dedupMap.clear();
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.memoryQueue = [];
  }
}

export const algorithmEventService = new AlgorithmEventServiceImpl();
