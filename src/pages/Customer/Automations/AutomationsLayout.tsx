import { Navigate, useLocation } from 'react-router-dom';
import { useTenantFeatures } from '@/contexts/TenantFeaturesContext';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { useCan } from '@/hooks/useCan';
import {
  getCustomerMenuSections,
  filterMenuSections,
  itensDoMenu,
  type MenuSection,
} from '@/components/layout/config/menuItems';
import NoAccessState from '@/components/permissions/NoAccessState';
import PaginaComAbas from '@/components/base/PaginaComAbas';

// Moldura das telas em /automations/*. Até a fase 4 era UMA página com 7 abas
// (regras, funis, FlowBuilder, origem, follow-up, lembretes, roleta). No menu
// novo cada uma foi para o lugar dela — Fluxos de mensagem, Automações,
// Follow-up, Roleta de leads, Origem — SEM mudar o endereço. Quem decide título
// e abas agora é o item do menu dono do endereço (PaginaComAbas).

/** Telas de /automations que o menu leva, na ordem do menu. */
function telasDeAutomacoes(secoes: MenuSection[]): string[] {
  return itensDoMenu(secoes)
    .filter(i => !('abas' in i && i.abas?.length) && i.href.startsWith('/automations/'))
    .map(i => i.href);
}

export default function AutomationsLayout() {
  const { features, archivedKeys } = useTenantFeatures();
  const isSuper = useIsSuperAdmin();
  const pode = useCan();
  const location = useLocation();

  // /automations sem tela (link antigo) → primeira tela que a pessoa vê.
  if (location.pathname === '/automations' || location.pathname === '/automations/') {
    const sim = () => true;
    const comChave = (p: string) => {
      const [resource, action] = p.split('.');
      return pode(resource, action);
    };
    const secoes = getCustomerMenuSections();
    const porPlano = telasDeAutomacoes(
      filterMenuSections(secoes, sim, sim, sim, undefined, undefined, features, archivedKeys, isSuper),
    );
    const porCargo = telasDeAutomacoes(
      filterMenuSections(
        secoes,
        pode,
        ps => ps.some(comChave),
        ps => ps.every(comChave),
        undefined,
        undefined,
        features,
        archivedKeys,
        isSuper,
      ),
    );

    if (porPlano.length === 0) {
      // Nenhuma tela sobrevive nem antes do cargo — é o plano/feature do
      // cliente que não tem automação nenhuma, não o cargo da pessoa.
      return (
        <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
          Nenhuma automação disponível neste plano.
        </div>
      );
    }
    if (porCargo.length === 0) {
      // Havia tela pelo plano, mas o cargo não lê nenhuma — é o aviso do
      // cargo, não a mensagem de plano.
      return <NoAccessState />;
    }
    return <Navigate to={porCargo[0]} replace />;
  }

  return <PaginaComAbas />;
}
