import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import {
  LayoutDashboard,
  Users,
  FileText,
  MessageSquare,
  Layers,
  ShieldAlert,
  AlertTriangle,
  FolderOpen,
  HardDrive,
  Bell,
  UserCog,
  KeyRound,
  History,
  Settings,
  RefreshCw,
  LogOut,
  Menu,
  X,
  ExternalLink,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { auth } from '../firebaseClient';
import {
  Capsule,
  Circle,
  Comment,
  CommunityGroup,
  GroupPost,
  GroupReport,
  PostComment,
  UserProfile,
  UserReport
} from '../types';
import {
  AdminAccount,
  AdminAuditLog,
  AdminModuleId,
  AdminSessionContext,
  DEFAULT_PLATFORM_SETTINGS,
  IndexedZaureFile,
  MODULE_TO_PERMISSION,
  PlatformNotification,
  PlatformSettings,
  UserModeration
} from './types';
import { adminService } from './services/adminService';
import { AdminAuthGate } from './components/AdminAuthGate';
import { DashboardOverviewModule } from './modules/DashboardOverviewModule';
import { UsersManagementModule } from './modules/UsersManagementModule';
import {
  CommentsManagementModule,
  ContentModerationModule,
  PostsManagementModule
} from './modules/ContentAndModerationModules';
import {
  CirclesManagementModule,
  ReportsManagementModule
} from './modules/CirclesAndReportsModules';
import {
  FilesManagementModule,
  GoogleDriveModule
} from './modules/FilesAndDriveModules';
import {
  AdminsManagementModule,
  AuditLogModule,
  NotificationsManagementModule,
  PermissionsSecurityModule,
  PlatformSettingsModule
} from './modules/GovernanceModules';

interface NavItem {
  id: AdminModuleId;
  label: string;
  group: 'Opérations' | 'Modération & Médias' | 'Gouvernance';
  icon: React.FC<{ className?: string }>;
}

const ADMIN_NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Tableau de bord', group: 'Opérations', icon: LayoutDashboard },
  { id: 'users', label: 'Utilisateurs', group: 'Opérations', icon: Users },
  { id: 'posts', label: 'Publications', group: 'Opérations', icon: FileText },
  { id: 'comments', label: 'Commentaires', group: 'Opérations', icon: MessageSquare },
  { id: 'circles', label: 'Cercles', group: 'Opérations', icon: Layers },
  { id: 'moderation', label: 'Modération', group: 'Modération & Médias', icon: ShieldAlert },
  { id: 'reports', label: 'Signalements', group: 'Modération & Médias', icon: AlertTriangle },
  { id: 'files', label: 'Gestion des fichiers', group: 'Modération & Médias', icon: FolderOpen },
  { id: 'drive', label: 'Stockage Google Drive', group: 'Modération & Médias', icon: HardDrive },
  { id: 'notifications', label: 'Notifications', group: 'Gouvernance', icon: Bell },
  { id: 'admins', label: 'Administrateurs', group: 'Gouvernance', icon: UserCog },
  { id: 'security', label: 'Permissions & sécurité', group: 'Gouvernance', icon: KeyRound },
  { id: 'audit', label: "Journal d'audit", group: 'Gouvernance', icon: History },
  { id: 'settings', label: 'Paramètres', group: 'Gouvernance', icon: Settings }
];

