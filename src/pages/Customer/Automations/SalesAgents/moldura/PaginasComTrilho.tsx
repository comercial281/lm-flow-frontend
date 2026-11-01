// Moldura das páginas da IA Vendedora (Configurar e Ensinar, 11/10/2026): índice
// à esquerda, UM cabeçalho (grupo, título, frase), a página aberta e o pé com
// "← Anterior · Próxima →" (Tarefa 70, 01/11/2026: molde do cadastro de imóveis,
// largo, `max-w-6xl`, índice de `lg:w-52`). Peça única de propósito: as margens são as
// da moldura da casa (Pagina + Secoes) e trocar de Configurar pra Ensinar não pode
// mexer o índice nem o título de lugar.
//
// CELULAR (abaixo de 768 px, `useCelular`): o índice vira uma fileira de PÍLULAS que
// quebra linha (`flex-wrap`), sem rolar pro lado e sem grudar; tudo numa coluna.
//
// ⚠️ ROLAGEM: quem rola é a Pagina da IA Vendedora (o contêiner `overflow-y-auto`
// dela). O trilho é o ÚNICO `sticky` e precisa de `self-start` (item de flex
// esticado não gruda). Nada no meio pode grudar ou ter rolagem própria — era o
// "objeto solto" do passo a passo (a prévia `sticky` e a BarraSalvar). Há spec que confere.
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Lock } from 'lucide-react';
import { BaseHeader } from '@/components/base';
import { Button } from '@/components/ui/ds';
import { useCelular } from '@/hooks/useCelular';
import { cn } from '@/lib/utils';

export interface ItemDoTrilho<Id extends string> {
  id: Id;
  titulo: string;
  frase: string;
  icone: LucideIcon;
  pendente?: boolean;
  /** Página travada (Agendamento sem objetivo de visita). */
  trava?: { dica: string; leitor: string };
  /** Contador à direita (Ensinar). Some quando há pendência. */
  contagem?: number;
}
export interface GrupoDoTrilho<Id extends string> { id: string; rotulo: string; itens: ItemDoTrilho<Id>[] }
export interface PaginasComTrilhoProps<Id extends string> {
  /** aria-label do <nav>. */
  rotulo: string;
  grupos: GrupoDoTrilho<Id>[];
  atual: Id;
  aoIr: (id: Id) => void;
  /** A página aberta. */
  children: ReactNode;
}

const NAV_LATERAL = 'flex shrink-0 flex-col gap-4 lg:sticky lg:top-6 lg:w-52 lg:self-start lg:max-h-[calc(100dvh-9rem)] lg:overflow-y-auto';

export default function PaginasComTrilho<Id extends string>({ rotulo, grupos, atual, aoIr, children }: PaginasComTrilhoProps<Id>) {
  const celular = useCelular();
  const grupoAtual = grupos.find((g) => g.itens.some((i) => i.id === atual)) ?? grupos[0];
  const todas = grupos.flatMap((g) => g.itens);
  const posicao = Math.max(0, todas.findIndex((i) => i.id === atual));
  const info = todas[posicao];
  const anterior = todas[posicao - 1];
  const proxima = todas[posicao + 1];
  // Um grupo só (as 8 páginas do Configurar): o rótulo no índice e no cabeçalho diria a mesma coisa duas vezes.
  const umGrupo = grupos.length === 1;

  const botao = (it: ItemDoTrilho<Id>) => {
    const on = atual === it.id;
    const Icone = it.icone;
    return (
      <button key={it.id} type="button" onClick={() => { if (!on) aoIr(it.id); }} aria-current={on ? 'page' : undefined}
        title={it.trava ? it.trava.dica : it.frase}
        className={cn(
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors',
          celular
            ? cn('inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm',
              on ? 'border-primary/40 bg-primary/10 font-semibold text-primary' : 'border-border hover:bg-accent')
            : cn('flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm',
              on ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-accent'),
          it.trava && !on && 'text-muted-foreground')}>
        {!celular && <Icone className={cn('h-[18px] w-[18px] shrink-0', on ? 'text-primary' : 'text-muted-foreground', it.trava && !on && 'opacity-60')} aria-hidden="true" />}
        <span className={celular ? undefined : 'flex-1'}>{it.titulo}</span>
        {it.pendente && <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden />}
        {it.pendente && <span className="sr-only">(tem pendência)</span>}
        {!it.pendente && it.contagem !== undefined && <span className="text-xs font-medium text-muted-foreground">{it.contagem}</span>}
        {it.trava && <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />}
        {it.trava && <span className="sr-only">{it.trava.leitor}</span>}
      </button>
    );
  };

  const vizinha = (it: ItemDoTrilho<Id>, sentido: 'anterior' | 'proxima') => (
    <Button type="button" variant="outline" onClick={() => aoIr(it.id)}
      className={cn('h-auto min-w-0 flex-col items-start gap-0.5 whitespace-normal px-4 py-2.5', sentido === 'proxima' && 'ml-auto items-end text-right')}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">{sentido === 'anterior' ? '← Anterior' : 'Próxima →'}</span>{' '}
      <b className="text-sm font-semibold text-primary">{it.titulo}</b>
    </Button>
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 lg:flex-row lg:items-start">
      <nav aria-label={rotulo} data-estilo={celular ? 'pilulas' : undefined}
        className={celular ? 'flex flex-wrap gap-2' : NAV_LATERAL}>
        {grupos.map((g) => (
          <div key={g.id} role="group" aria-labelledby={`grupo-${g.id}`} className={celular ? 'contents' : undefined}>
            <p id={`grupo-${g.id}`} className={cn('px-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground', (celular || umGrupo) && 'sr-only')}>{g.rotulo}</p>
            {g.itens.map(botao)}
          </div>
        ))}
      </nav>
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <header className="space-y-1">
          {!umGrupo && <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">{grupoAtual.rotulo}</p>}
          <BaseHeader title={info.titulo} subtitle={info.frase} />
        </header>
        {children}
        {(anterior || proxima) && (
          <footer className="flex flex-wrap items-stretch justify-between gap-2.5">
            {anterior && vizinha(anterior, 'anterior')}
            {proxima && vizinha(proxima, 'proxima')}
          </footer>
        )}
      </div>
    </div>
  );
}
