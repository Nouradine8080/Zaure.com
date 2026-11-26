import { auth } from '../../firebaseClient';
import type { Capsule, Circle, CommunityGroup, GroupPost } from '../../types';
import type {
  AlgorithmEngineStatus,
  AlgorithmEvent,
  AlgorithmUserStats,
  ContentSignal,
  FutureEngineName,
  SmartEngineExtension,
  TrackEventInput,
  UserInterestProfile
} from '../../types/algorithm';
import {
  extractTopicsFromText,
  normalizeCategoryToTopic
} from './algorithmConfig';
import { algorithmEventService } from './algorithmEventService';
import { algorithmUserService } from './algorithmUserService';
import { contentAnalysisService } from './contentAnalysisService';
import { interestAnalysisService } from './interestAnalysisService';

const HIDDEN_POSTS_STORAGE_PREFIX = 'zaure_alg_hidden_targets_';
const REPORTED_POSTS_STORAGE_PREFIX = 'zaure_alg_reported_targets_';

function readStoredTargets(key: string): Set<string> {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return new Set();
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((v) => typeof v === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

function saveStoredTargets(key: string, set: Set<string>): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(key, JSON.stringify(Array.from(set).slice(-200)));
  } catch {
    // ignore
  }
}

function emitSafetySignalChanged(detail: {
  userId: string;
  eventType: 'post_hide' | 'post_report' | 'post_unhide';
  targetId: string;
}): void {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('zaure:algorithm-signal-updated', { detail }));
    }
  } catch {
    // ignore in non-DOM test environments
  }
}

class AlgorithmCoreServiceImpl {
  private initialized = false;
  private extensions = new Map<FutureEngineName, SmartEngineExtension>();
  private activeUserId: string | null = null;
  private hiddenTargetsByUser = new Map<string, Set<string>>();
  private reportedTargetsByUser = new Map<string, Set<string>>();
  private cleanupListeners: Array<() => void> = [];

  private getEffectiveUserId(explicitUserId?: string | null): string | null {
    if (explicitUserId !== undefined) return explicitUserId || null;
    return this.activeUserId || auth?.currentUser?.uid || null;
  }

  private getHiddenSetForUser(userId: string | null): Set<string> {
    if (!userId) return new Set();
    let set = this.hiddenTargetsByUser.get(userId);
    if (!set) {
      set = readStoredTargets(`${HIDDEN_POSTS_STORAGE_PREFIX}${userId}`);
      this.hiddenTargetsByUser.set(userId, set);
    }
    return set;
  }

  private getReportedSetForUser(userId: string | null): Set<string> {
    if (!userId) return new Set();
    let set = this.reportedTargetsByUser.get(userId);
    if (!set) {
      set = readStoredTargets(`${REPORTED_POSTS_STORAGE_PREFIX}${userId}`);
      this.reportedTargetsByUser.set(userId, set);
    }
    return set;
  }

  /**
   * Synchronizes the active Firebase UID and isolates in-memory safety filters
   * so switching accounts or logging out can never leak hidden/reported sets.
   */
  syncActiveUser(userId: string | null): void {
    const normalized = userId || null;
    if (this.activeUserId && this.activeUserId !== normalized) {
      this.hiddenTargetsByUser.delete(this.activeUserId);
      this.reportedTargetsByUser.delete(this.activeUserId);
    }
    if (!normalized) {
      this.hiddenTargetsByUser.clear();
      this.reportedTargetsByUser.clear();
      this.activeUserId = null;
      return;
    }
    this.activeUserId = normalized;
    this.getHiddenSetForUser(normalized);
    this.getReportedSetForUser(normalized);
  }

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    const unsubBatch = algorithmEventService.onBatchCommitted(async (events) => {
      if (events.length === 0) return;
      const uid = events[0].userId;
      const profile = await interestAnalysisService.getUserInterests(uid);
      for (const ext of this.extensions.values()) {
        if (ext.onEventsProcessed) {
          try {
            await ext.onEventsProcessed(events, profile);
          } catch {
            // Extension failure never affects core
          }
        }
      }
    });
    this.cleanupListeners.push(unsubBatch);

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const handleOnline = () => {
        void algorithmEventService.flushQueue();
      };
      const handleVisibility = () => {
        if (document.visibilityState === 'hidden') {
          void algorithmEventService.flushQueue();
        }
      };
      const handlePageHide = () => {
        void algorithmEventService.flushQueue();
      };

