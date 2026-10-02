// GATILHO DO FLUXO (Automações · sprint 1, spec de 02/10/2026).
//
// O construtor usa a MESMA lista, os MESMOS nomes na tela e os MESMOS filtros
// da tela Automações. O que vai pro servidor é `{ event, conditions }`, com o
// nome de evento e o formato de condição das regras — é isso que deixa a
// sprint 2 converter cada regra num fluxo sem tradução.
//
// As condições viajam num array só, mas são DUAS perguntas: a do gatilho
// ("qual origem?", "qual etiqueta?") e a do funil ("em qual funil o lead
// está?"). Cada editor mexe só na sua — mesma regra da tela Automações.

import type { FlowAutomationTrigger, FlowTriggerCondition, FlowTriggerEvent } from '@/types/flowAutomations';
import { TRIGGER_LABELS } from '@/services/leadAutomation/leadAutomationService';

export interface FlowTrigger {
  event: FlowTriggerEvent | '';
  conditions: FlowTriggerCondition[];
}

export interface FlowTriggerGroup {
  label: string;
  events: FlowTriggerEvent[];
}

/** A tabela "Gatilhos" da spec, na ordem dela. */
export const FLOW_TRIGGER_GROUPS: FlowTriggerGroup[] = [
  { label: 'Lead chegou', events: ['lead.created', 'lead.campaign_received'] },
  { label: 'Atendimento', events: ['lead.roleta_accepted', 'lead.message_received'] },
  { label: 'Funil de vendas', events: ['lead.stage_changed', 'lead.tag_added'] },
  {
    label: 'Visita',
    events: [
      'lead.visit_scheduled', 'lead.visit_completed',
      'lead.visit_reminder_24h', 'lead.visit_reminder_1h', 'lead.visit_reminder_15min',
    ],
  },
  { label: 'Imóvel', events: ['lead.interest_created'] },
];

export const FLOW_TRIGGER_EVENTS: FlowTriggerEvent[] = FLOW_TRIGGER_GROUPS.flatMap(g => g.events);

/**
 * Gatilhos das Automações que o construtor NÃO oferece: não disparam ou
 * enganam (registrado no _MELHORIAS). "Sem resposta após X minutos" virou o
 * bloco Aguardar resposta.
 */
export const REMOVED_FLOW_TRIGGERS = [
  'lead.inactive_7d',
  'lead.inactive_14d',
  'lead.no_reply_after',
  'lead.property_matched',
] as const;

export const LEAD_CREATED_HINT =
  'Dispara pra todo contato novo, inclusive os que entram pela agenda do celular. Use a origem pra limitar.';

export const NO_TRIGGER_LABEL = 'Escolha o gatilho';
const FLOW_CALLED_LABEL = 'Quando outro fluxo chama este';

export function flowTriggerLabel(event: string | null | undefined): string {
  if (!event) return NO_TRIGGER_LABEL;
  if (event === 'flow_called') return FLOW_CALLED_LABEL;
  return TRIGGER_LABELS[event] ?? NO_TRIGGER_LABEL;
}

// ── Leitura (o formato antigo só por garantia) ─────────────────────────────

// Os nomes do construtor antigo. O servidor já traduz ao ler (contrato), mas
// um fluxo que chegue cru não pode virar "Escolha o gatilho" em silêncio.
const LEGACY_EVENTS: Record<string, FlowTriggerEvent> = {
  contact_created: 'lead.created',
  form_submitted: 'lead.created',
  lead_ads: 'lead.created',
  stage_changed: 'lead.stage_changed',
  tag_added: 'lead.tag_added',
  reply_received: 'lead.message_received',
  keyword: 'lead.message_received',
};

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

function isCondition(c: unknown): c is FlowTriggerCondition {
  return !!c && typeof c === 'object' && typeof (c as FlowTriggerCondition).field === 'string';
}

