// MODELOS DE FLUXO (sprint 2, spec 03/10/2026, seção 4).
//
// Nada é criado escondido: o cliente começa pelos modelos, que ficam visíveis
// no botão "Modelos" e no estado vazio. Cada modelo cria o fluxo DESLIGADO, com
// o nome do modelo; o cliente ajusta e liga. Os modelos moram no servidor
// (definidos em código, sem tabela):
//   GET  /flow_automations/templates             → [{ key, name, description, category, icon, when, preview, adjust }]
//   POST /flow_automations/templates/:key/apply  → o fluxo criado
// As rotas aceitam com ou sem o envelope `{ data }`.

/**
 * Um bloco do modelo, pra mostrar a sequência antes de escolher (sprint 4,
 * "+ Novo funil"): mensagem (texto e/ou mídia) ou espera em segundos.
 */
export interface FlowTemplatePreviewStep {
  kind: string;
  label?: string;
  text?: string;
  media_kind?: string;
  /** `property_book`: o arquivo é o book do imóvel de interesse (sem `media_kind`). */
  media_source?: string;
  seconds?: number;
  /** "Ação de lead": qual ação (`notify_group`, `assign_via_roleta`…). */
  action_type?: string;
  /** "Mandar WhatsApp": `owner` = pelo número do responsável. */
  send_from?: string;
  /** "Aguardar resposta": por quantos minutos. */
  minutes?: number;
  /** `no_reply`: o bloco só roda quando o lead não respondeu. */
  branch?: string;
}

/** Um passo do que a pessoa ajusta antes de ligar (o guia do modelo). */
export interface FlowTemplateAdjust {
  title: string;
  hint?: string;
  /** O modelo traz o campo obrigatório em branco: não liga sem preencher. */
  pending: boolean;
}

export interface FlowTemplate {
  key: string;
  name: string;
  description: string;
  /** Sprint 4: quantos passos do guia o modelo traz (ausente no modelo montado na hora). */
  guide_steps?: number;
  /** Sprint 4: os blocos em ordem (ausente/vazio no modelo montado na hora). */
  preview?: FlowTemplatePreviewStep[];
  /** Lista com prévia (12/10/2026): o grupo da lista, na ordem que o servidor manda. */
  category?: string;
  category_label?: string;
  /** Nome do ícone (lucide, em kebab-case). */
  icon?: string;
  /** O "quando começa", em português. */
  when?: string;
  adjust?: FlowTemplateAdjust[];
}

function previewFrom(raw: unknown): FlowTemplatePreviewStep[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const r = item as Record<string, unknown>;
    const kind = str(r.kind);
    if (!kind) return [];
    const step: FlowTemplatePreviewStep = { kind };
    if (str(r.label)) step.label = str(r.label);
    if (str(r.text)) step.text = str(r.text);
    if (str(r.media_kind)) step.media_kind = str(r.media_kind);
    if (str(r.media_source)) step.media_source = str(r.media_source);
    if (typeof r.seconds === 'number') step.seconds = r.seconds;
    if (str(r.action_type)) step.action_type = str(r.action_type);
    if (str(r.send_from)) step.send_from = str(r.send_from);
    if (typeof r.minutes === 'number') step.minutes = r.minutes;
    if (str(r.branch)) step.branch = str(r.branch);
    return [step];
  });
}

function adjustFrom(raw: unknown): FlowTemplateAdjust[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const r = item as Record<string, unknown>;
    const title = str(r.title).trim();
    if (!title) return [];
    const a: FlowTemplateAdjust = { title, pending: r.pending === true };
    if (str(r.hint).trim()) a.hint = str(r.hint).trim();
    return [a];
  });
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** A lista de modelos, do corpo da resposta (com ou sem `{ data }`). Item sem chave ou nome fica de fora. */
export function templatesFrom(body: unknown): FlowTemplate[] {
  const list = Array.isArray(body)
    ? body
    : body && typeof body === 'object' && Array.isArray((body as { data?: unknown }).data)
      ? (body as { data: unknown[] }).data
      : [];
  return list.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const raw = item as Record<string, unknown>;
    const key = str(raw.key).trim();
    const name = str(raw.name).trim();
    if (!key || !name) return [];
    const template: FlowTemplate = { key, name, description: str(raw.description).trim() };
    if (typeof raw.guide_steps === 'number') template.guide_steps = raw.guide_steps;
    const preview = previewFrom(raw.preview);
    if (preview.length) template.preview = preview;
    for (const k of ['category', 'category_label', 'icon', 'when'] as const) {
      if (str(raw[k]).trim()) template[k] = str(raw[k]).trim();
    }
    const adjust = adjustFrom(raw.adjust);
    if (adjust.length) template.adjust = adjust;
    return [template];
  });
}

/** O fluxo criado pelo modelo, do corpo da resposta (com ou sem `{ data }`). */
export function appliedFlowFrom<T extends { id: string }>(body: unknown): T {
  const inner = body && typeof body === 'object' && 'data' in body ? (body as { data: unknown }).data : body;
  const flow = inner as T | null;
  if (!flow || typeof flow !== 'object' || !flow.id) {
    throw new Error('O servidor não devolveu o fluxo criado');
  }
  return flow;
}
