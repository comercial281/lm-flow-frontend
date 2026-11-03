// Modo operante (fase 6, Tarefa 71): os textos e a conta da frase de fechamento. A tela só desenha.
import type { ExcecaoPronta, Job, NextStep, SalesAgent } from '@/services/salesAgents/salesAgentsService';

/** Os próximos passos, na ordem em que a tela mostra (e em que se grava). */
export const ORDEM_DOS_PASSOS: readonly NextStep[] = ['visita', 'videochamada', 'reuniao', 'ligacao'];

export const ROTULO_DO_PASSO: Record<NextStep, string> = {
  visita: 'Visita',
  videochamada: 'Reunião por vídeo',
  reuniao: 'Reunião no escritório',
  ligacao: 'Ligação',
};

/** Como a frase de fechamento chama cada passo ("Quer ___?"). */
const NA_FRASE: Record<NextStep, string> = {
  visita: 'conhecer o imóvel',
  videochamada: 'fazer uma chamada de vídeo',
  reuniao: 'passar no nosso escritório',
  ligacao: 'receber uma ligação',
};

/** As exceções que a casa liga ou desliga, na ordem da tela. */
export const ORDEM_DAS_PRONTAS: readonly ExcecaoPronta[] = [
  'recusou_documento', 'pediu_ligacao', 'nao_sei', 'pediu_pra_visitar', 'objecao_sem_contorno',
];

export const ROTULO_DA_EXCECAO: Record<ExcecaoPronta, string> = {
  recusou_documento: 'Recusou mandar documento',
  pediu_ligacao: 'Pediu ligação',
  nao_sei: 'Ela não sabe responder',
  pediu_pra_visitar: 'Pediu pra visitar',
  objecao_sem_contorno: 'Objeção que ela não contorna',
};

/** Passam na hora em qualquer modo, sem chave (o servidor trata fora das exceções). */
export const SEMPRE_LIGADAS = [
  'Lead irritado',
  'Pediu uma pessoa',
  'Percebeu que é IA',
  'Quer vender o imóvel dele',
  'Pediu o que esta IA não atende',
] as const;

/**
 * A frase de exemplo com que ela fecha a conversa. Muda com o que está marcado e com o
 * modo: Leva até a visita pergunta o dia; Filtra e passa avisa que o corretor assume.
 */
export function fraseDeFechamento(job: Job | null, nextSteps: readonly NextStep[] | null | undefined): string {
  const itens = (nextSteps ?? []).map((p) => NA_FRASE[p]);
  if (itens.length === 0) return 'Marque pelo menos um.';
  const fim = job === 'leva_visita' ? ' Qual dia fica melhor pra você?' : ' Já te passo pro corretor ver o melhor horário.';
  if (itens.length === 1) return `Quer ${itens[0]}?${fim}`;
  return `Você prefere ${itens.slice(0, -1).join(', ')} ou ${itens[itens.length - 1]}?${fim}`;
}

/**
 * As exceções prontas que valem pro agente: o servidor manda `handoff_exceptions_effective` (as cinco
 * como o cérebro lê AGORA, migrado ou não). Servidor antigo: o que está gravado em `prontas`; sem
 * nada disso, todas desmarcadas (a tela não inventa regra de migração).
 */
export function prontasDoAgente(agent: Pick<SalesAgent, 'handoff_exceptions' | 'handoff_exceptions_effective'>): Record<ExcecaoPronta, boolean> {
  const fonte: Partial<Record<ExcecaoPronta, boolean>> = agent.handoff_exceptions_effective ?? agent.handoff_exceptions?.prontas ?? {};
  return Object.fromEntries(ORDEM_DAS_PRONTAS.map((k) => [k, fonte[k] === true])) as Record<ExcecaoPronta, boolean>;
}
