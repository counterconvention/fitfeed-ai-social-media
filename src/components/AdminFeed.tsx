import { useEffect, useState, useRef, useCallback } from 'react';
import { collection, collectionGroup, query, orderBy, limit, onSnapshot, getDocs, startAfter, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, Post, Comment } from '../types';
import PostCard from './PostCard';
import CommentItem from './CommentItem';
import { Loader2, Filter, Trash2 } from 'lucide-react';

const FILTERS = [
  { id: 'todos', label: 'Tudo' },
  { id: 'excluidos', label: 'Postagens' },
  { id: 'comentarios', label: 'Comentários' }
];

type AdminFeedItem = 
  | { id: string; type: 'post'; data: Post; createdAt: number }
  | { id: string; type: 'comment'; data: Comment; createdAt: number };

export default function AdminFeed({ user }: { user: User }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingComments, setLoadingComments] = useState(true);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [activeFilter, setActiveFilter] = useState('todos');

  // Initial load
  useEffect(() => {
    setLoadingPosts(true);
    setLoadingComments(true);
    setHasMore(true);
    setLastVisible(null);
    
    const unsubscribes: (() => void)[] = [];

    // Comments subscription (used for 'todos' and 'comentarios')
    if (activeFilter === 'todos' || activeFilter === 'comentarios') {
      const qComments = query(collectionGroup(db, 'comments'), orderBy('createdAt', 'desc'), limit(50));
      const unsubComments = onSnapshot(qComments, (snapshot) => {
        const snapshotRaw = snapshot.docs.map(doc => ({
          id: doc.id,
          postId: doc.data().postId || doc.ref.parent?.parent?.id || '',
          ...doc.data()
        } as Comment));
        setComments(snapshotRaw.filter(c => c.isDeleted));
        setLoadingComments(false);
      }, (error) => {
        console.warn("Error fetching comments:", error);
        setLoadingComments(false);
      });
      unsubscribes.push(unsubComments);
    } else {
      setComments([]);
      setLoadingComments(false);
    }

    // Posts subscription (used for 'todos' and 'excluidos')
    if (activeFilter === 'todos' || activeFilter === 'excluidos') {
      const qPosts = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(50));
      const unsubPosts = onSnapshot(qPosts, (snapshot) => {
        const snapshotRaw = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
        
        setPosts(prev => {
          if (prev.length === 0) {
            return snapshotRaw.filter(p => activeFilter === 'excluidos' ? p.isDeleted : true);
          }
          const prevMap = new Map(prev.map(p => [p.id, p]));
          snapshotRaw.forEach(p => {
            const shouldShow = activeFilter === 'excluidos' ? p.isDeleted : true;
            if (!shouldShow) prevMap.delete(p.id);
            else prevMap.set(p.id, p);
          });
          return Array.from(prevMap.values()).sort((a, b) => b.createdAt - a.createdAt);
        });

        if (snapshot.docs.length > 0 && snapshot.docs.length === 50) {
          setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
          setHasMore(true);
        } else {
          setHasMore(false);
        }
        setLoadingPosts(false);
      }, (error) => {
        console.warn("Error fetching feed from Firestore:", error);
        setLoadingPosts(false);
      });
      unsubscribes.push(unsubPosts);
    } else {
      setPosts([]);
      setLoadingPosts(false);
    }

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [activeFilter]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !lastVisible) return;
    setLoadingMore(true);

    try {
      if (activeFilter === 'comentarios') {
        const q = query(
          collectionGroup(db, 'comments'), 
          orderBy('createdAt', 'desc'), 
          startAfter(lastVisible), 
          limit(20)
        );
        const snapshot = await getDocs(q);
        
        if (snapshot.docs.length === 0) {
          setHasMore(false);
        } else {
          const newComments = snapshot.docs
            .map(doc => ({
              id: doc.id,
              postId: doc.data().postId || doc.ref.parent?.parent?.id || '',
              ...doc.data()
            } as Comment))
            .filter(c => c.isDeleted);
          
          setComments(prev => {
            const existingIds = new Set(prev.map(c => c.id));
            return [...prev, ...newComments.filter(c => !existingIds.has(c.id))];
          });
          setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
        }
      } else {
        const q = query(
          collection(db, 'posts'), 
          orderBy('createdAt', 'desc'), 
          startAfter(lastVisible), 
          limit(10)
        );
        const snapshot = await getDocs(q);
        
        if (snapshot.docs.length === 0) {
          setHasMore(false);
        } else {
          const newPosts = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Post))
            .filter(p => activeFilter === 'excluidos' ? p.isDeleted : true);
          setPosts(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            return [...prev, ...newPosts.filter(p => !existingIds.has(p.id))];
          });
          setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
        }
      }
    } catch (error) {
      console.warn("Error loading more items:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, lastVisible, activeFilter]);

  // Observer for infinite scroll
  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback((node: HTMLDivElement | null) => {
    const isLoading = activeFilter === 'todos' ? (loadingPosts || loadingComments) : (activeFilter === 'comentarios' ? loadingComments : loadingPosts);
    if (isLoading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMore();
      }
    });
    if (node) observer.current.observe(node);
  }, [loadingPosts, loadingComments, loadingMore, hasMore, loadMore, activeFilter]);

  const isLoading = activeFilter === 'todos' ? (loadingPosts && loadingComments) : (activeFilter === 'comentarios' ? loadingComments : loadingPosts);

  // Merge items for the "Tudo" tab
  const mergedItems: AdminFeedItem[] = [
    ...posts.map(p => ({ id: `post_${p.id}`, type: 'post' as const, data: p, createdAt: p.createdAt })),
    ...comments.filter(c => c.isDeleted).map(c => ({ id: `comment_${c.id}`, type: 'comment' as const, data: c, createdAt: c.createdAt }))
  ].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="pb-8 overflow-y-auto flex-1 h-full">
      {/* Filters */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10">
        <div className="flex gap-1.5 overflow-x-auto px-3 py-2.5 hide-scrollbar items-center">
          <Filter className="w-4 h-4 text-zinc-400 dark:text-zinc-500 flex-shrink-0 mr-1" />
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => {
                setActiveFilter(f.id);
                setPosts([]);
                setComments([]);
              }}
              className={`px-3 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors border ${
                activeFilter === f.id 
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100' 
                  : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-green-600 dark:text-green-500" /></div>
      ) : (
        <>
          {/* Tudo tab (merged Posts and Deleted Comments) */}
          {activeFilter === 'todos' && (
            <div>
              {mergedItems.map((item, index) => (
                <div ref={mergedItems.length === index + 1 ? lastElementRef : null} key={item.id}>
                  {item.type === 'post' ? (
                    <PostCard post={item.data} user={user} />
                  ) : (
                    <div className="p-4 mx-3 my-3 bg-white dark:bg-zinc-800/90 rounded-2xl shadow-sm border border-red-200 dark:border-red-900/30">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center gap-1">
                          <Trash2 className="w-3.5 h-3.5" /> Comentário Excluído
                        </span>
                        <span className="text-[10px] text-zinc-400">{new Date(item.data.createdAt).toLocaleDateString()}</span>
                      </div>
                      <CommentItem comment={item.data} user={user} postId={item.data.postId} isAdminView={true} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Postagens tab */}
          {activeFilter === 'excluidos' && posts.map((post, index) => (
            <div ref={posts.length === index + 1 ? lastElementRef : null} key={post.id}>
              <PostCard post={post} user={user} />
            </div>
          ))}

          {/* Comentários tab */}
          {activeFilter === 'comentarios' && (
            <div className="p-4 space-y-4">
               {comments.map((comment, index) => (
                 <div ref={comments.length === index + 1 ? lastElementRef : null} key={comment.id} className="bg-white dark:bg-zinc-800 p-4 rounded-2xl shadow-sm border border-red-200 dark:border-red-900/30">
                    <div className="flex justify-between items-center mb-2">
                       <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center gap-1">
                         <Trash2 className="w-3.5 h-3.5" /> Comentário Excluído
                       </span>
                       <span className="text-[10px] text-zinc-400">{new Date(comment.createdAt).toLocaleDateString()}</span>
                    </div>
                    <CommentItem comment={comment} user={user} postId={comment.postId} isAdminView={true} />
                 </div>
               ))}
            </div>
          )}
          
          {loadingMore && (
            <div className="p-4 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-green-600 dark:text-green-500" />
            </div>
          )}
          
          {!hasMore && (
            (activeFilter === 'todos' && mergedItems.length > 0) ||
            (activeFilter === 'excluidos' && posts.length > 0) ||
            (activeFilter === 'comentarios' && comments.length > 0)
          ) && (
            <div className="p-8 text-center text-zinc-500 dark:text-zinc-400 text-sm">
              Você viu todos os itens!
            </div>
          )}

          {(
            (activeFilter === 'todos' && mergedItems.length === 0) ||
            (activeFilter === 'excluidos' && posts.length === 0) ||
            (activeFilter === 'comentarios' && comments.length === 0)
          ) && !isLoading && (
            <div className="p-12 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                <Filter className="w-6 h-6 text-zinc-400 dark:text-zinc-500" />
              </div>
              <h3 className="text-zinc-900 dark:text-zinc-100 font-semibold mb-1">Nenhum item encontrado</h3>
            </div>
          )}
        </>
      )}
    </div>
  );
}
