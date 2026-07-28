// DashNotion — queries/mutations React Query batendo na edge function
// `share-notion`. Espelha o inventario de src/hooks/useNotion.ts, mas via
// call(action, payload) em vez de supabase direto. Os NOMES dos hooks sao os
// mesmos do CRM de proposito: os componentes duplicados importam daqui trocando
// so o caminho do import.
//
// Diferencas de contrato (sem action na edge -> omitido ou adaptado):
//   - membros: action `members` devolve {id,name,cargo,side}; mapeamos para o
//     shape {id,full_name,email,avatar_url} que os editores do CRM esperam.
//   - autoria: created_by/last_edited_by sao NOMES (created_by_name), nao ids.
//   - sem timer/finalizada/favoritos/permissoes/templates/duplicar no backend.

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query'
import { toast } from 'sonner'
import { errorMessage } from '@/features/espaco/lib/errors'
import type {
  NotionPage, NotionDatabase, NotionProperty, NotionView, NotionComment,
  NotionPageVersion, PageRow, PropertyType, PropertyConfig, PropertyValue,
  ViewKind, FilterGroup, SortRule, ViewConfig,
} from '@/features/espaco/internal/types'
import { useDashCtx } from './dashContext'

// ── shapes retornados pela edge ─────────────────────────────────────────────

interface TreePage {
  id: string; parent_page_id: string | null; database_id: string | null
  title: string; icon: string | null; sort_order: number; is_archived: boolean
}
interface TreeDatabase {
  id: string; page_id: string | null; slug: string | null; name: string
  icon: string | null; is_inline: boolean; is_archived: boolean
}
interface SpaceResp {
  role: 'admin' | 'client'; author_name: string
  pages: TreePage[]; databases: TreeDatabase[]
}

export interface DashMember {
  id: string; full_name: string | null; email: string | null
  avatar_url: string | null; side?: 'lm' | 'client'; cargo?: string | null
}

// ── keys ────────────────────────────────────────────────────────────────────

const k = {
  space: (t: string) => ['dash_notion', 'space', t] as const,
  db: (t: string, id: string | null) => ['dash_notion', 'db', t, id] as const,
  rows: (t: string, id: string | null) => ['dash_notion', 'rows', t, id] as const,
  rollup: (t: string, ids: string[]) => ['dash_notion', 'rollup', t, ids] as const,
  page: (t: string, id: string | null) => ['dash_notion', 'page', t, id] as const,
  comments: (t: string, id: string | null) => ['dash_notion', 'comments', t, id] as const,
  versions: (t: string, id: string | null) => ['dash_notion', 'versions', t, id] as const,
  backlinks: (t: string, id: string | null) => ['dash_notion', 'backlinks', t, id] as const,
  members: (t: string) => ['dash_notion', 'members', t] as const,
  trash: (t: string) => ['dash_notion', 'trash', t] as const,
  templates: (t: string, id: string | null) => ['dash_notion', 'templates', t, id] as const,
}

// ── ESPACO (provision/tree): bases + arvore de paginas ──────────────────────

/** Carrega o espaco (cria se vazio via provision) — base de bases/paginas. */
export function useSpace() {
  const { token, call } = useDashCtx()
  return useQuery({
    queryKey: k.space(token),
    queryFn: () => call<SpaceResp>('provision'),
    staleTime: 30_000,
  })
}

export function useDatabases() {
  const { token, call } = useDashCtx()
  return useQuery({
    queryKey: k.space(token),
    queryFn: () => call<SpaceResp>('provision'),
    staleTime: 30_000,
    select: (d): NotionDatabase[] =>
      d.databases.filter(x => !x.is_archived).map(toDatabase),
  })
}

export function useTrashDatabases() {
  const { token, call } = useDashCtx()
  return useQuery({
    queryKey: k.space(token),
    queryFn: () => call<SpaceResp>('provision'),
    select: (d): NotionDatabase[] =>
      d.databases.filter(x => x.is_archived).map(toDatabase),
  })
}

/** Arvore da sidebar: paginas soltas (sem database_id), nao arquivadas. */
export function usePageTree() {
  const { token, call } = useDashCtx()
  return useQuery({
    queryKey: k.space(token),
    queryFn: () => call<SpaceResp>('provision'),
    staleTime: 30_000,
    select: (d) =>
      d.pages
        .filter(p => !p.database_id && !p.is_archived)
        .sort((a, b) => a.sort_order - b.sort_order),
  })
}

function toDatabase(d: TreeDatabase): NotionDatabase {
  return {
    id: d.id, page_id: d.page_id, parent_page_id: null, name: d.name,
    slug: d.slug, icon: d.icon, description: null, is_inline: d.is_inline,
    created_at: '', updated_at: '',
  }
}

