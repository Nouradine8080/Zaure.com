import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send,
  Heart,
  Reply,
  Edit3,
  Trash2,
  AtSign,
  Check,
  X,
  AlertTriangle,
  MessageSquare
} from 'lucide-react';
import {
  CommunityGroup,
  CommunityMember,
  GroupPost,
  PostComment,
  UserProfile
} from '../../types';
import { communityService } from '../../services/communityService';

interface CommunityCommentsSectionProps {
  group: CommunityGroup;
  post: GroupPost;
  comments: PostComment[];
  members: CommunityMember[];
  currentUser: UserProfile;
  currentMember?: CommunityMember;
}

function formatTime(iso: string): string {
  try {
    const date = new Date(iso);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
}

function renderHighlightedComment(text: string): React.ReactNode {
  const parts = text.split(/(@[a-zA-Z0-9À-ÿ_]+(?:\s[a-zA-Z0-9À-ÿ_]+)?)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('@') && part.length > 1) {
      return (
        <span key={idx} className="font-semibold text-blue-700">
          {part}
        </span>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export default function CommunityCommentsSection({
  group,
  post,
  comments,
  members,
  currentUser,
  currentMember
}: CommunityCommentsSectionProps) {
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<PostComment | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [selectedMentions, setSelectedMentions] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [pendingDeleteComment, setPendingDeleteComment] = useState<PostComment | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canModerateComments =
    currentMember?.role === 'administrateur' ||
    (currentMember?.role === 'moderateur' && Boolean(currentMember.permissions?.manageComments)) ||
    currentUser.email?.toLowerCase() === 'mahamadougarbamoussa8080@gmail.com';

  const topLevelComments = useMemo(
    () => comments.filter((c) => !c.parentId),
    [comments]
  );

  const repliesByParent = useMemo(() => {
    const map: Record<string, PostComment[]> = {};
    comments.forEach((c) => {
      if (c.parentId) {
        if (!map[c.parentId]) map[c.parentId] = [];
        map[c.parentId].push(c);
      }
    });
    return map;
  }, [comments]);

  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return members
      .filter((m) => m.status === 'active' && m.userName.toLowerCase().includes(q))
      .slice(0, 6);
  }, [members, mentionQuery]);

  const handleInputChange = (val: string) => {
    setNewComment(val);
    const match = val.match(/@([a-zA-Z0-9À-ÿ_\s]{0,25})$/);
    if (match) {
      setMentionQuery(match[1]);
    } else {
      setMentionQuery(null);
    }
  };

  const handleInsertMention = (member: CommunityMember) => {
    const replaced = newComment.replace(/@([a-zA-Z0-9À-ÿ_\s]{0,25})$/, `@${member.userName} `);
    setNewComment(replaced);
    if (!selectedMentions.includes(member.userId)) {
      setSelectedMentions((prev) => [...prev, member.userId]);
    }
    setMentionQuery(null);
  };

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setIsSending(true);
    setError(null);
    try {
      await communityService.addPostComment(
        group,
        post,
        currentUser,
        newComment,
        replyingTo?.id || null,
        selectedMentions
      );
      setNewComment('');
      setReplyingTo(null);
      setSelectedMentions([]);
      setMentionQuery(null);
    } catch (err: any) {
      setError(err?.message || 'Impossible de publier le commentaire.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!editContent.trim()) return;
    try {
      await communityService.updatePostComment(commentId, editContent);
      setEditingCommentId(null);
      setEditContent('');
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la modification.');
    }
  };

  const confirmDelete = async () => {
    if (!pendingDeleteComment) return;
    try {
      await communityService.deletePostComment(pendingDeleteComment.id, post.id);
      setPendingDeleteComment(null);
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la suppression.');
    }
  };

  const renderCommentNode = (comment: PostComment, isReply = false) => {
    const isAuthor = comment.authorId === currentUser.id;
    const isLiked = (comment.likedBy || []).includes(currentUser.id);
    const likeCount = (comment.likedBy || []).length;
    const childReplies = repliesByParent[comment.id] || [];
    const authorMember = members.find((m) => m.userId === comment.authorId);

    return (
      <motion.div
        key={comment.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className={isReply ? 'ml-7 sm:ml-10 mt-2.5' : 'mt-3'}
      >
        <div className="flex items-start gap-2.5">
          {comment.authorAvatar ? (
            <img
              src={comment.authorAvatar}
              alt={comment.authorName}
              className="w-8 h-8 rounded-full object-cover shrink-0 bg-slate-100 ring-1 ring-slate-200/80"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
              {comment.authorName.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="bg-slate-50 border border-slate-200/75 rounded-2xl px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs font-bold text-slate-900 truncate">
                    {comment.authorName}
                  </span>
                  {authorMember?.role === 'administrateur' && (
                    <span className="text-[10px] font-semibold text-blue-700">· Admin</span>
                  )}
                  {authorMember?.role === 'moderateur' && (
                    <span className="text-[10px] font-semibold text-emerald-700">· Modérateur</span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 font-mono tabular-nums shrink-0">
                  {formatTime(comment.createdAt)}
                  {comment.isEdited ? ' · modifié' : ''}
                </span>
              </div>

              {editingCommentId === comment.id ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    rows={2}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-blue-400 bg-white focus:outline-none text-slate-800 resize-none"
                  />
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditingCommentId(null)}
                      className="px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(comment.id)}
                      className="px-3 py-1.5 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1 transition"
                    >
                      <Check className="w-3 h-3" />
                      <span>Valider</span>
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs sm:text-[13px] text-slate-800 leading-relaxed mt-1 whitespace-pre-wrap break-words">
                  {renderHighlightedComment(comment.content)}
                </p>
              )}
            </div>

            {/* Comment Actions */}
            <div className="flex items-center flex-wrap gap-3 px-2 mt-1.5 text-[11px] font-semibold text-slate-500">
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={() =>
                  communityService.toggleLikeComment(comment.id, currentUser.id, isLiked, {
                    comment,
                    actor: currentUser
                  })
                }
                className={`flex items-center gap-1 py-0.5 hover:text-red-600 transition ${
                  isLiked ? 'text-red-600 font-bold' : ''
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-red-600 text-red-600' : ''}`} />
                <span>J'aime</span>
                {likeCount > 0 && (
                  <span className="font-mono tabular-nums text-[10px]">({likeCount})</span>
                )}
              </motion.button>

              {!isReply && (
                <button
                  type="button"
                  onClick={() => {
                    setReplyingTo(comment);
                    if (!newComment.startsWith(`@${comment.authorName}`)) {
                      setNewComment(`@${comment.authorName} `);
                      setSelectedMentions((prev) =>
                        prev.includes(comment.authorId) ? prev : [...prev, comment.authorId]
                      );
                    }
                  }}
                  className="flex items-center gap-1 py-0.5 hover:text-blue-600 transition"
                >
                  <Reply className="w-3.5 h-3.5" />
                  <span>Répondre</span>
                </button>
              )}

              {isAuthor && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingCommentId(comment.id);
                    setEditContent(comment.content);
                  }}
                  className="flex items-center gap-1 py-0.5 hover:text-blue-600 transition"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Modifier</span>
                </button>
              )}

              {(isAuthor || canModerateComments) && (
                <button
                  type="button"
                  onClick={() => setPendingDeleteComment(comment)}
                  className="flex items-center gap-1 py-0.5 hover:text-red-600 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Supprimer</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {childReplies.map((reply) => renderCommentNode(reply, true))}
      </motion.div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="pt-3 border-t border-slate-100 space-y-3"
    >
      {error && (
        <p className="text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-xl">
          {error}
        </p>
      )}

      {/* Existing Comments or Clean Invite */}
      {topLevelComments.length > 0 ? (
        <div className="space-y-1 max-h-[380px] overflow-y-auto pr-1">
          {topLevelComments.map((c) => renderCommentNode(c, false))}
        </div>
      ) : (
        <div className="flex items-center gap-2 py-2 px-1 text-xs text-slate-400">
          <MessageSquare className="w-3.5 h-3.5 shrink-0" />
          <span>Aucun commentaire pour le moment. Lancez la discussion !</span>
        </div>
      )}

      {/* Reply Banner */}
      <AnimatePresence>
        {replyingTo && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="flex items-center justify-between bg-blue-50 border border-blue-200/80 px-3.5 py-2 rounded-xl text-xs text-blue-900"
          >
            <span>
              Réponse à <span className="font-bold">{replyingTo.authorName}</span>
            </span>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="p-1 hover:bg-blue-100 rounded-lg transition"
              title="Annuler la réponse"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Composer + @mention picker */}
      <div className="relative pt-1">
        <AnimatePresence>
          {mentionCandidates.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 overflow-hidden"
            >
              <p className="px-3.5 py-2 text-[10px] font-bold text-slate-400 bg-slate-50 border-b border-slate-100">
                Mentionner un membre
              </p>
              {mentionCandidates.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleInsertMention(m)}
                  className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-800 hover:bg-blue-50 flex items-center gap-2.5 transition"
                >
                  {m.userAvatar ? (
                    <img
                      src={m.userAvatar}
                      alt={m.userName}
                      className="w-6 h-6 rounded-full object-cover shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                      {m.userName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="truncate">{m.userName}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSendComment} className="flex items-center gap-2">
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

          <div className="relative flex-1">
            <input
              type="text"
              value={newComment}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={
                replyingTo
                  ? `Répondre à ${replyingTo.authorName}...`
                  : 'Écrire un commentaire... (@ pour mentionner)'
              }
              className="w-full text-xs sm:text-[13px] pl-3.5 pr-9 py-2.5 bg-slate-100/90 hover:bg-slate-100 focus:bg-white border border-transparent focus:border-blue-500 rounded-full focus:outline-none text-slate-900 transition"
            />
            <button
              type="button"
              onClick={() => handleInputChange(`${newComment}@`)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 p-1.5 rounded-full transition"
              title="Mentionner un membre"
            >
              <AtSign className="w-3.5 h-3.5" />
            </button>
          </div>
          <motion.button
            type="submit"
            whileTap={{ scale: 0.92 }}
            disabled={!newComment.trim() || isSending}
            className="min-h-[40px] min-w-[40px] px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-45 text-white rounded-full flex items-center justify-center transition shrink-0 shadow-xs"
            title="Publier le commentaire"
          >
            <Send className="w-4 h-4" />
          </motion.button>
        </form>
      </div>

      {/* Delete Comment Confirmation Modal */}
      {pendingDeleteComment &&
        createPortal(
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50"
            onClick={() => setPendingDeleteComment(null)}
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
                  <h3 className="font-extrabold text-slate-950 text-sm">Supprimer ce commentaire ?</h3>
                  <p className="text-xs text-slate-500">Cette action est irréversible.</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPendingDeleteComment(null)}
                  className="min-h-[40px] px-4 py-2 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="min-h-[40px] px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </motion.div>
  );
}
