import { motion, useAnimation, PanInfo } from 'motion/react';
import { Trash2 } from 'lucide-react';
import { User } from '../types';
import { getProxiedImageUrl } from '../lib/utils';
import { useState } from 'react';

interface Props {
  user: User;
  type: 'followers_list' | 'following_list';
  onRemove: (uid: string) => void;
}

export default function SwipeableUserItem({ user, type, onRemove }: Props) {
  const controls = useAnimation();
  const [removed, setRemoved] = useState(false);

  const handleDragEnd = async (e: any, info: PanInfo) => {
    const threshold = -80; // Negative X to swipe left
    if (info.offset.x < threshold) {
      await controls.start({ x: -window.innerWidth, opacity: 0, transition: { duration: 0.2 } });
      setRemoved(true);
      setTimeout(() => onRemove(user.uid), 200); // Give time for animation
    } else {
      controls.start({ x: 0, transition: { type: 'spring', bounce: 0.5 } });
    }
  };

  if (removed) return null;

  return (
    <div className="relative overflow-hidden bg-red-500 w-full">
      {/* Background action (Trash) */}
      <div className="absolute right-0 top-0 bottom-0 flex items-center justify-end px-6 w-full pointer-events-none">
        <div className="flex flex-col items-center justify-center text-white">
          <Trash2 className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-bold uppercase">{type === 'followers_list' ? 'Remover' : 'Deixar'}</span>
        </div>
      </div>

      {/* Foreground Draggable item */}
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -100, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        animate={controls}
        className="relative z-10 flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 touch-pan-y"
      >
        <div className="flex items-center gap-3 pointer-events-none">
          <img src={getProxiedImageUrl(user.avatar)} alt={user.username} className="w-10 h-10 rounded-full border border-zinc-200 dark:border-zinc-700 object-cover" />
          <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{user.username}</span>
        </div>
        <button 
          onClick={(e) => {
             e.preventDefault();
             onRemove(user.uid);
          }}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        >
          {type === 'followers_list' ? 'Remover' : 'Deixar de seguir'}
        </button>
      </motion.div>
    </div>
  );
}
