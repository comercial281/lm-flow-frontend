// LM Notion — contratos compartilhados do modulo.
// Espelham as tabelas notion_* (migration 20260721_100000_notion_module.sql).

export type PropertyType =
  | 'title' | 'text' | 'number' | 'select' | 'multi_select' | 'status'
  | 'date' | 'person' | 'files' | 'checkbox' | 'url' | 'email' | 'phone'
  | 'formula' | 'relation' | 'rollup'
  | 'created_time' | 'created_by' | 'last_edited_time' | 'last_edited_by' | 'auto_number'

export type ViewKind = 'table' | 'board' | 'gallery' | 'list' | 'calendar' | 'timeline'

export type NotionColor =
  | 'default' | 'gray' | 'brown' | 'orange' | 'yellow'
  | 'green' | 'blue' | 'purple' | 'pink' | 'red'

export interface SelectOption {
  id: string
  name: string
  color: NotionColor
  /**
   * Grupo da opcao. `done` marca a COLUNA DE CONCLUSAO: card que cai nela
   * fica esmaecido com check verde, ganha completed_at e para o cronometro.
   * Configuravel pela UI no menu da coluna do quadro.
   */
  group?: 'todo' | 'doing' | 'done'
}

/** A opcao marcada como coluna de conclusao (a primeira com group 'done'). */
export function opcaoDeConclusao(property: NotionProperty | null): SelectOption | null {
  return property?.config?.options?.find(o => o.group === 'done') ?? null
}

/** A linha esta finalizada? (valor da propriedade cai na opcao de conclusao) */
export function estaFinalizada(valor: unknown, property: NotionProperty | null): boolean {
  const done = opcaoDeConclusao(property)
  return !!done && valor === done.id
}

export interface NumberConfig  { format?: 'number' | 'percent' | 'real' | 'dolar'; precision?: number }
export interface DateConfig    { include_time?: boolean; format?: string }
export interface FormulaConfig { expression?: string }
export interface RelationConfig { target_database_id?: string; dual_property_id?: string | null; allow_multiple?: boolean }
export interface RollupConfig  {
  relation_property_id?: string
  target_property_id?: string
  fn?: 'count' | 'count_values' | 'sum' | 'avg' | 'min' | 'max' | 'range' | 'percent_checked' | 'show_original'
}
export interface SelectConfig  { options?: SelectOption[] }

export type PropertyConfig = SelectConfig & NumberConfig & DateConfig
  & FormulaConfig & RelationConfig & RollupConfig

export interface NotionPage {
  id: string
  parent_page_id: string | null
  database_id: string | null
  title: string
  icon: string | null
  cover_url: string | null
  cover_position: number
  content: unknown[]              // documento BlockNote
  sort_order: number
  is_archived: boolean
  is_template: boolean
  is_locked: boolean
  full_width: boolean
  small_text: boolean
  created_by: string | null
  last_edited_by: string | null
  created_at: string
  updated_at: string
  /** Cronometro: quando foi ligado. null = parado. */
  timer_started_at?: string | null
  /** Cronometro: segundos ja acumulados de sessoes anteriores. */
  timer_seconds?: number
  /** Quando entrou na coluna de conclusao. null = nao finalizada. */
  completed_at?: string | null
}

export interface NotionDatabase {
  id: string
  page_id: string | null
  parent_page_id: string | null
  name: string
  slug: string | null
  icon: string | null
  description: string | null
  is_inline: boolean
  created_at: string
  updated_at: string
}

export interface NotionProperty {
  id: string
  database_id: string
  name: string
  type: PropertyType
  config: PropertyConfig
  sort_order: number
  is_visible: boolean
  created_at: string
}

export interface NotionPageProp {
  page_id: string
  property_id: string
  value: PropertyValue
}

/** Valor cru salvo em notion_page_props.value, por tipo de propriedade:
 *  text/url/email/phone → string
 *  number               → number
 *  checkbox             → boolean
 *  select/status        → string (id da option)
 *  multi_select         → string[] (ids)
 *  date                 → { start: ISO, end?: ISO }
 *  person               → string[] (ids de profiles)
 *  files                → { name, url }[]
 *  relation             → gerenciado em notion_relations, nao aqui
 *  formula/rollup       → calculado em runtime, nao persistido
 */
export type PropertyValue =
  | string | number | boolean | string[] | null
  | { start: string; end?: string | null }
  | { name: string; url: string }[]

export type FilterOperator =
  | 'equals' | 'not_equals' | 'contains' | 'not_contains'
  | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty'
  | 'greater_than' | 'less_than' | 'on_or_before' | 'on_or_after'
  | 'checked' | 'unchecked'
  // Datas RELATIVAS (nao precisam de valor; comparam com "hoje" na hora).
  | 'is_overdue' | 'is_today' | 'is_this_week'

export interface FilterCondition {
  id: string
  property_id: string
  operator: FilterOperator
  value?: unknown
}

