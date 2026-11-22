import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Lock,
  Globe,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Layers,
  Pencil,
  X,
  RotateCcw,
  LifeBuoy,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Circle, CommunityGroup, GroupReport, SupportTicket, UserReport } from '../../types';
import { AdminSessionContext } from '../types';
import { adminService } from '../services/adminService';
import { ConfirmModal } from '../components/ConfirmModal';
import { canPerformAdminAction } from '../utils/adminAnalytics';

// ============================================================================
// MODULE 5 : GESTION DES COMMUNAUTÉS (CERCLES)
// ============================================================================
interface CirclesModuleProps {
  session: AdminSessionContext;
  groups: CommunityGroup[];
  legacyCircles: Circle[];
  initialSearch?: string;
  onRefresh: () => Promise<void>;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}

export const CirclesManagementModule: React.FC<CirclesModuleProps> = ({
  session,
  groups,
  legacyCircles,
  initialSearch = '',
  onRefresh,
  onNotify
}) => {
  const [search, setSearch] = useState(initialSearch);
  const [privacyFilter, setPrivacyFilter] = useState<'all' | 'public' | 'private'>('all');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [editingGroup, setEditingGroup] = useState<CommunityGroup | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    category: '',
    privacy: 'public' as 'public' | 'private',
    postPermission: 'all_members' as 'all_members' | 'admins_only',
    requirePostApproval: false,
    requireMemberApproval: false,
    allowAnonymousPosts: false
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    tone: 'danger' | 'warning' | 'primary';
    action: () => Promise<void>;
  } | null>(null);

  const canManageCircles = canPerformAdminAction(session, 'manageCircles');

  useEffect(() => {
    if (initialSearch) setSearch(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    setPage(1);
  }, [search, privacyFilter]);

  const filteredGroups = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    return groups.filter((g) => {
      if (privacyFilter !== 'all' && g.privacy !== privacyFilter) return false;
      if (!q) return true;
      return (
        String(g.name ?? '').toLowerCase().includes(q) ||
        String(g.category ?? '').toLowerCase().includes(q) ||
        String(g.id ?? '').toLowerCase().includes(q)
      );
    });
  }, [groups, search, privacyFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedGroups = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredGroups.slice(start, start + pageSize);
  }, [filteredGroups, safePage]);

  const filteredLegacy = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    return legacyCircles.filter(
      (c) =>
        !q ||
        String(c.nom ?? '').toLowerCase().includes(q) ||
        String(c.categorie ?? '').toLowerCase().includes(q)
    );
  }, [legacyCircles, search]);

  const openEditor = (g: CommunityGroup) => {
    setEditingGroup(g);
    setEditForm({
      name: g.name,
      description: g.description,
      category: g.category,
      privacy: g.privacy,
      postPermission: g.postPermission,
      requirePostApproval: g.requirePostApproval,
      requireMemberApproval: g.requireMemberApproval,
      allowAnonymousPosts: g.allowAnonymousPosts
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une communauté par nom, catégorie ou ID..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-blue-600"
          />
        </div>
        <select
          value={privacyFilter}
          onChange={(e) => setPrivacyFilter(e.target.value as any)}
          className="min-h-[38px] px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg"
        >
          <option value="all">Toutes confidentialités ({groups.length})</option>
          <option value="public">Publiques</option>
          <option value="private">Privées</option>
        </select>
      </div>

      {/* Community Groups */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Communautés ({filteredGroups.length})
          </h3>
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-4">Communauté</th>
                <th className="py-2.5 px-4">Confidentialité</th>
                <th className="py-2.5 px-4">Gouvernance</th>
                <th className="py-2.5 px-4">Membres / Posts</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {paginatedGroups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500 dark:text-slate-400">
                    <Layers className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    Aucune communauté trouvée.
                  </td>
                </tr>
              ) : (
                paginatedGroups.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-4">
                      <p className="font-semibold text-slate-900 dark:text-white">{g.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {g.category} · <span className="font-mono text-slate-400 dark:text-slate-500">{g.id}</span>
                      </p>
                    </td>
                    <td className="py-2.5 px-4">
                      <button
                        type="button"
                        disabled={!canManageCircles}
                        onClick={() => {
                          const nextPrivacy = g.privacy === 'public' ? 'private' : 'public';
                          setConfirmState({
                            title: 'Modifier la confidentialité',
                            description: `Passer "${g.name}" en mode ${nextPrivacy === 'private' ? 'Privé' : 'Public'} ?`,
                            confirmLabel: 'Confirmer',
                            tone: 'warning',
                            action: async () => {
                              await adminService.updateCommunityGroupAdmin(session, g, {
                                privacy: nextPrivacy
                              });
                              onNotify(`Confidentialité de "${g.name}" mise à jour.`);
                              await onRefresh();
                            }
                          });
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 disabled:opacity-50"
                      >
                        {g.privacy === 'private' ? (
                          <>
                            <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span>Privée</span>
                          </>
                        ) : (
                          <>
                            <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Publique</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-2.5 px-4">
                      <button
                        type="button"
                        disabled={!canManageCircles}
                        onClick={() => {
                          const nextApproval = !g.requirePostApproval;
                          setConfirmState({
                            title: 'Modération a priori des publications',
                            description: `${nextApproval ? 'Activer' : 'Désactiver'} l'approbation préalable des publications dans "${g.name}" ?`,
                            confirmLabel: 'Appliquer',
                            tone: 'primary',
                            action: async () => {
                              await adminService.updateCommunityGroupAdmin(session, g, {
                                requirePostApproval: nextApproval
                              });
                              onNotify('Règle de modération mise à jour.');
                              await onRefresh();
                            }
                          });
                        }}
                        className="text-[11px] font-medium text-slate-700 dark:text-slate-300 underline decoration-slate-300 dark:decoration-slate-600 hover:text-blue-600 disabled:opacity-50"
                      >
                        {g.requirePostApproval ? 'Approbation posts requise' : 'Publication libre'}
                      </button>
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-[11px] text-slate-700 dark:text-slate-300">
                      {g.memberCount} membres · {g.postCount} posts
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        {canManageCircles && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditor(g)}
                              title="Éditer la communauté"
                              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmState({
                                  title: 'Supprimer cette communauté',
                                  description: `Supprimer définitivement la communauté "${g.name}" ? Cette action est irréversible.`,
                                  confirmLabel: 'Supprimer',
                                  tone: 'danger',
                                  action: async () => {
                                    await adminService.deleteCommunityGroupAdmin(session, g);
                                    onNotify(`Communauté "${g.name}" supprimée.`);
                                    await onRefresh();
                                  }
                                })
                              }
                              className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md"
                              title="Supprimer cette communauté"
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
          {paginatedGroups.length === 0 ? (
            <p className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              Aucune communauté trouvée.
            </p>
          ) : (
            paginatedGroups.map((g) => (
              <div key={g.id} className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{g.name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {g.category} · {g.privacy === 'private' ? 'Privée' : 'Publique'}
                    </p>
                  </div>
                  <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                    {g.memberCount} mb · {g.postCount} posts
                  </span>
                </div>
                {canManageCircles && (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => openEditor(g)}
                      className="min-h-[38px] flex-1 px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg"
                    >
                      Configurer
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

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

      {/* Thematic Catalog Circles */}
      {filteredLegacy.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Cercles thématiques catalogue ({filteredLegacy.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-4">Nom</th>
                  <th className="py-2.5 px-4">Catégorie</th>
                  <th className="py-2.5 px-4">Description</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredLegacy.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">{c.nom}</td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">{c.categorie}</td>
                    <td className="py-2.5 px-4 max-w-md truncate text-slate-500 dark:text-slate-400">
                      {c.description}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {canManageCircles && (
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmState({
                              title: 'Supprimer ce Cercle thématique',
                              description: `Supprimer "${c.nom}" du catalogue ?`,
                              confirmLabel: 'Supprimer',
                              tone: 'danger',
                              action: async () => {
                                await adminService.deleteLegacyCircleAdmin(session, c);
                                onNotify(`Cercle "${c.nom}" supprimé.`);
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

      {/* Community Edit Modal */}
      {editingGroup && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-[1px] flex items-center justify-center p-4"
          onClick={() => setEditingGroup(null)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Modifier la communauté
              </h3>
              <button
                type="button"
                onClick={() => setEditingGroup(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsProcessing(true);
                try {
                  await adminService.updateCommunityGroupDetailsAdmin(session, editingGroup, editForm);
                  onNotify(`Communauté "${editForm.name}" mise à jour.`);
                  setEditingGroup(null);
                  await onRefresh();
                } catch (err: any) {
                  onNotify(err?.message || 'Erreur lors de la sauvegarde.', 'error');
                } finally {
                  setIsProcessing(false);
                }
              }}
              className="p-5 overflow-y-auto space-y-4 text-xs"
            >
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Nom</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={120}
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Catégorie</label>
                <input
                  type="text"
                  required
                  maxLength={60}
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <textarea
                  rows={3}
                  required
                  maxLength={2000}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Confidentialité
                  </label>
                  <select
                    value={editForm.privacy}
                    onChange={(e) => setEditForm({ ...editForm, privacy: e.target.value as any })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    <option value="public">Publique</option>
                    <option value="private">Privée</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Droit de publication
                  </label>
                  <select
                    value={editForm.postPermission}
                    onChange={(e) => setEditForm({ ...editForm, postPermission: e.target.value as any })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    <option value="all_members">Tous les membres</option>
                    <option value="admins_only">Admins uniquement</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    Approbation des publications requise
                  </span>
                  <input
                    type="checkbox"
                    checked={editForm.requirePostApproval}
                    onChange={(e) => setEditForm({ ...editForm, requirePostApproval: e.target.checked })}
                    className="w-4 h-4 accent-blue-600"
                  />
                </label>
                <label className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    Approbation des nouveaux membres requise
                  </span>
                  <input
                    type="checkbox"
                    checked={editForm.requireMemberApproval}
                    onChange={(e) => setEditForm({ ...editForm, requireMemberApproval: e.target.checked })}
                    className="w-4 h-4 accent-blue-600"
                  />
                </label>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
                  className="min-h-[38px] px-4 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="min-h-[38px] px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                >
                  Enregistrer
                </button>
              </div>
            </form>
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
              onNotify(err?.message || 'Erreur lors de la mise à jour de la communauté.', 'error');
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
// MODULE 7 : SIGNALEMENTS & TICKETS SUPPORT
// ============================================================================
interface ReportsModuleProps {
  session: AdminSessionContext;
  userReports: UserReport[];
  groupReports: GroupReport[];
  supportTickets: SupportTicket[];
  initialSearch?: string;
  onRefresh: () => Promise<void>;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}

export const ReportsManagementModule: React.FC<ReportsModuleProps> = ({
  session,
  userReports,
  groupReports,
  supportTickets,
  initialSearch = '',
  onRefresh,
  onNotify
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'resolved'>('pending');
  const [search, setSearch] = useState(initialSearch);
  const [isProcessing, setIsProcessing] = useState(false);

  const canManageReports = canPerformAdminAction(session, 'manageReports');

  useEffect(() => {
    if (initialSearch) setSearch(initialSearch);
  }, [initialSearch]);

  const filteredGroupReports = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    return groupReports.filter((r) => {
      if (statusFilter === 'pending' && r.status !== 'pending') return false;
      if (statusFilter === 'resolved' && r.status === 'pending') return false;
      if (!q) return true;
      return (
        String(r.reason ?? '').toLowerCase().includes(q) ||
        String(r.targetPreview ?? '').toLowerCase().includes(q) ||
        String(r.reporterName ?? '').toLowerCase().includes(q)
      );
    });
  }, [groupReports, statusFilter, search]);

  const filteredUserReports = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    return userReports.filter((r) => {
      if (statusFilter === 'pending' && r.status !== 'en_attente') return false;
      if (statusFilter === 'resolved' && r.status === 'en_attente') return false;
      if (!q) return true;
      return (
        String(r.reason ?? '').toLowerCase().includes(q) ||
        String(r.details ?? '').toLowerCase().includes(q) ||
        String(r.reporter_nom ?? '').toLowerCase().includes(q) ||
        String(r.reported_user_id ?? '').toLowerCase().includes(q)
      );
    });
  }, [userReports, statusFilter, search]);

  const filteredTickets = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    return supportTickets.filter((t) => {
      if (statusFilter === 'pending' && t.status === 'resolved') return false;
      if (statusFilter === 'resolved' && t.status !== 'resolved') return false;
      if (!q) return true;
      return (
        String(t.subject ?? '').toLowerCase().includes(q) ||
        String(t.description ?? '').toLowerCase().includes(q) ||
        String(t.userName ?? '').toLowerCase().includes(q)
      );
    });
  }, [supportTickets, statusFilter, search]);

  const handleGroupReportAction = async (
    r: GroupReport,
    status: 'resolved' | 'dismissed' | 'pending'
  ) => {
    if (!canManageReports) return;
    setIsProcessing(true);
    try {
      await adminService.resolveGroupReport(session, r, status);
      onNotify(`Signalement marqué "${status}".`);
      await onRefresh();
    } catch (err: any) {
      onNotify(err?.message || 'Erreur lors du traitement.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUserReportAction = async (
    r: UserReport,
    status: 'traite' | 'examine' | 'en_attente'
  ) => {
    if (!canManageReports) return;
    setIsProcessing(true);
    try {
      await adminService.resolveUserReport(session, r, status);
      onNotify(`Signalement utilisateur marqué "${status}".`);
      await onRefresh();
    } catch (err: any) {
      onNotify(err?.message || 'Erreur lors du traitement.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTicketAction = async (
    t: SupportTicket,
    status: 'open' | 'in_review' | 'resolved'
  ) => {
    if (!canManageReports) return;
    setIsProcessing(true);
    try {
      await adminService.updateSupportTicketStatusAdmin(session, t, status);
      onNotify(`Ticket marqué "${status}".`);
      await onRefresh();
    } catch (err: any) {
      onNotify(err?.message || 'Erreur lors de la mise à jour du ticket.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const pendingTotal =
    groupReports.filter((r) => r.status === 'pending').length +
    userReports.filter((r) => r.status === 'en_attente').length;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>
              <strong className="font-mono tabular-nums text-slate-900 dark:text-white">{pendingTotal}</strong>{' '}
              signalement(s) en attente
            </span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrer par motif ou auteur..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg"
            />
          </div>
        </div>

        <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-xs font-semibold">
          {[
            { id: 'pending', label: 'En attente' },
            { id: 'resolved', label: 'Traités' },
            { id: 'all', label: 'Tous' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as any)}
              className={`min-h-[36px] px-3.5 py-1.5 ${
                statusFilter === tab.id
                  ? 'bg-slate-900 dark:bg-blue-600 text-white'
                  : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content / Circle Reports */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Signalements de contenus ({filteredGroupReports.length})
          </h3>
        </div>
        {filteredGroupReports.length === 0 ? (
          <p className="p-8 text-xs text-slate-500 dark:text-slate-400 text-center">
            Aucun signalement de contenu dans cette vue.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredGroupReports.map((r) => (
              <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    {r.reason}{' '}
                    <span className="font-mono font-normal text-slate-400">
                      · {r.targetType} ({r.targetId})
                    </span>
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">Aperçu : {r.targetPreview}</p>
                  {r.details && <p className="text-[11px] text-slate-500 dark:text-slate-400">{r.details}</p>}
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Signalé par {r.reporterName} · Communauté : <span className="font-mono">{r.groupId}</span>
                  </p>
                </div>
                {canManageReports && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {r.status === 'pending' ? (
                      <>
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleGroupReportAction(r, 'resolved')}
                          className="min-h-[38px] inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Résoudre
                        </button>
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleGroupReportAction(r, 'dismissed')}
                          className="min-h-[38px] inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Classer
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400 uppercase">
                          {r.status}
                        </span>
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleGroupReportAction(r, 'pending')}
                          className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Rouvrir
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User Reports */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Signalements d&apos;utilisateurs ({filteredUserReports.length})
          </h3>
        </div>
        {filteredUserReports.length === 0 ? (
          <p className="p-8 text-xs text-slate-500 dark:text-slate-400 text-center">
            Aucun signalement d&apos;utilisateur dans cette vue.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredUserReports.map((r) => (
              <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    Motif : {r.reason}{' '}
                    <span className="font-mono font-normal text-slate-400">· Cible UID: {r.reported_user_id}</span>
                  </p>
                  {r.details && <p className="text-xs text-slate-600 dark:text-slate-300">{r.details}</p>}
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Signalé par {r.reporter_nom}</p>
                </div>
                {canManageReports && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {r.status === 'en_attente' ? (
                      <>
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleUserReportAction(r, 'traite')}
                          className="min-h-[38px] px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                        >
                          Marquer traité
                        </button>
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleUserReportAction(r, 'examine')}
                          className="min-h-[38px] px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg"
                        >
                          Classer examiné
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400 uppercase">
                          {r.status}
                        </span>
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleUserReportAction(r, 'en_attente')}
                          className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Rouvrir
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Support Tickets from Zaure Settings */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 flex items-center gap-2">
          <LifeBuoy className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Tickets d&apos;assistance utilisateurs ({filteredTickets.length})
          </h3>
        </div>
        {filteredTickets.length === 0 ? (
          <p className="p-8 text-xs text-slate-500 dark:text-slate-400 text-center">
            Aucun ticket d&apos;assistance dans cette vue.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredTickets.map((t) => (
              <div key={t.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    {t.subject}{' '}
                    <span className="font-mono font-normal text-blue-600 dark:text-blue-400">
                      · {t.category}
                    </span>
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{t.description}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    De {t.userName} {t.userEmail ? `(${t.userEmail})` : ''} ·{' '}
                    {new Date(t.createdAt).toLocaleString('fr-FR')}
                  </p>
                </div>
                {canManageReports && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {t.status !== 'resolved' ? (
                      <>
                        {t.status === 'open' && (
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleTicketAction(t, 'in_review')}
                            className="min-h-[36px] px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
                          >
                            Prendre en charge
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleTicketAction(t, 'resolved')}
                          className="min-h-[36px] px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                        >
                          Résoudre
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 uppercase">
                          resolved
                        </span>
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleTicketAction(t, 'open')}
                          className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Rouvrir
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
