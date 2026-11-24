import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Users,
  Share2,
  Check,
  LogIn,
  LogOut,
  Volume2,
  MessageSquare,
  ShieldCheck,
  Info,
  Plus,
  Send,
  Globe,
  Lock,
  Clock,
  BookOpen,
  BellOff,
  Bookmark,
  Pin,
  Megaphone,
  Calendar,
  Image as ImageIcon,
  Video,
  FileText,
  Trash2,
  UserCheck,
  UserX,
  Crown,
  Shield,
  MapPin,
  Link2,
  Upload,
  X
} from 'lucide-react';
import {
  Circle,
  CircleAnnouncement,
  CircleEvent,
  CircleJoinRequest,
  CircleMember,
  CirclePostPermission,
  CircleVisibility,
  Capsule,
  UserProfile
} from '../types';
import CapsuleCard from './CapsuleCard';
import AudioRecorder from './AudioRecorder';
import CircleOptionsMenu, { CircleLocalPrefs, readCirclePrefs } from './CircleOptionsMenu';
import { zaureService } from '../firebaseClient';
import { compressImageFile } from '../utils/imageCompressor';
import { formatCircleMemberCount, getCircleMemberCount } from './circles/circleHelpers';

interface CircleGroupPageProps {
  circle: Circle;
  capsules: Capsule[];
  isJoined: boolean;
  isPending?: boolean;
  memberCounts?: Record<string, number>;
  currentUser: UserProfile | null;
  bookmarkedIds?: string[];
  onToggleBookmark?: (capsuleId: string) => void;
  onAuthorClick?: (authorId: string) => void;
  onBack: () => void;
  onToggleJoin: () => Promise<void> | void;
  onCreateCapsule: (
    circleId: string,
    type: 'texte' | 'audio' | 'video' | 'image' | 'document',
    contenu: string,
    langue: 'fr' | 'ha' | 'en',
    media?: { media_url?: string; media_name?: string; media_mime?: string }
  ) => Promise<void>;
  onDeleteCapsule?: (capsuleId: string) => Promise<void> | void;
  onTogglePinCapsule?: (capsuleId: string, nextPinned: boolean) => Promise<void> | void;
  onUpdateCircle?: (
    circleId: string,
    updates: {
      nom: string;
      description: string;
      categorie: string;
      image: string;
      cover_image?: string;
      visibility?: CircleVisibility;
      post_permission?: CirclePostPermission;
      rules?: string[];
    }
  ) => Promise<void>;
  onDeleteCircle?: (circleId: string) => Promise<void>;
  t: (key: string) => string;
  language: 'fr' | 'ha' | 'en';
}

type CircleTab = 'feed' | 'about' | 'members' | 'media' | 'events';
type ComposerType = 'texte' | 'audio' | 'image' | 'video' | 'document';

