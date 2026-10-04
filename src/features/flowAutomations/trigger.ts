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

/** Um gatilho: o evento e as condições dele. */
export interface FlowTriggerPart {
  event: FlowTriggerEvent | '';
  conditions: FlowTriggerCondition[];
}

/**
 * O gatilho do fluxo: o principal e, desde a sprint 3, os outros ("+ Ou
 * quando…"). O fluxo começa quando QUALQUER um deles acontece; cada um tem o
 * próprio filtro e o próprio funil, editados com o mesmo editor.
 */
export interface FlowTrigger extends FlowTriggerPart {
  alternatives?: FlowTriggerPart[];
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

function normalizeAlternatives(raw: unknown): FlowTriggerPart[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const alt = item as { event?: unknown; conditions?: unknown };
    const event = str(alt.event);
    return [{
      event: (LEGACY_EVENTS[event] ?? event) as FlowTriggerPart['event'],
      conditions: Array.isArray(alt.conditions) ? alt.conditions.filter(isCondition) : [],
    }];
  });
}

export function normalizeTrigger(raw: FlowAutomationTrigger | null | undefined): FlowTrigger {
  if (!raw || typeof raw !== 'object') return { event: '', conditions: [], alternatives: [] };
  const alternatives = normalizeAlternatives(raw.alternatives);
  const rawEvent = str(raw.event);
  if (Array.isArray(raw.conditions)) {
    return { event: (LEGACY_EVENTS[rawEvent] ?? rawEvent) as FlowTrigger['event'], conditions: raw.conditions.filter(isCondition), alternatives };
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
  return { event, conditions, alternatives };
}

const filledConditions = (conditions: FlowTriggerCondition[]) =>
  conditions.filter(c => c.value !== '' && !(Array.isArray(c.value) && c.value.length === 0));

// `type` (e não `interface`): precisa caber no `FlowAutomationTrigger`, que tem índice livre.
export type SerializedTrigger = {
  event: string;
  conditions: FlowTriggerCondition[];
  alternatives: Array<{ event: string; conditions: FlowTriggerCondition[] }>;
};

/**
 * O que vai pro servidor: `{ event, conditions, alternatives }`, nada solto.
 * `alternatives` vai SEMPRE (vazia quando não há): é o que apaga o último
 * "Ou quando" tirado na tela.
 */
export function serializeTrigger(t: FlowTrigger): SerializedTrigger {
  return {
    event: t.event,
    conditions: filledConditions(t.conditions),
    alternatives: (t.alternatives ?? []).map(a => ({ event: a.event, conditions: filledConditions(a.conditions) })),
  };
}

/** Todos os eventos do gatilho: o principal e os do "Ou quando". */
export function triggerEvents(t: FlowTrigger): string[] {
  return [t.event, ...(t.alternatives ?? []).map(a => a.event)].filter(Boolean);
}

/** "Etapa alterada ou Etiqueta adicionada": a lista de fluxos. */
export function flowTriggerSummary(t: FlowTrigger): string {
  const events = triggerEvents(t);
  return events.length ? events.map(flowTriggerLabel).join(' ou ') : NO_TRIGGER_LABEL;
}

/**
 * A linha do bloco Início (sprint 4): cada gatilho com os filtros dele entre
 * parênteses, e os do "Ou quando" depois de " · ou ". Ex.: "Etapa alterada
 * (Etapa: Follow-up) · ou Etiqueta adicionada (Etiqueta: follow-up)".
 * `describe` é a frase do filtro (a mesma da lista de regras); sem ela, só os nomes.
 */
export function triggerOneLine(
  t: FlowTrigger,
  describe?: (event: string, condition: FlowTriggerCondition) => string,
): string {
  if (!t.event) return NO_TRIGGER_LABEL;
  const part = (p: FlowTriggerPart) => {
    const label = flowTriggerLabel(p.event);
    if (!p.event || !describe) return label;
    const filters = filledConditions(p.conditions).map(c => describe(p.event, c)).filter(Boolean);
    return filters.length ? `${label} (${filters.join(', ')})` : label;
  };
  return [part(t), ...(t.alternatives ?? []).filter(a => a.event).map(a => `ou ${part(a)}`)].join(' · ');
}

// ── "+ Ou quando…" (sprint 3) ──────────────────────────────────────────────

export function addAlternative(t: FlowTrigger): FlowTrigger {
  return { ...t, alternatives: [...(t.alternatives ?? []), { event: '', conditions: [] }] };
}

export function updateAlternative(t: FlowTrigger, index: number, next: FlowTriggerPart): FlowTrigger {
  return { ...t, alternatives: (t.alternatives ?? []).map((a, i) => (i === index ? next : a)) };
}

export function removeAlternative(t: FlowTrigger, index: number): FlowTrigger {
  return { ...t, alternatives: (t.alternatives ?? []).filter((_, i) => i !== index) };
}

// ── Edição ──────────────────────────────────────────────────────────────────

export const isPipelineFilter = (c: FlowTriggerCondition): boolean => c.field === 'pipeline_id';

/** "Etapa alterada" já escolhe a etapa, e a etapa já diz o funil. */
export const eventAcceptsPipelineFilter = (event: string): boolean => event !== 'lead.stage_changed';

export function triggerConditionOf(t: FlowTriggerPart): FlowTriggerCondition | null {
  return t.conditions.find(c => !isPipelineFilter(c)) ?? null;
}

export function pipelineFilterOf(t: FlowTriggerPart): FlowTriggerCondition | null {
  return t.conditions.find(isPipelineFilter) ?? null;
}

export function withTriggerCondition<T extends FlowTriggerPart>(t: T, next: FlowTriggerCondition | null): T {
  const funil = pipelineFilterOf(t);
  return { ...t, conditions: [...(next ? [next] : []), ...(funil ? [funil] : [])] };
}

export function withPipelineFilter<T extends FlowTriggerPart>(t: T, next: FlowTriggerCondition | null): T {
  return { ...t, conditions: [...t.conditions.filter(c => !isPipelineFilter(c)), ...(next ? [next] : [])] };
}

/**
 * Trocar o gatilho: a condição do gatilho antigo sai (gravada e invisível, ela
 * barraria o fluxo sem nada na tela dizer por quê); o filtro de funil fica, onde
 * o gatilho novo o oferece. Mesma regra de `conditionsOnTriggerChange`.
 */
export function changeTriggerEvent<T extends FlowTriggerPart>(t: T, event: FlowTriggerPart['event']): T {
  if (event === t.event) return t;
  const funil = eventAcceptsPipelineFilter(event) ? pipelineFilterOf(t) : null;
  return { ...t, event, conditions: funil ? [funil] : [] };
}

// Gatilhos em que o filtro é obrigatório (sem ele o fluxo rodaria pra
// qualquer etiqueta / qualquer etapa) — mesma regra do validateRule.
const REQUIRED_CONDITION: Record<string, string> = {
  'lead.tag_added': 'Escolha qual etiqueta dispara o fluxo.',
  'lead.stage_changed': 'Escolha para qual etapa o lead precisa ir.',
};

function partProblem(t: FlowTriggerPart): string | null {
  if (!t.event) return 'Escolha o gatilho do fluxo.';
  const message = REQUIRED_CONDITION[t.event];
  if (!message) return null;
  const c = triggerConditionOf(t);
  const filled = !!c && c.value !== '' && !(Array.isArray(c.value) && c.value.length === 0);
  return filled ? null : message;
}

/** O que falta no gatilho principal ou num "Ou quando", em português, ou null. */
export function triggerProblem(t: FlowTrigger): string | null {
  const main = partProblem(t);
  if (main) return main;
  const alternatives = t.alternatives ?? [];
  for (let i = 0; i < alternatives.length; i += 1) {
    const issue = partProblem(alternatives[i]);
    if (issue) {
      const what = alternatives[i].event ? issue : 'Escolha o gatilho.';
      return `No "Ou quando"${alternatives.length > 1 ? ` nº ${i + 1}` : ''}: ${what.charAt(0).toLowerCase()}${what.slice(1)}`;
    }
  }
  return null;
}
