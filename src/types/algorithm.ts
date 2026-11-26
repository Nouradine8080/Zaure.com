export type AlgorithmEventType =
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

export type AlgorithmTargetType =
  | 'post'
  | 'capsule'
  | 'video'
  | 'profile'
  | 'circle'
  | 'group'
  | 'search';

export type InterestTopicId =
  | 'sante'
  | 'medecine'
  | 'technologie'
  | 'education'
  | 'science'
  | 'sport'
  | 'actualites'
  | 'culture'
  | 'entrepreneuriat'
  | 'agriculture'
  | 'langues'
  | 'societe';

export type AlgorithmMetadataValue = string | number | boolean | string[];

export type AlgorithmEventMetadata = Record<string, AlgorithmMetadataValue>;

export interface AlgorithmEvent {
  id: string;
  userId: string;
  eventType: AlgorithmEventType;
  targetId: string;
  targetType: AlgorithmTargetType;
  timestamp: string;
  metadata: AlgorithmEventMetadata;
}

export interface TrackEventInput {
  userId: string;
  eventType: AlgorithmEventType;
  targetId: string;
  targetType: AlgorithmTargetType;
  metadata?: AlgorithmEventMetadata;
  textSample?: string;
  timestamp?: string;
}

export interface UserInterestProfile {
  userId: string;
  interests: Record<string, number>;
  topTopics: string[];
  affinityAuthors?: Record<string, number>;
  affinityCircles?: Record<string, number>;
  decayVersion: number;
  totalSignals: number;
  updatedAt: string;
}

export interface ContentSignal {
  contentId: string;
  contentKind: 'post' | 'capsule';
  contentType: string;
  authorId: string;
  circleId?: string;
  categories: string[];
  topics?: string[];
  publishedAt: string;
  viewsCount?: number;
  likesCount?: number;
  commentsCount?: number;
  sharesCount?: number;
  savesCount?: number;
  hidesCount?: number;
  reportsCount?: number;
  videoCompletionsCount?: number;
  qualityScore: number;
  popularityScore: number;
  decayScore: number;
  updatedAt: string;
}

export interface AlgorithmUserStats {
  userId: string;
  totalEvents: number;
  viewsCount: number;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  savesCount: number;
  videoCompletionsCount?: number;
  searchesCount?: number;
  activeDays?: number;
  lastEventAt?: string;
  updatedAt: string;
}

export type FutureEngineName =
  | 'SmartFeedEngine'
  | 'RecommendationEngine'
  | 'ViralEngine'
  | 'DiscoveryEngine'
  | 'SocialGraphEngine';

export interface SmartEngineExtension {
  name: FutureEngineName;
  version: string;
  onEventsProcessed?: (events: AlgorithmEvent[], interests: UserInterestProfile) => void | Promise<void>;
  scoreItem?: (signal: ContentSignal, interests: UserInterestProfile) => number;
}

export interface AlgorithmEngineStatus {
  initialized: boolean;
  userId: string | null;
  pendingQueueSize: number;
  offlineQueueSize: number;
  registeredExtensions: FutureEngineName[];
  lastFlushAt: string | null;
  serverSyncAvailable: boolean | null;
}

export type FeedRankingMode = 'for_you' | 'following';

export interface FeedCandidateMeta {
  id: string;
  kind: 'post' | 'capsule';
  authorId: string;
  circleId: string;
  createdAt: string;
  isPinned?: boolean;
  authorRole?: string;
  authorCreatedAt?: string;
}

export interface SmartFeedScoreWeights {
  interestMax: number;
  socialFollowingBoost: number;
  socialAffinityMax: number;
  circleMembershipBoost: number;
  circleAffinityMax: number;
  qualityMax: number;
  popularityMax: number;
  freshnessMax: number;
  creatorDiscoveryMax: number;
  adjacentDiscoveryMax: number;
  seenFatiguePenalty: number;
  hiddenOrReportedPenalty: number;
  authorRepeatWindowPenalty: number;
  topicRepeatWindowPenalty: number;
}

export interface SmartFeedScoreBreakdown {
  interestScore: number;
  socialScore: number;
  circleScore: number;
  qualityScore: number;
  popularityScore: number;
  freshnessScore: number;
  creatorDiscoveryBoost: number;
  adjacentDiscoveryScore: number;
  negativePenalty: number;
  diversityPenalty: number;
  totalScore: number;
  matchedTopics: string[];
  reasonCode:
    | 'interest_match'
    | 'followed_author'
    | 'joined_circle'
    | 'fresh_creator'
    | 'adjacent_discovery'
    | 'trending_quality'
    | 'following_stream'
    | 'chronological_fallback';
}

export interface RankedFeedEntry<T> {
  item: T;
  meta: FeedCandidateMeta;
  score: number;
  breakdown: SmartFeedScoreBreakdown;
}

export interface SmartFeedResult<T> {
  items: RankedFeedEntry<T>[];
  mode: FeedRankingMode;
  usedFallback: boolean;
  fallbackReason?: string;
  computedAt: string;
  fromCache: boolean;
  totalCandidates: number;
}

export interface SmartFeedCachePayload {
  userId: string;
  mode: FeedRankingMode;
  orderedKeys: string[];
  reasonByKey: Record<string, SmartFeedScoreBreakdown['reasonCode']>;
  scoreByKey: Record<string, number>;
  contextDigest?: string;
  computedAt: string;
}
