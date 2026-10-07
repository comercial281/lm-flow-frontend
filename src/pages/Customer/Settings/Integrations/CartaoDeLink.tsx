import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

// Cartão clicável de Integrações (entrada e Sistemas), no mesmo visual dos
// cartões de Canais: fundo e borda do menu, sobe um pouco e brilha roxo no hover.
export default function CartaoDeLink({ para, children }: { para: string; children: ReactNode }) {
  return (
    <Link
      to={para}
      className="group relative flex h-full flex-col gap-3 overflow-hidden rounded-xl border border-sidebar-border bg-sidebar p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: 'rgba(124,58,237,0.16)' }}
      />
      <span className="relative flex flex-col gap-3">{children}</span>
    </Link>
  );
}
