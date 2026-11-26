import type {
  AlgorithmEvent,
  AlgorithmEventMetadata,
  AlgorithmEventType,
  AlgorithmMetadataValue,
  AlgorithmUserStats,
  ContentSignal,
  InterestTopicId,
  UserInterestProfile
} from '../../types/algorithm';
import type { Capsule, GroupPost } from '../../types';

export const ALGORITHM_DECAY_VERSION = 1;
export const INTEREST_HALF_LIFE_DAYS = 14;
export const MAX_TRACKED_TOPICS = 40;
export const MAX_TOP_TOPICS = 20;
export const MAX_AFFINITY_AUTHORS = 60;
export const MAX_AFFINITY_CIRCLES = 40;
export const MAX_METADATA_KEYS = 12;

export const VALID_ALGORITHM_EVENT_TYPES: readonly AlgorithmEventType[] = [
  'post_view',
  'post_like',
  'post_comment',
  'post_share',
  'post_save',
  'post_hide',
  'post_report',
  'video_view',
  'video_completion',
  'profile_visit',
  'user_follow',
  'circle_join',
  'search'
] as const;

export const FORBIDDEN_METADATA_KEYS = new Set<string>([
  'password',
  'motdepasse',
  'motDePasse',
  'email',
  'e-mail',
  'phone',
  'telephone',
  'tel',
  'token',
  'idtoken',
  'secret',
  'messagecontent',
  'messageContent',
  'privatemessage',
  'privateMessage',
  'address',
  'adresse',
  'ssn',
  'passwordhash',
  'apikey'
]);

/**
 * Hybrid Facebook + TikTok interaction weights:
 * - Video completion & deep advocacy (share, save) weigh highest
 * - Passive view provides gentle signal
 * - Hide / Report apply negative interest penalties
 */
