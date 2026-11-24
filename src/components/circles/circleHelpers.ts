import { Circle, CircleVisibility } from '../../types';

export type CircleSortOption = 'populaires' | 'recents' | 'actifs' | 'recommandes';
export type CircleMembershipStatus = 'member' | 'pending' | 'private' | 'public';

export const PRIMARY_CIRCLE_CATEGORIES = [
  'Tous',
  'Mes cercles',
  'Santé',
  'Éducation',
  'Technologie',
  'Actualités'
] as const;

export const EXTRA_CIRCLE_CATEGORIES = [
  'Sciences',
  'Langues',
  'Culture',
  'Agriculture',
  'Entrepreneuriat',
  'Football & Sport'
] as const;

export const ALL_CREATE_CIRCLE_CATEGORIES = [
  'Santé',
  'Éducation',
  'Technologie',
  'Actualités',
  'Sciences',
  'Langues',
  'Culture',
  'Agriculture',
  'Entrepreneuriat',
  'Football & Sport'
] as const;

/**
 * Normalizes legacy and modern category labels so existing circles
 * match the modernized filter chips accurately.
 */
export function circleMatchesCategory(circle: Circle, selectedCategory: string): boolean {
  if (!selectedCategory || selectedCategory === 'all' || selectedCategory === 'Tous') {
    return true;
  }

  const cat = (circle.categorie || '').toLowerCase().trim();
  const target = selectedCategory.toLowerCase().trim();

  if (cat === target || cat.includes(target)) {
    return true;
  }

  if (target === 'santé' || target === 'sante') {
    return cat.includes('médecine') || cat.includes('medecine') || cat.includes('sant');
  }
  if (target === 'éducation' || target === 'education') {
    return (
      cat.includes('éducat') ||
      cat.includes('educat') ||
      cat.includes('étude') ||
      cat.includes('etude') ||
      cat.includes('réussite') ||
      cat.includes('langue') ||
      cat.includes('culture')
    );
  }
  if (target === 'technologie') {
    return (
      cat.includes('tech') ||
      cat.includes('digital') ||
      cat.includes('ia') ||
      cat.includes('science') ||
      cat.includes('informatique')
    );
  }
  if (target === 'actualités' || target === 'actualites') {
    return cat.includes('actual') || cat.includes('info') || cat.includes('monde');
  }

  return false;
}

export function getCircleMemberCount(
  circle: Circle,
  liveCounts?: Record<string, number>
): number {
  const live = liveCounts && typeof liveCounts[circle.id] === 'number' ? liveCounts[circle.id] : undefined;
  const stored = typeof circle.member_count === 'number' ? circle.member_count : undefined;
  if (live !== undefined) return Math.max(live, stored ?? 0, 1);
  if (stored !== undefined) return Math.max(stored, 1);
  return 1;
}

export function formatCircleMemberCount(count: number): string {
  const safe = Math.max(0, Math.floor(count));
  if (safe >= 1000) {
    const formatted = (safe / 1000).toFixed(1).replace(/\.0$/, '');
    return `${formatted}K membres`;
  }
  return `${safe} ${safe <= 1 ? 'membre' : 'membres'}`;
}

export function getCircleMembershipStatus(
  circle: Circle,
  joinedCircleIds: string[],
  pendingRequestCircleIds: string[]
): CircleMembershipStatus {
  if (joinedCircleIds.includes(circle.id)) return 'member';
  if (pendingRequestCircleIds.includes(circle.id)) return 'pending';
  const visibility: CircleVisibility = circle.visibility || 'public';
  return visibility === 'private' ? 'private' : 'public';
}

export function getCircleActivityTimestamp(
  circle: Circle,
  capsuleCountByCircle?: Record<string, number>,
  latestCapsuleAtByCircle?: Record<string, string>
): number {
  const candidates = [
    latestCapsuleAtByCircle?.[circle.id],
    circle.last_activity_at,
    circle.updated_at,
    circle.created_at
  ];
  let maxMs = 0;
  for (const iso of candidates) {
    if (!iso) continue;
    const ms = new Date(iso).getTime();
    if (!Number.isNaN(ms) && ms > maxMs) {
      maxMs = ms;
    }
  }
  return maxMs;
}

