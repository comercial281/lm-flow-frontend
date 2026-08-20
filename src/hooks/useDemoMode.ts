import { useContext } from 'react';
import { DemoModeContext } from '../contexts/DemoModeContext';

export function useDemoMode() {
  const context = useContext(DemoModeContext);
  if (context === undefined) {
    throw new Error('useDemoMode deve ser usado dentro de um DemoModeProvider');
  }
  return context;
}
