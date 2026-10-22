import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Play, Pause, Volume2, AlertCircle } from 'lucide-react';

interface VoiceNotePlayerProps {
  url: string;
  isMe?: boolean;
  duration?: number;
}

export default function VoiceNotePlayer({ url, isMe = false, duration }: VoiceNotePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [hasError, setHasError] = useState(false);

  // Génération pseudo-aléatoire mais déterministe d'une forme d'onde sonore
  const waveformBars = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      hash = (hash << 5) - hash + url.charCodeAt(i);
      hash |= 0;
    }
    const bars: number[] = [];
    const count = 32;
    for (let i = 0; i < count; i++) {
      const pseudo = Math.abs(Math.sin((hash + i * 13) * 0.45));
      const height = Math.floor(18 + pseudo * 70); // 18% à 88%
      bars.push(height);
    }
    return bars;
  }, [url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setAudioDuration(audio.duration);
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const onError = () => {
      setHasError(true);
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [url]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || hasError) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch((e) => {
          console.warn('Erreur lecture audio:', e);
          setHasError(true);
        });
    }
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const speeds = [1, 1.5, 2];
    const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const newSpeed = speeds[nextIdx];
    setPlaybackRate(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audioDuration || isNaN(audioDuration)) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const progress = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = progress * audioDuration;

    audio.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs) || !isFinite(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressFraction = audioDuration > 0 ? Math.min(1, currentTime / audioDuration) : 0;

  if (hasError) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
        <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
        <span className="truncate">Note vocale indisponible</span>
        <a href={url} target="_blank" rel="noopener noreferrer" className="ml-auto font-bold underline">
          Ouvrir
        </a>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2.5 rounded-2xl p-2.5 transition select-none w-full max-w-sm ${
        isMe
          ? 'bg-blue-700/60 text-white'
          : 'bg-slate-100 text-slate-800 dark:bg-slate-700/80 dark:text-slate-100'
      }`}
    >
      <audio ref={audioRef} src={url} preload="metadata" />

      {/* Bouton Play / Pause rond */}
      <button
        type="button"
        onClick={togglePlay}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-xs transition active:scale-95 ${
          isMe
            ? 'bg-white text-blue-700 hover:bg-blue-50'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
        title={isPlaying ? 'Pause' : 'Écouter'}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4 fill-current stroke-current" />
        ) : (
          <Play className="h-4 w-4 fill-current stroke-current ml-0.5" />
        )}
      </button>

      {/* Onde sonore interactive / Waveform seekable */}
      <div className="flex-1 min-w-0">
        <div
          onClick={handleSeek}
          className="flex h-8 items-center gap-0.5 cursor-pointer py-1 group/wave"
          title="Cliquer pour naviguer dans la note vocale"
        >
          {waveformBars.map((heightPercent, idx) => {
            const barFraction = idx / waveformBars.length;
            const isPlayed = barFraction <= progressFraction;

            return (
              <span
                key={idx}
                style={{ height: `${heightPercent}%` }}
                className={`w-1 rounded-full transition-all duration-100 ${
                  isPlayed
                    ? isMe
                      ? 'bg-white'
                      : 'bg-blue-600 dark:bg-blue-400'
                    : isMe
                    ? 'bg-white/35 group-hover/wave:bg-white/50'
                    : 'bg-slate-300 dark:bg-slate-600 group-hover/wave:bg-slate-400'
                }`}
              />
            );
          })}
        </div>

        {/* Chronomètre et statut */}
        <div className="flex items-center justify-between text-[10px] font-mono opacity-85 mt-0.5">
          <span>{formatTime(currentTime)}</span>
          <span className="flex items-center gap-1">
            <Volume2 className="h-2.5 w-2.5 opacity-60" />
            <span>{audioDuration > 0 ? formatTime(audioDuration) : 'Vocal'}</span>
          </span>
        </div>
      </div>

      {/* Sélecteur de vitesse de lecture */}
      <button
        type="button"
        onClick={cycleSpeed}
        className={`rounded-lg px-2 py-1 text-[10px] font-bold tracking-tight transition shrink-0 ${
          isMe
            ? 'bg-white/20 hover:bg-white/30 text-white'
            : 'bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-600 dark:text-slate-200'
        }`}
        title="Changer la vitesse d'écoute"
      >
        {playbackRate}x
      </button>
    </div>
  );
}
