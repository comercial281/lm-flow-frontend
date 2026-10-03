// "SÓ EM HORÁRIO COMERCIAL" (Automações · sprint 3, spec 03/10/2026).
//
// Uma janela só, a do follow-up de hoje: seg–sex 8h–20h e sáb 9h–18h. Vale em
// três lugares, com a MESMA frase na tela:
//   - Esperar e Aguardar resposta: `config.business_hours = true`; o prazo que
//     cai fora da janela passa pra próxima;
//   - configurações do fluxo: `business_hours_only` (o servidor guarda em
//     `state`); nenhuma mensagem do fluxo sai fora da janela.
// O modo antigo do Esperar ("saindo só em horário comercial", `mode: 'schedule'`)
// é lido como Esperar por um tempo + horário comercial.

import type { FlowAutomation, FlowNodeConfig } from '@/types/flowAutomations';

export const BUSINESS_HOURS_WINDOW = 'seg–sex 8h–20h, sáb 9h–18h';
export const BUSINESS_HOURS_LABEL = `Só em horário comercial (${BUSINESS_HOURS_WINDOW})`;

export const BUSINESS_HOURS_WAIT_HELP = 'Se o prazo acabar fora do horário comercial, ele passa pro próximo horário comercial.';
export const BUSINESS_HOURS_FLOW_HELP = 'Nenhuma mensagem deste fluxo sai fora do horário comercial: o envio espera o próximo horário comercial.';

/** O bloco Esperar/Aguardar resposta conta o prazo só em horário comercial? */
export function waitUsesBusinessHours(config: FlowNodeConfig | null | undefined): boolean {
  return config?.business_hours === true || config?.mode === 'schedule';
}

/** Liga/desliga no bloco. No Esperar, o modo antigo `schedule` vira `interval` + `business_hours`. */
export function withWaitBusinessHours(config: FlowNodeConfig, on: boolean): FlowNodeConfig {
  const next: FlowNodeConfig = { ...config, business_hours: on };
  if (next.mode === 'schedule') next.mode = 'interval';
  return next;
}

/** O modo do Esperar na tela: `schedule` (antigo) aparece como "Por um tempo". */
export function waitModeOf(config: FlowNodeConfig | null | undefined): 'interval' | 'date' {
  return config?.mode === 'date' ? 'date' : 'interval';
}

/** A chave das configurações do fluxo. Lê solto ou dentro de `state`. */
export function businessHoursOnlyOf(flow: Pick<FlowAutomation, 'business_hours_only' | 'state'> | null | undefined): boolean {
  return (flow?.business_hours_only ?? flow?.state?.business_hours_only) === true;
}
