// CRITÉRIOS DO "SE / SENÃO" E DO "SÓ CONTINUAR SE" (spec 02/10, seção 5).
//
// Só os que funcionam. "Veio de" saiu: procurava texto solto nos campos do
// contato e respondia errado sem avisar (a origem é filtro do gatilho). O
// "Resposta de formulário" antigo, de digitar campo e valor, virou o critério
// novo ligado aos formulários de verdade. Os dois antigos continuam valendo no
// servidor e aparecem no bloco de fluxo antigo, só não são mais oferecidos.

import type { FlowNodeConfig } from '@/types/flowAutomations';
import { formAnswerOf, formAnswerProblem, formAnswerSentence } from './formAnswer';

export type ConditionCriterion = 'replied' | 'has_label' | 'at_stage' | 'has_email' | 'has_phone' | 'form_answer';

export const CONDITION_CRITERIA: Array<{ value: ConditionCriterion; label: string }> = [
  { value: 'replied', label: 'Respondeu nas últimas horas' },
  { value: 'has_label', label: 'Tem a etiqueta' },
  { value: 'at_stage', label: 'Está na etapa' },
  { value: 'has_email', label: 'Tem e-mail' },
  { value: 'has_phone', label: 'Tem telefone' },
  { value: 'form_answer', label: 'Resposta do formulário' },
];

export const LEGACY_CRITERIA_LABELS: Record<string, string> = {
  came_from: 'Veio de (não é mais oferecido)',
  form_response: 'Resposta de formulário, versão antiga (não é mais oferecida)',
};

export const isOfferedCriterion = (c: string): c is ConditionCriterion =>
  CONDITION_CRITERIA.some(x => x.value === c);

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

/**
 * O critério do bloco. O "Só continuar se" antigo não tinha critério: era só
 * uma lista de etiquetas (`labels`), que aqui vira "Tem a etiqueta".
 */
export function criterionOf(config: FlowNodeConfig | null | undefined): string {
  const c = str(config?.criterion);
  if (c) return c;
  if (Array.isArray(config?.labels)) return 'has_label';
  return 'replied';
}

/** A etiqueta do "Tem a etiqueta" (o bloco antigo guardava uma lista). */
export function labelOf(config: FlowNodeConfig | null | undefined): string {
  const one = str(config?.label);
  if (one) return one;
  return Array.isArray(config?.labels) ? str((config!.labels as unknown[])[0]) : '';
}

/**
 * Config ao trocar de critério: começa limpa, só com o que o critério novo usa.
 * No "Só continuar se" com etiqueta, grava também `labels` — é o que o motor
 * de antes da sprint 1 lê nesse bloco.
 */
export function configForCriterion(kind: 'condition' | 'filter_label', criterion: string): FlowNodeConfig {
  switch (criterion) {
    case 'replied':
      return { criterion, window_hours: 24 };
    case 'has_label':
      return kind === 'filter_label' ? { criterion, label: '', labels: [], mode: 'all' } : { criterion, label: '' };
    case 'at_stage':
      return { criterion, stage_id: '' };
    case 'form_answer':
      return { criterion, form_source: '', form_id: '', form_name: '', question_key: '', question_label: '', match: 'answered', values: [] };
    default:
      return { criterion };
  }
}

export function withLabel(kind: 'condition' | 'filter_label', config: FlowNodeConfig, label: string): FlowNodeConfig {
  const next: FlowNodeConfig = { ...config, criterion: 'has_label', label };
  if (kind === 'filter_label') {
    next.labels = label ? [label] : [];
    next.mode = 'all';
  }
  return next;
}

export interface ConditionLookups {
  stageName?: (stageId: string) => string | undefined;
}

/** A frase do bloco no canvas. */
export function conditionSentence(config: FlowNodeConfig | null | undefined, lookups: ConditionLookups = {}): string {
  const cfg = config ?? {};
  const criterion = criterionOf(cfg);
  switch (criterion) {
    case 'replied': {
      const hours = Number(cfg.window_hours) || 24;
      return `Se o lead respondeu nas últimas ${hours === 1 ? '1 hora' : `${hours} horas`}`;
    }
    case 'has_label': {
      const label = labelOf(cfg);
      return label ? `Se o lead tem a etiqueta "${label}"` : 'Tem a etiqueta: escolha a etiqueta';
    }
    case 'at_stage': {
      const id = str(cfg.stage_id);
      if (!id) return 'Está na etapa: escolha a etapa';
      return `Se o lead está na etapa "${lookups.stageName?.(id) ?? id}"`;
    }
    case 'has_email':
      return 'Se o lead tem e-mail';
    case 'has_phone':
      return 'Se o lead tem telefone';
    case 'form_answer':
      return formAnswerSentence(formAnswerOf(cfg));
    case 'came_from':
      return `Veio de "${str(cfg.value)}" (critério antigo)`;
    case 'form_response':
      return `Resposta de formulário "${str(cfg.field)}" (critério antigo)`;
    default:
      return criterion;
  }
}

/** O que falta pra salvar (null = pronto). */
export function conditionProblem(config: FlowNodeConfig): string | null {
  const criterion = criterionOf(config);
  if (criterion === 'has_label' && !labelOf(config)) return 'Escolha a etiqueta.';
  if (criterion === 'at_stage' && !str(config.stage_id)) return 'Escolha a etapa.';
  if (criterion === 'replied' && !(Number(config.window_hours) > 0)) return 'Diga quantas horas olhar pra trás.';
  if (criterion === 'form_answer') return formAnswerProblem(formAnswerOf(config));
  return null;
}
