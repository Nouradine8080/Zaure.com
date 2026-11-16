import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Send,
  Heart,
  Reply,
  Edit3,
  Trash2,
  AtSign,
  Check,
  X,
  AlertTriangle
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
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
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

    return (
      <div key={comment.id} className={isReply ? 'ml-8 sm:ml-10 mt-2' : 'mt-3'}>
        <div className="flex items-start gap-2.5">
          {comment.authorAvatar ? (
            <img
              src={comment.authorAvatar}
              alt={comment.authorName}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover shrink-0 bg-slate-100"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-100 text-blue-800 font-bold text-xs flex items-center justify-center shrink-0">
              {comment.authorName.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="bg-[#F0F2F5] rounded-2xl px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-slate-900 truncate">
                  {comment.authorName}
                </span>
                <span className="text-[10px] text-slate-400 shrink-0">
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
                    className="w-full text-xs p-2 rounded-xl border border-blue-400 bg-white focus:outline-none text-slate-800 resize-none"
                  />
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditingCommentId(null)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200 rounded-lg"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(comment.id)}
                      className="px-2.5 py-1 text-[11px] font-bold bg-blue-600 text-white rounded-lg flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      <span>Valider</span>
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-800 leading-relaxed mt-1 whitespace-pre-wrap break-words">
                  {comment.content}
                </p>
              )}
            </div>

            {/* Comment Actions */}
            <div className="flex items-center gap-3 px-2 mt-1 text-[11px] font-semibold text-slate-500">
              <button
                type="button"
                onClick={() => communityService.toggleLikeComment(comment.id, currentUser.id, isLiked)}
                className={`flex items-center gap-1 hover:text-red-600 transition ${
                  isLiked ? 'text-red-600 font-bold' : ''
                }`}
              >
                <Heart className={`w-3 h-3 ${isLiked ? 'fill-red-600' : ''}`} />
                <span>J'aime{likeCount > 0 ? ` (${likeCount})` : ''}</span>
              </button>

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
                  className="flex items-center gap-1 hover:text-blue-600 transition"
                >
                  <Reply className="w-3 h-3" />
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
                  className="flex items-center gap-1 hover:text-blue-600 transition"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Modifier</span>
                </button>
              )}

              {(isAuthor || canModerateComments) && (
                <button
                  type="button"
                  onClick={() => setPendingDeleteComment(comment)}
                  className="flex items-center gap-1 hover:text-red-600 transition"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Supprimer</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {childReplies.map((reply) => renderCommentNode(reply, true))}
      </div>
    );
  };

  return (
    <div className="pt-3 border-t border-slate-100 space-y-3">
      {error && (
        <p className="text-[11px] font-semibold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">
          {error}
        </p>
      )}

      {/* Existing Comments */}
      {topLevelComments.length > 0 && (
        <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
          {topLevelComments.map((c) => renderCommentNode(c, false))}
        </div>
      )}

      {/* Reply Banner */}
      {replyingTo && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl text-[11px] text-blue-800">
          <span>
            Réponse à <span className="font-bold">{replyingTo.authorName}</span>
          </span>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="p-0.5 hover:bg-blue-100 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Composer + @mention picker */}
      <div className="relative">
        {mentionCandidates.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1.5 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 overflow-hidden">
            <p className="px-3 py-1.5 text-[10px] font-bold text-slate-400 bg-slate-50 border-b border-slate-100">
              Mentionner un membre
            </p>
            {mentionCandidates.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => handleInsertMention(m)}
                className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-800 hover:bg-blue-50 flex items-center gap-2 transition"
              >
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                  {m.userName.charAt(0).toUpperCase()}
                </div>
                <span className="truncate">{m.userName}</span>
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSendComment} className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={newComment}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Écrire un commentaire... Utilisez @ pour mentionner"
              className="w-full text-xs pl-3.5 pr-9 py-2.5 bg-[#F0F2F5] focus:bg-white border border-transparent focus:border-blue-500 rounded-full focus:outline-none text-slate-900"
            />
            <button
              type="button"
              onClick={() => handleInputChange(`${newComment}@`)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 p-1"
              title="Mentionner un membre"
            >
              <AtSign className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            type="submit"
            disabled={!newComment.trim() || isSending}
            className="min-h-[40px] min-w-[40px] px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-full flex items-center justify-center transition shrink-0"
            title="Publier le commentaire"
          >
            <Send className="w-4 h-4" />
          </button>
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
              className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl border border-slate-100 space-y-4"
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
    </div>
  );
}
