// Moldura das páginas da IA Vendedora (Configurar e Ensinar, 11/10/2026): trilho
// agrupado à esquerda, UM cabeçalho (grupo, título, frase) e a página aberta. Peça
// única de propósito: as margens são as da moldura da casa (Pagina + Secoes) e
// trocar de Configurar pra Ensinar não pode mexer o trilho nem o título de lugar.
//
// ⚠️ ROLAGEM: quem rola é a Pagina da IA Vendedora (o contêiner `overflow-y-auto`
// dela). O trilho é o ÚNICO `sticky` e precisa de `self-start` (item de flex
// esticado não gruda). Nada no meio pode grudar ou ter rolagem própria — era o
// "objeto solto" do passo a passo (a prévia `sticky` e a BarraSalvar). Há spec que confere.
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Lock } from 'lucide-react';
import { BaseHeader } from '@/components/base';
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

export default function PaginasComTrilho<Id extends string>({ rotulo, grupos, atual, aoIr, children }: PaginasComTrilhoProps<Id>) {
  const grupoAtual = grupos.find((g) => g.itens.some((i) => i.id === atual)) ?? grupos[0];
  const info = grupoAtual.itens.find((i) => i.id === atual) ?? grupoAtual.itens[0];
  return (
    <div className="flex flex-col gap-7 lg:flex-row lg:items-start">
      <nav aria-label={rotulo}
        className="flex shrink-0 flex-col gap-4 lg:sticky lg:top-6 lg:w-60 lg:self-start lg:max-h-[calc(100dvh-9rem)] lg:overflow-y-auto">
        {grupos.map((g) => (
          <div key={g.id} role="group" aria-labelledby={`grupo-${g.id}`}>
            <p id={`grupo-${g.id}`} className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{g.rotulo}</p>
            {g.itens.map((it) => {
              const on = atual === it.id;
              const Icone = it.icone;
              return (
                <button key={it.id} type="button" onClick={() => { if (!on) aoIr(it.id); }} aria-current={on ? 'page' : undefined}
                  title={it.trava ? it.trava.dica : it.frase}
                  className={cn('flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    on ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-accent',
                    it.trava && !on && 'text-muted-foreground')}>
                  <Icone className={cn('h-[18px] w-[18px] shrink-0', on ? 'text-primary' : 'text-muted-foreground', it.trava && !on && 'opacity-60')} aria-hidden="true" />
                  <span className="flex-1">{it.titulo}</span>
                  {it.pendente && <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden />}
                  {it.pendente && <span className="sr-only">(tem pendência)</span>}
                  {!it.pendente && it.contagem !== undefined && <span className="text-xs font-medium text-muted-foreground">{it.contagem}</span>}
                  {it.trava && <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                  {it.trava && <span className="sr-only">{it.trava.leitor}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">{grupoAtual.rotulo}</p>
          <BaseHeader title={info.titulo} subtitle={info.frase} />
        </header>
        {children}
      </div>
    </div>
  );
}
