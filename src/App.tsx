/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, getGuestUser } from './lib/firebase';
import { doc, getDoc, collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { User, AppNotification } from './types';
import { Loader2, Home, Search, PlusSquare, User as UserIcon, Bot, Settings, Headset, Bell, Activity, Apple } from 'lucide-react';
import Feed from './components/Feed';
import AdminFeed from './components/AdminFeed';
import CreatePost from './components/CreatePost';
import Profile from './components/Profile';
import NutritionTracker from './components/NutritionTracker';
import AuthScreen from './components/AuthScreen';
import AIAssistant from './components/AIAssistant';
import Support from './components/Support';
import Notifications from './components/Notifications';
import LandingPage from './components/LandingPage';
import { AnimatePresence, motion } from 'motion/react';
import { GlobalLoadingProvider } from './components/GlobalLoading';

function AnimatedRoutes({ user, handleSetUser }: { user: User, handleSetUser: (u: User | null) => void }) {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/feed" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="h-full flex flex-col"><Feed user={user} /></motion.div>} />
        <Route path="/admin" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="h-full flex flex-col"><AdminFeed user={user} /></motion.div>} />
        <Route path="/create" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="h-full flex flex-col"><CreatePost user={user} /></motion.div>} />
        <Route path="/profile" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="h-full flex flex-col"><Profile user={user} setUser={handleSetUser} /></motion.div>} />
        <Route path="/tracker" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="h-full flex flex-col"><NutritionTracker user={user} /></motion.div>} />
        <Route path="/ai" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="h-full flex flex-col"><AIAssistant user={user} /></motion.div>} />
        <Route path="/support" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="h-full flex flex-col"><Support user={user} /></motion.div>} />
        <Route path="/notifications" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="h-full flex flex-col"><Notifications user={user} /></motion.div>} />
        <Route path="*" element={<Navigate to="/feed" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const handleSetUser = (u: User | null) => {
    if (u && u.isAdmin) {
      u.avatar = 'https://i.redd.it/uyaiqogaqg761.jpg';
    }
    setUser(u);
  };

  useEffect(() => {
    if (!user) return;
    
    let isInitialLoad = true;
    const q = query(
      collection(db, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    
    const unsub = onSnapshot(q, (snapshot) => {
      if (isInitialLoad) {
        isInitialLoad = false;
        return;
      }
      
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const notif = change.doc.data() as AppNotification;
          if (notif.isPush && "Notification" in window && Notification.permission === 'granted') {
            try {
              new Notification(notif.title, {
                body: notif.message,
                icon: '/icon.png'
              });
            } catch (error: any) {
              if (error.name === 'TypeError' && 'serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(registration => {
                  registration.showNotification(notif.title, {
                    body: notif.message,
                    icon: '/icon.png'
                  });
                }).catch(() => {});
              }
            }
          }
        }
      });
    });
    
    const userUnsub = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const freshData = docSnap.data() as User;
        if (freshData.followerCount !== user.followerCount || freshData.followingCount !== user.followingCount || freshData.username !== user.username || freshData.avatar !== user.avatar) {
           setUser(prev => prev ? { ...prev, ...freshData, uid: prev.uid } : null);
        }
      }
    });

    return () => {
      unsub();
      userUnsub();
    };
  }, [user]);

  useEffect(() => {
    // Initialize Theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Check for local guest user first
    const guest = getGuestUser();
    if (guest) {
      getDoc(doc(db, 'users', guest.uid)).then(docSnap => {
        if (docSnap.exists()) {
          const freshData = docSnap.data();
          handleSetUser({ ...guest, ...freshData } as User);
        } else {
          handleSetUser(guest);
        }
      }).catch(err => {
        console.warn("Could not fetch latest guest data, using local", err);
        handleSetUser(guest);
      }).finally(() => {
        setLoading(false);
      });
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            handleSetUser({ uid: firebaseUser.uid, ...userDoc.data() } as User);
          } else {
            // Fallback if document creation is slow
            handleSetUser({
              uid: firebaseUser.uid,
              username: firebaseUser.displayName || 'Novo Usuário',
              avatar: firebaseUser.photoURL || `https://api.dicebear.com/9.x/fun-emoji/svg?seed=${firebaseUser.uid}`,
              followerCount: 0,
              followingCount: 0,
              createdAt: Date.now(),
            });
          }
        } catch (error) {
          console.warn("Firestore user fetch offline/error, falling back to auth user info", error);
          handleSetUser({
            uid: firebaseUser.uid,
            username: firebaseUser.displayName || 'Novo Usuário',
            avatar: firebaseUser.photoURL || `https://api.dicebear.com/9.x/fun-emoji/svg?seed=${firebaseUser.uid}`,
            followerCount: 0,
            followingCount: 0,
            createdAt: Date.now(),
          });
        }
      } else {
        handleSetUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <GlobalLoadingProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          loading ? (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
              <Loader2 className="w-8 h-8 animate-spin text-green-600 dark:text-green-500" />
            </div>
          ) : user ? <Navigate to="/feed" replace /> : <Navigate to="/landingpage" replace />
        } />
        
        <Route path="/landingpage" element={
          loading ? (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
              <Loader2 className="w-8 h-8 animate-spin text-green-600 dark:text-green-500" />
            </div>
          ) : user ? <Navigate to="/feed" replace /> : <LandingPage />
        } />
        
        <Route path="/login" element={
          loading ? (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
              <Loader2 className="w-8 h-8 animate-spin text-green-600 dark:text-green-500" />
            </div>
          ) : user ? <Navigate to="/feed" replace /> : <AuthScreen />
        } />

        <Route path="/*" element={
          loading ? (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
              <Loader2 className="w-8 h-8 animate-spin text-green-600 dark:text-green-500" />
            </div>
          ) : !user ? (
            <Navigate to="/login" replace />
          ) : (
            <div className="h-[100dvh] bg-zinc-50 dark:bg-zinc-950 flex justify-center text-zinc-900 dark:text-zinc-100 overflow-hidden">
              <div className="w-full max-w-md bg-white dark:bg-zinc-900 h-full flex flex-col shadow-xl relative overflow-hidden">
                <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 shrink-0 flex items-center justify-between z-10">
                  <button onClick={() => window.location.reload()} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                    <Activity className="w-6 h-6 text-green-600 dark:text-green-500" strokeWidth={3} />
                    <h1 className="text-xl font-black text-green-600 dark:text-green-500 tracking-tight">FitFeed</h1>
                  </button>
                  <div className="flex items-center gap-2">
                    <Link to="/notifications" className="p-2 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors">
                      <Bell className="w-5 h-5" />
                    </Link>
                    <Link to="/support" className="p-2 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
                      <Headset className="w-5 h-5" />
                    </Link>
                    <Link to="/ai" className="p-2 rounded-full bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors">
                      <Bot className="w-5 h-5" />
                    </Link>
                  </div>
                </header>
                
                <main className="flex-1 relative flex flex-col min-h-0">
                  <AnimatedRoutes user={user} handleSetUser={handleSetUser} />
                </main>
                
                <nav className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 w-full shrink-0 flex justify-around p-3 z-20">
                  <Link to="/feed" className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-green-600 dark:hover:text-green-400 flex flex-col items-center">
                    <Home className="w-6 h-6" />
                  </Link>
                  {user.isAdmin && (
                    <Link to="/admin" className="p-2 text-amber-500 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-500 flex flex-col items-center">
                      <Settings className="w-6 h-6" />
                    </Link>
                  )}
                  <Link to="/tracker" className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-green-600 dark:hover:text-green-400 flex flex-col items-center">
                    <Apple className="w-6 h-6" />
                  </Link>
                  <Link to="/create" className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-green-600 dark:hover:text-green-400 flex flex-col items-center">
                    <PlusSquare className="w-6 h-6" />
                  </Link>
                  <Link to="/profile" className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-green-600 dark:hover:text-green-400 flex flex-col items-center">
                    <UserIcon className="w-6 h-6" />
                  </Link>
                </nav>
              </div>
            </div>
          )
        } />
      </Routes>
    </BrowserRouter>
    </GlobalLoadingProvider>
  );
}