// ── DATABASE META (db_get): database + properties + views ───────────────────

interface DbMetaResp { database: NotionDatabase; properties: NotionProperty[]; views: NotionView[] }

function useDbMeta<T>(databaseId: string | null, select: (d: DbMetaResp) => T) {
  const { token, call } = useDashCtx()
  return useQuery<DbMetaResp, Error, T>({
    queryKey: k.db(token, databaseId),
    enabled: !!databaseId,
    queryFn: () => call<DbMetaResp>('db_get', { database_id: databaseId }),
    select,
  } as UseQueryOptions<DbMetaResp, Error, T>)
}

export function useProperties(databaseId: string | null) {
  return useDbMeta(databaseId, d =>
    [...(d.properties ?? [])].sort((a, b) => a.sort_order - b.sort_order))
}

export function useViews(databaseId: string | null) {
  return useDbMeta(databaseId, d =>
    [...(d.views ?? [])].sort((a, b) => a.sort_order - b.sort_order))
}

// ── LINHAS (db_rows): monta PageRow agregando props/relations ───────────────

interface RowsResp {
  rows: {
    id: string; title: string; icon: string | null; cover_url: string | null
    content: unknown[]; sort_order: number; created_at: string; updated_at: string
    created_by_name: string | null; database_id?: string | null
    // Campos novos da edge (timer/conclusao/template) usados pra cronometro e estado "feito".
    timer_started_at?: string | null; timer_seconds?: number
    completed_at?: string | null; is_template?: boolean
  }[]
  props: { page_id: string; property_id: string; value: PropertyValue }[]
  relations: { id: string; property_id: string; from_page_id: string; to_page_id: string }[]
}

function assembleRows(data: RowsResp, databaseId: string | null): PageRow[] {
  const byPage = new Map<string, PageRow>(
    data.rows.map(p => [p.id, {
      id: p.id, parent_page_id: null, database_id: databaseId ?? p.database_id ?? null,
      title: p.title, icon: p.icon, cover_url: p.cover_url, cover_position: 50,
      content: (p.content ?? []) as unknown[], sort_order: p.sort_order,
      is_archived: false, is_template: p.is_template ?? false, is_locked: false,
      full_width: false, small_text: false,
      created_by: p.created_by_name, last_edited_by: null,
      created_at: p.created_at, updated_at: p.updated_at,
      timer_started_at: p.timer_started_at ?? null, timer_seconds: p.timer_seconds ?? 0,
      completed_at: p.completed_at ?? null,
      props: {}, relations: {},
    }]),
  )
  for (const pv of data.props ?? []) {
    const row = byPage.get(pv.page_id)
    if (row) row.props[pv.property_id] = pv.value
  }
  for (const r of data.relations ?? []) {
    const row = byPage.get(r.from_page_id)
    if (!row) continue
    ;(row.relations[r.property_id] ??= []).push(r.to_page_id)
  }
  return [...byPage.values()].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
}

export function useRows(databaseId: string | null) {
  const { token, call } = useDashCtx()
  return useQuery({
    queryKey: k.rows(token, databaseId),
    enabled: !!databaseId,
    queryFn: async (): Promise<PageRow[]> => {
      const data = await call<RowsResp>('db_rows', { database_id: databaseId })
      return assembleRows(data, databaseId)
    },
  })
}

/** Linhas dos databases ALVO das relacoes usadas por rollups (pra somar/contar). */
export function useRollupSourceRows(properties: NotionProperty[]) {
  const { token, call } = useDashCtx()
  const alvos = [...new Set(
    properties
      .filter(p => p.type === 'rollup')
      .map(p => {
        const relId = p.config?.relation_property_id
        const rel = properties.find(x => x.id === relId)
        return rel?.config?.target_database_id
      })
      .filter((id): id is string => !!id),
  )].sort()

  return useQuery({
    queryKey: k.rollup(token, alvos),
    enabled: alvos.length > 0,
    queryFn: async (): Promise<{ rows: PageRow[]; props: NotionProperty[] }> => {
      const rows: PageRow[] = []
      const props: NotionProperty[] = []
      for (const dbId of alvos) {
        const [rowsResp, meta] = await Promise.all([
          call<RowsResp>('db_rows', { database_id: dbId }),
          call<DbMetaResp>('db_get', { database_id: dbId }),
        ])
        rows.push(...assembleRows(rowsResp, dbId))
        props.push(...(meta.properties ?? []))
      }
      return { rows, props }
    },
  })
}

// ── PAGINA (page_get) ───────────────────────────────────────────────────────

