import React, { useState, useEffect, useRef } from 'react';
import { Send, User, MessageSquare, ShieldCheck, Award, ChevronLeft } from 'lucide-react';
import { Message, UserProfile } from '../types';
import { zaureService } from '../firebaseClient';

interface ChatViewProps {
  currentUser: UserProfile | null;
}

export default function ChatView({ currentUser }: ChatViewProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Load user contacts
  useEffect(() => {
    const list = zaureService.getAvailableUsers();
    // Filter out self
    if (currentUser) {
      setUsers(list.filter((u) => u.id !== currentUser.id));
    } else {
      setUsers(list);
    }
  }, [currentUser]);

  // Load messages when selectedUser changes
  useEffect(() => {
    if (selectedUser) {
      loadMessages();
      // Poll for mock real-time effect every 4 seconds in local mode
      const interval = setInterval(() => {
        loadMessages();
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [selectedUser, currentUser]);

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    if (!selectedUser) return;
    try {
      const chatHistory = await zaureService.getPrivateMessages(selectedUser.id);
      setMessages(chatHistory);
    } catch (e) {
      console.error(e);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim() || !selectedUser || !currentUser) return;

    const textToSend = newMessageText.trim();
    setNewMessageText('');

    try {
      const sent = await zaureService.sendPrivateMessage(selectedUser.id, textToSend);
      setMessages((prev) => [...prev, sent]);
    } catch (e) {
      console.error(e);
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm h-[600px] flex overflow-hidden font-sans" id="chat-view-container">
      {/* 1. Contact List Pane */}
      <div
        className={`w-full md:w-80 border-r border-slate-100 flex flex-col bg-slate-50/50 ${
          selectedUser ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div className="p-4 border-b border-slate-100 bg-white">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-500" />
            <span>Discussions Privées</span>
          </h3>
          <p className="text-[10px] text-slate-400 mt-1">Échangez avec les mentors et apprenants de Zaure</p>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {users.length === 0 ? (
            <p className="text-xs text-slate-400 italic p-4 text-center">Aucun autre utilisateur disponible pour le chat.</p>
          ) : (
            users.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelectedUser(u)}
                className={`w-full text-left p-3 rounded-xl flex items-start gap-3 transition-all ${
                  selectedUser?.id === u.id
                    ? 'bg-emerald-50 border border-emerald-100 text-slate-900 shadow-sm'
                    : 'hover:bg-white border border-transparent text-slate-700'
                }`}
              >
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt={u.nom} className="w-9 h-9 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center shrink-0">
                    <User className="w-4.5 h-4.5 text-slate-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-xs truncate">{u.nom}</span>
                    {u.role === 'verifie' && <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                    {u.role === 'mentor' && <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                  </div>
                  <p className="text-[10px] text-slate-500 truncate mt-0.5">{u.bio || 'Aucune description'}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* 2. Messages Thread Pane */}
      <div
        className={`flex-1 flex flex-col bg-slate-50 ${
          !selectedUser ? 'hidden md:flex items-center justify-center p-6 text-center' : 'flex'
        }`}
      >
        {selectedUser ? (
          <>
            {/* Header chat partner info */}
            <div className="p-4 border-b border-slate-100 bg-white flex items-center gap-3">
              <button
                onClick={() => setSelectedUser(null)}
                className="md:hidden p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 mr-1"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              {selectedUser.avatar_url ? (
                <img src={selectedUser.avatar_url} alt={selectedUser.nom} className="w-9 h-9 rounded-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center">
                  <User className="w-5.5 h-5.5 text-slate-500" />
                </div>
              )}

              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="font-bold text-slate-900 text-xs">{selectedUser.nom}</h4>
                  {selectedUser.role === 'verifie' && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.2 bg-emerald-50 text-emerald-700 rounded-md">Vérifié</span>
                  )}
                  {selectedUser.role === 'mentor' && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.2 bg-amber-50 text-amber-700 rounded-md">Mentor</span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 truncate max-w-xs md:max-w-md">{selectedUser.bio || 'Aucune biographie disponible.'}</p>
              </div>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs text-center py-10">
                  <MessageSquare className="w-8 h-8 text-slate-300 mb-2 stroke-1" />
                  <p>Début de la conversation avec {selectedUser.nom}</p>
                  <p className="text-[10px] mt-1 text-slate-400">Posez une question sur la santé, l'éducation ou la langue haoussa !</p>
                </div>
              ) : (
                messages.map((m) => {
                  const isOwn = m.sender_id === currentUser?.id;
                  return (
                    <div key={m.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-xs md:max-w-md p-3 rounded-2xl text-xs shadow-sm ${
                          isOwn
                            ? 'bg-emerald-500 text-slate-950 rounded-br-none'
                            : 'bg-white text-slate-800 rounded-bl-none border border-slate-100'
                        }`}
                      >
                        <p className="leading-relaxed break-words">{m.content}</p>
                        <p
                          className={`text-[9px] text-right mt-1.5 font-mono ${
                            isOwn ? 'text-slate-900/60' : 'text-slate-400'
                          }`}
                        >
                          {formatTime(m.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Send Message Form */}
            <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-100 flex gap-2">
              <input
                type="text"
                placeholder={`Écrire à ${selectedUser.nom}...`}
                value={newMessageText}
                onChange={(e) => setNewMessageText(e.target.value)}
                className="flex-1 px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 bg-slate-50/50"
              />
              <button
                type="submit"
                disabled={!newMessageText.trim()}
                className="p-2.5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 rounded-xl transition shadow-sm disabled:opacity-50 disabled:hover:bg-emerald-500"
              >
                <Send className="w-4.5 h-4.5" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 max-w-sm">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-emerald-500 stroke-1" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Discussions directes</h4>
            <p className="text-xs text-slate-400 text-center mt-2 leading-relaxed">
              Sélectionnez un membre dans la liste latérale pour démarrer une messagerie privée et échanger vos savoirs de manière privilégiée.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
