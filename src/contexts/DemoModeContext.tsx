import React, { createContext, useLayoutEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'lm_demo_mode';

export interface DemoModeContextType {
  demoMode: boolean;
  toggleDemoMode: () => void;
}

export const DemoModeContext = createContext<DemoModeContextType | undefined>(undefined);

export function DemoModeProvider({ children }: { children: React.ReactNode }) {
  const [demoMode, setDemoMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === '1';
  });

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('demo-mode', demoMode);
    localStorage.setItem(STORAGE_KEY, demoMode ? '1' : '0');
  }, [demoMode]);

  const toggleDemoMode = () => setDemoMode(prev => !prev);

  const contextValue = useMemo(() => ({ demoMode, toggleDemoMode }), [demoMode]);

  return <DemoModeContext.Provider value={contextValue}>{children}</DemoModeContext.Provider>;
}
