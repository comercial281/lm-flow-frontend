// Prévia do lead ao parar o mouse numa visita da Agenda (Mês, Semana, Dia e,
// na Lista, o nome do lead). Envolve a peça: pendura nela os eventos do
// `usePreviaComAtraso` e a barrinha que enche na cor da situação (`--st`)
// durante a espera; aberta, desenha o cartão no body, ao lado da peça.
//
// Cartão no body com posição calculada aqui (mesmo jeito do mini card do Funil),
// e não o Popover do pacote: o Popover puxa o foco ao abrir e fecha por clique
// fora, e a prévia não pode tirar o foco da página nem engolir o clique que abre
// a janela da visita. Só leitura: abrir conversa ou card é na janela do clique.
import {
  Children, cloneElement, useEffect, useLayoutEffect, useRef, useState,
  type CSSProperties, type ReactElement,
} from 'react';
import { createPortal } from 'react-dom';
import Aviso from '@/components/base/Aviso';
import { Skeleton } from '@/components/ui/ds';
import { cn } from '@/lib/utils';
import type { LeadSummary } from '@/services/visits/visitsService';
import { MARGEM, posicaoDaPrevia } from './posicaoDaPrevia';
import { ResumoDoLead } from './ResumoDoLead';
import { lerResumoDoLead, resumoGuardado } from './guardaDoResumo';
import { usePreviaComAtraso, type PropsDoAlvo } from './usePreviaComAtraso';

const LARGURA = 320;
const ATRASO_MS = 450;

// A barrinha de 2 px no pé da peça: parada em 0, enche no tempo do atraso
// quando a peça ganha `armando`, e volta na hora ao desarmar. Quem pediu menos
// movimento vê a prévia abrir sem a barra correndo.
const BARRA_DA_ESPERA =
  "after:pointer-events-none after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:opacity-90 after:content-[''] " +
  'after:bg-[var(--st,var(--muted-foreground))] [&.armando]:after:w-full [&.armando]:after:transition-[width] ' +
  '[&.armando]:after:duration-[var(--atraso)] [&.armando]:after:ease-linear motion-reduce:[&.armando]:after:transition-none';

type PropsDaPeca = Partial<PropsDoAlvo> & { className?: string; style?: CSSProperties };

export function PreviaDoLead({ visitaId, children }: { visitaId: string; children: ReactElement<PropsDaPeca> }) {
  const previa = usePreviaComAtraso({ atrasoMs: ATRASO_MS });
  const peca = Children.only(children);
  const deFora = peca.props;
  const juntar = <K extends keyof PropsDoAlvo>(nome: K) =>
    ((e: Parameters<PropsDoAlvo[K]>[0]) => {
      (deFora[nome] as ((ev: typeof e) => void) | undefined)?.(e);
      (previa.alvoProps[nome] as (ev: typeof e) => void)(e);
    }) as PropsDoAlvo[K];

  return (
    <>
      {cloneElement(peca, {
        onPointerEnter: juntar('onPointerEnter'),
        onPointerLeave: juntar('onPointerLeave'),
        onPointerDown: juntar('onPointerDown'),
        onFocus: juntar('onFocus'),
        onBlur: juntar('onBlur'),
        className: cn(deFora.className, BARRA_DA_ESPERA, previa.armando && 'armando'),
        style: { ...deFora.style, '--atraso': `${ATRASO_MS}ms` } as CSSProperties,
      })}
      {previa.aberta && previa.ancora && createPortal(
        <CartaoDaPrevia key={visitaId} visitaId={visitaId} ancora={previa.ancora} {...previa.conteudoProps} />,
        document.body,
      )}
    </>
  );
}

function CartaoDaPrevia({
  visitaId, ancora, onPointerEnter, onPointerLeave,
}: { visitaId: string; ancora: HTMLElement; onPointerEnter: () => void; onPointerLeave: () => void }) {
  // Resumo guardado abre direto; senão esqueleto até chegar.
  const [estado, setEstado] = useState<{ resumo?: LeadSummary; erro?: boolean }>(() => ({ resumo: resumoGuardado(visitaId) }));
  useEffect(() => {
    if (estado.resumo) return;
    let vivo = true;
    lerResumoDoLead(visitaId)
      .then(resumo => { if (vivo) setEstado({ resumo }); })
      .catch(() => { if (vivo) setEstado({ erro: true }); });
    return () => { vivo = false; };
    // Só ao abrir: o resumo que chega não pede de novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitaId]);

  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const r = ancora.getBoundingClientRect();
    const altura = ref.current?.offsetHeight ?? 0;
    setPos(posicaoDaPrevia(
      { left: r.left, right: r.right, top: r.top },
      { largura: window.innerWidth, altura: window.innerHeight },
      { largura: Math.min(LARGURA, window.innerWidth - 2 * MARGEM), altura },
    ));
  }, [ancora, estado]);

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Resumo do lead"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      style={{ width: LARGURA, maxWidth: `calc(100vw - ${2 * MARGEM}px)`, left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden' }}
      className="fixed z-[150] rounded-[14px] border border-border bg-popover p-3.5 text-popover-foreground shadow-lg animate-in fade-in-0 duration-150 motion-reduce:animate-none"
    >
      {estado.resumo ? (
        <>
          <ResumoDoLead resumo={estado.resumo} />
          <p className="mt-2.5 text-center text-[11px] text-muted-foreground">Clique para abrir a visita</p>
        </>
      ) : estado.erro ? (
        <Aviso tom="erro" compacto>Não deu para carregar o resumo do lead.</Aviso>
      ) : (
        <div data-esqueleto className="grid gap-2.5" aria-busy="true">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-[38px] w-[38px] rounded-full" />
            <div className="grid flex-1 gap-1.5">
              <Skeleton className="h-3.5 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-6 w-44 rounded-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-12 w-full rounded-[10px]" />
        </div>
      )}
    </div>
  );
}
