import { getProxiedImageUrl } from '../lib/utils';
import { useState, useRef, useEffect } from 'react';
import { User, SupportChat, SupportMessage } from '../types';
import { Headset, Send, Trash2, ArrowLeft, Loader2 } from 'lucide-react';
import { doc, setDoc, updateDoc, collection, query, orderBy, onSnapshot, addDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { format } from 'date-fns';

export default function Support({ user }: { user: User }) {
  if (user.isAdmin) {
    return <AdminSupportView user={user} />;
  }
  return <UserSupportChat user={user} />;
}

function UserSupportChat({ user }: { user: User }) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [hiddenUntil, setHiddenUntil] = useState<number>(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Listen to chat doc to get userHiddenUntil
    const chatRef = doc(db, 'support_chats', user.uid);
    const unsubChat = onSnapshot(chatRef, (docSnap) => {
      if (docSnap.exists()) {
        setHiddenUntil(docSnap.data().userHiddenUntil || 0);
      }
    });

    // Listen to messages
    const q = query(collection(db, 'support_chats', user.uid, 'messages'), orderBy('createdAt', 'asc'));
    const unsubMsgs = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SupportMessage)));
    });

    return () => {
      unsubChat();
      unsubMsgs();
    };
  }, [user.uid]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, hiddenUntil]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const text = input.trim();
    setInput('');
    // Optimistic UI: do not block input while sending. Firestore onSnapshot handles local cache instantly.
    
    try {
      const chatRef = doc(db, 'support_chats', user.uid);
      const chatSnap = await getDoc(chatRef);
      const now = Date.now();
      
      if (!chatSnap.exists()) {
        await setDoc(chatRef, {
          userId: user.uid,
          userName: user.username,
          userAvatar: user.avatar,
          lastMessage: text,
          lastMessageTime: now,
          adminUnread: 1,
          userHiddenUntil: 0
        });
      } else {
        await updateDoc(chatRef, {
          lastMessage: text,
          lastMessageTime: now,
          adminUnread: (chatSnap.data().adminUnread || 0) + 1,
          userName: user.username,
          userAvatar: user.avatar
        });
      }

      await addDoc(collection(db, 'support_chats', user.uid, 'messages'), {
        role: 'user',
        text: text,
        createdAt: now
      });
    } catch (error) {
      console.warn(error);
    }
  };

  const visibleMessages = messages.filter(m => m.role !== 'system' && m.createdAt >= hiddenUntil);

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900 h-full">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-3 bg-white dark:bg-zinc-900 shrink-0 z-10 shadow-sm">
        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <Headset className="w-6 h-6 text-blue-600 dark:text-blue-500" />
        </div>
        <div>
          <h2 className="font-bold text-zinc-900 dark:text-zinc-100 leading-tight">Suporte FitFeed</h2>
          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Equipe de Atendimento</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50 rounded-2xl p-4 text-center max-w-[90%] mx-auto mb-6">
          <Headset className="w-8 h-8 text-blue-500 mx-auto mb-2 opacity-80" />
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1 text-sm">Central de Ajuda</h3>
          <p className="text-xs text-blue-800/80 dark:text-blue-200/80 leading-relaxed">
            Você está falando com o admin. Por favor, envie o seu problema ou sugestão. Você será respondido(a) em até 24 horas.
          </p>
        </div>

        {visibleMessages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl p-3 px-4 shadow-sm ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-br-none' 
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-bl-none'
            }`}>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
              <span className={`text-[10px] block mt-1 opacity-70 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                {format(msg.createdAt, 'HH:mm')}
              </span>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-2xl rounded-bl-none p-3 px-4">
              <Loader2 className="w-4 h-4 animate-spin text-zinc-500 dark:text-zinc-400" />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="w-full p-3 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Digite sua mensagem..."
            className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-zinc-900 dark:text-zinc-100"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="bg-blue-600 text-white p-2.5 rounded-full hover:bg-blue-700 dark:hover:bg-blue-500 transition-colors disabled:opacity-50 flex-shrink-0 shadow-sm"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminSupportView({ user }: { user: User }) {
  const [chats, setChats] = useState<SupportChat[]>([]);
  const [activeChat, setActiveChat] = useState<SupportChat | null>(null);

  useEffect(() => {
    if (window.location.hash === '#broadcast') {
      setActiveChat({ id: 'broadcast_notifications' } as SupportChat);
    }
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'support_chats'), orderBy('lastMessageTime', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setChats(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SupportChat)));
    });
    return () => unsub();
  }, []);

  if (activeChat) {
    if (activeChat.id === 'broadcast_notifications') {
      return <AdminNotificationsRoom onBack={() => setActiveChat(null)} />;
    }
    return (
      <AdminChatRoom 
        chat={activeChat} 
        onBack={() => setActiveChat(null)} 
        admin={user} 
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900 h-full">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between sticky top-0 bg-white dark:bg-zinc-900 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Headset className="w-5 h-5 text-blue-600 dark:text-blue-500" />
          </div>
          <div>
            <h2 className="font-bold text-zinc-900 dark:text-zinc-100">Atendimentos</h2>
            <p className="text-xs text-blue-600 dark:text-blue-500 font-medium">Painel do Administrador</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800/50 rounded-full flex items-center justify-center mb-4">
              <Headset className="w-6 h-6 text-zinc-400 dark:text-zinc-500" />
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 font-medium">Nenhum chamado de suporte no momento.</p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {chats.map(chat => (
              <div 
                key={chat.id} 
                onClick={() => {
                  setActiveChat(chat);
                  if (chat.unreadByAdmin) {
                    updateDoc(doc(db, 'support_chats', chat.id), { unreadByAdmin: false });
                  }
                }}
                className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <img referrerPolicy="no-referrer" src={getProxiedImageUrl(chat.userAvatar)} alt={chat.userName} className="w-10 h-10 rounded-full border border-zinc-200 dark:border-zinc-700 shrink-0 object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-zinc-900 dark:text-zinc-100 truncate pr-2">{chat.userName}</h3>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap ml-2 bg-zinc-200/50 dark:bg-zinc-700/50 px-2 py-1 rounded-full shrink-0">
                        {format(chat.lastMessageTime, 'dd/MM HH:mm')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <p className={`text-sm truncate pr-2 ${chat.unreadByAdmin ? 'text-zinc-900 dark:text-zinc-100 font-medium' : 'text-zinc-600 dark:text-zinc-300'}`}>
                        {chat.lastMessage}
                      </p>
                      {chat.unreadByAdmin && (
                        <div className="w-2.5 h-2.5 bg-blue-500 rounded-full flex-shrink-0"></div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AdminChatRoom({ chat, onBack, admin }: { chat: SupportChat, onBack: () => void, admin: User }) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isTerminating, setIsTerminating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'support_chats', chat.userId, 'messages'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SupportMessage)));
    });
    return () => unsub();
  }, [chat.userId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const text = input.trim();
    setInput('');
    // Optimistic UI

    try {
      const now = Date.now();
      await addDoc(collection(db, 'support_chats', chat.userId, 'messages'), {
        role: 'admin',
        text: text,
        createdAt: now
      });

      await updateDoc(doc(db, 'support_chats', chat.userId), {
        lastMessage: text,
        lastMessageTime: now,
        adminUnread: 0
      });
    } catch (error) {
      console.warn(error);
    }
  };

  const handleTerminate = async () => {
    setIsTerminating(true);
    try {
      const now = Date.now();
      await addDoc(collection(db, 'support_chats', chat.userId, 'messages'), {
        role: 'system',
        text: 'Conversa encerrada pelo administrador',
        createdAt: now
      });

      await updateDoc(doc(db, 'support_chats', chat.userId), {
        userHiddenUntil: now
      });
      
      setShowConfirm(false);
    } catch (err) {
      console.warn(err);
    } finally {
      setIsTerminating(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900 h-full relative">
      {/* Admin Header */}
      <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-3 bg-white dark:bg-zinc-900 shrink-0 z-10 shadow-sm">
        <button onClick={onBack} className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <img referrerPolicy="no-referrer" src={getProxiedImageUrl(chat.userAvatar)} alt={chat.userName} className="w-10 h-10 rounded-full border border-zinc-200 dark:border-zinc-700" />
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-zinc-900 dark:text-zinc-100 truncate leading-tight">{chat.userName}</h2>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">Atendimento</p>
        </div>
        <button 
          onClick={() => setShowConfirm(true)} 
          disabled={isTerminating}
          title="Encerrar / Limpar para o cliente" 
          className="p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors flex-shrink-0 disabled:opacity-50"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {showConfirm && (
        <div className="absolute top-16 left-0 right-0 z-20 p-4">
          <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg p-4">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
              Apagar chat para o usuário? O histórico continuará visível para você.
            </p>
            <div className="flex gap-2 justify-end">
              <button 
                onClick={() => setShowConfirm(false)}
                disabled={isTerminating}
                className="px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleTerminate}
                disabled={isTerminating}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isTerminating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Confirmar e Limpar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/50 dark:bg-zinc-950/50">
        {messages.map(msg => {
          if (msg.role === 'system') {
            return (
              <div key={msg.id} className="flex justify-center my-4">
                <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-[11px] px-3 py-1 rounded-full font-medium">
                  {msg.text} às {format(msg.createdAt, 'HH:mm')}
                </div>
              </div>
            );
          }

          const isAdminMessage = msg.role === 'admin';

          return (
            <div key={msg.id} className={`flex ${isAdminMessage ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl p-3 px-4 shadow-sm ${
                isAdminMessage 
                  ? 'bg-blue-600 text-white rounded-br-none' 
                  : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-bl-none border border-zinc-100 dark:border-zinc-700'
              }`}>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                <span className={`text-[10px] block mt-1 opacity-70 ${isAdminMessage ? 'text-right text-blue-100' : 'text-left text-zinc-500 dark:text-zinc-400'}`}>
                  {format(msg.createdAt, 'HH:mm')}
                </span>
              </div>
            </div>
          );
        })}
        {loading && (
          <div className="flex justify-end">
            <div className="bg-blue-600 text-white rounded-2xl rounded-br-none p-3 px-4">
              <Loader2 className="w-4 h-4 animate-spin text-blue-200" />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="w-full p-3 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Responder cliente..."
            className="flex-1 bg-zinc-100 dark:bg-zinc-800 border border-transparent rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-zinc-900 dark:text-zinc-100"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="bg-blue-600 text-white p-2.5 rounded-full hover:bg-blue-700 dark:hover:bg-blue-500 transition-colors disabled:opacity-50 flex-shrink-0 shadow-sm"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminNotificationsRoom({ onBack }: { onBack: () => void }) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isPush, setIsPush] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSend = async () => {
    if (!title.trim() || !message.trim() || loading) return;
    setLoading(true);
    setSuccess(false);
    try {
      await addDoc(collection(db, 'notifications'), {
        title: title.trim(),
        message: message.trim(),
        isPush,
        createdAt: Date.now()
      });
      setTitle('');
      setMessage('');
      setIsPush(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.warn("Erro ao projetar notificação:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900 h-full relative">
      {/* Admin Header */}
      <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-3 bg-white dark:bg-zinc-900 shrink-0 z-10 shadow-sm">
        <button onClick={onBack} className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <Send className="w-5 h-5 text-amber-600 dark:text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-zinc-900 dark:text-zinc-100 truncate leading-tight">Projetar Notificação</h2>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">Broadcast Global</p>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/50 dark:bg-zinc-950/50">
        <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 shadow-sm">
          <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-4">
            Envie uma notificação para todos os usuários do aplicativo.
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Título</label>
              <input 
                type="text" 
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ex: Atualização do sistema"
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Mensagem</label>
              <textarea 
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Ex: Novos treinos adicionados hoje..."
                rows={4}
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-zinc-900 dark:text-zinc-100 resize-none"
              />
            </div>
            
            <div 
              onClick={() => setIsPush(!isPush)}
              className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <input 
                type="checkbox" 
                checked={isPush} 
                readOnly 
                className="w-4 h-4 text-amber-500 rounded border-zinc-300 focus:ring-amber-500" 
              />
              <div className="flex-1">
                <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 pointer-events-none block">
                  Enviar alerta nativo para Celular/PC
                </label>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 pointer-events-none">
                  A notificação também vai disparar o alerta do sistema no aparelho dos usuários.
                </p>
              </div>
            </div>
            
            <button 
              onClick={handleSend}
              disabled={loading || !title.trim() || !message.trim()}
              className="w-full bg-amber-500 text-white font-semibold py-2.5 rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              Projetar Notificação
            </button>
            
            {success && (
              <p className="text-green-600 dark:text-green-400 text-sm font-semibold text-center">
                Notificação enviada com sucesso!
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
