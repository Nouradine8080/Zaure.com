import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Film,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  Play,
  X
} from 'lucide-react';
import { CommunityGroup, GroupPost, UserProfile } from '../../types';
import { formatFileSize } from '../../utils/fileValidation';

interface ProfileMediaGalleryProps {
  mode: 'photos' | 'videos';
  posts: GroupPost[];
  groupsMap: Record<string, CommunityGroup>;
  profileUser: UserProfile;
}

interface MediaGalleryEntry {
  key: string;
  url: string;
  name: string;
  size?: number;
  post: GroupPost;
  groupName: string;
}

function formatDateFr(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

export default function ProfileMediaGallery({
  mode,
  posts,
  groupsMap,
  profileUser
}: ProfileMediaGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const items = useMemo<MediaGalleryEntry[]>(() => {
    const entries: MediaGalleryEntry[] = [];
    posts.forEach((post) => {
      const targetType = mode === 'photos' ? 'image' : 'video';
      const groupName =
        post.groupId === 'public'
          ? 'Fil public'
          : groupsMap[post.groupId]?.name || 'Communauté Zaure';

      (post.media || []).forEach((m, idx) => {
        if (m.type === targetType && m.url) {
          entries.push({
            key: `${post.id}_${idx}`,
            url: m.url,
            name: m.name || (mode === 'photos' ? 'Photo' : 'Vidéo'),
            size: m.size,
            post,
            groupName
          });
        }
      });
    });
    return entries;
  }, [posts, groupsMap, mode]);

  useEffect(() => {
    if (activeIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveIndex(null);
      } else if (e.key === 'ArrowLeft' && items.length > 1) {
        setActiveIndex((prev) => (prev !== null ? (prev - 1 + items.length) % items.length : 0));
      } else if (e.key === 'ArrowRight' && items.length > 1) {
        setActiveIndex((prev) => (prev !== null ? (prev + 1) % items.length : 0));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, items.length]);

  if (items.length === 0) {
    return (
      <div className="bg-white border border-slate-200/85 rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center shadow-xs">
        <div className="w-16 h-16 mx-auto mb-3.5 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
          {mode === 'photos' ? <Camera className="w-8 h-8" /> : <Film className="w-8 h-8" />}
        </div>
        <h4 className="text-sm sm:text-base font-extrabold text-slate-900">
          {mode === 'photos' ? 'Aucune photo publiée' : 'Aucune vidéo publiée'}
        </h4>
        <p className="text-xs text-slate-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
          {mode === 'photos'
            ? `Les photos partagées par ${profileUser.nom} dans ses publications apparaîtront ici.`
            : `Les vidéos partagées par ${profileUser.nom} dans ses publications apparaîtront ici.`}
        </p>
      </div>
    );
  }

  const activeItem = activeIndex !== null ? items[activeIndex] : null;

  return (
    <div className="space-y-3">
      <div className="bg-white border border-slate-200/85 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3.5 px-1">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            {mode === 'photos' ? (
              <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
            ) : (
              <Film className="w-3.5 h-3.5 text-red-600" />
            )}
            <span>
              {mode === 'photos' ? 'Galerie photos' : 'Vidéos partagées'} ·{' '}
              <span className="font-mono tabular-nums text-slate-700">{items.length}</span>
            </span>
          </h3>
        </div>

        {mode === 'photos' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            {items.map((item, idx) => (
              <motion.button
                key={item.key}
                type="button"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveIndex(idx)}
                className="group relative aspect-square rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/80 text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <img
                  src={item.url}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-slate-950/75 via-slate-950/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between text-white text-[10px] font-semibold">
                  <span className="truncate">{item.groupName}</span>
                  <span className="font-mono tabular-nums shrink-0 ml-2">
                    {formatDateFr(item.post.createdAt)}
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {items.map((item, idx) => (
              <motion.button
                key={item.key}
                type="button"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveIndex(idx)}
                className="group rounded-2xl overflow-hidden bg-slate-950 border border-slate-200/80 text-left shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <div className="relative aspect-video bg-slate-900 overflow-hidden">
                  <video
                    src={item.url}
                    preload="metadata"
                    muted
                    playsInline
                    className="w-full h-full object-cover opacity-90 group-hover:scale-[1.02] transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-slate-950/30 group-hover:bg-slate-950/20 transition flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-white/95 text-slate-950 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Play className="w-5 h-5 fill-slate-950 ml-0.5" />
                    </div>
                  </div>
                  {item.size && (
                    <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-slate-950/75 text-white font-mono text-[10px] tabular-nums">
                      {formatFileSize(item.size)}
                    </span>
                  )}
                </div>
                <div className="p-3 bg-white">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {item.post.content ? item.post.content.slice(0, 75) : item.name}
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                    <span className="truncate">{item.groupName}</span>
                    <span className="font-mono tabular-nums shrink-0 ml-2">
                      {formatDateFr(item.post.createdAt)}
                    </span>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen Media Lightbox with Navigation & Post Metadata */}
      {activeItem &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm flex flex-col lg:flex-row"
            onClick={() => setActiveIndex(null)}
          >
            {/* Top Mobile Bar */}
            <div className="flex items-center justify-between px-4 py-3 text-white lg:hidden border-b border-white/10">
              <span className="text-xs font-bold tabular-nums">
                {(activeIndex ?? 0) + 1} / {items.length}
              </span>
              <button
                type="button"
                onClick={() => setActiveIndex(null)}
                className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Media Viewport */}
            <div
              className="relative flex-1 flex items-center justify-center p-3 sm:p-6 min-h-0"
              onClick={(e) => e.stopPropagation()}
            >
              {items.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveIndex((prev) =>
                        prev !== null ? (prev - 1 + items.length) % items.length : 0
                      )
                    }
                    className="absolute left-2 sm:left-5 z-10 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition"
                    aria-label="Média précédent"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveIndex((prev) => (prev !== null ? (prev + 1) % items.length : 0))
                    }
                    className="absolute right-2 sm:right-5 z-10 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition"
                    aria-label="Média suivant"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}

              {mode === 'photos' ? (
                <img
                  src={activeItem.url}
                  alt={activeItem.name}
                  className="max-h-[75vh] lg:max-h-[88vh] max-w-full rounded-2xl object-contain shadow-2xl"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <video
                  key={activeItem.key}
                  src={activeItem.url}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[75vh] lg:max-h-[88vh] max-w-full w-full lg:w-auto rounded-2xl bg-black shadow-2xl"
                />
              )}
            </div>

            {/* Associated Post Details Sidebar */}
            <div
              className="w-full lg:w-88 xl:w-96 bg-white text-slate-900 p-4 sm:p-5 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-200 max-h-[38vh] lg:max-h-none overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-4">
                <div className="hidden lg:flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-500 tabular-nums">
                    Média {(activeIndex ?? 0) + 1} sur {items.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveIndex(null)}
                    className="w-9 h-9 rounded-full hover:bg-slate-100 text-slate-500 flex items-center justify-center transition"
                    aria-label="Fermer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  {profileUser.avatar_url ? (
                    <img
                      src={profileUser.avatar_url}
                      alt={profileUser.nom}
                      className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-200 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
                      {profileUser.nom.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-950 truncate">{profileUser.nom}</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {activeItem.groupName} · {formatDateFr(activeItem.post.createdAt)}
                    </p>
                  </div>
                </div>

                {activeItem.post.content ? (
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                    {activeItem.post.content}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 italic">{activeItem.name}</p>
                )}
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center gap-4 text-xs font-semibold text-slate-600 tabular-nums">
                <span className="flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-red-500" />
                  <span>{Math.max(0, activeItem.post.reactionCount || 0)} réactions</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4 text-blue-600" />
                  <span>{Math.max(0, activeItem.post.commentCount || 0)} commentaires</span>
                </span>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
