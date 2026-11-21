import React, { useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArrowDown,
  ArrowLeft,
  BadgeCheck,
  BellOff,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  Globe,
  Info,
  Loader2,
  Maximize2,
  MoreVertical,
  Paperclip,
  Phone,
  Pin,
  PinOff,
  Reply,
  Search,
  Settings,
  SmilePlus,
  Sparkles,
  Star,
  Trash2,
  UserPlus,
  Users,
  Video,
  X
} from 'lucide-react';
import { Conversation, Message, UserProfile } from '../../types';
import { formatFileSize, getDocumentBadgeInfo } from '../../utils/fileValidation';
import {
  extractUrls,
  formatDateDivider,
  formatLastSeen,
  QUICK_EMOJIS,
  sanitizeExternalUrl,
  UserAvatar
} from './chatUtils';
import { VoiceNotePlayer } from './chatUtils';

interface ChatThreadProps {
  currentUser: UserProfile | null;
  activeConversation: Conversation | null;
  activeOtherUser: UserProfile | null;
  messages: Message[];
  availableUsers: UserProfile[];
  isOtherUserTyping: boolean;
  isLoadingOlder: boolean;
  hasMoreOlder: boolean;
  isGroupAdmin: boolean;
  showRightPanel: boolean;
  isDraggingOver: boolean;
  inChatSearchOpen: boolean;
  inChatSearchQuery: string;
  matchingMessageIds: string[];
  currentMatchIndex: number;
  highlightedMsgId: string | null;
  lastReadMessageIdByOther: string | null;
  onBackMobile: () => void;
  onToggleRightPanel: () => void;
  onOpenUserProfile: (user: UserProfile) => void;
  onStartCall: (type: 'audio' | 'video') => void;
  onToggleFavorite: (convId: string) => void;
  onToggleMute: (convId: string) => void;
  onToggleArchive: (convId: string) => void;
  onRequestDeleteConversation: (conv: Conversation) => void;
  onOpenEditGroupModal: () => void;
  onOpenManageMembersModal: () => void;
  onToggleInChatSearch: (open: boolean) => void;
  onInChatSearchQueryChange: (q: string) => void;
  onNextSearchMatch: () => void;
  onPrevSearchMatch: () => void;
  onLoadOlderMessages: () => void;
  onAddReaction: (messageId: string, emoji: string) => void;
  onReplyMessage: (msg: Message) => void;
  onEditMessage: (msg: Message) => void;
  onDeleteMessage: (messageId: string) => void;
  onTogglePinMessage: (msg: Message) => void;
  onCopyMessage: (content: string) => void;
  onOpenImageLightbox: (url: string) => void;
  onOpenNewChatModal: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  composerNode: React.ReactNode;
}