export function normalizeTrigger(raw: FlowAutomationTrigger | null | undefined): FlowTrigger {
  if (!raw || typeof raw !== 'object') return { event: '', conditions: [] };
  const rawEvent = str(raw.event);
  if (Array.isArray(raw.conditions)) {
    return { event: (LEGACY_EVENTS[rawEvent] ?? rawEvent) as FlowTrigger['event'], conditions: raw.conditions.filter(isCondition) };
  }
  // Formato antigo: os filtros soltos no próprio objeto.
  const event = (LEGACY_EVENTS[rawEvent] ?? rawEvent) as FlowTrigger['event'];
  const conditions: FlowTriggerCondition[] = [];
  const formId = str(raw.form_id);
  const source = str(raw.source);
  if (formId) conditions.push({ field: 'form_id', operator: 'in', value: [formId] });
  else if (source) conditions.push({ field: 'source', operator: 'eq', value: source });
  else if (rawEvent === 'lead_ads' || rawEvent === 'form_submitted') {
    conditions.push({ field: 'source', operator: 'eq', value: 'formulario' });
  }
  if (str(raw.label)) conditions.push({ field: 'label', operator: 'eq', value: str(raw.label) });
  if (str(raw.stage_id)) conditions.push({ field: 'to_stage_id', operator: 'eq', value: str(raw.stage_id) });
  if (str(raw.keyword)) conditions.push({ field: 'content', operator: 'contains', value: str(raw.keyword) });
  if (str(raw.pipeline_id) && event !== 'lead.stage_changed') {
    conditions.push({ field: 'pipeline_id', operator: 'eq', value: str(raw.pipeline_id) });
  }
  return { event, conditions };
}

/** O que vai pro servidor: só `{ event, conditions }`, nada solto. */
export function serializeTrigger(t: FlowTrigger): { event: string; conditions: FlowTriggerCondition[] } {
  return {
    event: t.event,
    conditions: t.conditions.filter(c => c.value !== '' && !(Array.isArray(c.value) && c.value.length === 0)),
  };
}

// ── Edição ──────────────────────────────────────────────────────────────────

export const isPipelineFilter = (c: FlowTriggerCondition): boolean => c.field === 'pipeline_id';

/** "Etapa alterada" já escolhe a etapa, e a etapa já diz o funil. */
export const eventAcceptsPipelineFilter = (event: string): boolean => event !== 'lead.stage_changed';

export function triggerConditionOf(t: FlowTrigger): FlowTriggerCondition | null {
  return t.conditions.find(c => !isPipelineFilter(c)) ?? null;
}

export function pipelineFilterOf(t: FlowTrigger): FlowTriggerCondition | null {
  return t.conditions.find(isPipelineFilter) ?? null;
}

export function withTriggerCondition(t: FlowTrigger, next: FlowTriggerCondition | null): FlowTrigger {
  const funil = pipelineFilterOf(t);
  return { ...t, conditions: [...(next ? [next] : []), ...(funil ? [funil] : [])] };
}

export function withPipelineFilter(t: FlowTrigger, next: FlowTriggerCondition | null): FlowTrigger {
  return { ...t, conditions: [...t.conditions.filter(c => !isPipelineFilter(c)), ...(next ? [next] : [])] };
}

/**
 * Trocar o gatilho: a condição do gatilho antigo sai (gravada e invisível, ela
 * barraria o fluxo sem nada na tela dizer por quê); o filtro de funil fica, onde
 * o gatilho novo o oferece. Mesma regra de `conditionsOnTriggerChange`.
 */
export function changeTriggerEvent(t: FlowTrigger, event: FlowTrigger['event']): FlowTrigger {
  if (event === t.event) return t;
  const funil = eventAcceptsPipelineFilter(event) ? pipelineFilterOf(t) : null;
  return { event, conditions: funil ? [funil] : [] };
}

// Gatilhos em que o filtro é obrigatório (sem ele o fluxo rodaria pra
// qualquer etiqueta / qualquer etapa) — mesma regra do validateRule.
const REQUIRED_CONDITION: Record<string, string> = {
  'lead.tag_added': 'Escolha qual etiqueta dispara o fluxo.',
  'lead.stage_changed': 'Escolha para qual etapa o lead precisa ir.',
};

export function triggerProblem(t: FlowTrigger): string | null {
  if (!t.event) return 'Escolha o gatilho do fluxo.';
  const message = REQUIRED_CONDITION[t.event];
  if (!message) return null;
  const c = triggerConditionOf(t);
  const filled = !!c && c.value !== '' && !(Array.isArray(c.value) && c.value.length === 0);
  return filled ? null : message;
}
