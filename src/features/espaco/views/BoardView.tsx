// DashNotion — view de quadro (kanban). Duplicata de _internal/views/BoardView.tsx
// com PropCell/CardActions/useMembers/Pill do dash. Coluna de conclusao esmaece
// os cards (client-side, por valor == opcao 'done'); sem timer/completed_at.

import { useMemo, useRef, useState } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDroppable, pointerWithin,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Plus, GripVertical, MoreHorizontal, Pencil, CheckCircle2, Circle, Check, Trash2, ChevronLeft, ChevronRight,
  Clock, AlertTriangle,
} from 'lucide-react'
import type {
  PageRow, NotionProperty, NotionView, PropertyValue, SelectOption, NotionColor,
} from '@/features/espaco/internal/types'
import { NOTION_COLORS, opcaoDeConclusao } from '@/features/espaco/internal/types'
import { PROPERTY_ICONS } from '@/features/espaco/internal/props/propertyIcons'
import {
  groupRows, resolveCellValue, isVazio, propriedadesVisiveis, planoDoDrop,
  previewDoConteudo, gruposVisiveis, classificarPrazo, type TomPrazo, NO_VALUE_KEY,
} from '@/features/espaco/internal/views/viewLib'
import Dropdown from '@/features/espaco/internal/Dropdown'
import PropCell from '../props/PropCell'
import CardActions from './CardActions'
import { Pill } from '../props/SelectCell'
import { useMembers } from '../useDashNotion'

interface BoardViewProps {
  rows: PageRow[]
  properties: NotionProperty[]
  view: NotionView
  databaseId: string
  onOpenPage: (pageId: string) => void
  onMoveRow: (input: {
    page_id: string; group_property_id: string
    group_value: PropertyValue | 'manter'; sort_order: number
  }) => void
  onCreateRow: (props?: Record<string, PropertyValue>) => void
  onUpdateGroupOptions: (options: SelectOption[]) => void
}

