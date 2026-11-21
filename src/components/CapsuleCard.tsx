import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageCircle,
  Lightbulb,
  Heart,
  HelpCircle,
  CheckCircle2,
  Award,
  User,
  Languages,
  Volume2,
  Send,
  Bookmark,
  Share2,
  Check,
  Globe,
  UsersRound,
  MoreHorizontal,
  Copy
} from 'lucide-react';
import { Capsule, Comment, Reaction, UserProfile } from '../types';
import { zaureService } from '../firebaseClient';
import { useTranslation } from '../context/LanguageContext';
import VoiceNotePlayer from './VoiceNotePlayer';

interface CapsuleCardProps {
  capsule: Capsule;
  currentUser: UserProfile | null;
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
  onAuthorClick?: (authorId: string) => void;
  key?: React.Key;
}

function buildAuthorHandle(name: string): string {
  const clean = (name || 'membre')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20);
  return clean ? `@${clean}` : '@membre';
}

function formatRelativeDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) {
      return `Hier à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
}

export default function CapsuleCard({
  capsule,
  currentUser,
  isBookmarked = false,
  onToggleBookmark,
  onAuthorClick
}: CapsuleCardProps) {
  const { t } = useTranslation();
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadReactionsAndComments();
  }, [capsule.id]);

  useEffect(() => {
    if (!showMenu) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showMenu]);

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
    if (!newCommentText.trim() || !currentUser || isSendingComment) return;

    setIsSendingComment(true);
    try {
      const added = await zaureService.addComment(capsule.id, newCommentText.trim());
      setComments((prev) => [...prev, added]);
      setNewCommentText('');
    } catch (e) {
      console.error(e);
    } finally {
      setIsSendingComment(false);
    }
  };

  const handleShare = async () => {
    const shareText = `Zaure Savoirs - ${capsule.circle_nom || 'Fil public'} : ${capsule.contenu.slice(0, 120)}...`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Savoir partagé par ${capsule.auteur_nom}`,
          text: shareText,
          url: window.location.origin
        });
      } else {
        await navigator.clipboard?.writeText?.(shareText);
      }
    } catch {
      try {
        await navigator.clipboard?.writeText?.(shareText);
      } catch {
        // ignore
      }
    }
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2200);
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard?.writeText?.(capsule.contenu);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      // ignore
    }
    setShowMenu(false);
  };

  const getReactionCount = (type: 'utile' | 'merci' | 'question') => {
    return reactions.filter((r) => r.type === type).length;
  };

  const hasReacted = (type: 'utile' | 'merci' | 'question') => {
    return reactions.some((r) => r.user_id === currentUser?.id && r.type === type);
  };

  const formatFullDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
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

  const totalReactions = reactions.length;
  const audioSrc = capsule.contenu.startsWith('data:audio')
    ? capsule.contenu
    : 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="bg-white border border-slate-200/85 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:shadow-[0_8px_24px_-8px_rgba(15,23,42,0.08)] transition-shadow duration-200 space-y-3.5"
      id={`capsule-card-${capsule.id}`}
    >
      {/* Author Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {onAuthorClick && capsule.auteur_id ? (
            <button
              type="button"
              onClick={() => onAuthorClick(capsule.auteur_id)}
              className="shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              title={`Voir le profil de ${capsule.auteur_nom}`}
            >
              {capsule.auteur_avatar ? (
                <img
                  src={capsule.auteur_avatar}
                  alt={capsule.auteur_nom}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover ring-1 ring-slate-200/80 bg-slate-100 hover:opacity-90 transition-opacity"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-10 h-10 sm:w-11 sm:h-11 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  {capsule.auteur_nom ? capsule.auteur_nom.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
                </div>
              )}
            </button>
          ) : capsule.auteur_avatar ? (
            <img
              src={capsule.auteur_avatar}
              alt={capsule.auteur_nom}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover ring-1 ring-slate-200/80 shrink-0 bg-slate-100"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-10 h-10 sm:w-11 sm:h-11 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm shrink-0">
              {capsule.auteur_nom ? capsule.auteur_nom.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {onAuthorClick && capsule.auteur_id ? (
                <button
                  type="button"
                  onClick={() => onAuthorClick(capsule.auteur_id)}
                  className="font-bold text-slate-950 hover:text-blue-700 text-[13.5px] sm:text-[15px] truncate text-left transition-colors"
                >
                  {capsule.auteur_nom}
                </button>
              ) : (
                <span className="font-bold text-slate-950 text-[13.5px] sm:text-[15px] truncate">
                  {capsule.auteur_nom}
                </span>
              )}

              <span className="text-[11px] font-medium text-slate-400 truncate">
                {buildAuthorHandle(capsule.auteur_nom)}
              </span>

              {capsule.auteur_role === 'verifie' && (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-blue-700">
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>{t('auth.role_verified')}</span>
                </span>
              )}
              {capsule.auteur_role === 'mentor' && (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-red-700">
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <Award className="w-3.5 h-3.5 text-red-600" />
                  <span>{t('auth.role_mentor')}</span>
                </span>
              )}
            </div>

            {/* Zero-Pill Unboxed Metadata with Typographic Separators */}
            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 flex-wrap">
              <span
                className="font-mono tabular-nums"
                title={formatFullDate(capsule.created_at)}
              >
                {formatRelativeDate(capsule.created_at)}
              </span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              {capsule.circle_id === 'public' ? (
                <span className="inline-flex items-center gap-1 font-medium text-blue-700">
                  <Globe className="w-3 h-3" />
                  <span>Public</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                  <UsersRound className="w-3 h-3 text-slate-400" />
                  <span className="truncate max-w-[140px]">{capsule.circle_nom}</span>
                </span>
              )}
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1">
                <Languages className="w-3 h-3 text-slate-400" />
                <span>{languageLabels[capsule.langue_dorigine] || capsule.langue_dorigine}</span>
              </span>
            </div>
          </div>
        </div>

        {/* 3-Dot Context Menu */}
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setShowMenu((prev) => !prev)}
            className="w-9 h-9 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition"
            title="Options de la publication"
            aria-label="Options de la publication"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>

          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.14 }}
                className="absolute right-0 mt-1.5 w-52 bg-white border border-slate-200/90 rounded-2xl shadow-xl z-30 p-1.5 space-y-0.5 origin-top-right"
              >
                {onToggleBookmark && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onToggleBookmark();
                    }}
                    className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-800 hover:bg-slate-50 flex items-center gap-2.5 transition"
                  >
                    <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-blue-600 text-blue-600' : 'text-slate-500'}`} />
                    <span>{isBookmarked ? 'Retirer des favoris' : 'Enregistrer'}</span>
                  </button>
                )}

                {capsule.type !== 'audio' && (
                  <button
                    type="button"
                    onClick={handleCopyText}
                    className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-800 hover:bg-slate-50 flex items-center gap-2.5 transition"
                  >
                    {copiedText ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-500" />
                    )}
                    <span>{copiedText ? 'Texte copié' : 'Copier le texte'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    handleShare();
                  }}
                  className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-800 hover:bg-slate-50 flex items-center gap-2.5 transition"
                >
                  <Share2 className="w-4 h-4 text-slate-500" />
                  <span>Partager</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Capsule Content Area */}
      <div className="text-slate-800">
        {capsule.type === 'audio' ? (
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-0.5">
              <span className="flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-blue-600" />
                <span>{t('capsule.audio_title')}</span>
              </span>
            </div>
            <VoiceNotePlayer url={audioSrc} />
          </div>
        ) : (
          <div className="text-[14px] sm:text-[15px] leading-[1.6] text-slate-800 whitespace-pre-line break-words">
            {capsule.contenu.length > 280 && !isExpanded
              ? `${capsule.contenu.slice(0, 280).trim()}...`
              : capsule.contenu}

            {capsule.contenu.length > 280 && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="ml-1.5 text-xs font-bold text-blue-700 hover:text-blue-800 hover:underline inline-block cursor-pointer"
              >
                {isExpanded ? 'Afficher moins' : 'Lire la suite'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Metrics Row */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
        <span className="tabular-nums font-medium">
          {totalReactions} réaction{totalReactions > 1 ? 's' : ''}
        </span>
        <button
          type="button"
          onClick={() => setShowComments(!showComments)}
          className="tabular-nums hover:text-slate-800 hover:underline transition"
        >
          {comments.length} commentaire{comments.length > 1 ? 's' : ''}
        </button>
      </div>

      {/* Actions and Value-Based Reactions */}
      <div className="flex items-center justify-between gap-1 pt-2 border-t border-slate-100 flex-wrap sm:flex-nowrap">
        {/* Reaction group (Utile, Merci, Question) */}
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => handleReact('utile')}
            className={`min-h-[40px] px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
              hasReacted('utile')
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-100/80'
            }`}
            title="Cette publication m'est utile"
          >
            <Lightbulb className={`w-4 h-4 ${hasReacted('utile') ? 'fill-blue-500 text-blue-600' : ''}`} />
            <span className="hidden xs:inline">{t('capsule.react_useful')}</span>
            {getReactionCount('utile') > 0 && (
              <span className="font-mono text-[11px] tabular-nums">{getReactionCount('utile')}</span>
            )}
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => handleReact('merci')}
            className={`min-h-[40px] px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
              hasReacted('merci')
                ? 'bg-red-50 text-red-600'
                : 'text-slate-600 hover:bg-slate-100/80'
            }`}
            title="Remercier l'auteur"
          >
            <Heart className={`w-4 h-4 ${hasReacted('merci') ? 'fill-red-500 text-red-600' : ''}`} />
            <span className="hidden xs:inline">{t('capsule.react_thanks')}</span>
            {getReactionCount('merci') > 0 && (
              <span className="font-mono text-[11px] tabular-nums">{getReactionCount('merci')}</span>
            )}
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => handleReact('question')}
            className={`min-h-[40px] px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
              hasReacted('question')
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-100/80'
            }`}
            title="Poser une question"
          >
            <HelpCircle className={`w-4 h-4 ${hasReacted('question') ? 'fill-indigo-500 text-indigo-600' : ''}`} />
            <span className="hidden xs:inline">{t('capsule.react_question')}</span>
            {getReactionCount('question') > 0 && (
              <span className="font-mono text-[11px] tabular-nums">{getReactionCount('question')}</span>
            )}
          </motion.button>
        </div>

        {/* Right Quick Actions: Comment + Share + Bookmark */}
        <div className="flex items-center gap-1 shrink-0">
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => setShowComments(!showComments)}
            className={`min-h-[40px] px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
              showComments
                ? 'bg-slate-100 text-slate-950'
                : 'text-slate-600 hover:bg-slate-100/80'
            }`}
            title="Commenter"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="hidden md:inline">Commenter</span>
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={handleShare}
            className={`min-h-[40px] px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
              copiedShare ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-100/80'
            }`}
            title="Partager"
          >
            {copiedShare ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
          </motion.button>

          {onToggleBookmark && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={onToggleBookmark}
              className={`min-h-[40px] px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                isBookmarked ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100/80'
              }`}
              title={isBookmarked ? 'Enregistré dans vos favoris' : 'Enregistrer'}
            >
              <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-blue-600 text-blue-600' : ''}`} />
            </motion.button>
          )}
        </div>
      </div>

      {/* Expanded Comments Section */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.18 }}
            className="pt-3 border-t border-slate-100 space-y-3"
          >
            {/* Comments list */}
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {comments.length === 0 ? (
                <p className="text-xs text-slate-400 py-1">
                  Aucun commentaire pour l'instant. Soyez le premier à réagir !
                </p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-800 font-bold text-[11px] flex items-center justify-center shrink-0">
                      {c.auteur_nom ? c.auteur_nom.charAt(0).toUpperCase() : 'M'}
                    </div>
                    <div className="flex-1 min-w-0 bg-slate-50 border border-slate-200/75 rounded-2xl px-3.5 py-2 text-xs">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="font-bold text-slate-900 truncate">{c.auteur_nom}</span>
                        <span className="text-[10px] text-slate-400 font-mono tabular-nums shrink-0">
                          {formatRelativeDate(c.created_at)}
                        </span>
                      </div>
                      <p className="text-slate-800 leading-relaxed whitespace-pre-wrap break-words">
                        {c.texte}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* New comment input */}
            {currentUser ? (
              <form onSubmit={handleAddComment} className="flex items-center gap-2 pt-1">
                {currentUser.avatar_url ? (
                  <img
                    src={currentUser.avatar_url}
                    alt={currentUser.nom}
                    className="w-8 h-8 rounded-full object-cover shrink-0 bg-slate-100 hidden xs:block"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs hidden xs:flex items-center justify-center shrink-0">
                    {currentUser.nom.charAt(0).toUpperCase()}
                  </div>
                )}
                <input
                  type="text"
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder={t('capsule.comment_placeholder')}
                  className="flex-1 text-xs sm:text-[13px] px-3.5 py-2.5 bg-slate-100/90 hover:bg-slate-100 focus:bg-white border border-transparent focus:border-blue-500 rounded-full focus:outline-none text-slate-900 placeholder-slate-400 transition"
                />
                <motion.button
                  type="submit"
                  whileTap={{ scale: 0.92 }}
                  disabled={!newCommentText.trim() || isSendingComment}
                  className="min-h-[40px] min-w-[40px] px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-45 text-white rounded-full transition flex items-center justify-center font-bold text-xs shrink-0 shadow-xs"
                >
                  <Send className="w-4 h-4" />
                </motion.button>
              </form>
            ) : (
              <p className="text-xs text-slate-400 italic">
                Connectez-vous pour participer à la discussion.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
