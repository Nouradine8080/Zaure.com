import React, { useEffect, useState } from 'react';
import {
  Camera,
  Check,
  Download,
  Flag,
  Loader2,
  LogOut,
  Mic,
  MicOff,
  PhoneOff,
  Search,
  Shield,
  ShieldOff,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  UserX,
  Video,
  VideoOff,
  X
} from 'lucide-react';
import { Conversation, UserProfile } from '../../types';
import { formatCallTime, formatLastSeen, UserAvatar } from './chatUtils';

interface NewChatModalProps {
  isOpen: boolean;
  initialTab: 'direct' | 'group';
  currentUser: UserProfile | null;
  availableUsers: UserProfile[];
  onClose: () => void;
  onStartDirectChat: (user: UserProfile) => void;
  onCreateGroup: (params: {
    groupName: string;
    groupDescription: string;
    memberIds: string[];
  }) => Promise<void>;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
  isOpen,
  initialTab,
  currentUser,
  availableUsers,
  onClose,
  onStartDirectChat,
  onCreateGroup
}) => {
  const [tab, setTab] = useState<'direct' | 'group'>(initialTab);
  const [contactSearch, setContactSearch] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setContactSearch('');
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const filteredContacts = availableUsers
    .filter((u) => u.id !== currentUser?.id)
    .filter((u) => {
      if (!contactSearch.trim()) return true;
      const q = contactSearch.toLowerCase();
      return (
        u.nom.toLowerCase().includes(q) ||
        (u.profession || '').toLowerCase().includes(q) ||
        (u.localisation || '').toLowerCase().includes(q)
      );
    });

  const handleGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || selectedIds.length === 0) return;
    setIsSubmitting(true);
    try {
      await onCreateGroup({
        groupName: groupName.trim(),
        groupDescription: groupDescription.trim(),
        memberIds: selectedIds
      });
      setGroupName('');
      setGroupDescription('');
      setSelectedIds([]);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl animate-slideUp"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-slate-950">Nouvelle discussion</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 flex rounded-2xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setTab('direct')}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
              tab === 'direct' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600'
            }`}
          >
            Message direct
          </button>
          <button
            type="button"
            onClick={() => setTab('group')}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
              tab === 'group' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600'
            }`}
          >
            Créer un groupe
          </button>
        </div>

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={contactSearch}
            onChange={(e) => setContactSearch(e.target.value)}
            placeholder="Rechercher un membre..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
          />
        </div>

        {tab === 'direct' ? (
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 pr-1">
            {filteredContacts.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">Aucun membre trouvé.</p>
            ) : (
              filteredContacts.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => onStartDirectChat(u)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-slate-50 transition"
                >
                  <UserAvatar
                    name={u.nom}
                    avatarUrl={u.avatar_url}
                    availability={u.availability}
                    showPresence
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">{u.nom}</p>
                    <p className="truncate text-xs text-slate-500">
                      {u.profession || (u.role === 'mentor' ? 'Mentor médical' : 'Membre Zaure')}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        ) : (
          <form onSubmit={handleGroupSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Nom du groupe
              </label>
              <input
                type="text"
                required
                maxLength={120}
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Ex : Équipe Santé Communautaire"
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Description (facultatif)
              </label>
              <input
                type="text"
                maxLength={500}
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                placeholder="Objectif du groupe..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Membres sélectionnés ({selectedIds.length})
              </label>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-1.5">
                {filteredContacts.map((u) => {
                  const isSel = selectedIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() =>
                        setSelectedIds((prev) =>
                          isSel ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                        )
                      }
                      className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs transition ${
                        isSel
                          ? 'bg-blue-50 font-bold text-blue-700'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <UserAvatar name={u.nom} avatarUrl={u.avatar_url} size="xs" />
                        <span className="truncate">{u.nom}</span>
                      </div>
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                          isSel
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSel && <Check className="h-3 w-3" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !groupName.trim() || selectedIds.length === 0}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-sm font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-40 transition"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
              <span>{isSubmitting ? 'Création...' : 'Créer le groupe'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

interface EditGroupModalProps {
  isOpen: boolean;
  conversation: Conversation | null;
  onClose: () => void;
  onSave: (updates: {
    group_name: string;
    group_description: string;
    group_photo: string;
  }) => Promise<void>;
}

export const EditGroupModal: React.FC<EditGroupModalProps> = ({
  isOpen,
  conversation,
  onClose,
  onSave
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && conversation) {
      setName(conversation.group_name || '');
      setDescription(conversation.group_description || '');
      setPhoto(conversation.group_photo || '');
    }
  }, [isOpen, conversation]);

  if (!isOpen || !conversation) return null;

  const handlePhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (ev) => {
      const img = new Image();
      img.src = ev.target?.result as string;
      img.onload = () => {
        const maxSide = 256;
        let w = img.width;
        let h = img.height;
        if (w > h && w > maxSide) {
          h = Math.round((h * maxSide) / w);
          w = maxSide;
        } else if (h >= w && h > maxSide) {
          w = Math.round((w * maxSide) / h);
          h = maxSide;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        setPhoto(canvas.toDataURL('image/jpeg', 0.8));
      };
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      await onSave({
        group_name: name.trim(),
        group_description: description.trim(),
        group_photo: photo
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-slideUp"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-slate-950">Modifier le groupe</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col items-center gap-2">
            <UserAvatar name={name || 'G'} avatarUrl={photo} isGroup size="xl" />
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition">
              <Camera className="h-3.5 w-3.5" />
              <span>Changer la photo du groupe</span>
              <input type="file" accept="image/*" onChange={handlePhotoFile} className="hidden" />
            </label>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Nom du groupe
            </label>
            <input
              type="text"
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Description
            </label>
            <textarea
              rows={3}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-11 flex-1 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 hover:bg-slate-200 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSaving || !name.trim()}
              className="h-11 flex-1 rounded-xl bg-blue-600 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-40 transition"
            >
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ManageGroupMembersModalProps {
  isOpen: boolean;
  conversation: Conversation | null;
  currentUser: UserProfile | null;
  availableUsers: UserProfile[];
  isGroupAdmin: boolean;
  onClose: () => void;
  onAddMember: (user: UserProfile) => Promise<void>;
  onRemoveMember: (userId: string, name: string) => Promise<void>;
  onToggleAdmin: (userId: string, makeAdmin: boolean, name: string) => Promise<void>;
  onLeaveGroup: () => Promise<void>;
}

export const ManageGroupMembersModal: React.FC<ManageGroupMembersModalProps> = ({
  isOpen,
  conversation,
  currentUser,
  availableUsers,
  isGroupAdmin,
  onClose,
  onAddMember,
  onRemoveMember,
  onToggleAdmin,
  onLeaveGroup
}) => {
  const [addSearch, setAddSearch] = useState('');
  const [busyUid, setBusyUid] = useState<string | null>(null);

  if (!isOpen || !conversation) return null;

  const nonMembers = availableUsers
    .filter((u) => !conversation.participant_ids.includes(u.id))
    .filter((u) => {
      if (!addSearch.trim()) return true;
      return u.nom.toLowerCase().includes(addSearch.toLowerCase());
    });

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-slideUp max-h-[85vh] flex flex-col"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-slate-950">Membres du groupe</h3>
            <p className="text-xs text-slate-500">
              {conversation.participant_ids.length} participant
              {conversation.participant_ids.length > 1 ? 's' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {isGroupAdmin && (
            <div>
              <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Ajouter un membre
              </p>
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                  placeholder="Rechercher un membre à ajouter..."
                  className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs focus:border-blue-500 focus:bg-white focus:outline-none"
                />
              </div>
              {nonMembers.length > 0 ? (
                <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-slate-100 p-1.5">
                  {nonMembers.slice(0, 12).map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <UserAvatar name={u.nom} avatarUrl={u.avatar_url} size="xs" />
                        <span className="truncate text-xs font-semibold text-slate-800">{u.nom}</span>
                      </div>
                      <button
                        type="button"
                        disabled={busyUid === u.id}
                        onClick={async () => {
                          setBusyUid(u.id);
                          try {
                            await onAddMember(u);
                          } finally {
                            setBusyUid(null);
                          }
                        }}
                        className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-blue-700 disabled:opacity-40"
                      >
                        <UserPlus className="h-3 w-3" />
                        <span>Ajouter</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Tous les membres disponibles sont déjà dans le groupe.</p>
              )}
            </div>
          )}

          <div>
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Participants actuels
            </p>
            <div className="space-y-1.5">
              {conversation.participant_ids.map((uid) => {
                const live = availableUsers.find((u) => u.id === uid);
                const meta = conversation.participants?.[uid];
                const name = live?.nom || meta?.nom || 'Membre';
                const isMe = uid === currentUser?.id;
                const isAdmin = Boolean(conversation.admin_ids?.includes(uid));

                return (
                  <div
                    key={uid}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <UserAvatar
                        name={name}
                        avatarUrl={live?.avatar_url || meta?.avatar_url}
                        size="xs"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-slate-900">
                          {isMe ? `${name} (Vous)` : name}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {isAdmin ? 'Administrateur' : 'Membre'}
                        </p>
                      </div>
                    </div>

                    {isGroupAdmin && !isMe && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={busyUid === uid}
                          onClick={async () => {
                            setBusyUid(uid);
                            try {
                              await onToggleAdmin(uid, !isAdmin, name);
                            } finally {
                              setBusyUid(null);
                            }
                          }}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-blue-600 transition"
                          title={isAdmin ? 'Retirer le rôle admin' : 'Nommer administrateur'}
                        >
                          {isAdmin ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          disabled={busyUid === uid}
                          onClick={async () => {
                            setBusyUid(uid);
                            try {
                              await onRemoveMember(uid, name);
                            } finally {
                              setBusyUid(null);
                            }
                          }}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 transition"
                          title="Retirer du groupe"
                        >
                          <UserMinus className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={async () => {
              await onLeaveGroup();
              onClose();
            }}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 text-xs font-bold text-red-700 hover:bg-red-100 transition"
          >
            <LogOut className="h-4 w-4" />
            <span>Quitter ce groupe</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface UserProfileModalProps {
  user: UserProfile | null;
  isBlocked: boolean;
  onClose: () => void;
  onStartDirectChat: (u: UserProfile) => void;
  onToggleBlock: (u: UserProfile) => void;
  onReport: (u: UserProfile) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  isBlocked,
  onClose,
  onStartDirectChat,
  onToggleBlock,
  onReport
}) => {
  if (!user) return null;
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-slideUp"
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col items-center text-center">
          <UserAvatar
            name={user.nom}
            avatarUrl={user.avatar_url}
            availability={user.availability}
            showPresence
            size="xl"
          />
          <h3 className="mt-3 text-lg font-extrabold text-slate-950">{user.nom}</h3>
          <p className="text-xs font-semibold text-blue-600">
            {user.profession || (user.role === 'mentor' ? 'Mentor médical' : 'Membre Zaure')}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">{formatLastSeen(user)}</p>
          {user.bio && (
            <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 border border-slate-100 w-full">
              {user.bio}
            </p>
          )}
        </div>

        <div className="mt-5 space-y-2">
          <button
            type="button"
            onClick={() => onStartDirectChat(user)}
            className="h-11 w-full rounded-xl bg-blue-600 text-xs font-bold text-white hover:bg-blue-700 transition"
          >
            Ouvrir la discussion
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onToggleBlock(user)}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 hover:bg-red-50 hover:text-red-600 transition"
            >
              <UserX className="h-3.5 w-3.5" />
              <span>{isBlocked ? 'Débloquer' : 'Bloquer'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onReport(user);
              }}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition"
            >
              <Flag className="h-3.5 w-3.5" />
              <span>Signaler</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ReportModalProps {
  user: UserProfile | null;
  reason: 'spam' | 'harcelement' | 'usurpation' | 'contenu_inapproprie' | 'autre';
  details: string;
  isSubmitting: boolean;
  onReasonChange: (r: 'spam' | 'harcelement' | 'usurpation' | 'contenu_inapproprie' | 'autre') => void;
  onDetailsChange: (d: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  user,
  reason,
  details,
  isSubmitting,
  onReasonChange,
  onDetailsChange,
  onClose,
  onSubmit
}) => {
  if (!user) return null;
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-slideUp"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-extrabold text-slate-950">Signaler {user.nom}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600">Motif</label>
            <select
              value={reason}
              onChange={(e) => onReasonChange(e.target.value as any)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
            >
              <option value="spam">Spam ou publicité indésirable</option>
              <option value="harcelement">Harcèlement ou propos offensants</option>
              <option value="usurpation">Usurpation d’identité</option>
              <option value="contenu_inapproprie">Contenu inapproprié</option>
              <option value="autre">Autre motif</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600">
              Détails supplémentaires (facultatif)
            </label>
            <textarea
              rows={3}
              value={details}
              onChange={(e) => onDetailsChange(e.target.value)}
              placeholder="Décrivez brièvement la situation..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="h-10 flex-1 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 hover:bg-slate-200"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-10 flex-1 rounded-xl bg-red-600 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Envoi...' : 'Envoyer le signalement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface CallModalProps {
  callModal: {
    isOpen: boolean;
    type: 'audio' | 'video';
    status: 'ringing' | 'connected' | 'ended';
    duration: number;
    isMuted: boolean;
    isVideoOff: boolean;
  };
  title: string;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
}

export const CallOverlayModal: React.FC<CallModalProps> = ({
  callModal,
  title,
  localVideoRef,
  onToggleMute,
  onToggleVideo,
  onEndCall
}) => {
  if (!callModal.isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md animate-fadeIn">
      <div className="relative flex h-[82vh] w-full max-w-2xl flex-col justify-between overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 text-white shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-extrabold">{title}</h3>
            <p className="text-xs text-slate-400 tabular-nums">
              {callModal.status === 'ringing'
                ? 'Appel en cours...'
                : `Connecté • ${formatCallTime(callModal.duration)}`}
            </p>
          </div>
          <span className="rounded-xl bg-slate-800 px-3 py-1 text-xs font-bold text-blue-400">
            {callModal.type === 'video' ? 'Vidéo' : 'Audio'}
          </span>
        </div>

        <div className="relative flex flex-1 items-center justify-center p-4">
          {callModal.type === 'video' ? (
            <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl bg-slate-950">
              <div className="flex flex-col items-center">
                <div className="flex h-28 w-28 items-center justify-center rounded-full bg-blue-600 text-4xl font-extrabold">
                  {title.charAt(0).toUpperCase()}
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-300">Caméra locale active</p>
              </div>
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="absolute bottom-4 right-4 h-36 w-28 rounded-2xl border border-white/20 bg-black object-cover shadow-xl"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="flex h-32 w-32 items-center justify-center rounded-full bg-blue-600 text-5xl font-extrabold shadow-2xl">
                {title.charAt(0).toUpperCase()}
              </div>
              <p className="mt-5 text-sm text-slate-300">Appel audio Zaure</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-5 border-t border-slate-800 bg-slate-950/70 p-5">
          <button
            type="button"
            onClick={onToggleMute}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
              callModal.isMuted ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            {callModal.isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>

          {callModal.type === 'video' && (
            <button
              type="button"
              onClick={onToggleVideo}
              className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
                callModal.isVideoOff
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              {callModal.isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
            </button>
          )}

          <button
            type="button"
            onClick={onEndCall}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg hover:bg-red-700 transition"
          >
            <PhoneOff className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
};

export const ImageLightboxModal: React.FC<{ imageUrl: string | null; onClose: () => void }> = ({
  imageUrl,
  onClose
}) => {
  if (!imageUrl) return null;
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md animate-fadeIn"
    >
      <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        <img
          src={imageUrl}
          alt="Aperçu agrandi"
          className="max-h-[88vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
          referrerPolicy="no-referrer"
        />
        <div className="absolute right-3 top-3 flex items-center gap-2">
          <a
            href={imageUrl}
            download="image_zaure.jpg"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition"
          >
            <Download className="h-5 w-5" />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  secondaryLabel?: string;
  onConfirm: () => void;
  onSecondary?: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  confirmLabel,
  tone = 'danger',
  secondaryLabel,
  onConfirm,
  onSecondary,
  onCancel
}) => {
  if (!isOpen) return null;
  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-slideUp"
      >
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <Trash2 className="h-5 w-5" />
        </div>
        <h3 className="text-base font-extrabold text-slate-950">{title}</h3>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{description}</p>
        <div className="mt-5 space-y-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="h-10 flex-1 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 hover:bg-slate-200 transition"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`h-10 flex-1 rounded-xl text-xs font-bold text-white transition ${
                tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
          {secondaryLabel && onSecondary && (
            <button
              type="button"
              onClick={onSecondary}
              className="h-10 w-full rounded-xl border border-red-200 bg-red-50 text-xs font-bold text-red-700 hover:bg-red-100 transition"
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
