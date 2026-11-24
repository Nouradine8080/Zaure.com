import React, { useMemo, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ThumbsUp,
  MessageCircle,
  Share2,
  Bookmark,
  Pin,
  MoreHorizontal,
  Edit3,
  Trash2,
  Flag,
  Check,
  ExternalLink,
  Download,
  EyeOff,
  Clock,
  AlertTriangle,
  X,
  Globe,
  UsersRound,
  SmilePlus,
  Copy,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Film,
  Volume2
} from 'lucide-react';
import {
  CommunityGroup,
  CommunityMember,
  GroupPost,
  GroupReactionType,
  PostComment,
  PostReaction,
  UserProfile
} from '../../types';
import { communityService } from '../../services/communityService';
import { formatFileSize, getDocumentBadgeInfo } from '../../utils/fileValidation';
import CommunityCommentsSection from './CommunityCommentsSection';
import VoiceNotePlayer from '../VoiceNotePlayer';
import { ZAURE_MOTION, ZAURE_SURFACES } from '../../styles/designSystem';

interface CommunityPostCardProps {
  group: CommunityGroup;
  post: GroupPost;
  comments: PostComment[];
  reactions: PostReaction[];
  members: CommunityMember[];
  currentUser: UserProfile;
  currentMember?: CommunityMember;
  onAuthorClick?: (authorId: string) => void;
  key?: React.Key;
}

const REACTION_OPTIONS: { type: GroupReactionType; label: string; emoji: string; accent: string }[] = [
  { type: 'like', label: "J'aime", emoji: '👍', accent: 'text-blue-700 bg-blue-50/90' },
  { type: 'love', label: "J'adore", emoji: '❤️', accent: 'text-red-600 bg-red-50/90' },
  { type: 'useful', label: 'Utile', emoji: '💡', accent: 'text-amber-700 bg-amber-50/90' },
  { type: 'celebrate', label: 'Bravo', emoji: '🎉', accent: 'text-emerald-700 bg-emerald-50/90' },
  { type: 'insightful', label: 'Instructif', emoji: '🤔', accent: 'text-indigo-700 bg-indigo-50/90' }
];

function formatFullDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
}

function formatRelativeTime(iso: string): string {
  try {
    const date = new Date(iso);
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
    if (diffDays < 7) return `Il y a ${diffDays} j`;
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  } catch {
    return '';
  }
}

function buildAuthorHandle(name: string): string {
  const clean = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20);
  return clean ? `@${clean}` : '@membre';
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Lien externe';
  }
}

