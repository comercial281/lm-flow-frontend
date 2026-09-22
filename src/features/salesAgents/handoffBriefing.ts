import type { TransferConfig } from '@/services/salesAgents/salesAgentsService';

/**
 * O resumo do que a IA descobriu, viajando junto com o lead no repasse.
 *
 * Por que existe: a IA grava a cada mensagem temperatura, orçamento, região,
 * prazo e um resumo — e isso só aparecia no bloco *O que a IA entendeu*, na
 * lateral da conversa. Quem recebia o lead (aviso no WhatsApp, tela de aceite)
 * via nome, telefone e prazo, e perguntava tudo de novo ao lead.
 *
 * A escolha mora DENTRO do `transfer_config`, que já está na lista campo a campo
 * do `saveAgent` — campo solto do agente seria descartado em silêncio, com a tela
 * dizendo *Salvo*. Mesma casa das perguntas obrigatórias do checklist.
 */

/**
 * LIGADO em toda imobiliária: `!== false`, nunca `=== true`. Agente que nunca viu
 * a chave (todos, até alguém desligar) precisa aparecer ligado — senão o gestor
 * "liga" algo que já estava valendo. Mesma cicatriz do gotejamento do follow-up.
 */
export function briefingEnabled(cfg?: TransferConfig | null): boolean {
  return cfg?.briefing_enabled !== false;
}

/**
 * ⚠️ Trocar o cenário de repasse SUBSTITUI o `transfer_config` inteiro, de
 * propósito (a temperatura mínima e as perguntas obrigatórias só significam algo
 * dentro do cenário delas). Sem esta função a escolha do resumo seria apagada
 * junto, em silêncio: o gestor desligava o resumo, trocava o cenário depois e o
 * resumo voltava a sair sem ninguém ver.
 *
 * Só `false` viaja — é o único valor que é escolha de alguém; `true` é o padrão e
 * gravá-lo congelaria a escolha de hoje se o padrão da casa mudasse.
 */
export function keepBriefing(cfg: TransferConfig | null | undefined, next: TransferConfig): TransferConfig {
  return cfg?.briefing_enabled === false ? { ...next, briefing_enabled: false } : next;
}

/**
 * Liga/desliga preservando o cenário escolhido e o campo dele. Ligar REMOVE a
 * chave em vez de gravar `true`, pelo mesmo motivo acima.
 */
export function toggleBriefing(cfg: TransferConfig | null | undefined, enabled: boolean): TransferConfig {
  const base: TransferConfig = { ...(cfg ?? {}) };
  if (enabled) {
    delete base.briefing_enabled;
    return base;
  }
  return { ...base, briefing_enabled: false };
}
