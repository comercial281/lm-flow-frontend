import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// CARTÃO DE FLUXO (Funis de mensagem, 22/10/2026): a casca única dos cartões
// das abas Manual e Follow-up. O filete à esquerda diz o estado de relance
// (verde ligado, vermelho desligado, âmbar montando, cinza arquivado); o resto
// é título, selos, uma linha e a fileira de ações. Cada aba põe o seu conteúdo
// nos espaços; a casca não decide ação nenhuma.

export type EstadoDoCartao = 'ligado' | 'desligado' | 'montando' | 'arquivado';

const FILETE: Record<EstadoDoCartao, string> = {
  ligado: 'bg-emerald-600',
  desligado: 'bg-red-600',
  montando: 'bg-amber-500',
  arquivado: 'bg-slate-400',
};

export interface CartaoDeFluxoProps {
  titulo: string;
  aoAbrir: () => void;
  estado: EstadoDoCartao;
  /** Selos à direita do título (Da equipe, estado, padrão da conta...). */
  selos?: ReactNode;
  /** Uma linha de apoio sob o título (gatilho, o que falta montar...). */
  linha?: ReactNode;
  /** A fileira de ações do rodapé. */
  acoes: ReactNode;
  children?: ReactNode;
}

export function CartaoDeFluxo({ titulo, aoAbrir, estado, selos, linha, acoes, children }: CartaoDeFluxoProps) {
  return (
    <li
      className="rounded-lg border border-border overflow-hidden flex"
      data-testid="cartao-de-fluxo"
      data-estado={estado}
    >
      <div className={cn('w-1.5 shrink-0', FILETE[estado])} data-testid="filete-do-cartao" aria-hidden="true" />
      <div className="flex-1 min-w-0 p-3 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <button type="button" className="min-w-0 truncate text-left text-sm font-semibold hover:underline" title={titulo} onClick={aoAbrir}>
            {titulo}
          </button>
          {selos && <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">{selos}</div>}
        </div>
        {linha && <div className="text-xs text-muted-foreground">{linha}</div>}
        {children}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">{acoes}</div>
      </div>
    </li>
  );
}
