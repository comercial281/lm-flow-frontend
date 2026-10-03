// "MARCAR PROGRESSO" NO MANDAR WHATSAPP (Automações · sprint 3, spec 03/10/2026).
//
// Quando a mensagem sai, o servidor aplica a etiqueta `<prefixo>-msg-N` no
// contato e na conversa e tira a anterior do mesmo prefixo (a regra do
// follow-up de hoje: etiqueta lilás, uma por vez). É o que deixa a escada
// "Se tem a etiqueta <funil>-msg-2 → vai pra Mensagem 3" continuar de onde o
// lead parou.
//
// Config: `progress_tag_prefix` (texto) + `progress_step` (número N). Sem
// `progress_tag_prefix` = não marca.

import type { FlowNodeConfig } from '@/types/flowAutomations';

export interface ProgressMark {
  on: boolean;
  prefix: string;
  step: number;
}

export function progressOf(config: FlowNodeConfig | null | undefined): ProgressMark {
  const on = typeof config?.progress_tag_prefix === 'string';
  const step = Math.floor(Number(config?.progress_step));
  return {
    on,
    prefix: on ? String(config?.progress_tag_prefix) : '',
    step: Number.isFinite(step) && step >= 1 ? step : 1,
  };
}

/** Etiqueta vira minúscula, sem acento e sem espaço (o servidor procura `<prefixo>-msg-*`). */
export function cleanProgressPrefix(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '');
}

export function progressTagName(prefix: string, step: number): string {
  return `${prefix}-msg-${step}`;
}

/** Liga/desliga e ajusta a marca. Desligar tira as duas chaves da config. */
export function withProgress(config: FlowNodeConfig, mark: ProgressMark): FlowNodeConfig {
  const { progress_tag_prefix: _p, progress_step: _s, ...rest } = config;
  if (!mark.on) return rest;
  return { ...rest, progress_tag_prefix: cleanProgressPrefix(mark.prefix), progress_step: Math.max(1, Math.floor(mark.step) || 1) };
}

/** O que falta na marca, ou null. */
export function progressProblem(config: FlowNodeConfig | null | undefined): string | null {
  const mark = progressOf(config);
  if (!mark.on) return null;
  return mark.prefix.trim() ? null : 'Escreva o nome da etiqueta de progresso.';
}

/** A linha do cartão: "Marca a etiqueta funil-msg-2". */
export function progressLine(config: FlowNodeConfig | null | undefined): string | null {
  const mark = progressOf(config);
  if (!mark.on || !mark.prefix) return null;
  return `Marca o progresso: ${progressTagName(mark.prefix, mark.step)}`;
}
