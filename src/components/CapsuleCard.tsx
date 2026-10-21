import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  MessageSquare, 
  Lightbulb, 
  Heart, 
  HelpCircle, 
  CheckCircle2, 
  Award, 
  User, 
  Clock, 
  Languages, 
  Volume2,
  Send,
  Bookmark,
  Share2,
  Check
} from 'lucide-react';
import { Capsule, Comment, Reaction, UserProfile } from '../types';
import { zaureService } from '../firebaseClient';
import { useTranslation } from '../context/LanguageContext';

interface CapsuleCardProps {
  capsule: Capsule;
  currentUser: UserProfile | null;
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
  key?: React.Key;
}

export default function CapsuleCard({ 
  capsule, 
  currentUser, 
  isBookmarked = false, 
  onToggleBookmark 
}: CapsuleCardProps) {
  const { t } = useTranslation();
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState('0:00');
  const [audioCurrentTime, setAudioCurrentTime] = useState('0:00');
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Load reactions & comments on mount / capsule change
  useEffect(() => {
    loadReactionsAndComments();

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [capsule.id]);

  const loadReactionsAndComments = async () => {
    try {
      const rx = await zaureService.getReactions(capsule.id);
      setReactions(rx);
      const cx = await zaureService.getComments(capsule.id);
      setComments(cx);
    } catch (e) {
      console.error(e);
    }
  };

  const handleReact = async (type: 'utile' | 'merci' | 'question') => {
    if (!currentUser) return;
    try {
      const updated = await zaureService.toggleReaction(capsule.id, type);
      setReactions(updated);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !currentUser) return;

    try {
      const added = await zaureService.addComment(capsule.id, newCommentText.trim());
      setComments((prev) => [...prev, added]);
      setNewCommentText('');
    } catch (e) {
      console.error(e);
    }
  };

  const setupAudio = () => {
    if (audioRef.current) return;

    const src = capsule.contenu.startsWith('data:audio') 
      ? capsule.contenu 
      : 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

    const audio = new Audio(src);
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      const mins = Math.floor(audio.duration / 60);
      const secs = Math.floor(audio.duration % 60);
      setAudioDuration(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
    };

    audio.onended = () => {
      setIsPlaying(false);
      setAudioProgress(0);
      setAudioCurrentTime('0:00');
    };
  };

  const updateAudioProgress = () => {
    if (!audioRef.current) return;
    const audio = audioRef.current;
    if (audio.duration) {
      setAudioProgress((audio.currentTime / audio.duration) * 100);
      const mins = Math.floor(audio.currentTime / 60);
      const secs = Math.floor(audio.currentTime % 60);
      setAudioCurrentTime(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
    }
    animationFrameRef.current = requestAnimationFrame(updateAudioProgress);
  };

  const handlePlayPauseAudio = () => {
    setupAudio();
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    } else {
      audio.play().catch(err => console.log('Audio playback error', err));
      setIsPlaying(true);
      animationFrameRef.current = requestAnimationFrame(updateAudioProgress);
    }
  };

  const getReactionCount = (type: 'utile' | 'merci' | 'question') => {
    return reactions.filter((r) => r.type === type).length;
  };

  const hasReacted = (type: 'utile' | 'merci' | 'question') => {
    return reactions.some((r) => r.user_id === currentUser?.id && r.type === type);
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  };

  const languageLabels: Record<string, string> = {
    fr: 'Français',
    ha: 'Hausa',
    en: 'English'
  };

  return (
    <article 
      className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-sm transition-all duration-200" 
      id={`capsule-card-${capsule.id}`}
    >
      {/* Header Info - Responsive flex layout */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5">
        <div className="flex items-center gap-3">
          {capsule.auteur_avatar ? (
            <img
              src={capsule.auteur_avatar}
              alt={capsule.auteur_nom}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-blue-500/20 shrink-0"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 shrink-0">
              <User className="w-5 h-5" />
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-slate-900 text-sm truncate">{capsule.auteur_nom}</span>
              
              {capsule.auteur_role === 'verifie' && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200/50">
                  <CheckCircle2 className="w-3 h-3 text-blue-600" />
                  <span>{t('auth.role_verified')}</span>
                </span>
              )}
              {capsule.auteur_role === 'mentor' && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-700 bg-red-50 px-1.5 py-0.2 rounded border border-red-200/50">
                  <Award className="w-3 h-3 text-red-600" />
                  <span>{t('auth.role_mentor')}</span>
                </span>
              )}
            </div>

            {/* Zero-Pill Unboxed Metadata with Typographic Separators */}
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 flex-wrap">
              <span className="flex items-center gap-1 font-mono text-[11px] tabular-nums">
                <Clock className="w-3 h-3 text-slate-400" />
                {formatDate(capsule.created_at)}
              </span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="flex items-center gap-1 text-[11px]">
                <Languages className="w-3 h-3 text-slate-400" />
                {languageLabels[capsule.langue_dorigine] || capsule.langue_dorigine}
              </span>
            </div>
          </div>
        </div>

        {/* Circle Name Link & Quick Action Buttons (Bookmark & Share) */}
        <div className="flex items-center gap-1.5 self-start sm:self-center">
          <span className="inline-flex items-center text-xs font-semibold text-blue-700 bg-blue-50/80 px-2.5 py-1 rounded-lg border border-blue-200/60">
            {capsule.circle_nom}
          </span>

          {onToggleBookmark && (
            <button
              type="button"
              onClick={onToggleBookmark}
              className={`p-1.5 rounded-lg transition ${
                isBookmarked 
                  ? 'text-red-600 bg-red-50' 
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
              title={isBookmarked ? "Enregistré dans vos favoris" : "Enregistrer ce savoir"}
            >
              <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-red-600 text-red-600' : ''}`} />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(`Zaure Savoirs - ${capsule.circle_nom} : ${capsule.contenu.slice(0, 100)}...`);
                setCopiedShare(true);
                setTimeout(() => setCopiedShare(false), 2000);
              }
            }}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition relative"
            title="Partager cette publication"
          >
            {copiedShare ? <Check className="w-4 h-4 text-blue-600" /> : <Share2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Capsule Content Area with 'Lire la suite' */}
      <div className="mb-4 text-slate-800 text-sm leading-relaxed">
        {capsule.type === 'audio' ? (
          <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-3.5 sm:p-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={handlePlayPauseAudio}
                className="w-12 h-12 flex items-center justify-center bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-full shadow-md transition-all shrink-0 active:scale-95"
                aria-label={isPlaying ? "Mettre en pause l'enregistrement vocal" : "Écouter l'enregistrement vocal"}
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5 truncate">
                    <Volume2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>{t('capsule.audio_title')}</span>
                  </p>
                  <span className="text-[11px] font-mono text-slate-500 tabular-nums shrink-0">
                    {audioCurrentTime} / {audioDuration}
                  </span>
                </div>

                {/* Audio scrub track */}
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mt-2 relative">
                  <div
                    className="bg-blue-600 h-full transition-all duration-75 rounded-full"
                    style={{ width: `${audioProgress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="whitespace-pre-line text-slate-800 text-sm leading-relaxed font-normal">
              {capsule.contenu.length > 240 && !isExpanded
                ? `${capsule.contenu.slice(0, 240)}...`
                : capsule.contenu}
            </div>

            {capsule.contenu.length > 240 && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline mt-1.5 inline-block cursor-pointer"
              >
                {isExpanded ? "Afficher moins" : "Lire la suite..."}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Actions and Value-Based Reactions - Responsive */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
        
        {/* Anti-addiction reaction group (Utile, Merci, Question) */}
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
          {/* Reaction 1: Utile */}
          <button
            type="button"
            onClick={() => handleReact('utile')}
            className={`min-h-[40px] px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 ${
              hasReacted('utile')
                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60'
            }`}
            title="Cette capsule m'est utile"
          >
            <Lightbulb className={`w-3.5 h-3.5 ${hasReacted('utile') ? 'fill-blue-500 text-blue-600' : 'text-slate-500'}`} />
            <span className="hidden xs:inline">{t('capsule.react_useful')}</span>
            <span className="font-mono font-bold text-[11px] tabular-nums">
              {getReactionCount('utile')}
            </span>
          </button>

          {/* Reaction 2: Merci */}
          <button
            type="button"
            onClick={() => handleReact('merci')}
            className={`min-h-[40px] px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 ${
              hasReacted('merci')
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60'
            }`}
            title="Remercier l'auteur"
          >
            <Heart className={`w-3.5 h-3.5 ${hasReacted('merci') ? 'fill-red-500 text-red-600' : 'text-slate-500'}`} />
            <span className="hidden xs:inline">{t('capsule.react_thanks')}</span>
            <span className="font-mono font-bold text-[11px] tabular-nums">
              {getReactionCount('merci')}
            </span>
          </button>

          {/* Reaction 3: Question */}
          <button
            type="button"
            onClick={() => handleReact('question')}
            className={`min-h-[40px] px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 ${
              hasReacted('question')
                ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60'
            }`}
            title="Poser une question"
          >
            <HelpCircle className={`w-3.5 h-3.5 ${hasReacted('question') ? 'fill-indigo-500 text-indigo-600' : 'text-slate-500'}`} />
            <span className="hidden xs:inline">{t('capsule.react_question')}</span>
            <span className="font-mono font-bold text-[11px] tabular-nums">
              {getReactionCount('question')}
            </span>
          </button>
        </div>

        {/* Comment toggle button */}
        <button
          type="button"
          onClick={() => setShowComments(!showComments)}
          className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
            showComments 
              ? 'bg-blue-50 border-blue-300 text-blue-800' 
              : 'bg-slate-50 border-slate-200/60 hover:bg-slate-100 text-slate-700'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
          <span className="hidden sm:inline">{t('capsule.comments_count')}</span>
          <span className="font-mono font-bold text-[11px] tabular-nums">
            {comments.length}
          </span>
        </button>
      </div>

      {/* Expanded Comments Section */}
      {showComments && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-3 animate-fadeIn">
          {/* New comment input */}
          {currentUser ? (
            <form onSubmit={handleAddComment} className="flex gap-2">
              <input
                type="text"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder={t('capsule.comment_placeholder')}
                className="flex-1 text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 placeholder-slate-400"
              />
              <button
                type="submit"
                disabled={!newCommentText.trim()}
                className="min-h-[40px] px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl transition flex items-center justify-center font-bold text-xs shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <p className="text-xs text-slate-400 italic">
              Connectez-vous pour participer à la discussion.
            </p>
          )}

          {/* Comments list */}
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {comments.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-1">
                Aucun commentaire pour l'instant. Soyez le premier à réagir !
              </p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100 text-xs">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-slate-900">{c.auteur_nom}</span>
                    <span className="text-[10px] text-slate-400 font-mono tabular-nums">{formatDate(c.created_at)}</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">{c.texte}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </article>
  );
}
