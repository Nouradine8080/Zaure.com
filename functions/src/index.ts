import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

type EventType =
  | 'post_view'
  | 'post_like'
  | 'post_comment'
  | 'post_share'
  | 'post_save'
  | 'post_hide'
  | 'post_report'
  | 'video_view'
  | 'video_completion'
  | 'profile_visit'
  | 'user_follow'
  | 'circle_join'
  | 'search';

const EVENT_WEIGHTS: Record<EventType, number> = {
  video_completion: 6.0,
  post_share: 5.0,
  post_save: 4.5,
  user_follow: 4.0,
  circle_join: 3.5,
  post_comment: 3.0,
  post_like: 2.0,
  search: 1.8,
  profile_visit: 1.2,
  video_view: 1.0,
  post_view: 0.5,
  post_hide: -4.5,
  post_report: -6.0
};

const FORBIDDEN_KEYS = new Set([
  'password',
  'motdepasse',
  'email',
  'phone',
  'telephone',
  'token',
  'secret',
  'messagecontent',
  'privatemessage',
  'address',
  'ssn'
]);

const INTEREST_HALF_LIFE_DAYS = 14;

function computeDecay(previousIso: string | undefined, nowIso: string): number {
  if (!previousIso) return 1;
  const prevMs = Date.parse(previousIso);
  const nowMs = Date.parse(nowIso);
  if (!Number.isFinite(prevMs) || !Number.isFinite(nowMs) || nowMs <= prevMs) return 1;
  const days = (nowMs - prevMs) / 86400000;
  return days < 0.01 ? 1 : Math.pow(0.5, days / INTEREST_HALF_LIFE_DAYS);
}

function computeContentScores(params: {
  publishedAt: string;
  viewsCount: number;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  savesCount: number;
  hidesCount: number;
  reportsCount: number;
  videoCompletionsCount: number;
}) {
  const pubMs = Date.parse(params.publishedAt);
  const ageHours = Number.isFinite(pubMs) ? Math.max(0, (Date.now() - pubMs) / 3600000) : 24;
  const positiveWeighted =
    params.viewsCount * 0.15 +
    params.likesCount * 2.0 +
    params.commentsCount * 3.2 +
    params.sharesCount * 4.8 +
    params.savesCount * 4.2 +
    params.videoCompletionsCount * 5.5;
  const negativePenalty = params.hidesCount * 5.0 + params.reportsCount * 10.0;
  const rawPopularity = Math.max(0, positiveWeighted - negativePenalty * 0.6);
  const interactionRate =
    params.viewsCount > 0
      ? (params.likesCount + params.commentsCount * 2 + params.sharesCount * 3 + params.savesCount * 2.5) /
        Math.max(1, params.viewsCount)
      : 0;
  const qualityScore =
    Math.round(
      Math.max(
        0,
        Math.min(100, 25 + Math.min(40, Math.log1p(positiveWeighted) * 8) + Math.min(35, interactionRate * 28) - Math.min(60, negativePenalty))
      ) * 100
    ) / 100;
  const popularityScore = Math.round(rawPopularity * 100) / 100;
  const decayScore = Math.round(((popularityScore + 1) / Math.pow(ageHours + 2, 1.35)) * 1000) / 1000;
  return { qualityScore, popularityScore, decayScore };
}

/**
 * Trigger Firestore : traite chaque événement validé dans /algorithm_events/{eventId}
 * et met à jour de manière atomique /user_interests, /algorithm_user_stats et /content_signals.
 */
