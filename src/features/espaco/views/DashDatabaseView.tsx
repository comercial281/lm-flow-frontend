// DashNotion — orquestrador das views de um database. Duplicata adaptada de
// _internal/views/DatabaseView.tsx: navegacao entre views por ESTADO LOCAL
// (sem react-router / useSearchParams) e hooks do dash. Sem painel de
// templates (a edge nao tem action de template) e sem "minhas tarefas"
// (a identidade no dash e por sessao, nao ha meId estavel).

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus, Search, SlidersHorizontal, ArrowUpDown, Settings2, MoreHorizontal,
  Pencil, Copy, Trash2, X, Check, Table, Columns3, LayoutGrid, List as ListIcon,
  Calendar as CalendarIcon, GanttChart, ChevronDown, FileText, type LucideIcon,
} from 'lucide-react'
import type {
  NotionView, ViewKind, PageRow, PropertyValue, FilterGroup, SortRule, ViewConfig,
  SelectOption,
} from '@/features/espaco/internal/types'
import { VIEW_KIND_LABELS } from '@/features/espaco/internal/types'
import { PROPERTY_ICONS } from '@/features/espaco/internal/props/propertyIcons'
import {
  applyFilters, applySorts, resolveCellValue, propriedadesVisiveis, alternarColuna,
  textoBuscavel,
} from '@/features/espaco/internal/views/viewLib'
import Dropdown from '@/features/espaco/internal/Dropdown'
import CalendarView from '@/features/espaco/internal/views/CalendarView'
import TimelineView from '@/features/espaco/internal/views/TimelineView'
import SortMenu from '@/features/espaco/internal/views/SortMenu'
import {
  useRows, useProperties, useViews, useCreateView, useUpdateView, useDeleteView,
  useCreateRow, useSetPropValue, useSetRelation, useArchivePage, useDuplicatePage,
  useMoveRowInBoard, useRollupSourceRows, useReorderViews, useSetDefaultView, useUpdateProperty,
  useTemplates, useCreateFromTemplate,
} from '../useDashNotion'
import TableView from './TableView'
import BoardView from './BoardView'
import GalleryView from './GalleryView'
import ListView from './ListView'
import FilterMenu from './FilterMenu'

interface DatabaseViewProps {
  databaseId: string
  onOpenPage: (pageId: string) => void
}

const VIEW_ICONS: Record<ViewKind, LucideIcon> = {
  table: Table,
  board: Columns3,
  gallery: LayoutGrid,
  list: ListIcon,
  calendar: CalendarIcon,
  timeline: GanttChart,
}

const EMPTY_FILTERS: FilterGroup = { operator: 'and', conditions: [] }

type Panel = 'filter' | 'sort' | 'props' | 'newView' | 'templates' | null

