import {
  Capsule,
  Comment,
  CommunityGroup,
  GroupPost,
  PostComment,
  UserProfile
} from '../../types';
import { AdminPermissionKey, AdminSessionContext } from '../types';

export type TimeRangePreset = '24h' | '7d' | '30d' | '90d' | 'custom';

export interface PeriodBounds {
  preset: TimeRangePreset;
  startMs: number;
  endMs: number;
  prevStartMs: number;
  prevEndMs: number;
  bucketMode: 'hour' | 'day' | 'week';
  label: string;
}

export interface MetricDelta {
  current: number;
  previous: number;
  deltaPct: number | null;
  direction: 'up' | 'down' | 'flat' | 'na';
}

export interface TimelineBucket {
  key: string;
  label: string;
  newUsers: number;
  cumulativeUsers: number;
  posts: number;
  comments: number;
  totalActivity: number;
}

export interface CommunityActivityRank {
  groupId: string;
  name: string;
  privacy: 'public' | 'private';
  memberCount: number;
  periodPosts: number;
  periodComments: number;
  activityScore: number;
}

export function canPerformAdminAction(
  session: AdminSessionContext | null | undefined,
  permission: AdminPermissionKey
): boolean {
  if (!session || !session.isAuthorized) return false;
  if (session.role === 'SUPER_ADMIN') return true;
  return Boolean(session.permissions?.[permission]);
}

