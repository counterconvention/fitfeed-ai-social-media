import { useState, useEffect } from 'react';
import { User } from '../types';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Loader2, Apple, Plus, Minus, Flame, Edit3, Download, Sparkles, Trophy, X, ChevronRight } from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';
import { awardXP } from '../lib/xp';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface Props {
  user: User;
}

interface NutritionItem {
  id: string;
  name: string;
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
}

interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  goalCalories: number;
  items: NutritionItem[];
  xpAwarded?: boolean;
}

const DEFAULT_MACROS: Macros = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  goalCalories: 2000,
  items: [],
};

export default function NutritionTracker({ user }: Props) {
  const [macros, setMacros] = useState<Macros>(DEFAULT_MACROS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Modals & UI State
  const [editingGoal, setEditingGoal] = useState(false);
  const [newGoal, setNewGoal] = useState("");
  const [showItemModal, setShowItemModal] = useState(false);
  const [showMealSuggestion, setShowMealSuggestion] = useState(false);
  const [mealSuggestion, setMealSuggestion] = useState<any>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  
  // Breakdown State
  const [selectedMacro, setSelectedMacro] = useState<string | null>(null);

  // Milestones State
  const [streak, setStreak] = useState(0);

  const todayStr = new Date().toISOString().split('T')[0];
  const docId = `${user.uid}_${todayStr}`;

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Today's Macros
        const ref = doc(db, 'nutrition_logs', docId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setMacros({
            calories: data.calories || 0,
            protein: data.protein || 0,
            carbs: data.carbs || 0,
            fat: data.fat || 0,
            goalCalories: data.goalCalories || 2000,
            items: data.items || [],
          });
        }

        // Calculate Milestones (Streaks)
        const logsRef = collection(db, 'nutrition_logs');
        const q = query(logsRef, where('userId', '==', user.uid), orderBy('date', 'desc'), limit(14));
        const logsSnap = await getDocs(q);
        
        const logsMap = new Map();
        logsSnap.forEach(d => logsMap.set(d.data().date, d.data()));
        
        let currentStreak = 0;
        let checkDate = new Date();
        
        for (let i = 0; i < 30; i++) {
          const dateStr = checkDate.toISOString().split('T')[0];
          const data = logsMap.get(dateStr);
          
          if (data) {
            // Check if goal was met (e.g., hit at least 80% of calories and has some macros)
            const goalHit = data.calories >= (data.goalCalories * 0.8) && (data.protein > 0 || data.carbs > 0 || data.fat > 0);
            
            if (goalHit) {
              currentStreak++;
            } else if (i > 0) {
              break; // Streak broken on a past day
            }
          } else if (i > 0) {
            break; // No log for a past day, streak broken
          }
          checkDate.setDate(checkDate.getDate() - 1);
        }
        
        setStreak(currentStreak);

      } catch (err) {
        console.error("Error fetching nutrition:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [docId, user.uid]);

  const saveMacros = async (newMacros: Macros) => {
    setSaving(true);
    try {
      let finalMacros = { ...newMacros };
      // Check if goal met for XP
      if (!finalMacros.xpAwarded && finalMacros.calories >= (finalMacros.goalCalories * 0.8) && (finalMacros.protein > 0 || finalMacros.carbs > 0 || finalMacros.fat > 0)) {
         finalMacros.xpAwarded = true;
         await awardXP(user.uid, 100);
      }

      await setDoc(doc(db, 'nutrition_logs', docId), {
        ...finalMacros,
        userId: user.uid,
        date: todayStr,
        updatedAt: Date.now()
      }, { merge: true });
      
      newMacros = finalMacros;
      setMacros(newMacros);
    } catch (err) {
      console.error("Error saving macros:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleQuickAdd = (type: keyof Omit<Macros, 'items'>, amount: number) => {
    const updated = { ...macros, [type]: Math.max(0, Number(macros[type]) + amount) };
    saveMacros(updated);
  };

  const handleAddItem = (item: Omit<NutritionItem, 'id'>) => {
    const newItem = { ...item, id: Date.now().toString() };
    const updated = {
      ...macros,
      calories: macros.calories + item.calories,
      protein: macros.protein + item.protein,
      carbs: macros.carbs + item.carbs,
      fat: macros.fat + item.fat,
      items: [...macros.items, newItem]
    };
    saveMacros(updated);
    setShowItemModal(false);
  };

  const handleUpdateGoal = () => {
    const parsed = parseInt(newGoal);
    if (!isNaN(parsed) && parsed > 0) {
      saveMacros({ ...macros, goalCalories: parsed });
    }
    setEditingGoal(false);
  };

  const exportPDF = () => {
    const pdf = new jsPDF();
    pdf.setFontSize(20);
    pdf.text('Resumo Nutricional - FitFeed', 14, 22);
    
    pdf.setFontSize(12);
    pdf.text(`Data: ${format(new Date(), 'dd/MM/yyyy')}`, 14, 32);
    pdf.text(`Usuário: ${user.username}`, 14, 38);
    pdf.text(`Progresso da Meta: ${macros.calories} / ${macros.goalCalories} kcal`, 14, 44);
    
    pdf.text(`Proteínas: ${macros.protein}g`, 14, 52);
    pdf.text(`Carboidratos: ${macros.carbs}g`, 14, 58);
    pdf.text(`Gorduras: ${macros.fat}g`, 14, 64);

    if (macros.items.length > 0) {
      pdf.text('Itens Consumidos:', 14, 76);
      const tableData = macros.items.map(item => [
        item.name, 
        `${item.calories} kcal`,
        `${item.protein}g`,
        `${item.carbs}g`,
        `${item.fat}g`
      ]);
      
      (pdf as any).autoTable({
        startY: 80,
        head: [['Item', 'Calorias', 'Proteína', 'Carbos', 'Gordura']],
        body: tableData,
      });
    }

    pdf.save(`nutricao_${todayStr}.pdf`);
  };

  const suggestMeal = async () => {
    setLoadingSuggestion(true);
    setShowMealSuggestion(true);
    try {
      const remaining = {
        calories: Math.max(0, macros.goalCalories - macros.calories),
        protein: Math.max(0, 150 - macros.protein), // Using arbitrary 150g goal for demo if not set
        carbs: Math.max(0, 200 - macros.carbs),
        fat: Math.max(0, 70 - macros.fat)
      };

      const res = await fetch('/api/suggest-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ macros: remaining })
      });
      const data = await res.json();
      setMealSuggestion(data);
    } catch (err) {
      console.error(err);
      setMealSuggestion({ title: "Erro", recipe: "Não foi possível gerar a sugestão." });
    } finally {
      setLoadingSuggestion(false);
    }
  };

  const chartData = [
    { name: 'Proteína', id: 'protein', value: macros.protein * 4, color: '#3b82f6' },
    { name: 'Carbos', id: 'carbs', value: macros.carbs * 4, color: '#eab308' },
    { name: 'Gordura', id: 'fat', value: macros.fat * 9, color: '#ef4444' },
  ];

  const totalMacroCalories = chartData.reduce((acc, curr) => acc + curr.value, 0);
  const otherCalories = Math.max(0, macros.calories - totalMacroCalories);
  
  const finalChartData = [
    ...chartData,
    ...(otherCalories > 0 ? [{ name: 'Outros', id: 'other', value: otherCalories, color: '#9ca3af' }] : [])
  ];

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="w-8 h-8 animate-spin text-green-600 dark:text-green-500" />
      </div>
    );
  }

  
  const proteinTarget = Math.round((macros.goalCalories * 0.3) / 4);
  const carbsTarget = Math.round((macros.goalCalories * 0.4) / 4);
  const fatTarget = Math.round((macros.goalCalories * 0.3) / 9);

  const progress = Math.min(100, Math.round((macros.calories / macros.goalCalories) * 100)) || 0;
  
  // Filter items based on selected macro
  const displayedItems = selectedMacro ? macros.items.filter(item => {
    if (selectedMacro === 'protein') return item.protein > 5;
    if (selectedMacro === 'carbs') return item.carbs > 10;
    if (selectedMacro === 'fat') return item.fat > 5;
    return true;
  }) : macros.items;

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 overflow-y-auto">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-10 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Apple className="w-5 h-5 text-blue-600 dark:text-blue-500" />
          </div>
          <div>
            <h2 className="font-bold text-zinc-900 dark:text-zinc-100">Nutrição</h2>
            <p className="text-xs text-blue-600 dark:text-blue-500 font-medium capitalize">
              {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
        </div>
        <button onClick={exportPDF} className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-blue-600">
          <Download className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 flex-1 space-y-6 pb-8">
        
        {/* Milestones */}
        {streak >= 3 && (
          <div className="bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/40 dark:to-orange-900/40 rounded-xl p-4 flex items-center gap-4 border border-amber-200 dark:border-amber-800/50">
            <div className="w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30 shrink-0">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <h4 className="font-bold text-amber-900 dark:text-amber-100 text-sm">
                {streak >= 7 ? 'Semana Perfeita!' : 'Ofensiva Saudável!'}
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-300">Você bateu suas metas calóricas e de macros por {streak} dias consecutivos. Continue assim!</p>
            </div>
          </div>
        )}

        {/* Calorie Goal Summary */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 relative">
          {saving && (
             <div className="absolute top-4 right-4">
               <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
             </div>
          )}
          <div className="flex items-center justify-between mb-4">
             <h3 className="font-bold text-zinc-800 dark:text-zinc-200">Resumo Diário</h3>
             {!editingGoal ? (
               <button onClick={() => { setNewGoal(macros.goalCalories.toString()); setEditingGoal(true); }} className="text-xs flex items-center gap-1 text-zinc-500 hover:text-blue-600 transition-colors">
                 <Edit3 className="w-3 h-3" /> Meta
               </button>
             ) : (
               <div className="flex items-center gap-2">
                 <input 
                   type="number" 
                   value={newGoal} 
                   onChange={e => setNewGoal(e.target.value)}
                   className="w-16 text-xs px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 outline-none focus:border-blue-500"
                   autoFocus
                 />
                 <button onClick={handleUpdateGoal} className="text-xs font-bold text-blue-600 hover:text-blue-700">OK</button>
               </div>
             )}
          </div>
          
          <div className="flex items-center justify-between">
            <div className="text-center">
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold mb-1">Consumido</p>
              <p className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{macros.calories}</p>
            </div>
            
            <div className="w-24 h-24 relative flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" className="text-zinc-100 dark:text-zinc-800" strokeWidth="8" stroke="currentColor" fill="none" />
                <circle cx="50" cy="50" r="40" className="text-blue-500" strokeWidth="8" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * progress) / 100} strokeLinecap="round" stroke="currentColor" fill="none" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Flame className="w-4 h-4 text-orange-500 mb-0.5" />
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{progress}%</span>
              </div>
            </div>

            <div className="text-center">
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold mb-1">Restante</p>
              <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{Math.max(0, macros.goalCalories - macros.calories)}</p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800">
             <button onClick={suggestMeal} className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-xl font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors">
                <Sparkles className="w-4 h-4" />
                Sugerir Refeição com IA
             </button>
          </div>
        </div>

        {/* Macro Chart & Breakdown */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-zinc-800 dark:text-zinc-200">Macronutrientes</h3>
            <button onClick={() => setShowItemModal(true)} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-full font-bold transition-colors">
              + Item
            </button>
          </div>
          
          <p className="text-xs text-zinc-500 text-center mb-2">Clique no gráfico para filtrar alimentos</p>

          <div className="h-48 w-full mb-6 relative">
            {(macros.protein > 0 || macros.carbs > 0 || macros.fat > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={finalChartData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                    onClick={(data, index) => {
                      if (data && data.payload) {
                         setSelectedMacro(selectedMacro === data.payload.id ? null : data.payload.id);
                      }
                    }}
                    cursor="pointer"
                  >
                    {finalChartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color} 
                        opacity={selectedMacro ? (selectedMacro === entry.id ? 1 : 0.3) : 1}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [`${value} kcal`, 'Calorias']}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500">
                <Apple className="w-12 h-12 mb-2 opacity-50" />
                <span className="text-sm">Nenhum macro registrado</span>
              </div>
            )}
          </div>

          {selectedMacro && (
            <div className="mb-6 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                  Itens ricos em {selectedMacro === 'protein' ? 'Proteína' : selectedMacro === 'carbs' ? 'Carbos' : 'Gordura'}
                </span>
                <button onClick={() => setSelectedMacro(null)} className="text-xs text-blue-600">Limpar filtro</button>
              </div>
              {displayedItems.length > 0 ? (
                <div className="space-y-2">
                  {displayedItems.map(item => (
                    <div key={item.id} className="flex justify-between items-center text-sm border-b border-zinc-200 dark:border-zinc-700/50 pb-2 last:border-0 last:pb-0">
                      <span className="text-zinc-800 dark:text-zinc-200">{item.name}</span>
                      <span className="text-zinc-500 text-xs font-bold">{item.calories} kcal</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-500 text-center py-2">Nenhum item específico adicionado via diário.</p>
              )}
            </div>
          )}

          <div className="space-y-4">
            <MacroControl 
              target={proteinTarget}
              label="Proteínas" 
              value={macros.protein} 
              color="bg-blue-500" 
              onAdd={(amt) => handleQuickAdd('protein', amt)} 
            />
            <MacroControl 
              target={carbsTarget}
              label="Carboidratos" 
              value={macros.carbs} 
              color="bg-yellow-500" 
              onAdd={(amt) => handleQuickAdd('carbs', amt)} 
            />
            <MacroControl 
              target={fatTarget}
              label="Gorduras" 
              value={macros.fat} 
              color="bg-red-500" 
              onAdd={(amt) => handleQuickAdd('fat', amt)} 
            />
          </div>
        </div>
      </div>

      {/* Item Addition Modal */}
      {showItemModal && (
        <AddItemModal onClose={() => setShowItemModal(false)} onAdd={handleAddItem} />
      )}

      {/* Gemini Meal Suggestion Modal */}
      {showMealSuggestion && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md overflow-hidden max-h-[85vh] flex flex-col">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-indigo-50 dark:bg-indigo-900/20">
              <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
                <Sparkles className="w-5 h-5" />
                <h3 className="font-bold">Sugestão Gemini IA</h3>
              </div>
              <button onClick={() => setShowMealSuggestion(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {loadingSuggestion ? (
                <div className="flex flex-col items-center justify-center py-12 text-indigo-600 dark:text-indigo-400">
                  <Loader2 className="w-10 h-10 animate-spin mb-4" />
                  <p className="font-semibold text-sm animate-pulse">Analisando seus macros restantes...</p>
                </div>
              ) : mealSuggestion ? (
                <div className="space-y-4">
                  <h4 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{mealSuggestion.title}</h4>
                  {mealSuggestion.estimatedMacros && (
                    <div className="bg-zinc-100 dark:bg-zinc-800 p-3 rounded-lg text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                      {mealSuggestion.estimatedMacros}
                    </div>
                  )}
                  <div className="prose dark:prose-invert text-sm max-w-none text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                    {mealSuggestion.recipe}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MacroControl({ label, value, color, onAdd, step = 5, unit = "g", target }: { label: string, value: number, color: string, onAdd: (amount: number) => void, step?: number, unit?: string, target?: number }) {
  const percentage = target && target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${color}`} />
          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{label}</span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onAdd(-step)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="w-14 text-center text-sm font-bold text-zinc-900 dark:text-zinc-100">
            {value}{unit}
          </span>
          <button 
            onClick={() => onAdd(step)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
      {target !== undefined && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
             <div className={`h-full ${color} transition-all duration-300`} style={{ width: `${percentage}%` }} />
          </div>
          <span className="text-[10px] text-zinc-400 font-medium w-8 text-right">{target}{unit}</span>
        </div>
      )}
    </div>
  );
}

function AddItemModal({ onClose, onAdd }: { onClose: () => void, onAdd: (item: any) => void }) {
  const [name, setName] = useState("");
  const [cals, setCals] = useState("");
  const [prot, setProt] = useState("");
  const [carb, setCarb] = useState("");
  const [fat, setFat] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !cals) return;
    onAdd({
      name,
      calories: Number(cals) || 0,
      protein: Number(prot) || 0,
      carbs: Number(carb) || 0,
      fat: Number(fat) || 0
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100">Registrar Alimento</h3>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X className="w-5 h-5" /></button>
        </div>
        
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-zinc-500 mb-1 block">Nome do Alimento / Refeição</label>
            <input required value={name} onChange={e=>setName(e.target.value)} className="w-full bg-zinc-100 dark:bg-zinc-800 border border-transparent focus:border-blue-500 rounded-xl px-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none" placeholder="Ex: Frango com Batata Doce" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-zinc-500 mb-1 block">Calorias (kcal)</label>
              <input required type="number" value={cals} onChange={e=>setCals(e.target.value)} className="w-full bg-zinc-100 dark:bg-zinc-800 border border-transparent focus:border-blue-500 rounded-xl px-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none" placeholder="0" />
            </div>
            <div>
              <label className="text-xs font-bold text-blue-500 mb-1 block">Proteína (g)</label>
              <input type="number" value={prot} onChange={e=>setProt(e.target.value)} className="w-full bg-zinc-100 dark:bg-zinc-800 border border-transparent focus:border-blue-500 rounded-xl px-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none" placeholder="0" />
            </div>
            <div>
              <label className="text-xs font-bold text-yellow-500 mb-1 block">Carboidrato (g)</label>
              <input type="number" value={carb} onChange={e=>setCarb(e.target.value)} className="w-full bg-zinc-100 dark:bg-zinc-800 border border-transparent focus:border-blue-500 rounded-xl px-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none" placeholder="0" />
            </div>
            <div>
              <label className="text-xs font-bold text-red-500 mb-1 block">Gordura (g)</label>
              <input type="number" value={fat} onChange={e=>setFat(e.target.value)} className="w-full bg-zinc-100 dark:bg-zinc-800 border border-transparent focus:border-blue-500 rounded-xl px-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none" placeholder="0" />
            </div>
          </div>
        </div>
        
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors">
            Adicionar ao Diário
          </button>
        </div>
      </form>
    </div>
  );
}
