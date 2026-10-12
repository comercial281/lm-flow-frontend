import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

import { AppLogo } from '@/components/AppLogo';

interface LoadingScreenProps {
  fullScreen?: boolean;
  showLogo?: boolean;
  className?: string;
  /** O que está acontecendo, pro leitor de tela ("Verificando autenticação…"). */
  rotulo?: string;
}

// Tela de partida (guarda de rota). As cores são as do tema: as antigas
// (`bg-neutral-background-default`, `text-primary-interaction-default`) não
// existiam no CSS, e a rodinha não saía roxa.
const LoadingScreen = ({ fullScreen = false, showLogo = false, className, rotulo = 'Carregando…' }: LoadingScreenProps) => {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center justify-center bg-background',
        fullScreen && 'h-screen',
        className,
      )}
    >
      {showLogo && (
        <AppLogo className="w-1/4 mb-4" />
      )}
      <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-primary" />
      <span className="sr-only">{rotulo}</span>
    </div>
  );
};

export default LoadingScreen;
