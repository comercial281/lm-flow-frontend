import { useCan } from '@/hooks/useCan';
import { useFeature } from '@/contexts/TenantFeaturesContext';
import type { DashboardNovaPayload, FiltrosDashboard, ListaKind } from './types';
import type { Visao } from './catalogo';

/**
 * Quais destinos abrem. Número cujo destino não abre não é link.
 * Abre = o cargo abre E a chave do cliente está ligada (a mesma `featureKey`
 * do menu): tela fora do menu do cliente não vira destino de clique.
 */
export interface PodeAbrir {
  imoveis: boolean;
  agenda: boolean;
  propostas: boolean;
  funil: boolean;
  roleta: boolean;
  conversas: boolean;
}

export function usePodeAbrir(): PodeAbrir {
  const pode = useCan();
  const imoveisNoMenu = useFeature('properties');
  const agendaNoMenu = useFeature('visits');
  const propostasNoMenu = useFeature('proposals');
  const funilNoMenu = useFeature('pipelines');
  const conversasNoMenu = useFeature('conversations');
  return {
    imoveis: imoveisNoMenu && pode('properties', 'read'),
    agenda: agendaNoMenu && pode('visits', 'read'),
    propostas: propostasNoMenu && pode('proposals', 'read'),
    funil: funilNoMenu && pode('pipelines', 'read'),
    roleta: pode('roleta_configs', 'queue'),
    // A mesma permissão da rota /conversations (PermissionRoute em routes/index.tsx).
    conversas: conversasNoMenu && pode('conversations', 'read'),
  };
}

/** O que todo bloco recebe. */
export interface ContextoBloco {
  dados: DashboardNovaPayload | null;
  carregando: boolean;
  visao: Visao;
  pode: PodeAbrir;
  /** Os filtros pedidos agora: com `recorteBateComDestino` (visao.ts), decidem se um número vira link. */
  filtros: FiltrosDashboard;
  /** `limitado`: o número que abriu a lista tem teto no servidor (sai com +). */
  abrirLista: (kind: ListaKind, titulo: string, limitado?: boolean) => void;
  mudarFunil: (pipelineId: string) => void;
}
