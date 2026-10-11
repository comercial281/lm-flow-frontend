// ── AVISO (caixa de aviso da casa) ───────────────────────────────────────────
//
// Escolha do dono em 10/10/2026 (GLOSSARIO.md → As peças da casa, 11): caixa
// translúcida com ícone, um desenho só. Antes eram 93 caixas pintadas à mão em
// 5 jeitos (pastel `-50/-200`, translúcida, `Alert` do pacote com cor por cima,
// borda à esquerda). A trava `avisoAMao` do `conferir-padrao` impede que voltem.
//
// O tom dá a cor e o ícone. `neutro` é pra recado sem urgência (modo só leitura,
// "nada a fazer aqui"). Funciona no claro e no escuro sem classe `dark:` extra,
// porque o fundo e a borda são a própria cor com transparência.
import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TomDoAviso = 'info' | 'atencao' | 'erro' | 'sucesso' | 'neutro';

/** Borda, fundo e texto de cada tom. A Faixa usa as mesmas cores. */
export const COR_DO_TOM: Record<TomDoAviso, string> = {
  info: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400',
  atencao: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  erro: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400',
  sucesso: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  neutro: 'border-border bg-muted/40 text-muted-foreground',
};

export const ICONE_DO_TOM: Record<TomDoAviso, LucideIcon> = {
  info: Info,
  atencao: TriangleAlert,
  erro: CircleAlert,
  sucesso: CircleCheck,
  neutro: Info,
};

export interface AvisoProps {
  tom?: TomDoAviso;
  /** Em negrito. Com texto simples, abre a frase; com conteúdo montado, vira a primeira linha. */
  titulo?: ReactNode;
  children?: ReactNode;
  /** Botões ou link, embaixo do texto. */
  acao?: ReactNode;
  /** Troca o ícone do tom; `null` tira o ícone. */
  icone?: LucideIcon | null;
  /** Menor (texto 12 px), pra caber dentro de campo, cartão ou painel lateral. */
  compacto?: boolean;
  className?: string;
}

export default function Aviso({
  tom = 'info', titulo, children, acao, icone, compacto = false, className,
}: AvisoProps) {
  const Icone = icone === null ? null : icone ?? ICONE_DO_TOM[tom];
  const textoSimples = typeof children === 'string' || typeof children === 'number';

  return (
    <div
      role={tom === 'erro' ? 'alert' : 'status'}
      className={cn(
        'flex items-start rounded-md border',
        compacto ? 'gap-1.5 p-2.5 text-xs' : 'gap-2 p-3 text-sm',
        COR_DO_TOM[tom],
        className,
      )}
    >
      {Icone && <Icone aria-hidden className={cn('mt-0.5 shrink-0', compacto ? 'h-3.5 w-3.5' : 'h-4 w-4')} />}
      <div className="min-w-0 flex-1 space-y-1 break-words">
        {titulo && textoSimples ? (
          <p><strong className="font-medium">{titulo}</strong> {children}</p>
        ) : (
          <>
            {titulo && <p className="font-medium">{titulo}</p>}
            {textoSimples ? <p>{children}</p> : children}
          </>
        )}
        {acao && <div className="flex flex-wrap items-center gap-2 pt-1">{acao}</div>}
      </div>
    </div>
  );
}
