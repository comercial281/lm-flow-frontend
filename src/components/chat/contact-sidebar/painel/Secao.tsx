import { useState, type ReactNode } from 'react';
import { ChevronRight, type LucideIcon } from 'lucide-react';

// O quadradinho colorido do título (Proposta B, 02/10): cor só pra o olho achar
// a seção, com fundo claro e a versão do escuro.
const TONS = {
  azul: 'bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400',
  roxo: 'bg-violet-100 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400',
  rosa: 'bg-pink-100 text-pink-600 dark:bg-pink-950/60 dark:text-pink-400',
  laranja: 'bg-orange-100 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400',
  verde: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
} as const;

export type TomDaSecao = keyof typeof TONS;

interface SecaoProps {
  titulo: string;
  children: ReactNode;
  /** Começa fechada e abre no clique no título. No painel do lead, só Respostas do formulário. */
  recolhivel?: boolean;
  /** Ícone pequeno colorido antes do título. A seção recolhida fica sem. */
  icone?: { Icone: LucideIcon; tom: TomDaSecao };
}

/**
 * Uma seção do painel do lead: título pequeno e o conteúdo à vista, uma
 * embaixo da outra. Sem card dentro de card.
 */
export default function Secao({ titulo, children, recolhivel = false, icone }: SecaoProps) {
  const [aberta, setAberta] = useState(!recolhivel);

  return (
    <section aria-label={titulo} className="px-4 py-3 border-b border-border/60 space-y-2">
      {recolhivel ? (
        <button
          type="button"
          onClick={() => setAberta(a => !a)}
          aria-expanded={aberta}
          className="flex w-full items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className={`h-3 w-3 transition-transform ${aberta ? 'rotate-90' : ''}`} />
          {titulo}
        </button>
      ) : (
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {icone && (
            <span
              aria-hidden
              className={`inline-flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-[5px] ${TONS[icone.tom]}`}
            >
              <icone.Icone className="h-3 w-3" />
            </span>
          )}
          {titulo}
        </h3>
      )}
      {aberta && children}
    </section>
  );
}
