// LM Notion — editor de data com calendario proprio (sem lib externa).
// Suporta intervalo (start/end) e hora (config.include_time). Formato pt-BR.

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { DateConfig, PropertyValue } from '../../types'
import { classificarPrazo } from '../../views/viewLib'
import Dropdown from '../../Dropdown'

// Cor do texto da data por urgencia (vermelho atrasado, ambar hoje/breve).
const TOM_TEXTO: Record<string, string> = {
  atrasado: 'text-red-700 font-medium',
  hoje: 'text-amber-800 font-medium',
  breve: 'text-amber-700',
  futuro: 'text-lm-primary',
  nenhum: 'text-lm-primary',
}

interface Props {
  config: DateConfig
  value: PropertyValue
  onChange: (v: PropertyValue) => void
  variant?: 'table' | 'panel' | 'card'
  autoFocus?: boolean
}

type DateValue = { start: string; end?: string | null }

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function asDateValue(v: PropertyValue): DateValue | null {
  if (v && typeof v === 'object' && !Array.isArray(v) && 'start' in v && typeof v.start === 'string') {
    return v as DateValue
  }
  return null
}

function pad(n: number) { return String(n).padStart(2, '0') }

/** ISO local (sem fuso) — evita o dia "voltar" ao serializar. */
function toISO(d: Date, withTime: boolean): string {
  const base = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return withTime ? `${base}T${pad(d.getHours())}:${pad(d.getMinutes())}` : base
}

function parseISO(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(iso)
  if (!m) return null
  return new Date(
    Number(m[1]), Number(m[2]) - 1, Number(m[3]),
    m[4] ? Number(m[4]) : 0, m[5] ? Number(m[5]) : 0,
  )
}

