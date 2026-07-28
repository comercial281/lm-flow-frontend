// DashNotion — view de tabela. Duplicata de _internal/views/TableView.tsx.
// So o PropCell muda (versao do dash); viewLib/tipos/icones vem do CRM (puros).

import { useEffect, useRef, useState } from 'react'
import { Plus, MoreHorizontal, ExternalLink, Copy, Trash2, ArrowUp, ArrowDown, EyeOff } from 'lucide-react'
import type { PageRow, NotionProperty, NotionView, ViewConfig, PropertyValue, SortRule } from '@/features/espaco/internal/types'
import { PROPERTY_ICONS } from '@/features/espaco/internal/props/propertyIcons'
import { resolveCellValue, propriedadesVisiveis, alternarColuna } from '@/features/espaco/internal/views/viewLib'
import PropCell from '../props/PropCell'

interface TableViewProps {
  rows: PageRow[]
  properties: NotionProperty[]
  view: NotionView
  databaseId: string
  onOpenPage: (pageId: string) => void
  onUpdateView: (patch: { visible_props?: string[]; sorts?: SortRule[]; config?: ViewConfig }) => void
  onSetValue: (pageId: string, propertyId: string, value: PropertyValue) => void
  onSetRelation: (pageId: string, propertyId: string, pageIds: string[]) => void
  onCreateRow: () => void
  onDuplicateRow: (row: PageRow) => void
  onDeleteRow: (row: PageRow) => void
}

type Widths = Record<string, number>

const DEFAULT_WIDTH = 180
const TITLE_WIDTH = 280
const MIN_WIDTH = 90

function readWidths(config: ViewConfig): Widths {
  return config.column_widths ?? {}
}

