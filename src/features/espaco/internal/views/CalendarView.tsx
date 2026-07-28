// LM Notion — calendario mensal proprio (sem lib). Arrastar o item muda a data.

import { useMemo, useState } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDroppable, useDraggable, pointerWithin,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { PageRow, NotionProperty, NotionView, PropertyValue } from '../types'
import { dateStart } from './viewLib'

interface CalendarViewProps {
  rows: PageRow[]
  properties: NotionProperty[]
  view: NotionView
  onOpenPage: (pageId: string) => void
  onSetValue: (pageId: string, propertyId: string, value: PropertyValue) => void
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const isSameDay = (a: Date, b: Date) => dayKey(a) === dayKey(b)

export default function CalendarView({
  rows, properties, view, onOpenPage, onSetValue,
}: CalendarViewProps) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const dateProp = useMemo(
    () => properties.find(p => p.id === view.config?.date_property_id)
      ?? properties.find(p => p.type === 'date')
      ?? null,
    [properties, view.config?.date_property_id],
  )

  // Grade: semanas completas, comecando no domingo.
  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const start = new Date(first)
    start.setDate(first.getDate() - first.getDay())
    const cells: Date[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      cells.push(d)
    }
    // Corta a ultima semana quando ela nao pertence ao mes.
    const trimmed = cells.slice(0, 35)
    const lastWeek = cells.slice(35)
    return lastWeek.some(d => d.getMonth() === cursor.getMonth()) ? cells : trimmed
  }, [cursor])

  const byDay = useMemo(() => {
    const map = new Map<string, PageRow[]>()
    if (!dateProp) return map
    for (const row of rows) {
      const d = dateStart(row.props[dateProp.id] ?? null)
      if (!d) continue
      const key = dayKey(d)
      const list = map.get(key)
      if (list) list.push(row)
      else map.set(key, [row])
    }
    return map
  }, [rows, dateProp])

  const undated = useMemo(() => {
    if (!dateProp) return []
    return rows.filter(r => !dateStart(r.props[dateProp.id] ?? null))
  }, [rows, dateProp])

  const draggingRow = draggingId ? rows.find(r => r.id === draggingId) ?? null : null
  const today = new Date()

  if (!dateProp) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-14">
        <p className="text-sm text-lm-subtle">
          Escolha uma propriedade de data para exibir o calendario.
        </p>
      </div>
    )
  }

  function shiftMonth(delta: number) {
    setCursor(c => new Date(c.getFullYear(), c.getMonth() + delta, 1))
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null)
    if (!event.over || !dateProp) return

    const row = rows.find(r => r.id === String(event.active.id))
    if (!row) return

    const [y, m, d] = String(event.over.id).split('-').map(Number)
    if (!y || !m || !d) return

    const current = row.props[dateProp.id] ?? null
    const previous = dateStart(current)
    const next = new Date(y, m - 1, d,
      previous?.getHours() ?? 0, previous?.getMinutes() ?? 0)
    if (previous && isSameDay(previous, next)) return

    // Mantem a duracao quando o item tem intervalo.
    let end: string | null = null
    if (current && typeof current === 'object' && !Array.isArray(current) && 'end' in current && current.end) {
      const prevEnd = new Date(current.end)
      if (previous && !Number.isNaN(prevEnd.getTime())) {
        const duration = prevEnd.getTime() - previous.getTime()
        end = new Date(next.getTime() + duration).toISOString()
      }
    }

    onSetValue(row.id, dateProp.id, { start: next.toISOString(), end })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(e: DragStartEvent) => setDraggingId(String(e.active.id))}
      onDragCancel={() => setDraggingId(null)}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center gap-2 border-b border-lm-border px-3 py-2">
          <h3 className="text-sm font-medium text-heading">
            {MONTHS[cursor.getMonth()]} de {cursor.getFullYear()}
          </h3>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Mes anterior"
              className="rounded-lm-sm p-1 text-lm-subtle hover:bg-lm-card2 hover:text-lm-primary"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
              className="rounded-lm-sm border border-lm-border px-2 py-1 text-xs text-lm-muted hover:bg-lm-card2 hover:text-lm-primary"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Proximo mes"
              className="rounded-lm-sm p-1 text-lm-subtle hover:bg-lm-card2 hover:text-lm-primary"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="grid grid-cols-7 border-b border-lm-border">
          {WEEKDAYS.map(label => (
            <div key={label} className="px-2 py-1 text-center text-xs font-medium text-lm-subtle">
              {label}
            </div>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 overflow-y-auto">
          {days.map(day => (
            <DayCell
              key={dayKey(day)}
              day={day}
              inMonth={day.getMonth() === cursor.getMonth()}
              isToday={isSameDay(day, today)}
              rows={byDay.get(dayKey(day)) ?? []}
              onOpenPage={onOpenPage}
            />
          ))}
        </div>

        {undated.length > 0 && (
          <footer className="border-t border-lm-border px-3 py-1.5 text-xs text-lm-subtle">
            {undated.length} {undated.length === 1 ? 'item sem data' : 'itens sem data'}
          </footer>
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {draggingRow && (
          <span className="rounded-lm-sm border border-lm-neon bg-lm-card px-1.5 py-1 text-xs text-lm-primary shadow-lm-md">
            {draggingRow.title || 'Sem titulo'}
          </span>
        )}
      </DragOverlay>
    </DndContext>
  )
}

function DayCell({
  day, inMonth, isToday, rows, onOpenPage,
}: {
  day: Date
  inMonth: boolean
  isToday: boolean
  rows: PageRow[]
  onOpenPage: (pageId: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dayKey(day) })

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[92px] border-b border-r border-lm-border p-1 transition-colors ${
        isOver ? 'bg-lm-card2' : inMonth ? 'bg-lm-deep' : 'bg-lm-bg'
      }`}
    >
      <div className="mb-1 flex justify-end">
        <span
          className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs ${
            isToday
              ? 'bg-lm-neon text-lm-inverse'
              : inMonth ? 'text-lm-muted' : 'text-lm-disabled'
          }`}
        >
          {day.getDate()}
        </span>
      </div>

      <div className="space-y-1">
        {rows.map(row => (
          <CalendarItem key={row.id} row={row} onOpenPage={onOpenPage} />
        ))}
      </div>
    </div>
  )
}

function CalendarItem({ row, onOpenPage }: { row: PageRow; onOpenPage: (pageId: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: row.id })

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => onOpenPage(row.id)}
      className={`block w-full cursor-grab truncate rounded-lm-sm border border-lm-border bg-lm-card px-1.5 py-0.5 text-left text-xs text-lm-primary hover:border-lm-neon ${
        isDragging ? 'opacity-40' : ''
      }`}
      {...attributes}
      {...listeners}
    >
      {row.title || 'Sem titulo'}
    </button>
  )
}
