// LM Notion — linha do tempo horizontal com barras por linha e escala configuravel.

import { useMemo } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'
import type { PageRow, NotionProperty, NotionView, ViewConfig } from '../types'
import { dateStart, dateEnd } from './viewLib'

type Zoom = 'day' | 'week' | 'month'

interface TimelineViewProps {
  rows: PageRow[]
  properties: NotionProperty[]
  view: NotionView
  onOpenPage: (pageId: string) => void
  onUpdateView: (patch: { config?: ViewConfig }) => void
}

const DAY_MS = 86400000
const PX_PER_DAY: Record<Zoom, number> = { day: 44, week: 14, month: 5 }
const ZOOM_LABEL: Record<Zoom, string> = { day: 'Dia', week: 'Semana', month: 'Mes' }
const ZOOM_ORDER: Zoom[] = ['month', 'week', 'day']

const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const LABEL_ROW_HEIGHT = 34

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const diffDays = (a: Date, b: Date) => Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / DAY_MS)

function readZoom(config: ViewConfig): Zoom {
  return config.zoom ?? 'week'
}

export default function TimelineView({
  rows, properties, view, onOpenPage, onUpdateView,
}: TimelineViewProps) {
  const zoom = readZoom(view.config ?? {})
  const pxPerDay = PX_PER_DAY[zoom]

  const startProp = useMemo(
    () => properties.find(p => p.id === view.config?.start_property_id)
      ?? properties.find(p => p.type === 'date')
      ?? null,
    [properties, view.config?.start_property_id],
  )

  const endProp = useMemo(
    () => properties.find(p => p.id === view.config?.end_property_id) ?? null,
    [properties, view.config?.end_property_id],
  )

  const bars = useMemo(() => {
    if (!startProp) return []
    return rows
      .map(row => {
        const from = dateStart(row.props[startProp.id] ?? null)
        if (!from) return null
        const rawTo = endProp
          ? dateStart(row.props[endProp.id] ?? null)
          : dateEnd(row.props[startProp.id] ?? null)
        const to = rawTo && rawTo.getTime() >= from.getTime() ? rawTo : from
        return { row, from: startOfDay(from), to: startOfDay(to) }
      })
      .filter((b): b is { row: PageRow; from: Date; to: Date } => b !== null)
      .sort((a, b) => a.from.getTime() - b.from.getTime())
  }, [rows, startProp, endProp])

  const range = useMemo(() => {
    const today = startOfDay(new Date())
    if (bars.length === 0) return { from: addDays(today, -7), to: addDays(today, 21) }
    const min = bars.reduce((acc, b) => (b.from < acc ? b.from : acc), bars[0].from)
    const max = bars.reduce((acc, b) => (b.to > acc ? b.to : acc), bars[0].to)
    return { from: addDays(min, -3), to: addDays(max, 3) }
  }, [bars])

  const totalDays = Math.max(1, diffDays(range.to, range.from) + 1)
  const width = totalDays * pxPerDay
  const today = startOfDay(new Date())
  const todayOffset = diffDays(today, range.from)
  const showToday = todayOffset >= 0 && todayOffset < totalDays

  function setZoom(next: Zoom) {
    onUpdateView({ config: { ...(view.config ?? {}), zoom: next } })
  }

  function step(delta: number) {
    const index = ZOOM_ORDER.indexOf(zoom)
    const next = ZOOM_ORDER[Math.min(ZOOM_ORDER.length - 1, Math.max(0, index + delta))]
    if (next !== zoom) setZoom(next)
  }

  if (!startProp) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-14">
        <p className="text-sm text-lm-subtle">
          Escolha uma propriedade de data de inicio para montar a linha do tempo.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-lm-border px-3 py-2">
        <span className="text-xs text-lm-subtle">Escala: {ZOOM_LABEL[zoom]}</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={zoom === 'month'}
            aria-label="Diminuir zoom"
            className="rounded-lm-sm p-1 text-lm-subtle hover:bg-lm-card2 hover:text-lm-primary disabled:opacity-30"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={zoom === 'day'}
            aria-label="Aumentar zoom"
            className="rounded-lm-sm p-1 text-lm-subtle hover:bg-lm-card2 hover:text-lm-primary disabled:opacity-30"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
      </header>

      {bars.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-4 py-14">
          <p className="text-sm text-lm-subtle">Nenhum item com data para exibir na linha do tempo.</p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="relative" style={{ width, minWidth: '100%' }}>
            {/* Regua */}
            <div className="sticky top-0 z-10 flex h-8 border-b border-lm-border bg-lm-dark">
              {Array.from({ length: totalDays }, (_, i) => {
                const day = addDays(range.from, i)
                const isFirst = day.getDate() === 1
                const showLabel = zoom === 'day' || (zoom === 'week' && day.getDay() === 0) || (zoom === 'month' && isFirst)
                return (
                  <div
                    key={i}
                    style={{ width: pxPerDay }}
                    className={`shrink-0 overflow-hidden whitespace-nowrap px-0.5 text-[10px] leading-8 ${
                      isFirst ? 'border-l border-lm-border2 text-lm-muted' : 'text-lm-subtle'
                    }`}
                  >
                    {showLabel
                      ? (zoom === 'month'
                        ? `${MONTHS_SHORT[day.getMonth()]}/${String(day.getFullYear()).slice(2)}`
                        : `${day.getDate()}/${day.getMonth() + 1}`)
                      : ''}
                  </div>
                )
              })}
            </div>

            {/* Marcador de hoje */}
            {showToday && (
              <div
                aria-hidden
                className="pointer-events-none absolute bottom-0 top-8 z-20 w-px bg-lm-neon"
                style={{ left: todayOffset * pxPerDay + pxPerDay / 2 }}
              />
            )}

            {/* Barras */}
            <div className="relative" style={{ height: bars.length * LABEL_ROW_HEIGHT }}>
              {bars.map((bar, index) => {
                const offset = diffDays(bar.from, range.from)
                const span = Math.max(1, diffDays(bar.to, bar.from) + 1)
                return (
                  <div
                    key={bar.row.id}
                    className="absolute border-b border-lm-border"
                    style={{ top: index * LABEL_ROW_HEIGHT, left: 0, width, height: LABEL_ROW_HEIGHT }}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenPage(bar.row.id)}
                      title={bar.row.title || 'Sem titulo'}
                      className="absolute top-1.5 flex h-6 items-center overflow-hidden rounded-lm-sm border border-lm-mid bg-lm-neon px-2 text-left hover:border-lm-glow"
                      style={{
                        left: offset * pxPerDay,
                        width: Math.max(span * pxPerDay, 28),
                      }}
                    >
                      <span className="truncate text-xs text-lm-inverse">
                        {bar.row.title || 'Sem titulo'}
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-lm-border px-3 py-1.5 text-xs text-lm-subtle">
        {bars.length} {bars.length === 1 ? 'item' : 'itens'} na linha do tempo
      </footer>
    </div>
  )
}
