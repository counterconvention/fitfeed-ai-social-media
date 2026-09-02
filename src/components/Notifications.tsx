import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toggleFollowTx } from '../lib/follow';
import { doc, getDoc } from 'firebase/firestore';
import { AppNotification, User } from '../types';
import { Bell, ArrowLeft, Loader2, BellRing, Send, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export default function Notifications({ user }: { user?: User }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [permStatus, setPermStatus] = useState<string>('default');

  const navigate = useNavigate();

  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Check initial follow state for notifications that have followerId
    if (!user) return;
    const checkFollows = async () => {
      const newMap: Record<string, boolean> = {};
      for (const n of notifications) {
        if (n.type === 'follow' && n.followerId) {
           const followId = `${user.uid}_${n.followerId}`;
           const snap = await getDoc(doc(db, 'follows', followId));
           if (snap.exists()) {
             newMap[n.followerId] = true;
           }
        }
      }
      setFollowingMap(newMap);
    };
    if (notifications.length > 0) checkFollows();
  }, [notifications, user]);

  const handleFollowBack = async (targetId: string) => {
    if (!user) return;
    try {
      const success = await toggleFollowTx(user.uid, targetId, user.username, true);
      if (success) {
         setFollowingMap(prev => ({ ...prev, [targetId]: true }));
      }
    } catch (err) {
      console.warn(err);
    }
  };

  const checkPerm = () => {
    if ("Notification" in window) {
      setPermStatus(Notification.permission);
    }
  };

  useEffect(() => {
    checkPerm();
    window.addEventListener('focus', checkPerm);
    return () => window.removeEventListener('focus', checkPerm);
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    
    const unsub = onSnapshot(q, (snapshot) => {
      const allNotifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification));
      setNotifications(allNotifs.filter(n => !n.userId || n.userId === user?.uid));
      setLoading(false);
    });
    
    return () => unsub();
  }, []);

  const requestPermission = async () => {
    if (!("Notification" in window)) {
      alert("Este navegador não suporta notificações de desktop.");
      return;
    }

    if (window.self !== window.top) {
      alert("Navegadores bloqueiam o pedido de notificações dentro de painéis embutidos. Por favor, abra o aplicativo em uma NOVA GUIA (ícone no canto superior direito) para ativar as notificações.");
      return;
    }

    if (Notification.permission === 'denied') {
      alert("Você bloqueou as notificações anteriormente. Por favor, clique no cadeado na barra de endereços do seu navegador (URL) e permita as notificações manualmente.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermStatus(permission);
      if (permission === 'denied') {
        alert("Permissão negada. Você precisará alterar isso nas configurações do seu navegador se quiser receber alertas nativos.");
      } else if (permission === 'granted') {
        alert("Notificações ativadas com sucesso!");
      }
    } catch (e) {
      console.warn("Failed to request permission", e);
      alert("Houve um erro ao tentar ativar as notificações.");
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between sticky top-0 bg-white dark:bg-zinc-900 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Bell className="w-5 h-5 text-amber-600 dark:text-amber-500" />
          </div>
          <div>
            <h2 className="font-bold text-zinc-900 dark:text-zinc-100">Notificações</h2>
            <p className="text-xs text-amber-600 dark:text-amber-500 font-medium">Avisos e Atualizações</p>
          </div>
        </div>
        {user?.isAdmin ? (
          <button onClick={() => navigate('/support#broadcast')} className="px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5" /> Broadcast
          </button>
        ) : permStatus !== 'granted' && (
          <button onClick={requestPermission} className="px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-1.5">
            <BellRing className="w-3.5 h-3.5" /> Ativar
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800/50 rounded-full flex items-center justify-center mb-4">
              <Bell className="w-6 h-6 text-zinc-400 dark:text-zinc-500" />
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 font-medium">Você não tem notificações</p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {notifications.map(notif => (
              <div key={notif.id} className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{notif.title}</h3>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap ml-2 bg-zinc-200/50 dark:bg-zinc-700/50 px-2 py-1 rounded-full">
                    {format(notif.createdAt, 'dd/MM HH:mm')}
                  </span>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap">{notif.message}</p>
                {notif.type === 'follow' && notif.followerId && (
                  !followingMap[notif.followerId] ? (
                    <div className="mt-3">
                      <button 
                        onClick={() => handleFollowBack(notif.followerId!)}
                        className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                      >
                        Seguir de volta
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <span className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-xs font-bold rounded-lg flex items-center gap-1.5 w-max">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Seguindo
                      </span>
                    </div>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