export default function BoardView({
  rows, properties, view, databaseId, onOpenPage, onMoveRow, onCreateRow, onUpdateGroupOptions,
}: BoardViewProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const groupProp = useMemo(
    () => properties.find(p => p.id === view.config?.group_by) ?? null,
    [properties, view.config?.group_by],
  )

  const cardProps = useMemo(
    () => propriedadesVisiveis(properties, view)
      .filter(p => p.type !== 'title' && p.id !== groupProp?.id),
    [properties, view, groupProp],
  )

  const doneOption = useMemo(() => opcaoDeConclusao(groupProp), [groupProp])

  const groups = useMemo(() => groupRows(rows, groupProp), [rows, groupProp])
  const visibleGroups = gruposVisiveis(groups, view.config?.hide_empty_groups)

  const draggingRow = draggingId ? rows.find(r => r.id === draggingId) ?? null : null

  if (!groupProp) {
    return <EmptyState message="Escolha uma propriedade de selecao ou status para agrupar o quadro." />
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null)
    const plano = planoDoDrop(
      rows, groupProp, String(event.active.id),
      event.over ? String(event.over.id) : null,
    )
    if (plano) onMoveRow({
      page_id: plano.pageId,
      group_property_id: groupProp!.id,
      group_value: plano.groupValue,
      sort_order: plano.sortOrder,
    })
  }

  function patchOption(id: string, patch: Partial<SelectOption>) {
    const opts = groupProp?.config?.options ?? []
    onUpdateGroupOptions(opts.map(o => (o.id === id ? { ...o, ...patch } : o)))
  }

  function marcarConclusao(id: string) {
    const opts = groupProp?.config?.options ?? []
    onUpdateGroupOptions(opts.map(o => ({
      ...o,
      group: o.id === id ? (o.group === 'done' ? undefined : 'done') : (o.group === 'done' ? undefined : o.group),
    })))
  }

  function adicionarColuna(nome: string) {
    const opts = groupProp?.config?.options ?? []
    const usadas = new Set(opts.map(o => o.color))
    const cor = CORES.find(c => c !== 'default' && !usadas.has(c)) ?? 'gray'
    const id = `op-${Date.now().toString(36)}`
    onUpdateGroupOptions([...opts, { id, name: nome, color: cor }])
  }

  function moverColuna(id: string, direcao: -1 | 1) {
    const opts = [...(groupProp?.config?.options ?? [])]
    const i = opts.findIndex(o => o.id === id)
    const j = i + direcao
    if (i < 0 || j < 0 || j >= opts.length) return
    ;[opts[i], opts[j]] = [opts[j], opts[i]]
    onUpdateGroupOptions(opts)
  }

  function excluirColuna(id: string) {
    const opts = groupProp?.config?.options ?? []
    onUpdateGroupOptions(opts.filter(o => o.id !== id))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(e: DragStartEvent) => setDraggingId(String(e.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      <div className="flex h-full gap-3 overflow-x-auto p-3">
        {visibleGroups.map(group => {
          const opts = groupProp.config?.options ?? []
          const pos = group.option ? opts.findIndex(o => o.id === group.option!.id) : -1
          return (
            <Column
              key={group.key}
              columnKey={group.key}
              option={group.option}
              ehConclusao={!!group.option && group.option.id === doneOption?.id}
              rows={group.rows}
              cardProps={cardProps}
              properties={properties}
              databaseId={databaseId}
              podeMoverEsquerda={pos > 0}
              podeMoverDireita={pos >= 0 && pos < opts.length - 1}
              onOpenPage={onOpenPage}
              onRename={(nome) => group.option && patchOption(group.option.id, { name: nome })}
              onColor={(cor) => group.option && patchOption(group.option.id, { color: cor })}
              onToggleConclusao={() => group.option && marcarConclusao(group.option.id)}
              onMover={(d) => group.option && moverColuna(group.option.id, d)}
              onExcluirColuna={() => group.option && excluirColuna(group.option.id)}
              onAdd={() => onCreateRow(
                group.key === NO_VALUE_KEY ? {} : { [groupProp.id]: group.key },
              )}
            />
          )
        })}

        <NovaColuna onCriar={adicionarColuna} />
      </div>

      <DragOverlay dropAnimation={null}>
        {draggingRow && (
          <Card row={draggingRow} cardProps={cardProps} properties={properties} finalizada={false} overlay />
        )}
      </DragOverlay>
    </DndContext>
  )
}

const CORES: NotionColor[] = [
  'default', 'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red',
]

function Column({
  columnKey, option, ehConclusao, rows, cardProps, properties, databaseId,
  podeMoverEsquerda, podeMoverDireita,
  onOpenPage, onAdd, onRename, onColor, onToggleConclusao, onMover, onExcluirColuna,
}: {
  columnKey: string
  option: SelectOption | null
  ehConclusao: boolean
  rows: PageRow[]
  cardProps: NotionProperty[]
  properties: NotionProperty[]
  databaseId: string
  podeMoverEsquerda: boolean
  podeMoverDireita: boolean
  onOpenPage: (pageId: string) => void
  onAdd: () => void
  onRename: (nome: string) => void
  onColor: (cor: NotionColor) => void
  onToggleConclusao: () => void
  onMover: (direcao: -1 | 1) => void
  onExcluirColuna: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnKey })
  const colors = option ? NOTION_COLORS[option.color] ?? NOTION_COLORS.default : NOTION_COLORS.default
  const [menu, setMenu] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const btnMenu = useRef<HTMLButtonElement>(null)

  return (
    <section
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-lm-md border transition-colors ${
        isOver ? 'border-lm-neon bg-lm-card2' : 'border-lm-border bg-lm-card'
      }`}
    >
      <header className="relative flex items-center gap-2 border-b border-lm-border px-3 py-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${colors.dot}`} />

        {editando !== null ? (
          <input
            autoFocus
            aria-label="Nome da coluna"
            value={editando}
            onChange={(e) => setEditando(e.target.value)}
            onBlur={() => { const v = editando.trim(); if (v) onRename(v); setEditando(null) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { const v = editando.trim(); if (v) onRename(v); setEditando(null) }
              if (e.key === 'Escape') setEditando(null)
            }}
            className="h-6 min-w-0 flex-1 rounded-lm-sm border border-lm-neon bg-lm-bg px-1.5 text-xs text-lm-primary outline-none"
          />
        ) : (
          <span className="flex min-w-0 items-center gap-1 truncate text-xs font-medium text-lm-primary">
            {option ? option.name : 'Sem valor'}
            {ehConclusao && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-lm-success" />}
          </span>
        )}

        <span className="ml-auto rounded-lm-sm bg-lm-bg px-1.5 py-0.5 text-xs text-lm-subtle">
          {rows.length}
        </span>

        {option && (
          <button
            ref={btnMenu}
            type="button"
            aria-label={`Opcoes da coluna ${option.name}`}
            onClick={() => setMenu(v => !v)}
            className="rounded-lm-sm p-0.5 text-lm-subtle hover:bg-lm-card2 hover:text-lm-primary"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        )}

        {option && (
          <Dropdown anchorRef={btnMenu} open={menu} onClose={() => setMenu(false)} align="right">
            <div className="w-60 py-1">
              <button
                type="button"
                onClick={() => { setEditando(option.name); setMenu(false) }}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs text-lm-muted hover:bg-lm-card2"
              >
                <Pencil className="h-3.5 w-3.5" />
                Renomear coluna
              </button>

              <button
                type="button"
                onClick={() => { onToggleConclusao(); setMenu(false) }}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs text-lm-muted hover:bg-lm-card2"
              >
                {ehConclusao
                  ? <Circle className="h-3.5 w-3.5" />
                  : <CheckCircle2 className="h-3.5 w-3.5 text-lm-success" />}
                {ehConclusao ? 'Nao e mais conclusao' : 'Marcar como conclusao'}
              </button>

              <div className="my-1 border-t border-lm-border" />
              <div className="flex items-center gap-1 px-2.5 pb-1">
                <button
                  type="button"
                  aria-label="Mover coluna pra esquerda"
                  disabled={!podeMoverEsquerda}
                  onClick={() => { onMover(-1); setMenu(false) }}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lm-sm border border-lm-border py-1 text-xs text-lm-muted hover:bg-lm-card2 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Mover
                </button>
                <button
                  type="button"
                  aria-label="Mover coluna pra direita"
                  disabled={!podeMoverDireita}
                  onClick={() => { onMover(1); setMenu(false) }}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lm-sm border border-lm-border py-1 text-xs text-lm-muted hover:bg-lm-card2 disabled:opacity-40"
                >
                  Mover <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="my-1 border-t border-lm-border" />
              <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-lm-subtle">
                Cor da coluna
              </p>
              <div className="flex flex-wrap gap-1 px-2.5 pb-1.5">
                {CORES.map(c => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Cor ${c}`}
                    onClick={() => { onColor(c); setMenu(false) }}
                    className={`h-5 w-5 rounded-full border transition ${NOTION_COLORS[c].dot} ${
                      option.color === c ? 'border-lm-primary' : 'border-transparent hover:border-lm-border2'
                    }`}
                  />
                ))}
              </div>

              <div className="my-1 border-t border-lm-border" />
              <button
                type="button"
                onClick={() => { onExcluirColuna(); setMenu(false) }}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs text-lm-danger hover:bg-lm-card2"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir coluna
              </button>
            </div>
          </Dropdown>
        )}
      </header>

      <SortableContext items={rows.map(r => r.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-2 overflow-y-auto p-2">
          {rows.length === 0 ? (
            <p className="px-1 py-6 text-center text-xs text-lm-subtle">Vazio</p>
          ) : (
            rows.map(row => (
              <DraggableCard
                key={row.id}
                row={row}
                cardProps={cardProps}
                properties={properties}
                databaseId={databaseId}
                finalizada={ehConclusao}
                onOpenPage={onOpenPage}
              />
            ))
          )}
        </div>
      </SortableContext>

      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-1.5 border-t border-lm-border px-3 py-2 text-xs text-lm-subtle hover:bg-lm-card2 hover:text-lm-primary"
      >
        <Plus className="h-3.5 w-3.5" />
        Novo
      </button>
    </section>
  )
}

function NovaColuna({ onCriar }: { onCriar: (nome: string) => void }) {
  const [nome, setNome] = useState<string | null>(null)

  if (nome === null) {
    return (
      <button
        type="button"
        onClick={() => setNome('')}
        className="flex w-56 shrink-0 items-start gap-1.5 rounded-lm-md border border-dashed border-lm-border px-3 py-2 text-xs text-lm-subtle transition-colors hover:border-lm-neon hover:text-lm-primary"
      >
        <Plus className="h-3.5 w-3.5" />
        Nova coluna
      </button>
    )
  }

  return (
    <div className="w-56 shrink-0 rounded-lm-md border border-lm-neon bg-lm-card p-2">
      <input
        autoFocus
        aria-label="Nome da nova coluna"
        value={nome}
        placeholder="Nome da coluna"
        onChange={(e) => setNome(e.target.value)}
        onBlur={() => { const v = nome.trim(); if (v) onCriar(v); setNome(null) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { const v = nome.trim(); if (v) onCriar(v); setNome(null) }
          if (e.key === 'Escape') setNome(null)
        }}
        className="w-full rounded-lm-sm border border-lm-border bg-lm-bg px-2 py-1 text-xs text-lm-primary outline-none focus:border-lm-neon"
      />
    </div>
  )
}

function DraggableCard({
  row, cardProps, properties, databaseId, finalizada, onOpenPage,
}: {
  row: PageRow
  cardProps: NotionProperty[]
  properties: NotionProperty[]
  databaseId: string
  finalizada: boolean
  onOpenPage: (pageId: string) => void
}) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: row.id })

  const style = { transform: CSS.Transform.toString(transform), transition }

  const prioProp = properties.find(p => p.type === 'select')
  const prioVal = prioProp ? resolveCellValue(row, prioProp, properties) : null
  const prioOpt = prioProp && typeof prioVal === 'string'
    ? (prioProp.config?.options ?? []).find(o => o.id === prioVal)
    : null
  const barraPrio = prioOpt && !finalizada ? (NOTION_COLORS[prioOpt.color]?.dot ?? null) : null

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group relative flex cursor-grab items-start gap-1 overflow-hidden rounded-lm-md border p-2.5 transition-colors active:cursor-grabbing ${
        isDragging ? 'opacity-40' : ''
      } ${
        finalizada
          ? 'border-lm-border bg-lm-bg opacity-60'
          : 'border-lm-border bg-lm-bg hover:border-lm-border2 hover:shadow-lm-sm'
      } ${barraPrio ? 'pl-3' : ''}`}
    >
      {barraPrio && <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${barraPrio}`} />}
      <span aria-hidden className="mt-0.5 shrink-0 text-lm-disabled opacity-0 group-hover:opacity-100">
        <GripVertical className="h-3.5 w-3.5" />
      </span>

      <div className="min-w-0 flex-1">
        <button type="button" onClick={() => onOpenPage(row.id)} className="w-full text-left">
          <CardBody row={row} cardProps={cardProps} properties={properties} finalizada={finalizada} />
        </button>
        <CardActions row={row} databaseId={databaseId} properties={properties} finalizadaHint={finalizada} />
      </div>
    </div>
  )
}

function Card({ row, cardProps, properties, finalizada }: {
  row: PageRow; cardProps: NotionProperty[]; properties: NotionProperty[]
  finalizada: boolean; overlay?: boolean
}) {
  return (
    <div className="w-64 rounded-lm-md border border-lm-neon bg-lm-card p-2 shadow-lm-lg">
      <CardBody row={row} cardProps={cardProps} properties={properties} finalizada={finalizada} />
    </div>
  )
}

function valorRelevante(valor: PropertyValue, tipo: string): boolean {
  if (isVazio(valor)) return false
  if ((tipo === 'number' || tipo === 'rollup' || tipo === 'formula') && Number(valor) === 0) return false
  return true
}

const TOM_PRAZO: Record<Exclude<TomPrazo, 'nenhum'>, string> = {
  atrasado: 'bg-red-100 text-red-800',
  hoje:     'bg-amber-100 text-amber-900',
  breve:    'bg-amber-50 text-amber-800',
  futuro:   'bg-lm-card2 text-lm-subtle',
}

function PrazoChip({ value, finalizada }: { value: PropertyValue; finalizada: boolean }) {
  const { tom, texto } = classificarPrazo(value, finalizada)
  if (tom === 'nenhum') return null
  const Icone = tom === 'atrasado' ? AlertTriangle : Clock
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium ${TOM_PRAZO[tom]}`}>
      <Icone className="h-3 w-3 shrink-0" />
      {texto}
    </span>
  )
}

function TagsCard({ property, value }: { property: NotionProperty; value: PropertyValue }) {
  const ids = Array.isArray(value) ? (value as string[]) : []
  const opts = property.config?.options ?? []
  const selecionadas = ids.map(id => opts.find(o => o.id === id)).filter(Boolean) as SelectOption[]
  if (selecionadas.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1">
      {selecionadas.map(o => <Pill key={o.id} option={o} />)}
    </div>
  )
}

function CardBody({ row, cardProps, properties, finalizada }: {
  row: PageRow; cardProps: NotionProperty[]; properties: NotionProperty[]; finalizada: boolean
}) {
  const pessoas = cardProps.filter(p => p.type === 'person')
  const tags = cardProps.filter(p => p.type === 'multi_select')
  const datas = cardProps.filter(p => p.type === 'date')
  const outras = cardProps
    .filter(p => !['person', 'multi_select', 'date'].includes(p.type))
    .map(p => ({ p, valor: resolveCellValue(row, p, properties) }))
    .filter(({ p, valor }) => valorRelevante(valor, p.type))

  const preview = previewDoConteudo(row.content)

  return (
    <>
      <p className={`flex items-start gap-1.5 text-[13px] font-medium leading-snug ${
        finalizada ? 'text-lm-subtle line-through' : 'text-lm-primary'
      }`}>
        {finalizada && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lm-success" />}
        <span className="line-clamp-2">{row.title || 'Sem titulo'}</span>
      </p>

      {preview && (
        <p className="mt-1 line-clamp-2 whitespace-pre-line text-[11px] leading-snug text-lm-subtle">
          {preview}
        </p>
      )}

      {tags.map(p => (
        <div key={p.id} className="mt-1.5">
          <TagsCard property={p} value={resolveCellValue(row, p, properties)} />
        </div>
      ))}

      {(datas.length > 0 || outras.length > 0) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {datas.map(p => (
            <PrazoChip key={p.id} value={resolveCellValue(row, p, properties)} finalizada={finalizada} />
          ))}
          {outras.map(({ p, valor }) => {
            const Icon = PROPERTY_ICONS[p.type]
            return (
              <span key={p.id} className="flex min-w-0 items-center gap-1 text-[11px] text-lm-subtle">
                <Icon className="h-3 w-3 shrink-0 text-lm-disabled" />
                <span className="min-w-0 truncate">
                  <PropCell
                    property={p}
                    value={valor}
                    pageId={row.id}
                    databaseId={row.database_id ?? ''}
                    relations={row.relations[p.id]}
                    onChange={() => {}}
                    variant="card"
                  />
                </span>
              </span>
            )
          })}
        </div>
      )}

      {pessoas.map(property => (
        <Responsaveis key={property.id} ids={resolveCellValue(row, property, properties)} />
      ))}
    </>
  )
}

function Responsaveis({ ids }: { ids: PropertyValue }) {
  const { data: members = [] } = useMembers()
  const lista = Array.isArray(ids) ? (ids as string[]) : []
  if (lista.length === 0) return null

  return (
    <div className="mt-1.5 flex items-center -space-x-1.5">
      {lista.slice(0, 4).map(id => {
        const m = members.find(x => x.id === id)
        const nome = m?.full_name ?? m?.email ?? '?'
        return m?.avatar_url ? (
          <img
            key={id}
            src={m.avatar_url}
            alt={nome}
            title={nome}
            className="h-5 w-5 rounded-full border border-lm-card object-cover"
          />
        ) : (
          <span
            key={id}
            title={nome}
            className="grid h-5 w-5 place-items-center rounded-full border border-lm-card bg-lm-mid text-[9px] font-semibold text-lm-inverse"
          >
            {nome.slice(0, 1).toUpperCase()}
          </span>
        )
      })}
      {lista.length > 4 && (
        <span className="grid h-5 w-5 place-items-center rounded-full border border-lm-card bg-lm-card2 text-[9px] text-lm-subtle">
          +{lista.length - 4}
        </span>
      )}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center py-16">
      <p className="text-sm text-lm-subtle">{message}</p>
    </div>
  )
}
