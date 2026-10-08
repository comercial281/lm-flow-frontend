// Formato da lista `GET /api/v1/activities` (Frente 2, 07/10/2026).

export type Balde = 'para_fazer' | 'hoje' | 'amanha' | 'atrasadas' | 'semana' | 'proxima_semana' | 'concluidas';
export type TipoDeAtividade = 'all' | 'task' | 'visit';

export interface Pessoa {
  id: string;
  name: string;
}

export interface TarefaAtividade {
  kind: 'task';
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  due_at: string | null;
  status: 'pending' | 'completed' | 'cancelled' | 'overdue';
  overdue: boolean;
  completed_at?: string | null;
  pipeline_item_id: string;
  pipeline_id: string | null;
  conversation_id?: string | null;
  contact: Pessoa | null;
  assignee: Pessoa | null;
  created_by_id: string;
  can_edit: boolean;
  can_delete: boolean;
}

export interface RespostaDeAtividades {
  data: TarefaAtividade[];
  meta: { counts: Partial<Record<Balde, number>>; total: number; page: number; per_page: number; only_mine: boolean };
}

export interface ParametrosDaLista {
  bucket?: Balde;
  kind?: TipoDeAtividade;
  assigned_to_id?: string;
  category?: string;
  q?: string;
  pipeline_item_ids?: string[];
  page?: number;
  per_page?: number;
}

export interface DadosDaTarefa {
  pipeline_item_id?: string;
  contact_id?: string;
  title?: string;
  description?: string;
  due_date?: string;
  category?: string;
  assigned_to_id?: string;
}
