// LM Notion — editor numerico. Respeita config.format e config.precision.
// Em foco mostra o numero cru; fora de foco mostra formatado.

import { useEffect, useRef, useState } from 'react'
import type { NumberConfig, PropertyValue } from '../../types'

interface Props {
  config: NumberConfig
  value: PropertyValue
  onChange: (v: PropertyValue) => void
  variant?: 'table' | 'panel' | 'card'
  autoFocus?: boolean
}

export function formatNumber(n: number, config: NumberConfig): string {
  const precision = config.precision
  const fmt = config.format ?? 'number'
  const digits = precision ?? (fmt === 'real' || fmt === 'dolar' ? 2 : undefined)
  const opts: Intl.NumberFormatOptions = {}
  if (digits !== undefined) {
    opts.minimumFractionDigits = digits
    opts.maximumFractionDigits = digits
  }
  if (fmt === 'real') return new Intl.NumberFormat('pt-BR', { ...opts, style: 'currency', currency: 'BRL' }).format(n)
  if (fmt === 'dolar') return new Intl.NumberFormat('en-US', { ...opts, style: 'currency', currency: 'USD' }).format(n)
  if (fmt === 'percent') return `${new Intl.NumberFormat('pt-BR', opts).format(n)}%`
  return new Intl.NumberFormat('pt-BR', opts).format(n)
}

function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/[^\d,.-]/g, '').replace(/\.(?=.*[.,])/g, '').replace(',', '.')
  if (cleaned.trim() === '' || cleaned === '-') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

export default function NumberCell({ config, value, onChange, variant = 'table', autoFocus }: Props) {
  const current = typeof value === 'number' ? value : null
  const [draft, setDraft] = useState(current === null ? '' : String(current))
  const [editing, setEditing] = useState(!!autoFocus)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(typeof value === 'number' ? String(value) : '')
  }, [value])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  if (variant === 'card') {
    return (
      <span className="block w-full truncate px-2 py-1 text-sm tabular-nums text-lm-primary">
        {current === null ? '' : formatNumber(current, config)}
      </span>
    )
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="block w-full truncate px-2 py-1 text-left text-sm tabular-nums text-lm-primary hover:bg-lm-card2"
      >
        {current === null ? <span className="text-lm-subtle">Vazio</span> : formatNumber(current, config)}
      </button>
    )
  }

  return (
    <input
      ref={inputRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false)
        const next = parseNumber(draft)
        if (next !== current) onChange(next)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
        if (e.key === 'Escape') {
          setDraft(current === null ? '' : String(current))
          setEditing(false)
          e.currentTarget.blur()
        }
      }}
      inputMode="decimal"
      placeholder="Vazio"
      className="w-full bg-transparent px-2 py-1 text-sm tabular-nums text-lm-primary outline-none placeholder:text-lm-subtle"
    />
  )
}
