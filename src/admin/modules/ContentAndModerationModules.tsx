import React, { useMemo, useState } from 'react';
import {
  Search,
  CheckCircle2,
  Clock,
  Pin,
  Trash2,
  ShieldAlert,
  MessageSquare,
  AlertOctagon
} from 'lucide-react';
import { Capsule, Comment, GroupPost, PostComment } from '../../types';
import { AdminSessionContext, PlatformSettings } from '../types';
import { adminService } from '../services/adminService';
import { ConfirmModal } from '../components/ConfirmModal';

// ============================================================================
// MODULE 3 : GESTION DES PUBLICATIONS
// ============================================================================
interface PostsModuleProps {
  session: AdminSessionContext;
  groupPosts: GroupPost[];
  capsules: Capsule[];
  onRefresh: () => Promise<void>;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}

export const PostsManagementModule: React.FC<PostsModuleProps> = ({
  session,
  groupPosts,
  capsules,
  onRefresh,
  onNotify
}) => {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'public' | 'circles' | 'capsules'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'pending' | 'scheduled'>('all');
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    tone: 'danger' | 'warning' | 'primary';
    action: () => Promise<void>;
  } | null>(null);

  const filteredPosts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groupPosts.filter((p) => {
      if (sourceFilter === 'public' && p.groupId !== 'public') return false;
      if (sourceFilter === 'circles' && p.groupId === 'public') return false;
      if (sourceFilter === 'capsules') return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.content.toLowerCase().includes(q) ||
        p.authorName.toLowerCase().includes(q) ||
        p.groupId.toLowerCase().includes(q)
      );
    });
  }, [groupPosts, search, sourceFilter, statusFilter]);

  const filteredCapsules = useMemo(() => {
    if (sourceFilter === 'public' || sourceFilter === 'circles') return [];
    const q = search.trim().toLowerCase();
    return capsules.filter((c) => {
      if (!q) return true;
      return (
        c.contenu.toLowerCase().includes(q) ||
        (c.auteur_nom || '').toLowerCase().includes(q) ||
        (c.circle_nom || c.circle_id).toLowerCase().includes(q)
      );
    });
  }, [capsules, search, sourceFilter]);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par texte, auteur ou cercle..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as any)}
            className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg"
          >
            <option value="all">Toutes sources ({groupPosts.length + capsules.length})</option>
            <option value="public">Fil public ({groupPosts.filter((p) => p.groupId === 'public').length})</option>
            <option value="circles">Cercles ({groupPosts.filter((p) => p.groupId !== 'public').length})</option>
            <option value="capsules">Capsules ({capsules.length})</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg"
          >
            <option value="all">Tous statuts</option>
            <option value="published">Publiées</option>
            <option value="pending">En attente</option>
            <option value="scheduled">Programmées</option>
          </select>
        </div>
      </div>

      {/* Group & Public Feed Posts */}
      {sourceFilter !== 'capsules' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Publications Fil public & Cercles ({filteredPosts.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-4">Auteur / Canal</th>
                  <th className="py-2.5 px-4">Contenu</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Statut</th>
                  <th className="py-2.5 px-4">Engagement</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredPosts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      Aucune publication trouvée.
                    </td>
                  </tr>
                ) : (
                  filteredPosts.map((post) => (
                    <tr key={post.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4">
                        <p className="font-semibold text-slate-900">{post.authorName}</p>
                        <p className="text-[11px] font-mono text-slate-400">
                          {post.groupId === 'public' ? 'Fil public' : post.groupId}
                        </p>
                      </td>
                      <td className="py-2.5 px-4 max-w-sm">
                        <p className="text-slate-700 line-clamp-2">{post.content || `[${post.type}]`}</p>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600 uppercase">
                        {post.type}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`font-semibold text-[11px] ${
                            post.status === 'published'
                              ? 'text-emerald-600'
                              : post.status === 'pending'
                                ? 'text-amber-600'
                                : 'text-blue-600'
                          }`}
                        >
                          {post.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-[11px] text-slate-500">
                        {post.reactionCount} réac · {post.commentCount} com
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          {post.status !== 'published' ? (
                            <button
                              type="button"
                              title="Approuver et publier"
                              onClick={() =>
                                setConfirmState({
                                  title: 'Approuver la publication',
                                  description: `Publier immédiatement le contenu de ${post.authorName} ?`,
                                  confirmLabel: 'Approuver',
                                  tone: 'primary',
                                  action: async () => {
                                    await adminService.updateGroupPostStatus(session, post, 'published');
                                    onNotify('Publication approuvée.');
                                    await onRefresh();
                                  }
                                })
                              }
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              title="Placer en file de modération"
                              onClick={() =>
                                setConfirmState({
                                  title: 'Retirer du fil et placer en modération',
                                  description: `Passer la publication de ${post.authorName} au statut "pending" ?`,
                                  confirmLabel: 'Placer en attente',
                                  tone: 'warning',
                                  action: async () => {
                                    await adminService.updateGroupPostStatus(session, post, 'pending');
                                    onNotify('Publication placée en attente de modération.');
                                    await onRefresh();
                                  }
                                })
                              }
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-md"
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
                            className={`p-1.5 rounded-md ${
                              post.isPinned ? 'text-blue-600 bg-blue-50' : 'text-slate-500 hover:bg-slate-100'
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
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-md"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Capsules Table */}
      {filteredCapsules.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/60">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Capsules de savoir ({filteredCapsules.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-4">Auteur</th>
                  <th className="py-2.5 px-4">Contenu / Type</th>
                  <th className="py-2.5 px-4">Cercle</th>
                  <th className="py-2.5 px-4">Langue</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredCapsules.map((cap) => (
                  <tr key={cap.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-semibold text-slate-900">
                      {cap.auteur_nom || cap.auteur_id}
                    </td>
                    <td className="py-2.5 px-4 max-w-md">
                      <p className="text-slate-700 truncate">
                        {cap.type === 'texte' ? cap.contenu : `[Capsule ${cap.type.toUpperCase()}]`}
                      </p>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">
                      {cap.circle_nom || cap.circle_id}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[11px] uppercase text-slate-600">
                      {cap.langue_dorigine}
                    </td>
                    <td className="py-2.5 px-4 text-right">
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
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-md"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
  onRefresh: () => Promise<void>;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}

export const CommentsManagementModule: React.FC<CommentsModuleProps> = ({
  session,
  postComments,
  capsuleComments,
  onRefresh,
  onNotify
}) => {
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<'all' | 'posts' | 'capsules'>('all');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    label: string;
    action: () => Promise<void>;
  } | null>(null);

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
          m.content.toLowerCase().includes(q) ||
          m.author.toLowerCase().includes(q) ||
          m.targetId.toLowerCase().includes(q)
      )
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [postComments, capsuleComments, search, source, session]);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrer les commentaires par contenu ou auteur..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
          />
        </div>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as any)}
          className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg"
        >
          <option value="all">Tous ({postComments.length + capsuleComments.length})</option>
          <option value="posts">Commentaires de posts ({postComments.length})</option>
          <option value="capsules">Commentaires de capsules ({capsuleComments.length})</option>
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Auteur</th>
                <th className="py-3 px-4">Commentaire</th>
                <th className="py-3 px-4">Source</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    <MessageSquare className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                    Aucun commentaire trouvé.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={`${item.source}_${item.id}`} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{item.author}</td>
                    <td className="py-2.5 px-4 max-w-md text-slate-700">{item.content}</td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">
                      {item.source} · {item.targetId.slice(0, 12)}
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-[11px] text-slate-500">
                      {item.createdAt ? new Date(item.createdAt).toLocaleString('fr-FR') : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setPendingDelete({
                            label: `${item.author} : "${item.content.slice(0, 80)}"`,
                            action: item.onDelete
                          })
                        }
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-md"
                        title="Supprimer ce commentaire"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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

  const pendingQueue = useMemo(
    () => groupPosts.filter((p) => p.status === 'pending'),
    [groupPosts]
  );

  const keywordFlagged = useMemo(() => {
    const words = (settings.forbiddenKeywords || []).map((w) => w.toLowerCase()).filter(Boolean);
    if (words.length === 0) return [];
    return groupPosts.filter((p) => {
      const lower = (p.content || '').toLowerCase();
      return words.some((w) => lower.includes(w));
    });
  }, [groupPosts, settings.forbiddenKeywords]);

  return (
    <div className="space-y-6">
      {/* Pending Queue */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-900">
              File d&apos;attente de modération ({pendingQueue.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-500">
            Publications en statut <span className="font-mono">pending</span>
          </span>
        </div>

        {pendingQueue.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
            Aucune publication en attente d&apos;approbation.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pendingQueue.map((post) => (
              <div key={post.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900">
                    {post.authorName}{' '}
                    <span className="font-mono font-normal text-slate-400">
                      · {post.groupId}
                    </span>
                  </p>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap">{post.content}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmState({
                        title: 'Approuver ce contenu',
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
                    className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                  >
                    Approuver
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
                    className="px-3 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg"
                  >
                    Rejeter
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Forbidden Keywords Match List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-red-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Détection par mots-clés sensibles ({keywordFlagged.length})
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            {(settings.forbiddenKeywords || []).length} mot(s)-clé(s) configuré(s)
          </span>
        </div>

        {keywordFlagged.length === 0 ? (
          <p className="p-6 text-xs text-slate-500 text-center">
            {settings.forbiddenKeywords.length === 0
              ? 'Aucun mot-clé sensible configuré dans les Paramètres de la plateforme.'
              : 'Aucune publication ne contient les mots-clés surveillés.'}
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {keywordFlagged.map((post) => (
              <div key={post.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                    <span>{post.authorName}</span>
                    <span className="font-mono font-normal text-slate-400">· {post.status}</span>
                  </p>
                  <p className="text-xs text-slate-700 mt-1">{post.content}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
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
                    className="px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
                  >
                    Masquer
                  </button>
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
                    className="px-3 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg"
                  >
                    Supprimer
                  </button>
                </div>
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
