import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import type { PedidoDeConfirmacao } from '@/hooks/useConfirmacao';
import type { Gravar } from '../../../configurar/useGravarNaHora';
import type { Licoes } from '../useLicoes';
import type { Arquivos } from '../useArquivos';
import type { PaginaDoEnsinar } from '../paginas';

export interface PropsDaPaginaDoEnsinar {
  agent: SalesAgent;
  /** Grava na hora os campos da IA (instructions, social_proof, example_conversations). */
  gravar: Gravar;
  licoes: Licoes;
  arquivos: Arquivos;
  irPara: (p: PaginaDoEnsinar) => void;
  confirmar: (p: PedidoDeConfirmacao) => Promise<boolean>;
}