export function formatCircleRelativeActivity(isoOrMs?: string | number): string {
  if (!isoOrMs) return 'Actif récemment';
  const ms = typeof isoOrMs === 'number' ? isoOrMs : new Date(isoOrMs).getTime();
  if (Number.isNaN(ms) || ms <= 0) return 'Actif récemment';

  const diffMins = Math.floor((Date.now() - ms) / 60000);
  if (diffMins < 2) return 'Actif à l’instant';
  if (diffMins < 60) return `Actif il y a ${diffMins} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Actif il y a ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Actif hier';
  if (diffDays < 30) return `Actif il y a ${diffDays} j`;
  return `Actif le ${new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
}

export interface FilterAndSortCirclesParams {
  circles: Circle[];
  categoryFilter: string;
  searchQuery: string;
  sortBy: CircleSortOption;
  joinedCircleIds: string[];
  memberCounts?: Record<string, number>;
  capsuleCountByCircle?: Record<string, number>;
  latestCapsuleAtByCircle?: Record<string, string>;
  userProfessionOrBio?: string;
}

export function filterAndSortCircles({
  circles,
  categoryFilter,
  searchQuery,
  sortBy,
  joinedCircleIds,
  memberCounts,
  capsuleCountByCircle,
  latestCapsuleAtByCircle,
  userProfessionOrBio
}: FilterAndSortCirclesParams): Circle[] {
  let list = [...circles];

  if (categoryFilter === 'Mes cercles') {
    list = list.filter((c) => joinedCircleIds.includes(c.id));
  } else if (categoryFilter && categoryFilter !== 'all' && categoryFilter !== 'Tous') {
    list = list.filter((c) => circleMatchesCategory(c, categoryFilter));
  }

  const trimmedQuery = searchQuery.trim().toLowerCase();
  if (trimmedQuery) {
    list = list.filter(
      (c) =>
        (c.nom || '').toLowerCase().includes(trimmedQuery) ||
        (c.description || '').toLowerCase().includes(trimmedQuery) ||
        (c.categorie || '').toLowerCase().includes(trimmedQuery)
    );
  }

  const hintWords = (userProfessionOrBio || '')
    .toLowerCase()
    .split(/[^a-zà-ÿ0-9]+/i)
    .filter((w) => w.length >= 4);

  list.sort((a, b) => {
    if (sortBy === 'recents') {
      const aTime = new Date(a.created_at || 0).getTime() || 0;
      const bTime = new Date(b.created_at || 0).getTime() || 0;
      return bTime - aTime;
    }

    if (sortBy === 'actifs') {
      const aCaps = capsuleCountByCircle?.[a.id] || 0;
      const bCaps = capsuleCountByCircle?.[b.id] || 0;
      const aAct = getCircleActivityTimestamp(a, capsuleCountByCircle, latestCapsuleAtByCircle);
      const bAct = getCircleActivityTimestamp(b, capsuleCountByCircle, latestCapsuleAtByCircle);
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      const aScore = aAct + aCaps * SEVEN_DAYS_MS;
      const bScore = bAct + bCaps * SEVEN_DAYS_MS;
      return bScore - aScore;
    }

    if (sortBy === 'recommandes') {
      const scoreCircle = (c: Circle): number => {
        let score = 0;
        if (!joinedCircleIds.includes(c.id)) score += 50; // favor discovery
        if ((c.visibility || 'public') === 'public') score += 20;
        const text = `${c.nom} ${c.description} ${c.categorie}`.toLowerCase();
        hintWords.forEach((word) => {
          if (text.includes(word)) score += 25;
        });
        score += Math.min(20, getCircleMemberCount(c, memberCounts));
        score += Math.min(20, (capsuleCountByCircle?.[c.id] || 0) * 2);
        return score;
      };
      const diff = scoreCircle(b) - scoreCircle(a);
      if (diff !== 0) return diff;
    }

    // Default: 'populaires'
    const aMembers = getCircleMemberCount(a, memberCounts);
    const bMembers = getCircleMemberCount(b, memberCounts);
    if (bMembers !== aMembers) return bMembers - aMembers;

    const aCaps = capsuleCountByCircle?.[a.id] || 0;
    const bCaps = capsuleCountByCircle?.[b.id] || 0;
    if (bCaps !== aCaps) return bCaps - aCaps;

    return a.nom.localeCompare(b.nom);
  });

  return list;
}
