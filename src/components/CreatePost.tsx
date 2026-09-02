import { useGlobalLoading } from "./GlobalLoading";
import { useState } from 'react';
import { User } from '../types';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { awardXP } from '../lib/xp';
import { useNavigate } from 'react-router-dom';
import { Wand2, Loader2, Send, Tag } from 'lucide-react';

const CATEGORIES = [
  { id: 'receita', label: 'Receita', icon: '🥗' },
  { id: 'noticia', label: 'Notícia', icon: '📰' },
  { id: 'dica', label: 'Dica', icon: '💡' },
];

export default function CreatePost({ user }: { user: User }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [topic, setTopic] = useState('');
  const [category, setCategory] = useState('receita');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const { setGlobalLoading } = useGlobalLoading();
  const navigate = useNavigate();

  const handleGenerate = async () => {
    if (generating) return;
    setGenerating(true);
    setGlobalLoading(true);
    try {
      const categoryLabel = CATEGORIES.find(c => c.id === category)?.label || 'Dica';
      const promptStr = `Escreva um post engajador para uma rede social fitness focado em "${categoryLabel}". O tema específico é: "${topic || 'Dicas gerais'}". Use emojis adequados, quebras de linha para facilitar a leitura e inclua algumas hashtags relevantes no final.`;
      
      const res = await fetch('/api/generate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: promptStr, category }),
      });
      if (!res.ok) {
        throw new Error('Falha na API');
      }
      const data = await res.json();
      
      if (data.title) setTitle(data.title);
      if (data.content) setContent(data.content);
      
    } catch (error) {
      console.warn(error);
      setError('Erro ao gerar post com IA. Tente novamente.');
    } finally {
      setGenerating(false);
      setGlobalLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      setError("Por favor, escreva algo para sua postagem.");
      return;
    }
    if (content.trim().length < 10) {
      setError("A postagem deve ter pelo menos 10 caracteres.");
      return;
    }
    if (loading) return;
    
    setError('');
    setLoading(true);
    setGlobalLoading(true);
    try {
      const tags = content.match(/#[a-zA-Z0-9_À-ÿ]+/g)?.map(t => t.slice(1)) || [];
      
      let nutritionSummary = "";
      if (category === 'receita') {
        try {
          const res = await fetch('/api/nutrition-summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
          });
          if (res.ok) {
            const data = await res.json();
            nutritionSummary = data.summary || "";
          }
        } catch (e) {
          console.warn("Failed to generate nutrition summary", e);
        }
      }
      
      await addDoc(collection(db, 'posts'), {
        authorId: user.uid,
        authorName: user.username,
        authorAvatar: user.avatar,
        authorIsAdmin: user.isAdmin || false,
        title: title.trim(),
        content: content.trim(),
        imageUrl: imageUrl.trim(),
        tags: tags.slice(0, 5),
        category: category,
        ...(nutritionSummary ? { nutritionSummary } : {}),
        likesCount: 0,
        commentsCount: 0,
        createdAt: Date.now(),
      });
      navigate('/');
    } catch (error) {
      console.warn(error);
      setError('Erro ao publicar. Tente novamente.');
    } finally {
      setLoading(false);
      setGlobalLoading(false);
    }
  };

  return (
    <div className="p-4 pt-4 flex flex-col bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 flex-1 overflow-y-auto h-full">
      <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-3">Nova Publicação</h2>
      {error && <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-xl mb-4 text-sm font-medium border border-red-100 dark:border-red-900/30">{error}</div>}
      
      {/* Category Selector */}
      <div className="mb-4">
        <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 mb-2">
          <Tag className="w-4 h-4 text-zinc-500 dark:text-zinc-400" /> Categoria do Post
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all border ${
                category === cat.id 
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-sm' 
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              <span>{cat.icon}</span> {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-xl mb-4 border border-green-100 dark:border-green-900/30">
        <h3 className="text-sm font-semibold text-green-800 dark:text-green-400 mb-2 flex items-center gap-2">
          <Wand2 className="w-4 h-4" /> Revisor de IA
        </h3>
        <p className="text-xs text-green-700 dark:text-green-500 mb-3">Deixe a IA criar ou revisar a sua postagem.</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Sobre o que você quer falar?"
            className="flex-1 bg-white dark:bg-zinc-800 border border-green-200 dark:border-green-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400 dark:focus:border-green-500 dark:text-zinc-100"
          />
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-green-600 text-white px-3 py-1.5 rounded-xl text-sm font-medium hover:bg-green-700 dark:hover:bg-green-500 transition-colors flex items-center gap-2 disabled:opacity-70"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Gerar'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título da postagem (Opcional)"
          className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 dark:focus:border-green-500 font-semibold dark:text-zinc-100"
        />
        
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="O que você quer compartilhar hoje?"
          className="min-h-[100px] flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 resize-none focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 dark:focus:border-green-500 dark:text-zinc-100"
        ></textarea>



        <input
          type="text"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="URL de imagem (Opcional)"
          className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 dark:focus:border-green-500 dark:text-zinc-100"
        />
        
        <div className="mt-2 flex justify-end pb-4">
          <button
            onClick={handleSubmit}
            disabled={loading || !content.trim()}
            className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-3 rounded-xl font-semibold flex items-center gap-2 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 shadow-sm"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            Publicar
          </button>
        </div>
      </div>
    </div>
  );
}
