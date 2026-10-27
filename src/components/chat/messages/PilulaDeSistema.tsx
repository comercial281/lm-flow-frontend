import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EtiquetaDaConta } from '@/features/conversas/etiquetasNaMensagem';
import { Estrelas } from './CartaoDeEvento';

// Registro de bastidor da conversa numa linha só: ícone pequeno, nome em
// negrito, o texto, as etiquetas coloridas (quando a linha é de etiqueta) e a
// hora no fim. Substitui o bloco cinza de duas linhas (26/10/2026).

interface PilulaDeSistemaProps {
  icone: LucideIcon;
  nome?: string;
  texto: string;
  etiquetas?: EtiquetaDaConta[];
  // "removeu": a etiqueta sai riscada
  etiquetasRiscadas?: boolean;
  estrelas?: number;
  hora: string;
}

// Fundo claro da própria cor da etiqueta; o texto puxa pra cor do tema
// (escurece no claro, clareia no escuro).
const corDaEtiqueta = (cor: string): React.CSSProperties => ({
  backgroundColor: `color-mix(in srgb, ${cor} 16%, transparent)`,
  color: `color-mix(in srgb, ${cor} 62%, var(--foreground))`,
});

const PilulaDeSistema: React.FC<PilulaDeSistemaProps> = ({
  icone: Icone,
  nome,
  texto,
  etiquetas = [],
  etiquetasRiscadas = false,
  estrelas,
  hora,
}) => {
  // sem nome na frente, a frase começa em maiúscula
  const frase = nome ? texto : texto.charAt(0).toUpperCase() + texto.slice(1);

  return (
    <div className="flex justify-center py-1.5">
      <span
        data-pilula=""
        className="inline-flex max-w-full items-center gap-[7px] rounded-full border border-border/60 bg-card/85 px-[11px] py-[5px] text-xs text-muted-foreground"
      >
        <Icone aria-hidden="true" className="h-[13px] w-[13px] shrink-0 text-muted-foreground/70" />
        <span className="min-w-0 break-words">
          {nome && (
            <>
              <b className="font-semibold text-foreground/80">{nome}</b>{' '}
            </>
          )}
          <span>{frase}</span>
          {etiquetas.map(e => (
            <React.Fragment key={e.id}>
              {' '}
              <span
                data-etiqueta=""
                className={cn(
                  'inline-flex items-center gap-[5px] rounded-full px-2 py-0.5 align-middle text-[11.5px] font-semibold',
                  etiquetasRiscadas && 'line-through',
                )}
                style={corDaEtiqueta(e.color)}
              >
                <i aria-hidden="true" className="inline-block h-[7px] w-[7px] rounded-full" style={{ backgroundColor: e.color }} />
                {e.title}
              </span>
            </React.Fragment>
          ))}
          {estrelas !== undefined && (
            <>
              {' '}
              <Estrelas nota={estrelas} className="align-[-2px]" />
            </>
          )}
          {hora && (
            <>
              {etiquetas.length ? ' ' : ' · '}
              <span className="whitespace-nowrap text-muted-foreground/70">{hora}</span>
            </>
          )}
        </span>
      </span>
    </div>
  );
};

export default PilulaDeSistema;
