import { Link, Outlet, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ExtrasDaMolduraContext } from '@/components/base/Pagina';
import { useMenuSecoes } from '@/contexts/MenuContext';
import { barraDoEndereco } from './cartoes';

// ── MOLDURA DAS TELAS DE INTEGRAÇÕES (07/10/2026) ───────────────────────────
//
// Rota-moldura sem endereço (como a PaginaComAbas): as telas mantêm o endereço
// de sempre. Desenha "← Integrações" (ou "← Sistemas" no CVCRM) acima do título
// da tela; não desenha título próprio. Sem o "voltar" na entrada (título
// próprio) e pra quem não vê Integrações (o corretor em "Meus números" usa a
// mesma tela de números).
export default function MolduraDeIntegracao() {
  const secoes = useMenuSecoes();
  const { pathname } = useLocation();

  const barra = barraDoEndereco(secoes, pathname);
  if (!barra) return <Outlet />;

  // Só o "← Integrações" (ou "← Sistemas") acima do título. O nome e o logo do
  // cartão saíram (07/10, padrão de telas): o título da página já diz.
  return (
    <ExtrasDaMolduraContext.Provider
      value={{
        acima: (
          <Link
            to={barra.voltarPara}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {barra.voltarRotulo}
          </Link>
        ),
      }}
    >
      <Outlet />
    </ExtrasDaMolduraContext.Provider>
  );
}
