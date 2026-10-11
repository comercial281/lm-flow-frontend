// ── FAIXA (aviso que atravessa a tela) ───────────────────────────────────────
//
// Escolha do dono em 10/10/2026 (GLOSSARIO.md → As peças da casa, 12): a mesma
// família da caixa de aviso (`Aviso`), em faixa com linha embaixo. Fica no topo
// da tela, da conversa ou do editor. A ação, quando tem, é botão de contorno
// pequeno à direita. Mesmos tons do Aviso.
//
// Fora daqui, só a faixa vermelha de acesso como administrador (`ImpersonationBar`):
// só a equipe vê.
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COR_DO_TOM, ICONE_DO_TOM, type TomDoAviso } from './Aviso';

export interface FaixaProps {
  tom?: TomDoAviso;
  children: ReactNode;
  /** Botões à direita (no celular, descem pra baixo do texto). */
  acao?: ReactNode;
  /** Troca o ícone do tom; `null` tira o ícone. */
  icone?: LucideIcon | null;
  className?: string;
}

export default function Faixa({ tom = 'atencao', children, acao, icone, className }: FaixaProps) {
  const Icone = icone === null ? null : icone ?? ICONE_DO_TOM[tom];
  return (
    <div
      role={tom === 'erro' ? 'alert' : 'status'}
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b px-4 py-2 text-xs',
        COR_DO_TOM[tom],
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {Icone && <Icone aria-hidden className="h-3.5 w-3.5 shrink-0" />}
        <div className="min-w-0">{children}</div>
      </div>
      {acao && <div className="flex shrink-0 flex-wrap items-center gap-2">{acao}</div>}
    </div>
  );
}
