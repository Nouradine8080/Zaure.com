import React, { useMemo, useState } from 'react';
import {
  Search,
  Lock,
  Globe,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Layers
} from 'lucide-react';
import { Circle, CommunityGroup, GroupReport, UserReport } from '../../types';
import { AdminSessionContext } from '../types';
import { adminService } from '../services/adminService';
import { ConfirmModal } from '../components/ConfirmModal';

// ============================================================================
// MODULE 5 : GESTION DES CERCLES
// ============================================================================
interface CirclesModuleProps {
  session: AdminSessionContext;
  groups: CommunityGroup[];
  legacyCircles: Circle[];
  onRefresh: () => Promise<void>;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}

export const CirclesManagementModule: React.FC<CirclesModuleProps> = ({
  session,
  groups,
  legacyCircles,
  onRefresh,
  onNotify
}) => {
  const [search, setSearch] = useState('');
  const [privacyFilter, setPrivacyFilter] = useState<'all' | 'public' | 'private'>('all');
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    tone: 'danger' | 'warning' | 'primary';
    action: () => Promise<void>;
  } | null>(null);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups.filter((g) => {
      if (privacyFilter !== 'all' && g.privacy !== privacyFilter) return false;
      if (!q) return true;
      return (
        g.name.toLowerCase().includes(q) ||
        g.category.toLowerCase().includes(q) ||
        g.id.toLowerCase().includes(q)
      );
    });
  }, [groups, search, privacyFilter]);

  const filteredLegacy = useMemo(() => {
    const q = search.trim().toLowerCase();
    return legacyCircles.filter(
      (c) =>
        !q ||
        c.nom.toLowerCase().includes(q) ||
        c.categorie.toLowerCase().includes(q)
    );
  }, [legacyCircles, search]);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un Cercle par nom, catégorie ou ID..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
          />
        </div>
        <select
          value={privacyFilter}
          onChange={(e) => setPrivacyFilter(e.target.value as any)}
          className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg"
        >
          <option value="all">Toutes confidentialités ({groups.length})</option>
          <option value="public">Publics</option>
          <option value="private">Privés</option>
        </select>
      </div>

      {/* Community Groups */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Cercles communautaires ({filteredGroups.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-2.5 px-4">Cercle</th>
                <th className="py-2.5 px-4">Confidentialité</th>
                <th className="py-2.5 px-4">Gouvernance</th>
                <th className="py-2.5 px-4">Membres / Posts</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredGroups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    <Layers className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                    Aucun cercle communautaire trouvé.
                  </td>
                </tr>
              ) : (
                filteredGroups.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4">
                      <p className="font-semibold text-slate-900">{g.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {g.category} · <span className="font-mono text-slate-400">{g.id}</span>
                      </p>
                    </td>
                    <td className="py-2.5 px-4">
                      <button
                        type="button"
                        onClick={() => {
                          const nextPrivacy = g.privacy === 'public' ? 'private' : 'public';
                          setConfirmState({
                            title: 'Modifier la confidentialité du Cercle',
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
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-blue-600"
                      >
                        {g.privacy === 'private' ? (
                          <>
                            <Lock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Privé</span>
                          </>
                        ) : (
                          <>
                            <Globe className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Public</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-2.5 px-4">
                      <button
                        type="button"
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
                        className="text-[11px] font-medium text-slate-700 underline decoration-slate-300 hover:text-blue-600"
                      >
                        {g.requirePostApproval ? 'Approbation posts requise' : 'Publication libre'}
                      </button>
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-[11px] text-slate-700">
                      {g.memberCount} membres · {g.postCount} posts
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmState({
                            title: 'Supprimer ce Cercle',
                            description: `Supprimer définitivement le Cercle "${g.name}" ? Cette action est irréversible.`,
                            confirmLabel: 'Supprimer',
                            tone: 'danger',
                            action: async () => {
                              await adminService.deleteCommunityGroupAdmin(session, g);
                              onNotify(`Cercle "${g.name}" supprimé.`);
                              await onRefresh();
                            }
                          })
                        }
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-md"
                        title="Supprimer ce Cercle"
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

      {/* Thematic Catalog Circles */}
      {filteredLegacy.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/60">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Cercles thématiques catalogue ({filteredLegacy.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-4">Nom</th>
                  <th className="py-2.5 px-4">Catégorie</th>
                  <th className="py-2.5 px-4">Description</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredLegacy.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{c.nom}</td>
                    <td className="py-2.5 px-4 text-slate-600">{c.categorie}</td>
                    <td className="py-2.5 px-4 max-w-md truncate text-slate-500">{c.description}</td>
                    <td className="py-2.5 px-4 text-right">
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
              onNotify(err?.message || 'Erreur lors de la mise à jour du Cercle.', 'error');
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
// MODULE 7 : SIGNALEMENTS
// ============================================================================
interface ReportsModuleProps {
  session: AdminSessionContext;
  userReports: UserReport[];
  groupReports: GroupReport[];
  onRefresh: () => Promise<void>;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}

export const ReportsManagementModule: React.FC<ReportsModuleProps> = ({
  session,
  userReports,
  groupReports,
  onRefresh,
  onNotify
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'resolved'>('pending');
  const [isProcessing, setIsProcessing] = useState(false);

  const filteredGroupReports = useMemo(() => {
    return groupReports.filter((r) => {
      if (statusFilter === 'pending') return r.status === 'pending';
      if (statusFilter === 'resolved') return r.status !== 'pending';
      return true;
    });
  }, [groupReports, statusFilter]);

  const filteredUserReports = useMemo(() => {
    return userReports.filter((r) => {
      if (statusFilter === 'pending') return r.status === 'en_attente';
      if (statusFilter === 'resolved') return r.status !== 'en_attente';
      return true;
    });
  }, [userReports, statusFilter]);

  const handleGroupReportAction = async (
    r: GroupReport,
    status: 'resolved' | 'dismissed'
  ) => {
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
    status: 'traite' | 'examine'
  ) => {
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

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span>
            <strong className="font-mono tabular-nums text-slate-900">
              {groupReports.filter((r) => r.status === 'pending').length +
                userReports.filter((r) => r.status === 'en_attente').length}
            </strong>{' '}
            signalement(s) en attente de décision
          </span>
        </div>

        <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-xs font-semibold">
          {[
            { id: 'pending', label: 'En attente' },
            { id: 'resolved', label: 'Traités' },
            { id: 'all', label: 'Tous' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 ${
                statusFilter === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content / Circle Reports */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/60">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Signalements de contenus ({filteredGroupReports.length})
          </h3>
        </div>
        {filteredGroupReports.length === 0 ? (
          <p className="p-8 text-xs text-slate-500 text-center">Aucun signalement de contenu dans cette vue.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredGroupReports.map((r) => (
              <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900">
                    {r.reason}{' '}
                    <span className="font-mono font-normal text-slate-400">
                      · {r.targetType} ({r.targetId})
                    </span>
                  </p>
                  <p className="text-xs text-slate-600 truncate">Aperçu : {r.targetPreview}</p>
                  <p className="text-[11px] text-slate-500">
                    Signalé par {r.reporterName} · Cercle : <span className="font-mono">{r.groupId}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.status === 'pending' ? (
                    <>
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleGroupReportAction(r, 'resolved')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Résoudre
                      </button>
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleGroupReportAction(r, 'dismissed')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Classer
                      </button>
                    </>
                  ) : (
                    <span className="text-xs font-mono font-semibold text-slate-500 uppercase">
                      {r.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User Reports */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/60">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Signalements d&apos;utilisateurs ({filteredUserReports.length})
          </h3>
        </div>
        {filteredUserReports.length === 0 ? (
          <p className="p-8 text-xs text-slate-500 text-center">Aucun signalement d&apos;utilisateur dans cette vue.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredUserReports.map((r) => (
              <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900">
                    Motif : {r.reason}{' '}
                    <span className="font-mono font-normal text-slate-400">
                      · Cible UID: {r.reported_user_id}
                    </span>
                  </p>
                  {r.details && <p className="text-xs text-slate-600">{r.details}</p>}
                  <p className="text-[11px] text-slate-500">Signalé par {r.reporter_nom}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.status === 'en_attente' ? (
                    <>
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleUserReportAction(r, 'traite')}
                        className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                      >
                        Marquer traité
                      </button>
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleUserReportAction(r, 'examine')}
                        className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg"
                      >
                        Classer examiné
                      </button>
                    </>
                  ) : (
                    <span className="text-xs font-mono font-semibold text-slate-500 uppercase">
                      {r.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
