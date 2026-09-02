import { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import { Bot, Send, Loader2, User as UserIcon } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export default function AIAssistant({ user }: { user: User }) {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', text: `Olá ${user.username}! Sou seu assistente de saúde e fitness. O que você gostaria de saber hoje?` }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMsg }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantMsg = '';
      const msgId = Date.now().toString();

      setMessages(prev => [...prev, { id: msgId, role: 'assistant', text: '' }]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        assistantMsg += decoder.decode(value, { stream: true });
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: assistantMsg } : m));
      }
    } catch (error) {
      console.warn(error);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', text: 'Ocorreu um erro de conexão.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900 h-full">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-3 bg-white dark:bg-zinc-900 shrink-0 z-10">
        <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <Bot className="w-6 h-6 text-green-600 dark:text-green-500" />
        </div>
        <div>
          <h2 className="font-bold text-zinc-900 dark:text-zinc-100 leading-tight">Treinador IA</h2>
          <p className="text-xs text-green-600 font-medium">Online</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl p-3 px-4 ${
              msg.role === 'user' 
                ? 'bg-green-600 text-white rounded-br-none' 
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-bl-none'
            }`}>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-2xl rounded-bl-none p-3 px-4">
              <Loader2 className="w-4 h-4 animate-spin text-zinc-500 dark:text-zinc-400" />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="w-full p-3 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Pergunte sobre treinos, dieta..."
            className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-green-500 dark:focus:border-green-500 focus:ring-2 focus:ring-green-500/20 text-zinc-900 dark:text-zinc-100"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="bg-green-600 text-white p-2.5 rounded-full hover:bg-green-700 dark:hover:bg-green-500 transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
