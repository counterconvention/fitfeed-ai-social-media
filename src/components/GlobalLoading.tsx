import React, { createContext, useContext, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface GlobalLoadingContextType {
  setGlobalLoading: (isLoading: boolean) => void;
}

const GlobalLoadingContext = createContext<GlobalLoadingContextType>({
  setGlobalLoading: () => {},
});

export const useGlobalLoading = () => useContext(GlobalLoadingContext);

export function GlobalLoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <GlobalLoadingContext.Provider value={{ setGlobalLoading: setIsLoading }}>
      {children}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-green-600 dark:text-green-500" />
            <p className="text-zinc-600 dark:text-zinc-300 font-medium text-sm">Carregando...</p>
          </div>
        </div>
      )}
    </GlobalLoadingContext.Provider>
  );
}