export function usePage(pageId: string | null) {
  const { token, call } = useDashCtx()
  return useQuery({
    queryKey: k.page(token, pageId),
    enabled: !!pageId,
    queryFn: async () => {
      const { page } = await call<{ page: DashPageRow }>('page_get', { page_id: pageId })
      return page ? toNotionPage(page) : null
    },
  })
}

interface DashPageRow {
  id: string; parent_page_id: string | null; database_id: string | null
  title: string; icon: string | null; cover_url: string | null; cover_position: number
  content: unknown[]; sort_order: number; is_archived: boolean; is_template: boolean
  is_locked: boolean; full_width: boolean; small_text: boolean
  created_by_name: string | null; last_edited_by_name: string | null
  created_at: string; updated_at: string
  timer_started_at?: string | null; timer_seconds?: number; completed_at?: string | null
}

function toNotionPage(p: DashPageRow): NotionPage {
  return {
    id: p.id, parent_page_id: p.parent_page_id, database_id: p.database_id,
    title: p.title, icon: p.icon, cover_url: p.cover_url,
    cover_position: p.cover_position ?? 50, content: (p.content ?? []) as unknown[],
    sort_order: p.sort_order, is_archived: p.is_archived, is_template: p.is_template,
    is_locked: p.is_locked, full_width: p.full_width, small_text: p.small_text,
    created_by: p.created_by_name, last_edited_by: p.last_edited_by_name,
    created_at: p.created_at, updated_at: p.updated_at,
    timer_started_at: p.timer_started_at ?? null, timer_seconds: p.timer_seconds ?? 0,
    completed_at: p.completed_at ?? null,
  }
}

// ── CRONOMETRO (funcoes puras, copiadas de src/hooks/useNotion.ts) ──────────
// Copiadas em vez de importadas: @/hooks/useNotion arrasta supabase + useAuth
// pro bundle publico do dash. Aqui sao 2 funcoes puras, sem dependencia.

export function tempoTotalSegundos(page: Pick<NotionPage, 'timer_started_at' | 'timer_seconds'>): number {
  const base = page.timer_seconds ?? 0
  if (!page.timer_started_at) return base
  const desde = (Date.now() - new Date(page.timer_started_at).getTime()) / 1000
  return base + Math.max(0, Math.floor(desde))
}

