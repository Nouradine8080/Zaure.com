import type { Capsule, Circle, GroupPost, UserProfile } from '../../types';
import type {
  AlgorithmEvent,
  AlgorithmUserStats,
  ContentSignal,
  FeedCandidateMeta,
  FeedRankingMode,
  RankedFeedEntry,
  SmartEngineExtension,
  SmartFeedCachePayload,
  SmartFeedResult,
  SmartFeedScoreBreakdown,
  SmartFeedScoreWeights,
  UserInterestProfile
} from '../../types/algorithm';
import { computeContentScores } from './algorithmConfig';
import { algorithmCoreService } from './algorithmCoreService';
import { algorithmEventService } from './algorithmEventService';
import { algorithmUserService } from './algorithmUserService';
import { contentAnalysisService } from './contentAnalysisService';
import { interestAnalysisService } from './interestAnalysisService';

export interface UnifiedFeedCandidate {
  kind: 'capsule' | 'post';
  id: string;
  createdAt: string;
  data: Capsule | GroupPost;
}

export interface SmartFeedContext {
  userId: string | null;
  mode: FeedRankingMode;
  followingIds: Iterable<string>;
  joinedCircleIds: Iterable<string>;
  blockedAuthorIds?: Iterable<string>;
  hiddenTargetIds?: Iterable<string>;
  reportedTargetIds?: Iterable<string>;
  viewedTargetIds?: Iterable<string>;
  circlesById?: Map<string, Circle> | Record<string, Circle>;
  usersById?: Map<string, UserProfile> | Record<string, UserProfile>;
  userInterests?: UserInterestProfile | null;
  userStats?: AlgorithmUserStats | null;
  recentEvents?: AlgorithmEvent[];
  nowMs?: number;
  forceChronologicalFallback?: boolean;
  bypassCache?: boolean;
}

export const SMART_FEED_WEIGHTS: SmartFeedScoreWeights = {
  interestMax: 30,
  socialFollowingBoost: 16,
  socialAffinityMax: 8,
  circleMembershipBoost: 11,
  circleAffinityMax: 5,
  qualityMax: 14,
  popularityMax: 12,
  freshnessMax: 22,
  creatorDiscoveryMax: 9,
  adjacentDiscoveryMax: 6,
  seenFatiguePenalty: 6,
  hiddenOrReportedPenalty: 120,
  authorRepeatWindowPenalty: 18,
  topicRepeatWindowPenalty: 9
};

export const ADJACENT_TOPIC_CLUSTERS: Record<string, string[]> = {
  sante: ['medecine', 'science', 'societe'],
  medecine: ['sante', 'science', 'education'],
  technologie: ['science', 'entrepreneuriat', 'education'],
  education: ['science', 'langues', 'technologie', 'culture'],
  science: ['technologie', 'medecine', 'sante', 'agriculture'],
  sport: ['sante', 'societe', 'actualites'],
  actualites: ['societe', 'entrepreneuriat', 'culture'],
  culture: ['langues', 'societe', 'education'],
  entrepreneuriat: ['technologie', 'agriculture', 'actualites'],
  agriculture: ['science', 'entrepreneuriat', 'societe'],
  langues: ['culture', 'education', 'societe'],
  societe: ['actualites', 'culture', 'education', 'sante']
};

const FEED_CACHE_PREFIX = 'zaure_smart_feed_cache_';
const CACHE_TTL_MS = 90_000;
const RECENT_EVENTS_TTL_MS = 120_000;
const MAX_CACHED_KEYS = 120;

function safeGetStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

function toSet(input?: Iterable<string>): Set<string> {
  if (!input) return new Set<string>();
  return input instanceof Set ? new Set(input) : new Set(input);
}

function getFromLookup<T>(lookup: Map<string, T> | Record<string, T> | undefined, key: string): T | undefined {
  if (!lookup || !key) return undefined;
  if (lookup instanceof Map) return lookup.get(key);
  return lookup[key];
}

function candidateKey(item: Pick<UnifiedFeedCandidate, 'kind' | 'id'>): string {
  return `${item.kind}:${item.id}`;
}

