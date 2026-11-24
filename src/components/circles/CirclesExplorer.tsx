import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  UsersRound,
  Plus,
  LayoutGrid,
  User,
  Heart,
  GraduationCap,
  Cpu,
  Newspaper,
  ChevronDown,
  Search,
  X,
  Compass,
  Check
} from 'lucide-react';
import {
  Capsule,
  Circle,
  CirclePostPermission,
  CircleVisibility,
  UserProfile
} from '../../types';
import CircleCard from '../CircleCard';
import {
  CircleSortOption,
  EXTRA_CIRCLE_CATEGORIES,
  filterAndSortCircles,
  PRIMARY_CIRCLE_CATEGORIES
} from './circleHelpers';
import { ZAURE_GLOWS, ZAURE_ICON_CHIPS, ZAURE_SURFACES } from '../../styles/designSystem';
import ZaureGeometricBackdrop from '../ui/ZaureGeometricBackdrop';

interface CirclesExplorerProps {
  circles: Circle[];
  circlesLoaded: boolean;
  capsules: Capsule[];
  joinedCircleIds: string[];
  pendingRequestCircleIds: string[];
  memberCounts: Record<string, number>;
  currentUser: UserProfile | null;
  categoryFilter: string;
  onCategoryFilterChange: (cat: string) => void;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onOpenCreateCircle: () => void;
  onToggleJoinCircle: (circleId: string) => Promise<void> | void;
  onSelectCircle: (circleId: string) => void;
  onUpdateCircle: (
    circleId: string,
    updates: {
      nom: string;
      description: string;
      categorie: string;
      image: string;
      cover_image?: string;
      visibility?: CircleVisibility;
      post_permission?: CirclePostPermission;
      rules?: string[];
    }
  ) => Promise<void>;
  onDeleteCircle: (circleId: string) => Promise<void>;
}

const SORT_OPTIONS: { value: CircleSortOption; label: string }[] = [
  { value: 'populaires', label: 'Populaires' },
  { value: 'recents', label: 'Récents' },
  { value: 'actifs', label: 'Les plus actifs' },
  { value: 'recommandes', label: 'Recommandés' }
];

