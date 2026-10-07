import { Outlet, useLocation } from 'react-router-dom';
import Abas from '@/components/base/Abas';
import { ExtrasDaMolduraContext } from '@/components/base/Pagina';
import { useMenuSecoes } from '@/contexts/MenuContext';
import { donoDoEndereco } from '@/components/layout/config/menuItems';

// ── PÁGINA COM ABAS (fase 4) ─────────────────────────────────────────────────
//
// Moldura das páginas que juntam várias telas sob um assunto (Bolsão,
// Campos personalizados; Integrações usa a MolduraDeIntegracao). Entra como
// rota-moldura SEM endereço próprio: as telas de dentro mantêm o endereço que
// já tinham, então link salvo e link com filtro continuam valendo.
//
// Abas vêm do item do menu dono do endereço, na lista JÁ filtrada pelo cargo
// (MenuContext). Aba que a pessoa não pode abrir não aparece. Não desenha
// título: o título é o da tela (Pagina + BaseHeader). As abas vão pela
// ExtrasDaMolduraContext e aparecem logo abaixo dele. Com uma aba só (o
// corretor no Bolsão) não entrega nada: uma fileira com uma aba é ruído.
export default function PaginaComAbas() {
  const secoes = useMenuSecoes();
  const { pathname } = useLocation();

  const dono = donoDoEndereco(secoes, pathname);
  const abas = dono?.aba ? dono.item.abas ?? [] : [];

  if (!dono || abas.length < 2) return <Outlet />;

  // Trocar de aba com alteração não salva pergunta antes (Abas da casa). A tela
  // de cada aba é outra rota: a Pagina dela já abre do topo.
  return (
    <ExtrasDaMolduraContext.Provider
      value={{
        abaixoDoCabecalho: (
          <Abas
            rotulo={`Abas de ${dono.item.name}`}
            abas={abas.map(aba => ({ chave: aba.href, rotulo: aba.name, icone: aba.icon, para: aba.href, exata: aba.exata }))}
          />
        ),
      }}
    >
      <Outlet />
    </ExtrasDaMolduraContext.Provider>
  );
}