function renderFormattedContent(text: string): React.ReactNode {
  const tokens = text.split(/(https?:\/\/[^\s]+|#[a-zA-Z0-9À-ÿ_]+|@[a-zA-Z0-9À-ÿ_]+(?:\s[a-zA-Z0-9À-ÿ_]+)?)/g);
  return tokens.map((token, idx) => {
    if (token.startsWith('http://') || token.startsWith('https://')) {
      return (
        <a
          key={idx}
          href={token}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-700 underline decoration-blue-300 underline-offset-2 break-all"
        >
          {token}
        </a>
      );
    }
    if (token.startsWith('#') && token.length > 1) {
      return (
        <span key={idx} className="font-semibold text-blue-600 dark:text-blue-400">
          {token}
        </span>
      );
    }
    if (token.startsWith('@') && token.length > 1) {
      return (
        <span key={idx} className="font-semibold text-blue-700 dark:text-blue-400">
          {token}
        </span>
      );
    }
    return <React.Fragment key={idx}>{token}</React.Fragment>;
  });
}

export default function CommunityPostCard({
  group,
  post,
  comments,
  reactions,
  members,
  currentUser,
  currentMember,
  onAuthorClick
}: CommunityPostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isTextExpanded, setIsTextExpanded] = useState(false);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);

  // Modals & Lightbox gallery
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('Contenu inapproprié');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSent, setReportSent] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const reactionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu && !showReactionPicker) return;
    const close = (e: MouseEvent) => {
      if (showMenu && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
      if (showReactionPicker && reactionRef.current && !reactionRef.current.contains(e.target as Node)) {
        setShowReactionPicker(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showMenu, showReactionPicker]);

  const isAuthor = post.authorId === currentUser.id;
  const isActiveCommunityMember = group.id === 'public' || currentMember?.status === 'active';
  const isAdmin =
    (isActiveCommunityMember &&
      (currentMember?.role === 'administrateur' || group.createdBy === currentUser.id)) ||
    currentUser.email?.toLowerCase() === 'mahamadougarbamoussa8080@gmail.com';
  const canModeratePosts =
    isAdmin ||
    (isActiveCommunityMember &&
      currentMember?.role === 'moderateur' &&
      Boolean(currentMember.permissions?.approvePosts));

  const userReaction = useMemo(
    () => reactions.find((r) => r.userId === currentUser.id),
    [reactions, currentUser.id]
  );

  const isSaved = (post.savedBy || []).includes(currentUser.id);
  const authorMember = members.find((m) => m.userId === post.authorId);
  const isPublicFeed = group.id === 'public';

  const getPostUrl = () =>
    isPublicFeed
      ? `${window.location.origin}/?post=${encodeURIComponent(post.id)}`
      : `${window.location.origin}/?community=${encodeURIComponent(group.id)}&post=${encodeURIComponent(post.id)}`;

  const handleShare = async () => {
    const shareUrl = getPostUrl();
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Publication de ${post.isAnonymous ? 'Membre Zaure' : post.authorName}`,
          text: post.content.slice(0, 120),
          url: shareUrl
        });
      } else {
        await navigator.clipboard?.writeText?.(shareUrl);
      }
    } catch {
      try {
        await navigator.clipboard?.writeText?.(shareUrl);
      } catch {
        // ignore clipboard failure
      }
    }
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2400);
    await communityService.incrementPostShare(post.id, {
      post,
      actor: currentUser,
      groupName: group.name
    });
  };

  const handleCopyLinkOnly = async () => {
    try {
      await navigator.clipboard?.writeText?.(getPostUrl());
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // ignore
    }
    setShowMenu(false);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;
    await communityService.updateGroupPost(post.id, { content: editContent });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    await communityService.deleteGroupPost(post.id, group.id);
    setShowDeleteModal(false);
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await communityService.createReport({
      groupId: group.id,
      targetType: 'post',
      targetId: post.id,
      targetPreview: post.content.slice(0, 120) || post.type,
      reporter: currentUser,
      reason: reportReason,
      details: reportDetails
    });
    setReportSent(true);
    setTimeout(() => {
      setShowReportModal(false);
      setReportSent(false);
      setReportDetails('');
    }, 1500);
  };

  const totalPollVotes = useMemo(() => {
    if (!post.poll) return 0;
    const uniqueVoters = new Set<string>();
    post.poll.options.forEach((o) => o.voterIds.forEach((uid) => uniqueVoters.add(uid)));
    return uniqueVoters.size;
  }, [post.poll]);

  const images = useMemo(() => post.media.filter((m) => m.type === 'image'), [post.media]);
  const videos = useMemo(() => post.media.filter((m) => m.type === 'video'), [post.media]);
  const audios = useMemo(
    () => post.media.filter((m) => m.type === 'audio' || m.mimeType?.startsWith('audio/')),
    [post.media]
  );
  const docs = useMemo(
    () =>
      post.media.filter(
        (m) => m.type === 'document' && !m.mimeType?.startsWith('audio/')
      ),
    [post.media]
  );

  const reactionSummaryEmojis = useMemo(() => {
    const counts: Partial<Record<GroupReactionType, number>> = {};
    reactions.forEach((r) => {
      counts[r.type] = (counts[r.type] || 0) + 1;
    });
    return REACTION_OPTIONS.filter((opt) => (counts[opt.type] || 0) > 0)
      .sort((a, b) => (counts[b.type] || 0) - (counts[a.type] || 0))
      .slice(0, 3);
  }, [reactions]);

  const activeReactionMeta = userReaction
    ? REACTION_OPTIONS.find((r) => r.type === userReaction.type)
    : null;

  const isLongText = post.content && post.content.length > 340;
  const displayedText =
    isLongText && !isTextExpanded ? `${post.content.slice(0, 340).trim()}...` : post.content;

  const commentsCount = Math.max(0, comments.length || post.commentCount);
  const reactionCount = Math.max(0, reactions.length || post.reactionCount);

  return (
    <motion.article
      {...ZAURE_MOTION.fadeIn}
      className={`${ZAURE_SURFACES.cardInteractive} p-3.5 sm:p-5 space-y-3.5 min-w-0 overflow-x-clip`}
    >
      {/* Status Banner (Pinned / Pending / Scheduled) */}
      {(post.isPinned || post.status !== 'published') && (
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100 text-[11px] font-bold">
          <div className="flex items-center gap-2.5">
            {post.isPinned && (
              <span className="inline-flex items-center gap-1.5 text-blue-700">
                <Pin className="w-3.5 h-3.5 fill-blue-600" />
                <span>Publication épinglée</span>
              </span>
            )}
            {post.status === 'pending' && (
              <span className="inline-flex items-center gap-1.5 text-amber-700">
                <Clock className="w-3.5 h-3.5" />
                <span>En attente d'approbation</span>
              </span>
            )}
            {post.status === 'scheduled' && (
              <span className="inline-flex items-center gap-1.5 text-blue-700">
                <Clock className="w-3.5 h-3.5" />
                <span>Programmée · {post.scheduledFor ? formatFullDateTime(post.scheduledFor) : ''}</span>
              </span>
            )}
          </div>

          {canModeratePosts && post.status !== 'published' && (
            <button
              type="button"
              onClick={() => communityService.updateGroupPost(post.id, { status: 'published' })}
              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center gap-1 transition"
            >
              <Check className="w-3 h-3" />
              <span>Publier maintenant</span>
            </button>
          )}
        </div>
      )}

      {/* Author Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            {post.isAnonymous ? (
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-slate-800 text-white flex items-center justify-center ring-1 ring-slate-200">
                <EyeOff className="w-5 h-5" />
              </div>
            ) : onAuthorClick && post.authorId ? (
              <button
                type="button"
                onClick={() => onAuthorClick(post.authorId)}
                className="rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 block"
                title={`Voir le profil de ${post.authorName}`}
              >
                {post.authorAvatar ? (
                  <img
                    src={post.authorAvatar}
                    alt={post.authorName}
                    loading="lazy"
                    decoding="async"
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover bg-slate-100 ring-1 ring-slate-200/80 hover:opacity-90 transition-opacity"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center ring-1 ring-blue-500/20">
                    {post.authorName.charAt(0).toUpperCase()}
                  </div>
                )}
              </button>
            ) : post.authorAvatar ? (
              <img
                src={post.authorAvatar}
                alt={post.authorName}
                loading="lazy"
                decoding="async"
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover bg-slate-100 ring-1 ring-slate-200/80"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center ring-1 ring-blue-500/20">
                {post.authorName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {!post.isAnonymous && onAuthorClick && post.authorId ? (
                <button
                  type="button"
                  onClick={() => onAuthorClick(post.authorId)}
                  className="text-[13.5px] sm:text-[15px] font-bold text-slate-950 dark:text-white hover:text-blue-700 truncate text-left transition-colors"
                >
                  {post.authorName}
                </button>
              ) : (
                <span className="text-[13.5px] sm:text-[15px] font-bold text-slate-950 dark:text-white truncate">
                  {post.isAnonymous ? 'Membre anonyme' : post.authorName}
                </span>
              )}

              {!post.isAnonymous && (
                <span className="text-[11px] font-medium text-slate-400 truncate">
                  {buildAuthorHandle(post.authorName)}
                </span>
              )}

              {!post.isAnonymous && authorMember?.userId === group.createdBy && group.id !== 'public' ? (
                <span className="text-[11px] font-semibold text-indigo-700">
                  · Créateur
                </span>
              ) : !post.isAnonymous && authorMember?.role === 'administrateur' ? (
                <span className="text-[11px] font-semibold text-blue-700">
                  · Admin
                </span>
              ) : !post.isAnonymous && authorMember?.role === 'moderateur' ? (
                <span className="text-[11px] font-semibold text-emerald-700">
                  · Modérateur
                </span>
              ) : null}
            </div>

            {/* Zero-Pill Unboxed Metadata Line */}
            <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500 mt-0.5">
              <span
                className="font-mono tabular-nums"
                title={formatFullDateTime(post.createdAt)}
              >
                {formatRelativeTime(post.createdAt)}
              </span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              {isPublicFeed ? (
                <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 font-medium">
                  <Globe className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                  <span>Public</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 font-medium">
                  <UsersRound className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span className="truncate max-w-[160px]">{group.name}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Post Options 3-dot Menu */}
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
                className="absolute right-0 mt-1.5 w-56 bg-white border border-slate-200/90 rounded-2xl shadow-xl z-30 p-1.5 space-y-0.5 origin-top-right"
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    communityService.toggleSavePost(post.id, currentUser.id, isSaved);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-800 hover:bg-slate-50 flex items-center gap-2.5 transition"
                >
                  <Bookmark className={`w-4 h-4 ${isSaved ? 'text-blue-600 fill-blue-600' : 'text-slate-500'}`} />
                  <span>{isSaved ? 'Retirer des favoris' : 'Enregistrer la publication'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyLinkOnly}
                  className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-800 hover:bg-slate-50 flex items-center gap-2.5 transition"
                >
                  {linkCopied ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4 text-slate-500" />
                  )}
                  <span>{linkCopied ? 'Lien copié' : 'Copier le lien'}</span>
                </button>

                {canModeratePosts && !isPublicFeed && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      communityService.updateGroupPost(post.id, { isPinned: !post.isPinned });
                    }}
                    className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-800 hover:bg-slate-50 flex items-center gap-2.5 transition"
                  >
                    <Pin className="w-4 h-4 text-blue-600" />
                    <span>{post.isPinned ? 'Désépingler' : 'Épingler en haut'}</span>
                  </button>
                )}

                {isAuthor && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      setEditContent(post.content);
                      setIsEditing(true);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-800 hover:bg-slate-50 flex items-center gap-2.5 transition"
                  >
                    <Edit3 className="w-4 h-4 text-slate-600" />
                    <span>Modifier le texte</span>
                  </button>
                )}

                {!isAuthor && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      setShowReportModal(true);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-amber-700 hover:bg-amber-50 flex items-center gap-2.5 transition"
                  >
                    <Flag className="w-4 h-4" />
                    <span>Signaler</span>
                  </button>
                )}

                {(isAuthor || canModeratePosts) && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      setShowDeleteModal(true);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Supprimer</span>
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Body Content / Inline Edit */}
      {isEditing ? (
        <div className="space-y-2.5">
          <textarea
            rows={4}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full text-sm p-3.5 rounded-2xl border border-blue-400 bg-slate-50 focus:bg-white focus:outline-none text-slate-900 resize-none leading-relaxed"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition shadow-xs"
            >
              Enregistrer
            </button>
          </div>
        </div>
      ) : (
        post.content && (
          <div className="text-[14px] sm:text-[15px] text-slate-800 dark:text-slate-200 leading-[1.6] whitespace-pre-wrap break-words">
            {renderFormattedContent(displayedText)}
            {isLongText && (
              <button
                type="button"
                onClick={() => setIsTextExpanded((prev) => !prev)}
                className="ml-1.5 text-xs font-bold text-blue-700 hover:text-blue-800 hover:underline inline-block"
              >
                {isTextExpanded ? 'Afficher moins' : 'Lire la suite'}
              </button>
            )}
          </div>
        )
      )}

      {/* External Link Card */}
      {post.externalLink && (
        <a
          href={post.externalLink}
          target="_blank"
          rel="noopener noreferrer"
          className="group/link block p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 transition flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
              <Globe className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-blue-700 truncate">
                {extractDomain(post.externalLink)}
              </p>
              <p className="text-xs font-semibold text-slate-700 truncate mt-0.5">
                {post.externalLink}
              </p>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-slate-400 group-hover/link:text-blue-600 shrink-0 transition" />
        </a>
      )}

      {/* Images Showcase (Adaptive Multi-Photo Mosaic, Full-Bleed on Mobile) */}
      {images.length > 0 && (
        <div className="-mx-3.5 sm:mx-0 sm:rounded-2xl overflow-hidden bg-slate-100 border-y sm:border border-slate-200/70">
          {images.length === 1 && (
            <button
              type="button"
              onClick={() => setLightboxIndex(0)}
              className="relative group/img block w-full text-left bg-slate-950/5"
            >
              <img
                src={images[0].url}
                alt={images[0].name}
                loading="lazy"
                decoding="async"
                className="w-full max-h-[480px] object-cover group-hover/img:scale-[1.01] transition-transform duration-300"
                referrerPolicy="no-referrer"
              />
              <span className="opacity-0 group-hover/img:opacity-100 transition-opacity absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-950/60 text-white flex items-center justify-center backdrop-blur-xs">
                <Maximize2 className="w-4 h-4" />
              </span>
            </button>
          )}

          {images.length === 2 && (
            <div className="grid grid-cols-2 gap-1 bg-white">
              {images.map((img, i) => (
                <button
                  key={`${img.name}-${i}`}
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  className="relative group/img overflow-hidden bg-slate-100 aspect-[4/3]"
                >
                  <img
                    src={img.url}
                    alt={img.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover group-hover/img:scale-[1.02] transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                </button>
              ))}
            </div>
          )}

          {images.length === 3 && (
            <div className="grid grid-cols-2 gap-1 bg-white">
              <button
                type="button"
                onClick={() => setLightboxIndex(0)}
                className="relative group/img overflow-hidden bg-slate-100 row-span-2 min-h-[240px] sm:min-h-[300px]"
              >
                <img
                  src={images[0].url}
                  alt={images[0].name}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover group-hover/img:scale-[1.02] transition-transform duration-300"
                  referrerPolicy="no-referrer"
                />
              </button>
              {images.slice(1, 3).map((img, i) => (
                <button
                  key={`${img.name}-${i + 1}`}
                  type="button"
                  onClick={() => setLightboxIndex(i + 1)}
                  className="relative group/img overflow-hidden bg-slate-100 aspect-[4/3]"
                >
                  <img
                    src={img.url}
                    alt={img.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover group-hover/img:scale-[1.02] transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                </button>
              ))}
            </div>
          )}

          {images.length >= 4 && (
            <div className="grid grid-cols-2 gap-1 bg-white">
              {images.slice(0, 4).map((img, i) => {
                const remaining = images.length - 4;
                return (
                  <button
                    key={`${img.name}-${i}`}
                    type="button"
                    onClick={() => setLightboxIndex(i)}
                    className="relative group/img overflow-hidden bg-slate-100 aspect-[4/3]"
                  >
                    <img
                      src={img.url}
                      alt={img.name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover/img:scale-[1.02] transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                    {i === 3 && remaining > 0 && (
                      <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center text-white font-extrabold text-xl sm:text-2xl backdrop-blur-[1px]">
                        +{remaining}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Integrated Videos (Mobile Touch-Friendly Controls) */}
      {videos.map((vid, i) => (
        <div
          key={`${vid.name}-${i}`}
          className="-mx-3.5 sm:mx-0 sm:rounded-2xl overflow-hidden bg-slate-950 border-y sm:border border-slate-200/80"
        >
          <video
            src={vid.url}
            controls
            playsInline
            preload="metadata"
            className="w-full max-h-[440px] bg-black"
          />
          <div className="px-3.5 py-2 bg-slate-900/95 flex items-center justify-between text-[11px] text-slate-300">
            <span className="flex items-center gap-1.5 truncate">
              <Film className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span className="truncate">{vid.name}</span>
            </span>
            {vid.size && (
              <span className="font-mono text-[10px] text-slate-400 tabular-nums shrink-0 ml-2">
                {formatFileSize(vid.size)}
              </span>
            )}
          </div>
        </div>
      ))}

      {/* Voice Notes (Waveform Audio Player) */}
      {audios.length > 0 && (
        <div className="space-y-2">
          {audios.map((aud, i) => (
            <div
              key={`${aud.name}-${i}`}
              className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2"
            >
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 px-0.5">
                <span className="flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Note vocale partagée</span>
                </span>
                {aud.size && (
                  <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                    {formatFileSize(aud.size)}
                  </span>
                )}
              </div>
              <VoiceNotePlayer url={aud.url} />
            </div>
          ))}
        </div>
      )}

      {/* Documents */}
      {docs.length > 0 && (
        <div className="space-y-2">
          {docs.map((docItem, i) => {
            const badge = getDocumentBadgeInfo(docItem.name, docItem.mimeType);
            return (
              <a
                key={`${docItem.name}-${i}`}
                href={docItem.url}
                target="_blank"
                rel="noopener noreferrer"
                download={docItem.name}
                className="group/doc flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 hover:bg-slate-100/90 border border-slate-200/80 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-extrabold text-[10px] shrink-0 ${badge.badgeBg}`}>
                    {badge.label}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate group-hover/doc:text-blue-700 transition-colors">
                      {docItem.name}
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                      {docItem.size ? formatFileSize(docItem.size) : 'Document joint'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200/80 text-[11px] font-bold text-blue-700 shrink-0 shadow-2xs">
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Télécharger</span>
                </div>
              </a>
            );
          })}
        </div>
      )}

      {/* Interactive Poll */}
      {post.poll && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/90 border border-slate-200/80 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs sm:text-sm font-extrabold text-slate-900 leading-snug">
              {post.poll.question}
            </p>
            <span className="text-[11px] font-semibold text-slate-500 tabular-nums shrink-0">
              {totalPollVotes} vote{totalPollVotes > 1 ? 's' : ''}
            </span>
          </div>

          <div className="space-y-2">
            {post.poll.options.map((opt) => {
              const isVoted = opt.voterIds.includes(currentUser.id);
              const pct = totalPollVotes > 0 ? Math.round((opt.voterIds.length / totalPollVotes) * 100) : 0;
              return (
                <motion.button
                  key={opt.id}
                  type="button"
                  whileTap={{ scale: 0.99 }}
                  onClick={() => communityService.votePoll(post, opt.id, currentUser.id)}
                  className={`relative w-full text-left p-2.5 sm:p-3 rounded-xl border overflow-hidden transition ${
                    isVoted
                      ? 'border-blue-600 bg-white ring-1 ring-blue-500/25'
                      : 'border-slate-200 bg-white hover:border-blue-300'
                  }`}
                >
                  <motion.div
                    initial={false}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className={`absolute inset-y-0 left-0 ${
                      isVoted ? 'bg-blue-100/85' : 'bg-slate-100/85'
                    }`}
                  />
                  <div className="relative z-10 flex items-center justify-between gap-2 text-xs">
                    <span className={`font-bold flex items-center gap-1.5 ${isVoted ? 'text-blue-900' : 'text-slate-800'}`}>
                      {isVoted && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                      <span>{opt.text}</span>
                    </span>
                    <span className="font-mono font-bold text-slate-700 tabular-nums">{pct}%</span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* Metrics Row (Tabular Numerals + Clean Separation) */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
        <div className="flex items-center gap-1.5">
          {reactionSummaryEmojis.length > 0 && (
            <span className="flex items-center -space-x-1">
              {reactionSummaryEmojis.map((r) => (
                <span
                  key={r.type}
                  className="text-xs bg-white rounded-full ring-1 ring-slate-100"
                >
                  {r.emoji}
                </span>
              ))}
            </span>
          )}
          <span className="tabular-nums font-medium">
            {reactionCount} réaction{reactionCount > 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-3 tabular-nums">
          <button
            type="button"
            onClick={() => setShowComments((prev) => !prev)}
            className="hover:text-slate-800 hover:underline transition"
          >
            {commentsCount} commentaire{commentsCount > 1 ? 's' : ''}
          </button>
          <span>
            {Math.max(0, post.shareCount)} partage{post.shareCount > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Primary Action Bar (Tactile & Mobile-Ready with Explicit Réagir Picker) */}
      <div className="relative flex items-center justify-between gap-1 pt-2 border-t border-slate-100">
        {/* J'aime + Réagir Group */}
        <div
          ref={reactionRef}
          className="relative flex items-center flex-1 min-w-0"
          onMouseEnter={() => setShowReactionPicker(true)}
          onMouseLeave={() => setShowReactionPicker(false)}
        >
          <motion.button
            type="button"
            whileTap={{ scale: 0.93 }}
            onClick={() =>
              communityService.togglePostReaction(
                post,
                currentUser,
                userReaction?.type || 'like',
                userReaction
              )
            }
            onContextMenu={(e) => {
              e.preventDefault();
              setShowReactionPicker((prev) => !prev);
            }}
            className={`flex-1 min-h-[42px] px-2 rounded-l-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              activeReactionMeta
                ? activeReactionMeta.accent
                : 'text-slate-600 hover:bg-slate-100/80'
            }`}
          >
            {activeReactionMeta ? (
              <motion.span
                key={activeReactionMeta.type}
                initial={{ scale: 0.7 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 450, damping: 18 }}
                className="text-sm leading-none"
              >
                {activeReactionMeta.emoji}
              </motion.span>
            ) : (
              <ThumbsUp className="w-4 h-4" />
            )}
            <span className="truncate">
              {activeReactionMeta ? activeReactionMeta.label : "J'aime"}
            </span>
          </motion.button>

          {/* Touch-friendly Réagir button for Android & iOS */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowReactionPicker((prev) => !prev)}
            className={`min-h-[42px] px-2 rounded-r-xl text-slate-400 hover:text-blue-600 hover:bg-slate-100/80 flex items-center justify-center transition ${
              showReactionPicker ? 'bg-slate-100 text-blue-600' : ''
            }`}
            title="Choisir une réaction"
            aria-label="Choisir une réaction"
          >
            <SmilePlus className="w-3.5 h-3.5" />
          </motion.button>

          <AnimatePresence>
            {showReactionPicker && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.94 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="absolute bottom-full left-0 mb-2 bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5 flex items-center gap-1 z-30"
              >
                {REACTION_OPTIONS.map((opt) => (
                  <motion.button
                    key={opt.type}
                    type="button"
                    whileHover={{ scale: 1.12, y: -2 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      setShowReactionPicker(false);
                      communityService.togglePostReaction(post, currentUser, opt.type, userReaction);
                    }}
                    className={`px-2 py-1.5 rounded-xl transition flex flex-col items-center text-[10px] font-semibold ${
                      userReaction?.type === opt.type
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                    title={opt.label}
                  >
                    <span className="text-lg leading-none">{opt.emoji}</span>
                    <span className="mt-0.5">{opt.label}</span>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.button
          type="button"
          whileTap={{ scale: 0.93 }}
          onClick={() => setShowComments((prev) => !prev)}
          className={`flex-1 min-h-[42px] px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
            showComments ? 'bg-slate-100 text-slate-950' : 'text-slate-600 hover:bg-slate-100/80'
          }`}
          title="Commenter"
        >
          <MessageCircle className="w-4 h-4" />
          <span className="hidden sm:inline">Commenter</span>
        </motion.button>

        <motion.button
          type="button"
          whileTap={{ scale: 0.93 }}
          onClick={handleShare}
          className={`flex-1 min-h-[42px] px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
            shareCopied ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-100/80'
          }`}
          title="Partager"
        >
          {shareCopied ? (
            <Check className="w-4 h-4 text-emerald-600" />
          ) : (
            <Share2 className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">{shareCopied ? 'Copié' : 'Partager'}</span>
        </motion.button>

        <motion.button
          type="button"
          whileTap={{ scale: 0.93 }}
          onClick={() => communityService.toggleSavePost(post.id, currentUser.id, isSaved)}
          className={`flex-1 min-h-[42px] px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
            isSaved ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100/80'
          }`}
          title={isSaved ? 'Enregistré dans vos favoris' : 'Enregistrer'}
        >
          <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-blue-600 text-blue-600' : ''}`} />
          <span className="hidden sm:inline">{isSaved ? 'Enregistré' : 'Enregistrer'}</span>
        </motion.button>
      </div>

      {/* Interactive Comments Section */}
      <AnimatePresence>
        {showComments && (
          <CommunityCommentsSection
            group={group}
            post={post}
            comments={comments}
            members={members}
            currentUser={currentUser}
            currentMember={currentMember}
          />
        )}
      </AnimatePresence>

      {/* Multi-Image Lightbox Modal */}
      {lightboxIndex !== null && images[lightboxIndex] &&
        createPortal(
          <div
            className="fixed inset-0 bg-slate-950/92 flex items-center justify-center p-4 z-50 animate-fadeIn"
            onClick={() => setLightboxIndex(null)}
          >
            <button
              type="button"
              onClick={() => setLightboxIndex(null)}
              className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex((prev) =>
                      prev !== null ? (prev - 1 + images.length) % images.length : 0
                    );
                  }}
                  className="absolute left-3 sm:left-6 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition"
                  title="Image précédente"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex((prev) =>
                      prev !== null ? (prev + 1) % images.length : 0
                    );
                  }}
                  className="absolute right-3 sm:right-6 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition"
                  title="Image suivante"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}

            <img
              src={images[lightboxIndex].url}
              alt={images[lightboxIndex].name}
              className="max-w-full max-h-[86vh] rounded-2xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />

            {images.length > 1 && (
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-slate-900/80 text-white text-xs font-mono tabular-nums">
                {lightboxIndex + 1} / {images.length}
              </div>
            )}
          </div>,
          document.body
        )}

      {/* Delete Post Confirmation Modal */}
      {showDeleteModal &&
        createPortal(
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50"
            onClick={() => setShowDeleteModal(false)}
          >
            <div
              className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl border border-slate-100 space-y-4 animate-slideUp"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-950 text-sm">Supprimer la publication ?</h3>
                  <p className="text-xs text-slate-500">Elle sera retirée définitivement.</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="min-h-[40px] px-4 py-2 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="min-h-[40px] px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl"
                >
                  Oui, supprimer
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Report Post Modal */}
      {showReportModal &&
        createPortal(
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50"
            onClick={() => setShowReportModal(false)}
          >
            <div
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4 animate-slideUp"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-slate-950 text-sm flex items-center gap-2">
                  <Flag className="w-4 h-4 text-red-600" />
                  <span>Signaler cette publication</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {reportSent ? (
                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-xs font-bold text-blue-800 text-center">
                  Signalement transmis aux modérateurs. Merci !
                </div>
              ) : (
                <form onSubmit={handleReportSubmit} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Motif</label>
                    <select
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      className="w-full text-xs px-3 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-900"
                    >
                      <option value="Contenu inapproprié">Contenu inapproprié</option>
                      <option value="Spam ou publicité">Spam ou publicité</option>
                      <option value="Harcèlement">Harcèlement</option>
                      <option value="Désinformation">Désinformation</option>
                      <option value="Hors-sujet">Hors-sujet par rapport aux règles</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Détails (optionnel)</label>
                    <textarea
                      rows={3}
                      value={reportDetails}
                      onChange={(e) => setReportDetails(e.target.value)}
                      placeholder="Expliquez brièvement pourquoi ce contenu pose problème..."
                      className="w-full text-xs p-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-900 resize-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowReportModal(false)}
                      className="min-h-[40px] px-4 py-2 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="min-h-[40px] px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl"
                    >
                      Envoyer le signalement
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>,
          document.body
        )}
    </motion.article>
  );
}
