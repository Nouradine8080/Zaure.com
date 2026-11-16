import React, { useMemo, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ThumbsUp,
  Heart,
  Lightbulb,
  Sparkles,
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
  FileText,
  EyeOff,
  Clock,
  AlertTriangle,
  X
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

interface CommunityPostCardProps {
  group: CommunityGroup;
  post: GroupPost;
  comments: PostComment[];
  reactions: PostReaction[];
  members: CommunityMember[];
  currentUser: UserProfile;
  currentMember?: CommunityMember;
  key?: React.Key;
}

const REACTION_OPTIONS: { type: GroupReactionType; label: string; emoji: string }[] = [
  { type: 'like', label: "J'aime", emoji: '👍' },
  { type: 'love', label: "J'adore", emoji: '❤️' },
  { type: 'useful', label: 'Utile', emoji: '💡' },
  { type: 'celebrate', label: 'Bravo', emoji: '🎉' },
  { type: 'insightful', label: 'Instructif', emoji: '🤔' }
];

function formatDateTime(iso: string): string {
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

export default function CommunityPostCard({
  group,
  post,
  comments,
  reactions,
  members,
  currentUser,
  currentMember
}: CommunityPostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);

  // Modals
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('Contenu inapproprié');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSent, setReportSent] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);

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

  const isAuthor = post.authorId === currentUser.id;
  const isAdmin = currentMember?.role === 'administrateur' || currentUser.email?.toLowerCase() === 'mahamadougarbamoussa8080@gmail.com';
  const canModeratePosts =
    isAdmin ||
    (currentMember?.role === 'moderateur' && Boolean(currentMember.permissions?.approvePosts));

  const userReaction = useMemo(
    () => reactions.find((r) => r.userId === currentUser.id),
    [reactions, currentUser.id]
  );

  const isSaved = (post.savedBy || []).includes(currentUser.id);
  const authorMember = members.find((m) => m.userId === post.authorId);

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/?community=${encodeURIComponent(group.id)}&post=${encodeURIComponent(post.id)}`;
    try {
      await navigator.clipboard?.writeText?.(shareUrl);
    } catch {
      // ignore
    }
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2500);
    await communityService.incrementPostShare(post.id);
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

  const images = post.media.filter((m) => m.type === 'image');
  const videos = post.media.filter((m) => m.type === 'video');
  const docs = post.media.filter((m) => m.type === 'document');

  const reactionSummaryEmojis = useMemo(() => {
    const counts: Partial<Record<GroupReactionType, number>> = {};
    reactions.forEach((r) => {
      counts[r.type] = (counts[r.type] || 0) + 1;
    });
    return REACTION_OPTIONS.filter((opt) => (counts[opt.type] || 0) > 0).slice(0, 3);
  }, [reactions]);

  return (
    <article className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
      {/* Status Banner (Pinned / Pending / Scheduled) */}
      {(post.isPinned || post.status !== 'published') && (
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 text-[11px] font-bold">
          <div className="flex items-center gap-2">
            {post.isPinned && (
              <span className="inline-flex items-center gap-1 text-blue-700">
                <Pin className="w-3.5 h-3.5 fill-blue-600" />
                <span>Publication épinglée</span>
              </span>
            )}
            {post.status === 'pending' && (
              <span className="inline-flex items-center gap-1 text-amber-700">
                <Clock className="w-3.5 h-3.5" />
                <span>En attente d'approbation</span>
              </span>
            )}
            {post.status === 'scheduled' && (
              <span className="inline-flex items-center gap-1 text-blue-700">
                <Clock className="w-3.5 h-3.5" />
                <span>Programmée pour le {post.scheduledFor ? formatDateTime(post.scheduledFor) : ''}</span>
              </span>
            )}
          </div>

          {canModeratePosts && post.status !== 'published' && (
            <button
              type="button"
              onClick={() => communityService.updateGroupPost(post.id, { status: 'published' })}
              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center gap-1"
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
          {post.isAnonymous ? (
            <div className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0">
              <EyeOff className="w-5 h-5" />
            </div>
          ) : post.authorAvatar ? (
            <img
              src={post.authorAvatar}
              alt={post.authorName}
              className="w-10 h-10 rounded-full object-cover shrink-0 bg-slate-100"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
              {post.authorName.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                {post.isAnonymous ? 'Membre anonyme' : post.authorName}
              </span>
              {!post.isAnonymous && authorMember?.role === 'administrateur' && (
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md">
                  Admin
                </span>
              )}
              {!post.isAnonymous && authorMember?.role === 'moderateur' && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                  Modérateur
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              {formatDateTime(post.createdAt)}
            </p>
          </div>
        </div>

        {/* Post Options 3-dot Menu */}
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setShowMenu((prev) => !prev)}
            className="w-9 h-9 rounded-xl hover:bg-slate-100 text-slate-500 flex items-center justify-center transition"
            title="Options de la publication"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>

          {showMenu && (
            <div className="absolute right-0 mt-1.5 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 p-1.5 space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  communityService.toggleSavePost(post.id, currentUser.id, isSaved);
                }}
                className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 hover:bg-slate-50 flex items-center gap-2"
              >
                <Bookmark className={`w-4 h-4 ${isSaved ? 'text-blue-600 fill-blue-600' : 'text-slate-500'}`} />
                <span>{isSaved ? 'Retirer des favoris' : 'Enregistrer'}</span>
              </button>

              {canModeratePosts && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    communityService.updateGroupPost(post.id, { isPinned: !post.isPinned });
                  }}
                  className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 hover:bg-slate-50 flex items-center gap-2"
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
                  className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 hover:bg-slate-50 flex items-center gap-2"
                >
                  <Edit3 className="w-4 h-4 text-slate-600" />
                  <span>Modifier</span>
                </button>
              )}

              {!isAuthor && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    setShowReportModal(true);
                  }}
                  className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-amber-700 hover:bg-amber-50 flex items-center gap-2"
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
                  className="w-full px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Supprimer</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Body Content / Inline Edit */}
      {isEditing ? (
        <div className="space-y-2">
          <textarea
            rows={3}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full text-xs sm:text-sm p-3 rounded-xl border border-blue-400 focus:outline-none text-slate-900 resize-none"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              className="px-4 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-xl"
            >
              Enregistrer
            </button>
          </div>
        </div>
      ) : (
        post.content && (
          <p className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap break-words">
            {post.content}
          </p>
        )
      )}

      {/* External Link Card */}
      {post.externalLink && (
        <a
          href={post.externalLink}
          target="_blank"
          rel="noopener noreferrer"
          className="block p-3.5 rounded-2xl bg-[#F0F2F5] hover:bg-slate-200/70 border border-slate-200/80 transition flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wide">
              Lien partagé
            </p>
            <p className="text-xs font-semibold text-slate-800 truncate mt-0.5">
              {post.externalLink}
            </p>
          </div>
          <ExternalLink className="w-4 h-4 text-blue-600 shrink-0" />
        </a>
      )}

      {/* Images Grid */}
      {images.length > 0 && (
        <div
          className={`grid gap-2 ${
            images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
          }`}
        >
          {images.map((img, i) => (
            <button
              key={`${img.name}-${i}`}
              type="button"
              onClick={() => setLightboxImage(img.url)}
              className="rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/60 block w-full text-left"
            >
              <img
                src={img.url}
                alt={img.name}
                className={`w-full object-cover hover:opacity-95 transition ${
                  images.length === 1 ? 'max-h-[420px]' : 'h-44 sm:h-52'
                }`}
                referrerPolicy="no-referrer"
              />
            </button>
          ))}
        </div>
      )}

      {/* Videos */}
      {videos.map((vid, i) => (
        <div key={`${vid.name}-${i}`} className="rounded-2xl overflow-hidden bg-slate-950 border border-slate-200">
          <video
            src={vid.url}
            controls
            playsInline
            className="w-full max-h-[400px]"
          />
        </div>
      ))}

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
                className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#F0F2F5] hover:bg-slate-200/70 border border-slate-200/70 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-extrabold text-[10px] shrink-0 ${badge.badgeBg}`}>
                    {badge.label}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{docItem.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {docItem.size ? formatFileSize(docItem.size) : 'Document partagé'}
                    </p>
                  </div>
                </div>
                <Download className="w-4 h-4 text-blue-600 shrink-0" />
              </a>
            );
          })}
        </div>
      )}

      {/* Interactive Poll */}
      {post.poll && (
        <div className="p-4 rounded-2xl bg-[#F0F2F5] border border-slate-200/70 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs sm:text-sm font-extrabold text-slate-900">{post.poll.question}</p>
            <span className="text-[11px] font-semibold text-slate-500 tabular-nums shrink-0">
              {totalPollVotes} vote{totalPollVotes > 1 ? 's' : ''}
            </span>
          </div>

          <div className="space-y-2">
            {post.poll.options.map((opt) => {
              const isVoted = opt.voterIds.includes(currentUser.id);
              const pct = totalPollVotes > 0 ? Math.round((opt.voterIds.length / totalPollVotes) * 100) : 0;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => communityService.votePoll(post, opt.id, currentUser.id)}
                  className={`relative w-full text-left p-2.5 rounded-xl border overflow-hidden transition ${
                    isVoted
                      ? 'border-blue-600 bg-white ring-1 ring-blue-500/30'
                      : 'border-slate-200 bg-white hover:border-blue-300'
                  }`}
                >
                  <div
                    className={`absolute inset-y-0 left-0 transition-all duration-300 ${
                      isVoted ? 'bg-blue-100/80' : 'bg-slate-100/80'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                  <div className="relative z-10 flex items-center justify-between gap-2 text-xs">
                    <span className={`font-bold flex items-center gap-1.5 ${isVoted ? 'text-blue-900' : 'text-slate-800'}`}>
                      {isVoted && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                      <span>{opt.text}</span>
                    </span>
                    <span className="font-mono font-bold text-slate-700 tabular-nums">{pct}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
        <div className="flex items-center gap-1.5">
          {reactionSummaryEmojis.length > 0 && (
            <span className="flex items-center -space-x-1">
              {reactionSummaryEmojis.map((r) => (
                <span key={r.type} className="text-xs">
                  {r.emoji}
                </span>
              ))}
            </span>
          )}
          <span className="tabular-nums font-medium">
            {Math.max(0, post.reactionCount)} réaction{post.reactionCount > 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-3 tabular-nums">
          <button
            type="button"
            onClick={() => setShowComments((prev) => !prev)}
            className="hover:underline"
          >
            {Math.max(0, comments.length || post.commentCount)} commentaire{(comments.length || post.commentCount) > 1 ? 's' : ''}
          </button>
          <span>
            {Math.max(0, post.shareCount)} partage{post.shareCount > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Primary Action Bar */}
      <div className="relative grid grid-cols-4 gap-1 pt-2 border-t border-slate-100">
        {/* Reaction Trigger */}
        <div
          className="relative"
          onMouseEnter={() => setShowReactionPicker(true)}
          onMouseLeave={() => setShowReactionPicker(false)}
        >
          <button
            type="button"
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
            className={`w-full min-h-[42px] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              userReaction
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {userReaction ? (
              <span>{REACTION_OPTIONS.find((r) => r.type === userReaction.type)?.emoji}</span>
            ) : (
              <ThumbsUp className="w-4 h-4" />
            )}
            <span className="truncate">
              {userReaction
                ? REACTION_OPTIONS.find((r) => r.type === userReaction.type)?.label
                : "J'aime"}
            </span>
          </button>

          {showReactionPicker && (
            <div className="absolute bottom-full left-0 mb-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5 flex items-center gap-1 z-30">
              {REACTION_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => {
                    setShowReactionPicker(false);
                    communityService.togglePostReaction(post, currentUser, opt.type, userReaction);
                  }}
                  className="px-2 py-1.5 rounded-xl hover:bg-slate-100 transition flex flex-col items-center text-[10px] font-semibold text-slate-700"
                  title={opt.label}
                >
                  <span className="text-base leading-none">{opt.emoji}</span>
                  <span className="mt-0.5">{opt.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowComments((prev) => !prev)}
          className={`min-h-[42px] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
            showComments ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          <span className="hidden sm:inline">Commenter</span>
        </button>

        <button
          type="button"
          onClick={handleShare}
          className="min-h-[42px] rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 flex items-center justify-center gap-1.5 transition"
        >
          {shareCopied ? (
            <Check className="w-4 h-4 text-blue-600" />
          ) : (
            <Share2 className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">{shareCopied ? 'Copié' : 'Partager'}</span>
        </button>

        <button
          type="button"
          onClick={() => communityService.toggleSavePost(post.id, currentUser.id, isSaved)}
          className={`min-h-[42px] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
            isSaved ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-blue-600 text-blue-600' : ''}`} />
          <span className="hidden sm:inline">{isSaved ? 'Enregistré' : 'Favori'}</span>
        </button>
      </div>

      {/* Interactive Comments Section */}
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

      {/* Lightbox Image Modal */}
      {lightboxImage &&
        createPortal(
          <div
            className="fixed inset-0 bg-slate-950/90 flex items-center justify-center p-4 z-50"
            onClick={() => setLightboxImage(null)}
          >
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={lightboxImage}
              alt="Aperçu"
              className="max-w-full max-h-[88vh] rounded-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
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
              className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl border border-slate-100 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-950 text-sm">Supprimer la publication ?</h3>
                  <p className="text-xs text-slate-500">Elle sera retirée définitivement du cercle.</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="min-h-[40px] px-4 py-2 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl"
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
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4"
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
                  Signalement transmis aux modérateurs du cercle. Merci !
                </div>
              ) : (
                <form onSubmit={handleReportSubmit} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Motif</label>
                    <select
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      className="w-full text-xs px-3 py-2.5 rounded-xl bg-[#F0F2F5] border border-slate-200 text-slate-900"
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
                      className="w-full text-xs p-3 rounded-xl bg-[#F0F2F5] border border-slate-200 text-slate-900 resize-none"
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
    </article>
  );
}
