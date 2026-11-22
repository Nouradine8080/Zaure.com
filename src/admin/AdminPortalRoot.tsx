import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  AlertCircle,
  Search,
  Sun,
  Moon,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  Wifi,
  WifiOff,
  LifeBuoy
} from 'lucide-react';
import { auth, dbFirestore } from '../firebaseClient';
import {
  Capsule,
  Circle,
  Comment,
  CommunityGroup,
  GroupPost,
  GroupReport,
  PostComment,
  SupportTicket,
  ThemeMode,
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
import {
  applyAndPersistAppearancePreferences,
  loadStoredAppearancePreferences
} from '../utils/appearancePreferences';

type NavGroup = 'Vue générale' | 'Opérations' | 'Modération et médias' | 'Gouvernance';

interface NavItem {
  id: AdminModuleId;
  label: string;
  group: NavGroup;
  icon: React.FC<{ className?: string }>;
}

const ADMIN_NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Tableau de bord', group: 'Vue générale', icon: LayoutDashboard },
  { id: 'users', label: 'Utilisateurs', group: 'Opérations', icon: Users },
  { id: 'posts', label: 'Publications', group: 'Opérations', icon: FileText },
  { id: 'comments', label: 'Commentaires', group: 'Opérations', icon: MessageSquare },
  { id: 'circles', label: 'Communautés', group: 'Opérations', icon: Layers },
  { id: 'moderation', label: 'Modération', group: 'Modération et médias', icon: ShieldAlert },
  { id: 'reports', label: 'Signalements', group: 'Modération et médias', icon: AlertTriangle },
  { id: 'files', label: 'Gestion des fichiers', group: 'Modération et médias', icon: FolderOpen },
  { id: 'drive', label: 'Stockage Google Drive', group: 'Modération et médias', icon: HardDrive },
  { id: 'notifications', label: 'Notifications', group: 'Gouvernance', icon: Bell },
  { id: 'admins', label: 'Administrateurs', group: 'Gouvernance', icon: UserCog },
  { id: 'security', label: 'Permissions et sécurité', group: 'Gouvernance', icon: KeyRound },
  { id: 'audit', label: "Journal d'audit", group: 'Gouvernance', icon: History },
  { id: 'settings', label: 'Paramètres', group: 'Gouvernance', icon: Settings }
];

const SIDEBAR_COLLAPSE_KEY = 'zaure_admin_sidebar_collapsed';

