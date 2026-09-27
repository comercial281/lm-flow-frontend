import { ShieldX } from 'lucide-react';
import { NO_ACCESS_MESSAGE } from './noAccessCopy';

/** O aviso de recusa por cargo — no lugar da tela, nunca uma lista vazia nem a página genérica. */
export default function NoAccessState({ className = '' }: { className?: string }) {
  return (
    <div
      role="status"
      className={`flex h-full min-h-[240px] flex-col items-center justify-center gap-3 p-6 text-center ${className}`}
    >
      <ShieldX className="h-8 w-8 text-muted-foreground" aria-hidden />
      <p className="max-w-md text-sm text-muted-foreground">{NO_ACCESS_MESSAGE}</p>
    </div>
  );
}