export default function CirclesExplorer({
  circles,
  circlesLoaded,
  capsules,
  joinedCircleIds,
  pendingRequestCircleIds,
  memberCounts,
  currentUser,
  categoryFilter,
  onCategoryFilterChange,
  searchQuery,
  onSearchQueryChange,
  onOpenCreateCircle,
  onToggleJoinCircle,
  onSelectCircle,
  onUpdateCircle,
  onDeleteCircle
}: CirclesExplorerProps) {
  const [sortBy, setSortBy] = useState<CircleSortOption>('populaires');
  const [showMoreCategories, setShowMoreCategories] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const moreMenuRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeMenus = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreCategories(false);
      }
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortDropdown(false);
      }
    };
    document.addEventListener('mousedown', closeMenus);
    return () => document.removeEventListener('mousedown', closeMenus);
  }, []);

  const normalizedFilter = categoryFilter === 'all' ? 'Tous' : categoryFilter;

  const extraCategories = useMemo(() => {
    const set = new Set<string>(EXTRA_CIRCLE_CATEGORIES);
    circles.forEach((c) => {
      const cat = (c.categorie || '').trim();
      if (
        cat &&
        !PRIMARY_CIRCLE_CATEGORIES.some((p) => p.toLowerCase() === cat.toLowerCase())
      ) {
        set.add(cat);
      }
    });
    return Array.from(set);
  }, [circles]);

  const isExtraCategorySelected = extraCategories.some(
    (c) => c.toLowerCase() === normalizedFilter.toLowerCase()
  );

  const { capsuleCountByCircle, latestCapsuleAtByCircle } = useMemo(() => {
    const counts: Record<string, number> = {};
    const latest: Record<string, string> = {};
    capsules.forEach((cap) => {
      const cid = cap.circle_id || (cap as any).circleId;
      if (!cid || cid === 'public') return;
      counts[cid] = (counts[cid] || 0) + 1;
      if (!latest[cid] || (cap.created_at || '') > latest[cid]) {
        latest[cid] = cap.created_at || '';
      }
    });
    return { capsuleCountByCircle: counts, latestCapsuleAtByCircle: latest };
  }, [capsules]);

  const displayedCircles = useMemo(() => {
    const userHint = [currentUser?.profession, currentUser?.formation, currentUser?.bio]
      .filter(Boolean)
      .join(' ');
    return filterAndSortCircles({
      circles,
      categoryFilter: normalizedFilter,
      searchQuery,
      sortBy,
      joinedCircleIds,
      memberCounts,
      capsuleCountByCircle,
      latestCapsuleAtByCircle,
      userProfessionOrBio: userHint
    });
  }, [
    circles,
    normalizedFilter,
    searchQuery,
    sortBy,
    joinedCircleIds,
    memberCounts,
    capsuleCountByCircle,
    latestCapsuleAtByCircle,
    currentUser?.profession,
    currentUser?.formation,
    currentUser?.bio
  ]);

  const renderCategoryIcon = (cat: string, active: boolean) => {
    switch (cat) {
      case 'Tous':
        return <LayoutGrid className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-[#2563EB]'}`} />;
      case 'Mes cercles':
        return <User className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-[#2563EB]'}`} />;
      case 'Santé':
        return <Heart className={`w-3.5 h-3.5 ${active ? 'text-white fill-white' : 'text-rose-500 fill-rose-500'}`} />;
      case 'Éducation':
        return <GraduationCap className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`} />;
      case 'Technologie':
        return <Cpu className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-[#2563EB]'}`} />;
      case 'Actualités':
        return <Newspaper className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-[#2563EB]'}`} />;
      default:
        return null;
    }
  };

  const activeSortLabel = SORT_OPTIONS.find((s) => s.value === sortBy)?.label || 'Populaires';

  return (
    <div className="space-y-4 zaure-animate-fade-in pb-6" id="circles-explorer-view">
      {/* 1. HERO BANNER (Global ZAURE Hero Gradient & Shadow) */}
      <section className={`${ZAURE_SURFACES.heroBanner} px-4 py-4 sm:px-7 sm:py-6`}>
        <ZaureGeometricBackdrop variant="hero" />

        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-white/15 backdrop-blur-xs border border-white/20 flex items-center justify-center shrink-0 zaure-shadow-xs">
              <UsersRound className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Cercles
              </h1>
              <p className="text-[11.5px] sm:text-sm text-blue-50/95 font-medium mt-0.5 line-clamp-2">
                Rejoignez, échangez et grandissez ensemble !
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenCreateCircle}
            id="btn-create-circle-hero"
            className="min-h-[38px] sm:min-h-[44px] px-3.5 sm:px-5 py-2 rounded-full bg-white hover:bg-blue-50 text-[#1D4ED8] font-bold text-xs sm:text-[13px] shadow-md zaure-btn-press zaure-focus-ring flex items-center gap-1.5 shrink-0"
          >
            <span className="sm:hidden">Créer</span>
            <span className="hidden sm:inline">Créer un cercle</span>
            <Plus className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </section>

      {/* 2. HORIZONTAL CATEGORY CHIPS + "PLUS" DROPDOWN */}
      <div className="relative flex items-center gap-2">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5 flex-1 min-w-0">
          {PRIMARY_CIRCLE_CATEGORIES.map((cat) => {
            const isActive = normalizedFilter.toLowerCase() === cat.toLowerCase();
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  onCategoryFilterChange(cat === 'Tous' ? 'all' : cat);
                  setShowMoreCategories(false);
                }}
                className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-xs sm:text-[13px] font-semibold transition flex items-center gap-1.5 shrink-0 ${
                  isActive
                    ? `zaure-grad-primary text-white ${ZAURE_GLOWS.blue}`
                    : 'bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-blue-300 dark:hover:border-blue-700'
                }`}
              >
                {renderCategoryIcon(cat, isActive)}
                <span>{cat}</span>
                {cat === 'Mes cercles' && joinedCircleIds.length > 0 && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full tabular-nums ${
                      isActive ? 'bg-white/20 text-white' : 'bg-blue-50 dark:bg-blue-950 text-[#2563EB] dark:text-blue-300'
                    }`}
                  >
                    {joinedCircleIds.length}
                  </span>
                )}
              </button>
            );
          })}

          {/* Plus v dropdown trigger inside scrollable bar or anchored */}
          <div ref={moreMenuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowMoreCategories((prev) => !prev)}
              aria-expanded={showMoreCategories}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-xs sm:text-[13px] font-semibold transition flex items-center gap-1 shrink-0 ${
                isExtraCategorySelected
                  ? `zaure-grad-primary text-white ${ZAURE_GLOWS.blue}`
                  : 'bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-blue-300'
              }`}
            >
              <span>{isExtraCategorySelected ? normalizedFilter : 'Plus'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showMoreCategories ? 'rotate-180' : ''}`} />
            </button>

            {showMoreCategories && (
              <div className={`fixed sm:absolute right-4 sm:right-0 mt-2 w-56 z-40 p-1.5 space-y-0.5 ${ZAURE_SURFACES.popoverMenu}`}>
                <p className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Autres thématiques
                </p>
                {extraCategories.map((cat) => {
                  const selected = normalizedFilter.toLowerCase() === cat.toLowerCase();
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        onCategoryFilterChange(cat);
                        setShowMoreCategories(false);
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition ${
                        selected
                          ? 'bg-blue-50 dark:bg-blue-950/60 text-[#2563EB] dark:text-blue-300 font-bold'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="truncate">{cat}</span>
                      {selected && <Check className="w-3.5 h-3.5 text-[#2563EB]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. SEARCH BAR + COMPLEMENTARY SORT DROPDOWN */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Rechercher un cercle..."
            aria-label="Rechercher un cercle"
            className="w-full min-h-[42px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 focus:border-[#2563EB] focus:ring-2 focus:ring-blue-500/20 rounded-full pl-10 pr-9 py-2 text-xs sm:text-[13px] text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none zaure-shadow-xs transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchQueryChange('')}
              aria-label="Effacer la recherche"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sort selector */}
        <div ref={sortMenuRef} className="relative shrink-0 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setShowSortDropdown((prev) => !prev)}
            aria-expanded={showSortDropdown}
            className="min-h-[42px] px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-blue-300 rounded-full text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 shadow-2xs transition"
          >
            <span className="text-slate-400 dark:text-slate-500">Trier par :</span>
            <span className="font-bold text-slate-900 dark:text-white">{activeSortLabel}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${showSortDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showSortDropdown && (
            <div className={`absolute right-0 mt-1.5 w-52 z-40 p-1.5 space-y-0.5 ${ZAURE_SURFACES.popoverMenu}`}>
              {SORT_OPTIONS.map((opt) => {
                const selected = sortBy === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setSortBy(opt.value);
                      setShowSortDropdown(false);
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition ${
                      selected
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-[#2563EB] dark:text-blue-300 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {selected && <Check className="w-3.5 h-3.5 text-[#2563EB]" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 4. CIRCLES LIST / GRID */}
      {!circlesLoaded ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="zaure-card rounded-2xl p-4 space-y-3"
            >
              <div className="flex sm:flex-col items-center gap-3">
                <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full zaure-animate-shimmer shrink-0" />
                <div className="flex-1 sm:w-full space-y-2">
                  <div className="h-4 zaure-animate-shimmer rounded-lg w-3/4 sm:mx-auto" />
                  <div className="h-3 zaure-animate-shimmer rounded-lg w-full" />
                </div>
              </div>
              <div className="hidden sm:flex justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="h-3 zaure-animate-shimmer rounded w-20" />
                <div className="h-7 zaure-animate-shimmer rounded-full w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : displayedCircles.length === 0 ? (
        <div className="zaure-card rounded-3xl p-8 text-center space-y-3 zaure-animate-fade-in">
          <div className={`w-14 h-14 rounded-2xl ${ZAURE_ICON_CHIPS.blue} ${ZAURE_GLOWS.soft} flex items-center justify-center mx-auto`}>
            <Compass className="w-7 h-7" />
          </div>
          <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
            {normalizedFilter === 'Mes cercles'
              ? "Vous n'avez pas encore rejoint de cercle"
              : 'Aucun cercle trouvé'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            {normalizedFilter === 'Mes cercles'
              ? 'Explorez les thématiques disponibles et rejoignez les cercles qui correspondent à vos centres d’intérêt.'
              : 'Essayez une autre recherche, réinitialisez les filtres ou créez un nouveau cercle autour de votre sujet.'}
          </p>
          <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
            {(normalizedFilter !== 'Tous' || searchQuery.trim() !== '') && (
              <button
                type="button"
                onClick={() => {
                  onCategoryFilterChange('all');
                  onSearchQueryChange('');
                }}
                className="min-h-[38px] px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Voir tous les cercles
              </button>
            )}
            <button
              type="button"
              onClick={onOpenCreateCircle}
              className={`min-h-[38px] px-4 py-2 ${ZAURE_SURFACES.primaryButton} text-xs`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Créer un cercle</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {displayedCircles.map((circle) => (
            <CircleCard
              key={circle.id}
              circle={circle}
              isJoined={joinedCircleIds.includes(circle.id)}
              isPending={pendingRequestCircleIds.includes(circle.id)}
              memberCounts={memberCounts}
              capsuleCount={capsuleCountByCircle[circle.id] || 0}
              latestCapsuleAt={latestCapsuleAtByCircle[circle.id]}
              currentUser={currentUser}
              onToggleJoin={() => onToggleJoinCircle(circle.id)}
              onSelect={() => onSelectCircle(circle.id)}
              onUpdateCircle={onUpdateCircle}
              onDeleteCircle={onDeleteCircle}
              isActive={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}
