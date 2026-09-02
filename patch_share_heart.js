import fs from 'fs';

let code = fs.readFileSync('src/components/PostCard.tsx', 'utf8');

code = code.replace(
  /Trash2, RotateCcw \} from 'lucide-react';/,
  "Trash2, RotateCcw, Share2 } from 'lucide-react';"
);

code = code.replace(
  /const \[confirmDelete, setConfirmDelete\] = useState\(false\);/,
  "const [confirmDelete, setConfirmDelete] = useState(false);\n  const [showHeartBurst, setShowHeartBurst] = useState(false);"
);

code = code.replace(
  /const toggleLike = async \(\) => \{\s*if \(likeLoading\) return;\s*setLikeLoading\(true\);\s*const likeRef = doc\(db, 'likes', `\$\{user\.uid\}_\$\{post\.id\}`\);\s*try \{\s*if \(!isLiked\) \{\s*await setDoc\(likeRef, \{ userId: user\.uid, postId: post\.id, createdAt: Date\.now\(\) \}\);/m,
  `const toggleLike = async () => {
    if (likeLoading) return;
    setLikeLoading(true);
    const likeRef = doc(db, 'likes', \`\${user.uid}_\${post.id}\`);
    try {
      if (!isLiked) {
        setShowHeartBurst(true);
        setTimeout(() => setShowHeartBurst(false), 1000);
        await setDoc(likeRef, { userId: user.uid, postId: post.id, createdAt: Date.now() });`
);

const shareCode = `
  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: \`FitFeed: \${post.title || 'Post'} por \${post.authorName}\`,
          text: \`Confira este post de \${post.authorName} no FitFeed:\n\n\${post.content.slice(0, 100)}...\`,
          url: window.location.href,
        });
      } else {
        console.warn("O compartilhamento não é suportado neste navegador.");
      }
    } catch (err) {
      console.warn("Error sharing:", err);
    }
  };
`;

code = code.replace(/const toggleLike = async/, shareCode + '\n  const toggleLike = async');

const imageCode = `
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
`;

code = code.replace(
  /\{post.imageUrl && \([\s\S]*?<div className="mb-4 rounded-xl overflow-hidden border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800">[\s\S]*?<img referrerPolicy="no-referrer" src=\{getProxiedImageUrl\(post.imageUrl\)\} alt=\{post.title \|\| "Imagem do post"\} className="w-full h-auto object-cover max-h-96" loading="lazy" \/>[\s\S]*?<\/div>\s*\)\}/,
  imageCode.trim()
);

code = code.replace(/import \{ motion \} from 'motion\/react';/, "import { motion, AnimatePresence } from 'motion/react';");

const shareBtnCode = `
          <motion.button 
            whileTap={{ scale: 0.8 }}
            onClick={handleShare}
            className="flex items-center transition-colors text-zinc-400 dark:text-zinc-500 hover:text-green-600 dark:hover:text-green-400"
            title="Compartilhar"
          >
            <Share2 className="w-5 h-5" />
          </motion.button>
          <motion.button 
`;

code = code.replace(/<motion\.button \s*whileTap=\{\{ scale: 0\.8 \}\}\s*onClick=\{toggleSave\}/, shareBtnCode.trim() + '\n            whileTap={{ scale: 0.8 }}\n            onClick={toggleSave}');

fs.writeFileSync('src/components/PostCard.tsx', code);