export const EVENT_INTEREST_WEIGHTS: Record<AlgorithmEventType, number> = {
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

export const INTEREST_TOPIC_LABELS: Record<InterestTopicId, string> = {
  sante: 'Santé',
  medecine: 'Médecine',
  technologie: 'Technologie',
  education: 'Éducation',
  science: 'Science',
  sport: 'Sport',
  actualites: 'Actualités',
  culture: 'Culture',
  entrepreneuriat: 'Entrepreneuriat',
  agriculture: 'Agriculture',
  langues: 'Langues',
  societe: 'Société'
};

const TOPIC_KEYWORDS: Record<InterestTopicId, string[]> = {
  sante: [
    'sante',
    'hygiene',
    'nutrition',
    'prevention',
    'hopital',
    'vaccin',
    'paludisme',
    'bien-etre',
    'secourisme',
    'premiers secours',
    'maternelle',
    'publique',
    'lafiya'
  ],
  medecine: [
    'medecine',
    'medecin',
    'docteur',
    'dr ',
    'hypertension',
    'diabete',
    'clinique',
    'diagnostic',
    'traitement',
    'pharmacopee',
    'ordonnance',
    'chirurgie',
    'infirmier',
    'cardiologie',
    'symptome',
    'recommandations',
    'directives'
  ],
  technologie: [
    'technologie',
    'tech',
    'informatique',
    'ia',
    'intelligence artificielle',
    'logiciel',
    'application',
    'android',
    'code',
    'programmation',
    'developpement',
    'reseau',
    'numerique',
    'digital',
    'cyber',
    'cloud',
    'data',
    'web',
    'mobile'
  ],
  education: [
    'education',
    'etude',
    'etudes',
    'etudiant',
    'etudiants',
    'universite',
    'ecole',
    'cours',
    'lecon',
    'revision',
    'examen',
    'formation',
    'apprentissage',
    'pedagogie',
    'bourse',
    'mentorat',
    'diplome',
    'savoir',
    'karatu'
  ],
  science: [
    'science',
    'sciences',
    'recherche',
    'biologie',
    'physique',
    'chimie',
    'mathematiques',
    'maths',
    'laboratoire',
    'experience',
    'astronomie',
    'ecologie',
    'climat',
    'scientifique'
  ],
  sport: [
    'sport',
    'football',
    'foot',
    'match',
    'ligue',
    'championnat',
    'athlete',
    'athletisme',
    'entrainement',
    'basket',
    'fitness',
    'stade',
    'equipe',
    'can '
  ],
  actualites: [
    'actualite',
    'actualites',
    'info',
    'infos',
    'monde',
    'afrique',
    'niger',
    'sahel',
    'uemoa',
    'cedeao',
    'politique',
    'economie',
    'sommet',
    'annonce',
    'communique',
    'journal'
  ],
  culture: [
    'culture',
    'histoire',
    'patrimoine',
    'art',
    'musique',
    'litterature',
    'livre',
    'proverbe',
    'conte',
    'tradition',
    'festival',
    'cinema',
    'artisanat'
  ],
  entrepreneuriat: [
    'entrepreneuriat',
    'entrepreneur',
    'business',
    'entreprise',
    'startup',
    'commerce',
    'finance',
    'projet',
    'marketing',
    'vente',
    'leadership',
    'gestion',
    'investissement',
    'carriere',
    'emploi'
  ],
  agriculture: [
    'agriculture',
    'agricole',
    'agri',
    'recolte',
    'culture',
    'semence',
    'irrigation',
    'elevage',
    'sol',
    'pluie',
    'mil',
    'sorgho',
    'niebe',
    'agroecologie',
    'ferme',
    'noma'
  ],
  langues: [
    'langue',
    'langues',
    'hausa',
    'zarma',
    'fulfulde',
    'francais',
    'anglais',
    'tamajaq',
    'dictionnaire',
    'traduction',
    'vocabulaire',
    'grammaire',
    'orthographe'
  ],
  societe: [
    'societe',
    'communaute',
    'entraide',
    'solidarite',
    'citoyennete',
    'jeunesse',
    'famille',
    'environnement',
    'developpement local'
  ]
};

export function normalizeTextForMatching(raw: string): string {
  return (raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripSensitivePatterns(text: string): string {
  return (text || '')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email-redacted]')
    .replace(/\+?\d[\d\s\-().]{6,18}\d/g, '[phone-redacted]')
    .trim();
}

export function normalizeCategoryToTopic(category?: string | null): InterestTopicId | null {
  if (!category) return null;
  const norm = normalizeTextForMatching(category);
  if (!norm) return null;
  if (norm.includes('medec') || norm.includes('cardio') || norm.includes('clinic')) return 'medecine';
  if (norm.includes('sant') || norm.includes('health')) return 'sante';
  if (norm.includes('tech') || norm.includes('info') || norm.includes('digital') || norm.includes('ia')) {
    return 'technologie';
  }
  if (norm.includes('educ') || norm.includes('etud') || norm.includes('format') || norm.includes('scol')) {
    return 'education';
  }
  if (norm.includes('scien')) return 'science';
  if (norm.includes('sport') || norm.includes('foot')) return 'sport';
  if (norm.includes('actu') || norm.includes('news') || norm.includes('monde')) return 'actualites';
  if (norm.includes('cultur') || norm.includes('histoir') || norm.includes('art')) return 'culture';
  if (norm.includes('entrepren') || norm.includes('busi') || norm.includes('econ') || norm.includes('finan')) {
    return 'entrepreneuriat';
  }
  if (norm.includes('agri') || norm.includes('elevag') || norm.includes('sahel')) return 'agriculture';
  if (norm.includes('lang')) return 'langues';
  if (norm.includes('soci') || norm.includes('commu')) return 'societe';
  return null;
}

export function extractHashtags(text: string): string[] {
  const matches = (text || '').match(/#[a-zA-Z0-9À-ÿ_]{2,40}/g) || [];
  const seen = new Set<string>();
  for (const tag of matches) {
    const clean = normalizeTextForMatching(tag.slice(1)).replace(/[^a-z0-9_]/g, '');
    if (clean.length >= 2) seen.add(clean);
  }
  return Array.from(seen).slice(0, 12);
}

export function extractTopicsFromText(text: string, categoryHint?: string | null): InterestTopicId[] {
  const matched = new Map<InterestTopicId, number>();

  const categoryTopic = normalizeCategoryToTopic(categoryHint);
  if (categoryTopic) {
    matched.set(categoryTopic, 3);
  }

  const tokenNormalized = ` ${normalizeTextForMatching(text).replace(/[^a-z0-9-]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
  if (tokenNormalized.trim().length > 0) {
    (Object.keys(TOPIC_KEYWORDS) as InterestTopicId[]).forEach((topic) => {
      const words = TOPIC_KEYWORDS[topic];
      let hits = 0;
      for (const kw of words) {
        const cleanKw = kw.trim();
        if (cleanKw && tokenNormalized.includes(` ${cleanKw} `)) {
          hits += 1;
        }
      }
      if (hits > 0) {
        matched.set(topic, (matched.get(topic) || 0) + hits);
      }
    });
  }

  // Also check hashtag exact matches
  const tags = extractHashtags(text);
  for (const tag of tags) {
    const mapped = normalizeCategoryToTopic(tag);
    if (mapped) {
      matched.set(mapped, (matched.get(mapped) || 0) + 2);
    }
  }

  return Array.from(matched.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([topic]) => topic)
    .slice(0, 6);
}

export function sanitizeAlgorithmMetadata(
  raw?: Record<string, unknown> | null
): AlgorithmEventMetadata {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const clean: AlgorithmEventMetadata = {};
  let count = 0;

  for (const [key, val] of Object.entries(raw)) {
    if (count >= MAX_METADATA_KEYS) break;
    const trimmedKey = key.trim().slice(0, 48);
    if (!trimmedKey || !/^[a-zA-Z0-9_]+$/.test(trimmedKey)) continue;
    if (FORBIDDEN_METADATA_KEYS.has(trimmedKey.toLowerCase())) continue;
    if (val === null || val === undefined) continue;

    if (typeof val === 'string') {
      const sanitized = stripSensitivePatterns(val).slice(0, 120);
      if (sanitized.length > 0) {
        clean[trimmedKey] = sanitized;
        count += 1;
      }
    } else if (typeof val === 'number' && Number.isFinite(val)) {
      clean[trimmedKey] = Math.round(val * 1000) / 1000;
      count += 1;
    } else if (typeof val === 'boolean') {
      clean[trimmedKey] = val;
      count += 1;
    } else if (Array.isArray(val)) {
      const safeArr = val
        .filter((item): item is string => typeof item === 'string')
        .map((item) => stripSensitivePatterns(item).slice(0, 48))
        .filter(Boolean)
        .slice(0, 8);
      if (safeArr.length > 0) {
        clean[trimmedKey] = safeArr;
        count += 1;
      }
    }
  }

  return clean;
}

export function isValidFirestoreDocId(id: string, maxLen = 260): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= maxLen && /^[a-zA-Z0-9_-]+$/.test(id);
}

export function inferTopicsFromEvent(event: AlgorithmEvent): InterestTopicId[] {
  const topics = new Set<InterestTopicId>();
  const meta = event.metadata || {};

  if (Array.isArray(meta.topics)) {
    meta.topics.forEach((item) => {
      if (typeof item === 'string') {
        const mapped = normalizeCategoryToTopic(item) || (item in INTEREST_TOPIC_LABELS ? (item as InterestTopicId) : null);
        if (mapped) topics.add(mapped);
      }
    });
  }

  if (typeof meta.category === 'string') {
    const mapped = normalizeCategoryToTopic(meta.category);
    if (mapped) topics.add(mapped);
  }

  if (typeof meta.queryNormalized === 'string') {
    extractTopicsFromText(meta.queryNormalized).forEach((t) => topics.add(t));
  }

  if (typeof meta.topicText === 'string') {
    extractTopicsFromText(meta.topicText).forEach((t) => topics.add(t));
  }

  return Array.from(topics).slice(0, 6);
}

export function computeDecayFactor(previousIso: string | undefined, nowIso: string): number {
  if (!previousIso) return 1;
  const prevMs = Date.parse(previousIso);
  const nowMs = Date.parse(nowIso);
  if (!Number.isFinite(prevMs) || !Number.isFinite(nowMs) || nowMs <= prevMs) return 1;
  const daysElapsed = (nowMs - prevMs) / (1000 * 60 * 60 * 24);
  if (daysElapsed < 0.01) return 1;
  return Math.pow(0.5, daysElapsed / INTEREST_HALF_LIFE_DAYS);
}

export function normalizeInterestMap(raw: Record<string, number>): Record<string, number> {
  const entries = Object.entries(raw)
    .filter(([, score]) => Number.isFinite(score) && score > 0.01)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_TRACKED_TOPICS);

  const normalized: Record<string, number> = {};
  for (const [k, v] of entries) {
    normalized[k] = Math.min(1000, Math.round(v * 100) / 100);
  }
  return normalized;
}

export function foldEventIntoInterestProfile(
  current: UserInterestProfile | null,
  event: AlgorithmEvent
): UserInterestProfile {
  const nowIso = event.timestamp || new Date().toISOString();
  const base: UserInterestProfile = current
    ? {
        ...current,
        interests: { ...(current.interests || {}) },
        affinityAuthors: { ...(current.affinityAuthors || {}) },
        affinityCircles: { ...(current.affinityCircles || {}) },
        topTopics: [...(current.topTopics || [])]
      }
    : {
        userId: event.userId,
        interests: {},
        topTopics: [],
        affinityAuthors: {},
        affinityCircles: {},
        decayVersion: ALGORITHM_DECAY_VERSION,
        totalSignals: 0,
        updatedAt: nowIso
      };

  const decay = computeDecayFactor(current?.updatedAt, nowIso);
  if (decay < 0.999) {
    for (const k of Object.keys(base.interests)) {
      base.interests[k] = base.interests[k] * decay;
    }
    if (base.affinityAuthors) {
      for (const k of Object.keys(base.affinityAuthors)) {
        base.affinityAuthors[k] = base.affinityAuthors[k] * decay;
      }
    }
    if (base.affinityCircles) {
      for (const k of Object.keys(base.affinityCircles)) {
        base.affinityCircles[k] = base.affinityCircles[k] * decay;
      }
    }
  }

  const baseWeight = EVENT_INTEREST_WEIGHTS[event.eventType] ?? 0.5;
  const topics = inferTopicsFromEvent(event);

  topics.forEach((topic, idx) => {
    const rankFactor = idx === 0 ? 1 : idx === 1 ? 0.75 : 0.5;
    const prev = base.interests[topic] || 0;
    const next = Math.max(0, prev + baseWeight * rankFactor);
    if (next <= 0.05) {
      delete base.interests[topic];
    } else {
      base.interests[topic] = next;
    }
  });

  const authorId =
    typeof event.metadata?.authorId === 'string' && isValidFirestoreDocId(event.metadata.authorId, 128)
      ? event.metadata.authorId
      : event.targetType === 'profile' && isValidFirestoreDocId(event.targetId, 128)
        ? event.targetId
        : null;

  if (authorId && authorId !== event.userId) {
    const authors = base.affinityAuthors || {};
    const nextAuthor = Math.max(0, (authors[authorId] || 0) + baseWeight);
    if (nextAuthor <= 0.05) {
      delete authors[authorId];
    } else {
      authors[authorId] = Math.round(nextAuthor * 100) / 100;
    }
    const sortedAuthors = Object.entries(authors)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_AFFINITY_AUTHORS);
    base.affinityAuthors = Object.fromEntries(sortedAuthors);
  }

  const circleId =
    typeof event.metadata?.circleId === 'string' &&
    event.metadata.circleId !== 'public' &&
    isValidFirestoreDocId(event.metadata.circleId, 128)
      ? event.metadata.circleId
      : (event.targetType === 'circle' || event.targetType === 'group') && isValidFirestoreDocId(event.targetId, 128)
        ? event.targetId
        : null;

  if (circleId) {
    const circles = base.affinityCircles || {};
    const nextCircle = Math.max(0, (circles[circleId] || 0) + baseWeight);
    if (nextCircle <= 0.05) {
      delete circles[circleId];
    } else {
      circles[circleId] = Math.round(nextCircle * 100) / 100;
    }
    const sortedCircles = Object.entries(circles)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_AFFINITY_CIRCLES);
    base.affinityCircles = Object.fromEntries(sortedCircles);
  }

  base.interests = normalizeInterestMap(base.interests);
  base.topTopics = Object.entries(base.interests)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_TOP_TOPICS)
    .map(([topic]) => topic);
  base.decayVersion = ALGORITHM_DECAY_VERSION;
  base.totalSignals = (base.totalSignals || 0) + 1;
  base.updatedAt = nowIso;

  return base;
}

export function foldEventIntoUserStats(
  current: AlgorithmUserStats | null,
  event: AlgorithmEvent
): AlgorithmUserStats {
  const nowIso = event.timestamp || new Date().toISOString();
  const prevDay = current?.lastEventAt ? current.lastEventAt.slice(0, 10) : '';
  const eventDay = nowIso.slice(0, 10);
  const nextActiveDays =
    (current?.activeDays || 0) + (eventDay && eventDay !== prevDay ? 1 : current ? 0 : 1);

  const stats: AlgorithmUserStats = {
    userId: event.userId,
    totalEvents: (current?.totalEvents || 0) + 1,
    viewsCount: current?.viewsCount || 0,
    likesCount: current?.likesCount || 0,
    commentsCount: current?.commentsCount || 0,
    sharesCount: current?.sharesCount || 0,
    savesCount: current?.savesCount || 0,
    videoCompletionsCount: current?.videoCompletionsCount || 0,
    searchesCount: current?.searchesCount || 0,
    activeDays: Math.max(1, nextActiveDays),
    lastEventAt: nowIso,
    updatedAt: nowIso
  };

  switch (event.eventType) {
    case 'post_view':
    case 'video_view':
      stats.viewsCount += 1;
      break;
    case 'post_like':
      stats.likesCount += 1;
      break;
    case 'post_comment':
      stats.commentsCount += 1;
      break;
    case 'post_share':
      stats.sharesCount += 1;
      break;
    case 'post_save':
      stats.savesCount += 1;
      break;
    case 'video_completion':
      stats.videoCompletionsCount = (stats.videoCompletionsCount || 0) + 1;
      break;
    case 'search':
      stats.searchesCount = (stats.searchesCount || 0) + 1;
      break;
    default:
      break;
  }

  return stats;
}

export function computeContentScores(params: {
  publishedAt: string;
  viewsCount: number;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  savesCount: number;
  hidesCount: number;
  reportsCount: number;
  videoCompletionsCount: number;
  hasRichMedia?: boolean;
  nowMs?: number;
}): { qualityScore: number; popularityScore: number; decayScore: number } {
  const nowMs = params.nowMs ?? Date.now();
  const pubMs = Date.parse(params.publishedAt);
  const ageHours = Number.isFinite(pubMs) ? Math.max(0, (nowMs - pubMs) / 3600000) : 24;

  const positiveWeighted =
    params.viewsCount * 0.15 +
    params.likesCount * 2.0 +
    params.commentsCount * 3.2 +
    params.sharesCount * 4.8 +
    params.savesCount * 4.2 +
    params.videoCompletionsCount * 5.5 +
    (params.hasRichMedia ? 2.0 : 0);

  const negativePenalty = params.hidesCount * 5.0 + params.reportsCount * 10.0;
  const rawPopularity = Math.max(0, positiveWeighted - negativePenalty * 0.6);

  // Quality combines engagement depth ratio + logarithmic volume minus negative signals
  const interactionRate =
    params.viewsCount > 0
      ? (params.likesCount + params.commentsCount * 2 + params.sharesCount * 3 + params.savesCount * 2.5) /
        Math.max(1, params.viewsCount)
      : 0;
  const baseQuality =
    25 +
    Math.min(40, Math.log1p(positiveWeighted) * 8) +
    Math.min(35, interactionRate * 28) -
    Math.min(60, negativePenalty);

  const qualityScore = Math.round(Math.max(0, Math.min(100, baseQuality)) * 100) / 100;
  const popularityScore = Math.round(rawPopularity * 100) / 100;
  const decayScore =
    Math.round(((popularityScore + 1) / Math.pow(ageHours + 2, 1.35)) * 1000) / 1000;

  return { qualityScore, popularityScore, decayScore };
}

export function analyzeGroupPostContent(
  post: GroupPost,
  options?: { categoryHint?: string | null; viewsCount?: number; hidesCount?: number; reportsCount?: number; videoCompletionsCount?: number }
): ContentSignal {
  const topics = extractTopicsFromText(
    `${post.content || ''} ${post.poll?.question || ''}`,
    options?.categoryHint
  );
  const categories =
    options?.categoryHint && normalizeCategoryToTopic(options.categoryHint)
      ? Array.from(new Set([normalizeCategoryToTopic(options.categoryHint)!, ...topics]))
      : topics.length > 0
        ? topics
        : ['societe'];

  const viewsCount = Math.max(0, options?.viewsCount ?? 0);
  const likesCount = Math.max(0, post.reactionCount || 0);
  const commentsCount = Math.max(0, post.commentCount || 0);
  const sharesCount = Math.max(0, post.shareCount || 0);
  const savesCount = Math.max(0, post.savedBy?.length || 0);
  const hidesCount = Math.max(0, options?.hidesCount ?? 0);
  const reportsCount = Math.max(0, options?.reportsCount ?? 0);
  const videoCompletionsCount = Math.max(0, options?.videoCompletionsCount ?? 0);

  const scores = computeContentScores({
    publishedAt: post.createdAt || new Date().toISOString(),
    viewsCount,
    likesCount,
    commentsCount,
    sharesCount,
    savesCount,
    hidesCount,
    reportsCount,
    videoCompletionsCount,
    hasRichMedia: (post.media && post.media.length > 0) || Boolean(post.poll)
  });

  return {
    contentId: post.id,
    contentKind: 'post',
    contentType: post.type,
    authorId: post.authorId,
    circleId: post.groupId || 'public',
    categories,
    topics,
    publishedAt: post.createdAt || new Date().toISOString(),
    viewsCount,
    likesCount,
    commentsCount,
    sharesCount,
    savesCount,
    hidesCount,
    reportsCount,
    videoCompletionsCount,
    ...scores,
    updatedAt: new Date().toISOString()
  };
}

export function analyzeCapsuleContent(
  capsule: Capsule,
  options?: { categoryHint?: string | null; likesCount?: number; commentsCount?: number; viewsCount?: number; sharesCount?: number; savesCount?: number; hidesCount?: number; reportsCount?: number; videoCompletionsCount?: number }
): ContentSignal {
  const textBody = capsule.type === 'audio' ? capsule.media_name || '' : capsule.contenu || '';
  const topics = extractTopicsFromText(textBody, options?.categoryHint);
  const categories =
    options?.categoryHint && normalizeCategoryToTopic(options.categoryHint)
      ? Array.from(new Set([normalizeCategoryToTopic(options.categoryHint)!, ...topics]))
      : topics.length > 0
        ? topics
        : ['education'];

  const viewsCount = Math.max(0, options?.viewsCount ?? 0);
  const likesCount = Math.max(0, options?.likesCount ?? 0);
  const commentsCount = Math.max(0, options?.commentsCount ?? 0);
  const sharesCount = Math.max(0, options?.sharesCount ?? 0);
  const savesCount = Math.max(0, options?.savesCount ?? 0);
  const hidesCount = Math.max(0, options?.hidesCount ?? 0);
  const reportsCount = Math.max(0, options?.reportsCount ?? 0);
  const videoCompletionsCount = Math.max(0, options?.videoCompletionsCount ?? 0);

  const scores = computeContentScores({
    publishedAt: capsule.created_at || new Date().toISOString(),
    viewsCount,
    likesCount,
    commentsCount,
    sharesCount,
    savesCount,
    hidesCount,
    reportsCount,
    videoCompletionsCount,
    hasRichMedia: capsule.type !== 'texte'
  });

  return {
    contentId: capsule.id,
    contentKind: 'capsule',
    contentType: capsule.type,
    authorId: capsule.auteur_id,
    circleId: capsule.circle_id || 'public',
    categories,
    topics,
    publishedAt: capsule.created_at || new Date().toISOString(),
    viewsCount,
    likesCount,
    commentsCount,
    sharesCount,
    savesCount,
    hidesCount,
    reportsCount,
    videoCompletionsCount,
    ...scores,
    updatedAt: new Date().toISOString()
  };
}

export function foldEventIntoContentSignal(
  current: ContentSignal | null,
  event: AlgorithmEvent
): ContentSignal {
  const nowIso = event.timestamp || new Date().toISOString();
  const meta = event.metadata || {};
  const metaTopics = inferTopicsFromEvent(event);

  const next: ContentSignal = current
    ? { ...current, categories: [...(current.categories || [])], topics: [...(current.topics || [])] }
    : {
        contentId: event.targetId,
        contentKind: event.targetType === 'capsule' ? 'capsule' : 'post',
        contentType: typeof meta.contentType === 'string' ? meta.contentType.slice(0, 32) : 'text',
        authorId:
          typeof meta.authorId === 'string' && isValidFirestoreDocId(meta.authorId, 128)
            ? meta.authorId
            : event.userId,
        circleId: typeof meta.circleId === 'string' ? meta.circleId.slice(0, 128) : 'public',
        categories: metaTopics.length > 0 ? metaTopics : ['societe'],
        topics: metaTopics,
        publishedAt: typeof meta.publishedAt === 'string' ? meta.publishedAt : nowIso,
        viewsCount: 0,
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        savesCount: 0,
        hidesCount: 0,
        reportsCount: 0,
        videoCompletionsCount: 0,
        qualityScore: 25,
        popularityScore: 0,
        decayScore: 1,
        updatedAt: nowIso
      };

  if (metaTopics.length > 0) {
    next.topics = Array.from(new Set([...(next.topics || []), ...metaTopics])).slice(0, 20);
    next.categories = Array.from(new Set([...next.categories, ...metaTopics])).slice(0, 15);
  }

  switch (event.eventType) {
    case 'post_view':
    case 'video_view':
      next.viewsCount = (next.viewsCount || 0) + 1;
      break;
    case 'post_like':
      next.likesCount = (next.likesCount || 0) + 1;
      break;
    case 'post_comment':
      next.commentsCount = (next.commentsCount || 0) + 1;
      break;
    case 'post_share':
      next.sharesCount = (next.sharesCount || 0) + 1;
      break;
    case 'post_save':
      next.savesCount = (next.savesCount || 0) + 1;
      break;
    case 'post_hide':
      next.hidesCount = (next.hidesCount || 0) + 1;
      break;
    case 'post_report':
      next.reportsCount = (next.reportsCount || 0) + 1;
      break;
    case 'video_completion':
      next.videoCompletionsCount = (next.videoCompletionsCount || 0) + 1;
      break;
    default:
      break;
  }

  const scores = computeContentScores({
    publishedAt: next.publishedAt,
    viewsCount: next.viewsCount || 0,
    likesCount: next.likesCount || 0,
    commentsCount: next.commentsCount || 0,
    sharesCount: next.sharesCount || 0,
    savesCount: next.savesCount || 0,
    hidesCount: next.hidesCount || 0,
    reportsCount: next.reportsCount || 0,
    videoCompletionsCount: next.videoCompletionsCount || 0,
    hasRichMedia: next.contentType !== 'text' && next.contentType !== 'texte'
  });

  next.qualityScore = scores.qualityScore;
  next.popularityScore = scores.popularityScore;
  next.decayScore = scores.decayScore;
  next.updatedAt = nowIso;

  return next;
}
