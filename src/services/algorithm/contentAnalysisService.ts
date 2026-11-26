import { doc, getDoc } from 'firebase/firestore';
import { auth, dbFirestore } from '../../firebaseClient';
import type { Capsule, Circle, CommunityGroup, GroupPost } from '../../types';
import type { AlgorithmEvent, ContentSignal } from '../../types/algorithm';
import {
  analyzeCapsuleContent,
  analyzeGroupPostContent,
  computeContentScores,
  foldEventIntoContentSignal
} from './algorithmConfig';

class ContentAnalysisServiceImpl {
  private signalCache = new Map<string, ContentSignal>();
  private fetchedAt = new Map<string, number>();

  /**
   * Extracts categories, hashtags, quality score, popularity score & decay score
   * from an existing ZAURE GroupPost without modifying publishing flows.
   */
  analyzePost(
    post: GroupPost,
    context?: {
      group?: CommunityGroup | null;
      viewsCount?: number;
      hidesCount?: number;
      reportsCount?: number;
      videoCompletionsCount?: number;
    }
  ): ContentSignal {
    const existing = this.signalCache.get(post.id);
    const signal = analyzeGroupPostContent(post, {
      categoryHint: context?.group?.id !== 'public' ? context?.group?.category : undefined,
      viewsCount: context?.viewsCount ?? existing?.viewsCount ?? 0,
      hidesCount: context?.hidesCount ?? existing?.hidesCount ?? 0,
      reportsCount: context?.reportsCount ?? existing?.reportsCount ?? 0,
      videoCompletionsCount:
        context?.videoCompletionsCount ?? existing?.videoCompletionsCount ?? 0
    });
    this.signalCache.set(post.id, signal);
    return signal;
  }

  /**
   * Extracts categories, hashtags, quality score, popularity score & decay score
   * from an existing ZAURE Capsule without modifying publishing flows.
   */
  analyzeCapsule(
    capsule: Capsule,
    context?: {
      circle?: Circle | null;
      likesCount?: number;
      commentsCount?: number;
      viewsCount?: number;
      sharesCount?: number;
      savesCount?: number;
      hidesCount?: number;
      reportsCount?: number;
      videoCompletionsCount?: number;
    }
  ): ContentSignal {
    const existing = this.signalCache.get(capsule.id);
    const signal = analyzeCapsuleContent(capsule, {
      categoryHint: context?.circle?.categorie || capsule.circle_nom,
      likesCount: context?.likesCount ?? existing?.likesCount ?? 0,
      commentsCount: context?.commentsCount ?? existing?.commentsCount ?? 0,
      viewsCount: context?.viewsCount ?? existing?.viewsCount ?? 0,
      sharesCount: context?.sharesCount ?? existing?.sharesCount ?? 0,
      savesCount: context?.savesCount ?? existing?.savesCount ?? 0,
      hidesCount: context?.hidesCount ?? existing?.hidesCount ?? 0,
      reportsCount: context?.reportsCount ?? existing?.reportsCount ?? 0,
      videoCompletionsCount:
        context?.videoCompletionsCount ?? existing?.videoCompletionsCount ?? 0
    });
    this.signalCache.set(capsule.id, signal);
    return signal;
  }

  applyEventToContentSignal(event: AlgorithmEvent): ContentSignal | null {
    if (event.targetType !== 'post' && event.targetType !== 'capsule' && event.targetType !== 'video') {
      return null;
    }
    const existing = this.signalCache.get(event.targetId) || null;
    const updated = foldEventIntoContentSignal(existing, event);
    this.signalCache.set(event.targetId, updated);
    return updated;
  }

  refreshDecay(signal: ContentSignal, nowMs = Date.now()): ContentSignal {
    const scores = computeContentScores({
      publishedAt: signal.publishedAt,
      viewsCount: signal.viewsCount || 0,
      likesCount: signal.likesCount || 0,
      commentsCount: signal.commentsCount || 0,
      sharesCount: signal.sharesCount || 0,
      savesCount: signal.savesCount || 0,
      hidesCount: signal.hidesCount || 0,
      reportsCount: signal.reportsCount || 0,
      videoCompletionsCount: signal.videoCompletionsCount || 0,
      hasRichMedia: signal.contentType !== 'text' && signal.contentType !== 'texte',
      nowMs
    });
    const next = { ...signal, ...scores };
    this.signalCache.set(signal.contentId, next);
    return next;
  }

  async getContentSignal(contentId: string, forceRefresh = false): Promise<ContentSignal | null> {
    const cached = this.signalCache.get(contentId) || null;
    const last = this.fetchedAt.get(contentId) || 0;
    if (cached && !forceRefresh && Date.now() - last < 60_000) {
      return this.refreshDecay(cached);
    }

    if (dbFirestore && auth?.currentUser) {
      try {
        const snap = await getDoc(doc(dbFirestore, 'content_signals', contentId));
        this.fetchedAt.set(contentId, Date.now());
        if (snap.exists()) {
          const remote = snap.data() as ContentSignal;
          this.signalCache.set(contentId, remote);
          return this.refreshDecay(remote);
        }
      } catch {
        // Fallback cleanly to local analysis cache
      }
    }

    return cached ? this.refreshDecay(cached) : null;
  }

  getCachedSignal(contentId: string): ContentSignal | undefined {
    return this.signalCache.get(contentId);
  }

  getCachedSignals(): ContentSignal[] {
    return Array.from(this.signalCache.values());
  }

  clearCache(): void {
    this.signalCache.clear();
    this.fetchedAt.clear();
  }
}

export const contentAnalysisService = new ContentAnalysisServiceImpl();
