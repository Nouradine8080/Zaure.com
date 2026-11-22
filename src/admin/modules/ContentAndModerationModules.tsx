import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  CheckCircle2,
  Clock,
  Pin,
  Trash2,
  ShieldAlert,
  MessageSquare,
  AlertOctagon,
  Eye,
  X,
  Pencil,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ExternalLink
} from 'lucide-react';
import { Capsule, Comment, GroupPost, PostComment } from '../../types';
import { AdminSessionContext, PlatformSettings } from '../types';
import { adminService } from '../services/adminService';
import { ConfirmModal } from '../components/ConfirmModal';
import { canPerformAdminAction } from '../utils/adminAnalytics';

// ============================================================================
// MODULE 3 : GESTION DES PUBLICATIONS
// ============================================================================
interface PostsModuleProps {
  session: AdminSessionContext;
  groupPosts: GroupPost[];
  capsules: Capsule[];
  initialSearch?: string;
  onRefresh: () => Promise<void>;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}

export const PostsManagementModule: React.FC<PostsModuleProps> = ({
  session,
  groupPosts,
  capsules,
  initialSearch = '',
  onRefresh,
  onNotify
}) => {
  const [search, setSearch] = useState(initialSearch);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'public' | 'circles' | 'capsules'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'pending' | 'scheduled'>('all');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [inspectPost, setInspectPost] = useState<GroupPost | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isEditingPost, setIsEditingPost] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    tone: 'danger' | 'warning' | 'primary';
    action: () => Promise<void>;
  } | null>(null);

  const canManagePosts = canPerformAdminAction(session, 'managePosts');

  useEffect(() => {
    if (initialSearch) setSearch(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    setPage(1);
  }, [search, sourceFilter, statusFilter]);

  const filteredPosts = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    return groupPosts.filter((p) => {
      if (sourceFilter === 'public' && p.groupId !== 'public') return false;
      if (sourceFilter === 'circles' && p.groupId === 'public') return false;
      if (sourceFilter === 'capsules') return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        String(p.content ?? '').toLowerCase().includes(q) ||
        String(p.authorName ?? '').toLowerCase().includes(q) ||
        String(p.groupId ?? '').toLowerCase().includes(q)
      );
    });
  }, [groupPosts, search, sourceFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedPosts = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredPosts.slice(start, start + pageSize);
  }, [filteredPosts, safePage]);

  const filteredCapsules = useMemo(() => {
    if (sourceFilter === 'public' || sourceFilter === 'circles') return [];
    const q = (search || '').trim().toLowerCase();
    return capsules.filter((c) => {
      if (!q) return true;
      return (
        String(c.contenu ?? '').toLowerCase().includes(q) ||
        String(c.auteur_nom ?? '').toLowerCase().includes(q) ||
        String(c.circle_nom ?? c.circle_id ?? '').toLowerCase().includes(q)
      );
    });
  }, [capsules, search, sourceFilter]);

  const openInspector = (post: GroupPost) => {
    setInspectPost(post);
    setEditContent(post.content || '');
    setIsEditingPost(false);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par texte, auteur ou communauté..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-blue-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as any)}
            className="min-h-[38px] px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <option value="all">Toutes sources ({groupPosts.length + capsules.length})</option>
            <option value="public">Fil public ({groupPosts.filter((p) => p.groupId === 'public').length})</option>
            <option value="circles">Communautés ({groupPosts.filter((p) => p.groupId !== 'public').length})</option>
            <option value="capsules">Capsules ({capsules.length})</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="min-h-[38px] px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <option value="all">Tous statuts</option>
            <option value="published">Publiées</option>
            <option value="pending">Masquées / En attente</option>
            <option value="scheduled">Programmées</option>
          </select>
        </div>
      </div>

      {/* Group & Public Feed Posts */}
      {sourceFilter !== 'capsules' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Publications Fil public & Communautés ({filteredPosts.length})
            </h3>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-4">Auteur / Canal</th>
                  <th className="py-2.5 px-4">Contenu</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Statut</th>
                  <th className="py-2.5 px-4">Engagement</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {paginatedPosts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 dark:text-slate-400">
                      Aucune publication trouvée.
                    </td>
                  </tr>
                ) : (
                  paginatedPosts.map((post) => (
                    <tr key={post.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-4">
                        <p className="font-semibold text-slate-900 dark:text-white">{post.authorName}</p>
                        <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                          {post.groupId === 'public' ? 'Fil public' : post.groupId}
                        </p>
                      </td>
                      <td className="py-2.5 px-4 max-w-sm">
                        <p className="text-slate-700 dark:text-slate-300 line-clamp-2">
                          {post.content || `[${post.type}]`}
                        </p>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400 uppercase">
                        {post.type}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`font-semibold text-[11px] ${
                            post.status === 'published'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : post.status === 'pending'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-blue-600 dark:text-blue-400'
                          }`}
                        >
                          {post.status === 'pending' ? 'Masquée / Attente' : post.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
                        {post.reactionCount} réac · {post.commentCount} com
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openInspector(post)}
                            title="Consulter / Modifier"
                            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {canManagePosts && (
                            <>
                              {post.status !== 'published' ? (
                                <button
                                  type="button"
                                  title="Restaurer / Publier"
                                  onClick={() =>
                                    setConfirmState({
                                      title: 'Restaurer et publier',
                                      description: `Publier immédiatement le contenu de ${post.authorName} ?`,
                                      confirmLabel: 'Publier',
                                      tone: 'primary',
                                      action: async () => {
                                        await adminService.updateGroupPostStatus(session, post, 'published');
                                        onNotify('Publication publiée.');
                                        await onRefresh();
                                      }
                                    })
                                  }
                                  className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-md"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  title="Masquer (placer en modération)"
                                  onClick={() =>
                                    setConfirmState({
                                      title: 'Masquer cette publication',
                                      description: `Passer la publication de ${post.authorName} au statut "pending" pour la retirer du fil ?`,
                                      confirmLabel: 'Masquer',
                                      tone: 'warning',
                                      action: async () => {
                                        await adminService.updateGroupPostStatus(session, post, 'pending');
                                        onNotify('Publication masquée (statut pending).');
                                        await onRefresh();
                                      }
                                    })
                                  }
                                  className="p-2 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-md"
                                >
                                  <Clock className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <button
                                type="button"
                                title={post.isPinned ? 'Désépingler' : 'Épingler'}
                                onClick={async () => {
                                  try {
                                    await adminService.toggleGroupPostPin(session, post);
                                    onNotify(post.isPinned ? 'Publication désépinglée.' : 'Publication épinglée.');
                                    await onRefresh();
                                  } catch (err: any) {
                                    onNotify(err?.message || 'Erreur lors de la mise à jour.', 'error');
                                  }
                                }}
                                className={`p-2 rounded-md ${
                                  post.isPinned
                                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40'
                                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                              >
                                <Pin className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                title="Supprimer définitivement"
                                onClick={() =>
                                  setConfirmState({
                                    title: 'Supprimer la publication',
                                    description: `Supprimer définitivement cette publication de ${post.authorName} ?`,
                                    confirmLabel: 'Supprimer',
                                    tone: 'danger',
                                    action: async () => {
                                      await adminService.deleteGroupPostAdmin(session, post);
                                      onNotify('Publication supprimée.');
                                      await onRefresh();
                                    }
                                  })
                                }
                                className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {paginatedPosts.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                Aucune publication trouvée.
              </p>
            ) : (
              paginatedPosts.map((post) => (
                <div key={post.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{post.authorName}</p>
                      <p className="text-[11px] font-mono text-slate-400">
                        {post.groupId === 'public' ? 'Fil public' : post.groupId} · {post.type}
                      </p>
                    </div>
                    <span
                      className={`text-[11px] font-semibold shrink-0 ${
                        post.status === 'published'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {post.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-3">
                    {post.content || `[Média ${post.type}]`}
                  </p>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="font-mono text-[11px] text-slate-400">
                      {post.reactionCount} réac · {post.commentCount} com
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openInspector(post)}
                        className="min-h-[38px] px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg"
                      >
                        Détails
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span className="font-mono tabular-nums">
                Page {safePage}/{totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="min-h-[36px] px-2.5 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="min-h-[36px] px-2.5 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Capsules Table */}
      {filteredCapsules.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Capsules de savoir ({filteredCapsules.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-4">Auteur</th>
                  <th className="py-2.5 px-4">Contenu / Type</th>
                  <th className="py-2.5 px-4">Communauté</th>
                  <th className="py-2.5 px-4">Langue</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredCapsules.map((cap) => (
                  <tr key={cap.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">
                      {cap.auteur_nom || cap.auteur_id}
                    </td>
                    <td className="py-2.5 px-4 max-w-md">
                      <p className="text-slate-700 dark:text-slate-300 truncate">
                        {cap.type === 'texte' ? cap.contenu : `[Capsule ${cap.type.toUpperCase()}]`}
                      </p>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {cap.circle_nom || cap.circle_id}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[11px] uppercase text-slate-600 dark:text-slate-400">
                      {cap.langue_dorigine}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {canManagePosts && (
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmState({
                              title: 'Supprimer la capsule',
                              description: `Supprimer définitivement cette capsule de ${cap.auteur_nom || cap.auteur_id} ?`,
                              confirmLabel: 'Supprimer',
                              tone: 'danger',
                              action: async () => {
                                await adminService.deleteCapsuleAdmin(session, cap);
                                onNotify('Capsule supprimée.');
                                await onRefresh();
                              }
                            })
                          }
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inspect / Edit Post Modal */}
      {inspectPost && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-[1px] flex items-center justify-center p-4"
          onClick={() => setInspectPost(null)}
        >
          <div
            className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Inspection de publication
                </h3>
                <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  {inspectPost.authorName} · {inspectPost.groupId} · {inspectPost.status}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectPost(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {isEditingPost && canManagePosts ? (
                <div className="space-y-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    Contenu de la publication
                  </label>
                  <textarea
                    rows={5}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full p-3 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                </div>
              ) : (
                <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed bg-slate-50 dark:bg-slate-950 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800">
                  {inspectPost.content || '(Aucun texte)'}
                </p>
              )}

              {inspectPost.externalLink && (
                <a
                  href={inspectPost.externalLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline font-mono"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{inspectPost.externalLink}</span>
                </a>
              )}

              {(inspectPost.media || []).length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {inspectPost.media.map((m, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50 dark:bg-slate-950 p-2"
                    >
                      {m.type === 'image' ? (
                        <img
                          src={m.url}
                          alt={m.name || 'Média'}
                          className="w-full h-36 object-cover rounded"
                        />
                      ) : (
                        <a
                          href={m.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline block truncate"
                        >
                          {m.name || m.url}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {canManagePosts && (
              <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {!isEditingPost ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingPost(true)}
                      className="min-h-[38px] px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Modifier texte</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={async () => {
                        setIsProcessing(true);
                        try {
                          await adminService.updateGroupPostAdmin(session, inspectPost, {
                            content: editContent
                          });
                          onNotify('Publication modifiée.');
                          setInspectPost(null);
                          await onRefresh();
                        } catch (err: any) {
                          onNotify(err?.message || 'Erreur lors de la modification.', 'error');
                        } finally {
                          setIsProcessing(false);
                        }
                      }}
                      className="min-h-[38px] px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                    >
                      Enregistrer
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {inspectPost.status !== 'published' ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await adminService.updateGroupPostStatus(session, inspectPost, 'published');
                        onNotify('Publication restaurée.');
                        setInspectPost(null);
                        await onRefresh();
                      }}
                      className="min-h-[38px] px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                    >
                      Restaurer / Publier
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        await adminService.updateGroupPostStatus(session, inspectPost, 'pending');
                        onNotify('Publication masquée.');
                        setInspectPost(null);
                        await onRefresh();
                      }}
                      className="min-h-[38px] px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
                    >
                      Masquer
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {confirmState && (
        <ConfirmModal
          open={true}
          title={confirmState.title}
          description={confirmState.description}
          confirmLabel={confirmState.confirmLabel}
          tone={confirmState.tone}
          isLoading={isProcessing}
          onCancel={() => setConfirmState(null)}
          onConfirm={async () => {
            setIsProcessing(true);
            try {
              await confirmState.action();
              setConfirmState(null);
            } catch (err: any) {
              onNotify(err?.message || 'Erreur lors de l’opération.', 'error');
            } finally {
              setIsProcessing(false);
            }
          }}
        />
      )}
    </div>
  );
};

// ============================================================================
// MODULE 4 : GESTION DES COMMENTAIRES
// ============================================================================
interface CommentsModuleProps {
  session: AdminSessionContext;
  postComments: PostComment[];
  capsuleComments: Comment[];
  initialSearch?: string;
  onRefresh: () => Promise<void>;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}

export const CommentsManagementModule: React.FC<CommentsModuleProps> = ({
  session,
  postComments,
  capsuleComments,
  initialSearch = '',
  onRefresh,
  onNotify
}) => {
  const [search, setSearch] = useState(initialSearch);
  const [source, setSource] = useState<'all' | 'posts' | 'capsules'>('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    label: string;
    action: () => Promise<void>;
  } | null>(null);

  const canManageComments = canPerformAdminAction(session, 'manageComments');

  useEffect(() => {
    if (initialSearch) setSearch(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    setPage(1);
  }, [search, source]);

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    const mapped = [
      ...(source === 'capsules'
        ? []
        : postComments.map((c) => ({
            id: c.id,
            source: 'Publication',
            author: c.authorName,
            content: c.content,
            targetId: c.postId,
            createdAt: c.createdAt,
            onDelete: () => adminService.deletePostCommentAdmin(session, c)
          }))),
      ...(source === 'posts'
        ? []
        : capsuleComments.map((c) => ({
            id: c.id,
            source: 'Capsule',
            author: c.auteur_nom || c.auteur_id,
            content: c.contenu,
            targetId: c.capsule_id,
            createdAt: c.created_at,
            onDelete: () => adminService.deleteCapsuleCommentAdmin(session, c)
          })))
    ];

    return mapped
      .filter(
        (m) =>
          !q ||
          String(m.content ?? '').toLowerCase().includes(q) ||
          String(m.author ?? '').toLowerCase().includes(q) ||
          String(m.targetId ?? '').toLowerCase().includes(q)
      )
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [postComments, capsuleComments, search, source, session]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage]);

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrer les commentaires par contenu ou auteur..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-blue-600"
          />
        </div>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as any)}
          className="min-h-[38px] px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg"
        >
          <option value="all">Tous ({postComments.length + capsuleComments.length})</option>
          <option value="posts">Commentaires de posts ({postComments.length})</option>
          <option value="capsules">Commentaires de capsules ({capsuleComments.length})</option>
        </select>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Auteur</th>
                <th className="py-3 px-4">Commentaire</th>
                <th className="py-3 px-4">Source</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500 dark:text-slate-400">
                    <MessageSquare className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    Aucun commentaire trouvé.
                  </td>
                </tr>
              ) : (
                paginated.map((item) => (
                  <tr key={`${item.source}_${item.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">{item.author}</td>
                    <td className="py-2.5 px-4 max-w-md text-slate-700 dark:text-slate-300">{item.content}</td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {item.source} · {item.targetId.slice(0, 12)}
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
                      {item.createdAt ? new Date(item.createdAt).toLocaleString('fr-FR') : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {canManageComments && (
                        <button
                          type="button"
                          onClick={() =>
                            setPendingDelete({
                              label: `${item.author} : "${item.content.slice(0, 80)}"`,
                              action: item.onDelete
                            })
                          }
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md"
                          title="Supprimer ce commentaire"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {paginated.length === 0 ? (
            <p className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              Aucun commentaire trouvé.
            </p>
          ) : (
            paginated.map((item) => (
              <div key={`${item.source}_${item.id}`} className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-slate-900 dark:text-white">{item.author}</span>
                  <span className="font-mono text-[11px] text-slate-400">{item.source}</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300">{item.content}</p>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="font-mono text-[11px] text-slate-400">
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString('fr-FR') : '—'}
                  </span>
                  {canManageComments && (
                    <button
                      type="button"
                      onClick={() =>
                        setPendingDelete({
                          label: `${item.author} : "${item.content.slice(0, 80)}"`,
                          action: item.onDelete
                        })
                      }
                      className="min-h-[36px] px-3 py-1 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 rounded-lg"
                    >
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <span className="font-mono tabular-nums">
              {items.length} commentaire(s) · Page {safePage}/{totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="min-h-[36px] px-2.5 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="min-h-[36px] px-2.5 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {pendingDelete && (
        <ConfirmModal
          open={true}
          title="Supprimer ce commentaire"
          description={`Confirmez-vous la suppression définitive du commentaire de ${pendingDelete.label} ?`}
          confirmLabel="Supprimer"
          tone="danger"
          isLoading={isProcessing}
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            setIsProcessing(true);
            try {
              await pendingDelete.action();
              onNotify('Commentaire supprimé.');
              setPendingDelete(null);
              await onRefresh();
            } catch (err: any) {
              onNotify(err?.message || 'Erreur lors de la suppression.', 'error');
            } finally {
              setIsProcessing(false);
            }
          }}
        />
      )}
    </div>
  );
};

// ============================================================================
// MODULE 6 : MODÉRATION DES CONTENUS
// ============================================================================
interface ContentModerationProps {
  session: AdminSessionContext;
  groupPosts: GroupPost[];
  settings: PlatformSettings;
  onRefresh: () => Promise<void>;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}

export const ContentModerationModule: React.FC<ContentModerationProps> = ({
  session,
  groupPosts,
  settings,
  onRefresh,
  onNotify
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    tone: 'danger' | 'warning' | 'primary';
    action: () => Promise<void>;
  } | null>(null);

  const canModerate = canPerformAdminAction(session, 'moderateContent');

  const pendingQueue = useMemo(
    () => groupPosts.filter((p) => p.status === 'pending'),
    [groupPosts]
  );

  const keywordFlagged = useMemo(() => {
    const words = (settings.forbiddenKeywords || [])
      .map((w) => String(w ?? '').toLowerCase().trim())
      .filter(Boolean);
    if (words.length === 0) return [];
    return groupPosts.filter((p) => {
      const lower = String(p?.content ?? '').toLowerCase();
      return words.some((w) => lower.includes(w));
    });
  }, [groupPosts, settings.forbiddenKeywords]);

  return (
    <div className="space-y-6">
      {/* Pending Queue */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              File d&apos;attente de modération ({pendingQueue.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Publications masquées ou en statut <span className="font-mono">pending</span>
          </span>
        </div>

        {pendingQueue.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
            Aucune publication en attente d&apos;approbation.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {pendingQueue.map((post) => (
              <div key={post.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    {post.authorName}{' '}
                    <span className="font-mono font-normal text-slate-400">· {post.groupId}</span>
                  </p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{post.content}</p>
                </div>
                {canModerate && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmState({
                          title: 'Approuver / Restaurer ce contenu',
                          description: `Publier cette contribution de ${post.authorName} ?`,
                          confirmLabel: 'Approuver',
                          tone: 'primary',
                          action: async () => {
                            await adminService.updateGroupPostStatus(session, post, 'published');
                            onNotify('Contenu approuvé et publié.');
                            await onRefresh();
                          }
                        })
                      }
                      className="min-h-[38px] px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                    >
                      Approuver / Restaurer
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmState({
                          title: 'Rejeter et supprimer',
                          description: `Supprimer définitivement ce contenu en attente de ${post.authorName} ?`,
                          confirmLabel: 'Supprimer',
                          tone: 'danger',
                          action: async () => {
                            await adminService.deleteGroupPostAdmin(session, post);
                            onNotify('Contenu rejeté et supprimé.');
                            await onRefresh();
                          }
                        })
                      }
                      className="min-h-[38px] px-3 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg"
                    >
                      Supprimer
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Forbidden Keywords Match List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-red-600 dark:text-red-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Détection par mots-clés sensibles ({keywordFlagged.length})
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            {(settings.forbiddenKeywords || []).length} mot(s)-clé(s) configuré(s)
          </span>
        </div>

        {keywordFlagged.length === 0 ? (
          <p className="p-6 text-xs text-slate-500 dark:text-slate-400 text-center">
            {settings.forbiddenKeywords.length === 0
              ? 'Aucun mot-clé sensible configuré dans les Paramètres de la plateforme.'
              : 'Aucune publication ne contient les mots-clés surveillés.'}
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {keywordFlagged.map((post) => (
              <div key={post.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
                    <span>{post.authorName}</span>
                    <span className="font-mono font-normal text-slate-400">· {post.status}</span>
                  </p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">{post.content}</p>
                </div>
                {canModerate && (
                  <div className="flex items-center gap-2 shrink-0">
                    {post.status === 'published' ? (
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmState({
                            title: 'Masquer la publication',
                            description: `Retirer cette publication du fil public en la plaçant en statut "pending" ?`,
                            confirmLabel: 'Masquer',
                            tone: 'warning',
                            action: async () => {
                              await adminService.updateGroupPostStatus(session, post, 'pending');
                              onNotify('Publication masquée pour modération.');
                              await onRefresh();
                            }
                          })
                        }
                        className="min-h-[38px] px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
                      >
                        Masquer
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmState({
                            title: 'Restaurer la publication',
                            description: `Rétablir le statut "published" de cette publication ?`,
                            confirmLabel: 'Restaurer',
                            tone: 'primary',
                            action: async () => {
                              await adminService.updateGroupPostStatus(session, post, 'published');
                              onNotify('Publication restaurée.');
                              await onRefresh();
                            }
                          })
                        }
                        className="min-h-[38px] px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                      >
                        Restaurer
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmState({
                          title: 'Supprimer la publication',
                          description: `Supprimer définitivement cette publication signalée par filtre de mots-clés ?`,
                          confirmLabel: 'Supprimer',
                          tone: 'danger',
                          action: async () => {
                            await adminService.deleteGroupPostAdmin(session, post);
                            onNotify('Publication supprimée.');
                            await onRefresh();
                          }
                        })
                      }
                      className="min-h-[38px] px-3 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg"
                    >
                      Supprimer
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmState && (
        <ConfirmModal
          open={true}
          title={confirmState.title}
          description={confirmState.description}
          confirmLabel={confirmState.confirmLabel}
          tone={confirmState.tone}
          isLoading={isProcessing}
          onCancel={() => setConfirmState(null)}
          onConfirm={async () => {
            setIsProcessing(true);
            try {
              await confirmState.action();
              setConfirmState(null);
            } catch (err: any) {
              onNotify(err?.message || 'Erreur lors de la modération.', 'error');
            } finally {
              setIsProcessing(false);
            }
          }}
        />
      )}
    </div>
  );
};
