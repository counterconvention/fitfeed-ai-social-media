import { useGlobalLoading } from "./GlobalLoading";
import { getProxiedImageUrl } from '../lib/utils';
import { useState, FormEvent } from 'react';
import { loginWithGoogle, loginAnonymously } from '../lib/firebase';
import { Loader2, Activity, User, Sparkles } from 'lucide-react';

const PRESET_AVATARS = [
  'https://api.dicebear.com/9.x/fun-emoji/svg?seed=Felix',
  'https://api.dicebear.com/9.x/fun-emoji/svg?seed=Luna',
  'https://api.dicebear.com/9.x/fun-emoji/svg?seed=Jack',
  'https://api.dicebear.com/9.x/fun-emoji/svg?seed=Bella',
  'https://api.dicebear.com/9.x/fun-emoji/svg?seed=Max'
];

export default function AuthScreen() {
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingTemp, setLoadingTemp] = useState(false);
  const [mode, setMode] = useState<'options' | 'temp'>('options');
  const [error, setError] = useState('');
  const { setGlobalLoading } = useGlobalLoading();
  
  const [username, setUsername] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(PRESET_AVATARS[0]);

  const handleGoogleLogin = async () => {
    setLoadingGoogle(true);
    setGlobalLoading(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      alert("Erro ao entrar com Google. Se estiver no painel, tente abrir o app em uma nova guia.");
    } finally {
      setLoadingGoogle(false);
      setGlobalLoading(false);
    }
  };

  const handleTempLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError("Por favor, preencha o nome de usuário.");
      return;
    }
    if (username.trim().length < 3) {
      setError("O nome de usuário deve ter pelo menos 3 caracteres.");
      return;
    }
    if (loadingTemp) return;
    
    setError('');
    setLoadingTemp(true);
    setGlobalLoading(true);
    try {
      const trimmedUsername = username.trim();
      const isAdmin = trimmedUsername === 'admin:0000';
      const finalUsername = isAdmin ? 'admin' : trimmedUsername;

      await loginAnonymously(finalUsername, selectedAvatar, isAdmin);
      // Wait to force re-render in App.tsx (it watches onAuthStateChanged, but local guest needs a refresh)
      window.location.reload(); 
    } catch (err) {
      alert("Erro ao criar conta temporária. Tente novamente.");
      setLoadingTemp(false);
      setGlobalLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-zinc-50 dark:bg-zinc-950 flex flex-col p-4 sm:p-6 text-zinc-900 dark:text-zinc-100 overflow-y-auto">
      <div className="w-full max-w-md m-auto bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col items-center text-center border border-zinc-100 dark:border-zinc-800">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
          <Activity className="w-8 h-8 text-green-600 dark:text-green-500" />
        </div>
        
        <h1 className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight mb-2">FitFeed</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mb-8 text-sm">Receitas, dicas e treinos para sua vida fitness.</p>

        {mode === 'options' ? (
          <div className="w-full space-y-3">
            <button 
              onClick={handleGoogleLogin}
              disabled={loadingGoogle}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-70"
            >
              {loadingGoogle ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Entrar com Google'
              )}
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800"></div>
              <span className="flex-shrink mx-3 text-xs text-zinc-400 dark:text-zinc-500 font-medium">OU</span>
              <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800"></div>
            </div>

            <button
              onClick={() => setMode('temp')}
              className="w-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <User className="w-4 h-4 text-zinc-600" />
              Entrar com Conta Temporária
            </button>
          </div>
        ) : (
          <form onSubmit={handleTempLogin} className="w-full flex flex-col items-center">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-3 py-1 rounded-full mb-4">
              <Sparkles className="w-3.5 h-3.5" /> Conta Temporária
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
              Escolha seu avatar e um nome de usuário. Você pode integrar sua conta ao Google depois!
            </p>

            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 self-start mb-2">Escolha seu Avatar:</label>
            <div className="flex gap-3 mb-5 overflow-x-auto w-full py-1 justify-center">
              {PRESET_AVATARS.map((url, i) => (
                <img referrerPolicy="no-referrer" 
                  key={i} 
                  src={getProxiedImageUrl(url)} 
                  alt={`Avatar ${i + 1}`}
                  onClick={() => setSelectedAvatar(url)}
                  className={`w-12 h-12 rounded-full cursor-pointer border-2 transition-all ${
                    selectedAvatar === url 
                      ? 'border-green-600 scale-110 shadow-sm' 
                      : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                />
              ))}
            </div>

            <div className="w-full text-left mb-6">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 block">Nome de Usuário:</label>
              <input 
                type="text"
                required
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(''); }}
                placeholder="Ex: AtletaFit20"
                className={`w-full bg-zinc-50 dark:bg-zinc-800 border ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-zinc-200 dark:border-zinc-700 focus:border-green-500 focus:ring-green-500/20'} rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 text-zinc-900 dark:text-zinc-100 transition-colors`}
              />
              {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
            </div>

            <div className="w-full space-y-2">
              <button 
                type="submit"
                disabled={loadingTemp || !username.trim()}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl flex items-center justify-center transition-colors disabled:opacity-50"
              >
                {loadingTemp ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Entrar Agora'
                )}
              </button>

              <button
                type="button"
                onClick={() => setMode('options')}
                className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 py-2 transition-colors"
              >
                Voltar às opções
              </button>
            </div>
          </form>
        )}
      </div>
      
      <p className="mt-8 text-center text-xs text-zinc-400 dark:text-zinc-500 max-w-xs mx-auto">
        &copy; 2026 FitFeed. Plataforma experimental acadêmica.
      </p>
    </div>
  );
}
