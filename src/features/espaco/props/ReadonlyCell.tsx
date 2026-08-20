// DashNotion — celula de tipos nao editaveis. Duplicata de
// _internal/props/editors/ReadonlyCell.tsx. Diferenca do dash: created_by /
// last_edited_by sao NOMES (created_by_name), nao ids de membro — entao
// renderiza o texto direto, sem lookup na lista de membros.

import type { PropertyType } from '@/features/espaco/internal/types'
import { formatDate } from '@/features/espaco/internal/props/editors/DateCell'

interface Props {
  type: PropertyType
  computed?: unknown
  variant?: 'table' | 'panel' | 'card'
}

function renderComputed(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'boolean') return v ? 'Sim' : 'Nao'
  if (typeof v === 'number') return new Intl.NumberFormat('pt-BR').format(v)
  if (Array.isArray(v)) return v.map(renderComputed).filter(Boolean).join(', ')
  if (typeof v === 'object') {
    const o = v as { start?: unknown; end?: unknown }
    if (typeof o.start === 'string') {
      return [formatDate(o.start, o.start.includes('T')), typeof o.end === 'string' ? formatDate(o.end, o.end.includes('T')) : null]
        .filter(Boolean).join(' → ')
    }
    return JSON.stringify(v)
  }
  return String(v)
}

export default function ReadonlyCell({ type, computed }: Props) {
  const base = 'block truncate px-2 py-1 text-sm text-lm-muted'

  // No dash, autoria vem como NOME (string), nao id — mostra direto.
  if (type === 'created_by' || type === 'last_edited_by') {
    const nome = typeof computed === 'string' ? computed : ''
    return <span className={base}>{nome}</span>
  }

  if (type === 'created_time' || type === 'last_edited_time') {
    const iso = typeof computed === 'string' ? computed : ''
    return <span className={`${base} tabular-nums`}>{iso ? formatDate(iso, true) : ''}</span>
  }

  if (type === 'auto_number') {
    const n = typeof computed === 'number' ? computed : Number(computed)
    return <span className={`${base} tabular-nums`}>{Number.isFinite(n) ? n : ''}</span>
  }

  return <span className={base}>{renderComputed(computed)}</span>
}
