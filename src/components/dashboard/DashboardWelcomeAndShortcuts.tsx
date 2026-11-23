import React from 'react';
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Globe,
  GraduationCap,
  HeartPulse,
  MoreHorizontal,
  Plus,
  UsersRound,
} from 'lucide-react';
import { Circle, UserProfile } from '../../types';
import { DEFAULT_AVATAR_URL } from '../../constants/registration';

export interface ProfileCompletionSummary {
  percent: number;
  missingCount: number;
}

export function calculateProfileCompletion(user: UserProfile | null): ProfileCompletionSummary {
  if (!user) return { percent: 0, missingCount: 6 };

  const checks = [
    Boolean(user.nom && user.nom.trim().length >= 2),
    Boolean(user.avatar_url && user.avatar_url !== DEFAULT_AVATAR_URL),
    Boolean(user.bio && user.bio.trim().length >= 5),
    Boolean((user.profession && user.profession.trim()) || (user.formation && user.formation.trim())),
    Boolean(user.localisation && user.localisation.trim()),
    Boolean(user.phone && user.phone.trim()),
  ];

  const completed = checks.filter(Boolean).length;
  const percent = Math.round((completed / checks.length) * 100);
  return {
    percent,
    missingCount: checks.length - completed,
  };
}

interface DashboardWelcomeAndShortcutsProps {
  currentUser: UserProfile | null;
  circles: Circle[];
  joinedCircleIds: string[];
  activeFeedFilter: string;
  activeSearchQuery: string;
  onOpenProfile: () => void;
  onCompleteProfile: () => void;
  onOpenQuickPost: () => void;
  onOpenCircle: (circleId: string) => void;
  onOpenAllCircles: () => void;
  onOpenCommunities: () => void;
  onSelectCategoryShortcut: (query: string) => void;
  onResetFeedAll: () => void;
}

