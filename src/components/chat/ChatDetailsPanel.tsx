import React, { useMemo, useState } from 'react';
import {
  Archive,
  BadgeCheck,
  BellOff,
  Download,
  Flag,
  LogOut,
  MapPin,
  Settings,
  Shield,
  Star,
  Trash2,
  UserPlus,
  Users,
  UserX,
  X
} from 'lucide-react';
import { Conversation, Message, UserProfile } from '../../types';
import { formatFileSize, getDocumentBadgeInfo } from '../../utils/fileValidation';
import { formatLastSeen, sanitizeExternalUrl, UserAvatar } from './chatUtils';

interface ChatDetailsPanelProps {
  currentUser: UserProfile | null;
  activeConversation: Conversation | null;
  activeOtherUser: UserProfile | null;
  availableUsers: UserProfile[];
  messages: Message[];
  isOtherUserBlocked: boolean;
  isGroupAdmin: boolean;
  isOpenMobileModal?: boolean;
  onClose: () => void;
  onToggleFavorite: (convId: string) => void;
  onToggleMute: (convId: string) => void;
  onToggleArchive: (convId: string) => void;
  onToggleBlockUser: (user: UserProfile) => void;
  onReportUser: (user: UserProfile) => void;
  onStartDirectChat: (user: UserProfile) => void;
  onOpenUserProfile: (user: UserProfile) => void;
  onOpenImageLightbox: (url: string) => void;
  onOpenEditGroupModal: () => void;
  onOpenManageMembersModal: () => void;
  onLeaveGroup: () => void;
  onRequestDeleteConversation: (conv: Conversation) => void;
}

