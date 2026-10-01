import { useCan } from '@/hooks/useCan';
import { useFeature } from '@/contexts/TenantFeaturesContext';
import type { DashboardNovaPayload, ListaKind } from './types';
import type { Visao } from './catalogo';

/** Quais destinos o cargo abre. Número cujo destino o cargo não abre não é link. */
export interface PodeAbrir {
  imoveis: boolean;
  agenda: boolean;
  propostas: boolean;
  funil: boolean;
  roleta: boolean;
}

export function usePodeAbrir(): PodeAbrir {
  const pode = useCan();
  const propostasNoMenu = useFeature('proposals');
  return {
    imoveis: pode('properties', 'read'),
    agenda: pode('visits', 'read'),
    propostas: propostasNoMenu && pode('proposals', 'read'),
    funil: pode('pipelines', 'read'),
    roleta: pode('roleta_configs', 'queue'),
  };
}

/** O que todo bloco recebe. */
export interface ContextoBloco {
  dados: DashboardNovaPayload | null;
  carregando: boolean;
  visao: Visao;
  pode: PodeAbrir;
  abrirLista: (kind: ListaKind, titulo: string) => void;
  mudarFunil: (pipelineId: string) => void;
}
