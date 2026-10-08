// Formato da lista `GET /api/v1/activities` (Frente 2, 07/10/2026).

export type Balde = 'para_fazer' | 'hoje' | 'amanha' | 'atrasadas' | 'semana' | 'proxima_semana' | 'concluidas';
export type TipoDeAtividade = 'all' | 'task' | 'visit';

export interface Pessoa {
  id: string;
  name: string;
}

export type Prioridade = 'low' | 'medium' | 'high' | 'urgent';

/** Imóvel ligado à tarefa (janela "Agendar tarefa", 08/10/2026). */
export interface ImovelDaTarefa {
  id: string;
  title: string;
  code: string;
}

export interface TarefaAtividade {
  kind: 'task';
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  /** Id da opção da lista `task_categories`; null em tarefa antiga que só tem o nome. */
  category_option_id?: string | null;
  due_at: string | null;
  duration_minutes?: number | null;
  priority?: Prioridade;
  property?: ImovelDaTarefa | null;
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

/** Linha da agenda do dia (`?day=`): tarefa ou visita, aberta ou feita. */
export interface ItemDaAgenda {
  kind: 'task' | 'visit';
  id: string;
  title: string;
  due_at: string | null;
  duration_minutes?: number | null;
  status: string;
  contact: Pessoa | null;
}

/** `GET /tasks/context`: o que a janela mostra antes de salvar. */
export interface ContextoDaTarefa {
  pipeline_item_id: string;
  pipeline_name: string | null;
  contact: Pessoa | null;
  owner: Pessoa | null;
}

export interface RespostaDeAtividades {
  data: TarefaAtividade[];
  meta: { counts: Partial<Record<Balde, number>>; total: number; page: number; per_page: number; only_mine: boolean };
}

export interface ParametrosDaLista {
  bucket?: Balde;
  kind?: TipoDeAtividade;
  assigned_to_id?: string;
  category_option_id?: string;
  q?: string;
  pipeline_item_ids?: string[];
  /** AAAA-MM-DD: tudo daquele dia, aberto e feito (troca o balde). */
  day?: string;
  page?: number;
  per_page?: number;
}

export interface DadosDaTarefa {
  pipeline_item_id?: string;
  contact_id?: string;
  title?: string;
  description?: string;
  due_date?: string;
  /** Id da categoria; '' limpa. Omitir mantém. */
  category_option_id?: string;
  assigned_to_id?: string;
  priority?: Prioridade;
  duration_minutes?: number;
  /** Id do imóvel; '' tira. Omitir mantém. */
  property_id?: string;
  /** Só no criar: nasce concluída. */
  completed?: boolean;
}