export default function DashDatabaseView({ databaseId, onOpenPage }: DatabaseViewProps) {
  const [panel, setPanel] = useState<Panel>(null)
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [viewMenu, setViewMenu] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const [activeViewId, setActiveViewId] = useState<string | null>(null)

  const { data: rowsCru = [], isLoading: loadingRows } = useRows(databaseId)
  const { data: properties = [] } = useProperties(databaseId)
  const { data: views = [], isLoading: loadingViews } = useViews(databaseId)
  const { data: fonteRollup } = useRollupSourceRows(properties)
  const { data: templates = [] } = useTemplates(databaseId)
  const createFromTemplate = useCreateFromTemplate()

  const rows = useMemo<PageRow[]>(() => {
    const rollups = properties.filter(p => p.type === 'rollup')
    if (rollups.length === 0 || !fonteRollup) return rowsCru
    const todasProps = [...properties, ...fonteRollup.props]
    return rowsCru.map(row => {
      const extra: Record<string, PropertyValue> = {}
      for (const p of rollups) {
        extra[p.id] = resolveCellValue(row, p, todasProps, fonteRollup.rows)
      }
      return { ...row, props: { ...row.props, ...extra } }
    })
  }, [rowsCru, properties, fonteRollup])

  const createView = useCreateView()
  const updateView = useUpdateView()
  const deleteView = useDeleteView()
  const reorderViews = useReorderViews()
  const setDefaultView = useSetDefaultView()
  const updateProperty = useUpdateProperty()
  const [dragViewId, setDragViewId] = useState<string | null>(null)
  const btnNovaView = useRef<HTMLButtonElement>(null)
  const btnFiltro = useRef<HTMLButtonElement>(null)
  const btnOrdenar = useRef<HTMLButtonElement>(null)
  const btnProps = useRef<HTMLButtonElement>(null)
  const btnTemplates = useRef<HTMLButtonElement>(null)
  const createRow = useCreateRow()
  const setPropValue = useSetPropValue()
  const moveRow = useMoveRowInBoard()
  const setRelation = useSetRelation()
  const archivePage = useArchivePage()
  const duplicatePage = useDuplicatePage()

  const activeView = useMemo<NotionView | null>(() => {
    if (views.length === 0) return null
    return views.find(v => v.id === activeViewId)
      ?? views.find(v => v.config?.is_default)
      ?? views[0]
  }, [views, activeViewId])

  useEffect(() => {
    if (activeView && activeViewId !== activeView.id) setActiveViewId(activeView.id)
  }, [activeView, activeViewId])

  function selectView(id: string) {
    setActiveViewId(id)
    setPanel(null)
    setViewMenu(null)
  }

  const visibleRows = useMemo(() => {
    if (!activeView) return []
    const list = applyFilters(rows, activeView.filters ?? EMPTY_FILTERS, properties)
    const term = search.trim().toLowerCase()
    const filtered = term ? list.filter(r => textoBuscavel(r, properties).includes(term)) : list
    return applySorts(filtered, activeView.sorts ?? [], properties)
  }, [rows, properties, activeView, search])

  function patchView(patch: {
    name?: string; filters?: FilterGroup; sorts?: SortRule[]
    visible_props?: string[]; config?: ViewConfig
  }) {
    if (!activeView) return
    updateView.mutate({ id: activeView.id, database_id: databaseId, ...patch })
  }

  function handleSetValue(pageId: string, propertyId: string, value: PropertyValue) {
    setPropValue.mutate({ page_id: pageId, property_id: propertyId, value, database_id: databaseId })
  }

  function handleMoveRow(input: {
    page_id: string; group_property_id: string
    group_value: PropertyValue | 'manter'; sort_order: number
  }) {
    moveRow.mutate({ database_id: databaseId, ...input })
  }

  function handleSetRelation(pageId: string, propertyId: string, pageIds: string[]) {
    setRelation.mutate({
      property_id: propertyId, from_page_id: pageId, to_page_ids: pageIds, database_id: databaseId,
    })
  }

  function handleCreateRow(props?: Record<string, PropertyValue>) {
    createRow.mutate(
      { database_id: databaseId, title: '', props },
      { onSuccess: (p) => onOpenPage(p.id) },
    )
  }

  function handleDeleteRow(row: PageRow) {
    archivePage.mutate({ id: row.id, database_id: databaseId })
  }

  function handleUpdateGroupOptions(options: SelectOption[]) {
    const groupId = activeView?.config?.group_by
    const prop = properties.find(p => p.id === groupId)
    if (!prop) return
    updateProperty.mutate({ id: prop.id, database_id: databaseId, config: { ...(prop.config ?? {}), options } })
  }

  function addView(kind: ViewKind) {
    createView.mutate(
      { database_id: databaseId, name: VIEW_KIND_LABELS[kind], kind, sort_order: views.length },
      { onSuccess: (created) => selectView(created.id) },
    )
    setPanel(null)
  }

  function duplicateView(view: NotionView) {
    createView.mutate(
      { database_id: databaseId, name: `${view.name} (copia)`, kind: view.kind, config: view.config, sort_order: views.length },
      { onSuccess: (created) => selectView(created.id) },
    )
    setViewMenu(null)
  }

  function removeView(view: NotionView) {
    if (views.length <= 1) return
    deleteView.mutate({ id: view.id, database_id: databaseId })
    setViewMenu(null)
    const fallback = views.find(v => v.id !== view.id)
    if (fallback) selectView(fallback.id)
  }

  function commitRename() {
    if (!renaming) return
    const name = renaming.name.trim()
    if (name) updateView.mutate({ id: renaming.id, database_id: databaseId, name })
    setRenaming(null)
  }

  function setDefault(view: NotionView) {
    setDefaultView.mutate({ database_id: databaseId, view_id: view.id, views })
    setViewMenu(null)
  }

  function onTabDrop(fromId: string, toId: string) {
    if (fromId === toId) return
    const ids = views.map(v => v.id)
    const from = ids.indexOf(fromId)
    const to = ids.indexOf(toId)
    if (from < 0 || to < 0) return
    ids.splice(to, 0, ids.splice(from, 1)[0])
    reorderViews.mutate({ database_id: databaseId, orderedIds: ids })
  }

  if (loadingViews || loadingRows) {
    return (
      <div className="flex h-full items-center justify-center py-16">
        <p className="text-sm text-lm-subtle">Carregando...</p>
      </div>
    )
  }

  if (!activeView) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 py-16">
        <p className="text-sm text-lm-subtle">Esta base ainda nao tem nenhuma view.</p>
        <button
          type="button"
          onClick={() => addView('table')}
          className="flex items-center gap-1.5 rounded-lm-sm bg-lm-neon px-3 py-1.5 text-xs text-lm-inverse hover:bg-lm-mid"
        >
          <Plus className="h-3.5 w-3.5" />
          Criar tabela
        </button>
      </div>
    )
  }

  const filterCount = activeView.filters?.conditions?.length ?? 0
  const sortCount = activeView.sorts?.length ?? 0

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-lm-border px-3 py-1.5">
        <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {views.map(view => {
            const Icon = VIEW_ICONS[view.kind]
            const active = view.id === activeView.id
            return (
              <div
                key={view.id}
                className={`relative shrink-0 ${dragViewId && dragViewId !== view.id ? 'rounded-lm-sm ring-1 ring-transparent hover:ring-lm-neon' : ''}`}
                onDragOver={(e) => { if (dragViewId) e.preventDefault() }}
                onDrop={() => { if (dragViewId) onTabDrop(dragViewId, view.id); setDragViewId(null) }}
              >
                {renaming?.id === view.id ? (
                  <span className="flex items-center gap-1 px-1">
                    <input
                      autoFocus
                      aria-label="Nome da view"
                      value={renaming.name}
                      onChange={(e) => setRenaming({ id: view.id, name: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename()
                        if (e.key === 'Escape') setRenaming(null)
                      }}
                      className="h-7 w-32 rounded-lm-sm border border-lm-neon bg-lm-bg px-2 text-xs text-lm-primary outline-none"
                    />
                    <button
                      type="button"
                      onClick={commitRename}
                      aria-label="Salvar nome"
                      className="rounded-lm-sm p-1 text-lm-subtle hover:text-lm-primary"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ) : (
                  <div
                    className={`flex items-center rounded-lm-sm text-xs transition-colors ${
                      active ? 'bg-lm-card2 text-lm-primary' : 'text-lm-subtle hover:bg-lm-card2 hover:text-lm-muted'
                    }`}
                  >
                    <button
                      type="button"
                      draggable
                      onDragStart={() => setDragViewId(view.id)}
                      onDragEnd={() => setDragViewId(null)}
                      onClick={() => selectView(view.id)}
                      className="flex cursor-grab items-center gap-1.5 py-1.5 pl-2 pr-1"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="max-w-[140px] truncate">{view.name}</span>
                    </button>
                    <MenuDaView
                      view={view}
                      podeExcluir={views.length > 1}
                      aberto={viewMenu === view.id}
                      onToggle={() => setViewMenu(viewMenu === view.id ? null : view.id)}
                      onClose={() => setViewMenu(null)}
                      onPadrao={() => setDefault(view)}
                      onRenomear={() => { setRenaming({ id: view.id, name: view.name }); setViewMenu(null) }}
                      onDuplicar={() => duplicateView(view)}
                      onExcluir={() => removeView(view)}
                    />
                  </div>
                )}
              </div>
            )
          })}

          <div className="shrink-0">
            <button
              ref={btnNovaView}
              type="button"
              onClick={() => setPanel(panel === 'newView' ? null : 'newView')}
              aria-label="Criar view"
              className="rounded-lm-sm p-1.5 text-lm-subtle hover:bg-lm-card2 hover:text-lm-primary"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <Dropdown anchorRef={btnNovaView} open={panel === 'newView'} onClose={() => setPanel(null)}>
              <div className="w-44 py-1">
                {(Object.keys(VIEW_KIND_LABELS) as ViewKind[]).map(kind => {
                  const Icon = VIEW_ICONS[kind]
                  return <MenuItem key={kind} icon={Icon} label={VIEW_KIND_LABELS[kind]} onClick={() => addView(kind)} />
                })}
              </div>
            </Dropdown>
          </div>
        </nav>

        <div className="flex shrink-0 items-center gap-0.5 ml-auto">
          <div className="relative">
            <button
              type="button"
              ref={btnFiltro}
              onClick={() => setPanel(panel === 'filter' ? null : 'filter')}
              className={`flex items-center gap-1 rounded-lm-sm px-2 py-1.5 text-xs hover:bg-lm-card2 ${
                filterCount > 0 ? 'text-lm-neon' : 'text-lm-subtle hover:text-lm-primary'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtro{filterCount > 0 ? ` (${filterCount})` : ''}
            </button>
            <Popover anchorRef={btnFiltro} open={panel === 'filter'} onClose={() => setPanel(null)}>
              <FilterMenu
                properties={properties}
                filters={activeView.filters ?? EMPTY_FILTERS}
                onChange={(filters) => patchView({ filters })}
                onClose={() => setPanel(null)}
              />
            </Popover>
          </div>

          <div className="relative">
            <button
              type="button"
              ref={btnOrdenar}
              onClick={() => setPanel(panel === 'sort' ? null : 'sort')}
              className={`flex items-center gap-1 rounded-lm-sm px-2 py-1.5 text-xs hover:bg-lm-card2 ${
                sortCount > 0 ? 'text-lm-neon' : 'text-lm-subtle hover:text-lm-primary'
              }`}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              Ordenar{sortCount > 0 ? ` (${sortCount})` : ''}
            </button>
            <Popover anchorRef={btnOrdenar} open={panel === 'sort'} onClose={() => setPanel(null)}>
              <SortMenu
                properties={properties}
                sorts={activeView.sorts ?? []}
                onChange={(sorts) => patchView({ sorts })}
                onClose={() => setPanel(null)}
              />
            </Popover>
          </div>

          {searchOpen ? (
            <span className="flex items-center gap-1">
              <input
                autoFocus
                aria-label="Buscar"
                value={search}
                placeholder="Buscar"
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { setSearch(''); setSearchOpen(false) } }}
                className="h-7 w-40 rounded-lm-sm border border-lm-border bg-lm-bg px-2 text-xs text-lm-primary outline-none placeholder:text-lm-disabled focus:border-lm-neon"
              />
              <button
                type="button"
                onClick={() => { setSearch(''); setSearchOpen(false) }}
                aria-label="Fechar busca"
                className="rounded-lm-sm p-1 text-lm-subtle hover:text-lm-primary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Buscar"
              className="rounded-lm-sm p-1.5 text-lm-subtle hover:bg-lm-card2 hover:text-lm-primary"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
          )}

          <div className="relative">
            <button
              type="button"
              ref={btnProps}
              onClick={() => setPanel(panel === 'props' ? null : 'props')}
              aria-label="Propriedades"
              className="rounded-lm-sm p-1.5 text-lm-subtle hover:bg-lm-card2 hover:text-lm-primary"
            >
              <Settings2 className="h-3.5 w-3.5" />
            </button>
            <Popover anchorRef={btnProps} open={panel === 'props'} onClose={() => setPanel(null)}>
              <PropertiesMenu
                properties={properties}
                visible={propriedadesVisiveis(properties, activeView).map(p => p.id)}
                onToggle={(id) => patchView(alternarColuna(properties, activeView, id))}
              />
            </Popover>
          </div>

          <div className="relative ml-1 flex">
            <button
              type="button"
              onClick={() => handleCreateRow()}
              className="flex items-center gap-1 rounded-l-lm-sm bg-lm-neon px-2.5 py-1.5 text-xs text-lm-inverse hover:bg-lm-mid"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo
            </button>
            <button
              type="button"
              aria-label="Novo a partir de template"
              ref={btnTemplates}
              onClick={() => setPanel(panel === 'templates' ? null : 'templates')}
              className="rounded-r-lm-sm border-l border-lm-inverse/25 bg-lm-neon px-1.5 text-lm-inverse hover:bg-lm-mid"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <Popover anchorRef={btnTemplates} open={panel === 'templates'} onClose={() => setPanel(null)}>
              <div className="w-56 py-1">
                <p className="px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-lm-subtle">
                  Templates
                </p>
                {templates.length === 0 && (
                  <p className="px-2.5 py-2 text-xs text-lm-disabled">
                    Nenhum template. Abra uma linha, clique em "..." e marque como template.
                  </p>
                )}
                {templates.map(t => (
                  <MenuItem
                    key={t.id}
                    icon={FileText}
                    label={t.title || 'Sem titulo'}
                    onClick={() => {
                      createFromTemplate.mutate(
                        { template_id: t.id, database_id: databaseId },
                        { onSuccess: p => onOpenPage(p.id) },
                      )
                      setPanel(null)
                    }}
                  />
                ))}
                <div className="my-1 border-t border-lm-border" />
                <MenuItem
                  icon={Plus}
                  label="Em branco"
                  onClick={() => { handleCreateRow(); setPanel(null) }}
                />
              </div>
            </Popover>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {activeView.kind === 'table' && (
          <TableView
            rows={visibleRows}
            properties={properties}
            view={activeView}
            databaseId={databaseId}
            onOpenPage={onOpenPage}
            onUpdateView={patchView}
            onSetValue={handleSetValue}
            onSetRelation={handleSetRelation}
            onCreateRow={() => handleCreateRow()}
            onDuplicateRow={(row) => duplicatePage.mutate(row)}
            onDeleteRow={handleDeleteRow}
          />
        )}
        {activeView.kind === 'board' && (
          <BoardView
            rows={visibleRows}
            properties={properties}
            view={activeView}
            databaseId={databaseId}
            onOpenPage={onOpenPage}
            onMoveRow={handleMoveRow}
            onCreateRow={handleCreateRow}
            onUpdateGroupOptions={handleUpdateGroupOptions}
          />
        )}
        {activeView.kind === 'gallery' && (
          <GalleryView rows={visibleRows} properties={properties} view={activeView} databaseId={databaseId} onOpenPage={onOpenPage} />
        )}
        {activeView.kind === 'list' && (
          <ListView rows={visibleRows} properties={properties} view={activeView} databaseId={databaseId} onOpenPage={onOpenPage} />
        )}
        {activeView.kind === 'calendar' && (
          <CalendarView rows={visibleRows} properties={properties} view={activeView} onOpenPage={onOpenPage} onSetValue={handleSetValue} />
        )}
        {activeView.kind === 'timeline' && (
          <TimelineView rows={visibleRows} properties={properties} view={activeView} onOpenPage={onOpenPage} onUpdateView={patchView} />
        )}
      </div>
    </div>
  )
}

function MenuDaView({
  view, podeExcluir, aberto, onToggle, onClose,
  onPadrao, onRenomear, onDuplicar, onExcluir,
}: {
  view: NotionView
  podeExcluir: boolean
  aberto: boolean
  onToggle: () => void
  onClose: () => void
  onPadrao: () => void
  onRenomear: () => void
  onDuplicar: () => void
  onExcluir: () => void
}) {
  const btn = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-label={`Opcoes da view ${view.name}`}
        onClick={onToggle}
        className="rounded-r-lm-sm py-1.5 pl-0.5 pr-1.5 text-lm-subtle hover:text-lm-primary"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>
      <Dropdown anchorRef={btn} open={aberto} onClose={onClose}>
        <div className="w-48 py-1">
          <MenuItem
            icon={Check}
            label={view.config?.is_default ? 'Ja e a padrao' : 'Definir como padrao'}
            disabled={!!view.config?.is_default}
            onClick={onPadrao}
          />
          <MenuItem icon={Pencil} label="Renomear" onClick={onRenomear} />
          <MenuItem icon={Copy} label="Duplicar" onClick={onDuplicar} />
          <MenuItem icon={Trash2} label="Excluir" danger disabled={!podeExcluir} onClick={onExcluir} />
        </div>
      </Dropdown>
    </>
  )
}

function Popover({ anchorRef, open, children, onClose }: {
  anchorRef: React.RefObject<HTMLButtonElement | null>
  open: boolean
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <Dropdown anchorRef={anchorRef} open={open} onClose={onClose} align="right">
      {children}
    </Dropdown>
  )
}

function PropertiesMenu({ properties, visible, onToggle }: {
  properties: { id: string; name: string; type: keyof typeof PROPERTY_ICONS; is_visible?: boolean }[]
  visible: string[]
  onToggle: (id: string) => void
}) {
  const effective = new Set(visible)
  return (
    <div className="w-60 py-1">
      <p className="px-3 py-1.5 text-xs font-medium text-heading">Propriedades</p>
      {properties.length === 0 ? (
        <p className="px-3 py-4 text-center text-xs text-lm-subtle">Nenhuma propriedade.</p>
      ) : (
        <ul className="max-h-72 overflow-y-auto">
          {properties.map(property => {
            const Icon = PROPERTY_ICONS[property.type]
            const on = effective.has(property.id)
            return (
              <li key={property.id}>
                <button
                  type="button"
                  onClick={() => onToggle(property.id)}
                  disabled={property.type === 'title'}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-lm-muted hover:bg-lm-card2 hover:text-lm-primary disabled:opacity-50"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-lm-subtle" />
                  <span className="flex-1 truncate">{property.name}</span>
                  {(on || property.type === 'title') && <Check className="h-3.5 w-3.5 text-lm-neon" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function MenuItem({ icon: Icon, label, onClick, danger, disabled }: {
  icon: LucideIcon; label: string; onClick: () => void; danger?: boolean; disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-lm-card2 disabled:opacity-40 ${
        danger ? 'text-lm-danger' : 'text-lm-muted hover:text-lm-primary'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}
