// MODELOS DE FLUXO (sprint 2, spec 03/10/2026, seção 4).
//
// Nada é criado escondido: o cliente começa pelos modelos, que ficam visíveis
// no botão "Modelos" e no estado vazio. Cada modelo cria o fluxo DESLIGADO, com
// o nome do modelo; o cliente ajusta e liga. Os modelos moram no servidor
// (definidos em código, sem tabela):
//   GET  /flow_automations/templates             → [{ key, name, description }]
//   POST /flow_automations/templates/:key/apply  → o fluxo criado
// As rotas aceitam com ou sem o envelope `{ data }`.

export interface FlowTemplate {
  key: string;
  name: string;
  description: string;
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
    return [{ key, name, description: str(raw.description).trim() }];
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