export const AdminPortalRoot: React.FC = () => {
  const navigate = useNavigate();
  const { moduleId } = useParams<{ moduleId?: string }>();

  const normalizedRouteId = moduleId === 'communities' ? 'circles' : moduleId;
  const activeModule: AdminModuleId = ADMIN_NAV_ITEMS.some((i) => i.id === normalizedRouteId)
    ? (normalizedRouteId as AdminModuleId)
    : 'dashboard';

  const cachedAdminSession = useMemo(() => {
    try {
      const raw = localStorage.getItem('zaure_admin_session_cache');
      return raw ? (JSON.parse(raw) as AdminSessionContext) : null;
    } catch {
      return null;
    }
  }, []);

  const [isCheckingAuth, setIsCheckingAuth] = useState(!cachedAdminSession);
  const [session, setSession] = useState<AdminSessionContext | null>(cachedAdminSession);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    return loadStoredAppearancePreferences(cachedAdminSession?.uid).theme_mode;
  });
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Topbar overlays & search seed
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');
  const [notifPopoverOpen, setNotifPopoverOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [moduleSearchSeed, setModuleSearchSeed] = useState<{
    module: AdminModuleId;
    query: string;
    nonce: number;
  } | null>(null);

  const notifRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);

  const [isLoadingData, setIsLoadingData] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
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
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
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

  const handleChangeTheme = useCallback(
    (nextMode: ThemeMode) => {
      setThemeMode(nextMode);
      const currentPrefs = loadStoredAppearancePreferences(session?.uid);
      applyAndPersistAppearancePreferences(
        { ...currentPrefs, theme_mode: nextMode },
        session?.uid
      );
    },
    [session?.uid]
  );

  useEffect(() => {
    const prefs = loadStoredAppearancePreferences(session?.uid);
    setThemeMode(prefs.theme_mode);
    applyAndPersistAppearancePreferences(prefs, session?.uid);
  }, [session?.uid]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setGlobalSearchOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setGlobalSearchOpen(false);
        setNotifPopoverOpen(false);
        setProfileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifPopoverOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  };

  const refreshSession = useCallback(async () => {
    if (!auth) {
      setSession(null);
      localStorage.removeItem('zaure_admin_session_cache');
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
    if (resolved?.isAuthorized) {
      localStorage.setItem('zaure_admin_session_cache', JSON.stringify(resolved));
    } else {
      localStorage.removeItem('zaure_admin_session_cache');
    }
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
      if (resolved?.isAuthorized) {
        localStorage.setItem('zaure_admin_session_cache', JSON.stringify(resolved));
      } else {
        localStorage.removeItem('zaure_admin_session_cache');
      }
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
        ticketsRes,
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
        adminService.getSupportTicketsAdmin(),
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
      setSupportTickets(ticketsRes);
      setFiles(filesRes);
      setNotifications(notifsRes);
      setAdmins(adminsRes);
      setAuditLogs(auditRes);
      setSettings(settingsRes);
      setLastSyncedAt(new Date().toISOString());
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

  const navigateModule = (id: AdminModuleId, seedQuery?: string) => {
    setMobileMenuOpen(false);
    setGlobalSearchOpen(false);
    setNotifPopoverOpen(false);
    setProfileMenuOpen(false);
    if (typeof seedQuery === 'string' && seedQuery.trim()) {
      setModuleSearchSeed({ module: id, query: seedQuery.trim(), nonce: Date.now() });
    }
    navigate(id === 'dashboard' ? '/admin' : `/admin/${id}`);
  };

  // Global cross-module search results (real loaded Firestore datasets)
  const globalSearchResults = useMemo(() => {
    const q = globalQuery.trim().toLowerCase();
    if (!q || !session?.isAuthorized) return [];

    const can = (mod: AdminModuleId) =>
      session.role === 'SUPER_ADMIN' || Boolean(session.permissions[MODULE_TO_PERMISSION[mod]]);

    const hits: Array<{
      key: string;
      module: AdminModuleId;
      category: string;
      title: string;
      subtitle: string;
      seed: string;
    }> = [];

    if (can('users')) {
      users
        .filter(
          (u) =>
            u.nom.toLowerCase().includes(q) ||
            (u.email || '').toLowerCase().includes(q) ||
            (u.username || '').toLowerCase().includes(q) ||
            u.id.toLowerCase().includes(q)
        )
        .slice(0, 4)
        .forEach((u) => {
          hits.push({
            key: `u_${u.id}`,
            module: 'users',
            category: 'Utilisateur',
            title: u.nom,
            subtitle: u.email || (u.username ? `@${u.username}` : u.id),
            seed: u.nom
          });
        });
    }

    if (can('posts')) {
      groupPosts
        .filter(
          (p) =>
            p.content.toLowerCase().includes(q) ||
            p.authorName.toLowerCase().includes(q) ||
            p.id.toLowerCase().includes(q)
        )
        .slice(0, 4)
        .forEach((p) => {
          hits.push({
            key: `p_${p.id}`,
            module: 'posts',
            category: 'Publication',
            title: p.authorName,
            subtitle: p.content.slice(0, 75),
            seed: p.content.slice(0, 24) || p.authorName
          });
        });
    }

    if (can('circles')) {
      groups
        .filter(
          (g) =>
            g.name.toLowerCase().includes(q) ||
            g.category.toLowerCase().includes(q) ||
            g.id.toLowerCase().includes(q)
        )
        .slice(0, 4)
        .forEach((g) => {
          hits.push({
            key: `g_${g.id}`,
            module: 'circles',
            category: 'Communauté',
            title: g.name,
            subtitle: `${g.category} · ${g.memberCount || 0} membre(s)`,
            seed: g.name
          });
        });
    }

    if (can('files')) {
      files
        .filter(
          (f) =>
            f.name.toLowerCase().includes(q) ||
            f.ownerName.toLowerCase().includes(q) ||
            f.originLabel.toLowerCase().includes(q)
        )
        .slice(0, 4)
        .forEach((f) => {
          hits.push({
            key: `f_${f.id}`,
            module: 'files',
            category: 'Fichier',
            title: f.name,
            subtitle: `${f.originLabel} · ${f.ownerName}`,
            seed: f.name
          });
        });
    }

    if (can('reports')) {
      userReports
        .filter(
          (r) =>
            r.reason.toLowerCase().includes(q) ||
            r.reportedUserName.toLowerCase().includes(q) ||
            r.reporterName.toLowerCase().includes(q)
        )
        .slice(0, 3)
        .forEach((r) => {
          hits.push({
            key: `ur_${r.id}`,
            module: 'reports',
            category: 'Signalement',
            title: r.reportedUserName,
            subtitle: r.reason,
            seed: r.reportedUserName
          });
        });
    }

    if (can('audit')) {
      auditLogs
        .filter(
          (l) =>
            l.action.toLowerCase().includes(q) ||
            l.actorName.toLowerCase().includes(q) ||
            l.details.toLowerCase().includes(q)
        )
        .slice(0, 3)
        .forEach((l) => {
          hits.push({
            key: `al_${l.id}`,
            module: 'audit',
            category: 'Audit',
            title: l.action,
            subtitle: l.details.slice(0, 75),
            seed: l.action
          });
        });
    }

    return hits.slice(0, 14);
  }, [globalQuery, session, users, groupPosts, groups, files, userReports, auditLogs]);

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
  const openTicketsCount = supportTickets.filter((t) => t.status !== 'resolved').length;
  const totalAlertCount = pendingReportsCount + pendingPostsCount + openTicketsCount;

  const groupsOrder: NavGroup[] = [
    'Vue générale',
    'Opérations',
    'Modération et médias',
    'Gouvernance'
  ];

  const getInitialSearch = (mod: AdminModuleId): string => {
    return moduleSearchSeed?.module === mod ? moduleSearchSeed.query : '';
  };

  const renderSidebar = (isMobileDrawer: boolean) => {
    const collapsed = !isMobileDrawer && sidebarCollapsed;
    return (
      <div className="flex flex-col h-full bg-slate-950 text-slate-200 border-r border-slate-800 select-none">
        {/* Brand Header */}
        <div
          className={`h-14 flex items-center border-b border-slate-800 shrink-0 ${
            collapsed ? 'justify-center px-2' : 'justify-between px-4'
          }`}
        >
          <button
            type="button"
            onClick={() => navigateModule('dashboard')}
            className="flex items-center gap-2.5 text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-black text-sm flex items-center justify-center shrink-0">
              Z
            </div>
            {!collapsed && (
              <div className="leading-tight">
                <p className="text-sm font-extrabold text-white tracking-tight">Zaure Admin</p>
                <p className="text-[10px] font-mono text-slate-400">CONSOLE SAAS</p>
              </div>
            )}
          </button>

          {isMobileDrawer ? (
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 text-slate-400 hover:text-white rounded-lg"
              aria-label="Fermer le menu"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            !collapsed && (
              <button
                type="button"
                onClick={toggleSidebarCollapse}
                title="Réduire le menu latéral"
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-900 rounded-md"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )
          )}
        </div>

        {/* Navigation Links */}
        <nav className={`flex-1 overflow-y-auto py-4 space-y-5 ${collapsed ? 'px-2' : 'px-3'}`}>
          {collapsed && !isMobileDrawer && (
            <button
              type="button"
              onClick={toggleSidebarCollapse}
              title="Déplier le menu latéral"
              className="w-full flex items-center justify-center py-2 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}

          {groupsOrder.map((groupName) => {
            const items = visibleNavItems.filter((i) => i.group === groupName);
            if (items.length === 0) return null;
            return (
              <div key={groupName}>
                {!collapsed && (
                  <p className="px-2.5 mb-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500">
                    {groupName}
                  </p>
                )}
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeModule === item.id;
                    const badgeCount =
                      item.id === 'reports'
                        ? pendingReportsCount + openTicketsCount
                        : item.id === 'moderation'
                          ? pendingPostsCount
                          : 0;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        title={collapsed ? item.label : undefined}
                        onClick={() => navigateModule(item.id)}
                        className={`w-full flex items-center ${
                          collapsed ? 'justify-center px-2 py-2.5' : 'justify-between px-2.5 py-2'
                        } ${isMobileDrawer ? 'min-h-[44px]' : ''} rounded-lg text-xs font-medium transition relative ${
                          isActive
                            ? 'bg-blue-600 text-white font-semibold'
                            : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2.5 truncate">
                          <Icon className="w-4 h-4 shrink-0" />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </span>
                        {!collapsed && badgeCount > 0 && (
                          <span className="font-mono tabular-nums text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                            {badgeCount}
                          </span>
                        )}
                        {collapsed && badgeCount > 0 && (
                          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className={`p-3 border-t border-slate-800 space-y-2 shrink-0 ${collapsed ? 'px-2' : ''}`}>
          {!collapsed && (
            <div className="px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-800">
              <p className="text-xs font-bold text-white truncate">{session.displayName}</p>
              <p className="text-[11px] font-mono text-blue-400 mt-0.5">{session.role}</p>
            </div>
          )}

          <div className={`grid ${collapsed ? 'grid-cols-1 gap-1.5' : 'grid-cols-2 gap-1.5'}`}>
            <button
              type="button"
              title="App Zaure"
              onClick={() => navigate('/')}
              className="min-h-[36px] px-2.5 py-1.5 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-lg inline-flex items-center justify-center gap-1"
            >
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              {!collapsed && <span>App Zaure</span>}
            </button>
            <button
              type="button"
              title="Quitter / Déconnexion"
              onClick={async () => {
                localStorage.removeItem('zaure_admin_session_cache');
                await adminService.signOutAdmin();
                await refreshSession();
              }}
              className="min-h-[36px] px-2.5 py-1.5 text-[11px] font-medium text-red-300 hover:text-red-200 bg-slate-900 hover:bg-slate-800 rounded-lg inline-flex items-center justify-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              {!collapsed && <span>Quitter</span>}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex">
      {/* Desktop Retractable Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 sticky top-0 h-screen transition-all duration-200 ${
          sidebarCollapsed ? 'w-[76px]' : 'w-[260px]'
        }`}
      >
        {renderSidebar(false)}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-[1px] lg:hidden flex"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div className="w-[276px] h-full" onClick={(e) => e.stopPropagation()}>
            {renderSidebar(true)}
          </div>
        </div>
      )}

      {/* Main Content Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 flex items-center justify-between gap-2 sticky top-0 z-30">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              aria-label="Ouvrir la navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
              <span className="font-mono text-slate-400 dark:text-slate-500 hidden sm:inline">admin</span>
              <span className="hidden sm:inline">/</span>
              <span className="font-bold text-slate-900 dark:text-white truncate">
                {currentNavMeta.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Global Search Trigger */}
            <button
              type="button"
              onClick={() => setGlobalSearchOpen(true)}
              className="min-h-[38px] inline-flex items-center gap-2 px-2.5 sm:px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700"
              title="Recherche globale (Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden md:inline text-slate-500 dark:text-slate-400">
                Rechercher...
              </span>
              <kbd className="hidden xl:inline px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-500">
                ⌘K
              </kbd>
            </button>

            {/* Theme Switcher */}
            <div
              className="hidden sm:inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5"
              role="group"
              aria-label="Thème d'affichage"
            >
              <button
                type="button"
                onClick={() => handleChangeTheme('light')}
                title="Mode clair"
                className={`p-1.5 rounded-md transition ${
                  themeMode === 'light'
                    ? 'bg-white dark:bg-slate-900 text-amber-500 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleChangeTheme('dark')}
                title="Mode sombre"
                className={`p-1.5 rounded-md transition ${
                  themeMode === 'dark'
                    ? 'bg-white dark:bg-slate-900 text-blue-400 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleChangeTheme('system')}
                title="Thème système"
                className={`p-1.5 rounded-md transition ${
                  themeMode === 'system'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Mobile single-tap Theme toggle */}
            <button
              type="button"
              onClick={() => handleChangeTheme(themeMode === 'dark' ? 'light' : 'dark')}
              className="sm:hidden min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              title="Basculer clair/sombre"
            >
              {themeMode === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Notifications Center Popover */}
            <div ref={notifRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifPopoverOpen((v) => !v);
                  setProfileMenuOpen(false);
                }}
                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 relative"
                title="Centre de notifications administrateur"
              >
                <Bell className="w-4 h-4" />
                {totalAlertCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-red-600 text-white font-mono text-[10px] font-bold flex items-center justify-center">
                    {totalAlertCount > 99 ? '99+' : totalAlertCount}
                  </span>
                )}
              </button>

              {notifPopoverOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden z-40">
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      Alertes & Files d&apos;attente
                    </p>
                    <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {totalAlertCount} en cours
                    </span>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {totalAlertCount === 0 && notifications.filter((n) => n.isActive).length === 0 ? (
                      <p className="p-6 text-center text-slate-500 dark:text-slate-400">
                        Aucune alerte en attente.
                      </p>
                    ) : (
                      <>
                        {pendingReportsCount > 0 && (
                          <button
                            type="button"
                            onClick={() => navigateModule('reports')}
                            className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-start gap-2.5"
                          >
                            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white">
                                {pendingReportsCount} signalement(s) à traiter
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Ouvrir la file des signalements
                              </p>
                            </div>
                          </button>
                        )}
                        {openTicketsCount > 0 && (
                          <button
                            type="button"
                            onClick={() => navigateModule('reports')}
                            className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-start gap-2.5"
                          >
                            <LifeBuoy className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white">
                                {openTicketsCount} ticket(s) support ouvert(s)
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Consulter dans Signalements & Support
                              </p>
                            </div>
                          </button>
                        )}
                        {pendingPostsCount > 0 && (
                          <button
                            type="button"
                            onClick={() => navigateModule('moderation')}
                            className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-start gap-2.5"
                          >
                            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white">
                                {pendingPostsCount} publication(s) en attente de modération
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Inspecter dans le module Modération
                              </p>
                            </div>
                          </button>
                        )}
                        {notifications
                          .filter((n) => n.isActive)
                          .slice(0, 3)
                          .map((n) => (
                            <button
                              key={n.id}
                              type="button"
                              onClick={() => navigateModule('notifications')}
                              className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-start gap-2.5"
                            >
                              <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 dark:text-white truncate">
                                  {n.title}
                                </p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                  {n.message}
                                </p>
                              </div>
                            </button>
                          ))}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Connection + Refresh */}
            <button
              type="button"
              disabled={isLoadingData}
              onClick={loadAllAdminData}
              title={
                lastSyncedAt
                  ? `Dernière synchro : ${new Date(lastSyncedAt).toLocaleTimeString('fr-FR')}`
                  : 'Actualiser les données Firestore'
              }
              className="min-h-[38px] inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              {isOnline && dbFirestore ? (
                <Wifi className="w-3.5 h-3.5 text-emerald-500 hidden md:inline" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-red-500 hidden md:inline" />
              )}
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Actualiser</span>
            </button>

            {/* Admin Profile Dropdown */}
            <div ref={profileRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen((v) => !v);
                  setNotifPopoverOpen(false);
                }}
                className="min-h-[38px] inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <div className="w-6 h-6 rounded-md bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                  {(session.displayName || session.email || 'A').charAt(0).toUpperCase()}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden z-40 text-xs">
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                    <p className="font-bold text-slate-900 dark:text-white truncate">
                      {session.displayName}
                    </p>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                      {session.email}
                    </p>
                    <p className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400 mt-1">
                      {session.role}
                    </p>
                  </div>
                  <div className="p-1.5 space-y-0.5">
                    {session.role === 'SUPER_ADMIN' || session.permissions.manageSettings ? (
                      <button
                        type="button"
                        onClick={() => navigateModule('settings')}
                        className="w-full px-3 py-2 text-left rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        <span>Paramètres plateforme</span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => navigate('/')}
                      className="w-full px-3 py-2 text-left rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Retour à Zaure</span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        localStorage.removeItem('zaure_admin_session_cache');
                        await adminService.signOutAdmin();
                        await refreshSession();
                      }}
                      className="w-full px-3 py-2 text-left rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center gap-2"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Déconnexion</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Admin Toast Notification */}
        {toast && (
          <div className="px-4 sm:px-6 pt-4">
            <div
              className={`px-4 py-2.5 rounded-lg border text-xs font-medium flex items-center gap-2 ${
                toast.tone === 'error'
                  ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-800 dark:text-red-300'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300'
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
              <h1 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                {currentNavMeta.label}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Administration indépendante Zaure · Rôle actif :{' '}
                <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                  {session.role}
                </span>
              </p>
            </div>
          </div>

          {!hasPermission ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-2">
              <KeyRound className="w-6 h-6 text-amber-600 mx-auto" />
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Module restreint pour votre rôle
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Votre niveau d&apos;habilitation ({session.role}) n&apos;inclut pas l&apos;accès à ce module.
              </p>
            </div>
          ) : isLoadingData && users.length === 0 && groupPosts.length === 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="h-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl animate-pulse"
                  />
                ))}
              </div>
              <div className="h-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl animate-pulse" />
            </div>
          ) : (
            <>
              {activeModule === 'dashboard' && (
                <DashboardOverviewModule
                  users={users}
                  groupPosts={groupPosts}
                  capsules={capsules}
                  postComments={postComments}
                  capsuleComments={capsuleComments}
                  groups={groups}
                  userReports={userReports}
                  groupReports={groupReports}
                  supportTickets={supportTickets}
                  auditLogs={auditLogs}
                  onNavigateModule={(mod) => navigateModule(mod)}
                />
              )}

              {activeModule === 'users' && (
                <UsersManagementModule
                  session={session}
                  users={users}
                  moderationMap={moderationMap}
                  groupPosts={groupPosts}
                  capsules={capsules}
                  userReports={userReports}
                  auditLogs={auditLogs}
                  initialSearch={getInitialSearch('users')}
                  onRefresh={loadAllAdminData}
                  onNotify={showToast}
                />
              )}

              {activeModule === 'posts' && (
                <PostsManagementModule
                  session={session}
                  groupPosts={groupPosts}
                  capsules={capsules}
                  initialSearch={getInitialSearch('posts')}
                  onRefresh={loadAllAdminData}
                  onNotify={showToast}
                />
              )}

              {activeModule === 'comments' && (
                <CommentsManagementModule
                  session={session}
                  postComments={postComments}
                  capsuleComments={capsuleComments}
                  initialSearch={getInitialSearch('comments')}
                  onRefresh={loadAllAdminData}
                  onNotify={showToast}
                />
              )}

              {activeModule === 'circles' && (
                <CirclesManagementModule
                  session={session}
                  groups={groups}
                  legacyCircles={legacyCircles}
                  initialSearch={getInitialSearch('circles')}
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
                  supportTickets={supportTickets}
                  initialSearch={getInitialSearch('reports')}
                  onRefresh={loadAllAdminData}
                  onNotify={showToast}
                />
              )}

              {activeModule === 'files' && (
                <FilesManagementModule
                  session={session}
                  files={files}
                  settings={settings}
                  initialSearch={getInitialSearch('files')}
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

              {activeModule === 'audit' && (
                <AuditLogModule logs={auditLogs} initialSearch={getInitialSearch('audit')} />
              )}

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

      {/* Global Search Modal */}
      {globalSearchOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-[2px] flex items-start justify-center p-4 pt-16 sm:pt-24"
          onClick={() => setGlobalSearchOpen(false)}
        >
          <div
            className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2.5">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                autoFocus
                value={globalQuery}
                onChange={(e) => setGlobalQuery(e.target.value)}
                placeholder="Rechercher un utilisateur, publication, communauté, fichier, audit..."
                className="flex-1 bg-transparent text-xs text-slate-900 dark:text-white focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setGlobalSearchOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {!globalQuery.trim() ? (
                <p className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  Tapez un nom, un e-mail, un mot-clé ou une action pour explorer toute l&apos;administration.
                </p>
              ) : globalSearchResults.length === 0 ? (
                <p className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  Aucun résultat dans les collections chargées pour « {globalQuery} ».
                </p>
              ) : (
                globalSearchResults.map((hit) => (
                  <button
                    key={hit.key}
                    type="button"
                    onClick={() => navigateModule(hit.module, hit.seed)}
                    className="w-full px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white truncate">
                        {hit.title}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {hit.subtitle}
                      </p>
                    </div>
                    <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                      {hit.category}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
