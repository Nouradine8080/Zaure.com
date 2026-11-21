import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, Users, Volume2 } from 'lucide-react';
import { UserProfile } from '../../types';

export const QUICK_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🙏', '🔥'];

export const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: 'Réactions & Santé',
    emojis: ['❤️', '👍', '👏', '🙏', '🔥', '✨', '💡', '🩺', '💊', '🧬', '🧠', '🫀', '🏥', '📚', '✅']
  },
  {
    label: 'Expressions',
    emojis: ['😊', '😂', '🥰', '😍', '🤝', '🤔', '😮', '😢', '🎉', '💪', '👌', '🙌', '👀', '😅', '😎']
  },
  {
    label: 'Travail & Sahel',
    emojis: ['📝', '📎', '📅', '⏰', '📌', '🌍', '☀️', '🌿', '🎙️', '📷', '🎥', '💬', '⭐', '🚀', '☕']
  }
];

export function formatDateDivider(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((today.getTime() - msgDay.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) {
      const weekday = d.toLocaleDateString('fr-FR', { weekday: 'long' });
      return weekday.charAt(0).toUpperCase() + weekday.slice(1);
    }
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  } catch {
    return 'Date récente';
  }
}

export function formatLastMessageTimestamp(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((today.getTime() - msgDay.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) {
      const weekday = d.toLocaleDateString('fr-FR', { weekday: 'short' });
      return weekday.charAt(0).toUpperCase() + weekday.slice(1).replace('.', '');
    }
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

export function isUserRecentlyActive(user?: UserProfile | null): boolean {
  if (!user) return false;
  if (user.availability === 'offline') return false;
  if (user.last_active) {
    const diffMs = Date.now() - new Date(user.last_active).getTime();
    // Consider offline if stale for more than 12 minutes unless explicitly online in session
    if (diffMs > 12 * 60 * 1000 && user.availability !== 'online') return false;
  }
  return user.availability === 'online' || user.availability === 'busy';
}

export function formatLastSeen(user?: UserProfile | null): string {
  if (!user) return 'Hors ligne';
  if (user.availability === 'online') {
    if (user.last_active) {
      const diffMins = Math.floor((Date.now() - new Date(user.last_active).getTime()) / 60000);
      if (diffMins <= 5) return 'En ligne';
      if (diffMins < 60) return `Actif il y a ${diffMins} min`;
    }
    return 'En ligne';
  }
  if (user.availability === 'busy') return 'Occupé';
  if (user.last_active) {
    try {
      const d = new Date(user.last_active);
      const diffMins = Math.floor((Date.now() - d.getTime()) / 60000);
      if (diffMins < 60) return `Vu il y a ${Math.max(1, diffMins)} min`;
      const now = new Date();
      if (d.toDateString() === now.toDateString()) {
        return `Vu aujourd'hui à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
      }
      return `Vu le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
    } catch {
      return 'Hors ligne';
    }
  }
  return 'Hors ligne';
}

export function formatCallTime(secs: number): string {
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
}

export function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
}

export function sanitizeExternalUrl(raw?: string): string {
  if (!raw) return '#';
  const trimmed = raw.trim();
  if (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('data:audio/') ||
    trimmed.startsWith('data:video/') ||
    trimmed.startsWith('data:application/pdf') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }
  return '#';
}

interface UserAvatarProps {
  name: string;
  avatarUrl?: string | null;
  isGroup?: boolean;
  availability?: 'online' | 'busy' | 'offline';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showPresence?: boolean;
  onClick?: () => void;
}

const SIZE_CLASSES: Record<NonNullable<UserAvatarProps['size']>, string> = {
  xs: 'h-7 w-7 text-[11px] rounded-xl',
  sm: 'h-9 w-9 text-xs rounded-xl',
  md: 'h-11 w-11 text-sm rounded-2xl',
  lg: 'h-12 w-12 text-base rounded-2xl',
  xl: 'h-20 w-20 text-2xl rounded-3xl'
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  avatarUrl,
  isGroup = false,
  availability = 'offline',
  size = 'md',
  showPresence = false,
  onClick
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const initial = (name || 'Z').trim().charAt(0).toUpperCase() || 'Z';
  const sizeClass = SIZE_CLASSES[size];

  const dotColor =
    availability === 'online'
      ? 'bg-emerald-500'
      : availability === 'busy'
        ? 'bg-amber-500'
        : 'bg-slate-300';

  return (
    <div
      onClick={onClick}
      className={`relative shrink-0 select-none ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div
        className={`${sizeClass} flex items-center justify-center overflow-hidden font-bold ${
          isGroup
            ? 'bg-blue-600 text-white'
            : 'bg-slate-100 text-slate-700 border border-slate-200/80'
        }`}
      >
        {avatarUrl && !imgFailed ? (
          <img
            src={avatarUrl}
            alt={name}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
          />
        ) : isGroup ? (
          <Users className={size === 'xl' ? 'h-9 w-9' : size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
        ) : (
          <span>{initial}</span>
        )}
      </div>
      {showPresence && !isGroup && availability !== 'offline' && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${dotColor}`}
          title={availability === 'online' ? 'En ligne' : 'Occupé'}
        />
      )}
    </div>
  );
};

export const VoiceNotePlayer: React.FC<{ url: string; isMe: boolean }> = ({ url, isMe }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl px-3 py-2 min-w-[215px] max-w-[270px] ${
        isMe ? 'bg-blue-700/80 text-white' : 'bg-slate-100 text-slate-800 border border-slate-200/80'
      }`}
    >
      <audio ref={audioRef} src={url} preload="metadata" className="hidden" />
      <button
        type="button"
        onClick={togglePlay}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${
          isMe
            ? 'bg-white text-blue-600 hover:bg-blue-50'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
        aria-label={isPlaying ? 'Mettre en pause' : 'Lire la note vocale'}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0">
        <div
          className={`h-1.5 w-full overflow-hidden rounded-full ${
            isMe ? 'bg-blue-900/50' : 'bg-slate-200'
          }`}
        >
          <div
            className={`h-full rounded-full transition-all duration-150 ${
              isMe ? 'bg-white' : 'bg-blue-600'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] font-medium tabular-nums opacity-85">
          <span>{formatCallTime(Math.floor(currentTime))}</span>
          <span>{duration > 0 ? formatCallTime(Math.floor(duration)) : 'Vocal'}</span>
        </div>
      </div>

      <Volume2 className="h-3.5 w-3.5 shrink-0 opacity-65" />
    </div>
  );
};
