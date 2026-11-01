/**
 * A frase de COMO ELA PERGUNTA a intenção, conforme os caminhos marcados (Tarefa 72, 01/11/2026).
 * É o `perguntaIntencao` do protótipo de Campanhas: a página Público-alvo e produto usa com
 * "desta IA", a janela da campanha e o imóvel (Tarefas 77 e 78) com "desta campanha" e
 * "deste imóvel". A tela só descreve: quem decide o que a IA pergunta é o servidor
 * (`SalesAgents::IntentPaths`), que também só olha os caminhos de fábrica marcados.
 */
import type { CaminhoDaIntencao, Intencao } from '@/services/salesAgents/salesAgentsService';

/** Os quatro caminhos de fábrica, na ordem do catálogo do servidor. */
export const INTENCOES: readonly Intencao[] = ['moradia', 'investimento', 'primeiro_imovel', 'troca'];

export const ROTULO_DA_INTENCAO: Record<Intencao, string> = {
  moradia: 'Moradia',
  investimento: 'Investimento',
  primeiro_imovel: 'Primeiro imóvel',
  troca: 'Trocar de imóvel',
};

export interface FraseDaIntencao {
  texto: string;
  /** A versão de uma linha (o "O que a IA vai saber" da campanha). Vazia sem nada marcado. */
  curto: string;
}

const CRUZA = ' Antes de qualquer pergunta, ela cruza a campanha, o formulário, o que o fluxo já perguntou e o que a pessoa disse.';

/** `origem` completa "Todo lead ___ é tratado como": "desta IA", "deste imóvel", "desta campanha". */
export function fraseDaIntencao(lista: readonly Intencao[], origem: string): FraseDaIntencao {
  if (lista.length === 0) return { texto: 'Sem nada marcado: vale o padrão da IA.', curto: '' };
  if (lista.length === 1) {
    const nome = ROTULO_DA_INTENCAO[lista[0]];
    return { texto: `Não pergunta a intenção. Todo lead ${origem} é tratado como ${nome}.`, curto: `não pergunta; trata como ${nome}` };
  }
  const resto = lista.filter((k) => k === 'primeiro_imovel' || k === 'troca').map((k) => (k === 'primeiro_imovel' ? 'o primeiro imóvel' : 'troca de imóvel'));
  const descobre = resto.length ? `descobre pela conversa se é ${resto.join(' ou ')}, no máximo com uma pergunta natural ("você já tem imóvel hoje ou seria o primeiro?").` : '';
  if (lista.includes('investimento')) {
    const sub = descobre ? ` Se for morar, ${descobre}` : '';
    const menu = lista.length === 4 ? ' Nunca o menu com as 4 opções.' : '';
    return { texto: `Se nada responder antes, pergunta só: morar ou investir?${sub}${menu}${CRUZA}`, curto: 'se nada responder antes, só "morar ou investir?"' };
  }
  const sub = descobre ? ` ${descobre.charAt(0).toUpperCase()}${descobre.slice(1)}` : '';
  return { texto: `Não pergunta morar ou investir.${sub}${CRUZA}`, curto: 'não pergunta morar ou investir; descobre se é o primeiro pela conversa' };
}

/** Os de fábrica marcados de uma lista de caminhos, na ordem do catálogo (o próprio do cliente fica de fora). */
export function intencoesMarcadas(caminhos: readonly CaminhoDaIntencao[]): Intencao[] {
  return INTENCOES.filter((k) => caminhos.some((c) => c.chave === k && c.ativo !== false));
}
