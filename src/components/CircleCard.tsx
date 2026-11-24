import React from 'react';
import { Users, Check, Lock, Clock, Sparkles } from 'lucide-react';
import { Circle, CirclePostPermission, CircleVisibility, UserProfile } from '../types';
import CircleOptionsMenu from './CircleOptionsMenu';
import {
  formatCircleMemberCount,
  formatCircleRelativeActivity,
  getCircleActivityTimestamp,
  getCircleMemberCount,
  getCircleMembershipStatus
} from './circles/circleHelpers';
import { getZaureCategoryStyle, ZAURE_GLOWS, ZAURE_ICON_CHIPS, ZAURE_SURFACES } from '../styles/designSystem';

interface CircleCardProps {
  circle: Circle;
  isJoined: boolean;
  isPending?: boolean;
  memberCounts?: Record<string, number>;
  capsuleCount?: number;
  latestCapsuleAt?: string;
  onToggleJoin: () => Promise<void> | void;
  onSelect: () => void;
  onUpdateCircle?: (
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
  onDeleteCircle?: (circleId: string) => Promise<void>;
  isActive: boolean;
  currentUser: UserProfile | null;
  key?: React.Key;
}

export default function CircleCard({
  circle,
  isJoined,
  isPending = false,
  memberCounts,
  capsuleCount = 0,
  latestCapsuleAt,
  onToggleJoin,
  onSelect,
  onUpdateCircle,
  onDeleteCircle,
  isActive,
  currentUser
}: CircleCardProps) {
  const memberCount = getCircleMemberCount(circle, memberCounts);
  const memberLabel = formatCircleMemberCount(memberCount);
  const membershipStatus = getCircleMembershipStatus(
    circle,
    isJoined ? [circle.id] : [],
    isPending ? [circle.id] : []
  );
  const isPrivate = (circle.visibility || 'public') === 'private';

  const latestAtMs = getCircleActivityTimestamp(
    circle,
    capsuleCount ? { [circle.id]: capsuleCount } : undefined,
    latestCapsuleAt ? { [circle.id]: latestCapsuleAt } : undefined
  );
  const activityLabel = formatCircleRelativeActivity(latestAtMs);
  const categoryStyle = getZaureCategoryStyle(circle.categorie);

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (membershipStatus === 'member') {
      onSelect();
    } else {
      onToggleJoin();
    }
  };

