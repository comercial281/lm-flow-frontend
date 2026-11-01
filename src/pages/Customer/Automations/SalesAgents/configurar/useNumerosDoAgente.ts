/**
 * Os números do agente (fase 2, tela da Tarefa 71). Escreve pela API própria dos números e, em
 * seguida, RELÊ o agente e entrega pra casca (`aoSalvo`): a página nunca guarda cópia do número
 * (armadilha 2 do Configurar). Erro: a frase do servidor num aviso, e nada é relido.
 */
import { useCallback } from 'react';
import { toast } from 'sonner';
import {
  salesAgentsService, type MudancaDoNumero, type NovoNumero, type SalesAgent,
} from '@/services/salesAgents/salesAgentsService';
import { motivoEscrito } from '@/features/salesAgents/erroDoServidor';
import { registrarSalvo } from './useGravarNaHora';

export interface NumerosDoAgente {
  /** Cada uma devolve `true` se gravou (e já releu o agente). */
  criar: (body: NovoNumero) => Promise<boolean>;
  mudar: (numberId: string, body: MudancaDoNumero) => Promise<boolean>;
  tirar: (numberId: string) => Promise<boolean>;
}

// ⚠️ UMA FILA POR AGENTE. Duas escritas de número em seguida (o blur da palavra e o clique em "Os do
// agente") chegariam fora de ordem, e cada uma relê o agente: a releitura velha pisaria na nova. A
// segunda espera a primeira terminar (escrita + releitura).
const filas = new Map<string, Promise<unknown>>();

export function useNumerosDoAgente(agent: SalesAgent, aoSalvo: (a: SalesAgent) => void): NumerosDoAgente {
  const id = agent.id;

  const executar = useCallback(async (escrever: () => Promise<{ warnings?: string[] } | void>): Promise<boolean> => {
    let avisos: string[] = [];
    try {
      const r = await escrever();
      avisos = (r && r.warnings) || [];
    } catch (e) {
      toast.error(motivoEscrito(e) ?? 'Não deu pra salvar o número. Tente de novo.');
      return false;
    }
    // O número já foi gravado: se a leitura falhar, a tela só avisa (a próxima leitura da IA corrige).
    try {
      const novo = await salesAgentsService.get(id);
      registrarSalvo(novo);
      aoSalvo(novo);
    } catch {
      toast.error('Salvou, mas não consegui atualizar a tela. Recarregue a página.');
    }
    if (avisos.length) toast.warning(avisos.join(' '));
    return true;
  }, [id, aoSalvo]);

  const rodar = useCallback((escrever: () => Promise<{ warnings?: string[] } | void>): Promise<boolean> => {
    const fila = (filas.get(id) ?? Promise.resolve()).then(() => executar(escrever), () => executar(escrever));
    filas.set(id, fila);
    return fila;
  }, [id, executar]);

  const criar = useCallback((body: NovoNumero) => rodar(() => salesAgentsService.criarNumero(id, body)), [id, rodar]);
  const mudar = useCallback((numberId: string, body: MudancaDoNumero) => rodar(() => salesAgentsService.atualizarNumero(id, numberId, body)), [id, rodar]);
  const tirar = useCallback((numberId: string) => rodar(() => salesAgentsService.tirarNumero(id, numberId)), [id, rodar]);

  return { criar, mudar, tirar };
}
