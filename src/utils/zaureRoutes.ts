export type MainAppTab =
  | 'feed'
  | 'communities'
  | 'chat'
  | 'notifications'
  | 'settings'
  | 'profile';

export type FeedSection = 'feed' | 'circles' | 'mentors' | 'bookmarks';

export type SettingsRouteCategory =
  | 'compte'
  | 'securite'
  | 'confidentialite'
  | 'notifications'
  | 'apparence'
  | 'langue'
  | 'accessibilite'
  | 'bloques'
  | 'aide'
  | 'apropos';

export type ProfileRouteTab =
  | 'publications'
  | 'about'
  | 'photos'
  | 'videos'
  | 'communities';

const VALID_SETTINGS_CATEGORIES = new Set<SettingsRouteCategory>([
  'compte',
  'securite',
  'confidentialite',
  'notifications',
  'apparence',
  'langue',
  'accessibilite',
  'bloques',
  'aide',
  'apropos'
]);

const VALID_PROFILE_TABS = new Set<ProfileRouteTab>([
  'publications',
  'about',
  'photos',
  'videos',
  'communities'
]);

export interface ParsedZaureRoute {
  kind:
    | 'admin'
    | 'auth'
    | 'registration'
    | 'reset_password'
    | 'feed'
    | 'circles'
    | 'circle_detail'
    | 'mentors'
    | 'bookmarks'
    | 'communities'
    | 'community_detail'
    | 'messages'
    | 'message_detail'
    | 'notifications'
    | 'settings'
    | 'profile'
    | 'not_found';
  activeTab: MainAppTab;
  feedSection: FeedSection;
  circleId: string;
  groupId: string | null;
  inviteCode: string | null;
  conversationId: string | null;
  settingsCategory: SettingsRouteCategory;
  profileIdentifier: string | null;
  profileTab: ProfileRouteTab;
}

function decodeSegment(segment: string | undefined): string {
  if (!segment) return '';
  try {
    return decodeURIComponent(segment).trim();
  } catch {
    return segment.trim();
  }
}

export function isValidSettingsCategory(val?: string | null): val is SettingsRouteCategory {
  return Boolean(val && VALID_SETTINGS_CATEGORIES.has(val as SettingsRouteCategory));
}

export function isValidProfileTab(val?: string | null): val is ProfileRouteTab {
  return Boolean(val && VALID_PROFILE_TABS.has(val as ProfileRouteTab));
}

