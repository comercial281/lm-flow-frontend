/**
 * Listas de escolha do assistente. Os textos espelham os da tela de
 * configuração (SalesAgents.tsx): são as MESMAS opções, ditas do mesmo jeito,
 * senão a pessoa configura um "cenário" aqui e procura outro nome lá.
 */
import type { HandoffMode, IntentQuestionMode, SalesAgentFollowupAction } from '@/services/salesAgents/salesAgentsService';

export interface Opcao<T extends string> {
  value: T;
  title: string;
  desc: string;
}

export const ETAPAS: { key: string; titulo: string; resumo: string }[] = [
  { key: 'quem', titulo: 'Quem é a IA', resumo: 'Nome, imobiliária, tom e apresentação.' },
  { key: 'vende', titulo: 'O que vocês vendem', resumo: 'Tipo de venda e como chamam o produto.' },
  { key: 'rumo', titulo: 'O rumo da conversa', resumo: 'Perguntas, dor, objeções e o próximo passo.' },
  { key: 'limites', titulo: 'Limites', resumo: 'O que ela nunca diz e quando chama gente na hora.' },
  { key: 'operacao', titulo: 'Operação', resumo: 'Horários, repasse, follow-up e o funil.' },
  { key: 'revisao', titulo: 'Revisão', resumo: 'Confira tudo antes de gravar.' },
];

export const HANDOFF_OPCOES: Opcao<HandoffMode | ''>[] = [
  { value: '', title: 'Como está hoje', desc: 'Ela passa quando julgar necessário. É o que já estava valendo.' },
  { value: 'duvida', title: 'Ao menor sinal de dúvida', desc: 'Qualquer insegurança dela vira repasse. O corretor recebe bastante lead, e cedo.' },
  { value: 'temperatura', title: 'Só quando o lead estiver quente', desc: 'Ela conduz sozinha — qualifica, manda material, oferece a visita — e só entrega depois que o lead esquenta.' },
  { value: 'sem_resposta', title: 'Só se ela não souber responder', desc: 'Repassa quando a resposta não está no que você deu a ela, ou quando as Instruções mandam passar aquele caso.' },
  { value: 'pos_visita', title: 'Só depois de agendar a visita', desc: 'O mais autônomo: ela só entrega com a visita marcada, ou quando bate numa objeção que não conseguiu contornar.' },
];

export const FOLLOWUP_OPCOES: Opcao<SalesAgentFollowupAction>[] = [
  { value: 'ai', title: 'A IA escreve a mensagem', desc: 'Ela lê a conversa e escreve uma cutucada curta. É o único caminho que consome IA.' },
  { value: 'pipeline', title: 'Mover o card para uma coluna', desc: 'A IA leva o card para a coluna que você escolher e sai de cena. Quem manda a mensagem é o funil que essa coluna dispara. Não consome IA.' },
  { value: 'sequence', title: 'Disparar um funil pronto', desc: 'A IA coloca o lead no funil escolhido, sem mexer no card. Para quem não usa o quadro. Não consome IA.' },
];

export const INTENCAO_OPCOES: Opcao<IntentQuestionMode>[] = [
  { value: 'always', title: 'Sempre', desc: 'Faz a pergunta na abertura e retoma o assunto se o lead desviar. É o padrão da casa.' },
  { value: 'opening_only', title: 'Só na abertura', desc: 'Pergunta uma vez, no começo, e depois deduz pelo que o lead fala.' },
  { value: 'never', title: 'Nunca', desc: 'Não pergunta. A IA abre acolhendo, cita o imóvel de origem e vai para as perguntas de situação da sua imobiliária.' },
];

/** Os momentos da conversa que a IA sabe apontar. Mesma lista da tela de configuração. */
export const MOMENTOS: { key: string; titulo: string; ajuda: string }[] = [
  { key: 'descobrindo', titulo: 'Descobrindo o que o lead quer', ajuda: 'Primeiras mensagens, ainda entendendo a procura.' },
  { key: 'qualificando', titulo: 'Qualificando', ajuda: 'Já sabe região, orçamento ou prazo.' },
  { key: 'pronto_para_visita', titulo: 'Pronto para visita', ajuda: 'O lead demonstrou interesse real em conhecer o imóvel.' },
  { key: 'agendando', titulo: 'Combinando dia e hora', ajuda: 'Está fechando o horário da visita com o lead.' },
  { key: 'agendado', titulo: 'Visita agendada', ajuda: 'A visita foi marcada de verdade (a IA criou a visita).' },
  { key: 'transferir', titulo: 'Passou pro corretor', ajuda: 'A IA entregou o lead para uma pessoa.' },
];

/** Reserva para quando o servidor não devolver as listas do roteiro. */
export const TIPOS_DE_VENDA_RESERVA = [
  { value: 'lancamento', label: 'Lançamento na planta' },
  { value: 'usado', label: 'Imóvel usado / pronto' },
  { value: 'loteamento', label: 'Loteamento' },
  { value: 'locacao', label: 'Locação' },
  { value: 'misto', label: 'Misto (mais de um tipo)' },
];

export const PROXIMOS_PASSOS_RESERVA = [
  { value: 'visita', label: 'Visita presencial' },
  { value: 'videochamada', label: 'Videochamada / tour por vídeo' },
  { value: 'ligacao', label: 'Ligação do corretor' },
  { value: 'book', label: 'Envio do book / material' },
];

/** Chave do rascunho no navegador, por IA. */
export const chaveDoRascunho = (agentId: string) => `lmflow:assistente-ia:${agentId}`;

/**
 * Lê o motivo de um erro da API. Ela tem DOIS formatos: o padrão (`error.message`)
 * e a recusa por cargo (`error` como texto, explicação em `message`). Ler só o
 * primeiro faz "seu cargo não permite" virar frase genérica.
 */
export function motivoDoErro(err: unknown): string | null {
  const r = (err as { response?: { data?: { error?: unknown; message?: string } } })?.response?.data;
  if (!r) return null;
  if (typeof r.error === 'object' && r.error && (r.error as { message?: string }).message) {
    return String((r.error as { message?: string }).message);
  }
  if (typeof r.error === 'string' && r.error) return r.message ? `${r.error}: ${r.message}` : r.error;
  if (r.message) return String(r.message);
  return null;
}
