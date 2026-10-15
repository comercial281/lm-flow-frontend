// src/pages/Customer/Pipelines/quadro/miniCard.ts
// O que o mini card mostra quando o mouse fica parado em cima de um card do
// quadro (pedido do Tony, 15/10/2026, versão "Enxuto"): telefone, há quanto
// tempo o lead está na etapa e a próxima tarefa. A peça só pinta: as frases
// saem daqui.
import { quandoAcontece, telefone } from '@/lib/formato';
import { contatoDoCard } from '@/features/cardDoLead/cardDoLead';
import { emOfertaParaQuemVe, mascararTelefone } from '@/features/conversas/painelDoLead';
import { situacaoDe } from '@/features/pipelines/situacao/situacao';
import type { PipelineItem } from '@/types/analytics';

/** Quanto o mouse precisa ficar parado em cima do card. */
export const ESPERA_DO_MINI_CARD_MS = 800;

export interface TelefoneDoMiniCard {
  texto: string;
  /** Oferta da roleta não aceita: mascarado e sem Copiar. */
  mascarado: boolean;
  /** O número pra copiar (só quando não está mascarado). */
  copiar: string | null;
}

/**
 * Mesma régua de Conversas: lead sem dono com oferta aberta pra quem vê (ou com
 * a lista de ofertas ainda chegando) não mostra o número.
 */
export function telefoneDoMiniCard(
  item: PipelineItem,
  ofertas: { carregadas: boolean; temOferta: boolean },
): TelefoneDoMiniCard | null {
  const cru = contatoDoCard(item)?.phone_number;
  if (!cru) return null;
  const semDono = !(item.assignee ?? item.conversation?.assignee);
  if (emOfertaParaQuemVe({ semDono, ofertasCarregadas: ofertas.carregadas, temOferta: ofertas.temOferta })) {
    return { texto: mascararTelefone(cru) ?? '—', mascarado: true, copiar: null };
  }
  return { texto: telefone(cru), mascarado: false, copiar: cru };
}

/** "Nesta etapa há 4 dias". Card ganho ou perdido não tem essa linha. */
export function linhaDaEtapa(item: PipelineItem): string | null {
  if (situacaoDe(item) !== 'open') return null;
  const dias = item.days_in_current_stage;
  if (dias == null || dias < 0) return null;
  if (dias === 0) return 'Nesta etapa há menos de 1 dia';
  return `Nesta etapa há ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
}

export interface ProximaTarefa {
  dueAt: string | null;
  atrasada: boolean;
}

/**
 * A tarefa aberta de prazo mais próximo (sem prazo vai pro fim), pelo que o
 * quadro já trouxe. É ela que decide se vale perguntar o título ao servidor.
 */
export function proximaTarefa(item: PipelineItem, agora: Date = new Date()): ProximaTarefa | null {
  const abertas = item.tasks_info?.open_tasks;
  if (!abertas || abertas.length === 0) return null;
  const ordenadas = [...abertas].sort((a, b) => {
    if (!a.due_at) return b.due_at ? 1 : 0;
    if (!b.due_at) return -1;
    return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
  });
  const dueAt = ordenadas[0].due_at;
  return { dueAt, atrasada: Boolean(dueAt && new Date(dueAt).getTime() < agora.getTime()) };
}

/** "Mandar simulação · amanhã às 09:30"; sem título, "Tarefa marcada". */
export function textoDaTarefa(titulo: string | null | undefined, dueAt: string | null, agora: Date = new Date()): string {
  const nome = titulo?.trim() || 'Tarefa marcada';
  if (!dueAt) return `${nome} · sem prazo`;
  const quando = quandoAcontece(dueAt, agora);
  return `${nome} · ${quando.charAt(0).toLowerCase()}${quando.slice(1)}`;
}

/** Abre à direita do card; na última coluna, ou sem espaço à direita, abre à esquerda. */
export function posicaoDoMiniCard(
  card: { left: number; right: number; top: number },
  tela: { largura: number; altura: number },
  mini: { largura: number; altura: number },
  ultimaColuna: boolean,
): { left: number; top: number; lado: 'direita' | 'esquerda' } {
  const VAO = 8;
  const MARGEM = 8;
  const cabeDireita = card.right + VAO + mini.largura <= tela.largura - MARGEM;
  const lado = !ultimaColuna && cabeDireita ? 'direita' : 'esquerda';
  let left = lado === 'direita' ? card.right + VAO : card.left - VAO - mini.largura;
  left = Math.max(MARGEM, Math.min(left, tela.largura - mini.largura - MARGEM));
  const top = Math.max(MARGEM, Math.min(card.top, tela.altura - mini.altura - MARGEM));
  return { left, top, lado };
}
