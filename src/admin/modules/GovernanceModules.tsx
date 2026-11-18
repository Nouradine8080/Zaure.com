import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Plus,
  Trash2,
  Power,
  ShieldCheck,
  KeyRound,
  Lock,
  Download,
  Search,
  Save,
  UserPlus,
  CheckCircle2,
  Server
} from 'lucide-react';
import { UserProfile } from '../../types';
import {
  AdminAccount,
  AdminAuditLog,
  AdminPermissionKey,
  AdminSessionContext,
  PERMISSION_LABELS,
  PlatformNotification,
  PlatformSettings,
  ROLE_PRESET_PERMISSIONS,
  StaffRole
} from '../types';
import { adminService } from '../services/adminService';
import { ConfirmModal } from '../components/ConfirmModal';

// ============================================================================
// MODULE 10 : NOTIFICATIONS GÉNÉRALES
// ============================================================================
interface NotificationsModuleProps {
  session: AdminSessionContext;
  notifications: PlatformNotification[];
  onRefresh: () => Promise<void>;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}

export const NotificationsManagementModule: React.FC<NotificationsModuleProps> = ({
  session,
  notifications,
  onRefresh,
  onNotify
}) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'info' | 'warning' | 'urgent'>('info');
  const [audience, setAudience] = useState<'all' | 'mentors' | 'admins'>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PlatformNotification | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    setIsSaving(true);
    try {
      await adminService.createPlatformNotification(session, {
        title,
        message,
        priority,
        audience,
        isActive: true
      });
      setTitle('');
      setMessage('');
      onNotify('Notification générale publiée.');
      await onRefresh();
    } catch (err: any) {
      onNotify(err?.message || 'Erreur lors de la création.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <form
        onSubmit={handleCreate}
        className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 h-fit"
      >
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Bell className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900">Nouvelle notification</h3>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Titre</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Mise à jour de la plateforme"
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Message</label>
          <textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Contenu de l'annonce diffusée..."
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Priorité</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg bg-white"
            >
              <option value="info">Information</option>
              <option value="warning">Avertissement</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Audience</label>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value as any)}
              className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg bg-white"
            >
              <option value="all">Tous les membres</option>
              <option value="mentors">Mentors & Vérifiés</option>
              <option value="admins">Équipe Admin</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="w-full py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Diffuser la notification</span>
        </button>
      </form>

      <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            Historique des notifications ({notifications.length})
          </h3>
        </div>
        {notifications.length === 0 ? (
          <p className="p-8 text-xs text-slate-500 text-center">
            Aucune notification générale enregistrée.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((n) => (
              <div key={n.id} className="p-4 flex items-start justify-between gap-4 hover:bg-slate-50">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono font-bold uppercase ${
                        n.priority === 'urgent'
                          ? 'text-red-600'
                          : n.priority === 'warning'
                            ? 'text-amber-600'
                            : 'text-blue-600'
                      }`}
                    >
                      [{n.priority}]
                    </span>
                    <p className="text-xs font-bold text-slate-900">{n.title}</p>
                    <span className="text-[11px] text-slate-400">· {n.audience}</span>
                  </div>
                  <p className="text-xs text-slate-600">{n.message}</p>
                  <p className="text-[11px] font-mono text-slate-400">
                    Par {n.createdByName} · {new Date(n.createdAt).toLocaleString('fr-FR')}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={async () => {
                      await adminService.togglePlatformNotification(session, n);
                      onNotify(`Notification ${n.isActive ? 'désactivée' : 'activée'}.`);
                      await onRefresh();
                    }}
                    title={n.isActive ? 'Désactiver' : 'Activer'}
                    className={`p-1.5 rounded-md ${
                      n.isActive ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(n)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-md"
                    title="Supprimer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {pendingDelete && (
        <ConfirmModal
          open={true}
          title="Supprimer cette notification"
          description={`Supprimer "${pendingDelete.title}" définitivement ?`}
          confirmLabel="Supprimer"
          tone="danger"
          isLoading={isSaving}
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            setIsSaving(true);
            try {
              await adminService.deletePlatformNotification(session, pendingDelete);
              onNotify('Notification supprimée.');
              setPendingDelete(null);
              await onRefresh();
            } finally {
              setIsSaving(false);
            }
          }}
        />
      )}
    </div>
  );
};