export const onAlgorithmEventCreated = onDocumentCreated(
  'algorithm_events/{eventId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data() as {
      id: string;
      userId: string;
      eventType: EventType;
      targetId: string;
      targetType: string;
      timestamp: string;
      metadata?: Record<string, unknown>;
    };

    if (!data?.userId || !data?.eventType || !data?.targetId) return;

    const nowIso = data.timestamp || new Date().toISOString();
    const meta = data.metadata || {};
    const weight = EVENT_WEIGHTS[data.eventType] ?? 0.5;
    const topics: string[] = Array.isArray(meta.topics)
      ? meta.topics.filter((t): t is string => typeof t === 'string').slice(0, 6)
      : typeof meta.category === 'string'
        ? [meta.category.toLowerCase()]
        : [];

    const interestRef = db.collection('user_interests').doc(data.userId);
    const statsRef = db.collection('algorithm_user_stats').doc(data.userId);

    await db.runTransaction(async (tx) => {
      const [intSnap, stSnap] = await Promise.all([tx.get(interestRef), tx.get(statsRef)]);

      const prevInt = intSnap.exists
        ? (intSnap.data() as {
            interests?: Record<string, number>;
            affinityAuthors?: Record<string, number>;
            affinityCircles?: Record<string, number>;
            totalSignals?: number;
            updatedAt?: string;
          })
        : null;

      const decay = computeDecay(prevInt?.updatedAt, nowIso);
      const interests: Record<string, number> = { ...(prevInt?.interests || {}) };
      for (const k of Object.keys(interests)) {
        interests[k] = interests[k] * decay;
      }

      topics.forEach((topic, idx) => {
        const factor = idx === 0 ? 1 : idx === 1 ? 0.75 : 0.5;
        const val = Math.max(0, (interests[topic] || 0) + weight * factor);
        if (val <= 0.05) delete interests[topic];
        else interests[topic] = Math.min(1000, Math.round(val * 100) / 100);
      });

      const topTopics = Object.entries(interests)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([k]) => k);

      tx.set(
        interestRef,
        {
          userId: data.userId,
          interests,
          topTopics,
          affinityAuthors: prevInt?.affinityAuthors || {},
          affinityCircles: prevInt?.affinityCircles || {},
          decayVersion: 1,
          totalSignals: (prevInt?.totalSignals || 0) + 1,
          updatedAt: nowIso
        },
        { merge: true }
      );

      const prevStats = stSnap.exists ? (stSnap.data() as Record<string, number>) : {};
      tx.set(
        statsRef,
        {
          userId: data.userId,
          totalEvents: (prevStats.totalEvents || 0) + 1,
          viewsCount:
            (prevStats.viewsCount || 0) +
            (data.eventType === 'post_view' || data.eventType === 'video_view' ? 1 : 0),
          likesCount: (prevStats.likesCount || 0) + (data.eventType === 'post_like' ? 1 : 0),
          commentsCount: (prevStats.commentsCount || 0) + (data.eventType === 'post_comment' ? 1 : 0),
          sharesCount: (prevStats.sharesCount || 0) + (data.eventType === 'post_share' ? 1 : 0),
          savesCount: (prevStats.savesCount || 0) + (data.eventType === 'post_save' ? 1 : 0),
          videoCompletionsCount:
            (prevStats.videoCompletionsCount || 0) + (data.eventType === 'video_completion' ? 1 : 0),
          searchesCount: (prevStats.searchesCount || 0) + (data.eventType === 'search' ? 1 : 0),
          lastEventAt: nowIso,
          updatedAt: nowIso
        },
        { merge: true }
      );
    });

    if (data.targetType === 'post' || data.targetType === 'capsule' || data.targetType === 'video') {
      const sigRef = db.collection('content_signals').doc(data.targetId);
      await db.runTransaction(async (tx) => {
        const sigSnap = await tx.get(sigRef);
        const cur = sigSnap.exists ? (sigSnap.data() as Record<string, unknown>) : {};
        const viewsCount =
          Number(cur.viewsCount || 0) +
          (data.eventType === 'post_view' || data.eventType === 'video_view' ? 1 : 0);
        const likesCount = Number(cur.likesCount || 0) + (data.eventType === 'post_like' ? 1 : 0);
        const commentsCount = Number(cur.commentsCount || 0) + (data.eventType === 'post_comment' ? 1 : 0);
        const sharesCount = Number(cur.sharesCount || 0) + (data.eventType === 'post_share' ? 1 : 0);
        const savesCount = Number(cur.savesCount || 0) + (data.eventType === 'post_save' ? 1 : 0);
        const hidesCount = Number(cur.hidesCount || 0) + (data.eventType === 'post_hide' ? 1 : 0);
        const reportsCount = Number(cur.reportsCount || 0) + (data.eventType === 'post_report' ? 1 : 0);
        const videoCompletionsCount =
          Number(cur.videoCompletionsCount || 0) + (data.eventType === 'video_completion' ? 1 : 0);
        const publishedAt =
          typeof cur.publishedAt === 'string'
            ? cur.publishedAt
            : typeof meta.publishedAt === 'string'
              ? meta.publishedAt
              : nowIso;

        const scores = computeContentScores({
          publishedAt,
          viewsCount,
          likesCount,
          commentsCount,
          sharesCount,
          savesCount,
          hidesCount,
          reportsCount,
          videoCompletionsCount
        });

        tx.set(
          sigRef,
          {
            contentId: data.targetId,
            contentKind: data.targetType === 'capsule' ? 'capsule' : 'post',
            contentType: typeof cur.contentType === 'string' ? cur.contentType : String(meta.contentType || 'text'),
            authorId: typeof cur.authorId === 'string' ? cur.authorId : String(meta.authorId || data.userId),
            circleId: typeof cur.circleId === 'string' ? cur.circleId : String(meta.circleId || 'public'),
            categories: Array.isArray(cur.categories) && cur.categories.length > 0 ? cur.categories : topics.length > 0 ? topics : ['societe'],
            topics,
            publishedAt,
            viewsCount,
            likesCount,
            commentsCount,
            sharesCount,
            savesCount,
            hidesCount,
            reportsCount,
            videoCompletionsCount,
            ...scores,
            updatedAt: nowIso
          },
          { merge: true }
        );
      });
    }
  }
);