  const renderDesktopActionButton = () => {
    if (membershipStatus === 'member') {
      return (
        <button
          type="button"
          onClick={handleActionClick}
          className={`min-h-[34px] px-3.5 py-1.5 ${ZAURE_SURFACES.primaryButton} text-[11.5px] shrink-0`}
        >
          Ouvrir le Cercle
        </button>
      );
    }
    if (membershipStatus === 'pending') {
      return (
        <button
          type="button"
          onClick={handleActionClick}
          title="Cliquer pour annuler votre demande"
          className="min-h-[34px] px-3.5 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 text-[11px] font-bold zaure-btn-press shrink-0 flex items-center gap-1"
        >
          <Clock className="w-3 h-3 shrink-0" />
          <span>Demande envoyée</span>
        </button>
      );
    }
    if (membershipStatus === 'private') {
      return (
        <button
          type="button"
          onClick={handleActionClick}
          className="min-h-[34px] px-3.5 py-1.5 rounded-full border border-[#2563EB] text-[#2563EB] dark:text-blue-400 dark:border-blue-500 hover:bg-[#2563EB] hover:text-white text-[11px] font-bold zaure-btn-press shrink-0"
        >
          Demander à rejoindre
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={handleActionClick}
        className="min-h-[34px] px-4 py-1.5 rounded-full border border-[#2563EB] text-[#2563EB] dark:text-blue-400 dark:border-blue-500 hover:bg-[#2563EB] hover:text-white text-xs font-bold zaure-btn-press shrink-0"
      >
        Rejoindre
      </button>
    );
  };

  const renderMobileActionButton = () => {
    if (membershipStatus === 'member') {
      return (
        <button
          type="button"
          onClick={handleActionClick}
          className="min-h-[32px] px-3.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-[#2563EB] dark:text-blue-300 text-[11.5px] font-bold transition active:scale-95 shrink-0"
        >
          Ouvrir le Cercle
        </button>
      );
    }
    if (membershipStatus === 'pending') {
      return (
        <button
          type="button"
          onClick={handleActionClick}
          className="min-h-[32px] px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-[11px] font-bold transition active:scale-95 shrink-0"
        >
          Demande envoyée
        </button>
      );
    }
    if (membershipStatus === 'private') {
      return (
        <button
          type="button"
          onClick={handleActionClick}
          className={`min-h-[32px] px-3 py-1 ${ZAURE_SURFACES.primaryButton} text-[11px] shrink-0`}
        >
          Demander à rejoindre
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={handleActionClick}
        className={`min-h-[32px] px-4 py-1 ${ZAURE_SURFACES.primaryButton} text-[11.5px] shrink-0`}
      >
        Rejoindre
      </button>
    );
  };

  return (
    <article
      onClick={onSelect}
      id={`circle-card-${circle.id}`}
      className={`group cursor-pointer zaure-card-interactive rounded-2xl ${
        isActive ? 'border-[#2563EB] ring-2 ring-blue-500/20' : ''
      }`}
    >
      {/* ANDROID / MOBILE LAYOUT (< 640px): Horizontal compact card matching reference image */}
      <div className="flex sm:hidden items-center gap-3 p-3.5">
        {/* Left Circular Avatar + Green Checkmark Badge */}
        <div className="relative shrink-0">
          <div className={`w-14 h-14 rounded-full p-[2.5px] ${categoryStyle.gradientClass} overflow-hidden`}>
            <div className="w-full h-full rounded-full overflow-hidden border-2 border-white dark:border-slate-900 bg-blue-50 dark:bg-slate-800">
              {circle.image ? (
                <img
                  src={circle.image}
                  alt={circle.nom}
                  className="w-full h-full rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full rounded-full zaure-grad-primary text-white font-black text-lg flex items-center justify-center">
                  {circle.nom.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>
          <span
            title={isPrivate ? 'Cercle privé' : 'Cercle vérifié & actif'}
            className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-2xs ${
              isPrivate ? 'bg-slate-700' : 'bg-[#22C55E]'
            }`}
          >
            {isPrivate ? (
              <Lock className="w-2.5 h-2.5 text-white" />
            ) : (
              <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
            )}
          </span>
        </div>

        {/* Right Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0">
              <h3 className="font-extrabold text-[14px] text-slate-900 dark:text-white leading-snug truncate group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                {circle.nom}
              </h3>
            </div>
            <div className="-mt-1 -mr-1 shrink-0">
              <CircleOptionsMenu
                variant="card"
                circle={circle}
                isJoined={isJoined}
                isPending={isPending}
                currentUser={currentUser}
                onOpenCircle={onSelect}
                onToggleJoin={onToggleJoin}
                onUpdateCircle={onUpdateCircle}
                onDeleteCircle={onDeleteCircle}
              />
            </div>
          </div>

          <p className="text-[11.5px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
            {circle.description}
          </p>

          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              <Users className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
              <span className="truncate tabular-nums">{memberLabel}</span>
            </div>
            {renderMobileActionButton()}
          </div>
        </div>
      </div>

      {/* DESKTOP / TABLET LAYOUT (>= 640px): Centered circular card matching reference image */}
      <div className="hidden sm:flex flex-col justify-between p-4 h-full relative">
        {/* Top Row: Visibility Pill + 3-dot options menu */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {isPrivate ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                <Lock className="w-2.5 h-2.5" />
                <span>Privé</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-slate-400 dark:text-slate-500 truncate">
                <Sparkles className="w-3 h-3 text-blue-500 shrink-0" />
                <span className="truncate">{circle.categorie}</span>
              </span>
            )}
          </div>

          <div className="-mr-1.5 -mt-1">
            <CircleOptionsMenu
              variant="card"
              circle={circle}
              isJoined={isJoined}
              isPending={isPending}
              currentUser={currentUser}
              onOpenCircle={onSelect}
              onToggleJoin={onToggleJoin}
              onUpdateCircle={onUpdateCircle}
              onDeleteCircle={onDeleteCircle}
            />
          </div>
        </div>

        {/* Center Logo & Text */}
        <div className="flex flex-col items-center text-center px-1">
          <div className="relative">
            <div className={`w-20 h-20 rounded-full p-[3px] ${categoryStyle.gradientClass} group-hover:${ZAURE_GLOWS.soft} transition-all`}>
              <div className="w-full h-full rounded-full overflow-hidden border-2 border-white dark:border-slate-900 bg-blue-50/70 dark:bg-slate-800">
                {circle.image ? (
                  <img
                    src={circle.image}
                    alt={circle.nom}
                    className="w-full h-full rounded-full object-cover group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full rounded-full zaure-grad-primary text-white font-black text-2xl flex items-center justify-center">
                    {circle.nom.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            <span
              title={isPrivate ? 'Cercle privé' : 'Cercle actif'}
              className={`absolute bottom-0.5 right-0.5 w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-xs ${
                isPrivate ? 'bg-slate-700' : 'bg-[#22C55E]'
              }`}
            >
              {isPrivate ? (
                <Lock className="w-3 h-3 text-white" />
              ) : (
                <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
              )}
            </span>
          </div>

          <h3 className="font-extrabold text-[15px] text-slate-900 dark:text-white mt-3 line-clamp-1 group-hover:text-[#2563EB] dark:group-hover:text-blue-400 transition-colors">
            {circle.nom}
          </h3>

          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 min-h-[2.25rem] leading-relaxed">
            {circle.description}
          </p>

          <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-1.5">
            {activityLabel}
            {capsuleCount > 0 ? ` · ${capsuleCount} publication${capsuleCount > 1 ? 's' : ''}` : ''}
          </p>
        </div>

        {/* Footer: Member count + Action Button */}
        <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-600 dark:text-slate-300 min-w-0">
            <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${ZAURE_ICON_CHIPS.blue}`}>
              <Users className="w-3.5 h-3.5" />
            </span>
            <span className="truncate tabular-nums">{memberLabel}</span>
          </div>
          {renderDesktopActionButton()}
        </div>
      </div>
    </article>
  );
}