export default function DashboardWelcomeAndShortcuts({
  currentUser,
  circles,
  joinedCircleIds,
  activeFeedFilter,
  activeSearchQuery,
  onOpenProfile,
  onCompleteProfile,
  onOpenQuickPost,
  onOpenCircle,
  onOpenAllCircles,
  onOpenCommunities,
  onSelectCategoryShortcut,
  onResetFeedAll,
}: DashboardWelcomeAndShortcutsProps) {
  const completion = calculateProfileCompletion(currentUser);
  const firstName = currentUser?.nom?.trim() || 'Membre';

  const normalizedQuery = activeSearchQuery.trim().toLowerCase();

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* 1. BANNIÈRE DE BIENVENUE (Fidèle à la maquette Android & Desktop) */}
      {currentUser && (
        <section
          aria-label="Bienvenue sur ZAURE"
          className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-[#1D4ED8] via-[#2563EB] to-[#0EA5E9] text-white p-3 sm:p-5 shadow-md shadow-blue-600/15"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-10 w-36 h-36 rounded-full bg-white/15 blur-2xl"
          />

          <div className="relative flex items-center justify-between gap-2.5 sm:gap-4 flex-wrap sm:flex-nowrap">
            {/* Avatar + Greeting */}
            <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
              <button
                type="button"
                onClick={onOpenProfile}
                className="relative shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                title="Voir mon profil"
              >
                {currentUser.avatar_url ? (
                  <img
                    src={currentUser.avatar_url}
                    alt={currentUser.nom}
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover ring-2 ring-white/95 bg-blue-800"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/20 text-white font-extrabold text-lg flex items-center justify-center ring-2 ring-white/95">
                    {firstName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span
                  className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#1D4ED8]"
                  title="En ligne"
                />
              </button>

              <div className="min-w-0 flex-1">
                <h1 className="text-[13.5px] sm:text-lg font-extrabold tracking-tight leading-snug truncate">
                  Bonjour, {firstName} !
                </h1>
                <p className="text-[11px] sm:text-xs text-blue-100 leading-snug line-clamp-2 mt-0.5">
                  Bienvenue sur ZAURE, votre réseau social éducatif et professionnel.
                </p>
              </div>
            </div>

            {/* Profile Completion CTA + Progress Bar */}
            <div className="w-full sm:w-auto sm:min-w-[200px] shrink-0 flex sm:flex-col items-center sm:items-end justify-between gap-2.5 sm:gap-2">
              <button
                type="button"
                onClick={completion.percent < 100 ? onCompleteProfile : onOpenProfile}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-950/30 hover:bg-slate-950/45 border border-white/15 text-[11px] font-bold text-white whitespace-nowrap shrink-0 transition"
              >
                {completion.percent < 100 ? (
                  <>
                    <span>Compléter mon profil</span>
                    <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Profil complet</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-2 flex-1 sm:flex-none sm:w-full max-w-[160px] sm:max-w-[200px]">
                <div
                  className="h-2 flex-1 rounded-full bg-white/25 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={completion.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Progression du profil"
                >
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                    style={{ width: `${completion.percent}%` }}
                  />
                </div>
                <span className="font-mono text-[11px] font-extrabold text-white tabular-nums shrink-0">
                  {completion.percent}%
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 2. RACCOURCIS & STORIES HORIZONTALES (Directement sur le canevas comme sur l'image) */}
      <section aria-label="Raccourcis et catégories ZAURE" className="px-0.5">
        <div className="flex items-start gap-3 overflow-x-auto pb-1 scrollbar-none">
          {/* 1. Publier / Créer */}
          {currentUser && (
            <button
              type="button"
              onClick={onOpenQuickPost}
              className="w-[62px] sm:w-[68px] shrink-0 flex flex-col items-center text-center group"
            >
              <span className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-[#E6EDF8] dark:bg-slate-800 border border-blue-200/80 dark:border-slate-700 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-105 group-active:scale-95 transition">
                <Plus className="w-6 h-6 stroke-[2.5]" />
              </span>
              <span className="mt-1.5 text-[10.5px] font-semibold text-slate-800 dark:text-slate-200 leading-tight line-clamp-2">
                Publier
              </span>
            </button>
          )}

          {/* 2. Santé */}
          <button
            type="button"
            onClick={() => onSelectCategoryShortcut(normalizedQuery === 'santé' ? '' : 'Santé')}
            className="w-[62px] sm:w-[68px] shrink-0 flex flex-col items-center text-center group"
          >
            <span
              className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full p-[2.5px] transition group-hover:scale-105 group-active:scale-95 ${
                normalizedQuery === 'santé'
                  ? 'bg-gradient-to-tr from-blue-700 to-sky-400 ring-2 ring-blue-500/30'
                  : 'bg-gradient-to-tr from-blue-600 to-sky-400'
              }`}
            >
              <span className="w-full h-full rounded-full bg-gradient-to-br from-rose-500 to-amber-500 border-2 border-white dark:border-slate-900 flex items-center justify-center text-white">
                <HeartPulse className="w-6 h-6" />
              </span>
            </span>
            <span className="mt-1.5 text-[10.5px] font-semibold text-slate-800 dark:text-slate-200 leading-tight truncate w-full">
              Santé
            </span>
          </button>

          {/* 3. Tech */}
          <button
            type="button"
            onClick={() => onSelectCategoryShortcut(normalizedQuery === 'tech' ? '' : 'Tech')}
            className="w-[62px] sm:w-[68px] shrink-0 flex flex-col items-center text-center group"
          >
            <span
              className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full p-[2.5px] transition group-hover:scale-105 group-active:scale-95 ${
                normalizedQuery === 'tech'
                  ? 'bg-gradient-to-tr from-blue-700 to-sky-400 ring-2 ring-blue-500/30'
                  : 'bg-gradient-to-tr from-blue-600 to-sky-400'
              }`}
            >
              <span className="w-full h-full rounded-full bg-gradient-to-br from-slate-800 to-blue-700 border-2 border-white dark:border-slate-900 flex items-center justify-center text-sky-300">
                <Cpu className="w-6 h-6" />
              </span>
            </span>
            <span className="mt-1.5 text-[10.5px] font-semibold text-slate-800 dark:text-slate-200 leading-tight truncate w-full">
              Tech
            </span>
          </button>

          {/* 4. Étudiants */}
          <button
            type="button"
            onClick={() => onSelectCategoryShortcut(normalizedQuery === 'étudiant' ? '' : 'Étudiant')}
            className="w-[62px] sm:w-[68px] shrink-0 flex flex-col items-center text-center group"
          >
            <span
              className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full p-[2.5px] transition group-hover:scale-105 group-active:scale-95 ${
                normalizedQuery === 'étudiant'
                  ? 'bg-gradient-to-tr from-blue-700 to-sky-400 ring-2 ring-blue-500/30'
                  : 'bg-gradient-to-tr from-blue-600 to-sky-400'
              }`}
            >
              <span className="w-full h-full rounded-full bg-gradient-to-br from-indigo-900 to-blue-600 border-2 border-white dark:border-slate-900 flex items-center justify-center text-amber-300">
                <GraduationCap className="w-6 h-6" />
              </span>
            </span>
            <span className="mt-1.5 text-[10.5px] font-semibold text-slate-800 dark:text-slate-200 leading-tight truncate w-full">
              Étudiants
            </span>
          </button>

          {/* 5. Communauté */}
          <button
            type="button"
            onClick={onOpenCommunities}
            className="w-[62px] sm:w-[68px] shrink-0 flex flex-col items-center text-center group"
          >
            <span className="w-13 h-13 sm:w-14 sm:h-14 rounded-full p-[2.5px] bg-gradient-to-tr from-blue-600 to-sky-400 transition group-hover:scale-105 group-active:scale-95">
              <span className="w-full h-full rounded-full bg-gradient-to-br from-sky-600 to-indigo-700 border-2 border-white dark:border-slate-900 flex items-center justify-center text-white">
                <UsersRound className="w-6 h-6" />
              </span>
            </span>
            <span className="mt-1.5 text-[10.5px] font-semibold text-slate-800 dark:text-slate-200 leading-tight truncate w-full">
              Communauté
            </span>
          </button>

          {/* 6. Actualités */}
          <button
            type="button"
            onClick={onResetFeedAll}
            className="w-[62px] sm:w-[68px] shrink-0 flex flex-col items-center text-center group"
          >
            <span
              className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full p-[2.5px] transition group-hover:scale-105 group-active:scale-95 ${
                activeFeedFilter === 'all' && !normalizedQuery
                  ? 'bg-gradient-to-tr from-blue-600 to-sky-400 ring-2 ring-blue-500/30'
                  : 'bg-gradient-to-tr from-blue-600 to-sky-400'
              }`}
            >
              <span className="w-full h-full rounded-full bg-gradient-to-br from-blue-700 to-cyan-500 border-2 border-white dark:border-slate-900 flex items-center justify-center text-white">
                <Globe className="w-6 h-6" />
              </span>
            </span>
            <span className="mt-1.5 text-[10.5px] font-semibold text-slate-800 dark:text-slate-200 leading-tight truncate w-full">
              Actualités
            </span>
          </button>

          {/* 7. Cercles Firestore réels */}
          {circles.map((circle) => {
            const isJoined = joinedCircleIds.includes(circle.id);
            return (
              <button
                key={circle.id}
                type="button"
                onClick={() => onOpenCircle(circle.id)}
                className="w-[62px] sm:w-[68px] shrink-0 flex flex-col items-center text-center group"
                title={`${circle.nom} (${circle.categorie})`}
              >
                <span className="relative w-13 h-13 sm:w-14 sm:h-14 rounded-full p-[2.5px] bg-gradient-to-tr from-blue-600 to-sky-400 transition group-hover:scale-105 group-active:scale-95">
                  <span className="block w-full h-full rounded-full overflow-hidden border-2 border-white dark:border-slate-900 bg-blue-50 dark:bg-slate-800">
                    {circle.image ? (
                      <img
                        src={circle.image}
                        alt={circle.nom}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center text-blue-600">
                        <BookOpen className="w-5 h-5" />
                      </span>
                    )}
                  </span>
                  {isJoined && (
                    <span
                      className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900"
                      title="Cercle rejoint"
                    />
                  )}
                </span>
                <span className="mt-1.5 text-[10.5px] font-semibold text-slate-800 dark:text-slate-200 leading-tight truncate w-full">
                  {circle.categorie || circle.nom}
                </span>
              </button>
            );
          })}

          {/* 8. Plus -> Explorer tous les cercles */}
          <button
            type="button"
            onClick={onOpenAllCircles}
            className="w-[62px] sm:w-[68px] shrink-0 flex flex-col items-center text-center group"
          >
            <span className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-[#E6EDF8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 group-hover:bg-blue-50 group-hover:text-blue-700 transition">
              <MoreHorizontal className="w-5 h-5" />
            </span>
            <span className="mt-1.5 text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 leading-tight truncate w-full">
              Plus
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}
