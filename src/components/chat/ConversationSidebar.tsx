import React, { useState } from 'react';
import {
  Archive,
  BellOff,
  Check,
  CheckCheck,
  MessageSquarePlus,
  MoreHorizontal,
  Search,
  Star,
  Trash2,
  Users,
  X
} from 'lucide-react';
import { Conversation, UserProfile } from '../../types';
import { formatLastMessageTimestamp, UserAvatar } from './chatUtils';
import { ZAURE_GLOWS, ZAURE_ICON_CHIPS, ZAURE_SURFACES } from '../../styles/designSystem';

export type ChatFilterTab = 'all' | 'unread' | 'favorites' | 'groups' | 'archived';

interface ConversationSidebarProps {
  currentUser: UserProfile | null;
  conversations: Conversation[];
  availableUsers: UserProfile[];
  activeConvId: string | null;
  activeFilter: ChatFilterTab;
  searchQuery: string;
  presenceStatus: 'online' | 'busy' | 'offline';
  counts: {
    all: number;
    unread: number;
    favorites: number;
    groups: number;
    archived: number;
  };
  matchedUsersFromSearch: UserProfile[];
  onFilterChange: (filter: ChatFilterTab) => void;
  onSearchChange: (q: string) => void;
  onSelectConversation: (convId: string) => void;
  onStartDirectChat: (user: UserProfile) => void;
  onOpenNewChatModal: (tab?: 'direct' | 'group') => void;
  onToggleFavorite: (convId: string) => void;
  onToggleMute: (convId: string) => void;
  onToggleArchive: (convId: string) => void;
  onRequestDeleteConversation: (conv: Conversation) => void;
  onUpdateAvailability: (status: 'online' | 'busy' | 'offline') => void;
}