export function formatDate(iso: string, includeTime: boolean): string {
  const d = parseISO(iso)
  if (!d) return ''
  const base = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
  return includeTime ? `${base} ${pad(d.getHours())}:${pad(d.getMinutes())}` : base
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function buildGrid(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const start = new Date(first)
  start.setDate(first.getDate() - first.getDay())
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

export default function DateCell({ config, value, onChange, variant = 'table', autoFocus }: Props) {
  const includeTime = !!config.include_time
  const current = asDateValue(value)
  const startDate = current ? parseISO(current.start) : null
  const endDate = current?.end ? parseISO(current.end) : null

  const [open, setOpen] = useState(!!autoFocus)
  const [isRange, setIsRange] = useState(!!endDate)
  const [cursor, setCursor] = useState(() => startDate ?? new Date())
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { setIsRange(!!endDate) }, [endDate])

  const grid = useMemo(() => buildGrid(cursor), [cursor])
  const today = new Date()

  const label = current
    ? [formatDate(current.start, includeTime), current.end ? formatDate(current.end, includeTime) : null]
        .filter(Boolean).join(' → ')
    : ''

  function pickDay(d: Date) {
    const keepTime = (src: Date | null) => {
      const out = new Date(d)
      if (includeTime && src) { out.setHours(src.getHours()); out.setMinutes(src.getMinutes()) }
      return out
    }
    if (!isRange || !startDate) {
      onChange({ start: toISO(keepTime(startDate), includeTime), end: null })
      return
    }
    if (!endDate) {
      if (d < startDate) onChange({ start: toISO(keepTime(null), includeTime), end: current!.start })
      else onChange({ start: current!.start, end: toISO(keepTime(null), includeTime) })
      return
    }
    onChange({ start: toISO(keepTime(startDate), includeTime), end: null })
  }

  function setTime(which: 'start' | 'end', hhmm: string) {
    if (!current) return
    const src = which === 'start' ? startDate : endDate
    if (!src) return
    const [h, m] = hhmm.split(':').map(Number)
    const d = new Date(src)
    d.setHours(Number.isFinite(h) ? h : 0)
    d.setMinutes(Number.isFinite(m) ? m : 0)
    onChange(which === 'start'
      ? { start: toISO(d, true), end: current.end ?? null }
      : { start: current.start, end: toISO(d, true) })
  }

  // Urgencia pra colorir a data (nao sabe se a tarefa esta finalizada aqui, entao
  // usa false — o card, que sabe, ja mostra o proprio chip esmaecido).
  const tom = current ? classificarPrazo(current, false).tom : 'nenhum'
  const corData = TOM_TEXTO[tom] ?? 'text-lm-primary'

  if (variant === 'card') {
    return <span className={`block truncate px-2 py-1 text-sm ${corData}`}>{label}</span>
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => { setOpen(v => !v); if (startDate) setCursor(startDate) }}
        className="flex w-full items-center px-2 py-1 text-left text-sm hover:bg-lm-card2"
      >
        {label ? <span className={`truncate ${corData}`}>{label}</span> : <span className="text-lm-subtle">Vazio</span>}
        {label && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onChange(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onChange(null) } }}
            className="ml-auto shrink-0 text-lm-subtle hover:text-lm-primary"
            aria-label="Limpar data"
          >
            <X size={12} />
          </span>
        )}
      </button>

      {/* Calendario em PORTAL: no painel/tabela a celula tem overflow e cortava
          o calendario — nao dava pra escolher a data direito. */}
      <Dropdown anchorRef={btnRef} open={open} onClose={() => setOpen(false)}>
        <div className="w-72 p-3">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              className="rounded-lm-sm p-1 text-lm-subtle hover:bg-lm-card2 hover:text-lm-primary"
              aria-label="Mes anterior"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm font-medium text-heading">
              {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </span>
            <button
              type="button"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="rounded-lm-sm p-1 text-lm-subtle hover:bg-lm-card2 hover:text-lm-primary"
              aria-label="Proximo mes"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {WEEKDAYS.map((w, i) => (
              <span key={i} className="py-1 text-center text-[11px] text-lm-subtle">{w}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {grid.map((d, i) => {
              const outside = d.getMonth() !== cursor.getMonth()
              const isStart = startDate && sameDay(d, startDate)
              const isEnd = endDate && sameDay(d, endDate)
              const inRange = startDate && endDate && d > startDate && d < endDate
              const isToday = sameDay(d, today)
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pickDay(d)}
                  className={[
                    'h-7 rounded-lm-sm text-xs transition-colors',
                    isStart || isEnd
                      ? 'bg-lm-neon text-lm-inverse'
                      : inRange
                        ? 'bg-lm-neon/20 text-lm-primary'
                        : outside
                          ? 'text-lm-disabled hover:bg-lm-card2'
                          : 'text-lm-primary hover:bg-lm-card2',
                    isToday && !isStart && !isEnd ? 'ring-1 ring-lm-neon/40' : '',
                  ].join(' ')}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>

          <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-lm-muted">
            <input
              type="checkbox"
              checked={isRange}
              onChange={(e) => {
                setIsRange(e.target.checked)
                if (!e.target.checked && current) onChange({ start: current.start, end: null })
              }}
              className="h-3.5 w-3.5 accent-lm-neon"
            />
            Data final
          </label>

          {includeTime && current && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="time"
                value={startDate ? `${pad(startDate.getHours())}:${pad(startDate.getMinutes())}` : ''}
                onChange={(e) => setTime('start', e.target.value)}
                className="flex-1 rounded-lm-sm bg-lm-bg px-2 py-1 text-xs text-lm-primary outline-none"
              />
              {endDate && (
                <input
                  type="time"
                  value={`${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`}
                  onChange={(e) => setTime('end', e.target.value)}
                  className="flex-1 rounded-lm-sm bg-lm-bg px-2 py-1 text-xs text-lm-primary outline-none"
                />
              )}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between border-t border-lm-border pt-2">
            <button
              type="button"
              onClick={() => { onChange({ start: toISO(new Date(), includeTime), end: null }); setCursor(new Date()) }}
              className="text-xs text-lm-neon hover:underline"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false) }}
              className="text-xs text-lm-subtle hover:text-lm-primary"
            >
              Limpar
            </button>
          </div>
        </div>
      </Dropdown>
    </>
  )
}
