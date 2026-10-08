/**
 * Listas da casa (E1 do funil, 07/10/2026): motivos de perda e categorias de
 * tarefa, editadas em Minha imobiliária › Listas.
 *
 * Quem usa uma opção guarda o ID, nunca o texto. Opção não se exclui, só se
 * arquiva (`active: false`). Ler é de qualquer pessoa logada; mudar pede
 * `pipelines.update` no servidor (403 pro corretor).
 *
 * O servidor responde no envelope `{ success, data }`; `semEnvelope` aceita
 * também o corpo cru, pra tela não quebrar se o envelope mudar.
 */
import api from '@/services/core/api';

export type ListKey = 'loss_reasons' | 'task_categories';

export interface ListOption {
  id: string;
  list_key: ListKey;
  label: string;
  position: number;
  active: boolean;
  /** Só nos motivos de perda: marcar Perdido por este motivo avisa a Meta que o lead era ruim. */
  meta_exclusion: boolean;
}

export type ListOptionChanges = Partial<Pick<ListOption, 'label' | 'position' | 'active' | 'meta_exclusion'>>;

function semEnvelope<T>(body: unknown): T {
  if (body && typeof body === 'object' && !Array.isArray(body) && 'data' in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

export const listOptionsService = {
  async list(listKey: ListKey, opts: { includeInactive?: boolean } = {}): Promise<ListOption[]> {
    const params: Record<string, string> = { list: listKey };
    if (opts.includeInactive) params.include_inactive = 'true';
    const res = await api.get('/list_options', { params });
    return semEnvelope<ListOption[]>(res.data) ?? [];
  },

  async create(listKey: ListKey, attrs: { label: string; meta_exclusion?: boolean }): Promise<ListOption> {
    const res = await api.post('/list_options', { list_key: listKey, ...attrs });
    return semEnvelope<ListOption>(res.data);
  },

  async update(id: string, changes: ListOptionChanges): Promise<ListOption> {
    const res = await api.patch(`/list_options/${id}`, changes);
    return semEnvelope<ListOption>(res.data);
  },

  /** `ids` = as ativas na ordem nova; volta a lista inteira (ativas e arquivadas). */
  async reorder(listKey: ListKey, ids: string[]): Promise<ListOption[]> {
    const res = await api.patch('/list_options/reorder', { list: listKey, ids });
    return semEnvelope<ListOption[]>(res.data) ?? [];
  },
};