export const ChatDetailsPanel: React.FC<ChatDetailsPanelProps> = ({
  currentUser,
  activeConversation,
  activeOtherUser,
  availableUsers,
  messages,
  isOtherUserBlocked,
  isGroupAdmin,
  isOpenMobileModal = false,
  onClose,
  onToggleFavorite,
  onToggleMute,
  onToggleArchive,
  onToggleBlockUser,
  onReportUser,
  onStartDirectChat,
  onOpenUserProfile,
  onOpenImageLightbox,
  onOpenEditGroupModal,
  onOpenManageMembersModal,
  onLeaveGroup,
  onRequestDeleteConversation
}) => {
  const [mediaTab, setMediaTab] = useState<'media' | 'docs'>('media');

  const { mediaItems, docItems } = useMemo(() => {
    const media: { id: string; url: string; type: 'image' | 'video'; name: string }[] = [];
    const docs: { id: string; url: string; name: string; size?: number; mime_type?: string }[] = [];

    messages.forEach((m) => {
      if (m.is_deleted || !m.attachments) return;
      m.attachments.forEach((att, idx) => {
        const safeUrl = sanitizeExternalUrl(att.url);
        if (att.type === 'image' || att.type === 'video') {
          media.push({ id: `${m.id}_${idx}`, url: safeUrl, type: att.type, name: att.name });
        } else if (att.type === 'file') {
          docs.push({
            id: `${m.id}_${idx}`,
            url: safeUrl,
            name: att.name,
            size: att.size,
            mime_type: att.mime_type
          });
        }
      });
    });

    return { mediaItems: media.reverse(), docItems: docs.reverse() };
  }, [messages]);

  if (!activeConversation) return null;

  const isGroup = activeConversation.type === 'group';
  const title = isGroup
    ? activeConversation.group_name || 'Groupe Zaure'
    : activeOtherUser?.nom || 'Membre Zaure';
  const avatar = isGroup ? activeConversation.group_photo : activeOtherUser?.avatar_url;

  const isFav = currentUser
    ? Boolean(activeConversation.is_favorite_by?.includes(currentUser.id))
    : false;
  const isMuted = currentUser
    ? Boolean(activeConversation.is_muted_by?.includes(currentUser.id))
    : false;
  const isArchived = currentUser
    ? Boolean(activeConversation.is_archived_by?.includes(currentUser.id))
    : false;

  const content = (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
          {isGroup ? 'Infos du groupe' : 'Détails du contact'}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          aria-label="Fermer le panneau"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
        {/* Identité */}
        <div className="flex flex-col items-center text-center">
          <UserAvatar
            name={title}
            avatarUrl={avatar}
            isGroup={isGroup}
            availability={activeOtherUser?.availability || 'offline'}
            showPresence={!isGroup}
            size="xl"
            onClick={() => {
              if (!isGroup && activeOtherUser) onOpenUserProfile(activeOtherUser);
            }}
          />

          <div className="mt-3 flex items-center justify-center gap-1.5">
            <h3 className="text-base font-extrabold text-slate-950">{title}</h3>
            {!isGroup && activeOtherUser?.role === 'verifie' && (
              <BadgeCheck className="h-4 w-4 text-blue-600" />
            )}
          </div>

          <p className="mt-0.5 text-xs font-semibold text-blue-600">
            {isGroup
              ? `${activeConversation.participant_ids.length} participants`
              : activeOtherUser?.profession ||
                (activeOtherUser?.role === 'mentor' ? 'Mentor médical' : 'Membre Zaure')}
          </p>

          {!isGroup && activeOtherUser && (
            <p className="mt-1 text-[11px] text-slate-500">{formatLastSeen(activeOtherUser)}</p>
          )}

          {isGroup && activeConversation.group_description && (
            <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 border border-slate-100">
              {activeConversation.group_description}
            </p>
          )}

          {!isGroup && activeOtherUser?.localisation && (
            <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-slate-500">
              <MapPin className="h-3 w-3 text-slate-400" />
              <span>{activeOtherUser.localisation}</span>
            </p>
          )}
        </div>

        {/* Actions rapides */}
        <div className="grid grid-cols-4 gap-2 border-y border-slate-100 py-4">
          <button
            type="button"
            onClick={() => onToggleFavorite(activeConversation.id)}
            className="flex flex-col items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-amber-600 transition"
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                isFav ? 'bg-amber-50 text-amber-500 ring-1 ring-amber-200' : 'bg-slate-100'
              }`}
            >
              <Star className={`h-4 w-4 ${isFav ? 'fill-amber-400' : ''}`} />
            </div>
            <span>{isFav ? 'Favori' : 'Favoris'}</span>
          </button>

          <button
            type="button"
            onClick={() => onToggleMute(activeConversation.id)}
            className="flex flex-col items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-blue-600 transition"
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                isMuted ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-200' : 'bg-slate-100'
              }`}
            >
              <BellOff className="h-4 w-4" />
            </div>
            <span>{isMuted ? 'Muet' : 'Sourdine'}</span>
          </button>

          <button
            type="button"
            onClick={() => onToggleArchive(activeConversation.id)}
            className="flex flex-col items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-blue-600 transition"
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                isArchived ? 'bg-slate-900 text-white' : 'bg-slate-100'
              }`}
            >
              <Archive className="h-4 w-4" />
            </div>
            <span>{isArchived ? 'Archivé' : 'Archiver'}</span>
          </button>

          <button
            type="button"
            onClick={() => onRequestDeleteConversation(activeConversation)}
            className="flex flex-col items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-red-600 transition"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 hover:bg-red-50">
              <Trash2 className="h-4 w-4" />
            </div>
            <span>Supprimer</span>
          </button>
        </div>

        {/* Gestion du groupe */}
        {isGroup && (
          <div className="space-y-3 border-b border-slate-100 pb-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Membres ({activeConversation.participant_ids.length})
              </span>
              <div className="flex items-center gap-1">
                {isGroupAdmin && (
                  <button
                    type="button"
                    onClick={onOpenEditGroupModal}
                    className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-200 transition"
                  >
                    <Settings className="h-3 w-3" />
                    <span>Éditer</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onOpenManageMembersModal}
                  className="flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 transition"
                >
                  {isGroupAdmin ? <UserPlus className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                  <span>{isGroupAdmin ? 'Gérer' : 'Voir'}</span>
                </button>
              </div>
            </div>

            <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
              {activeConversation.participant_ids.map((uid) => {
                const live = availableUsers.find((u) => u.id === uid);
                const meta = activeConversation.participants?.[uid];
                const name = uid === currentUser?.id ? 'Vous' : live?.nom || meta?.nom || 'Membre';
                const isAdmin = activeConversation.admin_ids?.includes(uid);
                return (
                  <div
                    key={uid}
                    onClick={() => {
                      if (uid !== currentUser?.id && live) {
                        onStartDirectChat(live);
                      }
                    }}
                    className={`flex items-center justify-between rounded-xl px-2 py-1.5 text-xs ${
                      uid !== currentUser?.id && live
                        ? 'cursor-pointer hover:bg-slate-50'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <UserAvatar
                        name={name}
                        avatarUrl={live?.avatar_url || meta?.avatar_url}
                        availability={live?.availability || 'offline'}
                        showPresence={uid !== currentUser?.id}
                        size="xs"
                      />
                      <span className="truncate font-semibold text-slate-800">{name}</span>
                    </div>
                    {isAdmin && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 shrink-0">
                        <Shield className="h-2.5 w-2.5" />
                        Admin
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={onLeaveGroup}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50/70 py-2 text-xs font-bold text-red-700 hover:bg-red-100 transition"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Quitter le groupe</span>
            </button>
          </div>
        )}

        {/* Options Sécurité Contact Direct */}
        {!isGroup && activeOtherUser && (
          <div className="space-y-1.5 border-b border-slate-100 pb-4">
            <button
              type="button"
              onClick={() => onToggleBlockUser(activeOtherUser)}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold transition ${
                isOtherUserBlocked
                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'text-slate-700 hover:bg-red-50 hover:text-red-700'
              }`}
            >
              <UserX className="h-4 w-4" />
              <span>{isOtherUserBlocked ? 'Débloquer ce membre' : 'Bloquer ce membre'}</span>
            </button>

            <button
              type="button"
              onClick={() => onReportUser(activeOtherUser)}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition"
            >
              <Flag className="h-4 w-4" />
              <span>Signaler un comportement</span>
            </button>
          </div>
        )}

        {/* Médias & Documents partagés */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Partagés ({mediaItems.length + docItems.length})
            </span>
            <div className="flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setMediaTab('media')}
                className={`rounded-md px-2.5 py-1 transition ${
                  mediaTab === 'media' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-500'
                }`}
              >
                Médias ({mediaItems.length})
              </button>
              <button
                type="button"
                onClick={() => setMediaTab('docs')}
                className={`rounded-md px-2.5 py-1 transition ${
                  mediaTab === 'docs' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-500'
                }`}
              >
                Fichiers ({docItems.length})
              </button>
            </div>
          </div>

          {mediaTab === 'media' ? (
            mediaItems.length === 0 ? (
              <p className="rounded-xl bg-slate-50 py-5 text-center text-xs text-slate-400">
                Aucune photo ou vidéo partagée
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {mediaItems.slice(0, 12).map((item) =>
                  item.type === 'image' ? (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onOpenImageLightbox(item.url)}
                      className="aspect-square overflow-hidden rounded-xl bg-slate-100 hover:opacity-90 transition"
                    >
                      <img
                        src={item.url}
                        alt={item.name}
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </button>
                  ) : (
                    <video
                      key={item.id}
                      src={item.url}
                      className="aspect-square rounded-xl bg-black object-cover"
                    />
                  )
                )}
              </div>
            )
          ) : docItems.length === 0 ? (
            <p className="rounded-xl bg-slate-50 py-5 text-center text-xs text-slate-400">
              Aucun document partagé
            </p>
          ) : (
            <div className="space-y-1.5">
              {docItems.slice(0, 10).map((docItem) => {
                const badge = getDocumentBadgeInfo(docItem.name, docItem.mime_type);
                return (
                  <a
                    key={docItem.id}
                    href={docItem.url}
                    download={docItem.name}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 p-2 hover:bg-slate-100 transition"
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[9px] font-black ${badge.badgeBg}`}
                    >
                      {badge.label}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-slate-800">{docItem.name}</p>
                      <p className="text-[10px] text-slate-500 tabular-nums">
                        {docItem.size ? formatFileSize(docItem.size) : 'Document'}
                      </p>
                    </div>
                    <Download className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (isOpenMobileModal) {
    return (
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 p-0 sm:p-4 backdrop-blur-xs lg:hidden animate-fadeIn"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="h-[85vh] w-full max-w-md overflow-hidden rounded-t-3xl sm:rounded-3xl border border-slate-200 bg-white shadow-2xl"
        >
          {content}
        </div>
      </div>
    );
  }

  return (
    <aside className="hidden lg:flex h-full w-[300px] xl:w-[320px] shrink-0 flex-col border-l border-slate-200/90 bg-white">
      {content}
    </aside>
  );
};