export const AdminPortalRoot: React.FC = () => {
  const navigate = useNavigate();
  const { moduleId } = useParams<{ moduleId?: string }>();

  const activeModule: AdminModuleId = ADMIN_NAV_ITEMS.some((i) => i.id === moduleId)
    ? (moduleId as AdminModuleId)
    : 'dashboard';

  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [session, setSession] = useState<AdminSessionContext | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [isLoadingData, setIsLoadingData] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tone: 'success' | 'error' } | null>(null);

  // Real Firestore data states
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [moderationMap, setModerationMap] = useState<Record<string, UserModeration>>({});
  const [groupPosts, setGroupPosts] = useState<GroupPost[]>([]);
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [postComments, setPostComments] = useState<PostComment[]>([]);
  const [capsuleComments, setCapsuleComments] = useState<Comment[]>([]);
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [legacyCircles, setLegacyCircles] = useState<Circle[]>([]);
  const [userReports, setUserReports] = useState<UserReport[]>([]);
  const [groupReports, setGroupReports] = useState<GroupReport[]>([]);
  const [files, setFiles] = useState<IndexedZaureFile[]>([]);
  const [notifications, setNotifications] = useState<PlatformNotification[]>([]);
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);

  const showToast = useCallback((msg: string, tone: 'success' | 'error' = 'success') => {
    setToast({ msg, tone });
    setTimeout(() => {
      setToast((curr) => (curr?.msg === msg ? null : curr));
    }, 4000);
  }, []);

  const refreshSession = useCallback(async () => {
    if (!auth) {
      setSession(null);
      setIsCheckingAuth(false);
      return;
    }
    const user = auth.currentUser;
    if (user) {
      try {
        await user.reload();
      } catch {
        // ignore network reload error
      }
    }
    const resolved = await adminService.resolveAdminSession(auth.currentUser);
    setSession(resolved);
    setIsCheckingAuth(false);
  }, []);

  useEffect(() => {
    if (!auth) {
      setIsCheckingAuth(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (user) => {
      const resolved = await adminService.resolveAdminSession(user);
      setSession(resolved);
      setIsCheckingAuth(false);
    });
    return () => unsub();
  }, []);

  const loadAllAdminData = useCallback(async () => {
    if (!session || !session.isAuthorized) return;
    setIsLoadingData(true);
    try {
      const [
        usersRes,
        pubsRes,
        commentsRes,
        circlesRes,
        reportsRes,
        filesRes,
        notifsRes,
        adminsRes,
        auditRes,
        settingsRes
      ] = await Promise.all([
        adminService.getAllUsers(session.role),
        adminService.getAllPublications(),
        adminService.getAllComments(),
        adminService.getAllCircles(),
        adminService.getAllReports(),
        adminService.getCentralizedFiles(session.role),
        adminService.getPlatformNotifications(),
        adminService.getAdminAccounts(),
        adminService.getAuditLogs(200),
        adminService.getPlatformSettings()
      ]);

      setUsers(usersRes.users);
      setModerationMap(usersRes.moderationMap);
      setGroupPosts(pubsRes.groupPosts);
      setCapsules(pubsRes.capsules);
      setPostComments(commentsRes.postComments);
      setCapsuleComments(commentsRes.capsuleComments);
      setGroups(circlesRes.groups);
      setLegacyCircles(circlesRes.legacyCircles);
      setUserReports(reportsRes.userReports);
      setGroupReports(reportsRes.groupReports);
      setFiles(filesRes);
      setNotifications(notifsRes);
      setAdmins(adminsRes);
      setAuditLogs(auditRes);
      setSettings(settingsRes);
    } catch (err: any) {
      showToast(err?.message || 'Erreur lors du chargement des données.', 'error');
    } finally {
      setIsLoadingData(false);
    }
  }, [session, showToast]);

  useEffect(() => {
    if (session?.isAuthorized) {
      loadAllAdminData();
    }
  }, [session?.isAuthorized, loadAllAdminData]);

  const navigateModule = (id: AdminModuleId) => {
    setMobileMenuOpen(false);
    navigate(id === 'dashboard' ? '/admin' : `/admin/${id}`);
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white">
            Z
          </div>
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
            Vérification des habilitations /admin...
          </span>
        </div>
      </div>
    );
  }

  if (!session || !session.isAuthorized) {
    return (
      <AdminAuthGate
        session={session}
        onSessionRefresh={refreshSession}
        onNavigateUserApp={() => navigate('/')}
      />
    );
  }

  const visibleNavItems = ADMIN_NAV_ITEMS.filter(
    (item) => session.role === 'SUPER_ADMIN' || session.permissions[MODULE_TO_PERMISSION[item.id]]
  );

  const currentNavMeta = ADMIN_NAV_ITEMS.find((i) => i.id === activeModule) || ADMIN_NAV_ITEMS[0];
  const hasPermission =
    session.role === 'SUPER_ADMIN' || session.permissions[MODULE_TO_PERMISSION[activeModule]];

  const pendingReportsCount =
    groupReports.filter((r) => r.status === 'pending').length +
    userReports.filter((r) => r.status === 'en_attente').length;
  const pendingPostsCount = groupPosts.filter((p) => p.status === 'pending').length;

  const groupsOrder: Array<NavItem['group']> = ['Opérations', 'Modération & Médias', 'Gouvernance'];

  const SidebarContent = (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 border-r border-slate-800">
      <div className="h-14 px-4 flex items-center justify-between border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-black text-sm flex items-center justify-center">
            Z
          </div>
          <div className="leading-tight">
            <p className="text-sm font-extrabold text-white tracking-tight">Zaure Admin</p>
            <p className="text-[10px] font-mono text-slate-400">CONSOLE SAAS</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {groupsOrder.map((groupName) => {
          const items = visibleNavItems.filter((i) => i.group === groupName);
          if (items.length === 0) return null;
          return (
            <div key={groupName}>
              <p className="px-2.5 mb-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500">
                {groupName}
              </p>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeModule === item.id;
                  const badgeCount =
                    item.id === 'reports'
                      ? pendingReportsCount
                      : item.id === 'moderation'
                        ? pendingPostsCount
                        : 0;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigateModule(item.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                        isActive
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 truncate">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {badgeCount > 0 && (
                        <span className="font-mono tabular-nums text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                          {badgeCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-800 space-y-2 shrink-0">
        <div className="px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-800">
          <p className="text-xs font-bold text-white truncate">{session.displayName}</p>
          <p className="text-[11px] font-mono text-blue-400 mt-0.5">{session.role}</p>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-2.5 py-1.5 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-lg inline-flex items-center justify-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            <span>App Zaure</span>
          </button>
          <button
            type="button"
            onClick={async () => {
              await adminService.signOutAdmin();
              await refreshSession();
            }}
            className="px-2.5 py-1.5 text-[11px] font-medium text-red-300 hover:text-red-200 bg-slate-900 hover:bg-slate-800 rounded-lg inline-flex items-center justify-center gap-1"
          >
            <LogOut className="w-3 h-3" />
            <span>Quitter</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-[260px] shrink-0 sticky top-0 h-screen">
        {SidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 lg:hidden flex"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div className="w-[270px] h-full" onClick={(e) => e.stopPropagation()}>
            {SidebarContent}
          </div>
        </div>
      )}

      {/* Main Content Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500 truncate">
              <span className="font-mono text-slate-400">admin</span>
              <span>/</span>
              <span className="font-bold text-slate-900 truncate">{currentNavMeta.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isLoadingData}
              onClick={loadAllAdminData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Actualiser</span>
            </button>
          </div>
        </header>

        {/* Admin Toast Notification */}
        {toast && (
          <div className="px-4 sm:px-6 pt-4">
            <div
              className={`px-4 py-2.5 rounded-lg border text-xs font-medium flex items-center gap-2 ${
                toast.tone === 'error'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              {toast.tone === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              <span>{toast.msg}</span>
            </div>
          </div>
        )}

        {/* Active Module Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">
                {currentNavMeta.label}
              </h1>
              <p className="text-xs text-slate-500">
                Administration indépendante Zaure · Rôle actif :{' '}
                <span className="font-mono font-semibold text-slate-700">{session.role}</span>
              </p>
            </div>
          </div>

          {!hasPermission ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-2">
              <KeyRound className="w-6 h-6 text-amber-600 mx-auto" />
              <p className="text-sm font-bold text-slate-900">Module restreint pour votre rôle</p>
              <p className="text-xs text-slate-500">
                Votre niveau d&apos;habilitation ({session.role}) n&apos;inclut pas l&apos;accès à ce module.
              </p>
            </div>
          ) : isLoadingData && users.length === 0 && groupPosts.length === 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
                ))}
              </div>
              <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
            </div>
          ) : (
            <>
              {activeModule === 'dashboard' && (
                <DashboardOverviewModule
                  users={users}
                  groupPosts={groupPosts}
                  capsules={capsules}
                  groups={groups}
                  commentsCount={postComments.length + capsuleComments.length}
                  userReports={userReports}
                  groupReports={groupReports}
                  auditLogs={auditLogs}
                  onNavigateModule={navigateModule}
                />
              )}

              {activeModule === 'users' && (
                <UsersManagementModule
                  session={session}
                  users={users}
                  moderationMap={moderationMap}
                  onRefresh={loadAllAdminData}
                  onNotify={showToast}
                />
              )}

              {activeModule === 'posts' && (
                <PostsManagementModule
                  session={session}
                  groupPosts={groupPosts}
                  capsules={capsules}
                  onRefresh={loadAllAdminData}
                  onNotify={showToast}
                />
              )}

              {activeModule === 'comments' && (
                <CommentsManagementModule
                  session={session}
                  postComments={postComments}
                  capsuleComments={capsuleComments}
                  onRefresh={loadAllAdminData}
                  onNotify={showToast}
                />
              )}

              {activeModule === 'circles' && (
                <CirclesManagementModule
                  session={session}
                  groups={groups}
                  legacyCircles={legacyCircles}
                  onRefresh={loadAllAdminData}
                  onNotify={showToast}
                />
              )}

              {activeModule === 'moderation' && (
                <ContentModerationModule
                  session={session}
                  groupPosts={groupPosts}
                  settings={settings}
                  onRefresh={loadAllAdminData}
                  onNotify={showToast}
                />
              )}

              {activeModule === 'reports' && (
                <ReportsManagementModule
                  session={session}
                  userReports={userReports}
                  groupReports={groupReports}
                  onRefresh={loadAllAdminData}
                  onNotify={showToast}
                />
              )}

              {activeModule === 'files' && (
                <FilesManagementModule
                  session={session}
                  files={files}
                  settings={settings}
                  onGoToDrive={() => navigateModule('drive')}
                  onNotify={showToast}
                />
              )}

              {activeModule === 'drive' && (
                <GoogleDriveModule
                  session={session}
                  files={files}
                  settings={settings}
                  onNotify={showToast}
                />
              )}

              {activeModule === 'notifications' && (
                <NotificationsManagementModule
                  session={session}
                  notifications={notifications}
                  onRefresh={loadAllAdminData}
                  onNotify={showToast}
                />
              )}

              {activeModule === 'admins' && (
                <AdminsManagementModule
                  session={session}
                  admins={admins}
                  users={users}
                  onRefresh={loadAllAdminData}
                  onSessionRefresh={refreshSession}
                  onNotify={showToast}
                />
              )}

              {activeModule === 'security' && (
                <PermissionsSecurityModule
                  session={session}
                  admins={admins}
                  onRefresh={loadAllAdminData}
                  onNotify={showToast}
                />
              )}

              {activeModule === 'audit' && <AuditLogModule logs={auditLogs} />}

              {activeModule === 'settings' && (
                <PlatformSettingsModule
                  session={session}
                  settings={settings}
                  onRefresh={loadAllAdminData}
                  onNotify={showToast}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};