export default function TableView({
  rows, properties, view, databaseId, onOpenPage, onUpdateView,
  onSetValue, onSetRelation, onCreateRow, onDuplicateRow, onDeleteRow,
}: TableViewProps) {
  const [widths, setWidths] = useState<Widths>(() => readWidths(view.config ?? {}))
  const [menuRow, setMenuRow] = useState<string | null>(null)
  const [menuProp, setMenuProp] = useState<string | null>(null)
  const dragging = useRef<{ id: string; startX: number; startWidth: number } | null>(null)

  useEffect(() => { setWidths(readWidths(view.config ?? {})) }, [view.id, view.config])

  const semTitulo = propriedadesVisiveis(properties, view)
  const titulo = properties.find(p => p.type === 'title')
  const visible = titulo && !semTitulo.some(p => p.id === titulo.id)
    ? [titulo, ...semTitulo]
    : semTitulo

  const titleProp = visible.find(p => p.type === 'title') ?? properties.find(p => p.type === 'title') ?? null
  const columns = titleProp
    ? [titleProp, ...visible.filter(p => p.id !== titleProp.id)]
    : visible

  function widthOf(property: NotionProperty): number {
    return widths[property.id] ?? (property.type === 'title' ? TITLE_WIDTH : DEFAULT_WIDTH)
  }

  function startResize(e: React.PointerEvent, property: NotionProperty) {
    e.preventDefault()
    e.stopPropagation()
    dragging.current = { id: property.id, startX: e.clientX, startWidth: widthOf(property) }

    function onMove(ev: PointerEvent) {
      const d = dragging.current
      if (!d) return
      const next = Math.max(MIN_WIDTH, d.startWidth + (ev.clientX - d.startX))
      setWidths(w => ({ ...w, [d.id]: next }))
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const d = dragging.current
      dragging.current = null
      if (!d) return
      setWidths((current) => {
        onUpdateView({ config: { ...(view.config ?? {}), column_widths: current } })
        return current
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function sortBy(property: NotionProperty, direction: 'asc' | 'desc') {
    onUpdateView({ sorts: [{ property_id: property.id, direction }] })
    setMenuProp(null)
  }

  function hide(property: NotionProperty) {
    onUpdateView(alternarColuna(properties, view, property.id))
    setMenuProp(null)
  }

  if (columns.length === 0) {
    return <EmptyState message="Nenhuma propriedade visivel nesta tabela." />
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="min-w-max">
          <div className="sticky top-0 z-10 flex border-y border-lm-border bg-lm-dark">
            {columns.map(property => {
              const Icon = PROPERTY_ICONS[property.type]
              return (
                <div
                  key={property.id}
                  style={{ width: widthOf(property) }}
                  className="group relative flex shrink-0 items-center gap-1.5 border-r border-lm-border px-2 py-1.5"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-lm-subtle" />
                  <span className="truncate text-xs font-medium text-lm-muted">{property.name}</span>

                  <button
                    type="button"
                    aria-label={`Opcoes de ${property.name}`}
                    onClick={() => setMenuProp(menuProp === property.id ? null : property.id)}
                    className="ml-auto rounded-lm-sm p-0.5 text-lm-subtle hover:bg-lm-card2 hover:text-lm-primary"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>

                  {menuProp === property.id && (
                    <>
                      <button
                        type="button"
                        aria-label="Fechar menu"
                        className="fixed inset-0 z-20 cursor-default"
                        onClick={() => setMenuProp(null)}
                      />
                      <div className="absolute right-0 top-full z-30 mt-1 w-44 rounded-lm-md border border-lm-border bg-lm-card py-1 shadow-lm-lg">
                        <MenuItem icon={ArrowUp} label="Ordenar crescente" onClick={() => sortBy(property, 'asc')} />
                        <MenuItem icon={ArrowDown} label="Ordenar decrescente" onClick={() => sortBy(property, 'desc')} />
                        {property.type !== 'title' && (
                          <MenuItem icon={EyeOff} label="Ocultar coluna" onClick={() => hide(property)} />
                        )}
                      </div>
                    </>
                  )}

                  <div
                    role="separator"
                    aria-orientation="vertical"
                    onPointerDown={(e) => startResize(e, property)}
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-lm-neon"
                  />
                </div>
              )
            })}
            <div className="sticky right-0 z-10 w-10 shrink-0 border-l border-lm-border bg-lm-dark" />
          </div>

          {rows.length === 0 ? (
            <EmptyState message="Nenhuma linha ainda. Use o botao abaixo para criar a primeira." />
          ) : (
            rows.map(row => (
              <div key={row.id} className="group flex border-b border-lm-border hover:bg-lm-card2/50">
                {columns.map(property => (
                  <div
                    key={property.id}
                    style={{ width: widthOf(property) }}
                    className="shrink-0 border-r border-lm-border"
                  >
                    {property.type === 'title' ? (
                      <button
                        type="button"
                        onClick={() => onOpenPage(row.id)}
                        className="flex h-full w-full items-center gap-1.5 px-2 py-1.5 text-left"
                      >
                        <span className="truncate text-sm text-lm-primary group-hover:text-lm-neon">
                          {row.title || 'Sem titulo'}
                        </span>
                        <ExternalLink className="ml-auto h-3 w-3 shrink-0 text-lm-subtle opacity-0 group-hover:opacity-100" />
                      </button>
                    ) : (
                      <PropCell
                        property={property}
                        value={resolveCellValue(row, property, properties)}
                        pageId={row.id}
                        databaseId={databaseId}
                        relations={row.relations[property.id]}
                        onChange={(v) => onSetValue(row.id, property.id, v)}
                        onRelationChange={(ids) => onSetRelation(row.id, property.id, ids)}
                        variant="table"
                      />
                    )}
                  </div>
                ))}

                <div className="sticky right-0 z-10 flex w-10 shrink-0 items-center justify-center border-l border-lm-border bg-lm-deep group-hover:bg-lm-card2">
                  <button
                    type="button"
                    aria-label="Opcoes da linha"
                    onClick={() => setMenuRow(menuRow === row.id ? null : row.id)}
                    className="rounded-lm-sm p-1 text-lm-subtle hover:bg-lm-card2 hover:text-lm-primary"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                  {menuRow === row.id && (
                    <>
                      <button
                        type="button"
                        aria-label="Fechar menu"
                        className="fixed inset-0 z-20 cursor-default"
                        onClick={() => setMenuRow(null)}
                      />
                      <div className="absolute right-1 top-full z-30 mt-1 w-40 rounded-lm-md border border-lm-border bg-lm-card py-1 shadow-lm-lg">
                        <MenuItem icon={ExternalLink} label="Abrir" onClick={() => { setMenuRow(null); onOpenPage(row.id) }} />
                        <MenuItem icon={Copy} label="Duplicar" onClick={() => { setMenuRow(null); onDuplicateRow(row) }} />
                        <MenuItem icon={Trash2} label="Excluir" danger onClick={() => { setMenuRow(null); onDeleteRow(row) }} />
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))
          )}

          <button
            type="button"
            onClick={onCreateRow}
            className="flex w-full items-center gap-1.5 border-b border-lm-border px-2 py-2 text-xs text-lm-subtle hover:bg-lm-card2 hover:text-lm-primary"
          >
            <Plus className="h-3.5 w-3.5" />
            Novo
          </button>
        </div>
      </div>

      <footer className="border-t border-lm-border px-3 py-1.5 text-xs text-lm-subtle">
        {rows.length} {rows.length === 1 ? 'linha' : 'linhas'}
      </footer>
    </div>
  )
}

function MenuItem({ icon: Icon, label, onClick, danger }: {
  icon: typeof Plus; label: string; onClick: () => void; danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-lm-card2 ${
        danger ? 'text-lm-danger' : 'text-lm-muted hover:text-lm-primary'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center px-4 py-14">
      <p className="text-sm text-lm-subtle">{message}</p>
    </div>
  )
}
