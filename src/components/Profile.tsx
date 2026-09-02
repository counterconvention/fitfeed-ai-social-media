import { getProxiedImageUrl } from '../lib/utils';
import { useState, useEffect } from 'react';
import { User, Post } from '../types';
import { doc, updateDoc, collection, query, where, getDocs, writeBatch, deleteDoc, increment, setDoc } from 'firebase/firestore';
import { db, logout, linkGoogleAccountFromGuest, auth } from '../lib/firebase';
import { toggleFollowTx } from '../lib/follow';
import { getLevelProgress } from '../lib/xp';
import { Award } from 'lucide-react';
import { Moon, Sun, LogOut, Bookmark, Loader2, Edit2, Link as LinkIcon, CheckCircle2, ShieldAlert, Users, ChevronLeft } from 'lucide-react';
import PostCard from './PostCard';
import { PostCardSkeleton, UserListSkeleton } from './Skeletons';
import SwipeableUserItem from './SwipeableUserItem';

const AVATARS = [
  'https://api.dicebear.com/9.x/fun-emoji/svg?seed=Felix',
  'https://api.dicebear.com/9.x/fun-emoji/svg?seed=Luna',
  'https://api.dicebear.com/9.x/fun-emoji/svg?seed=Jack',
  'https://api.dicebear.com/9.x/fun-emoji/svg?seed=Bella',
  'https://api.dicebear.com/9.x/fun-emoji/svg?seed=Max'
];