// ============================================================================
// MODULE 11 : GESTION DES ADMINISTRATEURS & BOOTSTRAP SUPER_ADMIN
// ============================================================================
interface AdminsModuleProps {
  session: AdminSessionContext;
  admins: AdminAccount[];
  users: UserProfile[];
  onRefresh: () => Promise<void>;
  onSessionRefresh: () => Promise<void>;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}

export const AdminsManagementModule: React.FC<AdminsModuleProps> = ({
  session,
  admins,
  users,
  onRefresh,
  onSessionRefresh,
  onNotify
}) => {
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<StaffRole>('MODERATOR');
  const [isProcessing, setIsProcessing] = useState(false);
  const [serverStatus, setServerStatus] = useState<{
    checked: boolean;
    serverReachable: boolean;
    iamRequired: boolean;
    claimsRole: string;
  }>({ checked: false, serverReachable: false, iamRequired: false, claimsRole: session.claimsRole || 'USER' });

  const [confirmState, setConfirmState] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    tone: 'danger' | 'warning' | 'primary';
    action: () => Promise<void>;
  } | null>(null);

  useEffect(() => {
    let active = true;
    adminService.verifySessionOnServer().then((res) => {
      if (!active) return;
      setServerStatus({
        checked: true,
        serverReachable: res.serverReachable,
        iamRequired: res.iamRequired,
        claimsRole: res.claimsRole
      });
    });
    return () => {
      active = false;
    };
  }, [session.uid, session.role, admins.length]);

  const hasSuperAdminDoc = admins.some((a) => a.role === 'SUPER_ADMIN' && a.isActive);
  const adminIds = new Set(admins.map((a) => a.id));
  const candidateUsers = users.filter((u) => !adminIds.has(u.id) && u.id !== session.uid);

  const handleBootstrap = async () => {
    setIsProcessing(true);
    try {
      const res = await adminService.bootstrapFirstSuperAdmin(session);
      onNotify(
        res.claimsSynced
          ? 'Super Administrateur initialisé avec Custom Claims Firebase côté serveur.'
          : 'Super Administrateur enregistré dans Firestore (Custom Claims serveur en attente IAM).'
      );
      await onSessionRefresh();
      await onRefresh();
    } catch (err: any) {
      onNotify(err?.message || "Erreur lors de l'initialisation.", 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Server Custom Claims Verification Status */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Server className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-900">
              Vérification serveur & Firebase Custom Claims
            </p>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Jeton actuel (<span className="font-mono">claims.zaureRole</span>) :{' '}
              <span className="font-mono font-bold text-slate-900">{session.claimsRole || 'USER'}</span> · Rôle actif :{' '}
              <span className="font-mono font-bold text-blue-600">{session.role}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold border ${
              serverStatus.checked && !serverStatus.iamRequired && serverStatus.serverReachable
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : serverStatus.iamRequired
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}
          >
            {!serverStatus.checked
              ? 'VÉRIFICATION...'
              : serverStatus.iamRequired
                ? 'CLAIMS SERVEUR : IAM REQUIS'
                : serverStatus.serverReachable
                  ? 'API SERVEUR VERIFIÉE'
                  : 'API SERVEUR HORS LIGNE'}
          </span>
          {session.isBootstrapOwner && session.claimsRole !== 'SUPER_ADMIN' && hasSuperAdminDoc && (
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleBootstrap}
              className="px-3 py-1.5 text-[11px] font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg"
            >
              Synchroniser Claims
            </button>
          )}
        </div>
      </div>

      {/* Secure Bootstrap Card when no SUPER_ADMIN doc exists yet */}
      {!hasSuperAdminDoc && session.isBootstrapOwner && (
        <div className="bg-white border border-blue-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Procédure sécurisée : Désigner le premier Super Administrateur
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                Votre e-mail propriétaire vérifié (<span className="font-mono font-semibold">{session.email}</span>) est reconnu. Enregistrez officiellement votre fiche <span className="font-mono">SUPER_ADMIN</span> dans <span className="font-mono">/admins/{session.uid}</span> et attribuez vos Custom Claims Firebase côté serveur.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleBootstrap}
            className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shrink-0"
          >
            Initialiser Super Administrateur
          </button>
        </div>
      )}

      {/* Assign New Admin/Moderator (SUPER_ADMIN only) */}
      {session.role === 'SUPER_ADMIN' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">Nommer un administrateur ou modérateur</h3>
          </div>
          <p className="text-xs text-slate-500">
            Tous les comptes existants conservent le rôle <span className="font-mono">USER</span> par défaut. Aucun utilisateur ne peut modifier son propre rôle.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white md:col-span-1"
            >
              <option value="">Sélectionner un utilisateur Zaure...</option>
              {candidateUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nom} ({u.email || u.id.slice(0, 10)})
                </option>
              ))}
            </select>

            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as StaffRole)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
            >
              <option value="MODERATOR">MODERATOR (Modération & Signalements)</option>
              <option value="ADMIN">ADMIN (Gestion complète hors Super Admin)</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN (Contrôle total & RBAC)</option>
            </select>

            <button
              type="button"
              disabled={!selectedUserId || isProcessing}
              onClick={() => {
                const target = users.find((u) => u.id === selectedUserId);
                if (!target) return;
                setConfirmState({
                  title: `Attribuer le rôle ${selectedRole}`,
                  description: `Confirmez-vous l'élévation de "${target.nom}" (${target.email || target.id}) au rôle ${selectedRole} ?`,
                  confirmLabel: 'Attribuer le rôle',
                  tone: 'warning',
                  action: async () => {
                    const res = await adminService.assignAdminRole(session, target, selectedRole);
                    setSelectedUserId('');
                    onNotify(
                      res.claimsSynced
                        ? `${target.nom} est maintenant ${selectedRole} (Custom Claims serveur appliqués).`
                        : `${target.nom} est maintenant ${selectedRole} (Firestore mis à jour).`
                    );
                    await onRefresh();
                  }
                });
              }}
              className="px-4 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg disabled:opacity-50"
            >
              Assigner le rôle
            </button>
          </div>
        </div>
      )}

      {/* Active Staff Registry */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            Équipe administrative enregistrée ({admins.length})
          </h3>
        </div>
        {admins.length === 0 ? (
          <p className="p-8 text-xs text-slate-500 text-center">
            Aucun document administratif enregistré dans <span className="font-mono">/admins</span>.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Administrateur</th>
                  <th className="py-3 px-4">Rôle RBAC</th>
                  <th className="py-3 px-4">Statut</th>
                  <th className="py-3 px-4">Assigné par</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {admins.map((adm) => {
                  const isSelf = adm.id === session.uid;
                  return (
                    <tr key={adm.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4">
                        <p className="font-semibold text-slate-900">
                          {adm.displayName} {isSelf && <span className="text-[11px] text-blue-600">(Vous)</span>}
                        </p>
                        <p className="text-[11px] font-mono text-slate-500">{adm.email}</p>
                      </td>
                      <td className="py-2.5 px-4">
                        {session.role === 'SUPER_ADMIN' && !isSelf ? (
                          <select
                            value={adm.role}
                            onChange={(e) => {
                              const nextRole = e.target.value as StaffRole;
                              setConfirmState({
                                title: 'Modifier le rôle administratif',
                                description: `Changer le rôle de ${adm.displayName} vers ${nextRole} ?`,
                                confirmLabel: 'Appliquer',
                                tone: 'warning',
                                action: async () => {
                                  await adminService.updateAdminAccount(session, adm, {
                                    role: nextRole,
                                    permissions: { ...ROLE_PRESET_PERMISSIONS[nextRole] }
                                  });
                                  onNotify(`Rôle de ${adm.displayName} mis à jour.`);
                                  await onRefresh();
                                }
                              });
                            }}
                            className="px-2 py-1 text-[11px] font-mono font-bold border border-slate-200 rounded-md bg-white"
                          >
                            <option value="MODERATOR">MODERATOR</option>
                            <option value="ADMIN">ADMIN</option>
                            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                          </select>
                        ) : (
                          <span className="font-mono font-bold text-slate-900">{adm.role}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={`font-semibold ${adm.isActive ? 'text-emerald-600' : 'text-red-600'}`}>
                          {adm.isActive ? 'Actif' : 'Désactivé'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">{adm.assignedBy}</td>
                      <td className="py-2.5 px-4 text-right">
                        {session.role === 'SUPER_ADMIN' && !isSelf && (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmState({
                                  title: adm.isActive ? 'Suspendre accès admin' : 'Réactiver accès admin',
                                  description: `${adm.isActive ? 'Désactiver' : 'Réactiver'} l'accès /admin de ${adm.displayName} ?`,
                                  confirmLabel: adm.isActive ? 'Désactiver' : 'Réactiver',
                                  tone: 'warning',
                                  action: async () => {
                                    await adminService.updateAdminAccount(session, adm, {
                                      isActive: !adm.isActive
                                    });
                                    onNotify('Statut administratif mis à jour.');
                                    await onRefresh();
                                  }
                                })
                              }
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-md"
                              title={adm.isActive ? 'Désactiver' : 'Réactiver'}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmState({
                                  title: 'Révoquer cet administrateur',
                                  description: `Retirer définitivement les droits administratifs de ${adm.displayName} (il redeviendra USER) ?`,
                                  confirmLabel: 'Révoquer',
                                  tone: 'danger',
                                  action: async () => {
                                    await adminService.revokeAdminAccount(session, adm);
                                    onNotify(`Accès révoqué pour ${adm.displayName}.`);
                                    await onRefresh();
                                  }
                                })
                              }
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-md"
                              title="Révoquer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
              onNotify(err?.message || 'Erreur lors de la mise à jour.', 'error');
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
// MODULE 12 : PERMISSIONS ET SÉCURITÉ
// ============================================================================
interface PermissionsSecurityProps {
  session: AdminSessionContext;
  admins: AdminAccount[];
  onRefresh: () => Promise<void>;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}

export const PermissionsSecurityModule: React.FC<PermissionsSecurityProps> = ({
  session,
  admins,
  onRefresh,
  onNotify
}) => {
  const [selectedAdminId, setSelectedAdminId] = useState<string>(
    admins.find((a) => a.id !== session.uid)?.id || ''
  );
  const [isSaving, setIsSaving] = useState(false);

  const selectedAdmin = admins.find((a) => a.id === selectedAdminId);
  const permissionKeys = Object.keys(PERMISSION_LABELS) as AdminPermissionKey[];

  const togglePermission = async (key: AdminPermissionKey) => {
    if (!selectedAdmin || session.role !== 'SUPER_ADMIN' || selectedAdmin.id === session.uid) return;
    setIsSaving(true);
    try {
      const nextPerms = {
        ...selectedAdmin.permissions,
        [key]: !selectedAdmin.permissions[key]
      };
      await adminService.updateAdminAccount(session, selectedAdmin, {
        permissions: nextPerms
      });
      onNotify(`Permission "${PERMISSION_LABELS[key]}" mise à jour.`);
      await onRefresh();
    } catch (err: any) {
      onNotify(err?.message || 'Erreur lors de la mise à jour.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Architecture Security Posture */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-emerald-600" />
          <h3 className="text-sm font-bold text-slate-900">Garanties de sécurité actives</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <p className="font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Anti-auto-élévation
            </p>
            <p className="text-slate-600 mt-1">
              Les règles Firestore et l&apos;API serveur interdisent à tout utilisateur de modifier son propre rôle <span className="font-mono">/admins</span>.
            </p>
          </div>
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <p className="font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Custom Claims serveur
            </p>
            <p className="text-slate-600 mt-1">
              Les routes <span className="font-mono">/api/admin/*</span> vérifient le jeton Firebase avec <span className="font-mono">verifyIdToken</span> et gèrent <span className="font-mono">claims.zaureRole</span>.
            </p>
          </div>
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <p className="font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Isolation PII stricte
            </p>
            <p className="text-slate-600 mt-1">
              Les données privées (<span className="font-mono">/users</span>, <span className="font-mono">/conversations</span>) restent inaccessibles aux utilisateurs et aux modérateurs.
            </p>
          </div>
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <p className="font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Audit immuable
            </p>
            <p className="text-slate-600 mt-1">
              Aucune mise à jour ni suppression n&apos;est autorisée sur <span className="font-mono">/admin_audit_logs</span>, même par le Super Administrateur.
            </p>
          </div>
        </div>
      </div>

      {/* Role Matrix */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-900">Matrice standard des rôles</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-2.5 px-4">Capacité / Module</th>
                <th className="py-2.5 px-4 text-center">USER</th>
                <th className="py-2.5 px-4 text-center">MODERATOR</th>
                <th className="py-2.5 px-4 text-center">ADMIN</th>
                <th className="py-2.5 px-4 text-center">SUPER_ADMIN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {permissionKeys.map((key) => (
                <tr key={key} className="hover:bg-slate-50">
                  <td className="py-2 px-4 font-medium text-slate-800">{PERMISSION_LABELS[key]}</td>
                  <td className="py-2 px-4 text-center font-mono text-slate-400">—</td>
                  <td className="py-2 px-4 text-center font-mono">
                    {ROLE_PRESET_PERMISSIONS.MODERATOR[key] ? (
                      <span className="text-emerald-600 font-bold">OUI</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="py-2 px-4 text-center font-mono">
                    {ROLE_PRESET_PERMISSIONS.ADMIN[key] ? (
                      <span className="text-emerald-600 font-bold">OUI</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="py-2 px-4 text-center font-mono text-blue-600 font-bold">OUI</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Granular Per-Admin Editor */}
      {session.role === 'SUPER_ADMIN' && admins.some((a) => a.id !== session.uid) && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">Permissions granulaires par compte</h3>
            </div>
            <select
              value={selectedAdminId}
              onChange={(e) => setSelectedAdminId(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
            >
              <option value="">Choisir un membre du staff...</option>
              {admins
                .filter((a) => a.id !== session.uid)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.displayName} ({a.role})
                  </option>
                ))}
            </select>
          </div>

          {selectedAdmin && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2">
              {permissionKeys.map((key) => {
                const enabled = Boolean(selectedAdmin.permissions?.[key]);
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={isSaving}
                    onClick={() => togglePermission(key)}
                    className={`p-3 rounded-lg border text-left text-xs flex items-center justify-between transition ${
                      enabled
                        ? 'border-blue-200 bg-blue-50/50 text-slate-900'
                        : 'border-slate-200 bg-white text-slate-500'
                    }`}
                  >
                    <span className="font-medium pr-2">{PERMISSION_LABELS[key]}</span>
                    <span className={`font-mono font-bold text-[11px] ${enabled ? 'text-blue-600' : 'text-slate-400'}`}>
                      {enabled ? 'ON' : 'OFF'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MODULE 13 : JOURNAL D'AUDIT
// ============================================================================
interface AuditLogProps {
  logs: AdminAuditLog[];
}

export const AuditLogModule: React.FC<AuditLogProps> = ({ logs }) => {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR'>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (roleFilter !== 'all' && l.actorRole !== roleFilter) return false;
      if (!q) return true;
      return (
        l.action.toLowerCase().includes(q) ||
        l.actorName.toLowerCase().includes(q) ||
        l.details.toLowerCase().includes(q) ||
        l.module.toLowerCase().includes(q)
      );
    });
  }, [logs, search, roleFilter]);

  const exportCsv = () => {
    const header = ['id', 'createdAt', 'actorRole', 'actorName', 'action', 'module', 'targetType', 'targetId', 'details'];
    const rows = filtered.map((l) =>
      [l.id, l.createdAt, l.actorRole, l.actorName, l.action, l.module, l.targetType, l.targetId, l.details]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(',')
    );
    const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zaure-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par action, acteur, module ou cible..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
          >
            <option value="all">Tous les rôles ({logs.length})</option>
            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            <option value="ADMIN">ADMIN</option>
            <option value="MODERATOR">MODERATOR</option>
          </select>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Horodatage</th>
                <th className="py-3 px-4">Acteur / Rôle</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Module</th>
                <th className="py-3 px-4">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    Aucune entrée d&apos;audit enregistrée.
                  </td>
                </tr>
              ) : (
                filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono tabular-nums text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('fr-FR')}
                    </td>
                    <td className="py-2.5 px-4">
                      <p className="font-semibold text-slate-900">{log.actorName}</p>
                      <p className="text-[10px] font-mono text-slate-500">{log.actorRole}</p>
                    </td>
                    <td className="py-2.5 px-4 font-mono font-semibold text-blue-700">{log.action}</td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600">{log.module}</td>
                    <td className="py-2.5 px-4 text-slate-700 max-w-md">{log.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MODULE 14 : PARAMÈTRES DE LA PLATEFORME
// ============================================================================
interface PlatformSettingsModuleProps {
  session: AdminSessionContext;
  settings: PlatformSettings;
  onRefresh: () => Promise<void>;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}

export const PlatformSettingsModule: React.FC<PlatformSettingsModuleProps> = ({
  session,
  settings,
  onRefresh,
  onNotify
}) => {
  const [form, setForm] = useState<PlatformSettings>(settings);
  const [keywordsText, setKeywordsText] = useState((settings.forbiddenKeywords || []).join(', '));
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const keywords = keywordsText
        .split(',')
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean);
      await adminService.savePlatformSettings(session, {
        ...form,
        forbiddenKeywords: keywords
      });
      onNotify('Paramètres de la plateforme enregistrés.');
      await onRefresh();
    } catch (err: any) {
      onNotify(err?.message || 'Erreur lors de la sauvegarde.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="max-w-3xl bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <div className="pb-4 border-b border-slate-200">
        <h3 className="text-sm font-bold text-slate-900">Configuration globale de Zaure</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Stockée dans <span className="font-mono">/platform_settings/global</span> et journalisée à chaque modification.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Nom de la plateforme</label>
          <input
            type="text"
            value={form.platformName}
            onChange={(e) => setForm({ ...form, platformName: e.target.value })}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Taille maximale fichier (Mo)</label>
          <input
            type="number"
            min={1}
            max={500}
            value={form.maxUploadSizeMb}
            onChange={(e) => setForm({ ...form, maxUploadSizeMb: Number(e.target.value) })}
            className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Dossier racine Google Drive
        </label>
        <input
          type="text"
          value={form.driveRootFolderName}
          onChange={(e) => setForm({ ...form, driveRootFolderName: e.target.value })}
          className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Mots-clés sensibles à surveiller (séparés par des virgules)
        </label>
        <input
          type="text"
          value={keywordsText}
          onChange={(e) => setKeywordsText(e.target.value)}
          placeholder="spam, arnaque, haine..."
          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
        />
      </div>

      <div className="space-y-3 pt-2">
        <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 cursor-pointer">
          <div>
            <p className="text-xs font-bold text-slate-900">Inscriptions ouvertes</p>
            <p className="text-[11px] text-slate-500">Autorise la création de nouveaux comptes membres</p>
          </div>
          <input
            type="checkbox"
            checked={form.registrationOpen}
            onChange={(e) => setForm({ ...form, registrationOpen: e.target.checked })}
            className="w-4 h-4 accent-blue-600"
          />
        </label>

        <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 cursor-pointer">
          <div>
            <p className="text-xs font-bold text-slate-900">Modération préalable par défaut</p>
            <p className="text-[11px] text-slate-500">Appliquer l&apos;approbation sur les nouveaux Cercles créés</p>
          </div>
          <input
            type="checkbox"
            checked={form.requirePostModerationByDefault}
            onChange={(e) => setForm({ ...form, requirePostModerationByDefault: e.target.checked })}
            className="w-4 h-4 accent-blue-600"
          />
        </label>

        <label className="flex items-center justify-between p-3 rounded-lg border border-amber-200 bg-amber-50/40 cursor-pointer">
          <div>
            <p className="text-xs font-bold text-slate-900">Mode maintenance</p>
            <p className="text-[11px] text-slate-600">Affiche un bandeau de maintenance aux utilisateurs</p>
          </div>
          <input
            type="checkbox"
            checked={form.maintenanceMode}
            onChange={(e) => setForm({ ...form, maintenanceMode: e.target.checked })}
            className="w-4 h-4 accent-amber-600"
          />
        </label>
      </div>

      {form.maintenanceMode && (
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Message de maintenance</label>
          <textarea
            rows={2}
            value={form.maintenanceMessage}
            onChange={(e) => setForm({ ...form, maintenanceMessage: e.target.value })}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
          />
        </div>
      )}

      <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
        <span className="text-[11px] font-mono text-slate-400">
          Dernière sauvegarde : {form.updatedAt ? new Date(form.updatedAt).toLocaleString('fr-FR') : '—'}
        </span>
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{isSaving ? 'Enregistrement...' : 'Enregistrer les paramètres'}</span>
        </button>
      </div>
    </form>
  );
};