export function parseZaureRoute(pathname: string, search = ''): ParsedZaureRoute {
  const rawPath = (pathname || '/').replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(search || '');

  const queryMode = params.get('mode')?.trim() || '';
  const queryOobCode = params.get('oobCode')?.trim() || '';
  const queryCommunity = params.get('community')?.trim() || null;
  const queryInvite = params.get('invite')?.trim() || null;
  const queryProfile = params.get('profile')?.trim() || null;
  const queryNotif = params.get('notifications');
  const queryCircle = params.get('circle')?.trim() || null;
  const queryTab = params.get('tab');

  const base: ParsedZaureRoute = {
    kind: 'feed',
    activeTab: 'feed',
    feedSection: 'feed',
    circleId: 'all',
    groupId: null,
    inviteCode: queryInvite,
    conversationId: null,
    settingsCategory: 'compte',
    profileIdentifier: null,
    profileTab: isValidProfileTab(queryTab) ? queryTab : 'publications'
  };

  if (rawPath === '/admin' || rawPath.startsWith('/admin/')) {
    return { ...base, kind: 'admin' };
  }

  if (
    rawPath === '/reset-password' ||
    rawPath === '/reinitialiser-mot-de-passe' ||
    (rawPath === '/__/auth/action' && (queryMode === 'resetPassword' || Boolean(queryOobCode))) ||
    (queryMode === 'resetPassword' && Boolean(queryOobCode))
  ) {
    return { ...base, kind: 'reset_password' };
  }

  if (rawPath === '/inscription' || rawPath.startsWith('/inscription/')) {
    return { ...base, kind: 'registration' };
  }

  if (rawPath === '/connexion' || rawPath === '/login') {
    return { ...base, kind: 'auth' };
  }

  // Backward-compatible query-string deep links on root `/`
  if (rawPath === '/' || rawPath === '/feed') {
    if (queryCommunity || queryInvite) {
      return {
        ...base,
        kind: queryCommunity ? 'community_detail' : 'communities',
        activeTab: 'communities',
        groupId: queryCommunity
      };
    }
    if (queryProfile) {
      return {
        ...base,
        kind: 'profile',
        activeTab: 'profile',
        profileIdentifier: queryProfile
      };
    }
    if (queryNotif) {
      return {
        ...base,
        kind: 'notifications',
        activeTab: 'notifications'
      };
    }
    if (queryCircle) {
      return {
        ...base,
        kind: 'circle_detail',
        activeTab: 'feed',
        feedSection: 'feed',
        circleId: queryCircle
      };
    }
    return {
      ...base,
      kind: 'feed',
      activeTab: 'feed',
      feedSection: 'feed'
    };
  }

  if (rawPath === '/discover' || rawPath === '/circles') {
    return {
      ...base,
      kind: 'circles',
      activeTab: 'feed',
      feedSection: 'circles'
    };
  }

  if (rawPath.startsWith('/circles/') || rawPath.startsWith('/circle/')) {
    const seg = decodeSegment(rawPath.split('/')[2]);
    if (seg) {
      return {
        ...base,
        kind: 'circle_detail',
        activeTab: 'feed',
        feedSection: 'feed',
        circleId: seg
      };
    }
    return { ...base, kind: 'circles', activeTab: 'feed', feedSection: 'circles' };
  }

  if (rawPath === '/mentors') {
    return {
      ...base,
      kind: 'mentors',
      activeTab: 'feed',
      feedSection: 'mentors'
    };
  }

  if (rawPath === '/bookmarks') {
    return {
      ...base,
      kind: 'bookmarks',
      activeTab: 'feed',
      feedSection: 'bookmarks'
    };
  }

  if (rawPath === '/communities') {
    return {
      ...base,
      kind: queryCommunity ? 'community_detail' : 'communities',
      activeTab: 'communities',
      groupId: queryCommunity
    };
  }

  if (rawPath.startsWith('/communities/')) {
    const seg = decodeSegment(rawPath.split('/')[2]);
    return {
      ...base,
      kind: seg ? 'community_detail' : 'communities',
      activeTab: 'communities',
      groupId: seg || null
    };
  }

  if (rawPath === '/messages') {
    return {
      ...base,
      kind: 'messages',
      activeTab: 'chat',
      conversationId: null
    };
  }

  if (rawPath.startsWith('/messages/')) {
    const seg = decodeSegment(rawPath.split('/')[2]);
    return {
      ...base,
      kind: seg ? 'message_detail' : 'messages',
      activeTab: 'chat',
      conversationId: seg || null
    };
  }

  if (rawPath === '/notifications') {
    return {
      ...base,
      kind: 'notifications',
      activeTab: 'notifications'
    };
  }

  if (rawPath === '/settings') {
    return {
      ...base,
      kind: 'settings',
      activeTab: 'settings',
      settingsCategory: 'compte'
    };
  }

  if (rawPath.startsWith('/settings/')) {
    const seg = decodeSegment(rawPath.split('/')[2]);
    return {
      ...base,
      kind: 'settings',
      activeTab: 'settings',
      settingsCategory: isValidSettingsCategory(seg) ? seg : 'compte'
    };
  }

  if (rawPath === '/profile') {
    return {
      ...base,
      kind: 'profile',
      activeTab: 'profile',
      profileIdentifier: queryProfile
    };
  }

  if (rawPath.startsWith('/profile/')) {
    const seg = decodeSegment(rawPath.split('/')[2]);
    return {
      ...base,
      kind: 'profile',
      activeTab: 'profile',
      profileIdentifier: seg || null
    };
  }

  return {
    ...base,
    kind: 'not_found'
  };
}

export function buildProfilePath(identifier: string, tab?: ProfileRouteTab): string {
  const clean = encodeURIComponent(identifier.replace(/^@+/, '').trim());
  const base = clean ? `/profile/${clean}` : '/profile';
  if (tab && tab !== 'publications') {
    return `${base}?tab=${encodeURIComponent(tab)}`;
  }
  return base;
}