export const ChatThread: React.FC<ChatThreadProps> = ({
  currentUser,
  activeConversation,
  activeOtherUser,
  messages,
  availableUsers,
  isOtherUserTyping,
  isLoadingOlder,
  hasMoreOlder,
  isGroupAdmin,
  showRightPanel,
  isDraggingOver,
  inChatSearchOpen,
  inChatSearchQuery,
  matchingMessageIds,
  currentMatchIndex,
  highlightedMsgId,
  lastReadMessageIdByOther,
  onBackMobile,
  onToggleRightPanel,
  onOpenUserProfile,
  onStartCall,
  onToggleFavorite,
  onToggleMute,
  onToggleArchive,
  onRequestDeleteConversation,
  onOpenEditGroupModal,
  onOpenManageMembersModal,
  onToggleInChatSearch,
  onInChatSearchQueryChange,
  onNextSearchMatch,
  onPrevSearchMatch,
  onLoadOlderMessages,
  onAddReaction,
  onReplyMessage,
  onEditMessage,
  onDeleteMessage,
  onTogglePinMessage,
  onCopyMessage,
  onOpenImageLightbox,
  onOpenNewChatModal,
  onDragOver,
  onDragLeave,
  onDrop,
  messagesEndRef,
  composerNode
}) => {
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [activeActionMsgId, setActiveActionMsgId] = useState<string | null>(null);
  const [pinnedIndex, setPinnedIndex] = useState(0);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const pinnedMessages = useMemo(
    () => messages.filter((m) => m.is_pinned && !m.is_deleted),
    [messages]
  );

  const activePinned =
    pinnedMessages.length > 0
      ? pinnedMessages[pinnedIndex % pinnedMessages.length]
      : null;

  const jumpToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBottom(distanceFromBottom > 260);
  };

  if (!activeConversation) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center bg-[#F0F2F5] px-6 text-center">
        <div className="max-w-sm rounded-3xl border border-slate-200/80 bg-white p-8 shadow-xs">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <Sparkles className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-extrabold text-slate-950">Votre messagerie Zaure</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
            Sélectionnez une discussion à gauche ou démarrez un nouvel échange privé ou de groupe avec la communauté.
          </p>
          <button
            type="button"
            onClick={onOpenNewChatModal}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition min-h-[44px]"
          >
            <UserPlus className="h-4 w-4" />
            <span>Démarrer une conversation</span>
          </button>
        </div>
      </section>
    );
  }

  const isGroup = activeConversation.type === 'group';
  const convTitle = isGroup
    ? activeConversation.group_name || 'Groupe Zaure'
    : activeOtherUser?.nom || 'Membre Zaure';
  const convAvatar = isGroup ? activeConversation.group_photo : activeOtherUser?.avatar_url;
  const isFav = currentUser
    ? Boolean(activeConversation.is_favorite_by?.includes(currentUser.id))
    : false;
  const isMuted = currentUser
    ? Boolean(activeConversation.is_muted_by?.includes(currentUser.id))
    : false;
  const isArchived = currentUser
    ? Boolean(activeConversation.is_archived_by?.includes(currentUser.id))
    : false;

  const sublineText = isOtherUserTyping
    ? 'En train d’écrire...'
    : isGroup
      ? `${activeConversation.participant_ids.length} membre${
          activeConversation.participant_ids.length > 1 ? 's' : ''
        }`
      : formatLastSeen(activeOtherUser);

  return (
    <section
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="relative flex flex-1 flex-col h-full min-w-0 bg-[#F0F2F5]"
    >
      {/* Overlay Drag & Drop */}
      {isDraggingOver && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-blue-600/10 backdrop-blur-[2px] border-2 border-dashed border-blue-500 m-3 rounded-3xl">
          <div className="rounded-2xl bg-white px-6 py-4 text-center shadow-xl border border-blue-100">
            <Paperclip className="mx-auto h-7 w-7 text-blue-600 mb-2" />
            <p className="text-sm font-bold text-slate-900">Déposez votre fichier ici</p>
            <p className="text-xs text-slate-500 mt-0.5">Image, vidéo ou document sécurisé</p>
          </div>
        </div>
      )}

      {/* 1. En-tête conversation active */}
      <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-slate-200/90 bg-white px-3 sm:px-5 z-20">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onBackMobile}
            className="flex md:hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 transition"
            aria-label="Retour aux conversations"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <UserAvatar
            name={convTitle}
            avatarUrl={convAvatar}
            isGroup={isGroup}
            availability={activeOtherUser?.availability || 'offline'}
            showPresence={!isGroup}
            size="md"
            onClick={() => {
              if (!isGroup && activeOtherUser) onOpenUserProfile(activeOtherUser);
              else onToggleRightPanel();
            }}
          />

          <div
            onClick={() => {
              if (!isGroup && activeOtherUser) onOpenUserProfile(activeOtherUser);
              else onToggleRightPanel();
            }}
            className="min-w-0 cursor-pointer"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="truncate text-sm sm:text-base font-extrabold text-slate-950">
                {convTitle}
              </h2>
              {!isGroup && activeOtherUser?.role === 'verifie' && (
                <BadgeCheck className="h-4 w-4 shrink-0 text-blue-600" />
              )}
              {isFav && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500" />}
            </div>
            <p
              className={`truncate text-xs ${
                isOtherUserTyping
                  ? 'font-semibold text-blue-600'
                  : !isGroup && activeOtherUser?.availability === 'online'
                    ? 'font-semibold text-emerald-600'
                    : 'text-slate-500'
              }`}
            >
              {sublineText}
            </p>
          </div>
        </div>

        {/* Actions header */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onToggleInChatSearch(!inChatSearchOpen)}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
              inChatSearchOpen
                ? 'bg-blue-50 text-blue-600'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
            }`}
            title="Rechercher dans la conversation"
          >
            <Search className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => onStartCall('audio')}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 hover:text-blue-600 transition"
            title="Appel audio"
          >
            <Phone className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => onStartCall('video')}
            className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 hover:text-blue-600 transition"
            title="Appel vidéo"
          >
            <Video className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onToggleRightPanel}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
              showRightPanel
                ? 'bg-blue-50 text-blue-600'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
            }`}
            title="Détails de la conversation"
          >
            <Info className="h-4 w-4" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setHeaderMenuOpen((v) => !v)}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-950 transition"
              title="Plus d'options"
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {headerMenuOpen && (
              <div className="absolute right-0 top-12 z-30 w-56 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl animate-fadeIn">
                <button
                  type="button"
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    onToggleFavorite(activeConversation.id);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Star className={`h-4 w-4 ${isFav ? 'fill-amber-400 text-amber-500' : ''}`} />
                  <span>{isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    onToggleMute(activeConversation.id);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <BellOff className="h-4 w-4" />
                  <span>{isMuted ? 'Activer les notifications' : 'Mettre en sourdine'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    onToggleArchive(activeConversation.id);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Archive className="h-4 w-4" />
                  <span>{isArchived ? 'Désarchiver' : 'Archiver'}</span>
                </button>

                {isGroup && (
                  <>
                    <div className="my-1 border-t border-slate-100" />
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        onOpenManageMembersModal();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Users className="h-4 w-4" />
                      <span>Membres du groupe ({activeConversation.participant_ids.length})</span>
                    </button>
                    {isGroupAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setHeaderMenuOpen(false);
                          onOpenEditGroupModal();
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Settings className="h-4 w-4" />
                        <span>Modifier le groupe</span>
                      </button>
                    )}
                  </>
                )}

                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    onRequestDeleteConversation(activeConversation);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>{isGroup && isGroupAdmin ? 'Supprimer la discussion' : 'Effacer la discussion'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. Barre de recherche dans la discussion */}
      {inChatSearchOpen && (
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 animate-fadeIn">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={inChatSearchQuery}
            onChange={(e) => onInChatSearchQueryChange(e.target.value)}
            placeholder="Rechercher un mot dans cette discussion..."
            className="flex-1 bg-transparent text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          {inChatSearchQuery.trim() && (
            <span className="text-[11px] font-bold text-slate-500 tabular-nums shrink-0">
              {matchingMessageIds.length > 0
                ? `${(currentMatchIndex % matchingMessageIds.length) + 1} / ${matchingMessageIds.length}`
                : '0 résultat'}
            </span>
          )}
          <button
            type="button"
            onClick={onPrevSearchMatch}
            disabled={matchingMessageIds.length === 0}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
            title="Résultat précédent"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onNextSearchMatch}
            disabled={matchingMessageIds.length === 0}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
            title="Résultat suivant"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              onToggleInChatSearch(false);
              onInChatSearchQueryChange('');
            }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title="Fermer la recherche"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 3. Bannière des messages épinglés */}
      {activePinned && (
        <div className="flex items-center justify-between gap-3 border-b border-blue-100 bg-blue-50/90 px-4 py-2 text-xs">
          <button
            type="button"
            onClick={() => {
              jumpToMessage(activePinned.id);
              if (pinnedMessages.length > 1) {
                setPinnedIndex((prev) => (prev + 1) % pinnedMessages.length);
              }
            }}
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Pin className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-blue-900">
                Message épinglé{pinnedMessages.length > 1 ? ` (${(pinnedIndex % pinnedMessages.length) + 1}/${pinnedMessages.length})` : ''}
              </p>
              <p className="truncate text-slate-700">
                <span className="font-semibold">{activePinned.sender_nom} : </span>
                {activePinned.content}
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => onTogglePinMessage(activePinned)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-100 hover:text-blue-700 transition shrink-0"
            title="Désépingler ce message"
          >
            <PinOff className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 4. Historique des messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        onClick={() => setActiveActionMsgId(null)}
        className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-2.5"
      >
        {hasMoreOlder && messages.length >= 20 && (
          <div className="flex justify-center pb-2">
            <button
              type="button"
              onClick={onLoadOlderMessages}
              disabled={isLoadingOlder}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 shadow-2xs hover:bg-slate-50 disabled:opacity-50 transition"
            >
              {isLoadingOlder ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                  <span>Chargement...</span>
                </>
              ) : (
                <>
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>Messages plus anciens</span>
                </>
              )}
            </button>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex h-full min-h-[280px] flex-col items-center justify-center text-center px-4">
            <UserAvatar
              name={convTitle}
              avatarUrl={convAvatar}
              isGroup={isGroup}
              availability={activeOtherUser?.availability || 'offline'}
              size="xl"
            />
            <h3 className="mt-4 text-base font-extrabold text-slate-950">{convTitle}</h3>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">
              {isGroup
                ? activeConversation.group_description ||
                  'Bienvenue dans ce groupe de discussion Zaure.'
                : activeOtherUser?.profession ||
                  'Envoyez un message texte, une photo, un document ou une note vocale pour démarrer l’échange.'}
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.sender_id === currentUser?.id;
            const prevMsg = idx > 0 ? messages[idx - 1] : null;
            const showDateDivider =
              !prevMsg ||
              new Date(prevMsg.created_at).toDateString() !==
                new Date(msg.created_at).toDateString();

            const showSenderAvatar =
              !isMe &&
              (!prevMsg ||
                prevMsg.sender_id !== msg.sender_id ||
                prevMsg.type === 'system' ||
                showDateDivider);

            const isHighlighted = highlightedMsgId === msg.id;
            const isLastReadByOther = msg.id === lastReadMessageIdByOther;
            const detectedUrls = msg.is_deleted ? [] : extractUrls(msg.content || '');
            const actionOpen = activeActionMsgId === msg.id;

            if (msg.type === 'system') {
              return (
                <React.Fragment key={msg.id}>
                  {showDateDivider && (
                    <div className="my-3 flex justify-center">
                      <span className="rounded-lg bg-slate-200/80 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                        {formatDateDivider(msg.created_at)}
                      </span>
                    </div>
                  )}
                  <div className="my-2 flex justify-center">
                    <span className="rounded-xl bg-white/80 border border-slate-200/70 px-3 py-1 text-[11px] font-medium text-slate-600">
                      {msg.content}
                    </span>
                  </div>
                </React.Fragment>
              );
            }

            const senderProfile = availableUsers.find((u) => u.id === msg.sender_id);

            return (
              <React.Fragment key={msg.id}>
                {showDateDivider && (
                  <div className="my-4 flex justify-center">
                    <span className="rounded-lg bg-slate-200/80 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      {formatDateDivider(msg.created_at)}
                    </span>
                  </div>
                )}

                <div
                  id={`msg-${msg.id}`}
                  className={`group relative flex items-end gap-2 transition-all duration-300 ${
                    isMe ? 'justify-end' : 'justify-start'
                  } ${
                    isHighlighted
                      ? 'rounded-2xl bg-blue-100/70 p-1.5 ring-2 ring-blue-500/60'
                      : ''
                  }`}
                >
                  {!isMe && (
                    <div className="w-8 shrink-0">
                      {showSenderAvatar && (
                        <UserAvatar
                          name={msg.sender_nom || 'M'}
                          avatarUrl={senderProfile?.avatar_url || msg.sender_avatar}
                          size="xs"
                          onClick={() => {
                            if (senderProfile) onOpenUserProfile(senderProfile);
                          }}
                        />
                      )}
                    </div>
                  )}

                  <div className={`flex flex-col max-w-[82%] sm:max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                    {isGroup && !isMe && showSenderAvatar && (
                      <span className="mb-1 ml-1 text-[11px] font-bold text-slate-500">
                        {msg.sender_nom}
                      </span>
                    )}

                    <div className="relative flex items-center gap-1.5">
                      {/* Bouton d'actions rapides (côté gauche si mon message) */}
                      {!msg.is_deleted && isMe && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveActionMsgId(actionOpen ? null : msg.id);
                          }}
                          className={`rounded-xl p-1.5 text-slate-400 hover:bg-white hover:text-slate-700 transition ${
                            actionOpen ? 'opacity-100 bg-white shadow-xs' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100'
                          }`}
                          title="Actions sur le message"
                        >
                          <SmilePlus className="h-4 w-4" />
                        </button>
                      )}

                      <div
                        className={`relative rounded-2xl px-3.5 py-2.5 shadow-2xs transition ${
                          msg.is_pinned ? 'ring-2 ring-amber-400/70' : ''
                        } ${
                          isMe
                            ? 'bg-blue-600 text-white rounded-br-sm'
                            : 'bg-white text-slate-900 border border-slate-200/80 rounded-bl-sm'
                        }`}
                      >
                        {msg.is_pinned && !msg.is_deleted && (
                          <div
                            className={`mb-1 flex items-center gap-1 text-[10px] font-bold ${
                              isMe ? 'text-blue-100' : 'text-amber-600'
                            }`}
                          >
                            <Pin className="h-3 w-3" />
                            <span>Épinglé</span>
                          </div>
                        )}

                        {msg.reply_to && !msg.is_deleted && (
                          <button
                            type="button"
                            onClick={() => msg.reply_to && jumpToMessage(msg.reply_to.id)}
                            className={`mb-2 block w-full rounded-xl border-l-2 px-2.5 py-1.5 text-left text-xs transition ${
                              isMe
                                ? 'border-white bg-blue-700/70 text-blue-50 hover:bg-blue-700'
                                : 'border-blue-600 bg-slate-100 text-slate-700 hover:bg-slate-200/70'
                            }`}
                          >
                            <span className="block text-[10px] font-extrabold opacity-85">
                              {msg.reply_to.sender_nom}
                            </span>
                            <span className="block truncate opacity-90">{msg.reply_to.content}</span>
                          </button>
                        )}

                        {msg.is_deleted ? (
                          <p className="text-xs italic opacity-75">Message supprimé</p>
                        ) : (
                          <>
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="mb-2 space-y-2">
                                {msg.attachments.map((att, attIdx) => {
                                  const safeAttUrl = sanitizeExternalUrl(att.url);
                                  if (att.type === 'image') {
                                    return (
                                      <div
                                        key={attIdx}
                                        onClick={() => onOpenImageLightbox(safeAttUrl)}
                                        className="group/img relative cursor-pointer overflow-hidden rounded-xl"
                                      >
                                        <img
                                          src={safeAttUrl}
                                          alt={att.name}
                                          className="max-h-64 w-full rounded-xl object-cover transition group-hover/img:scale-[1.02]"
                                          referrerPolicy="no-referrer"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition group-hover/img:opacity-100">
                                          <Maximize2 className="h-5 w-5 text-white" />
                                        </div>
                                      </div>
                                    );
                                  }

                                  if (att.type === 'video') {
                                    return (
                                      <video
                                        key={attIdx}
                                        src={safeAttUrl}
                                        controls
                                        className="max-h-64 w-full rounded-xl bg-black"
                                      />
                                    );
                                  }

                                  if (att.type === 'audio') {
                                    return <VoiceNotePlayer key={attIdx} url={safeAttUrl} isMe={isMe} />;
                                  }

                                  const badge = getDocumentBadgeInfo(att.name, att.mime_type);
                                  return (
                                    <div
                                      key={attIdx}
                                      className={`flex items-center gap-3 rounded-xl border p-2.5 ${
                                        isMe
                                          ? 'border-blue-400/30 bg-blue-700/60 text-white'
                                          : 'border-slate-200 bg-slate-50 text-slate-800'
                                      }`}
                                    >
                                      <div
                                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-[10px] font-black tracking-wider ${badge.badgeBg}`}
                                      >
                                        {badge.label}
                                      </div>
                                      <div className="min-w-0 flex-1 text-left">
                                        <p className="truncate text-xs font-bold">{att.name}</p>
                                        <p className="text-[10px] opacity-75 tabular-nums">
                                          {att.size ? formatFileSize(att.size) : 'Document'}
                                        </p>
                                      </div>
                                      <a
                                        href={safeAttUrl}
                                        download={att.name}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
                                          isMe
                                            ? 'hover:bg-white/20 text-white'
                                            : 'hover:bg-slate-200 text-slate-700'
                                        }`}
                                        title="Télécharger"
                                      >
                                        <Download className="h-4 w-4" />
                                      </a>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {msg.content && msg.type !== 'audio' && (
                              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                                {msg.content}
                              </p>
                            )}

                            {detectedUrls.length > 0 && (
                              <div className="mt-2 space-y-1.5">
                                {detectedUrls.map((rawUrl, uIdx) => {
                                  const safeHref = sanitizeExternalUrl(rawUrl);
                                  if (safeHref === '#') return null;
                                  try {
                                    const parsed = new URL(safeHref);
                                    return (
                                      <a
                                        key={uIdx}
                                        href={safeHref}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`flex items-center gap-2 rounded-xl p-2 text-xs transition ${
                                          isMe
                                            ? 'bg-blue-700/70 text-white hover:bg-blue-800'
                                            : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                                        }`}
                                      >
                                        <Globe className="h-4 w-4 shrink-0 text-blue-300" />
                                        <div className="min-w-0 flex-1">
                                          <span className="block truncate font-bold">
                                            {parsed.hostname.replace('www.', '')}
                                          </span>
                                          <span className="block truncate text-[10px] opacity-75">
                                            {safeHref}
                                          </span>
                                        </div>
                                        <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-75" />
                                      </a>
                                    );
                                  } catch {
                                    return null;
                                  }
                                })}
                              </div>
                            )}
                          </>
                        )}

                        <div
                          className={`mt-1 flex items-center justify-end gap-1.5 text-[10px] tabular-nums ${
                            isMe ? 'text-blue-100/90' : 'text-slate-400'
                          }`}
                        >
                          {msg.is_edited && !msg.is_deleted && <span>modifié ·</span>}
                          <span>
                            {new Date(msg.created_at).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          {isMe &&
                            (msg.read_by && msg.read_by.length > 1 ? (
                              <CheckCheck className="h-3.5 w-3.5 text-blue-100" />
                            ) : (
                              <Check className="h-3.5 w-3.5 opacity-80" />
                            ))}
                        </div>
                      </div>

                      {/* Bouton d'actions rapides (côté droit si message reçu) */}
                      {!msg.is_deleted && !isMe && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveActionMsgId(actionOpen ? null : msg.id);
                          }}
                          className={`rounded-xl p-1.5 text-slate-400 hover:bg-white hover:text-slate-700 transition ${
                            actionOpen ? 'opacity-100 bg-white shadow-xs' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100'
                          }`}
                          title="Actions sur le message"
                        >
                          <SmilePlus className="h-4 w-4" />
                        </button>
                      )}

                      {/* Popover d'actions & réactions */}
                      {actionOpen && !msg.is_deleted && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className={`absolute -top-12 z-30 flex items-center gap-0.5 rounded-2xl border border-slate-200 bg-white px-2 py-1.5 shadow-xl animate-fadeIn ${
                            isMe ? 'right-0' : 'left-0'
                          }`}
                        >
                          {QUICK_EMOJIS.slice(0, 5).map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => {
                                setActiveActionMsgId(null);
                                onAddReaction(msg.id, emoji);
                              }}
                              className="rounded-lg px-1.5 py-1 text-sm hover:bg-slate-100 hover:scale-110 transition"
                            >
                              {emoji}
                            </button>
                          ))}
                          <div className="mx-1 h-4 w-px bg-slate-200" />
                          <button
                            type="button"
                            onClick={() => {
                              setActiveActionMsgId(null);
                              onReplyMessage(msg);
                            }}
                            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-blue-600"
                            title="Répondre"
                          >
                            <Reply className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveActionMsgId(null);
                              onTogglePinMessage(msg);
                            }}
                            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-amber-600"
                            title={msg.is_pinned ? 'Désépingler' : 'Épingler'}
                          >
                            {msg.is_pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                          </button>
                          {msg.content && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveActionMsgId(null);
                                onCopyMessage(msg.content);
                              }}
                              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-blue-600"
                              title="Copier"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {isMe && msg.type === 'texte' && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveActionMsgId(null);
                                onEditMessage(msg);
                              }}
                              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-blue-600"
                              title="Modifier"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {isMe && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveActionMsgId(null);
                                onDeleteMessage(msg.id);
                              }}
                              className="rounded-lg p-1.5 text-slate-600 hover:bg-red-50 hover:text-red-600"
                              title="Supprimer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Réactions affichées */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div className={`mt-1 flex flex-wrap gap-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {Object.entries(msg.reactions).map(([emoji, rawUids]) => {
                          const uids = Array.isArray(rawUids) ? (rawUids as string[]) : [];
                          if (uids.length === 0) return null;
                          const reacted = currentUser ? uids.includes(currentUser.id) : false;
                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => onAddReaction(msg.id, emoji)}
                              className={`flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs transition ${
                                reacted
                                  ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold'
                                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <span>{emoji}</span>
                              <span className="text-[10px] font-bold tabular-nums">{uids.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Accusé Vu */}
                    {isMe && isLastReadByOther && activeOtherUser && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                        <span>Vu par {activeOtherUser.nom.split(' ')[0]}</span>
                      </div>
                    )}
                    {isMe && isGroup && msg.read_by && msg.read_by.length > 1 && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400 tabular-nums">
                        <Eye className="h-3 w-3" />
                        <span>Vu par {msg.read_by.length - 1}</span>
                      </div>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}

        {isOtherUserTyping && (
          <div className="flex items-center gap-2 py-1 pl-10">
            <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-2xs">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" />
              <span
                className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce"
                style={{ animationDelay: '0.15s' }}
              />
              <span
                className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce"
                style={{ animationDelay: '0.3s' }}
              />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bouton retour en bas si défilé */}
      {showScrollBottom && (
        <button
          type="button"
          onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className="absolute bottom-24 right-5 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-lg hover:bg-slate-50 transition"
          aria-label="Aller aux messages les plus récents"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      )}

      {/* 5. Compositeur */}
      {composerNode}
    </section>
  );
};
