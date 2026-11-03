// O Novo agente em 4 passos (fase 6, tarefa 69). Só a conta: a tela desenha.
// Cria DESLIGADO (C11: salvar nunca recusa; quem recusa é o ligar, depois).
import type {
  HouseVoice, Job, Marca, QuemFala, SalesAgent, SalesAgentPayload, SalesAgentTrigger,
} from '@/services/salesAgents/salesAgentsService';

export interface RascunhoDoNovo {
  nome: string;
  /** O modo operante. Nulo = ainda não escolhido. */
  job: Job | null;
  /** Os números marcados (id do canal), na ordem em que foram marcados. */
  inboxIds: string[];
  /** A ficha da casa. */
  casa: HouseVoice;
  /** As marcas que ele vende. */
  serves: Marca[];
}

export const PASSOS_DO_NOVO = ['Modo operante', 'Números e usuários', 'Quem fala', 'Produto'] as const;
export const ORDEM_DAS_MARCAS: Marca[] = ['venda', 'locacao', 'leilao', 'empreendimento'];

export function rascunhoVazio(): RascunhoDoNovo {
  return { nome: '', job: null, inboxIds: [], casa: { kind: 'consultora' as QuemFala }, serves: [] };
}

/** As marcas com imóvel no cadastro, na ordem da tela. A contagem vem do servidor. */
export function marcasComImovel(contagem: Partial<Record<Marca, number>> | null | undefined): Marca[] {
  return ORDEM_DAS_MARCAS.filter((m) => (contagem?.[m] ?? 0) > 0);
}

/**
 * O corpo do `create`. Sempre desligado e com a visita de próximo passo. O número
 * não vai aqui: entra depois, um a um (`criarNumero`). Sem marca escolhida, valem as
 * que têm imóvel; sem nenhuma, `serves` não vai e o servidor decide.
 */
export function payloadDoNovo(r: RascunhoDoNovo, comImovel: Marca[] = []): SalesAgentPayload {
  const serves = r.serves.length ? r.serves : comImovel;
  const casa: HouseVoice = {};
  if (r.casa.kind) casa.kind = r.casa.kind;
  if (r.casa.name?.trim()) casa.name = r.casa.name.trim();
  if (r.casa.gender) casa.gender = r.casa.gender;
  if (r.casa.intro?.trim()) casa.intro = r.casa.intro.trim();
  return {
    name: r.nome.trim(),
    enabled: false,
    ...(r.job ? { job: r.job } : {}),
    next_steps: ['visita'],
    // Na voz Corretor o servidor só aceita o dono do número; nas outras, a roleta.
    handoff_target: casa.kind === 'corretor' ? 'number_owner' : 'roleta',
    house_voice: casa,
    ...(serves.length ? { serves } : {}),
  };
}

const temGatilho = (t: SalesAgentTrigger[] | null | undefined) => (t ?? []).length > 0;

/**
 * Seção 8 da spec: só agente LIGADO conta pra regra do número dividido. Ligado e
 * atendendo todo lead naquele número (sem gatilho próprio nem herdado), o novo agente
 * só divide o número se o outro ganhar gatilhos. Desligado ou rascunho: nada muda.
 */
export function avisoDoNumero(inboxId: string, agentes: SalesAgent[]): string | null {
  for (const a of agentes) {
    if (a.absorbed_into_id || !a.enabled) continue;
    const n = (a.numbers ?? []).find((x) => String(x.inbox_id) === String(inboxId));
    if (!n) continue;
    const gatilhos = n.triggers ?? a.triggers;
    if (temGatilho(gatilhos) || a.trigger_keyword?.trim()) continue;
    return `pra dividir este número, o agente ${a.name} vai precisar de gatilhos; ele não muda até você ligar este`;
  }
  return null;
}

/** Os agentes (não juntados) que já têm o número, pelo nome. */
export function agentesDoNumero(inboxId: string, agentes: SalesAgent[]): string[] {
  return agentes
    .filter((a) => !a.absorbed_into_id && (a.numbers ?? []).some((n) => String(n.inbox_id) === String(inboxId)))
    .map((a) => a.name);
}

/** O "Seguir" de cada passo (1 a 4). O 4 é o último: vale pro "Criar agente desligado". */
export function podeSeguir(passo: number, r: RascunhoDoNovo): boolean {
  if (passo === 1) return !!r.job && r.nome.trim().length > 0;
  if (passo === 4) return r.serves.length > 0;
  return true;
}