function parseTimestampMs(iso: string | undefined, fallbackMs: number): number {
  if (!iso) return fallbackMs;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : fallbackMs;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function getLookupEntries<T>(
  lookup: Map<string, T> | Record<string, T> | undefined
): Array<[string, T]> {
  if (!lookup) return [];
  if (lookup instanceof Map) return Array.from(lookup.entries());
  return Object.entries(lookup);
}

function sortedJoin(set: Set<string>): string {
  if (set.size === 0) return '';
  return Array.from(set).sort().join(',');
}

export class SmartFeedEngineImpl implements SmartEngineExtension {
  readonly name = 'SmartFeedEngine' as const;
  readonly version = '1.1.0';

  private memoryOrderCache = new Map<string, SmartFeedCachePayload>();
  private recentEventsCache = new Map<string, { fetchedAt: number; events: AlgorithmEvent[] }>();
  private registeredWithCore = false;

  constructor() {
    this.ensureRegistered();
  }

  ensureRegistered(): void {
    if (this.registeredWithCore) return;
    this.registeredWithCore = true;
    try {
      algorithmCoreService.registerExtension(this);
    } catch {
      // Safe if core isn't initialized yet
    }
  }

  /**
   * Extension hook called automatically by AlgorithmCoreService whenever new
   * interaction events are committed. Adapts future ranking cleanly without
   * creating a duplicate event tracker.
   */
  onEventsProcessed(events: AlgorithmEvent[], _interests: UserInterestProfile): void {
    if (!events || events.length === 0) return;
    const userId = events[0].userId;
    if (!userId) return;

    this.invalidateFeedCache(userId);

    const existing = this.recentEventsCache.get(userId);
    if (existing) {
      const sameUserEvents = events.filter((e) => e.userId === userId);
      if (sameUserEvents.length > 0) {
        const merged = [...sameUserEvents, ...existing.events].slice(0, 60);
        this.recentEventsCache.set(userId, { fetchedAt: existing.fetchedAt, events: merged });
      }
    }
  }

  /**
   * Extension point for quick single-signal affinity evaluation.
   */
  scoreItem(signal: ContentSignal, interests: UserInterestProfile): number {
    const topicScore = this.computeTopicAffinity(signal, interests, 1).score;
    return round2(
      topicScore +
        (signal.qualityScore / 100) * SMART_FEED_WEIGHTS.qualityMax +
        Math.min(SMART_FEED_WEIGHTS.popularityMax, Math.log1p(signal.popularityScore) * 2.6)
    );
  }

  private getCacheKey(userId: string, mode: FeedRankingMode): string {
    return `${FEED_CACHE_PREFIX}${userId}_${mode}`;
  }

  private resolveSafetySets(context?: Partial<SmartFeedContext>): {
    userId: string | null;
    nowMs: number;
    followingSet: Set<string>;
    joinedCircleSet: Set<string>;
    blockedSet: Set<string>;
    hiddenSet: Set<string>;
    reportedSet: Set<string>;
    viewedSet: Set<string>;
  } {
    const userId = context?.userId || null;
    const nowMs = context?.nowMs ?? Date.now();
    const followingSet = toSet(context?.followingIds);
    const joinedCircleSet = toSet(context?.joinedCircleIds);
    const blockedSet = toSet(context?.blockedAuthorIds);

    let coreHidden = new Set<string>();
    let coreReported = new Set<string>();
    if (userId) {
      try {
        coreHidden = algorithmCoreService.getHiddenTargetIds(userId);
        coreReported = algorithmCoreService.getReportedTargetIds(userId);
      } catch {
        // Fallback cleanly if core service is unavailable
      }
    }

    const hiddenSet = new Set<string>([...coreHidden, ...toSet(context?.hiddenTargetIds)]);
    const reportedSet = new Set<string>([...coreReported, ...toSet(context?.reportedTargetIds)]);
    const viewedSet = toSet(context?.viewedTargetIds);

    for (const evt of context?.recentEvents || []) {
      if (userId && evt.userId && evt.userId !== userId) continue;
      if (evt.eventType === 'post_hide') hiddenSet.add(evt.targetId);
      else if (evt.eventType === 'post_report') reportedSet.add(evt.targetId);
      else if (evt.eventType === 'post_view') viewedSet.add(evt.targetId);
    }

    return {
      userId,
      nowMs,
      followingSet,
      joinedCircleSet,
      blockedSet,
      hiddenSet,
      reportedSet,
      viewedSet
    };
  }

  computeContextDigest(context: Partial<SmartFeedContext>): string {
    const safety = this.resolveSafetySets(context);
    const mode = context.mode || 'for_you';
    const circleVis = getLookupEntries(context.circlesById)
      .map(([id, c]) => `${id}:${c?.visibility || 'public'}:${c?.created_by || ''}`)
      .sort()
      .join('|');
    const authorPriv = getLookupEntries(context.usersById)
      .map(([id, u]) => {
        const p = u?.privacy_settings;
        return p ? `${id}:${p.profileMode}:${p.postsVisibility}` : '';
      })
      .filter(Boolean)
      .sort()
      .join('|');

    const raw = [
      `u=${safety.userId || ''}`,
      `m=${mode}`,
      `f=${sortedJoin(safety.followingSet)}`,
      `j=${sortedJoin(safety.joinedCircleSet)}`,
      `b=${sortedJoin(safety.blockedSet)}`,
      `h=${sortedJoin(safety.hiddenSet)}`,
      `r=${sortedJoin(safety.reportedSet)}`,
      `cv=${fnv1aHash(circleVis)}`,
      `ap=${fnv1aHash(authorPriv)}`
    ].join(';');

    return fnv1aHash(raw);
  }

  getCachedFeedOrder(
    userId: string,
    mode: FeedRankingMode,
    expectedDigest?: string
  ): SmartFeedCachePayload | null {
    if (!userId) return null;
    const key = this.getCacheKey(userId, mode);
    const inMem = this.memoryOrderCache.get(key);
    if (inMem && Date.now() - parseTimestampMs(inMem.computedAt, 0) < CACHE_TTL_MS) {
      if (expectedDigest && inMem.contextDigest !== expectedDigest) {
        this.memoryOrderCache.delete(key);
        return null;
      }
      return inMem;
    }

    const storage = safeGetStorage();
    if (!storage) return null;
    try {
      const raw = storage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SmartFeedCachePayload;
      if (
        parsed &&
        parsed.userId === userId &&
        parsed.mode === mode &&
        Array.isArray(parsed.orderedKeys) &&
        Date.now() - parseTimestampMs(parsed.computedAt, 0) < CACHE_TTL_MS
      ) {
        if (expectedDigest && parsed.contextDigest !== expectedDigest) {
          storage.removeItem(key);
          return null;
        }
        this.memoryOrderCache.set(key, parsed);
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  private saveFeedCache(
    userId: string,
    mode: FeedRankingMode,
    ranked: RankedFeedEntry<UnifiedFeedCandidate>[],
    contextDigest?: string
  ): void {
    if (!userId || ranked.length === 0) return;
    const key = this.getCacheKey(userId, mode);
    const orderedKeys: string[] = [];
    const reasonByKey: Record<string, SmartFeedScoreBreakdown['reasonCode']> = {};
    const scoreByKey: Record<string, number> = {};

    for (const entry of ranked.slice(0, MAX_CACHED_KEYS)) {
      const ck = candidateKey(entry.item);
      orderedKeys.push(ck);
      reasonByKey[ck] = entry.breakdown.reasonCode;
      scoreByKey[ck] = entry.score;
    }

    const payload: SmartFeedCachePayload = {
      userId,
      mode,
      orderedKeys,
      reasonByKey,
      scoreByKey,
      ...(contextDigest ? { contextDigest } : {}),
      computedAt: new Date().toISOString()
    };

    this.memoryOrderCache.set(key, payload);
    const storage = safeGetStorage();
    if (!storage) return;
    try {
      storage.setItem(key, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors on Android low-storage devices
    }
  }

  invalidateFeedCache(userId?: string): void {
    const storage = safeGetStorage();
    if (!userId) {
      this.memoryOrderCache.clear();
      this.recentEventsCache.clear();
      if (storage) {
        try {
          const keysToRemove: string[] = [];
          for (let i = 0; i < storage.length; i++) {
            const k = storage.key(i);
            if (k && k.startsWith(FEED_CACHE_PREFIX)) {
              keysToRemove.push(k);
            }
          }
          keysToRemove.forEach((k) => storage.removeItem(k));
        } catch {
          // ignore storage iteration errors
        }
      }
      return;
    }
    this.recentEventsCache.delete(userId);
    for (const mode of ['for_you', 'following'] as FeedRankingMode[]) {
      const key = this.getCacheKey(userId, mode);
      this.memoryOrderCache.delete(key);
      storage?.removeItem(key);
    }
  }

  clearAllCaches(userId?: string): void {
    this.invalidateFeedCache(userId);
  }

  /**
   * Central deterministic security, privacy, visibility, and deduplication gate.
   * Independent of recommendation services and enforced identically by both
   * SmartFeed ranking and chronologicalFallback.
   */
  applySecurityAndAccessExclusions<T extends UnifiedFeedCandidate>(
    candidates: T[],
    context?: Partial<SmartFeedContext>,
    options?: { enforceModeScoping?: boolean }
  ): Array<{ item: T; meta: FeedCandidateMeta }> {
    const {
      userId,
      nowMs,
      followingSet,
      joinedCircleSet,
      blockedSet,
      hiddenSet,
      reportedSet
    } = this.resolveSafetySets(context);

    const mode: FeedRankingMode = context?.mode || 'for_you';
    const enforceModeScoping = options?.enforceModeScoping ?? true;
    const seenKeys = new Set<string>();
    const authorized: Array<{ item: T; meta: FeedCandidateMeta }> = [];

    for (const item of candidates) {
      if (!item || !item.id) continue;
      const key = candidateKey(item);
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      const meta = this.extractCandidateMeta(item, context?.usersById);
      const isOwnPost = Boolean(userId && meta.authorId && meta.authorId === userId);

      // 1. Blocked author exclusion
      if (meta.authorId && blockedSet.has(meta.authorId)) {
        continue;
      }

      // 2. Viewer hidden & reported content exclusion
      if (hiddenSet.has(meta.id) || reportedSet.has(meta.id)) {
        continue;
      }

      // 3. Publication lifecycle / scheduled visibility
      if (item.kind === 'post') {
        const post = item.data as GroupPost;
        if (!isOwnPost) {
          if (post.status === 'pending') {
            continue;
          }
          if (post.status === 'scheduled') {
            const scheduledMs = post.scheduledFor ? Date.parse(post.scheduledFor) : NaN;
            if (!Number.isFinite(scheduledMs) || scheduledMs > nowMs) {
              continue;
            }
          } else if (post.status && post.status !== 'published') {
            continue;
          }
        }
      }

      // 4. Circle / private space permissions
      if (meta.circleId && meta.circleId !== 'public') {
        const circle = getFromLookup(context?.circlesById, meta.circleId);
        if (circle) {
          if (circle.visibility === 'private') {
            const hasCircleAccess =
              Boolean(userId) &&
              (joinedCircleSet.has(meta.circleId) ||
                circle.created_by === userId ||
                isOwnPost);
            if (!hasCircleAccess) {
              continue;
            }
          }
        } else if (item.kind === 'post') {
          // Non-public GroupPost without a public circle descriptor requires membership or authorship
          const hasGroupAccess =
            Boolean(userId) && (joinedCircleSet.has(meta.circleId) || isOwnPost);
          if (!hasGroupAccess) {
            continue;
          }
        }
      }

      // 5. Author privacy_settings enforcement (profileMode & postsVisibility)
      if (!isOwnPost && meta.authorId) {
        const author = getFromLookup(context?.usersById, meta.authorId);
        const privacy = author?.privacy_settings;
        if (privacy) {
          const isFollower = followingSet.has(meta.authorId);
          const sharesCircle = meta.circleId !== 'public' && joinedCircleSet.has(meta.circleId);

          if (privacy.profileMode === 'private' && !isFollower) {
            continue;
          }

          const postsVisibility = privacy.postsVisibility || 'public';
          if (postsVisibility === 'private') {
            continue;
          }
          if (postsVisibility === 'followers' && !isFollower) {
            continue;
          }
          if (postsVisibility === 'cercles' && !(isFollower || sharesCircle)) {
            continue;
          }
        }
      }

      // 6. Mode scoping ('following' strictly shows followed authors or joined circles)
      if (enforceModeScoping && mode === 'following') {
        const isFollowedAuthor = followingSet.has(meta.authorId);
        const isJoinedCircle = meta.circleId !== 'public' && joinedCircleSet.has(meta.circleId);
        if (!isFollowedAuthor && !isJoinedCircle) {
          continue;
        }
      }

      authorized.push({ item, meta });
    }

    return authorized;
  }

  /**
   * Hardened chronological rescue ranking: guarantees the feed NEVER crashes or stalls,
   * while strictly enforcing blocked authors, hidden/reported items, privacy settings,
   * private circle permissions, and mode scope even when recommendation engines fail.
   */
  chronologicalFallback<T extends UnifiedFeedCandidate>(
    candidates: T[],
    modeOrContext: FeedRankingMode | Partial<SmartFeedContext> = 'for_you',
    reason = 'engine_unavailable',
    optionalContext?: Partial<SmartFeedContext>
  ): SmartFeedResult<T> {
    const resolvedContext: Partial<SmartFeedContext> =
      typeof modeOrContext === 'string'
        ? { ...(optionalContext || {}), mode: modeOrContext }
        : { ...modeOrContext };
    const mode: FeedRankingMode = resolvedContext.mode || 'for_you';

    const authorized = this.applySecurityAndAccessExclusions(candidates, resolvedContext, {
      enforceModeScoping: true
    });

    const sorted = [...authorized].sort(
      (a, b) =>
        parseTimestampMs(b.meta.createdAt || b.item.createdAt, 0) -
        parseTimestampMs(a.meta.createdAt || a.item.createdAt, 0)
    );

    const entries: RankedFeedEntry<T>[] = sorted.map(({ item, meta }) => ({
      item,
      meta,
      score: 0,
      breakdown: {
        interestScore: 0,
        socialScore: 0,
        circleScore: 0,
        qualityScore: 0,
        popularityScore: 0,
        freshnessScore: 0,
        creatorDiscoveryBoost: 0,
        adjacentDiscoveryScore: 0,
        negativePenalty: 0,
        diversityPenalty: 0,
        totalScore: 0,
        matchedTopics: [],
        reasonCode: 'chronological_fallback'
      }
    }));

    return {
      items: entries,
      mode,
      usedFallback: true,
      fallbackReason: reason,
      computedAt: new Date().toISOString(),
      fromCache: false,
      totalCandidates: entries.length
    };
  }

  /**
   * Rehydrates cached order safely by filtering candidates through the live
   * security & access gate BEFORE applying cached positions.
   */
  applyCachedOrderSafely<T extends UnifiedFeedCandidate>(
    candidates: T[],
    context: SmartFeedContext
  ): SmartFeedResult<T> | null {
    if (!context.userId || context.bypassCache || context.forceChronologicalFallback) {
      return null;
    }
    const digest = this.computeContextDigest(context);
    const cached = this.getCachedFeedOrder(context.userId, context.mode, digest);
    if (!cached) return null;

    const authorized = this.applySecurityAndAccessExclusions(candidates, context, {
      enforceModeScoping: true
    });
    const byKey = new Map<string, { item: T; meta: FeedCandidateMeta }>();
    for (const entry of authorized) {
      byKey.set(candidateKey(entry.item), entry);
    }

    const orderedEntries: RankedFeedEntry<T>[] = [];
    const consumed = new Set<string>();

    for (const ck of cached.orderedKeys) {
      const found = byKey.get(ck);
      if (!found) continue;
      consumed.add(ck);
      const cachedScore = cached.scoreByKey?.[ck] ?? 0;
      const reasonCode =
        cached.reasonByKey?.[ck] ||
        (context.mode === 'following' ? 'following_stream' : 'trending_quality');
      orderedEntries.push({
        item: found.item,
        meta: found.meta,
        score: cachedScore,
        breakdown: {
          interestScore: 0,
          socialScore: 0,
          circleScore: 0,
          qualityScore: 0,
          popularityScore: 0,
          freshnessScore: 0,
          creatorDiscoveryBoost: 0,
          adjacentDiscoveryScore: 0,
          negativePenalty: 0,
          diversityPenalty: 0,
          totalScore: cachedScore,
          matchedTopics: [],
          reasonCode
        }
      });
    }

    // Append any newly arrived authorized items not yet present in cache chronologically
    const remainder = authorized
      .filter((e) => !consumed.has(candidateKey(e.item)))
      .sort(
        (a, b) =>
          parseTimestampMs(b.meta.createdAt || b.item.createdAt, 0) -
          parseTimestampMs(a.meta.createdAt || a.item.createdAt, 0)
      );

    for (const rem of remainder) {
      orderedEntries.push({
        item: rem.item,
        meta: rem.meta,
        score: 0,
        breakdown: {
          interestScore: 0,
          socialScore: 0,
          circleScore: 0,
          qualityScore: 0,
          popularityScore: 0,
          freshnessScore: 0,
          creatorDiscoveryBoost: 0,
          adjacentDiscoveryScore: 0,
          negativePenalty: 0,
          diversityPenalty: 0,
          totalScore: 0,
          matchedTopics: [],
          reasonCode: context.mode === 'following' ? 'following_stream' : 'fresh_creator'
        }
      });
    }

    return {
      items: orderedEntries,
      mode: context.mode,
      usedFallback: false,
      computedAt: cached.computedAt,
      fromCache: true,
      totalCandidates: authorized.length
    };
  }

  /**
   * Async entry point with SWR interest/stats hydration, Firestore read throttling,
   * Android cache support, and guaranteed secured chronological fallback on failure.
   */
  async rankFeed<T extends UnifiedFeedCandidate>(
    candidates: T[],
    context: SmartFeedContext
  ): Promise<SmartFeedResult<T>> {
    this.ensureRegistered();
    if (context.forceChronologicalFallback) {
      return this.chronologicalFallback(candidates, context, 'forced_fallback');
    }

    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    try {
      const uid = context.userId;
      let userInterests = context.userInterests ?? null;
      let userStats = context.userStats ?? null;
      let recentEvents = context.recentEvents;

      if (uid) {
        const hydrationPromise = Promise.all([
          userInterests
            ? Promise.resolve(userInterests)
            : interestAnalysisService.getUserInterests(uid).catch(() => null),
          userStats
            ? Promise.resolve(userStats)
            : algorithmUserService.getUserStats(uid).catch(() => null),
          recentEvents
            ? Promise.resolve(recentEvents)
            : this.getThrottledRecentEvents(uid)
        ]);
        const timeoutPromise = new Promise<
          [UserInterestProfile | null, AlgorithmUserStats | null, AlgorithmEvent[]]
        >((resolve) => {
          timeoutHandle = setTimeout(
            () => resolve([userInterests, userStats, recentEvents || []]),
            1500
          );
        });

        const [hydratedInterests, hydratedStats, hydratedEvents] = await Promise.race([
          hydrationPromise,
          timeoutPromise
        ]);
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
        userInterests = hydratedInterests;
        userStats = hydratedStats;
        recentEvents = hydratedEvents;
      }

      const fullContext: SmartFeedContext = {
        ...context,
        userInterests,
        userStats,
        recentEvents
      };

      const result = this.rankFeedSynchronously(candidates, fullContext);

      if (uid && !result.usedFallback && !context.bypassCache) {
        const digest = this.computeContextDigest(fullContext);
        this.saveFeedCache(uid, context.mode, result.items, digest);
      }

      return result;
    } catch (err) {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      return this.chronologicalFallback(
        candidates,
        context,
        err instanceof Error ? err.message : 'unexpected_error'
      );
    }
  }

  private async getThrottledRecentEvents(userId: string): Promise<AlgorithmEvent[]> {
    const cached = this.recentEventsCache.get(userId);
    if (cached && Date.now() - cached.fetchedAt < RECENT_EVENTS_TTL_MS) {
      return cached.events;
    }
    try {
      const events = await algorithmEventService.fetchRecentUserEvents(userId, 50);
      this.recentEventsCache.set(userId, { fetchedAt: Date.now(), events });
      return events;
    } catch {
      return cached?.events || [];
    }
  }

  /**
   * Fast O(N * W) synchronous ranking engine safe for Android UI memos (< 5ms for 150 posts).
   */
  rankFeedSynchronously<T extends UnifiedFeedCandidate>(
    candidates: T[],
    context: SmartFeedContext
  ): SmartFeedResult<T> {
    this.ensureRegistered();

    if (context.forceChronologicalFallback) {
      return this.chronologicalFallback(candidates, context, 'forced_fallback');
    }

    try {
      const {
        userId,
        nowMs,
        followingSet,
        joinedCircleSet,
        hiddenSet,
        reportedSet,
        viewedSet
      } = this.resolveSafetySets(context);

      // Apply unified security, privacy, circle permission, and deduplication gate upfront
      const authorizedEntries = this.applySecurityAndAccessExclusions(candidates, context, {
        enforceModeScoping: true
      });

      if (context.mode === 'following') {
        return this.buildFollowingFeed(authorizedEntries, {
          followingSet,
          joinedCircleSet
        });
      }

      return this.buildForYouFeed(authorizedEntries, {
        userId,
        followingSet,
        joinedCircleSet,
        hiddenSet,
        reportedSet,
        viewedSet,
        circlesById: context.circlesById,
        userInterests: context.userInterests || null,
        userStats: context.userStats || null,
        nowMs
      });
    } catch (err) {
      return this.chronologicalFallback(
        candidates,
        context,
        err instanceof Error ? err.message : 'sync_ranking_error'
      );
    }
  }

  private extractCandidateMeta(
    item: UnifiedFeedCandidate,
    usersById?: Map<string, UserProfile> | Record<string, UserProfile>
  ): FeedCandidateMeta {
    if (item.kind === 'post') {
      const post = item.data as GroupPost;
      const author = getFromLookup(usersById, post.authorId);
      return {
        id: post.id,
        kind: 'post',
        authorId: post.authorId,
        circleId: post.groupId || 'public',
        createdAt: post.createdAt || item.createdAt || '',
        isPinned: post.isPinned,
        authorRole: author?.role,
        authorCreatedAt: author?.created_at
      };
    }

    const cap = item.data as Capsule;
    const author = getFromLookup(usersById, cap.auteur_id);
    return {
      id: cap.id,
      kind: 'capsule',
      authorId: cap.auteur_id,
      circleId: cap.circle_id || 'public',
      createdAt: cap.created_at || item.createdAt || '',
      isPinned: cap.is_pinned,
      authorRole: cap.auteur_role || author?.role,
      authorCreatedAt: author?.created_at
    };
  }

  private resolveContentSignal(
    item: UnifiedFeedCandidate,
    circlesById?: Map<string, Circle> | Record<string, Circle>
  ): ContentSignal {
    const cached = contentAnalysisService.getCachedSignal(item.id);

    if (item.kind === 'post') {
      const post = item.data as GroupPost;
      return contentAnalysisService.analyzePost(post, {
        viewsCount: cached?.viewsCount ?? 0,
        hidesCount: cached?.hidesCount ?? 0,
        reportsCount: cached?.reportsCount ?? 0,
        videoCompletionsCount: cached?.videoCompletionsCount ?? 0
      });
    }

    const cap = item.data as Capsule;
    const circle =
      cap.circle_id && cap.circle_id !== 'public'
        ? getFromLookup(circlesById, cap.circle_id)
        : undefined;
    return contentAnalysisService.analyzeCapsule(cap, {
      circle: circle || null,
      viewsCount: cached?.viewsCount ?? 0,
      likesCount: cached?.likesCount ?? 0,
      commentsCount: cached?.commentsCount ?? 0,
      sharesCount: cached?.sharesCount ?? 0,
      savesCount: cached?.savesCount ?? 0,
      hidesCount: cached?.hidesCount ?? 0,
      reportsCount: cached?.reportsCount ?? 0,
      videoCompletionsCount: cached?.videoCompletionsCount ?? 0
    });
  }

  private buildFollowingFeed<T extends UnifiedFeedCandidate>(
    authorized: Array<{ item: T; meta: FeedCandidateMeta }>,
    ctx: {
      followingSet: Set<string>;
      joinedCircleSet: Set<string>;
    }
  ): SmartFeedResult<T> {
    const filtered: RankedFeedEntry<T>[] = authorized.map(({ item, meta }) => {
      const isFollowedAuthor = ctx.followingSet.has(meta.authorId);
      const isJoinedCircle = meta.circleId !== 'public' && ctx.joinedCircleSet.has(meta.circleId);
      const streamScore = isFollowedAuthor && isJoinedCircle ? 2 : 1;

      return {
        item,
        meta,
        score: streamScore,
        breakdown: {
          interestScore: 0,
          socialScore: isFollowedAuthor ? SMART_FEED_WEIGHTS.socialFollowingBoost : 0,
          circleScore: isJoinedCircle ? SMART_FEED_WEIGHTS.circleMembershipBoost : 0,
          qualityScore: 0,
          popularityScore: 0,
          freshnessScore: 0,
          creatorDiscoveryBoost: 0,
          adjacentDiscoveryScore: 0,
          negativePenalty: 0,
          diversityPenalty: 0,
          totalScore: streamScore,
          matchedTopics: [],
          reasonCode: 'following_stream'
        }
      };
    });

    // Reverse-chronological inside Abonnements (latest followed/circle activity first)
    filtered.sort(
      (a, b) =>
        parseTimestampMs(b.meta.createdAt || b.item.createdAt, 0) -
        parseTimestampMs(a.meta.createdAt || a.item.createdAt, 0)
    );

    return {
      items: filtered,
      mode: 'following',
      usedFallback: false,
      computedAt: new Date().toISOString(),
      fromCache: false,
      totalCandidates: filtered.length
    };
  }

  private computeTopicAffinity(
    signal: ContentSignal,
    userInterests: UserInterestProfile | null,
    behaviorMultiplier: number
  ): { score: number; adjacentScore: number; matchedTopics: string[] } {
    if (!userInterests || !userInterests.interests) {
      return { score: 0, adjacentScore: 0, matchedTopics: [] };
    }

    const candidatesTopics = Array.from(new Set([...(signal.topics || []), ...(signal.categories || [])]));
    const matchedWeights: Array<{ topic: string; weight: number }> = [];

    for (const topic of candidatesTopics) {
      const rawWeight = userInterests.interests[topic] || 0;
      if (rawWeight > 0) {
        matchedWeights.push({ topic, weight: rawWeight });
      }
    }

    matchedWeights.sort((a, b) => b.weight - a.weight);

    let directRaw = 0;
    matchedWeights.forEach((entry, idx) => {
      const topicNorm = Math.min(1, entry.weight / 10);
      const decayFactor = idx === 0 ? 1 : Math.pow(0.45, idx);
      directRaw += topicNorm * decayFactor;
    });

    const directScore = Math.min(
      SMART_FEED_WEIGHTS.interestMax,
      (directRaw / 1.45) * SMART_FEED_WEIGHTS.interestMax * behaviorMultiplier
    );

    // Adjacent discovery ("susceptibles d'intéresser") even when exact topic score is small/zero
    let adjacentRaw = 0;
    if (matchedWeights.length === 0 || directScore < 10) {
      for (const topic of candidatesTopics) {
        const neighbors = ADJACENT_TOPIC_CLUSTERS[topic] || [];
        for (const neighbor of neighbors) {
          const w = userInterests.interests[neighbor] || 0;
          if (w > 0) {
            adjacentRaw = Math.max(adjacentRaw, Math.min(1, w / 12));
          }
        }
      }
    }

    const adjacentScore = Math.min(
      SMART_FEED_WEIGHTS.adjacentDiscoveryMax,
      adjacentRaw * SMART_FEED_WEIGHTS.adjacentDiscoveryMax * behaviorMultiplier
    );

    return {
      score: round2(directScore),
      adjacentScore: round2(adjacentScore),
      matchedTopics: matchedWeights.map((m) => m.topic)
    };
  }

  private buildForYouFeed<T extends UnifiedFeedCandidate>(
    authorized: Array<{ item: T; meta: FeedCandidateMeta }>,
    ctx: {
      userId: string | null;
      followingSet: Set<string>;
      joinedCircleSet: Set<string>;
      hiddenSet: Set<string>;
      reportedSet: Set<string>;
      viewedSet: Set<string>;
      circlesById?: Map<string, Circle> | Record<string, Circle>;
      userInterests: UserInterestProfile | null;
      userStats: AlgorithmUserStats | null;
      nowMs: number;
    }
  ): SmartFeedResult<T> {
    // 1. Pre-compute creator footprint across the active pool so small/emerging creators
    //    aren't drowned out by prolific/high-engagement accounts.
    const creatorPostCounts = new Map<string, number>();
    const creatorTotalEngagement = new Map<string, number>();
    const signalByItemKey = new Map<string, ContentSignal>();

    for (const { item, meta } of authorized) {
      const key = candidateKey(item);
      const signal = this.resolveContentSignal(item, ctx.circlesById);
      signalByItemKey.set(key, signal);

      creatorPostCounts.set(meta.authorId, (creatorPostCounts.get(meta.authorId) || 0) + 1);
      const eng =
        (signal.likesCount || 0) * 2 +
        (signal.commentsCount || 0) * 3 +
        (signal.sharesCount || 0) * 4 +
        (signal.savesCount || 0) * 3;
      creatorTotalEngagement.set(
        meta.authorId,
        (creatorTotalEngagement.get(meta.authorId) || 0) + eng
      );
    }

    // Adaptive multiplier based on real user history (cold-start vs personalized user)
    const realSignalsCount =
      (ctx.userInterests?.totalSignals || 0) + (ctx.userStats?.totalEvents || 0);
    const behaviorMultiplier =
      realSignalsCount >= 8 ? 1.0 : realSignalsCount >= 3 ? 0.78 : 0.55;

    // 2. Score every authorized candidate mathematically
    const baseEntries: RankedFeedEntry<T>[] = [];

    for (const { item, meta } of authorized) {
      const key = candidateKey(item);
      const signal = signalByItemKey.get(key)!;

      // Refresh decay score cleanly relative to current timestamp
      const refreshedScores = computeContentScores({
        publishedAt: meta.createdAt || signal.publishedAt,
        viewsCount: signal.viewsCount || 0,
        likesCount: signal.likesCount || 0,
        commentsCount: signal.commentsCount || 0,
        sharesCount: signal.sharesCount || 0,
        savesCount: signal.savesCount || 0,
        hidesCount: signal.hidesCount || 0,
        reportsCount: signal.reportsCount || 0,
        videoCompletionsCount: signal.videoCompletionsCount || 0,
        hasRichMedia: signal.contentType !== 'text' && signal.contentType !== 'texte',
        nowMs: ctx.nowMs
      });

      const pubMs = parseTimestampMs(meta.createdAt || signal.publishedAt, ctx.nowMs - 86_400_000);
      const ageHours = Math.max(0, (ctx.nowMs - pubMs) / 3_600_000);

      // (a) Interest match + adjacent discovery
      const { score: interestScore, adjacentScore: adjacentDiscoveryScore, matchedTopics } =
        this.computeTopicAffinity(signal, ctx.userInterests, behaviorMultiplier);

      // (b) Social graph & author affinity
      const isFollowed = ctx.followingSet.has(meta.authorId);
      const rawAuthorAffinity = ctx.userInterests?.affinityAuthors?.[meta.authorId] || 0;
      const ownVeryRecentBoost =
        ctx.userId && meta.authorId === ctx.userId && ageHours <= 0.5 ? 12 : 0;
      const socialScore = round2(
        (isFollowed ? SMART_FEED_WEIGHTS.socialFollowingBoost : 0) +
          Math.min(SMART_FEED_WEIGHTS.socialAffinityMax, rawAuthorAffinity * 1.6) +
          ownVeryRecentBoost
      );

      // (c) Circles membership & affinity
      const isJoinedCircle = meta.circleId !== 'public' && ctx.joinedCircleSet.has(meta.circleId);
      const rawCircleAffinity =
        meta.circleId && meta.circleId !== 'public'
          ? ctx.userInterests?.affinityCircles?.[meta.circleId] || 0
          : 0;
      const circleScore = round2(
        (isJoinedCircle ? SMART_FEED_WEIGHTS.circleMembershipBoost : 0) +
          Math.min(SMART_FEED_WEIGHTS.circleAffinityMax, rawCircleAffinity * 1.1)
      );

      // (d) Content quality & popularity
      const qualityScore = round2(
        (refreshedScores.qualityScore / 100) * SMART_FEED_WEIGHTS.qualityMax
      );
      const popularityScore = round2(
        Math.min(SMART_FEED_WEIGHTS.popularityMax, Math.log1p(refreshedScores.popularityScore) * 2.6)
      );

      // (e) Freshness decay
      const freshnessScore = round2(
        SMART_FEED_WEIGHTS.freshnessMax / Math.pow(1 + ageHours / 10, 0.85)
      );

      // (f) Fresh publication & small creator visibility boost
      const freshPostBoost =
        ageHours <= 6 && refreshedScores.popularityScore < 12
          ? 4.5 * (1 - ageHours / 6)
          : 0;
      const authorVolume = creatorPostCounts.get(meta.authorId) || 1;
      const authorEngagement = creatorTotalEngagement.get(meta.authorId) || 0;
      const isVerifiedOrMentor = meta.authorRole === 'mentor' || meta.authorRole === 'verifie';
      const smallCreatorBoost =
        authorVolume <= 2 && authorEngagement < 25 && !isVerifiedOrMentor
          ? 4.5
          : authorVolume <= 3 && authorEngagement < 40
            ? 2.2
            : 0;
      const creatorDiscoveryBoost = round2(
        Math.min(SMART_FEED_WEIGHTS.creatorDiscoveryMax, freshPostBoost + smallCreatorBoost)
      );

      // (g) Community negative signals & seen fatigue (viewer-hidden/reported already excluded)
      const isHiddenByViewer = ctx.hiddenSet.has(meta.id);
      const isReportedByViewer = ctx.reportedSet.has(meta.id);
      const isSeenByViewer = ctx.viewedSet.has(meta.id);

      let negativePenalty = 0;
      if (isHiddenByViewer || isReportedByViewer) {
        negativePenalty += SMART_FEED_WEIGHTS.hiddenOrReportedPenalty;
      }
      const communityNeg = (signal.hidesCount || 0) * 7 + (signal.reportsCount || 0) * 14;
      negativePenalty += Math.min(45, communityNeg);

      if (isSeenByViewer && ageHours > 2 && ownVeryRecentBoost === 0) {
        negativePenalty += SMART_FEED_WEIGHTS.seenFatiguePenalty;
      }
      negativePenalty = round2(negativePenalty);

      // Determine main explanation reason code
      let reasonCode: SmartFeedScoreBreakdown['reasonCode'] = 'trending_quality';
      if (isFollowed) reasonCode = 'followed_author';
      else if (interestScore >= 8) reasonCode = 'interest_match';
      else if (isJoinedCircle) reasonCode = 'joined_circle';
      else if (creatorDiscoveryBoost >= 4.5) reasonCode = 'fresh_creator';
      else if (adjacentDiscoveryScore >= 2.5) reasonCode = 'adjacent_discovery';

      const baseScore = round2(
        interestScore +
          socialScore +
          circleScore +
          qualityScore +
          popularityScore +
          freshnessScore +
          creatorDiscoveryBoost +
          adjacentDiscoveryScore -
          negativePenalty
      );

      baseEntries.push({
        item,
        meta,
        score: baseScore,
        breakdown: {
          interestScore,
          socialScore,
          circleScore,
          qualityScore,
          popularityScore,
          freshnessScore,
          creatorDiscoveryBoost,
          adjacentDiscoveryScore,
          negativePenalty,
          diversityPenalty: 0,
          totalScore: baseScore,
          matchedTopics,
          reasonCode
        }
      });
    }

    // 3. Greedy sequential diversity re-ranking to prevent excessive repeats of same author/topic
    const reranked = this.applyDiversityReranking(baseEntries, signalByItemKey);

    return {
      items: reranked,
      mode: 'for_you',
      usedFallback: false,
      computedAt: new Date().toISOString(),
      fromCache: false,
      totalCandidates: authorized.length
    };
  }

  private applyDiversityReranking<T extends UnifiedFeedCandidate>(
    entries: RankedFeedEntry<T>[],
    signalByItemKey: Map<string, ContentSignal>
  ): RankedFeedEntry<T>[] {
    if (entries.length <= 2) {
      return [...entries].sort((a, b) => b.score - a.score);
    }

    const pool = [...entries].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.meta.createdAt || '').localeCompare(a.meta.createdAt || '');
    });

    const n = pool.length;
    const picked = new Uint8Array(n);
    let scanStart = 0;

    const selected: RankedFeedEntry<T>[] = [];
    const authorCount = new Map<string, number>();
    const topicCount = new Map<string, number>();
    const recentAuthors: string[] = [];
    const recentTopics: string[] = [];

    for (let step = 0; step < n; step++) {
      while (scanStart < n && picked[scanStart] === 1) {
        scanStart += 1;
      }

      let bestIndex = scanStart;
      let bestAdjusted = -Infinity;
      let bestPenalty = 0;
      let inspected = 0;

      for (let i = scanStart; i < n && inspected < 32; i++) {
        if (picked[i] === 1) continue;
        inspected += 1;

        const cand = pool[i];
        const sig = signalByItemKey.get(candidateKey(cand.item));
        const primaryTopic = sig?.topics?.[0] || sig?.categories?.[0] || 'general';
        const author = cand.meta.authorId;

        let divPenalty = 0;

        // Avoid consecutive or tightly clustered posts from same author
        let authorRepeatsInRecent = 0;
        for (let k = 0; k < recentAuthors.length; k++) {
          if (recentAuthors[k] === author) authorRepeatsInRecent += 1;
        }
        if (authorRepeatsInRecent > 0) {
          divPenalty += SMART_FEED_WEIGHTS.authorRepeatWindowPenalty * authorRepeatsInRecent;
        }
        const totalAuthorCount = authorCount.get(author) || 0;
        if (totalAuthorCount >= 1) {
          divPenalty += 6 * Math.pow(totalAuthorCount, 1.15);
        }

        // Avoid topic monotony across consecutive cards
        let topicRepeatsInRecent = 0;
        for (let k = 0; k < recentTopics.length; k++) {
          if (recentTopics[k] === primaryTopic) topicRepeatsInRecent += 1;
        }
        if (topicRepeatsInRecent >= 2) {
          divPenalty += SMART_FEED_WEIGHTS.topicRepeatWindowPenalty * (topicRepeatsInRecent - 1);
        }
        const totalTopicCount = topicCount.get(primaryTopic) || 0;
        if (totalTopicCount >= 2) {
          divPenalty += 2.5 * (totalTopicCount - 1);
        }

        const adjusted = cand.score - divPenalty;
        if (adjusted > bestAdjusted) {
          bestAdjusted = adjusted;
          bestIndex = i;
          bestPenalty = round2(divPenalty);
        }
      }

      picked[bestIndex] = 1;
      const chosen = pool[bestIndex];
      const chosenSig = signalByItemKey.get(candidateKey(chosen.item));
      const chosenTopic = chosenSig?.topics?.[0] || chosenSig?.categories?.[0] || 'general';
      const adjustedScore = round2(chosen.score - bestPenalty);

      selected.push({
        ...chosen,
        score: adjustedScore,
        breakdown: {
          ...chosen.breakdown,
          diversityPenalty: bestPenalty,
          totalScore: adjustedScore
        }
      });

      authorCount.set(chosen.meta.authorId, (authorCount.get(chosen.meta.authorId) || 0) + 1);
      topicCount.set(chosenTopic, (topicCount.get(chosenTopic) || 0) + 1);

      recentAuthors.push(chosen.meta.authorId);
      if (recentAuthors.length > 2) recentAuthors.shift();

      recentTopics.push(chosenTopic);
      if (recentTopics.length > 3) recentTopics.shift();
    }

    return selected;
  }

  /**
   * Pagination helper for mobile progressive loading & cursor-like slicing.
   */
  paginateFeed<T>(
    rankedItems: T[],
    page = 1,
    pageSize = 10
  ): {
    items: T[];
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasMore: boolean;
  } {
    const safePageSize = Math.max(1, Math.min(500, Math.floor(pageSize)));
    const safePage = Math.max(1, Math.floor(page));
    const totalItems = rankedItems.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
    const start = (safePage - 1) * safePageSize;
    const end = start + safePageSize;

    return {
      items: rankedItems.slice(start, end),
      page: safePage,
      pageSize: safePageSize,
      totalItems,
      totalPages,
      hasMore: end < totalItems
    };
  }
}

export const smartFeedEngine = new SmartFeedEngineImpl();
