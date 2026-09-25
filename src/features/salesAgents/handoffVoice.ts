import type { TransferConfig } from '@/services/salesAgents/salesAgentsService';

/**
 * A IA fala como o PRÓPRIO corretor do número.
 *
 * Relato do dono do produto (2026-09-25): no WhatsApp de uma corretora, a IA
 * dizia ao lead "deixa eu passar tudo pro meu colega do time" — para o lead, a
 * corretora passando o lead para outra pessoa. O comando da IA mandava isso, com
 * exemplo escrito, e o que ele ensinou no Aprendizado perdia. E quando ela
 * acertava a voz ("deixa eu confirmar e já te passo as opções"), não passava o
 * lead: nada dizia que aquela frase É o repasse.
 *
 * Quem muda o comando é o servidor; aqui é só a escolha. Ela mora DENTRO do
 * `transfer_config`, pelo mesmo motivo do resumo (handoffBriefing.ts): campo
 * solto do agente seria descartado pela lista campo a campo do `saveAgent`.
 */

export function speaksAsBroker(cfg?: TransferConfig | null): boolean {
  return cfg?.voice === 'first_person';
}

/**
 * Desligar REMOVE a chave: ausente é o padrão de sempre, e gravar o padrão
 * congelaria a escolha de hoje se o padrão da casa mudasse.
 */
export function toggleVoice(cfg: TransferConfig | null | undefined, on: boolean): TransferConfig {
  const base: TransferConfig = { ...(cfg ?? {}) };
  if (on) return { ...base, voice: 'first_person' };
  delete base.voice;
  return base;
}
