import { useEffect, useState, useRef, useCallback } from 'react';
import { collection, query, orderBy, limit, onSnapshot, getDocs, startAfter, DocumentData, QueryDocumentSnapshot, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, Post } from '../types';
import PostCard from './PostCard';
import { PostCardSkeleton } from './Skeletons';
import { Loader2, Filter, RefreshCcw, ArrowUp } from 'lucide-react';

const FILTERS = [
  { id: 'todos', label: 'Tudo' },
  { id: 'receita', label: 'Receitas' },
  { id: 'noticia', label: 'Notícias' },
  { id: 'dica', label: 'Dicas' },
];

export default function Feed({ user }: { user: User }) {
  useEffect(() => {
    document.title = 'FitFeed - Página Inicial';
  }, []);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [activeFilter, setActiveFilter] = useState('todos');

  // Pull to refresh state
  const [refreshing, setRefreshing] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const [pullUpProgress, setPullUpProgress] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{y: number, edge: 'top' | 'bottom' | 'none'}>({y: 0, edge: 'none'});

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    
    if (scrollTop <= 0) {
      touchStartRef.current = { y: e.touches[0].clientY, edge: 'top' };
    } else if (scrollHeight - scrollTop - clientHeight <= 1) {
      touchStartRef.current = { y: e.touches[0].clientY, edge: 'bottom' };
    } else {
      touchStartRef.current = { y: 0, edge: 'none' };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartRef.current.edge === 'none' || refreshing) return;
    
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartRef.current.y;
    
    if (touchStartRef.current.edge === 'top' && diff > 0) {
      // Pulling down from top
      const progress = Math.min(diff / 100, 1);
      setPullProgress(progress);
      setPullUpProgress(0);
    } else if (touchStartRef.current.edge === 'bottom' && diff < 0 && !hasMore) {
      // Pulling up from bottom when no more posts
      const progress = Math.min(Math.abs(diff) / 100, 1);
      setPullUpProgress(progress);
      setPullProgress(0);
    }
  };

  const handleTouchEnd = () => {
    if (pullProgress > 0.8 && !refreshing) {
      handleRefresh();
    } else if (pullUpProgress > 0.8 && !refreshing && !hasMore) {
      handleRefresh();
    } else {
      setPullProgress(0);
      setPullUpProgress(0);
    }
    touchStartRef.current = { y: 0, edge: 'none' };
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    if (pullProgress > 0) setPullProgress(1);
    if (pullUpProgress > 0) setPullUpProgress(1);
    
    // Simulate a brief delay for UI effect, then re-trigger snapshot
    setActiveFilter(prev => {
      // Trick to force effect re-run if it's the same filter
      return prev + ' '; 
    });
    
    setTimeout(() => {
      setActiveFilter(prev => prev.trim());
      setRefreshing(false);
      setPullProgress(0);
      setPullUpProgress(0);
    }, 800);
  };

  // Initial load
  useEffect(() => {
    setLoading(true);
    let q;
    
    if (activeFilter === 'todos') {
      q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(10));
    } else {
      // Without composite index, we query by category and sort locally.
      // Limiting to 50 for safety in category view without pagination.
      q = query(collection(db, 'posts'), where('category', '==', activeFilter), limit(50));
    }

        const unsubscribe = onSnapshot(q, (snapshot) => {
      const snapshotRaw = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      
      if (activeFilter !== 'todos') {
        const newPosts = snapshotRaw.filter(p => !p.isDeleted).sort((a, b) => b.createdAt - a.createdAt);
        setHasMore(false); // Disable infinite scroll for filtered views to avoid index complexity
        setPosts(newPosts);
        setLoading(false);
        return;
      }

      setPosts(prev => {
        if (prev.length === 0) {
          return snapshotRaw.filter(p => !p.isDeleted);
        }
        
        const prevMap = new Map(prev.map(p => [p.id, p]));
        
        snapshotRaw.forEach(p => {
          if (p.isDeleted) {
            prevMap.delete(p.id);
          } else {
            prevMap.set(p.id, p);
          }
        });
        
        return Array.from(prevMap.values()).sort((a, b) => b.createdAt - a.createdAt);
      });

      setPosts(prev => {
        if (prev.length <= 10 && snapshot.docs.length > 0) {
          setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
          setHasMore(snapshot.docs.length === 10);
        }
        return prev;
      });

      setLoading(false);
    }, (error) => {
      console.warn("Error fetching feed from Firestore:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeFilter]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !lastVisible || activeFilter !== 'todos') return;
    setLoadingMore(true);

    try {
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
          .filter(p => !p.isDeleted);
        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          return [...prev, ...newPosts.filter(p => !existingIds.has(p.id))];
        });
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      }
    } catch (error) {
      console.warn("Error loading more posts:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, lastVisible, activeFilter]);

  // Observer for infinite scroll
  const observer = useRef<IntersectionObserver | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const lastPostElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || loadingMore || activeFilter !== 'todos') return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMore();
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore, loadMore, activeFilter]);


  return (
    <div 
      ref={(node) => {
        scrollRef.current = node;
        feedRef.current = node;
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onScroll={(e) => setShowScrollTop((e.target as HTMLDivElement).scrollTop > 500)}
      className="pb-8 overflow-y-auto flex-1 h-full relative"
    >
      {/* Pull to refresh indicator */}
      <div 
        className="absolute w-full flex justify-center left-0 right-0 z-20 pointer-events-none transition-transform duration-200"
        style={{ 
          transform: `translateY(${pullProgress * 40 - 40}px)`,
          opacity: pullProgress
        }}
      >
        <div className="bg-white dark:bg-zinc-800 rounded-full p-2 shadow-md border border-zinc-100 dark:border-zinc-700 mt-2">
          <RefreshCcw className={`w-5 h-5 text-green-600 dark:text-green-500 ${refreshing ? 'animate-spin' : ''}`} style={{ transform: `rotate(${pullProgress * 180}deg)` }} />
        </div>
      </div>

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

      {loading ? (
        <>
          <PostCardSkeleton />
          <PostCardSkeleton />
          <PostCardSkeleton />
        </>
      ) : (
        <>
          {posts.map((post, index) => {
            if (posts.length === index + 1 && activeFilter === 'todos') {
              return (
                <div ref={lastPostElementRef} key={post.id}>
                  <PostCard post={post} user={user} />
                </div>
              );
            } else {
              return <PostCard key={post.id} post={post} user={user} />;
            }
          })}
          
          {loadingMore && (
            <div className="p-4 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-green-600 dark:text-green-500" />
            </div>
          )}
          
          {!hasMore && posts.length > 0 && activeFilter === 'todos' && (
            <div className="p-8 text-center text-zinc-500 dark:text-zinc-400 text-sm">
              Você viu todos os posts recentes!
            </div>
          )}

          {posts.length === 0 && !loading && (
            <div className="p-12 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                <Filter className="w-6 h-6 text-zinc-400 dark:text-zinc-500" />
              </div>
              <h3 className="text-zinc-900 dark:text-zinc-100 font-semibold mb-1">Nenhum post encontrado</h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                {activeFilter === 'todos' 
                  ? 'Seja o primeiro a compartilhar algo fitness!'
                  : `Ainda não há posts na categoria ${FILTERS.find(f => f.id === activeFilter)?.label}.`}
              </p>
            </div>
          )}

          {/* Pull up to refresh indicator */}
          <div 
            className="absolute w-full flex justify-center left-0 right-0 z-20 pointer-events-none transition-transform duration-200 bottom-0"
            style={{ 
              transform: `translateY(${pullUpProgress * -40 + 40}px)`,
              opacity: pullUpProgress
            }}
          >
            <div className="bg-white dark:bg-zinc-800 rounded-full p-2 shadow-md border border-zinc-100 dark:border-zinc-700 mb-2">
              <RefreshCcw className={`w-5 h-5 text-green-600 dark:text-green-500 ${refreshing ? 'animate-spin' : ''}`} style={{ transform: `rotate(${pullUpProgress * 180}deg)` }} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