export default function Profile({ user, setUser }: { user: User, setUser: (u: User) => void }) {
  useEffect(() => {
    document.title = 'FitFeed - Perfil';
  }, []);

  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(user.username);
  const [avatar, setAvatar] = useState(user.avatar);
  const [saving, setSaving] = useState(false);
  
  const [linking, setLinking] = useState(false);
  const [linkSuccess, setLinkSuccess] = useState(false);

  const [activeTab, setActiveTab] = useState<"following" | "saved" | "followers_list" | "following_list">("following");
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loadingUsersList, setLoadingUsersList] = useState(false);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [loadingSavedPosts, setLoadingSavedPosts] = useState(true);
  
  const [followingPosts, setFollowingPosts] = useState<Post[]>([]);
  const [loadingFollowingPosts, setLoadingFollowingPosts] = useState(true);

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  
  const handleRemoveFollow = async (targetUserId: string) => {
    try {
      if (activeTab === 'followers_list') {
        // Remover alguém que me segue (eu sou o followed, target é follower)
        const success = await toggleFollowTx(targetUserId, user.uid, '', false);
        if (success) {
           setUsersList(usersList.filter(u => u.uid !== targetUserId));
        }
      } else if (activeTab === 'following_list') {
        // Deixar de seguir alguém (eu sou o follower, target é followed)
        const success = await toggleFollowTx(user.uid, targetUserId, '', false);
        if (success) {
           setUsersList(usersList.filter(u => u.uid !== targetUserId));
        }
      }
    } catch (err) {
      console.warn("Error modifying follow:", err);
    }
  };

  const toggleTheme = () => {
    const nextTheme = !isDark;
    setIsDark(nextTheme);
    if (nextTheme) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  useEffect(() => {
    const fetchSavedPosts = async () => {
      try {
        const savesQuery = query(collection(db, 'saves'), where('userId', '==', user.uid));
        const savesSnap = await getDocs(savesQuery);
        
        const postIds = savesSnap.docs.map(d => d.data().postId);
        
        if (postIds.length > 0) {
          const chunk = postIds.slice(0, 10);
          const postsQuery = query(collection(db, 'posts'), where('__name__', 'in', chunk));
          const postsSnap = await getDocs(postsQuery);
          
          setSavedPosts(postsSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Post))
            .filter(p => !p.isDeleted));
        }
      } catch (err) {
        console.warn(err);
      } finally {
        setLoadingSavedPosts(false);
      }
    };

    const fetchFollowingPosts = async () => {
      try {
        setLoadingFollowingPosts(true);
        const followsQuery = query(collection(db, 'follows'), where('followerId', '==', user.uid));
        const followsSnap = await getDocs(followsQuery);
        
        const followedIds = followsSnap.docs.map(d => d.data().followedId);
        
        if (followedIds.length > 0) {
          const chunk = followedIds.slice(0, 10);
          const postsQuery = query(collection(db, 'posts'), where('authorId', 'in', chunk));
          const postsSnap = await getDocs(postsQuery);
          
          const posts = postsSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Post))
            .filter(p => !p.isDeleted);
          posts.sort((a, b) => b.createdAt - a.createdAt);
          setFollowingPosts(posts);
        } else {
          setFollowingPosts([]);
        }
      } catch (err) {
        console.warn(err);
      } finally {
        setLoadingFollowingPosts(false);
      }
    };
    
    
    const fetchUsersList = async () => {
      setLoadingUsersList(true);
      try {
        let userIds: string[] = [];
        if (activeTab === 'followers_list') {
          const q = query(collection(db, 'follows'), where('followedId', '==', user.uid));
          const snap = await getDocs(q);
          userIds = snap.docs.map(d => d.data().followerId);
        } else if (activeTab === 'following_list') {
          const q = query(collection(db, 'follows'), where('followerId', '==', user.uid));
          const snap = await getDocs(q);
          userIds = snap.docs.map(d => d.data().followedId);
        }
        
        if (userIds.length > 0) {
          const users: User[] = [];
          for (let i = 0; i < userIds.length; i += 10) {
            const chunk = userIds.slice(i, i + 10);
            const userQ = query(collection(db, 'users'), where('__name__', 'in', chunk));
            const userSnap = await getDocs(userQ);
            userSnap.docs.forEach(d => users.push({ uid: d.id, ...d.data() } as User));
          }
          setUsersList(users);
        } else {
          setUsersList([]);
        }
      } catch (err) {
        console.warn(err);
      } finally {
        setLoadingUsersList(false);
      }
    };

    if (!editing) {
      if (activeTab === 'saved') {
        fetchSavedPosts();
      } else if (activeTab === 'following') {
        fetchFollowingPosts();
      } else if (activeTab === 'followers_list' || activeTab === 'following_list') {
        fetchUsersList();
      }
    }

  }, [user.uid, editing, activeTab]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const batch = writeBatch(db);
      
      batch.update(doc(db, 'users', user.uid), {
        username,
        avatar
      });

      const postsQuery = query(collection(db, 'posts'), where('authorId', '==', user.uid));
      const postsSnap = await getDocs(postsQuery);
      postsSnap.docs.forEach(d => {
        batch.update(d.ref, { authorName: username, authorAvatar: avatar });
      });

      const commentsQuery = query(collection(db, 'comments'), where('authorId', '==', user.uid));
      const commentsSnap = await getDocs(commentsQuery);
      commentsSnap.docs.forEach(d => {
        batch.update(d.ref, { authorName: username, authorAvatar: avatar });
      });

      await batch.commit();

      setUser({ ...user, username, avatar });
      setEditing(false);
    } catch (error) {
      console.warn(error);
      alert('Erro ao atualizar perfil.');
    } finally {
      setSaving(false);
    }
  };

  const handleLinkGoogle = async () => {
    if (linking) return;
    setLinking(true);
    try {
      const updatedUser = await linkGoogleAccountFromGuest(user);
      setUser({
        ...user,
        email: updatedUser.email || undefined,
        isAnonymous: false
      });
      setLinkSuccess(true);
      window.location.reload();
    } catch (error: any) {
      console.warn(error);
      alert(error.message || 'Erro ao vincular conta do Google.');
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 flex-1 flex flex-col text-zinc-900 dark:text-zinc-100 overflow-y-auto">
      <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-col items-center relative">
        
        {!editing && (
          <div className="absolute top-6 right-6 flex items-center gap-2">
            <button 
              onClick={toggleTheme}
              className="p-2 text-zinc-400 dark:text-zinc-500 hover:text-green-600 dark:hover:text-green-400 transition-colors"
              title="Mudar Tema"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            
            <button 
              onClick={async () => {
                await logout();
                window.location.href = '/login';
              }}
              className="p-2 text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        )}

        {editing ? (
          <div className="w-full flex flex-col items-center">
            <div className="flex gap-3 mb-6 overflow-x-auto w-full py-2 justify-center">
              {user.isAdmin ? (
                <img referrerPolicy="no-referrer" 
                  src={getProxiedImageUrl(avatar)} 
                  className="w-14 h-14 rounded-full border-2 border-green-500 scale-110 shrink-0"
                  title="A foto do administrador é fixa."
                />
              ) : (() => {
                const googlePhoto = auth.currentUser?.photoURL;
                const displayAvatars = [...AVATARS];
                if (googlePhoto && !displayAvatars.includes(googlePhoto)) {
                  displayAvatars.unshift(googlePhoto);
                }
                return displayAvatars.map((url, i) => (
                  <img referrerPolicy="no-referrer" 
                    key={i} 
                    src={getProxiedImageUrl(url)} 
                    onClick={() => setAvatar(url)}
                    className={`w-14 h-14 rounded-full cursor-pointer border-2 transition-all shrink-0 ${avatar === url ? 'border-green-500 scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`}
                  />
                ));
              })()}
            </div>
            
            <input 
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 w-full max-w-xs text-center font-semibold mb-4 focus:outline-none focus:border-green-500 dark:focus:border-green-500 text-zinc-900 dark:text-zinc-100"
            />
            
            <button 
              onClick={handleSaveProfile}
              disabled={saving}
              className="bg-green-600 text-white px-6 py-2 rounded-xl font-medium hover:bg-green-700 dark:hover:bg-green-500 transition-colors flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Perfil'}
            </button>
          </div>
        ) : (
          <>
            <div className="relative mb-3">
              <img referrerPolicy="no-referrer" src={getProxiedImageUrl(user.avatar)} className="w-24 h-24 rounded-full border-4 border-white dark:border-zinc-800 shadow-lg" />
              <button 
                onClick={() => setEditing(true)}
                className="absolute bottom-0 right-0 bg-white dark:bg-zinc-800 p-1.5 rounded-full shadow-md text-zinc-600 dark:text-zinc-300 border border-zinc-100 dark:border-zinc-700 hover:text-green-600 dark:hover:text-green-400"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>

            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{user.username}</h2>
            {user.email && <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{user.email}</p>}

            {/* Account type badge & Google Linking */}
            {user.isAnonymous ? (
              <div className="mt-3 w-full max-w-xs bg-amber-50 border border-amber-200 rounded-2xl p-3 flex flex-col items-center">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 mb-1">
                  <ShieldAlert className="w-4 h-4 text-amber-600" /> Conta Temporária
                </div>
                <p className="text-[11px] text-amber-700 text-center mb-2.5">
                  Vincule uma conta Google para nunca perder suas postagens e itens salvos.
                </p>
                <button
                  onClick={handleLinkGoogle}
                  disabled={linking}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors disabled:opacity-70"
                >
                  {linking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LinkIcon className="w-3.5 h-3.5" />}
                  Vincular Conta Google
                </button>
              </div>
            ) : linkSuccess && (
              <div className="mt-2 text-xs text-green-700 flex items-center gap-1 font-medium bg-green-50 px-3 py-1 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5" /> Conta integrada com sucesso!
              </div>
            )}

            
            <div className="flex gap-6 mt-4">
              <div className="text-center cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setActiveTab('following_list')}>
                <p className="font-bold text-zinc-900 dark:text-zinc-100">{Math.max(0, user.followingCount || 0)}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Seguindo</p>
              </div>
              <div className="text-center cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setActiveTab('followers_list')}>
                <p className="font-bold text-zinc-900 dark:text-zinc-100">{Math.max(0, user.followerCount || 0)}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Seguidores</p>
              </div>
            </div>
          
          </>
        )}
      </div>

      {!editing && (
        <div className="flex flex-col flex-1">
          
          {activeTab === 'followers_list' || activeTab === 'following_list' ? (
            <div className="flex items-center gap-3 bg-zinc-50/80 dark:bg-zinc-900/80 border-b border-zinc-100 dark:border-zinc-800 px-4 py-3">
              <button onClick={() => setActiveTab('following')} className="p-1 -ml-1 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                {activeTab === 'followers_list' ? 'Seguidores' : 'Seguindo'}
              </h3>
            </div>
          ) : (
            <div className="flex bg-zinc-50/80 dark:bg-zinc-900/80 border-b border-zinc-100 dark:border-zinc-800">
              <button
                onClick={() => setActiveTab('following')}
                className={`flex-1 flex justify-center items-center gap-2 py-3.5 text-sm font-semibold transition-colors ${
                  activeTab === 'following' 
                    ? 'text-green-600 dark:text-green-400 border-b-2 border-green-600 dark:border-green-400 bg-green-50/30 dark:bg-green-900/20' 
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <Users className="w-4 h-4" />
                Seguindo
              </button>
              <button
                onClick={() => setActiveTab('saved')}
                className={`flex-1 flex justify-center items-center gap-2 py-3.5 text-sm font-semibold transition-colors ${
                  activeTab === 'saved' 
                    ? 'text-green-600 dark:text-green-400 border-b-2 border-green-600 dark:border-green-400 bg-green-50/30 dark:bg-green-900/20' 
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <Bookmark className="w-4 h-4" />
                Salvos
              </button>
            </div>
          )}

          
          <div className="bg-zinc-50 dark:bg-zinc-950 flex-1">
            
            {activeTab === 'followers_list' || activeTab === 'following_list' ? (
              loadingUsersList ? (
                <UserListSkeleton />
              ) : usersList.length > 0 ? (
                <div className="pb-8 flex flex-col">
                  {usersList.map(u => (
                    <SwipeableUserItem key={u.uid} user={u} type={activeTab as 'followers_list' | 'following_list'} onRemove={handleRemoveFollow} />
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center flex flex-col items-center">
                  <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                    <Users className="w-6 h-6 text-zinc-400 dark:text-zinc-500" />
                  </div>
                  <h3 className="text-zinc-900 dark:text-zinc-100 font-semibold mb-1">
                    {activeTab === 'followers_list' ? 'Nenhum seguidor ainda' : 'Nenhuma conta sendo seguida'}
                  </h3>
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                    {activeTab === 'followers_list' ? 'Quando alguém seguir você, aparecerá aqui.' : 'Descubra criadores no feed para seguir.'}
                  </p>
                </div>
              )
            ) : activeTab === 'saved' ? (

              loadingSavedPosts ? (
                <>
                  <PostCardSkeleton />
                  <PostCardSkeleton />
                  <PostCardSkeleton />
                </>
              ) : savedPosts.length > 0 ? (
                <div className="pb-8">
                  {savedPosts.map(post => <PostCard key={post.id} post={post} user={user} />)}
                </div>
              ) : (
                <div className="p-12 text-center flex flex-col items-center">
                  <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                    <Bookmark className="w-6 h-6 text-zinc-400 dark:text-zinc-500" />
                  </div>
                  <h3 className="text-zinc-900 dark:text-zinc-100 font-semibold mb-1">
                    Nenhum post salvo
                  </h3>
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                    Os posts que você salvar aparecerão aqui.
                  </p>
                </div>
              )
            ) : (
              loadingFollowingPosts ? (
                <>
                  <PostCardSkeleton />
                  <PostCardSkeleton />
                  <PostCardSkeleton />
                </>
              ) : followingPosts.length > 0 ? (
                <div className="pb-8">
                  {followingPosts.map(post => <PostCard key={post.id} post={post} user={user} />)}
                </div>
              ) : (
                <div className="p-12 text-center flex flex-col items-center">
                  <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                    <Users className="w-6 h-6 text-zinc-400 dark:text-zinc-500" />
                  </div>
                  <h3 className="text-zinc-900 dark:text-zinc-100 font-semibold mb-1">
                    Feed vazio
                  </h3>
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                    Você ainda não está seguindo ninguém.<br/>Descubra criadores para ver posts aqui.
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
