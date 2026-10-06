import type { ComparisonItem, ComparisonResult, ComparisonScores } from '@/services/superAdmin/superAgentsService';
import type { TestHistoryItem } from '@/services/salesAgents/salesAgentsService';

export const ITENS_DA_REGUA: ReadonlyArray<{ chave: ComparisonItem; rotulo: string }> = [
  { chave: 'obrigatorias', rotulo: 'Obrigatórias antes de passar' },
  { chave: 'repasse', rotulo: 'Hora e destino do repasse' },
  { chave: 'persona', rotulo: 'Quem ela é' },
  { chave: 'configuracao', rotulo: 'Configuração respeitada' },
  { chave: 'puxou_conversa', rotulo: 'Terminou puxando a conversa' },
  { chave: 'seguranca', rotulo: 'Regra de segurança' },
];

/** Roteiros que dá pra comparar. A entrega 4 acrescenta o 2. */
export const ROTEIROS_DISPONIVEIS: number[] = [1];

export type ItemDaFila =
  | { tipo: 'conversa'; conversationId: string; pointIndex: number }
  | { tipo: 'cenario'; id: string; message: string; history: TestHistoryItem[] };

export function filaDeAvaliacao(
  conversas: Array<{ id: string; points: number }>,
  cenarios: Array<{ id: string; firstMessage: string; history?: TestHistoryItem[] }>,
): ItemDaFila[] {
  const fila: ItemDaFila[] = [];
  conversas.forEach((c) => {
    for (let i = 0; i < c.points; i += 1) fila.push({ tipo: 'conversa', conversationId: c.id, pointIndex: i });
  });
  cenarios.forEach((c) => fila.push({ tipo: 'cenario', id: c.id, message: c.firstMessage, history: c.history ?? [] }));
  return fila;
}

export function corpoDoItem(item: ItemDaFila) {
  return item.tipo === 'conversa'
    ? { conversation_id: item.conversationId, point_index: item.pointIndex }
    : { scenario: { id: item.id, message: item.message, history: item.history } };
}

export function nota(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : String(n);
}

export interface Resumo {
  itens: Array<{ chave: ComparisonItem; rotulo: string; mediaAntigo: number | null; mediaNovo: number | null }>;
  quebrasAntigo: number;
  quebrasNovo: number;
  discordancias: number;
  total: number;
}

function media(valores: Array<number | null>): number | null {
  const v = valores.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export function resumo(pares: ComparisonResult[]): Resumo {
  const de = (lado: 'baseline' | 'candidate', chave: ComparisonItem) => pares.map((p) => (p[lado].scores as ComparisonScores)[chave]);
  return {
    itens: ITENS_DA_REGUA.map(({ chave, rotulo }) => ({
      chave, rotulo, mediaAntigo: media(de('baseline', chave)), mediaNovo: media(de('candidate', chave)),
    })),
    quebrasAntigo: pares.filter((p) => p.baseline.scores.seguranca === 0).length,
    quebrasNovo: pares.filter((p) => p.candidate.scores.seguranca === 0).length,
    discordancias: pares.filter((p) => p.disagreement).length,
    total: pares.length,
  };
}

/** A regra da spec pra ligar: empata ou ganha em todos os itens e não quebra segurança. */
export function veredito(r: Resumo): string {
  if (r.quebrasNovo > 0) {
    return `O novo quebrou regra de segurança em ${r.quebrasNovo} ${r.quebrasNovo === 1 ? 'resposta' : 'respostas'}.`;
  }
  const perde = r.itens.filter((i) => i.mediaAntigo !== null && i.mediaNovo !== null && i.mediaNovo < i.mediaAntigo);
  if (perde.length) return `O novo perde em: ${perde.map((i) => i.rotulo).join(', ')}.`;
  return 'O novo empata ou ganha em todos os itens e não quebra regra de segurança.';
}

const fmt = (n: number | null) => (n === null ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

export function resumoEmTexto(r: Resumo, nomeDaIa: string, antigo: number, novo: number): string {
  return [
    `${nomeDaIa} — roteiro ${antigo} × roteiro ${novo} — ${r.total} respostas`,
    '',
    '| Item | Antigo | Novo |',
    '|---|---|---|',
    ...r.itens.map((i) => `| ${i.rotulo} | ${fmt(i.mediaAntigo)} | ${fmt(i.mediaNovo)} |`),
    '',
    `Discordâncias: ${r.discordancias}. Quebras de segurança: antigo ${r.quebrasAntigo}, novo ${r.quebrasNovo}.`,
    veredito(r),
  ].join('\n');
}
