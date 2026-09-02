import { ArrowRight, Leaf, Activity, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans selection:bg-green-200 dark:selection:bg-green-900/50">
      
      {/* Navbar */}
      <nav className="w-full px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
            <Activity className="w-6 h-6 text-green-600 dark:text-green-500" strokeWidth={3} />
          </div>
          <span className="text-2xl font-black text-green-600 dark:text-green-500 tracking-tight">FitFeed</span>
        </div>
        <Link 
          to="/login"
          className="px-5 py-2.5 text-sm font-bold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-full hover:scale-105 transition-transform shadow-lg shadow-zinc-200 dark:shadow-none"
        >
          Entrar
        </Link>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 max-w-3xl mx-auto text-center py-12">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-semibold mb-6 animate-fade-in-up">
          <Leaf className="w-4 h-4" />
          <span>A revolução da sua dieta inteligente</span>
        </div>
        
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter leading-[1.1] mb-5">
          Nutrição saudável, <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-emerald-700 dark:from-green-400 dark:to-emerald-600">
            conhecimento real.
          </span>
        </h1>
        
        <p className="text-base md:text-lg text-zinc-600 dark:text-zinc-400 mb-8 max-w-2xl leading-relaxed">
          Descubra receitas, conecte-se com nutricionistas e entusiastas, e utilize nossa Inteligência Artificial para analisar seus hábitos alimentares e treinos diários.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
          <Link 
            to="/login"
            className="w-full sm:w-auto px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-full font-bold text-base flex items-center justify-center gap-2 transition-all hover:scale-105 hover:shadow-xl hover:shadow-green-600/20"
          >
            Começar Gratuitamente
            <ArrowRight className="w-5 h-5" />
          </Link>
          <a href="#features" className="w-full sm:w-auto px-6 py-3 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full font-bold text-base flex items-center justify-center transition-colors">
            Saiba Mais
          </a>
        </div>
      </main>

      {/* Social Proof / Features */}
      <section id="features" className="py-16 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8">
            
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-green-50 dark:bg-green-900/20 rounded-2xl flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-500" />
              </div>
              <h3 className="text-lg font-bold mb-2">Receitas Validadas</h3>
              <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">Acesse um feed exclusivo com receitas saudáveis criadas e avaliadas pela nossa comunidade de bem-estar.</p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-green-50 dark:bg-green-900/20 rounded-2xl flex items-center justify-center mb-4">
                <Activity className="w-6 h-6 text-green-600 dark:text-green-500" />
              </div>
              <h3 className="text-lg font-bold mb-2">Assistente de IA</h3>
              <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">Receba recomendações inteligentes de refeições e treinos conversando com nosso agente AI.</p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-green-50 dark:bg-green-900/20 rounded-2xl flex items-center justify-center mb-4">
                <ChevronRight className="w-6 h-6 text-green-600 dark:text-green-500" />
              </div>
              <h3 className="text-lg font-bold mb-2">Acompanhamento</h3>
              <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">Siga outros usuários, nutricionistas e atletas para criar uma rede focada no seu desenvolvimento saudável.</p>
            </div>

          </div>
        </div>
      </section>
      
      <footer className="py-8 text-center text-zinc-500 dark:text-zinc-400 text-sm border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <p>&copy; {new Date().getFullYear()} FitFeed. Plataforma experimental acadêmica.</p>
      </footer>
    </div>
  );
}