      window.addEventListener('online', handleOnline);
      document.addEventListener('visibilitychange', handleVisibility);
      window.addEventListener('pagehide', handlePageHide);

      this.cleanupListeners.push(() => {
        window.removeEventListener('online', handleOnline);
        document.removeEventListener('visibilitychange', handleVisibility);
        window.removeEventListener('pagehide', handlePageHide);
      });
    }
  }

  /**
   * Registers future plug-in engines (SmartFeedEngine, RecommendationEngine, ViralEngine, etc.)
   */
  registerExtension(extension: SmartEngineExtension): void {
    this.extensions.set(extension.name, extension);
  }

  getExtension(name: FutureEngineName): SmartEngineExtension | undefined {
    return this.extensions.get(name);
  }

  getStatus(): AlgorithmEngineStatus {
    const queue = algorithmEventService.getQueueSnapshot();
    return {
      initialized: this.initialized,
      userId: auth?.currentUser?.uid || null,
      pendingQueueSize: queue.pendingCount,
      offlineQueueSize: queue.offlineCount,
      registeredExtensions: Array.from(this.extensions.keys()),
      lastFlushAt: queue.lastFlushAt,
      serverSyncAvailable: queue.serverSyncAvailable
    };
  }

  /**
   * Fires an interaction asynchronously without blocking UI rendering.
   * Updates local interest/stats/content caches optimistically and queues batched persistence.
   */
  trackInteraction(
    input: TrackEventInput,
    options?: { flushImmediately?: boolean }
  ): AlgorithmEvent | null {
    this.initialize();
    const event = algorithmEventService.trackEvent(input, options);
    if (!event) return null;

    // Optimistic in-memory/local read-model updates (0ms, zero Firestore extra reads)
    interestAnalysisService.updateFromSingleEvent(event);
    algorithmUserService.updateFromEvent(event);
    contentAnalysisService.applyEventToContentSignal(event);

    if (event.eventType === 'post_hide') {
      const hiddenSet = this.getHiddenSetForUser(event.userId);
      hiddenSet.add(event.targetId);
      saveStoredTargets(`${HIDDEN_POSTS_STORAGE_PREFIX}${event.userId}`, hiddenSet);
      emitSafetySignalChanged({
        userId: event.userId,
        eventType: 'post_hide',
        targetId: event.targetId
      });
    } else if (event.eventType === 'post_report') {
      const reportedSet = this.getReportedSetForUser(event.userId);
      reportedSet.add(event.targetId);
      saveStoredTargets(`${REPORTED_POSTS_STORAGE_PREFIX}${event.userId}`, reportedSet);
      emitSafetySignalChanged({
        userId: event.userId,
        eventType: 'post_report',
        targetId: event.targetId
      });
    }

    return event;
  }

  // Typed convenience trackers across the 13 ZAURE Core Engine event types
  trackPostInteraction(params: {
    userId: string;
    eventType:
      | 'post_view'
      | 'post_like'
      | 'post_comment'
      | 'post_share'
      | 'post_save'
      | 'post_hide'
      | 'post_report'
      | 'video_view'
      | 'video_completion';
    post: GroupPost;
    group?: CommunityGroup | null;
    reactionType?: string;
    watchedSec?: number;
    durationSec?: number;
    completionRate?: number;
    reason?: string;
  }): AlgorithmEvent | null {
    const { userId, eventType, post, group } = params;
    const categoryHint = group && group.id !== 'public' ? group.category : undefined;
    const topics = extractTopicsFromText(
      `${post.content || ''} ${post.poll?.question || ''}`,
      categoryHint
    );

    const isVideo =
      eventType === 'video_view' ||
      eventType === 'video_completion' ||
      post.type === 'video' ||
      post.media?.some((m) => m.type === 'video');

    return this.trackInteraction(
      {
        userId,
        eventType,
        targetId: post.id,
        targetType: isVideo && (eventType === 'video_view' || eventType === 'video_completion') ? 'video' : 'post',
        metadata: {
          contentType: post.type,
          authorId: post.isAnonymous ? 'anonymous' : post.authorId,
          circleId: post.groupId || 'public',
          publishedAt: post.createdAt,
          ...(categoryHint ? { category: normalizeCategoryToTopic(categoryHint) || categoryHint } : {}),
          ...(topics.length > 0 ? { topics } : {}),
          ...(params.reactionType ? { reactionType: params.reactionType } : {}),
          ...(typeof params.watchedSec === 'number' ? { watchedSec: params.watchedSec } : {}),
          ...(typeof params.durationSec === 'number' ? { durationSec: params.durationSec } : {}),
          ...(typeof params.completionRate === 'number' ? { completionRate: params.completionRate } : {}),
          ...(params.reason ? { reason: params.reason.slice(0, 60) } : {})
        }
      },
      {
        flushImmediately: eventType === 'post_hide' || eventType === 'post_report' || eventType === 'post_share'
      }
    );
  }

  trackCapsuleInteraction(params: {
    userId: string;
    eventType:
      | 'post_view'
      | 'post_like'
      | 'post_comment'
      | 'post_share'
      | 'post_save'
      | 'post_hide'
      | 'post_report'
      | 'video_view'
      | 'video_completion';
    capsule: Capsule;
    circle?: Circle | null;
    reactionType?: string;
    watchedSec?: number;
    durationSec?: number;
    completionRate?: number;
  }): AlgorithmEvent | null {
    const { userId, eventType, capsule, circle } = params;
    const categoryHint = circle?.categorie || capsule.circle_nom;
    const textBody = capsule.type === 'audio' ? capsule.media_name || '' : capsule.contenu || '';
    const topics = extractTopicsFromText(textBody, categoryHint);

    return this.trackInteraction(
      {
        userId,
        eventType,
        targetId: capsule.id,
        targetType:
          eventType === 'video_view' || eventType === 'video_completion' ? 'video' : 'capsule',
        metadata: {
          contentType: capsule.type,
          authorId: capsule.auteur_id,
          circleId: capsule.circle_id || 'public',
          publishedAt: capsule.created_at,
          ...(categoryHint ? { category: normalizeCategoryToTopic(categoryHint) || categoryHint } : {}),
          ...(topics.length > 0 ? { topics } : {}),
          ...(params.reactionType ? { reactionType: params.reactionType } : {}),
          ...(typeof params.watchedSec === 'number' ? { watchedSec: params.watchedSec } : {}),
          ...(typeof params.durationSec === 'number' ? { durationSec: params.durationSec } : {}),
          ...(typeof params.completionRate === 'number' ? { completionRate: params.completionRate } : {})
        }
      },
      {
        flushImmediately: eventType === 'post_hide' || eventType === 'post_report' || eventType === 'post_share'
      }
    );
  }

  trackProfileVisit(visitorId: string, targetUserId: string, targetProfession?: string): AlgorithmEvent | null {
    if (!visitorId || !targetUserId || visitorId === targetUserId) return null;
    return this.trackInteraction({
      userId: visitorId,
      eventType: 'profile_visit',
      targetId: targetUserId,
      targetType: 'profile',
      textSample: targetProfession,
      metadata: {
        authorId: targetUserId
      }
    });
  }

  trackUserFollow(followerId: string, followingId: string, targetProfession?: string): AlgorithmEvent | null {
    if (!followerId || !followingId || followerId === followingId) return null;
    return this.trackInteraction({
      userId: followerId,
      eventType: 'user_follow',
      targetId: followingId,
      targetType: 'profile',
      textSample: targetProfession,
      metadata: {
        authorId: followingId
      }
    });
  }

  trackCircleJoin(
    userId: string,
    circle: Pick<Circle, 'id' | 'categorie' | 'nom' | 'visibility'>
  ): AlgorithmEvent | null {
    const topic = normalizeCategoryToTopic(circle.categorie);
    return this.trackInteraction({
      userId,
      eventType: 'circle_join',
      targetId: circle.id,
      targetType: 'circle',
      textSample: `${circle.categorie || ''} ${circle.nom || ''}`,
      metadata: {
        circleId: circle.id,
        category: topic || circle.categorie || 'societe',
        visibility: circle.visibility || 'public'
      }
    });
  }

  trackCommunityJoin(
    userId: string,
    group: Pick<CommunityGroup, 'id' | 'category' | 'name' | 'privacy'>
  ): AlgorithmEvent | null {
    const topic = normalizeCategoryToTopic(group.category);
    return this.trackInteraction({
      userId,
      eventType: 'circle_join',
      targetId: group.id,
      targetType: 'group',
      textSample: `${group.category || ''} ${group.name || ''}`,
      metadata: {
        circleId: group.id,
        category: topic || group.category || 'societe',
        visibility: group.privacy || 'public'
      }
    });
  }

  trackSearch(userId: string, queryText: string, resultCount?: number, source = 'global'): AlgorithmEvent | null {
    if (!userId || !queryText || queryText.trim().length < 2) return null;
    return this.trackInteraction({
      userId,
      eventType: 'search',
      targetId: queryText.trim(),
      targetType: 'search',
      metadata: {
        source,
        ...(typeof resultCount === 'number' ? { resultCount } : {})
      }
    });
  }

  isTargetHidden(targetId: string, userId?: string | null): boolean {
    const uid = this.getEffectiveUserId(userId);
    if (!uid) return false;
    return this.getHiddenSetForUser(uid).has(targetId);
  }

  isTargetReported(targetId: string, userId?: string | null): boolean {
    const uid = this.getEffectiveUserId(userId);
    if (!uid) return false;
    return this.getReportedSetForUser(uid).has(targetId);
  }

  getHiddenTargetIds(userId?: string | null): Set<string> {
    const uid = this.getEffectiveUserId(userId);
    if (!uid) return new Set();
    return new Set(this.getHiddenSetForUser(uid));
  }

  getReportedTargetIds(userId?: string | null): Set<string> {
    const uid = this.getEffectiveUserId(userId);
    if (!uid) return new Set();
    return new Set(this.getReportedSetForUser(uid));
  }

  unhideTarget(targetId: string, userId?: string | null): void {
    const uid = this.getEffectiveUserId(userId);
    if (!uid) return;
    const hiddenSet = this.getHiddenSetForUser(uid);
    hiddenSet.delete(targetId);
    saveStoredTargets(`${HIDDEN_POSTS_STORAGE_PREFIX}${uid}`, hiddenSet);
    emitSafetySignalChanged({
      userId: uid,
      eventType: 'post_unhide',
      targetId
    });
  }

  async flushPendingEvents(userId?: string): Promise<{ flushedCount: number; failedCount: number }> {
    return algorithmEventService.flushQueue(userId);
  }

  async getUserContextSnapshot(userId: string): Promise<{
    interests: UserInterestProfile;
    stats: AlgorithmUserStats;
  }> {
    const [interests, stats] = await Promise.all([
      interestAnalysisService.getUserInterests(userId),
      algorithmUserService.getUserStats(userId)
    ]);
    return { interests, stats };
  }

  /**
   * Utility preview scorer for future SmartFeedEngine / RecommendationEngine consumers.
   */
  scoreContentAffinityPreview(signal: ContentSignal, profile: UserInterestProfile): number {
    let score = signal.qualityScore * 0.35 + signal.decayScore * 12;
    for (const cat of signal.categories || []) {
      const interestWeight = profile.interests?.[cat] || 0;
      score += Math.min(40, interestWeight * 2.5);
    }
    if (profile.affinityAuthors && signal.authorId && profile.affinityAuthors[signal.authorId]) {
      score += Math.min(20, profile.affinityAuthors[signal.authorId] * 1.5);
    }
    if (profile.affinityCircles && signal.circleId && profile.affinityCircles[signal.circleId]) {
      score += Math.min(18, profile.affinityCircles[signal.circleId] * 1.4);
    }
    return Math.round(score * 100) / 100;
  }

  destroy(): void {
    this.cleanupListeners.forEach((fn) => fn());
    this.cleanupListeners = [];
    this.initialized = false;
  }
}

export const algorithmCoreService = new AlgorithmCoreServiceImpl();