export const CircleGroupPage: React.FC<CircleGroupPageProps> = ({
  circle,
  capsules,
  isJoined,
  isPending = false,
  memberCounts,
  currentUser,
  bookmarkedIds = [],
  onToggleBookmark,
  onAuthorClick,
  onBack,
  onToggleJoin,
  onCreateCapsule,
  onDeleteCapsule,
  onTogglePinCapsule,
  onUpdateCircle,
  onDeleteCircle,
  language
}) => {
  const [activeSubTab, setActiveSubTab] = useState<CircleTab>('feed');
  const [filterType, setFilterType] = useState<'all' | 'texte' | 'audio' | 'media' | 'document'>('all');

  // Real-time Firestore circle sub-resources
  const [members, setMembers] = useState<(CircleMember & { profile?: UserProfile })[]>([]);
  const [joinRequests, setJoinRequests] = useState<CircleJoinRequest[]>([]);
  const [announcements, setAnnouncements] = useState<CircleAnnouncement[]>([]);
  const [events, setEvents] = useState<CircleEvent[]>([]);

  // Composer state
  const [showPostBox, setShowPostBox] = useState(false);
  const [postType, setPostType] = useState<ComposerType>('texte');
  const [postContent, setPostContent] = useState('');
  const [postMediaUrl, setPostMediaUrl] = useState('');
  const [postMediaName, setPostMediaName] = useState('');
  const [postMediaMime, setPostMediaMime] = useState('');
  const [postLang, setPostLang] = useState<'fr' | 'ha' | 'en'>(language);
  const [postError, setPostError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Announcement creation modal
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annPinned, setAnnPinned] = useState(true);
  const [isSavingAnn, setIsSavingAnn] = useState(false);

  // Event creation modal
  const [showEventForm, setShowEventForm] = useState(false);
  const [evTitle, setEvTitle] = useState('');
  const [evDesc, setEvDesc] = useState('');
  const [evDate, setEvDate] = useState('');
  const [evTime, setEvTime] = useState('');
  const [evIsOnline, setEvIsOnline] = useState(true);
  const [evLocation, setEvLocation] = useState('');
  const [evLink, setEvLink] = useState('');
  const [isSavingEvent, setIsSavingEvent] = useState(false);

  // Leave confirmation & share feedback
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [circlePrefs, setCirclePrefs] = useState<CircleLocalPrefs>(() =>
    readCirclePrefs(circle.id, currentUser?.id)
  );

  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Permissions calculation
  const isPlatformAdmin = currentUser?.email?.toLowerCase() === 'mahamadougarbamoussa8080@gmail.com';
  const isCreator = Boolean(currentUser && circle.created_by && circle.created_by === currentUser.id);
  const myMemberRecord = useMemo(
    () => members.find((m) => m.user_id === currentUser?.id),
    [members, currentUser?.id]
  );
  const isCircleAdmin = Boolean(isCreator || myMemberRecord?.role === 'admin' || isPlatformAdmin);
  const isCircleModerator = Boolean(myMemberRecord?.role === 'moderateur');
  const canModerate = Boolean(currentUser && (isCircleAdmin || isCircleModerator));

  const isPrivate = (circle.visibility || 'public') === 'private';
  const canViewPrivateContent = !isPrivate || isJoined || canModerate;
  const canPublishInCircle = Boolean(
    currentUser &&
      canViewPrivateContent &&
      (circle.post_permission !== 'admins_only' || canModerate)
  );

  // Local prefs sync
  useEffect(() => {
    setCirclePrefs(readCirclePrefs(circle.id, currentUser?.id));
    const syncPrefs = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (!detail || detail.circleId === circle.id) {
        setCirclePrefs(readCirclePrefs(circle.id, currentUser?.id));
      }
    };
    window.addEventListener('zaure-circle-prefs-updated', syncPrefs);
    return () => window.removeEventListener('zaure-circle-prefs-updated', syncPrefs);
  }, [circle.id, currentUser?.id]);

  // Firestore real-time subscriptions for members, announcements, events, and join requests
  useEffect(() => {
    if (!currentUser?.id) {
      setMembers([]);
      setAnnouncements([]);
      setEvents([]);
      setJoinRequests([]);
      return;
    }

    const unsubMembers = zaureService.subscribeCircleMembers(circle.id, setMembers);
    const unsubAnn = zaureService.subscribeCircleAnnouncements(circle.id, setAnnouncements);
    const unsubEvents = zaureService.subscribeCircleEvents(circle.id, setEvents);

    return () => {
      unsubMembers();
      unsubAnn();
      unsubEvents();
    };
  }, [circle.id, currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id || !canModerate) {
      setJoinRequests([]);
      return;
    }
    const unsubReq = zaureService.subscribeCircleJoinRequests(circle.id, setJoinRequests);
    return () => unsubReq();
  }, [circle.id, currentUser?.id, canModerate]);

  // All capsules belonging to this circle, pinned first then newest
  const allCircleCapsules = useMemo(() => {
    return capsules
      .filter((c) => c.circle_id === circle.id || (c as any).circleId === circle.id)
      .sort((a, b) => {
        if (Boolean(a.is_pinned) !== Boolean(b.is_pinned)) {
          return a.is_pinned ? -1 : 1;
        }
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });
  }, [capsules, circle.id]);

  const filteredCapsules = useMemo(() => {
    if (filterType === 'all') return allCircleCapsules;
    if (filterType === 'texte') return allCircleCapsules.filter((c) => c.type === 'texte');
    if (filterType === 'audio') return allCircleCapsules.filter((c) => c.type === 'audio');
    if (filterType === 'media') {
      return allCircleCapsules.filter((c) => c.type === 'image' || c.type === 'video');
    }
    if (filterType === 'document') return allCircleCapsules.filter((c) => c.type === 'document');
    return allCircleCapsules;
  }, [allCircleCapsules, filterType]);

  const mediaCapsules = useMemo(() => {
    return allCircleCapsules.filter(
      (c) =>
        c.type === 'image' ||
        c.type === 'video' ||
        c.type === 'audio' ||
        c.type === 'document'
    );
  }, [allCircleCapsules]);

  const managersList = useMemo(() => {
    return members.filter(
      (m) => m.role === 'admin' || m.role === 'moderateur' || m.user_id === circle.created_by
    );
  }, [members, circle.created_by]);

  const pinnedAnnouncements = useMemo(
    () => announcements.filter((a) => a.is_pinned),
    [announcements]
  );

  const realMemberCount = Math.max(
    members.length,
    getCircleMemberCount(circle, memberCounts)
  );

  const handleShareCircle = async () => {
    const url = `${window.location.origin}/circles/${encodeURIComponent(circle.id)}`;
    try {
      await navigator.clipboard?.writeText?.(url);
    } catch {
      // ignore
    }
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2600);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPostError(null);
    try {
      const compressed = await compressImageFile(file, 960, 960, 0.8);
      if (compressed.length > 600000) {
        setPostError('Image trop volumineuse après compression.');
        return;
      }
      setPostMediaUrl(compressed);
      setPostMediaName(file.name);
      setPostMediaMime(file.type || 'image/jpeg');
    } catch {
      setPostError("Impossible de traiter l'image sélectionnée.");
    }
  };

  const handleDocumentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPostError(null);
    if (file.size > 420 * 1024) {
      setPostError('Document trop volumineux (max 420 Ko pour envoi direct, ou collez un lien URL).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPostMediaUrl(reader.result);
        setPostMediaName(file.name);
        setPostMediaMime(file.type || 'application/octet-stream');
      }
    };
    reader.readAsDataURL(file);
  };

  const resetComposer = () => {
    setPostContent('');
    setPostMediaUrl('');
    setPostMediaName('');
    setPostMediaMime('');
    setPostError(null);
    setPostType('texte');
    setShowPostBox(false);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPostError(null);

    if (postType === 'texte' && !postContent.trim()) {
      setPostError('Veuillez écrire votre message.');
      return;
    }
    if (postType === 'audio' && !postContent.trim()) {
      setPostError('Veuillez enregistrer un message audio.');
      return;
    }
    if ((postType === 'image' || postType === 'video' || postType === 'document') && !postMediaUrl.trim()) {
      setPostError('Veuillez joindre un média ou indiquer son lien URL.');
      return;
    }

    const finalText =
      postContent.trim() ||
      (postType === 'image'
        ? 'Photo partagée dans le cercle'
        : postType === 'video'
          ? 'Vidéo partagée dans le cercle'
          : postMediaName || 'Document partagé');

    setIsSubmitting(true);
    try {
      await onCreateCapsule(
        circle.id,
        postType,
        finalText,
        postLang,
        postMediaUrl.trim()
          ? {
              media_url: postMediaUrl.trim(),
              media_name: postMediaName || undefined,
              media_mime: postMediaMime || undefined
            }
          : undefined
      );
      resetComposer();
    } catch (err: any) {
      setPostError(err?.message || 'Erreur lors de la publication.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annContent.trim()) return;
    setIsSavingAnn(true);
    try {
      await zaureService.createCircleAnnouncement(
        circle.id,
        annTitle.trim(),
        annContent.trim(),
        annPinned
      );
      setAnnTitle('');
      setAnnContent('');
      setAnnPinned(true);
      setShowAnnouncementForm(false);
    } finally {
      setIsSavingAnn(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evTitle.trim() || !evDesc.trim() || !evDate) return;
    setIsSavingEvent(true);
    try {
      await zaureService.createCircleEvent(circle.id, {
        title: evTitle.trim(),
        description: evDesc.trim(),
        event_date: evDate,
        event_time: evTime,
        location: evLocation.trim(),
        is_online: evIsOnline,
        meeting_link: evLink.trim()
      });
      setEvTitle('');
      setEvDesc('');
      setEvDate('');
      setEvTime('');
      setEvLocation('');
      setEvLink('');
      setShowEventForm(false);
    } finally {
      setIsSavingEvent(false);
    }
  };

  const handleJoinOrLeaveButton = async () => {
    if (isJoined) {
      setShowLeaveConfirm(true);
      return;
    }
    await onToggleJoin();
  };

  const defaultRules = [
    'Respect mutuel et bienveillance envers tous les membres.',
    'Partage de connaissances, retours d’expérience et ressources vérifiées.',
    'Pas de spam, publicité non sollicitée ou propos offensants.'
  ];
  const displayRules = circle.rules && circle.rules.length > 0 ? circle.rules : defaultRules;

  return (
    <div className="space-y-4 sm:space-y-5 zaure-animate-fade-in pb-12" id="circle-group-page-view">
      {/* 1. TOP BAR */}
      <div className="flex items-center justify-between zaure-card px-3 sm:px-4 py-2.5 rounded-2xl">
        <button
          type="button"
          onClick={onBack}
          id="btn-back-to-all-circles"
          className="min-h-[38px] px-3.5 py-1.5 bg-[#F3F6FB] dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-full flex items-center gap-1.5 zaure-btn-press"
        >
          <ArrowLeft className="w-4 h-4 text-[#2563EB] shrink-0" />
          <span>Cercles</span>
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 truncate max-w-md">
          <span>Cercles</span>
          <span>›</span>
          <span className="font-bold text-slate-900 dark:text-white truncate">{circle.nom}</span>
        </div>

        <div className="flex items-center gap-2">
          {circlePrefs.muted && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-300 text-[10px] font-bold">
              <BellOff className="w-3 h-3" />
              <span>Sourdine</span>
            </span>
          )}
          {circlePrefs.pinned && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/50 text-[#2563EB] dark:text-blue-300 text-[10px] font-bold">
              <Bookmark className="w-3 h-3 fill-current" />
              <span>Favori</span>
            </span>
          )}
          <CircleOptionsMenu
            variant="header"
            circle={circle}
            isJoined={isJoined}
            isPending={isPending}
            currentUser={currentUser}
            onOpenPublish={() => {
              setShowPostBox(true);
              setActiveSubTab('feed');
            }}
            onSelectTab={(tab) => setActiveSubTab(tab)}
            onToggleJoin={onToggleJoin}
            onUpdateCircle={onUpdateCircle}
            onDeleteCircle={onDeleteCircle}
          />
        </div>
      </div>

      {/* 2. CIRCLE HEADER & COVER BANNER */}
      <div className="zaure-card rounded-3xl overflow-hidden">
        {/* Cover Image */}
        <div className="relative h-44 sm:h-56 md:h-64 w-full bg-slate-900 overflow-hidden">
          <img
            src={circle.cover_image || circle.image}
            alt={circle.nom}
            className="w-full h-full object-cover opacity-85"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 zaure-grad-scrim" />

          {/* Top Pills */}
          <div className="absolute top-3.5 left-4 right-4 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/70 backdrop-blur-xs border border-white/15 text-white text-[11px] font-bold">
              {isPrivate ? <Lock className="w-3 h-3 text-amber-300" /> : <Globe className="w-3 h-3 text-emerald-400" />}
              <span>{isPrivate ? 'Cercle privé' : 'Cercle public'}</span>
            </span>
            <span className="px-3 py-1 rounded-full zaure-grad-primary text-white text-[11px] font-bold zaure-shadow-xs">
              {circle.categorie}
            </span>
          </div>
        </div>

        {/* Avatar Overlap & Title Section */}
        <div className="px-4 sm:px-6 pb-5">
          <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-10 sm:-mt-12">
            <div className="flex items-end gap-3.5 min-w-0">
              <div className="relative shrink-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white dark:border-slate-900 bg-white dark:bg-slate-800 shadow-lg overflow-hidden">
                  {circle.image ? (
                    <img
                      src={circle.image}
                      alt={circle.nom}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#2563EB] text-white font-black text-2xl flex items-center justify-center">
                      {circle.nom.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <span
                  className={`absolute bottom-1 right-1 w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-xs ${
                    isPrivate ? 'bg-slate-700' : 'bg-[#22C55E]'
                  }`}
                >
                  {isPrivate ? (
                    <Lock className="w-3 h-3 text-white" />
                  ) : (
                    <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                  )}
                </span>
              </div>

              <div className="min-w-0 pb-1">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
                  {circle.nom}
                </h1>
                <div className="flex items-center gap-2.5 flex-wrap text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200">
                    <Users className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>{formatCircleMemberCount(realMemberCount)}</span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{allCircleCapsules.length} publication{allCircleCapsules.length > 1 ? 's' : ''}</span>
                  {canModerate && joinRequests.length > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <button
                        type="button"
                        onClick={() => setActiveSubTab('members')}
                        className="text-amber-600 dark:text-amber-400 font-bold hover:underline"
                      >
                        {joinRequests.length} demande{joinRequests.length > 1 ? 's' : ''} en attente
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
              <button
                type="button"
                onClick={handleJoinOrLeaveButton}
                className={`min-h-[40px] px-4 py-2 rounded-full text-xs font-bold transition flex items-center justify-center gap-1.5 flex-1 sm:flex-initial ${
                  isJoined
                    ? 'bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-800 dark:text-slate-200 hover:text-red-700 border border-slate-200 dark:border-slate-700'
                    : isPending
                      ? 'bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
                      : 'bg-[#2563EB] hover:bg-blue-700 text-white shadow-sm'
                }`}
              >
                {isJoined ? (
                  <>
                    <Check className="w-4 h-4 text-[#2563EB]" />
                    <span>Membre · Quitter</span>
                  </>
                ) : isPending ? (
                  <>
                    <Clock className="w-4 h-4" />
                    <span>Demande envoyée</span>
                  </>
                ) : isPrivate ? (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Demander à rejoindre</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Rejoindre</span>
                  </>
                )}
              </button>

              {canPublishInCircle && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveSubTab('feed');
                    setShowPostBox((prev) => !prev);
                  }}
                  className="min-h-[40px] px-4 py-2 rounded-full bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Publier</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleShareCircle}
                title="Partager ce cercle"
                className="min-h-[40px] px-3.5 py-2 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1.5"
              >
                {shareCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
                <span className="hidden md:inline">{shareCopied ? 'Copié' : 'Partager'}</span>
              </button>
            </div>
          </div>

          <p className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed mt-3.5 max-w-4xl">
            {circle.description}
          </p>

          {/* Administrators & Moderators Ribbon */}
          {managersList.length > 0 && (
            <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Équipe du cercle :
                </span>
                {managersList.slice(0, 4).map((mgr) => (
                  <button
                    key={mgr.user_id}
                    type="button"
                    onClick={() => onAuthorClick?.(mgr.user_id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F3F6FB] dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 border border-slate-200/70 dark:border-slate-700 text-[11px] font-semibold text-slate-800 dark:text-slate-200 transition"
                  >
                    {mgr.user_avatar ? (
                      <img
                        src={mgr.user_avatar}
                        alt={mgr.user_nom}
                        className="w-4 h-4 rounded-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="w-4 h-4 rounded-full bg-[#2563EB] text-white text-[9px] font-bold flex items-center justify-center">
                        {(mgr.user_nom || 'A').charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="truncate max-w-[110px]">{mgr.user_nom}</span>
                    <span className="text-[9.5px] font-bold text-[#2563EB] dark:text-blue-400">
                      {mgr.role === 'admin' || mgr.user_id === circle.created_by ? 'Admin' : 'Mod'}
                    </span>
                  </button>
                ))}
              </div>

              {canModerate && (
                <button
                  type="button"
                  onClick={() => setShowAnnouncementForm((prev) => !prev)}
                  className="text-[11.5px] font-bold text-[#2563EB] dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <Megaphone className="w-3.5 h-3.5" />
                  <span>Publier une annonce</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* 5 TABS BAR */}
        <div className="flex border-t border-slate-100 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-900/80 px-2 sm:px-4 overflow-x-auto scrollbar-none">
          {[
            { id: 'feed' as CircleTab, label: `Publications (${allCircleCapsules.length})`, icon: MessageSquare },
            { id: 'about' as CircleTab, label: 'À propos', icon: Info },
            {
              id: 'members' as CircleTab,
              label: `Membres (${realMemberCount})`,
              icon: Users,
              badge: canModerate && joinRequests.length > 0 ? joinRequests.length : 0
            },
            { id: 'media' as CircleTab, label: `Médias (${mediaCapsules.length})`, icon: ImageIcon },
            { id: 'events' as CircleTab, label: `Événements (${events.length})`, icon: Calendar }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={`min-h-[44px] shrink-0 px-3.5 sm:px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                  active
                    ? 'border-[#2563EB] text-[#2563EB] dark:text-blue-400 bg-white dark:bg-slate-900'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
                {tab.badge ? (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-black tabular-nums">
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* PRIVATE CIRCLE LOCK GATE (if non-member opens a private circle) */}
      {!canViewPrivateContent ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-8 text-center space-y-3 shadow-xs">
          <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
            Ce cercle est privé
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            Seuls les membres approuvés peuvent consulter les publications, les médias, la liste des membres et les événements de <strong>{circle.nom}</strong>.
          </p>
          <button
            type="button"
            onClick={onToggleJoin}
            className={`min-h-[40px] px-5 py-2 rounded-full text-xs font-bold transition inline-flex items-center gap-1.5 ${
              isPending
                ? 'bg-amber-50 border border-amber-300 text-amber-700'
                : 'bg-[#2563EB] hover:bg-blue-700 text-white shadow-sm'
            }`}
          >
            {isPending ? <Clock className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
            <span>{isPending ? 'Demande envoyée (cliquer pour annuler)' : 'Demander à rejoindre'}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* MAIN LEFT COLUMN */}
          <div className="lg:col-span-8 space-y-4">
            {/* ANNOUNCEMENT CREATION BOX (Admins & Mods) */}
            {showAnnouncementForm && canModerate && (
              <form
                onSubmit={handleCreateAnnouncement}
                className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3 animate-fadeIn"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-[#2563EB] dark:text-blue-400">
                    <Megaphone className="w-4 h-4" />
                    <span>Nouvelle annonce importante</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAnnouncementForm(false)}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded-full"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <input
                  type="text"
                  required
                  maxLength={160}
                  placeholder="Titre de l'annonce..."
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F3F6FB] dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#2563EB]"
                />
                <textarea
                  required
                  rows={3}
                  maxLength={3000}
                  placeholder="Message officiel à communiquer aux membres du cercle..."
                  value={annContent}
                  onChange={(e) => setAnnContent(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F3F6FB] dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#2563EB] resize-none"
                />
                <div className="flex items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={annPinned}
                      onChange={(e) => setAnnPinned(e.target.checked)}
                      className="rounded border-slate-300 text-[#2563EB]"
                    />
                    <span>Épingler en haut du cercle</span>
                  </label>
                  <button
                    type="submit"
                    disabled={isSavingAnn}
                    className="min-h-[36px] px-4 py-1.5 rounded-full bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition"
                  >
                    {isSavingAnn ? 'Publication...' : "Publier l'annonce"}
                  </button>
                </div>
              </form>
            )}

            {/* PINNED ANNOUNCEMENTS BANNER */}
            {pinnedAnnouncements.length > 0 && activeSubTab === 'feed' && (
              <div className="space-y-2.5">
                {pinnedAnnouncements.map((ann) => (
                  <div
                    key={ann.id}
                    className="bg-gradient-to-r from-blue-50 to-indigo-50/70 dark:from-blue-950/60 dark:to-slate-900 border border-blue-200 dark:border-blue-800/80 rounded-2xl p-4 shadow-2xs space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-7 h-7 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shrink-0">
                          <Pin className="w-3.5 h-3.5 fill-white" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#2563EB] dark:text-blue-400">
                            Annonce épinglée · Par {ann.author_nom}
                          </p>
                          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                            {ann.title}
                          </h3>
                        </div>
                      </div>
                      {canModerate && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => zaureService.togglePinCircleAnnouncement(ann.id, false)}
                            title="Désépingler"
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-white/80 dark:hover:bg-slate-800 text-[11px] font-semibold"
                          >
                            Désépingler
                          </button>
                          <button
                            type="button"
                            onClick={() => zaureService.deleteCircleAnnouncement(ann.id)}
                            title="Supprimer l'annonce"
                            className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line pl-9">
                      {ann.content}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 1: PUBLICATIONS */}
            {activeSubTab === 'feed' && (
              <div className="space-y-4">
                {/* Post Composer */}
                {canPublishInCircle ? (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {currentUser?.avatar_url ? (
                          <img
                            src={currentUser.avatar_url}
                            alt={currentUser.nom}
                            className="w-9 h-9 rounded-full object-cover shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-[#2563EB] text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {currentUser?.nom?.charAt(0).toUpperCase() || 'U'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                            Publier dans {circle.nom}
                          </p>
                          <p className="text-[10.5px] text-slate-400 truncate">
                            Texte, capsule vocale, photo, vidéo ou document
                          </p>
                        </div>
                      </div>

                      {!showPostBox && (
                        <button
                          type="button"
                          onClick={() => setShowPostBox(true)}
                          className="min-h-[36px] px-4 py-1.5 rounded-full bg-[#F3F6FB] dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-[#2563EB] dark:text-blue-400 text-xs font-bold transition"
                        >
                          Rédiger un post
                        </button>
                      )}
                    </div>

                    {showPostBox && (
                      <form onSubmit={handleCreateSubmit} className="space-y-3.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                        {/* Type selector pills */}
                        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                          {[
                            { id: 'texte' as ComposerType, label: 'Texte', icon: MessageSquare },
                            { id: 'audio' as ComposerType, label: 'Audio', icon: Volume2 },
                            { id: 'image' as ComposerType, label: 'Photo', icon: ImageIcon },
                            { id: 'video' as ComposerType, label: 'Vidéo', icon: Video },
                            { id: 'document' as ComposerType, label: 'Document', icon: FileText }
                          ].map((item) => {
                            const Icon = item.icon;
                            const active = postType === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  setPostType(item.id);
                                  setPostError(null);
                                }}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shrink-0 transition ${
                                  active
                                    ? 'bg-[#2563EB] text-white'
                                    : 'bg-[#F3F6FB] dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70'
                                }`}
                              >
                                <Icon className="w-3.5 h-3.5" />
                                <span>{item.label}</span>
                              </button>
                            );
                          })}
                        </div>

                        {postError && (
                          <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs font-semibold text-red-700 dark:text-red-300">
                            {postError}
                          </div>
                        )}

                        {postType === 'audio' ? (
                          <div className="bg-[#F3F6FB] dark:bg-slate-800/70 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                            <AudioRecorder
                              onAudioReady={(base64) => setPostContent(base64)}
                              onCancel={() => setPostType('texte')}
                            />
                            {postContent.startsWith('data:audio') && (
                              <p className="mt-2 text-xs font-bold text-[#2563EB] dark:text-blue-400">
                                ✓ Enregistrement audio prêt à être publié
                              </p>
                            )}
                          </div>
                        ) : (
                          <textarea
                            rows={3}
                            placeholder={`Partagez une question, ressource ou expérience avec ${circle.nom}...`}
                            value={postContent}
                            onChange={(e) => setPostContent(e.target.value)}
                            className="w-full text-xs p-3.5 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:border-[#2563EB] text-slate-800 dark:text-slate-100 bg-[#F3F6FB] dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 resize-none"
                          />
                        )}

                        {postType === 'image' && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => imageInputRef.current?.click()}
                                className="px-3.5 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-[#2563EB] dark:text-blue-300 text-xs font-bold flex items-center gap-1.5"
                              >
                                <Upload className="w-3.5 h-3.5" />
                                <span>Choisir une photo</span>
                              </button>
                              <input
                                type="url"
                                placeholder="Ou collez l'URL d'une image..."
                                value={postMediaUrl.startsWith('data:') ? '' : postMediaUrl}
                                onChange={(e) => {
                                  setPostMediaUrl(e.target.value);
                                  setPostMediaName('Image');
                                }}
                                className="flex-1 min-w-[180px] text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F3F6FB] dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                              />
                              <input
                                ref={imageInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleImageSelect}
                                className="hidden"
                              />
                            </div>
                            {postMediaUrl && (
                              <img
                                src={postMediaUrl}
                                alt="Aperçu"
                                className="max-h-48 rounded-xl border border-slate-200 dark:border-slate-700 object-cover"
                              />
                            )}
                          </div>
                        )}

                        {postType === 'video' && (
                          <input
                            type="url"
                            placeholder="Lien URL de la vidéo (MP4, WebM...)"
                            value={postMediaUrl}
                            onChange={(e) => {
                              setPostMediaUrl(e.target.value);
                              setPostMediaName('Vidéo');
                            }}
                            className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F3F6FB] dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                          />
                        )}

                        {postType === 'document' && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => docInputRef.current?.click()}
                              className="px-3.5 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-[#2563EB] dark:text-blue-300 text-xs font-bold flex items-center gap-1.5"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Importer un document (PDF/Doc)</span>
                            </button>
                            <input
                              type="url"
                              placeholder="Ou collez le lien du document..."
                              value={postMediaUrl.startsWith('data:') ? '' : postMediaUrl}
                              onChange={(e) => {
                                setPostMediaUrl(e.target.value);
                                if (!postMediaName) setPostMediaName('Document partagé');
                              }}
                              className="flex-1 min-w-[180px] text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F3F6FB] dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                            />
                            <input
                              ref={docInputRef}
                              type="file"
                              accept=".pdf,.doc,.docx,.txt,.ppt,.pptx"
                              onChange={handleDocumentSelect}
                              className="hidden"
                            />
                            {postMediaName && (
                              <span className="text-[11px] font-bold text-emerald-600">
                                ✓ {postMediaName}
                              </span>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Langue :</span>
                            <select
                              value={postLang}
                              onChange={(e) => setPostLang(e.target.value as 'fr' | 'ha' | 'en')}
                              className="text-xs bg-[#F3F6FB] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
                            >
                              <option value="fr">Français</option>
                              <option value="ha">Hausa</option>
                              <option value="en">English</option>
                            </select>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={resetComposer}
                              className="px-3.5 py-2 rounded-full text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              Annuler
                            </button>
                            <button
                              type="submit"
                              disabled={isSubmitting}
                              className="px-5 py-2 bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-full transition flex items-center gap-1.5 shadow-sm"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>{isSubmitting ? 'Publication...' : 'Publier'}</span>
                            </button>
                          </div>
                        </div>
                      </form>
                    )}
                  </div>
                ) : currentUser && circle.post_permission === 'admins_only' ? (
                  <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900 rounded-2xl px-4 py-3 text-xs font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Seuls les administrateurs et modérateurs peuvent publier dans ce cercle. Vous pouvez commenter et réagir aux publications.</span>
                  </div>
                ) : null}

                {/* Feed filter chips */}
                <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-2.5 rounded-2xl shadow-2xs gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 px-2">
                    Publications ({filteredCapsules.length})
                  </span>
                  <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
                    {[
                      { id: 'all', label: 'Toutes' },
                      { id: 'texte', label: 'Textes' },
                      { id: 'audio', label: 'Audios' },
                      { id: 'media', label: 'Photos & Vidéos' },
                      { id: 'document', label: 'Documents' }
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFilterType(f.id as any)}
                        className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition ${
                          filterType === f.id
                            ? 'bg-[#2563EB] text-white'
                            : 'bg-[#F3F6FB] dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/80'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Capsules list */}
                {filteredCapsules.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-8 text-center space-y-3 shadow-2xs">
                    <BookOpen className="w-11 h-11 text-slate-300 mx-auto" />
                    <h3 className="font-bold text-slate-800 dark:text-white text-base">
                      Aucune publication pour le moment
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                      Lancez la conversation en publiant un conseil, une ressource ou une question dans {circle.nom}.
                    </p>
                    {canPublishInCircle && (
                      <button
                        type="button"
                        onClick={() => setShowPostBox(true)}
                        className="px-5 py-2 bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs rounded-full transition inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Créer la première publication</span>
                      </button>
                    )}
                  </div>
                ) : (
                  filteredCapsules.map((capsule) => (
                    <CapsuleCard
                      key={capsule.id}
                      capsule={capsule}
                      currentUser={currentUser}
                      isBookmarked={bookmarkedIds.includes(capsule.id)}
                      onToggleBookmark={onToggleBookmark ? () => onToggleBookmark(capsule.id) : undefined}
                      onAuthorClick={onAuthorClick}
                      canModerate={canModerate}
                      onTogglePin={onTogglePinCapsule}
                      onDeleteCapsule={onDeleteCapsule}
                    />
                  ))
                )}
              </div>
            )}

            {/* TAB 2: À PROPOS */}
            {activeSubTab === 'about' && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xs space-y-6">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <Info className="w-5 h-5 text-[#2563EB]" />
                    <span>À propos de {circle.nom}</span>
                  </h3>
                  <p className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed mt-2">
                    {circle.description}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="bg-[#F3F6FB] dark:bg-slate-800/70 p-4 rounded-2xl">
                    <p className="text-[10px] font-extrabold uppercase text-slate-400">Catégorie</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{circle.categorie}</p>
                  </div>
                  <div className="bg-[#F3F6FB] dark:bg-slate-800/70 p-4 rounded-2xl">
                    <p className="text-[10px] font-extrabold uppercase text-slate-400">Visibilité</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                      {isPrivate ? 'Privé (sur validation)' : 'Public (ouvert à tous)'}
                    </p>
                  </div>
                  <div className="bg-[#F3F6FB] dark:bg-slate-800/70 p-4 rounded-2xl">
                    <p className="text-[10px] font-extrabold uppercase text-slate-400">Autorisations de publication</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                      {circle.post_permission === 'admins_only'
                        ? 'Admins & Modérateurs uniquement'
                        : 'Tous les membres'}
                    </p>
                  </div>
                  <div className="bg-[#F3F6FB] dark:bg-slate-800/70 p-4 rounded-2xl">
                    <p className="text-[10px] font-extrabold uppercase text-slate-400">Création</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                      {circle.created_at
                        ? new Date(circle.created_at).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })
                        : 'Communauté ZAURE'}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                    <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
                    <span>Règles du cercle</span>
                  </h4>
                  <ol className="space-y-2">
                    {displayRules.map((rule, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 bg-[#F3F6FB] dark:bg-slate-800/60 p-3 rounded-xl"
                      >
                        <span className="w-5 h-5 rounded-full bg-[#2563EB] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="leading-relaxed">{rule}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}

            {/* TAB 3: MEMBRES & MODÉRATION */}
            {activeSubTab === 'members' && (
              <div className="space-y-4">
                {/* Pending Join Requests Queue (Moderators / Admins only) */}
                {canModerate && joinRequests.length > 0 && (
                  <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-3xl p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-extrabold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>Demandes d&apos;adhésion en attente ({joinRequests.length})</span>
                      </h3>
                    </div>

                    <div className="space-y-2">
                      {joinRequests.map((req) => (
                        <div
                          key={req.id}
                          className="bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-slate-700 rounded-2xl p-3 flex items-center justify-between gap-3 flex-wrap"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {req.user_avatar ? (
                              <img
                                src={req.user_avatar}
                                alt={req.user_nom}
                                className="w-10 h-10 rounded-full object-cover shrink-0"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 font-bold text-sm flex items-center justify-center shrink-0">
                                {req.user_nom.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                                {req.user_nom}
                              </p>
                              <p className="text-[10.5px] text-slate-500">
                                Demandé le {new Date(req.created_at).toLocaleDateString('fr-FR')}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => zaureService.approveCircleJoinRequest(req)}
                              className="min-h-[34px] px-3.5 py-1.5 rounded-full bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 transition"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Approuver</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => zaureService.rejectCircleJoinRequest(req.id)}
                              className="min-h-[34px] px-3.5 py-1.5 rounded-full border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold flex items-center gap-1 transition"
                            >
                              <UserX className="w-3.5 h-3.5" />
                              <span>Refuser</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active Members Directory */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <Users className="w-5 h-5 text-[#2563EB]" />
                      <span>Membres du cercle ({realMemberCount})</span>
                    </h3>
                  </div>

                  {members.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Aucun membre enregistré pour le moment.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {members.map((member) => {
                        const isMemberCreator = member.user_id === circle.created_by;
                        const isSelf = member.user_id === currentUser?.id;
                        const canManageThisMember = canModerate && !isMemberCreator && !isSelf;

                        return (
                          <div
                            key={member.user_id}
                            className="py-3 flex items-center justify-between gap-3 flex-wrap"
                          >
                            <button
                              type="button"
                              onClick={() => onAuthorClick?.(member.user_id)}
                              className="flex items-center gap-3 min-w-0 text-left group"
                            >
                              {member.user_avatar ? (
                                <img
                                  src={member.user_avatar}
                                  alt={member.user_nom}
                                  className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-200 shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-blue-100 text-[#2563EB] font-bold text-sm flex items-center justify-center shrink-0">
                                  {(member.user_nom || 'M').charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs sm:text-[13px] font-bold text-slate-900 dark:text-white group-hover:text-[#2563EB] truncate">
                                    {member.user_nom || 'Membre ZAURE'}
                                  </span>
                                  {(isMemberCreator || member.role === 'admin') && (
                                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/70 text-[#2563EB] dark:text-blue-300 text-[10px] font-extrabold">
                                      <Crown className="w-2.5 h-2.5" />
                                      <span>Administrateur</span>
                                    </span>
                                  )}
                                  {!isMemberCreator && member.role === 'moderateur' && (
                                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold">
                                      <Shield className="w-2.5 h-2.5" />
                                      <span>Modérateur</span>
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400">
                                  Membre depuis{' '}
                                  {new Date(member.joined_at).toLocaleDateString('fr-FR', {
                                    month: 'short',
                                    year: 'numeric'
                                  })}
                                </p>
                              </div>
                            </button>

                            {canManageThisMember && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                {isCircleAdmin && (
                                  <select
                                    value={member.role}
                                    onChange={(e) =>
                                      zaureService.updateCircleMemberRole(
                                        circle.id,
                                        member.user_id,
                                        e.target.value as 'membre' | 'moderateur' | 'admin'
                                      )
                                    }
                                    aria-label={`Rôle de ${member.user_nom}`}
                                    className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-[#F3F6FB] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                                  >
                                    <option value="membre">Membre</option>
                                    <option value="moderateur">Modérateur</option>
                                    <option value="admin">Admin</option>
                                  </select>
                                )}
                                <button
                                  type="button"
                                  onClick={() => zaureService.removeCircleMember(circle.id, member.user_id)}
                                  title="Retirer du cercle"
                                  className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                                >
                                  Retirer
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: MÉDIAS */}
            {activeSubTab === 'media' && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xs space-y-4">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-[#2563EB]" />
                  <span>Médias & Ressources partagés ({mediaCapsules.length})</span>
                </h3>

                {mediaCapsules.length === 0 ? (
                  <div className="py-10 text-center space-y-2">
                    <ImageIcon className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="text-xs text-slate-500">
                      Aucune photo, vidéo, audio ou document partagé dans ce cercle pour l&apos;instant.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {mediaCapsules.map((m) => (
                      <div
                        key={m.id}
                        className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/50 overflow-hidden p-3 space-y-2"
                      >
                        {m.type === 'image' && (m.media_url || m.contenu.startsWith('data:image')) && (
                          <img
                            src={m.media_url || m.contenu}
                            alt={m.media_name || m.contenu}
                            className="w-full h-44 object-cover rounded-xl"
                            loading="lazy"
                          />
                        )}
                        {m.type === 'video' && m.media_url && (
                          <video
                            src={m.media_url}
                            controls
                            preload="metadata"
                            className="w-full h-44 rounded-xl bg-slate-950 object-cover"
                          />
                        )}
                        {m.type === 'audio' && (
                          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center gap-2.5 text-xs font-bold text-[#2563EB] dark:text-blue-300">
                            <Volume2 className="w-5 h-5 shrink-0" />
                            <span>Capsule vocale · {m.auteur_nom}</span>
                          </div>
                        )}
                        {m.type === 'document' && m.media_url && (
                          <a
                            href={m.media_url}
                            download={m.media_name || 'document'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center gap-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 hover:border-blue-400"
                          >
                            <FileText className="w-5 h-5 text-[#2563EB] shrink-0" />
                            <span className="truncate">{m.media_name || 'Document'}</span>
                          </a>
                        )}
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="font-semibold truncate">{m.auteur_nom}</span>
                          <span>{new Date(m.created_at).toLocaleDateString('fr-FR')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: ÉVÉNEMENTS */}
            {activeSubTab === 'events' && (
              <div className="space-y-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                      Événements du cercle
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Ateliers, discussions en direct et rencontres communautaires
                    </p>
                  </div>
                  {(isJoined || canModerate) && (
                    <button
                      type="button"
                      onClick={() => setShowEventForm((prev) => !prev)}
                      className="min-h-[38px] px-4 py-1.5 rounded-full bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 transition"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Créer un événement</span>
                    </button>
                  )}
                </div>

                {showEventForm && (
                  <form
                    onSubmit={handleCreateEvent}
                    className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-2xl p-5 shadow-xs space-y-3 animate-fadeIn"
                  >
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#2563EB]">
                      Nouvel événement
                    </h4>
                    <input
                      type="text"
                      required
                      maxLength={160}
                      placeholder="Titre de l'événement..."
                      value={evTitle}
                      onChange={(e) => setEvTitle(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F3F6FB] dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                    <textarea
                      required
                      rows={2}
                      maxLength={2000}
                      placeholder="Programme et informations pratiques..."
                      value={evDesc}
                      onChange={(e) => setEvDesc(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F3F6FB] dark:bg-slate-800 text-slate-900 dark:text-white resize-none"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="date"
                        required
                        value={evDate}
                        onChange={(e) => setEvDate(e.target.value)}
                        className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F3F6FB] dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                      <input
                        type="time"
                        value={evTime}
                        onChange={(e) => setEvTime(e.target.value)}
                        className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F3F6FB] dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={evIsOnline}
                          onChange={(e) => setEvIsOnline(e.target.checked)}
                        />
                        <span>Événement en ligne</span>
                      </label>
                      {evIsOnline ? (
                        <input
                          type="url"
                          placeholder="Lien de visioconférence (optionnel)"
                          value={evLink}
                          onChange={(e) => setEvLink(e.target.value)}
                          className="flex-1 min-w-[200px] text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F3F6FB] dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                      ) : (
                        <input
                          type="text"
                          placeholder="Lieu physique..."
                          value={evLocation}
                          onChange={(e) => setEvLocation(e.target.value)}
                          className="flex-1 min-w-[200px] text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F3F6FB] dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                      )}
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowEventForm(false)}
                        className="px-4 py-2 rounded-full text-xs font-semibold text-slate-500 hover:bg-slate-100"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingEvent}
                        className="px-5 py-2 rounded-full bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold"
                      >
                        {isSavingEvent ? 'Création...' : 'Créer'}
                      </button>
                    </div>
                  </form>
                )}

                {events.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-8 text-center space-y-2 shadow-2xs">
                    <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="font-bold text-slate-800 dark:text-white text-sm">
                      Aucun événement programmé
                    </p>
                    <p className="text-xs text-slate-500">
                      Les membres peuvent planifier des webinaires, sessions de révision ou rencontres ici.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {events.map((ev) => {
                      const isGoing = currentUser ? ev.attendee_ids.includes(currentUser.id) : false;
                      const isInterested = currentUser ? ev.interested_ids.includes(currentUser.id) : false;
                      const canDeleteEv = canModerate || currentUser?.id === ev.created_by;

                      return (
                        <div
                          key={ev.id}
                          className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0">
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#2563EB] dark:text-blue-400">
                                <Calendar className="w-3.5 h-3.5" />
                                <span>
                                  {new Date(ev.event_date).toLocaleDateString('fr-FR', {
                                    weekday: 'short',
                                    day: 'numeric',
                                    month: 'long'
                                  })}
                                  {ev.event_time ? ` · ${ev.event_time}` : ''}
                                </span>
                              </span>
                              <h4 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base">
                                {ev.title}
                              </h4>
                              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                {ev.description}
                              </p>
                            </div>
                            {canDeleteEv && (
                              <button
                                type="button"
                                onClick={() => zaureService.deleteCircleEvent(ev.id)}
                                title="Supprimer l'événement"
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg shrink-0"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                            {ev.is_online ? (
                              <span className="inline-flex items-center gap-1">
                                <Link2 className="w-3.5 h-3.5 text-[#2563EB]" />
                                {ev.meeting_link ? (
                                  <a
                                    href={ev.meeting_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#2563EB] underline"
                                  >
                                    Lien de session en ligne
                                  </a>
                                ) : (
                                  <span>En ligne</span>
                                )}
                              </span>
                            ) : ev.location ? (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                                <span>{ev.location}</span>
                              </span>
                            ) : null}
                            <span>· Organisé par {ev.creator_nom}</span>
                          </div>

                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
                              {ev.attendee_ids.length} participant{ev.attendee_ids.length > 1 ? 's' : ''} ·{' '}
                              {ev.interested_ids.length} intéressé{ev.interested_ids.length > 1 ? 's' : ''}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  zaureService.rsvpCircleEvent(ev.id, isGoing ? 'none' : 'going')
                                }
                                className={`min-h-[34px] px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
                                  isGoing
                                    ? 'bg-[#2563EB] text-white'
                                    : 'bg-[#F3F6FB] dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-blue-50'
                                }`}
                              >
                                {isGoing ? '✓ Je participe' : 'Participer'}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  zaureService.rsvpCircleEvent(ev.id, isInterested ? 'none' : 'interested')
                                }
                                className={`min-h-[34px] px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
                                  isInterested
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-[#F3F6FB] dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                                }`}
                              >
                                Intéressé
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-3.5">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-[#2563EB] dark:text-blue-400">
                Informations du cercle
              </h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">Visibilité</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    {isPrivate ? 'Privé' : 'Public'}
                  </span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">Membres</span>
                  <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                    {realMemberCount}
                  </span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">Catégorie</span>
                  <span className="font-bold text-[#2563EB] dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-full">
                    {circle.categorie}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Publications</span>
                  <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                    {allCircleCapsules.length}
                  </span>
                </div>
              </div>
            </div>

            {announcements.length > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-2.5">
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Megaphone className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Annonces récentes</span>
                </h3>
                {announcements.slice(0, 3).map((a) => (
                  <div
                    key={a.id}
                    className="p-2.5 rounded-xl bg-[#F3F6FB] dark:bg-slate-800/70 text-xs space-y-0.5"
                  >
                    <p className="font-bold text-slate-900 dark:text-white truncate">{a.title}</p>
                    <p className="text-[11px] text-slate-500 line-clamp-2">{a.content}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-gradient-to-br from-[#174EE2] to-[#2380FF] text-white rounded-2xl p-5 shadow-sm space-y-2.5">
              <h4 className="font-extrabold text-sm">Invitez d&apos;autres membres</h4>
              <p className="text-xs text-blue-50/90 leading-relaxed">
                Partagez ce cercle pour enrichir les discussions et entraides autour de {circle.categorie}.
              </p>
              <button
                type="button"
                onClick={handleShareCircle}
                className="w-full py-2.5 bg-white hover:bg-blue-50 text-[#1D4ED8] font-bold text-xs rounded-full transition flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{shareCopied ? 'Lien copié !' : 'Copier le lien du cercle'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEAVE CONFIRMATION MODAL */}
      {showLeaveConfirm && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn"
          onClick={() => setShowLeaveConfirm(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-xl border border-slate-100 dark:border-slate-800 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-950 dark:text-white text-sm">
                  Quitter ce cercle ?
                </h3>
                <p className="text-xs text-slate-500 truncate max-w-[210px]">{circle.nom}</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Vous pourrez rejoindre à nouveau ce cercle à tout moment.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(false)}
                className="min-h-[38px] px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowLeaveConfirm(false);
                  await onToggleJoin();
                }}
                className="min-h-[38px] px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
              >
                Quitter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CircleGroupPage;