export interface FilterGroup {
  operator: 'and' | 'or'
  conditions: FilterCondition[]
}

export interface SortRule {
  property_id: string
  direction: 'asc' | 'desc'
}

export interface ViewConfig {
  group_by?: string | null
  hide_empty_groups?: boolean
  date_property_id?: string | null
  start_property_id?: string | null
  end_property_id?: string | null
  cover_property_id?: string | null
  card_size?: 'small' | 'medium' | 'large'
  fit_cover?: boolean
  wrap_cells?: boolean
  /** TableView: largura por coluna, property_id → px. */
  column_widths?: Record<string, number>
  /**
   * Colunas ESCONDIDAS. Guardamos o que esconder, nunca o que mostrar: com
   * lista de visiveis, toda propriedade criada depois ficava de fora e nunca
   * aparecia. Ausencia da lista = visivel.
   */
  hidden_props?: string[]
  /** TimelineView: escala do eixo. */
  zoom?: 'day' | 'week' | 'month'
  /** View padrao: a que abre quando entra na base sem view na URL. */
  is_default?: boolean
  /** "Minhas tarefas": filtra pelo usuario logado em qualquer prop de pessoa. */
  only_mine?: boolean
}

export interface NotionView {
  id: string
  database_id: string
  name: string
  kind: ViewKind
  filters: FilterGroup
  sorts: SortRule[]
  visible_props: string[]
  config: ViewConfig
  sort_order: number
  created_at: string
}

export interface NotionComment {
  id: string
  page_id: string
  block_id: string | null
  parent_comment_id: string | null
  member_id: string | null
  body: string
  is_resolved: boolean
  created_at: string
  updated_at: string
}

export interface NotionPageVersion {
  id: string
  page_id: string
  title: string
  content: unknown[]
  member_id: string | null
  created_at: string
}

/** Pagina + valores de propriedade ja resolvidos, do jeito que as views consomem. */
export interface PageRow extends NotionPage {
  props: Record<string, PropertyValue>   // property_id → valor
  relations: Record<string, string[]>    // property_id → page_ids ligadas
}

// Contraste: o Hub e CLARO. As cores antigas usavam texto claro (-300) sobre
// tinta clara — ilegivel (o "azul bebe sem contraste" e o cinza apagado). Agora
// e texto ESCURO (-800) sobre tinta clara (-100), que passa contraste no claro.
export const NOTION_COLORS: Record<NotionColor, { bg: string; text: string; dot: string }> = {
  default: { bg: 'bg-neutral-200',  text: 'text-neutral-800', dot: 'bg-neutral-500' },
  gray:    { bg: 'bg-neutral-200',  text: 'text-neutral-800', dot: 'bg-neutral-500' },
  brown:   { bg: 'bg-amber-100',    text: 'text-amber-900',   dot: 'bg-amber-700' },
  orange:  { bg: 'bg-orange-100',   text: 'text-orange-900',  dot: 'bg-orange-500' },
  yellow:  { bg: 'bg-yellow-100',   text: 'text-yellow-900',  dot: 'bg-yellow-500' },
  green:   { bg: 'bg-emerald-100',  text: 'text-emerald-900', dot: 'bg-emerald-600' },
  blue:    { bg: 'bg-sky-100',      text: 'text-sky-900',     dot: 'bg-sky-600' },
  purple:  { bg: 'bg-violet-100',   text: 'text-violet-900',  dot: 'bg-violet-600' },
  pink:    { bg: 'bg-pink-100',     text: 'text-pink-900',    dot: 'bg-pink-600' },
  red:     { bg: 'bg-red-100',      text: 'text-red-900',     dot: 'bg-red-600' },
}

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  title: 'Titulo',
  text: 'Texto',
  number: 'Numero',
  select: 'Selecao',
  multi_select: 'Multi-selecao',
  status: 'Status',
  date: 'Data',
  person: 'Pessoa',
  files: 'Arquivos e midia',
  checkbox: 'Caixa de selecao',
  url: 'URL',
  email: 'E-mail',
  phone: 'Telefone',
  formula: 'Formula',
  relation: 'Relacao',
  rollup: 'Rollup',
  created_time: 'Criado em',
  created_by: 'Criado por',
  last_edited_time: 'Editado em',
  last_edited_by: 'Editado por',
  auto_number: 'ID unico',
}

export const VIEW_KIND_LABELS: Record<ViewKind, string> = {
  table: 'Tabela',
  board: 'Quadro',
  gallery: 'Galeria',
  list: 'Lista',
  calendar: 'Calendario',
  timeline: 'Linha do tempo',
}

/** Tipos que o usuario nao edita a mao — calculados ou automaticos. */
export const READONLY_TYPES: PropertyType[] = [
  'formula', 'rollup', 'created_time', 'created_by',
  'last_edited_time', 'last_edited_by', 'auto_number',
]
