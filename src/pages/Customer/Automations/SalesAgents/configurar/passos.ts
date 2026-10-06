// Os 8 passos da configuração da IA (entrega 2). O mesmo passo a passo serve pra
// criar e pra editar; cada passo é clicável e tem o próprio Salvar.
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import type { InboxOption } from '../configuracao/comum';

export type NumeroDoPasso = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type DestinoDoPasso = NumeroDoPasso | 'avancado';

export const PASSOS: { numero: NumeroDoPasso; titulo: string; frase: string }[] = [
  { numero: 1, titulo: 'Quem ela é', frase: 'Como ela se apresenta e o jeito de falar.' },
  { numero: 2, titulo: 'Objetivo', frase: 'Até onde ela vai, quando passa o lead e pra quem.' },
  { numero: 3, titulo: 'Roteiro', frase: 'A primeira mensagem, as perguntas e o que ela não faz.' },
  { numero: 4, titulo: 'Visita', frase: 'Como ela marca a visita na agenda.' },
  { numero: 5, titulo: 'O que ela vende', frase: 'Tipo de venda, imóveis e materiais que ela pode mandar.' },
  { numero: 6, titulo: 'Atendimento', frase: 'Número, quem ela atende e em que horário.' },
  { numero: 7, titulo: 'Voltar a chamar', frase: 'O que ela faz quando o lead some.' },
  { numero: 8, titulo: 'Testar e ligar', frase: 'Confira tudo, teste e ligue.' },
];

export function passoDaUrl(valor: string | null): DestinoDoPasso | null {
  if (valor === 'avancado') return 'avancado';
  const n = Number(valor);
  return Number.isInteger(n) && n >= 1 && n <= 8 ? (n as NumeroDoPasso) : null;
}

export interface PropsDoPasso {
  agent: SalesAgent;
  inboxes: InboxOption[];
  aoSalvo: (agent: SalesAgent) => void;
  irParaPasso: (destino: DestinoDoPasso) => void;
}
