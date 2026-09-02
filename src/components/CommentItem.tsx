import { useState, useRef } from 'react';
import { User, Comment } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getProxiedImageUrl } from '../lib/utils';
import { Pin, Trash2, X, RotateCcw, MoreHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface CommentItemProps {
  comment: Comment;
  user: User;
  postId?: string;
  isAdminView?: boolean;
}

export default function CommentItem({ comment, user, postId, isAdminView = false }: CommentItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);

  const effectivePostId = postId || comment.postId;
  const isAdmin = user.isAdmin;
  const isAuthor = user.uid === comment.authorId;
  const canDelete = isAdmin || isAuthor;
  const canPin = isAdmin;

  const handleTouchStart = () => {
    if (!canDelete && !canPin) return;
    pressTimer.current = setTimeout(() => {
      setShowMenu(true);
    }, 450);
  };

  const handleTouchEnd = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (canDelete || canPin) {
      e.preventDefault();
      setShowMenu(true);
    }
  };

  const handleDelete = async () => {
    if (!effectivePostId) {
      console.warn("Missing postId for comment deletion");
      return;
    }
    setShowMenu(false);
    setIsDeleting(true);

    // Give 400ms for the light red erasing animation before updating Firestore
    setTimeout(async () => {
      try {
        await updateDoc(doc(db, 'posts', effectivePostId, 'comments', comment.id), {
          isDeleted: true
        });
      } catch (e) {
        console.warn("Failed to delete comment", e);
        setIsDeleting(false);
      }
    }, 400);
  };

  const handleRestore = async () => {
    if (!effectivePostId) return;
    try {
      await updateDoc(doc(db, 'posts', effectivePostId, 'comments', comment.id), {
        isDeleted: false
      });
      setShowMenu(false);
    } catch (e) {
      console.warn("Failed to restore comment", e);
    }
  };

  const handlePin = async () => {
    if (!effectivePostId) {
      console.warn("Missing postId for comment pin");
      return;
    }
    try {
      await updateDoc(doc(db, 'posts', effectivePostId, 'comments', comment.id), {
        isPinned: !comment.isPinned
      });
      setShowMenu(false);
    } catch (e) {
      console.warn("Failed to pin comment", e);
    }
  };

  if (comment.isDeleted && !isAdminView && !isDeleting) return null;

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ 
        opacity: isDeleting ? 0.6 : 1, 
        y: 0,
        scale: isDeleting ? 0.98 : 1
      }}
      exit={{ opacity: 0, height: 0, scale: 0.9, marginTop: 0, marginBottom: 0 }}
      transition={{ duration: 0.25 }}
      className="relative select-none"
    >
      {/* Floating Action Menu Bubble */}
      <AnimatePresence>
        {showMenu && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setShowMenu(false)} 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.85, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 10 }}
              transition={{ type: 'spring', damping: 20, stiffness: 350 }}
              className="absolute left-1/2 -top-16 -translate-x-1/2 z-50 bg-zinc-900/95 dark:bg-zinc-800/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-zinc-700/60 dark:border-zinc-700 p-1.5 flex items-center gap-1 min-w-max"
            >
              {canPin && !comment.isDeleted && (
                <button 
                  onClick={handlePin} 
                  className={`px-3 py-1.5 rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors flex items-center gap-1.5 text-xs font-semibold ${comment.isPinned ? 'text-amber-400' : 'text-zinc-200'}`}
                >
                  <Pin className={`w-3.5 h-3.5 ${comment.isPinned ? 'fill-current' : ''}`} />
                  <span>{comment.isPinned ? 'Desfixar' : 'Fixar no topo'}</span>
                </button>
              )}
              {canDelete && !comment.isDeleted && (
                <button 
                  onClick={handleDelete} 
                  className="px-3 py-1.5 rounded-xl hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors flex items-center gap-1.5 text-xs font-semibold"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir</span>
                </button>
              )}
              {isAdminView && comment.isDeleted && (
                <button 
                  onClick={handleRestore} 
                  className="px-3 py-1.5 rounded-xl hover:bg-green-500/20 text-green-400 hover:text-green-300 transition-colors flex items-center gap-1.5 text-xs font-semibold"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restaurar</span>
                </button>
              )}
              <button 
                onClick={() => setShowMenu(false)} 
                className="p-1.5 rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Comment Card */}
      <div 
        className={`group relative flex gap-3 p-1 rounded-2xl transition-all duration-300 ${
          isDeleting 
            ? 'bg-red-50/90 dark:bg-red-950/40 border border-red-300 dark:border-red-800 shadow-[0_0_12px_rgba(239,68,68,0.2)]' 
            : showMenu 
              ? 'opacity-60' 
              : ''
        }`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseUp={handleTouchEnd}
        onMouseLeave={handleTouchEnd}
        onContextMenu={handleContextMenu}
      >
        <img 
          referrerPolicy="no-referrer" 
          src={getProxiedImageUrl(comment.authorAvatar)} 
          alt={comment.authorName} 
          className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-700 flex-shrink-0 mt-0.5 object-cover" 
        />
        <div 
          className={`rounded-2xl p-3 flex-1 transition-all duration-300 ${
            isDeleting
              ? 'bg-red-100/70 dark:bg-red-900/30 border border-red-300/80 dark:border-red-800/80'
              : comment.isPinned 
                ? 'bg-amber-50/90 dark:bg-amber-950/30 border border-amber-300/80 dark:border-amber-700/60 shadow-sm' 
                : 'bg-zinc-50 dark:bg-zinc-800/80 border border-transparent'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className={`text-sm font-semibold flex items-center gap-1 ${
                comment.authorIsAdmin 
                  ? 'bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-500 bg-clip-text text-transparent drop-shadow-[0_0_5px_rgba(245,158,11,0.5)] animate-pulse font-black' 
                  : 'text-zinc-900 dark:text-zinc-100'
              }`}>
                {comment.authorName}
              </h4>
              {comment.isPinned && !isDeleting && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded-full">
                  <Pin className="w-2.5 h-2.5 fill-current" /> Fixado
                </span>
              )}
              {isDeleting && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/50 px-1.5 py-0.5 rounded-full animate-pulse">
                  <Trash2 className="w-2.5 h-2.5" /> Excluído
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                {formatDistanceToNow(comment.createdAt, { locale: ptBR })}
              </span>
              {(canDelete || canPin) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(!showMenu);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-zinc-400 transition-opacity"
                  title="Opções do comentário"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <p className={`text-sm ${
            isDeleting 
              ? 'text-red-700 dark:text-red-300 line-through opacity-80' 
              : 'text-zinc-800 dark:text-zinc-200'
          }`}>
            {comment.content}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