export const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  currentUser,
  conversations,
  availableUsers,
  activeConvId,
  activeFilter,
  searchQuery,
  presenceStatus,
  counts,
  matchedUsersFromSearch,
  onFilterChange,
  onSearchChange,
  onSelectConversation,
  onStartDirectChat,
  onOpenNewChatModal,
  onToggleFavorite,
  onToggleMute,
  onToggleArchive,
  onRequestDeleteConversation,
  onUpdateAvailability
}) => {
  const [openMenuConvId, setOpenMenuConvId] = useState<string | null>(null);

  const onlineContacts = availableUsers
    .filter((u) => u.id !== currentUser?.id && (u.availability === 'online' || u.availability === 'busy'))
    .slice(0, 12);

  const filterItems: { id: ChatFilterTab; label: string; count?: number }[] = [
    { id: 'all', label: 'Toutes', count: counts.all },
    { id: 'unread', label: 'Non lues', count: counts.unread },
    { id: 'favorites', label: 'Favoris', count: counts.favorites },
    { id: 'groups', label: 'Groupes', count: counts.groups }
  ];

  return (
    <aside className="relative z-10 flex h-full w-full flex-col bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-r border-slate-200/80 dark:border-slate-800 md:w-[340px] lg:w-[372px] shrink-0">
      {/* Header Messages + Nouvelle conversation */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-950 dark:text-white">Messages</h1>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              {counts.unread > 0
                ? `${counts.unread} discussion${counts.unread > 1 ? 's' : ''} non lue${counts.unread > 1 ? 's' : ''}`
                : 'Messagerie privée Zaure'}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <select
              aria-label="Mon statut de présence"
              value={presenceStatus}
              onChange={(e) => onUpdateAvailability(e.target.value as 'online' | 'busy' | 'offline')}
              className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="online">● En ligne</option>
              <option value="busy">● Occupé</option>
              <option value="offline">● Invisible</option>
            </select>

            <button
              type="button"
              onClick={() => onOpenNewChatModal('direct')}
              className={`${ZAURE_SURFACES.gradientButton} h-10 min-w-[40px] px-3 text-xs`}
              title="Nouvelle conversation"
            >
              <MessageSquarePlus className="h-4 w-4" />
              <span className="hidden sm:inline">Nouveau</span>
            </button>
          </div>
        </div>

        {/* Barre de recherche */}
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Rechercher une conversation ou un membre..."
            className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/80 pl-10 pr-9 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200"
              aria-label="Effacer la recherche"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filtres : Toutes, Non lues, Favoris, Groupes + Archivées */}
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {filterItems.map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onFilterChange(tab.id)}
                className={`shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition min-h-[34px] ${
                  isActive
                    ? 'zaure-nav-pill-active'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-50/80 dark:hover:bg-slate-700 hover:text-blue-700 dark:hover:text-blue-300'
                }`}
              >
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && tab.count > 0 && (
                  <span
                    className={`tabular-nums rounded-md px-1.5 py-0.5 text-[10px] leading-none font-extrabold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => onFilterChange(activeFilter === 'archived' ? 'all' : 'archived')}
            title="Conversations archivées"
            className={`shrink-0 flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold transition min-h-[34px] ${
              activeFilter === 'archived'
                ? 'bg-slate-900 dark:bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Archive className="h-3.5 w-3.5" />
            {counts.archived > 0 && <span className="tabular-nums text-[10px]">{counts.archived}</span>}
          </button>
        </div>
      </div>

      {/* Bande contacts actifs en ligne */}
      {onlineContacts.length > 0 && !searchQuery.trim() && (
        <div className="border-b border-slate-100 dark:border-slate-800 px-4 py-2.5 bg-slate-50/70 dark:bg-slate-900/60">
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
            {onlineContacts.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => onStartDirectChat(user)}
                className="group flex flex-col items-center gap-1 shrink-0 w-14 text-center"
                title={`Écrire à ${user.nom}`}
              >
                <div className="rounded-full p-0.5 transition group-hover:ring-2 group-hover:ring-sky-400/70">
                  <UserAvatar
                    name={user.nom}
                    avatarUrl={user.avatar_url}
                    availability={user.availability}
                    showPresence
                    size="sm"
                  />
                </div>
                <span className="w-full truncate text-[10px] font-semibold text-slate-600 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-sky-400">
                  {user.nom.split(' ')[0]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Liste des conversations */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${ZAURE_ICON_CHIPS.blue} mb-3`}>
              {activeFilter === 'favorites' ? (
                <Star className="h-5 w-5" />
              ) : activeFilter === 'groups' ? (
                <Users className="h-5 w-5" />
              ) : (
                <MessageSquarePlus className="h-5 w-5" />
              )}
            </div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {activeFilter === 'unread'
                ? 'Aucun message non lu'
                : activeFilter === 'favorites'
                  ? 'Aucune discussion favorite'
                  : activeFilter === 'groups'
                    ? 'Aucun groupe pour le moment'
                    : activeFilter === 'archived'
                      ? 'Aucune discussion archivée'
                      : 'Aucune conversation'}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-[240px]">
              {activeFilter === 'favorites'
                ? 'Ajoutez une conversation en favori pour la retrouver instantanément ici.'
                : 'Démarrez un échange privé ou créez un groupe avec vos confrères.'}
            </p>
            <button
              type="button"
              onClick={() => onOpenNewChatModal(activeFilter === 'groups' ? 'group' : 'direct')}
              className={`${ZAURE_SURFACES.gradientButton} mt-4 px-4 py-2 text-xs min-h-[40px]`}
            >
              {activeFilter === 'groups' ? 'Créer un groupe' : 'Nouvelle conversation'}
            </button>
          </div>
        ) : (
          conversations.map((conv) => {
            const isSelected = conv.id === activeConvId;
            const isGroup = conv.type === 'group';
            const otherUid = !isGroup
              ? conv.participant_ids.find((id) => id !== currentUser?.id)
              : undefined;
            const liveOtherUser = otherUid ? availableUsers.find((u) => u.id === otherUid) : undefined;
            const fallbackParticipant = otherUid ? conv.participants?.[otherUid] : undefined;

            const title = isGroup
              ? conv.group_name || 'Groupe Zaure'
              : liveOtherUser?.nom || fallbackParticipant?.nom || 'Membre Zaure';
            const avatar = isGroup
              ? conv.group_photo
              : liveOtherUser?.avatar_url || fallbackParticipant?.avatar_url;
            const availability: 'online' | 'busy' | 'offline' = liveOtherUser?.availability
              ? liveOtherUser.availability
              : fallbackParticipant?.is_online
                ? 'online'
                : 'offline';

            const unreadCount = currentUser ? conv.unread_counts?.[currentUser.id] || 0 : 0;
            const isFav = currentUser ? Boolean(conv.is_favorite_by?.includes(currentUser.id)) : false;
            const isMuted = currentUser ? Boolean(conv.is_muted_by?.includes(currentUser.id)) : false;
            const isArchived = currentUser ? Boolean(conv.is_archived_by?.includes(currentUser.id)) : false;
            const isTyping = Object.entries(conv.typing || {}).some(
              ([uid, val]) => uid !== currentUser?.id && val === true
            );

            const lastMsg = conv.last_message;
            const isLastMsgFromMe = lastMsg?.sender_id === currentUser?.id;
            const menuOpen = openMenuConvId === conv.id;

            return (
              <div key={conv.id} className="relative group">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setOpenMenuConvId(null);
                    onSelectConversation(conv.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectConversation(conv.id);
                    }
                  }}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition cursor-pointer min-h-[64px] ${
                    isSelected
                      ? `bg-gradient-to-r from-blue-50/95 to-sky-50/75 dark:from-blue-950/65 dark:to-sky-950/35 ring-1 ring-blue-300/80 dark:ring-blue-700/70 ${ZAURE_GLOWS.soft}`
                      : 'hover:bg-slate-50/90 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <UserAvatar
                    name={title}
                    avatarUrl={avatar}
                    isGroup={isGroup}
                    availability={availability}
                    showPresence={!isGroup}
                    size="md"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`truncate text-sm ${
                            unreadCount > 0 || isSelected
                              ? 'font-extrabold text-slate-950 dark:text-white'
                              : 'font-semibold text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {title}
                        </span>
                        {isFav && (
                          <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500" />
                        )}
                        {isMuted && <BellOff className="h-3 w-3 shrink-0 text-slate-400" />}
                      </div>
                      <span
                        className={`shrink-0 text-[11px] tabular-nums ${
                          unreadCount > 0 ? 'font-bold text-blue-600 dark:text-sky-400' : 'text-slate-400 font-medium'
                        }`}
                      >
                        {formatLastMessageTimestamp(lastMsg?.created_at || conv.updated_at)}
                      </span>
                    </div>

                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p
                        className={`truncate text-xs ${
                          isTyping
                            ? 'font-semibold text-blue-600 dark:text-sky-400 italic'
                            : unreadCount > 0
                              ? 'font-semibold text-slate-800 dark:text-slate-100'
                              : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {isTyping ? (
                          'En train d’écrire...'
                        ) : lastMsg ? (
                          <span className="inline-flex items-center gap-1">
                            {isLastMsgFromMe && (
                              <span className="inline-flex text-blue-600 dark:text-sky-400">
                                {unreadCount === 0 ? (
                                  <CheckCheck className="h-3 w-3" />
                                ) : (
                                  <Check className="h-3 w-3" />
                                )}
                              </span>
                            )}
                            {isGroup && !isLastMsgFromMe && lastMsg.sender_nom
                              ? `${lastMsg.sender_nom.split(' ')[0]} : `
                              : isLastMsgFromMe
                                ? 'Vous : '
                                : ''}
                            {lastMsg.content}
                          </span>
                        ) : (
                          'Démarrez la discussion'
                        )}
                      </p>

                      <div className="flex items-center gap-1 shrink-0">
                        {unreadCount > 0 && (
                          <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full zaure-grad-primary px-1.5 text-[10px] font-extrabold text-white tabular-nums ${ZAURE_GLOWS.blue}`}>
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuConvId(menuOpen ? null : conv.id);
                          }}
                          className={`rounded-lg p-1 text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition ${
                            menuOpen ? 'opacity-100 bg-slate-200/80 dark:bg-slate-700' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100'
                          }`}
                          aria-label="Options de conversation"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {menuOpen && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute right-3 top-12 z-30 w-48 p-1.5 ${ZAURE_SURFACES.popoverMenu}`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenuConvId(null);
                        onToggleFavorite(conv.id);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Star className={`h-3.5 w-3.5 ${isFav ? 'fill-amber-400 text-amber-500' : ''}`} />
                      <span>{isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenuConvId(null);
                        onToggleMute(conv.id);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <BellOff className="h-3.5 w-3.5" />
                      <span>{isMuted ? 'Réactiver notifications' : 'Mettre en sourdine'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenuConvId(null);
                        onToggleArchive(conv.id);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Archive className="h-3.5 w-3.5" />
                      <span>{isArchived ? 'Désarchiver' : 'Archiver'}</span>
                    </button>
                    <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenuConvId(null);
                        onRequestDeleteConversation(conv);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Supprimer</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Résultats directs supplémentaires quand on recherche un contact */}
        {searchQuery.trim() && matchedUsersFromSearch.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 px-1">
            <p className="px-2 pb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Contacts Zaure
            </p>
            <div className="space-y-1">
              {matchedUsersFromSearch.slice(0, 6).map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => onStartDirectChat(u)}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left hover:bg-blue-50/70 dark:hover:bg-slate-800 transition"
                >
                  <UserAvatar
                    name={u.nom}
                    avatarUrl={u.avatar_url}
                    availability={u.availability}
                    showPresence
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">{u.nom}</p>
                    <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {u.profession || (u.role === 'mentor' ? 'Mentor médical' : 'Membre Zaure')}
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-blue-600 dark:text-sky-400">Écrire</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
