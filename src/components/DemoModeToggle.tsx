import { Eye, EyeOff } from 'lucide-react';
import { Button, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/ds';
import { useDemoMode } from '../hooks/useDemoMode';

export function DemoModeToggle() {
  const { demoMode, toggleDemoMode } = useDemoMode();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleDemoMode}
          aria-pressed={demoMode}
          className={
            'h-8 w-8 p-0 cursor-pointer hover:bg-neutral-surface-highlight ' +
            (demoMode ? 'text-primary' : '')
          }
          aria-label={demoMode ? 'Desligar modo demo' : 'Ligar modo demo'}
        >
          {demoMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </TooltipTrigger>

      <TooltipContent>
        {demoMode ? 'Modo demo ligado — dados borrados' : 'Modo demo (borrar dados p/ gravar)'}
      </TooltipContent>
    </Tooltip>
  );
}
