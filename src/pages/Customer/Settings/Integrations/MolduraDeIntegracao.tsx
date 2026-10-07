import { useEffect, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useMenuSecoes } from '@/contexts/MenuContext';
import { barraDoEndereco } from './cartoes';
import SeloDoCartao from './SeloDoCartao';

// ── MOLDURA DAS TELAS DE INTEGRAÇÕES (07/10/2026) ───────────────────────────
//
// Rota-moldura sem endereço (como a PaginaComAbas): as telas mantêm o endereço
// de sempre. Desenha "← Integrações" (ou "← Sistemas" no CVCRM) + o cartão. Sem
// barra na entrada (título próprio) e pra quem não vê Integrações (o corretor em
// "Meus números" usa a mesma tela de números).
export default function MolduraDeIntegracao() {
  const secoes = useMenuSecoes();
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // Mesmo motivo da PaginaComAbas: o <main> não troca entre telas, o scroll sim.
  useEffect(() => {
    mainRef.current?.scrollTo?.(0, 0);
  }, [pathname]);

  const barra = barraDoEndereco(secoes, pathname);
  if (!barra) return <Outlet />;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border px-6 py-3">
        <Link
          to={barra.voltarPara}
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {barra.voltarRotulo}
        </Link>
        <span aria-hidden="true" className="h-4 w-px bg-border" />
        <SeloDoCartao logo={barra.logo} icone={barra.icone} tamanho="pequeno" />
        <span className="font-semibold text-foreground">{barra.nome}</span>
      </div>
      <main ref={mainRef} className="min-w-0 flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
