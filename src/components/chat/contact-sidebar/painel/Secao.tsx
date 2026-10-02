import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

interface SecaoProps {
  titulo: string;
  children: ReactNode;
  /** Começa fechada e abre no clique no título. No painel do lead, só Respostas do formulário. */
  recolhivel?: boolean;
}

/**
 * Uma seção do painel do lead: título pequeno e o conteúdo à vista, uma
 * embaixo da outra. Sem card dentro de card.
 */
export default function Secao({ titulo, children, recolhivel = false }: SecaoProps) {
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
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h3>
      )}
      {aberta && children}
    </section>
  );
}
