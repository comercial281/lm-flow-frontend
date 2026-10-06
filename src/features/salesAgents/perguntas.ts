/**
 * A lista de PERGUNTAS do passo 3 (Roteiro): cada pergunta com "obrigatória".
 *
 * Grava em dois lugares que já existem: `qualification_questions` (texto e ordem) e
 * `transfer_config.required_questions` (as marcadas). A leitura usa a mesma regra
 * do cenário do checklist (`checklistItems`): lista de obrigatórias VAZIA no
 * servidor quer dizer TODAS, e obrigatória que saiu da lista continua valendo — por
 * isso ela volta no fim, em vez de sumir calada.
 *
 * Na gravação as marcadas vão EXPLÍCITAS. A tela não deixa desmarcar a última (sem
 * nenhuma marcada o servidor lê "todas", e a caixinha voltaria marcada sozinha).
 */
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { checklistItems } from './handoffChecklist';

export interface Pergunta {
  texto: string;
  obrigatoria: boolean;
}

type Lido = Pick<SalesAgent, 'qualification_questions' | 'transfer_config'>;

export function perguntasDoAgente(agent: Lido): Pergunta[] {
  return checklistItems(agent.qualification_questions ?? [], agent.transfer_config?.required_questions)
    .map((i) => ({ texto: i.text, obrigatoria: i.required }));
}

export function perguntasParaPatch(lista: Pergunta[], agent: Lido): Lido {
  const limpas = lista.map((p) => ({ ...p, texto: p.texto.trim() })).filter((p) => p.texto);
  return {
    qualification_questions: limpas.map((p) => p.texto),
    transfer_config: { ...(agent.transfer_config ?? {}), required_questions: limpas.filter((p) => p.obrigatoria).map((p) => p.texto) },
  };
}
