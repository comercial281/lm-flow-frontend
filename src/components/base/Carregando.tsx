// ── CARREGANDO (esqueleto cinza da casa) ─────────────────────────────────────
//
// Escolha do dono em 10/10/2026 (GLOSSARIO.md → As peças da casa, 13): lista,
// cartão ou tela carregando mostra um ESQUELETO CINZA com a forma do que vai
// chegar, nunca uma rodinha solta no meio da tela nem tela em branco. A
// rodinha (`Loader2 h-4 w-4 animate-spin`) fica só dentro de botão ou ação
// pequena. A trava `rodinhaCentral` e a `telaEmBranco` do `conferir-padrao`
// impedem que voltem.
//
// Desenho copiado de `components/chat/loading-states/ConversationSkeleton.tsx`:
// `bg-muted animate-pulse`, linhas `rounded`, a de baixo `bg-muted/70`. Para
// quem usa leitor de tela, a caixa diz "Carregando…" (`role="status"` +
// `aria-busy`); as formas cinzas ficam escondidas dele. Quem pediu pra
// reduzir o movimento no sistema vê o cinza parado.
import { cn } from '@/lib/utils';

export type FormaDoCarregando = 'lista' | 'cartoes' | 'texto';

export interface CarregandoProps {
  /** A forma do que vai chegar. Padrão `lista`. */
  variante?: FormaDoCarregando;
  /** Quantos itens (lista e cartões) ou linhas (texto). Padrão 3. */
  linhas?: number;
  /** O que o leitor de tela ouve. Padrão "Carregando…". */
  rotulo?: string;
  className?: string;
}

const CINZA = 'bg-muted animate-pulse motion-reduce:animate-none';
const CINZA_CLARO = 'bg-muted/70 animate-pulse motion-reduce:animate-none';
// Larguras que variam de uma linha pra outra, pra não parecer uma grade.
const LARGURAS = ['w-3/5', 'w-2/5', 'w-1/2', 'w-2/3'];
const LARGURAS_DE_BAIXO = ['w-4/5', 'w-3/4', 'w-2/3', 'w-5/6'];

function Lista({ linhas }: { linhas: number }) {
  return (
    <div className="divide-y divide-border/50">
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <div className={cn('h-10 w-10 shrink-0 rounded-full', CINZA)} />
          <div className="min-w-0 flex-1 space-y-2">
            <div className={cn('h-4 rounded', CINZA, LARGURAS[i % LARGURAS.length])} />
            <div className={cn('h-3 rounded', CINZA_CLARO, LARGURAS_DE_BAIXO[i % LARGURAS_DE_BAIXO.length])} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Cartoes({ linhas }: { linhas: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-lg border border-border/60 p-4">
          <div className={cn('h-24 rounded', CINZA)} />
          <div className={cn('h-4 rounded', CINZA, LARGURAS[i % LARGURAS.length])} />
          <div className={cn('h-3 rounded', CINZA_CLARO, LARGURAS_DE_BAIXO[i % LARGURAS_DE_BAIXO.length])} />
        </div>
      ))}
    </div>
  );
}

function Texto({ linhas }: { linhas: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: linhas }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-4 rounded',
            i === linhas - 1 ? cn(CINZA_CLARO, 'w-2/3') : cn(CINZA, i % 2 ? 'w-11/12' : 'w-full'),
          )}
        />
      ))}
    </div>
  );
}

export default function Carregando({ variante = 'lista', linhas = 3, rotulo = 'Carregando…', className }: CarregandoProps) {
  const n = Math.max(1, Math.floor(linhas));
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={cn('w-full', className)}>
      <span className="sr-only">{rotulo}</span>
      <div aria-hidden="true">
        {variante === 'cartoes' ? <Cartoes linhas={n} /> : variante === 'texto' ? <Texto linhas={n} /> : <Lista linhas={n} />}
      </div>
    </div>
  );
}
