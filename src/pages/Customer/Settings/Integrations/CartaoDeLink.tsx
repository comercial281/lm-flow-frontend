import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/ds';

// Cartão clicável de Integrações (entrada e Sistemas): o cartão da casa (Card,
// peça 20 do GLOSSARIO) dentro do link. Sobe um pouco, a borda fica roxa e
// acende um brilho roxo no canto ao passar o mouse.
export default function CartaoDeLink({ para, children }: { para: string; children: ReactNode }) {
  return (
    <Link
      to={para}
      className="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <Card className="relative h-full gap-3 overflow-hidden p-5 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:border-primary/40">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: 'rgba(124,58,237,0.16)' }}
        />
        <span className="relative flex flex-col gap-3">{children}</span>
      </Card>
    </Link>
  );
}
