import { getProxiedImageUrl } from '../lib/utils';
import { useState, useEffect, useRef } from 'react';
import { User, Post, Comment } from '../types';
import CommentItem from './CommentItem';
import { Heart, MessageCircle, Bookmark, UserPlus, UserMinus, Loader2, Send, Trash2, RotateCcw, Share2 } from 'lucide-react';
import { doc, getDoc, setDoc, deleteDoc, runTransaction, updateDoc, increment, collection, query, orderBy, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toggleFollowTx } from '../lib/follow';
import { awardXP } from '../lib/xp';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';

const CATEGORY_STYLES: Record<string, { label: string, color: string, icon: string }> = {
  receita: { label: 'Receita', color: 'bg-orange-100 text-orange-700', icon: '🥗' },
  noticia: { label: 'Notícia', color: 'bg-purple-100 text-purple-700', icon: '📰' },
  dica: { label: 'Dica', color: 'bg-amber-100 text-amber-700', icon: '💡' },
};

export default function PostCard({ post, user }: { post: Post, user: User }) {
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likesCount || 0);
  const [followLoading, setFollowLoading] = useState(false);
  
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount || 0);

  useEffect(() => {
    const checkInteractions = async () => {
      const likeId = `${user.uid}_${post.id}`;
      const saveId = `${user.uid}_${post.id}`;
      const followId = `${user.uid}_${post.authorId}`;
      
      try {
        const [likeDoc, saveDoc, followDoc] = await Promise.all([
          getDoc(doc(db, 'likes', likeId)),
          getDoc(doc(db, 'saves', saveId)),
          getDoc(doc(db, 'follows', followId))
        ]);
        
        setIsLiked(likeDoc.exists());
        setIsSaved(saveDoc.exists());
        setIsFollowing(followDoc.exists());
      } catch (err) {
        console.warn(err);
      }
    };
    checkInteractions();
  }, [post.id, user.uid, post.authorId]);

  useEffect(() => {
    if (!showComments) return;
    
    const q = query(
      collection(db, 'posts', post.id, 'comments'),
      orderBy('createdAt', 'asc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedComments = snapshot.docs.map(doc => ({
        id: doc.id,
        postId: post.id,
        ...doc.data()
      } as Comment));
      setComments(fetchedComments);
      setCommentsCount(fetchedComments.filter(c => !c.isDeleted).length);
    });

    return () => unsubscribe();
  }, [post.id, showComments]);

  const toggleFollow = async () => {
    if (followLoading || user.uid === post.authorId) return;
    setFollowLoading(true);
    
    try {
      const actionWasFollow = !isFollowing;
      const success = await toggleFollowTx(user.uid, post.authorId, user.username, actionWasFollow);
      if (success) {
        setIsFollowing(actionWasFollow);
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setFollowLoading(false);
    }
  };

  
  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `FitFeed: ${post.title || 'Post'} por ${post.authorName}`,
          text: `Confira este post de ${post.authorName} no FitFeed:

${post.content.slice(0, 100)}...`,
          url: window.location.href,
        });
      } else {
        console.warn("O compartilhamento não é suportado neste navegador.");
      }
    } catch (err) {
      console.warn("Error sharing:", err);
    }
  };

  const toggleLike = async () => {
    const currentlyLiked = isLiked;
    setIsLiked(!currentlyLiked);
    setLikeCount(prev => currentlyLiked ? Math.max(0, prev - 1) : prev + 1);
    
    const likeId = `${user.uid}_${post.id}`;
    const likeRef = doc(db, 'likes', likeId);
    const postRef = doc(db, 'posts', post.id);

    try {
      await runTransaction(db, async (transaction) => {
        const postDoc = await transaction.get(postRef);
        if (!postDoc.exists()) throw "Post not found";
        
        const currentLikes = postDoc.data().likesCount || 0;

        if (currentlyLiked) {
          transaction.delete(likeRef);
          transaction.update(postRef, { likesCount: Math.max(0, currentLikes - 1) });
        } else {
          transaction.set(likeRef, { userId: user.uid, postId: post.id, createdAt: Date.now() });
          transaction.update(postRef, { likesCount: currentLikes + 1 });
        }
      });
    } catch (e) {
      console.warn(e);
      setIsLiked(currentlyLiked);
      setLikeCount(prev => currentlyLiked ? prev + 1 : Math.max(0, prev - 1));
    }
  };

  const toggleSave = async () => {
    const currentlySaved = isSaved;
    setIsSaved(!currentlySaved);
    
    const saveId = `${user.uid}_${post.id}`;
    const saveRef = doc(db, 'saves', saveId);

    try {
      if (currentlySaved) {
        await deleteDoc(saveRef);
      } else {
        await setDoc(saveRef, { userId: user.uid, postId: post.id, createdAt: Date.now() });
      }
    } catch (e) {
      console.warn(e);
      setIsSaved(currentlySaved);
    }
  };

  const submitComment = async () => {
    if (!newComment.trim() || submittingComment) return;
    setSubmittingComment(true);
    
    try {
      await addDoc(collection(db, 'posts', post.id, 'comments'), {
        postId: post.id,
        authorId: user.uid,
        authorName: user.username,
        authorAvatar: user.avatar,
        authorIsAdmin: user.isAdmin || false,
        content: newComment.trim(),
        createdAt: Date.now()
      });
      
      await updateDoc(doc(db, 'posts', post.id), {
        commentsCount: increment(1)
      });
      
      setNewComment('');
      await awardXP(user.uid, 10);
    } catch (e) {
      console.warn(e);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleSoftDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirmDelete) {
      handleSoftDelete();
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  const handleSoftDelete = async () => {
    try {
      await updateDoc(doc(db, 'posts', post.id), {
        isDeleted: !post.isDeleted
      });
    } catch (error) {
      console.warn("Erro ao alterar visibilidade do post", error);
    }
  };

  const catStyle = post.category ? CATEGORY_STYLES[post.category] : null;

  return (
    <div className={`bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 p-4 pt-5 transition-all hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 ${post.isDeleted ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <img referrerPolicy="no-referrer" src={getProxiedImageUrl(post.authorAvatar)} alt={post.authorName} className="w-10 h-10 rounded-full border border-zinc-200 dark:border-zinc-700" />
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`font-semibold leading-tight ${post.authorIsAdmin ? 'bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-500 bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse font-black' : 'text-zinc-900 dark:text-zinc-100'}`}>
                {post.authorName}
              </h3>
              {catStyle && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${catStyle.color}`}>
                  {catStyle.icon} {catStyle.label}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {formatDistanceToNow(post.createdAt, { addSuffix: true, locale: ptBR })}
            </p>
          </div>
        </div>
        
        {user.uid !== post.authorId && (
          <button 
            onClick={toggleFollow}
            disabled={followLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              isFollowing 
                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400' 
                : 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50'
            }`}
          >
            {followLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (
              isFollowing ? <><UserMinus className="w-3.5 h-3.5" /> Deixar de seguir</> : <><UserPlus className="w-3.5 h-3.5" /> Seguir</>
            )}
          </button>
        )}
      </div>
      
      {post.title && (
        <h4 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 mb-2 leading-snug">{post.title}</h4>
      )}

      <p className="text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap text-sm leading-relaxed mb-3">
        {post.content}
      </p>

      {post.details && (
        <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-xl p-4 mb-3 text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
          <h5 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1 flex items-center gap-1.5">
            {post.category === 'receita' ? '🍽️ Detalhes da Receita' : '📌 Mais Informações'}
          </h5>
          {post.details}
        </div>
      )}

      {post.nutritionSummary && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/30 rounded-xl p-4 mb-3 text-sm text-orange-900 dark:text-orange-200 whitespace-pre-wrap shadow-sm">
          <h5 className="font-bold mb-2 flex items-center gap-1.5 text-orange-700 dark:text-orange-400">
            📊 Resumo Nutricional (IA)
          </h5>
          {post.nutritionSummary}
        </div>
      )}

      {post.imageUrl && (
        <div 
          className="mb-4 rounded-xl overflow-hidden border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 relative select-none"
          onDoubleClick={toggleLike}
        >
          <img referrerPolicy="no-referrer" src={getProxiedImageUrl(post.imageUrl)} alt={post.title || "Imagem do post"} className="w-full h-auto object-cover max-h-96" loading="lazy" />
          <AnimatePresence>
            {showHeartBurst && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5, y: 0 }}
                animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.5, 1.8, 2], y: [0, -20, -40, -60] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <Heart className="w-32 h-32 text-white fill-current drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {post.tags.map(tag => (
            <span key={tag} className="text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-md">
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-6 text-zinc-500 dark:text-zinc-400">
          <motion.button 
            whileTap={{ scale: 0.8 }}
            onClick={toggleLike}
            className={`flex items-center gap-1.5 transition-colors ${isLiked ? 'text-red-500' : 'hover:text-red-500 dark:hover:text-red-400'}`}
          >
            <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
            <span className="text-sm font-medium">{likeCount}</span>
          </motion.button>
          
          <button 
            onClick={() => setShowComments(!showComments)}
            className={`flex items-center gap-1.5 transition-colors ${showComments ? 'text-green-600 dark:text-green-400' : 'hover:text-green-600 dark:hover:text-green-400'}`}
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-sm font-medium">{commentsCount}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {(user.isAdmin || user.uid === post.authorId) && (
            <motion.button
              whileTap={{ scale: 0.8 }}
              onClick={handleSoftDeleteClick}
              className={`flex items-center transition-colors mr-2 ${confirmDelete ? (post.isDeleted ? 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded' : 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded') : (post.isDeleted ? 'text-green-600 hover:text-green-500' : 'text-zinc-400 hover:text-red-500')}`}
              title={post.isDeleted ? "Restaurar" : "Excluir"}
            >
              {post.isDeleted ? <RotateCcw className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
              {confirmDelete && <span className="text-xs font-bold ml-1">{post.isDeleted ? "Restaurar?" : "Apagar?"}</span>}
            </motion.button>
          )}
          <motion.button 
            whileTap={{ scale: 0.8 }}
            onClick={handleShare}
            className="flex items-center transition-colors text-zinc-400 dark:text-zinc-500 hover:text-green-600 dark:hover:text-green-400"
            title="Compartilhar"
          >
            <Share2 className="w-5 h-5" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.8 }}
            onClick={toggleSave}
            className={`flex items-center transition-colors ${isSaved ? 'text-green-600 dark:text-green-400' : 'text-zinc-400 dark:text-zinc-500 hover:text-green-600 dark:hover:text-green-400'}`}
          >
            {isSaved ? <Bookmark className="w-5 h-5 fill-current" /> : <Bookmark className="w-5 h-5" />}
          </motion.button>
        </div>
      </div>

      {showComments && (
        <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <div className="space-y-3 mb-4">
            <AnimatePresence initial={false}>
              {[...comments]
                .filter(c => !c.isDeleted)
                .sort((a, b) => {
                  if (a.isPinned && !b.isPinned) return -1;
                  if (!a.isPinned && b.isPinned) return 1;
                  return a.createdAt - b.createdAt;
                })
                .map(comment => (
                  <CommentItem key={comment.id} comment={comment} user={user} postId={post.id} />
              ))}
            </AnimatePresence>
            {comments.filter(c => !c.isDeleted).length === 0 && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-2">Nenhum comentário ainda. Seja o primeiro!</p>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <img referrerPolicy="no-referrer" src={getProxiedImageUrl(user.avatar)} className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-700 flex-shrink-0" />
            <input 
              type="text" 
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitComment()}
              placeholder="Adicione um comentário..."
              className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-green-500 dark:focus:border-green-500 focus:ring-1 focus:ring-green-500 text-zinc-900 dark:text-zinc-100"
            />
            <button 
              onClick={submitComment}
              disabled={!newComment.trim() || submittingComment}
              className="text-green-600 dark:text-green-500 p-2 disabled:opacity-50 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-full transition-colors flex-shrink-0"
            >
              {submittingComment ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