/**
 * Callable sécurisée pour événements sensibles (post_hide, post_report)
 */
export const validateSensitiveAlgorithmEvent = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentification Firebase requise.');
  }
  const uid = request.auth.uid;
  const payload = request.data as {
    eventType?: string;
    targetId?: string;
    targetType?: string;
    metadata?: Record<string, unknown>;
  };

  if (payload.eventType !== 'post_hide' && payload.eventType !== 'post_report') {
    throw new HttpsError('invalid-argument', 'Type d’événement sensible non supporté.');
  }
  if (!payload.targetId || typeof payload.targetId !== 'string' || payload.targetId.length > 260) {
    throw new HttpsError('invalid-argument', 'targetId invalide.');
  }

  const safeMeta: Record<string, unknown> = {};
  if (payload.metadata && typeof payload.metadata === 'object') {
    for (const [k, v] of Object.entries(payload.metadata)) {
      if (FORBIDDEN_KEYS.has(k.toLowerCase())) continue;
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        safeMeta[k.slice(0, 48)] = typeof v === 'string' ? v.slice(0, 120) : v;
      }
    }
  }

  const id = `evt_srv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const docData = {
    id,
    userId: uid,
    eventType: payload.eventType,
    targetId: payload.targetId,
    targetType: payload.targetType === 'capsule' ? 'capsule' : 'post',
    timestamp: new Date().toISOString(),
    metadata: safeMeta
  };

  await db.collection('algorithm_events').doc(id).set(docData);
  return { ok: true, id };
});

/**
 * Tâche planifiée : recalcule la décroissance temporelle des signaux récents toutes les 6h.
 */
export const recomputeContentSignalDecay = onSchedule('every 6 hours', async () => {
  const recentSnap = await db
    .collection('content_signals')
    .orderBy('updatedAt', 'desc')
    .limit(200)
    .get();

  if (recentSnap.empty) return;
  const batch = db.batch();
  const nowIso = new Date().toISOString();

  recentSnap.docs.forEach((docSnap) => {
    const d = docSnap.data();
    const scores = computeContentScores({
      publishedAt: String(d.publishedAt || nowIso),
      viewsCount: Number(d.viewsCount || 0),
      likesCount: Number(d.likesCount || 0),
      commentsCount: Number(d.commentsCount || 0),
      sharesCount: Number(d.sharesCount || 0),
      savesCount: Number(d.savesCount || 0),
      hidesCount: Number(d.hidesCount || 0),
      reportsCount: Number(d.reportsCount || 0),
      videoCompletionsCount: Number(d.videoCompletionsCount || 0)
    });
    batch.update(docSnap.ref, {
      ...scores,
      updatedAt: nowIso
    });
  });

  await batch.commit();
});