export function parseTimestampMs(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

export function resolvePeriodBounds(
  preset: TimeRangePreset,
  customStart?: string,
  customEnd?: string,
  nowMs: number = Date.now()
): PeriodBounds {
  const hourMs = 3600 * 1000;
  const dayMs = 24 * hourMs;

  let startMs = nowMs - 30 * dayMs;
  let endMs = nowMs;
  let bucketMode: 'hour' | 'day' | 'week' = 'day';
  let label = '30 derniers jours';

  if (preset === '24h') {
    startMs = nowMs - 24 * hourMs;
    bucketMode = 'hour';
    label = '24 dernières heures';
  } else if (preset === '7d') {
    startMs = nowMs - 7 * dayMs;
    bucketMode = 'day';
    label = '7 derniers jours';
  } else if (preset === '30d') {
    startMs = nowMs - 30 * dayMs;
    bucketMode = 'day';
    label = '30 derniers jours';
  } else if (preset === '90d') {
    startMs = nowMs - 90 * dayMs;
    bucketMode = 'week';
    label = '90 derniers jours';
  } else if (preset === 'custom') {
    const parsedStart = customStart ? Date.parse(`${customStart}T00:00:00`) : NaN;
    const parsedEnd = customEnd ? Date.parse(`${customEnd}T23:59:59.999`) : NaN;
    if (!Number.isNaN(parsedStart) && !Number.isNaN(parsedEnd) && parsedEnd >= parsedStart) {
      startMs = parsedStart;
      endMs = parsedEnd;
    } else if (!Number.isNaN(parsedStart)) {
      startMs = parsedStart;
      endMs = Math.max(parsedStart + dayMs, nowMs);
    } else {
      startMs = nowMs - 30 * dayMs;
    }
    const spanDays = Math.max(1, (endMs - startMs) / dayMs);
    bucketMode = spanDays <= 2 ? 'hour' : spanDays <= 45 ? 'day' : 'week';
    label = `${new Date(startMs).toLocaleDateString('fr-FR')} – ${new Date(endMs).toLocaleDateString('fr-FR')}`;
  }

  const span = Math.max(hourMs, endMs - startMs);
  return {
    preset,
    startMs,
    endMs,
    prevStartMs: startMs - span,
    prevEndMs: startMs,
    bucketMode,
    label
  };
}

export function computeMetricDelta(current: number, previous: number): MetricDelta {
  if (previous <= 0) {
    return {
      current,
      previous,
      deltaPct: null,
      direction: 'na'
    };
  }
  const diff = current - previous;
  const pct = Math.round((diff / previous) * 100);
  return {
    current,
    previous,
    deltaPct: pct,
    direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat'
  };
}

export function isInRange(iso: string | undefined | null, startMs: number, endMs: number): boolean {
  const ms = parseTimestampMs(iso);
  if (ms === null) return false;
  return ms >= startMs && ms <= endMs;
}

export function computeActiveUserIdsInRange(
  params: {
    users: UserProfile[];
    groupPosts: GroupPost[];
    capsules: Capsule[];
    postComments: PostComment[];
    capsuleComments: Comment[];
  },
  startMs: number,
  endMs: number
): Set<string> {
  const activeIds = new Set<string>();

  params.users.forEach((u) => {
    if (isInRange(u.last_active, startMs, endMs) || isInRange(u.created_at, startMs, endMs)) {
      activeIds.add(u.id);
    }
  });
  params.groupPosts.forEach((p) => {
    if (p.authorId && isInRange(p.createdAt, startMs, endMs)) {
      activeIds.add(p.authorId);
    }
  });
  params.capsules.forEach((c) => {
    if (c.auteur_id && isInRange(c.created_at, startMs, endMs)) {
      activeIds.add(c.auteur_id);
    }
  });
  params.postComments.forEach((c) => {
    if (c.authorId && isInRange(c.createdAt, startMs, endMs)) {
      activeIds.add(c.authorId);
    }
  });
  params.capsuleComments.forEach((c) => {
    if (c.auteur_id && isInRange(c.created_at, startMs, endMs)) {
      activeIds.add(c.auteur_id);
    }
  });

  return activeIds;
}

export function buildDashboardTimelineSeries(
  params: {
    users: UserProfile[];
    groupPosts: GroupPost[];
    capsules: Capsule[];
    postComments: PostComment[];
    capsuleComments: Comment[];
  },
  bounds: PeriodBounds
): TimelineBucket[] {
  const { startMs, endMs, bucketMode } = bounds;
  const hourMs = 3600 * 1000;
  const dayMs = 24 * hourMs;
  const weekMs = 7 * dayMs;

  const stepMs = bucketMode === 'hour' ? hourMs : bucketMode === 'day' ? dayMs : weekMs;

  const buckets: Array<{ start: number; end: number; bucket: TimelineBucket }> = [];
  let cursor = startMs;
  let guard = 0;

  while (cursor <= endMs && guard < 120) {
    const nextCursor = Math.min(endMs + 1, cursor + stepMs);
    const d = new Date(cursor);
    const label =
      bucketMode === 'hour'
        ? `${String(d.getHours()).padStart(2, '0')}h`
        : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    buckets.push({
      start: cursor,
      end: nextCursor,
      bucket: {
        key: `${cursor}`,
        label,
        newUsers: 0,
        cumulativeUsers: 0,
        posts: 0,
        comments: 0,
        totalActivity: 0
      }
    });
    cursor = nextCursor;
    guard += 1;
  }

  if (buckets.length === 0) return [];

  let baselineUsersBeforePeriod = 0;
  params.users.forEach((u) => {
    const ms = parseTimestampMs(u.created_at);
    if (ms === null) return;
    if (ms < startMs) {
      baselineUsersBeforePeriod += 1;
      return;
    }
    if (ms <= endMs) {
      const target = buckets.find((b) => ms >= b.start && ms < b.end) || buckets[buckets.length - 1];
      target.bucket.newUsers += 1;
    }
  });

  params.groupPosts.forEach((p) => {
    const ms = parseTimestampMs(p.createdAt);
    if (ms !== null && ms >= startMs && ms <= endMs) {
      const target = buckets.find((b) => ms >= b.start && ms < b.end) || buckets[buckets.length - 1];
      target.bucket.posts += 1;
    }
  });

  params.capsules.forEach((c) => {
    const ms = parseTimestampMs(c.created_at);
    if (ms !== null && ms >= startMs && ms <= endMs) {
      const target = buckets.find((b) => ms >= b.start && ms < b.end) || buckets[buckets.length - 1];
      target.bucket.posts += 1;
    }
  });

  params.postComments.forEach((c) => {
    const ms = parseTimestampMs(c.createdAt);
    if (ms !== null && ms >= startMs && ms <= endMs) {
      const target = buckets.find((b) => ms >= b.start && ms < b.end) || buckets[buckets.length - 1];
      target.bucket.comments += 1;
    }
  });

  params.capsuleComments.forEach((c) => {
    const ms = parseTimestampMs(c.created_at);
    if (ms !== null && ms >= startMs && ms <= endMs) {
      const target = buckets.find((b) => ms >= b.start && ms < b.end) || buckets[buckets.length - 1];
      target.bucket.comments += 1;
    }
  });

  let runningUsers = baselineUsersBeforePeriod;
  return buckets.map(({ bucket }) => {
    runningUsers += bucket.newUsers;
    bucket.cumulativeUsers = runningUsers;
    bucket.totalActivity = bucket.newUsers + bucket.posts + bucket.comments;
    return bucket;
  });
}

export function buildTopCommunitiesActivity(
  groups: CommunityGroup[],
  groupPosts: GroupPost[],
  postComments: PostComment[],
  startMs: number,
  endMs: number
): CommunityActivityRank[] {
  const postsByGroup = new Map<string, number>();
  const commentsByGroup = new Map<string, number>();

  groupPosts.forEach((p) => {
    if (p.groupId && p.groupId !== 'public' && isInRange(p.createdAt, startMs, endMs)) {
      postsByGroup.set(p.groupId, (postsByGroup.get(p.groupId) || 0) + 1);
    }
  });

  postComments.forEach((c) => {
    if (c.groupId && c.groupId !== 'public' && isInRange(c.createdAt, startMs, endMs)) {
      commentsByGroup.set(c.groupId, (commentsByGroup.get(c.groupId) || 0) + 1);
    }
  });

  return groups
    .map((g) => {
      const periodPosts = postsByGroup.get(g.id) || 0;
      const periodComments = commentsByGroup.get(g.id) || 0;
      const activityScore = periodPosts * 2 + periodComments;
      return {
        groupId: g.id,
        name: g.name,
        privacy: g.privacy,
        memberCount: g.memberCount || 0,
        periodPosts,
        periodComments,
        activityScore
      };
    })
    .sort((a, b) => b.activityScore - a.activityScore || b.memberCount - a.memberCount)
    .slice(0, 6);
}
