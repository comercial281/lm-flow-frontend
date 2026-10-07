// Atalhos do painel do lead (07/10/2026): a fileira de botões redondos logo
// abaixo do nome (Agendar mensagem · IA · Agendar visita), inspirada no CRM do
// LM Hub. Aqui moram as regras puras; a fileira em `painel/AtalhosDoLead.tsx`.
import type { LeadPickerItem } from '@/services/visits/visitsService';
import type { Pipeline } from '@/types/analytics';
import type { SalesAgentCardState } from '@/types/analytics/pipelines';

/** O número deste lead tem IA Vendedora (sem IA, o botão liga/desliga algo que não existe). */
export function iaNoNumero(state: SalesAgentCardState | null): state is SalesAgentCardState {
  return Boolean(state && state.status !== 'none');
}

/**
 * Ligada = atendendo ou esperando o gatilho bater. É a régua do robô do topo da
 * conversa; o painel usa a mesma para os dois nunca discordarem na mesma tela.
 */
export function iaLigada(state: SalesAgentCardState | null): boolean {
  return state?.status === 'active' || state?.status === 'idle';
}

export function nomeDaAcaoIa(state: SalesAgentCardState): string {
  if (state.status === 'handoff') return 'Religar IA Vendedora';
  return iaLigada(state) ? 'Desligar IA Vendedora' : 'Ligar IA Vendedora';
}

export function dicaDaIa(state: SalesAgentCardState): string {
  if (state.status === 'handoff') return 'A IA passou este lead pra um corretor — clique para religar';
  return iaLigada(state) ? `${state.label} — clique para desativar` : `${state.label} — clique para reativar`;
}

/**
 * O robô existe no topo da conversa e no painel. Quem troca avisa pelo `window`
 * (mesmo jeito do `lmflow:agendados-mudaram`): os dois são irmãos na página e
 * o aviso evita subir o estado até o `Chat.tsx`.
 */
export const EVENTO_IA_MUDOU = 'lmflow:ia-mudou';

export interface IaMudouDetalhe {
  conversationId: string;
  state: SalesAgentCardState;
}

export function avisarIaMudou(conversationId: string | number, state: SalesAgentCardState): void {
  if (typeof window === 'undefined') return;
  const detail: IaMudouDetalhe = { conversationId: String(conversationId), state };
  window.dispatchEvent(new CustomEvent(EVENTO_IA_MUDOU, { detail }));
}

interface ContatoMinimo {
  id?: string | number | null;
  phone_number?: string | null;
  email?: string | null;
}

interface ItemDoFunil {
  pipeline_id?: string | null;
  assignee?: { id: string | number; name: string } | null;
}

/**
 * O lead que a janela de visita abre preenchido. No funil, leva o funil e o
 * responsável do card (o corretor da visita já vem escolhido), igual ao card.
 */
export function leadDoPainelParaVisita(
  contato: ContatoMinimo | null,
  pipelines: Pipeline[],
  nome: string,
): LeadPickerItem | null {
  if (contato?.id == null) return null;
  const item = pipelines
    .flatMap(p => p.stages ?? [])
    .flatMap(s => (s.items ?? []) as ItemDoFunil[])
    .find(Boolean);
  return {
    id: String(contato.id),
    name: nome,
    phone_number: contato.phone_number ?? null,
    email: contato.email ?? null,
    in_pipeline: Boolean(item),
    pipeline_id: item?.pipeline_id ?? null,
    owner: item?.assignee ? { id: String(item.assignee.id), name: item.assignee.name } : null,
  };
}