/** "1h 05m" / "05m 12s" / "12s" */
export function formatarTempo(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const seg = s % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m ${String(seg).padStart(2, '0')}s`
  return `${seg}s`
}

// ── invalidacao util ────────────────────────────────────────────────────────

function useInval() {
  const qc = useQueryClient()
  const { token } = useDashCtx()
  return {
    space: () => qc.invalidateQueries({ queryKey: k.space(token) }),
    db: (id: string | null) => qc.invalidateQueries({ queryKey: k.db(token, id) }),
    rows: (id: string | null) => qc.invalidateQueries({ queryKey: k.rows(token, id) }),
    page: (id: string | null) => qc.invalidateQueries({ queryKey: k.page(token, id) }),
    comments: (id: string | null) => qc.invalidateQueries({ queryKey: k.comments(token, id) }),
    versions: (id: string | null) => qc.invalidateQueries({ queryKey: k.versions(token, id) }),
    backlinks: (id: string | null) => qc.invalidateQueries({ queryKey: k.backlinks(token, id) }),
    trash: () => qc.invalidateQueries({ queryKey: k.trash(token) }),
    templates: (id: string | null) => qc.invalidateQueries({ queryKey: k.templates(token, id) }),
    qc, token,
  }
}

// ── DATABASES (mutations) ───────────────────────────────────────────────────

export function useCreateDatabase() {
  const { call } = useDashCtx()
  const inval = useInval()
  return useMutation({
    mutationFn: async (input: { name: string; parent_page_id?: string | null; is_inline?: boolean }) => {
      const r = await call<{ ok: boolean; database: NotionDatabase }>('db_create', {
        name: input.name, parent_page_id: input.parent_page_id ?? null, is_inline: input.is_inline ?? false,
      })
      return r.database
    },
    onSuccess: () => { inval.space(); toast.success('Base criada') },
    onError: (e) => toast.error(errorMessage(e)),
  })
}

export function useUpdateDatabase() {
  const { call } = useDashCtx()
  const inval = useInval()
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<NotionDatabase>) => {
      await call('db_update', { database_id: id, ...patch })
      return { id, ...patch }
    },
    onSuccess: (r) => { inval.space(); inval.db(r.id) },
    onError: (e) => toast.error(errorMessage(e)),
  })
}

export function useArchiveDatabase() {
  const { call } = useDashCtx()
  const inval = useInval()
  return useMutation({
    mutationFn: async ({ id, archived = true }: { id: string; archived?: boolean }) => {
      await call('db_archive', { database_id: id, archived })
      return { id, archived }
    },
    onSuccess: ({ archived }) => {
      inval.space()
      toast.success(archived ? 'Base movida para a lixeira' : 'Base restaurada')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
}

/** Exclui a base de vez (a lixeira so arquiva; isto apaga mesmo). */
export function useDeleteDatabaseForever() {
  const { call } = useDashCtx()
  const inval = useInval()
  const { qc, token } = inval
  return useMutation({
    mutationFn: async (id: string) => { await call('db_delete_forever', { database_id: id }); return id },
    onSuccess: () => {
      inval.space()
      qc.invalidateQueries({ queryKey: ['dash_notion', 'rows', token] })
      toast.success('Base excluida definitivamente')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
}

// ── PROPRIEDADES ────────────────────────────────────────────────────────────

export function useCreateProperty() {
  const { call } = useDashCtx()
  const inval = useInval()
  return useMutation({
    mutationFn: async (input: {
      database_id: string; name: string; type: PropertyType
      config?: PropertyConfig; sort_order?: number
    }) => {
      const r = await call<{ ok: boolean; property: NotionProperty }>('prop_create', {
        database_id: input.database_id, name: input.name, type: input.type,
        config: input.config ?? {}, sort_order: input.sort_order ?? 999,
      })
      return r.property
    },
    onSuccess: (p) => { inval.db(p.database_id); toast.success('Propriedade criada') },
    onError: (e) => toast.error(errorMessage(e)),
  })
}

export function useUpdateProperty() {
  const { call } = useDashCtx()
  const inval = useInval()
  const { qc, token } = inval
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; database_id?: string } & Partial<NotionProperty>) => {
      const { database_id: _db, ...fields } = patch as Record<string, unknown>
      await call('prop_update', { property_id: id, ...fields })
      return { id, database_id: patch.database_id }
    },
    onSuccess: (r) => {
      // Sem database_id no patch, invalida todas as metas de db do token.
      if (r.database_id) inval.db(r.database_id)
      else qc.invalidateQueries({ queryKey: ['dash_notion', 'db', token] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
}

export function useDeleteProperty() {
  const { call } = useDashCtx()
  const inval = useInval()
  return useMutation({
    mutationFn: async (p: { id: string; database_id: string }) => {
      await call('prop_delete', { property_id: p.id }); return p
    },
    onSuccess: (p) => { inval.db(p.database_id); inval.rows(p.database_id); toast.success('Propriedade excluida') },
    onError: (e) => toast.error(errorMessage(e)),
  })
}

// ── VIEWS ────────────────────────────────────────────────────────────────────

export function useCreateView() {
  const { call } = useDashCtx()
  const inval = useInval()
  return useMutation({
    mutationFn: async (input: {
      database_id: string; name: string; kind: ViewKind
      config?: ViewConfig; sort_order?: number
    }) => {
      const r = await call<{ ok: boolean; view: NotionView }>('view_create', {
        database_id: input.database_id, name: input.name, kind: input.kind,
        config: input.config ?? {}, sort_order: input.sort_order ?? 999,
      })
      return r.view
    },
    onSuccess: (v) => { inval.db(v.database_id); toast.success('View criada') },
    onError: (e) => toast.error(errorMessage(e)),
  })
}

export function useUpdateView() {
  const { call } = useDashCtx()
  const inval = useInval()
  return useMutation({
    mutationFn: async ({ id, database_id, ...patch }: {
      id: string; database_id: string
      name?: string; kind?: ViewKind; filters?: FilterGroup
      sorts?: SortRule[]; visible_props?: string[]; config?: ViewConfig
    }) => {
      await call('view_update', { view_id: id, ...patch })
      return { id, database_id }
    },
    onSuccess: (v) => inval.db(v.database_id),
    onError: (e) => toast.error(errorMessage(e)),
  })
}

/** Reordena as views: grava sort_order = posicao pra cada id, na ordem dada. */
export function useReorderViews() {
  const { call } = useDashCtx()
  const inval = useInval()
  return useMutation({
    mutationFn: async (input: { database_id: string; orderedIds: string[] }) => {
      await Promise.all(input.orderedIds.map((id, i) => call('view_update', { view_id: id, sort_order: i })))
      return input
    },
    onSuccess: (input) => inval.db(input.database_id),
    onError: (e) => toast.error(errorMessage(e)),
  })
}

/** Marca uma view como padrao. Limpa a marca das outras. */
export function useSetDefaultView() {
  const { call } = useDashCtx()
  const inval = useInval()
  return useMutation({
    mutationFn: async (input: { database_id: string; view_id: string; views: NotionView[] }) => {
      await Promise.all(input.views.map(v => call('view_update', {
        view_id: v.id, config: { ...(v.config ?? {}), is_default: v.id === input.view_id },
      })))
      return input
    },
    onSuccess: (i) => { inval.db(i.database_id); toast.success('View padrao definida') },
    onError: (e) => toast.error(errorMessage(e)),
  })
}

export function useDeleteView() {
  const { call } = useDashCtx()
  const inval = useInval()
  return useMutation({
    mutationFn: async (v: { id: string; database_id: string }) => { await call('view_delete', { view_id: v.id }); return v },
    onSuccess: (v) => { inval.db(v.database_id); toast.success('View excluida') },
    onError: (e) => toast.error(errorMessage(e)),
  })
}

// ── LINHAS (mutations) ───────────────────────────────────────────────────────

export function useCreateRow() {
  const { call } = useDashCtx()
  const inval = useInval()
  return useMutation({
    mutationFn: async (input: {
      database_id: string; title?: string
      props?: Record<string, PropertyValue>; sort_order?: number
    }) => {
      const r = await call<{ ok: boolean; row: { id: string } }>('row_create', {
        database_id: input.database_id, title: input.title ?? '', sort_order: input.sort_order ?? Date.now(),
      })
      const entries = Object.entries(input.props ?? {})
      for (const [property_id, value] of entries) {
        await call('row_set_prop', { page_id: r.row.id, property_id, value })
      }
      return { id: r.row.id, database_id: input.database_id } as NotionPage & { database_id: string }
    },
    onSuccess: (p) => inval.rows(p.database_id),
    onError: (e) => toast.error(errorMessage(e)),
  })
}

/** Move+ordena um card no quadro (kanban). property_id/value do grupo alvo. */
export function useMoveRowInBoard() {
  const { call } = useDashCtx()
  const inval = useInval()
  const { qc, token } = inval
  return useMutation({
    mutationFn: async (input: {
      database_id: string; page_id: string; group_property_id: string
      group_value: PropertyValue | 'manter'; sort_order: number
    }) => {
      const payload: Record<string, unknown> = { page_id: input.page_id, sort_order: input.sort_order }
      if (input.group_value !== 'manter') {
        payload.property_id = input.group_property_id
        payload.value = input.group_value
      }
      await call('row_move', payload)
      return input
    },
    onMutate: async (input) => {
      const key = k.rows(token, input.database_id)
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<PageRow[]>(key)
      qc.setQueryData<PageRow[]>(key, (rows) =>
        (rows ?? [])
          .map(r => {
            if (r.id !== input.page_id) return r
            const props = input.group_value === 'manter'
              ? r.props
              : { ...r.props, [input.group_property_id]: input.group_value }
            return { ...r, sort_order: input.sort_order, props }
          })
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
      )
      return { prev, key }
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev)
      toast.error(errorMessage(e))
    },
    onSettled: (_d, _e, input) => inval.rows(input.database_id),
  })
}

export function useSetPropValue() {
  const { call } = useDashCtx()
  const inval = useInval()
  const { qc, token } = inval
  return useMutation({
    mutationFn: async (input: {
      page_id: string; property_id: string; value: PropertyValue; database_id: string
    }) => {
      await call('row_set_prop', { page_id: input.page_id, property_id: input.property_id, value: input.value })
      return input
    },
    onMutate: async (input) => {
      const key = k.rows(token, input.database_id)
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<PageRow[]>(key)
      qc.setQueryData<PageRow[]>(key, (rows) =>
        (rows ?? []).map(r =>
          r.id === input.page_id
            ? { ...r, props: { ...r.props, [input.property_id]: input.value } }
            : r,
        ),
      )
      return { prev, key }
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev)
      toast.error(errorMessage(e))
    },
    onSettled: (_d, _e, input) => { inval.rows(input.database_id); inval.page(input.page_id) },
  })
}

export function useSetRelation() {
  const { call } = useDashCtx()
  const inval = useInval()
  return useMutation({
    mutationFn: async (input: {
      property_id: string; from_page_id: string; to_page_ids: string[]; database_id: string
    }) => {
      await call('row_set_relation', {
        property_id: input.property_id, from_page_id: input.from_page_id, to_page_ids: input.to_page_ids,
      })
      return input
    },
    onSuccess: (input) => { inval.rows(input.database_id); inval.page(input.from_page_id) },
    onError: (e) => toast.error(errorMessage(e)),
  })
}

// ── CRONOMETRO / FINALIZAR ───────────────────────────────────────────────────

/** Liga/desliga o cronometro da linha/pagina (edge acumula o tempo ao parar). */
export function useToggleTimer() {
  const { call } = useDashCtx()
  const inval = useInval()
  return useMutation({
    mutationFn: async (input: { page: NotionPage | PageRow; database_id?: string | null }) => {
      const r = await call<{ ok: boolean; running: boolean }>('timer_toggle', { page_id: input.page.id })
      return { ...input, running: r.running }
    },
    onSuccess: (r) => {
      inval.page(r.page.id)
      if (r.database_id) inval.rows(r.database_id)
      toast.success(r.running ? 'Cronometro ligado' : 'Cronometro parado')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
}

/** Zera o cronometro (para e limpa o acumulado). */
export function useResetTimer() {
  const { call } = useDashCtx()
  const inval = useInval()
  return useMutation({
    mutationFn: async (input: { page_id: string; database_id?: string | null }) => {
      await call('timer_reset', { page_id: input.page_id })
      return input
    },
    onSuccess: (i) => {
      inval.page(i.page_id)
      if (i.database_id) inval.rows(i.database_id)
      toast.success('Cronometro zerado')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
}

/**
 * Finaliza (ou reabre) a tarefa. `toggle_done` grava completed_at e para o
 * cronometro; alem disso movemos a linha pra coluna de conclusao (row_set_prop)
 * pro quadro reagrupar igual ao CRM.
 */
export function useToggleFinalizada() {
  const { call } = useDashCtx()
  const inval = useInval()
  return useMutation({
    mutationFn: async (input: {
      page: NotionPage | PageRow
      database_id: string
      property_id?: string | null
      doneOptionId?: string | null
      voltarParaOptionId?: string | null
      finalizar: boolean
    }) => {
      await call('toggle_done', { page_id: input.page.id, done: input.finalizar })
      if (input.property_id) {
        const value = input.finalizar ? (input.doneOptionId ?? null) : (input.voltarParaOptionId ?? null)
        await call('row_set_prop', { page_id: input.page.id, property_id: input.property_id, value })
      }
      return input
    },
    onSuccess: (i) => {
      inval.rows(i.database_id)
      inval.page(i.page.id)
      toast.success(i.finalizar ? 'Tarefa finalizada' : 'Tarefa reaberta')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
}

// ── PAGINAS (mutations) ──────────────────────────────────────────────────────

export function useCreatePage() {
  const { call } = useDashCtx()
  const inval = useInval()
  return useMutation({
    mutationFn: async (input: {
      title?: string; parent_page_id?: string | null; icon?: string | null; content?: unknown[]
    }) => {
      const r = await call<{ ok: boolean; page: DashPageRow }>('page_create', {
        title: input.title ?? '', parent_page_id: input.parent_page_id ?? null,
        icon: input.icon ?? null, content: input.content ?? [],
      })
      return toNotionPage(r.page)
    },
    onSuccess: () => { inval.space(); toast.success('Pagina criada') },
    onError: (e) => toast.error(errorMessage(e)),
  })
}

export function useUpdatePage() {
  const { call } = useDashCtx()
  const inval = useInval()
  return useMutation({
    mutationFn: async ({ id, content, title, ...patch }: { id: string } & Partial<NotionPage>) => {
      // content nao existe em page_update -> vai por page_save (junto do titulo).
      if (content !== undefined) {
        await call('page_save', { page_id: id, content, ...(title !== undefined ? { title } : {}) })
      } else if (title !== undefined) {
        await call('page_update', { page_id: id, title, ...patch })
      }
      const rest = { ...patch } as Record<string, unknown>
      if (content === undefined && title === undefined && Object.keys(rest).length > 0) {
        await call('page_update', { page_id: id, ...rest })
      }
      return { id, database_id: (patch as { database_id?: string | null }).database_id ?? null }
    },
    onSuccess: (p) => { inval.page(p.id); inval.space(); if (p.database_id) inval.rows(p.database_id) },
    onError: (e) => toast.error(errorMessage(e)),
  })
}

/** Salva conteudo (autosave do editor) sem invalidar — evita flicker. */
export function useSavePageContent() {
  const { call } = useDashCtx()
  const { qc, token } = useInval()
  return useMutation({
    mutationFn: async (input: { id: string; content: unknown[]; title?: string }) => {
      await call('page_save', {
        page_id: input.id, content: input.content,
        ...(input.title !== undefined ? { title: input.title } : {}),
      })
      return input
    },
    onSuccess: (input) => {
      qc.setQueryData<NotionPage | null>(k.page(token, input.id), (old) =>
        old ? { ...old, content: input.content, ...(input.title !== undefined ? { title: input.title } : {}) } : old,
      )
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
}

export function useArchivePage() {
  const { call } = useDashCtx()
  const inval = useInval()
  return useMutation({
    mutationFn: async (p: { id: string; database_id?: string | null; archived?: boolean }) => {
      await call(p.archived === false ? 'page_restore' : 'page_archive', { page_id: p.id })
      return p
    },
    onSuccess: (p) => {
      inval.space(); inval.trash()
      if (p.database_id) inval.rows(p.database_id)
      toast.success(p.archived === false ? 'Pagina restaurada' : 'Movida para a lixeira')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
}

export function useDeletePageForever() {
  const { call } = useDashCtx()
  const inval = useInval()
  const { qc, token } = inval
  return useMutation({
    mutationFn: async (id: string) => { await call('page_delete_forever', { page_id: id }); return id },
    onSuccess: () => {
      inval.trash(); inval.space()
      qc.invalidateQueries({ queryKey: ['dash_notion', 'rows', token] })
      toast.success('Excluida definitivamente')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
}

export function useTrash() {
  const { token, call } = useDashCtx()
  return useQuery({
    queryKey: k.trash(token),
    queryFn: async () => {
      const { pages } = await call<{ pages: DashPageRow[] }>('trash')
      return (pages ?? []).map(toNotionPage)
    },
  })
}

/** Duplicar pagina/linha via action `page_duplicate` (conteudo + props). */
export function useDuplicatePage() {
  const { call } = useDashCtx()
  const inval = useInval()
  return useMutation({
    mutationFn: async (source: { id: string; database_id?: string | null }) => {
      const r = await call<{ ok: boolean; page: DashPageRow }>('page_duplicate', { page_id: source.id })
      return toNotionPage(r.page)
    },
    onSuccess: (p) => {
      inval.space()
      if (p.database_id) inval.rows(p.database_id)
      toast.success('Pagina duplicada')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
}

// ── TEMPLATES ────────────────────────────────────────────────────────────────

export interface DashTemplate { id: string; title: string; icon: string | null }

export function useTemplates(databaseId: string | null) {
  const { token, call } = useDashCtx()
  return useQuery({
    queryKey: k.templates(token, databaseId),
    enabled: !!databaseId,
    queryFn: async () => {
      const { templates } = await call<{ templates: DashTemplate[] }>('templates', { database_id: databaseId })
      return templates ?? []
    },
  })
}

/** Marca/desmarca uma linha como template do database. */
export function useSetTemplate() {
  const { call } = useDashCtx()
  const inval = useInval()
  return useMutation({
    mutationFn: async (input: { id: string; database_id: string; is_template: boolean }) => {
      await call('set_template', { page_id: input.id, is_template: input.is_template })
      return input
    },
    onSuccess: (i) => {
      inval.rows(i.database_id)
      inval.templates(i.database_id)
      toast.success(i.is_template ? 'Virou template' : 'Deixou de ser template')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
}

/** Cria uma linha nova a partir de um template (copia conteudo + props). */
export function useCreateFromTemplate() {
  const { call } = useDashCtx()
  const inval = useInval()
  return useMutation({
    mutationFn: async (input: { template_id: string; database_id: string }) => {
      const r = await call<{ ok: boolean; row: { id: string } }>('create_from_template', {
        template_id: input.template_id, database_id: input.database_id,
      })
      return { id: r.row.id, database_id: input.database_id }
    },
    onSuccess: (p) => { inval.rows(p.database_id); toast.success('Criada a partir do template') },
    onError: (e) => toast.error(errorMessage(e)),
  })
}

// ── COMENTARIOS ──────────────────────────────────────────────────────────────

export function useComments(pageId: string | null) {
  const { token, call } = useDashCtx()
  return useQuery({
    queryKey: k.comments(token, pageId),
    enabled: !!pageId,
    queryFn: async () => {
      const { comments } = await call<{ comments: NotionComment[] }>('comments', { page_id: pageId })
      return comments ?? []
    },
  })
}

export function useCreateComment() {
  const { call } = useDashCtx()
  const inval = useInval()
  return useMutation({
    mutationFn: async (input: {
      page_id: string; body: string; block_id?: string | null; parent_comment_id?: string | null
    }) => {
      await call('comment_create', {
        page_id: input.page_id, body: input.body,
        block_id: input.block_id ?? null, parent_comment_id: input.parent_comment_id ?? null,
      })
      return input
    },
    onSuccess: (c) => inval.comments(c.page_id),
    onError: (e) => toast.error(errorMessage(e)),
  })
}

/** Resolve/reabre (comment_resolve) e/ou edita o corpo (comment_update). */
export function useUpdateComment() {
  const { call } = useDashCtx()
  const inval = useInval()
  return useMutation({
    mutationFn: async (input: { id: string; page_id: string; is_resolved?: boolean; body?: string }) => {
      if (input.body !== undefined) {
        await call('comment_update', { comment_id: input.id, body: input.body })
      }
      if (input.is_resolved !== undefined) {
        await call('comment_resolve', { comment_id: input.id, resolved: input.is_resolved })
      }
      return input
    },
    onSuccess: (c) => inval.comments(c.page_id),
    onError: (e) => toast.error(errorMessage(e)),
  })
}

/** Exclui um comentario (comment_delete). */
export function useDeleteComment() {
  const { call } = useDashCtx()
  const inval = useInval()
  return useMutation({
    mutationFn: async (c: { id: string; page_id: string }) => {
      await call('comment_delete', { comment_id: c.id })
      return c
    },
    onSuccess: (c) => inval.comments(c.page_id),
    onError: (e) => toast.error(errorMessage(e)),
  })
}

// ── VERSOES ──────────────────────────────────────────────────────────────────

export function useVersions(pageId: string | null) {
  const { token, call } = useDashCtx()
  return useQuery({
    queryKey: k.versions(token, pageId),
    enabled: !!pageId,
    queryFn: async () => {
      const { versions } = await call<{ versions: NotionPageVersion[] }>('versions', { page_id: pageId })
      return versions ?? []
    },
  })
}

export function useSnapshotVersion() {
  const { call } = useDashCtx()
  const inval = useInval()
  return useMutation({
    mutationFn: async (input: { page_id: string; title?: string; content?: unknown[] }) => {
      await call('version_snapshot', { page_id: input.page_id })
      return input
    },
    onSuccess: (i) => inval.versions(i.page_id),
  })
}

// ── BACKLINKS ────────────────────────────────────────────────────────────────

export function useBacklinks(pageId: string | null) {
  const { token, call } = useDashCtx()
  return useQuery({
    queryKey: k.backlinks(token, pageId),
    enabled: !!pageId,
    queryFn: async () => {
      const { backlinks } = await call<{ backlinks: { id: string; title: string; icon: string | null }[] }>(
        'backlinks', { page_id: pageId },
      )
      return backlinks ?? []
    },
  })
}

export function useSyncPageLinks() {
  const { call } = useDashCtx()
  const { qc, token } = useInval()
  return useMutation({
    mutationFn: async (input: { from_page_id: string; to_page_ids: string[] }) => {
      const links = [...new Set(input.to_page_ids)]
        .filter(id => id !== input.from_page_id)
        .map(to_page_id => ({ to_page_id, block_id: '' }))
      await call('sync_links', { from_page_id: input.from_page_id, links })
      return input
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dash_notion', 'backlinks', token] }),
  })
}

// ── PESSOAS (members) ────────────────────────────────────────────────────────

export function useMembers() {
  const { token, call } = useDashCtx()
  return useQuery({
    queryKey: k.members(token),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { members } = await call<{
        members: { id: string; name: string; cargo: string | null; side: 'lm' | 'client' }[]
      }>('members')
      return (members ?? []).map<DashMember>(m => ({
        id: m.id, full_name: m.name, email: m.cargo, avatar_url: null, side: m.side, cargo: m.cargo,
      }))
    },
  })
}

// ── BUSCA (client-side sobre a arvore, sem action de busca) ──────────────────

export function useSearchPages(term: string) {
  const { data: space } = useSpace()
  const t = term.trim().toLowerCase()
  const pages = space?.pages ?? []
  if (t.length < 2) return { data: [] as TreePage[] }
  return {
    data: pages
      .filter(p => !p.is_archived && (p.title || '').toLowerCase().includes(t))
      .slice(0, 30),
  }
}

// ── UPLOAD (action `upload`, base64) ─────────────────────────────────────────

export function useUploadFile() {
  const { call } = useDashCtx()
  return async (file: File): Promise<string> => {
    const data = await fileToBase64(file)
    const r = await call<{ ok: boolean; url: string }>('upload', {
      filename: file.name, content_type: file.type || 'application/octet-stream', data,
    })
    return r.url
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const res = reader.result
      if (typeof res !== 'string') { reject(new Error('leitura falhou')); return }
      // data:...;base64,XXXX -> só a parte base64
      const comma = res.indexOf(',')
      resolve(comma >= 0 ? res.slice(comma + 1) : res)
    }
    reader.onerror = () => reject(reader.error ?? new Error('leitura falhou'))
    reader.readAsDataURL(file)
  })
}
