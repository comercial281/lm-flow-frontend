// DashNotion — editor de pessoa. Duplicata de _internal/props/editors/PersonCell.tsx
// com useMembers do dash (membros vem da action `members`, por nome/cargo).

import { useMemo, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import type { PropertyValue } from '@/features/espaco/internal/types'
import Dropdown from '@/features/espaco/internal/Dropdown'
import { useMembers } from '../useDashNotion'

interface Props {
  value: PropertyValue
  onChange: (v: PropertyValue) => void
  variant?: 'table' | 'panel' | 'card'
  autoFocus?: boolean
}

type Member = { id: string; full_name: string | null; email: string | null; avatar_url: string | null }

function initialOf(m: Member) {
  return (m.full_name?.trim() || m.email?.trim() || '?').charAt(0).toUpperCase()
}

export function Avatar({ member, size = 20 }: { member: Member; size?: number }) {
  if (member.avatar_url) {
    return (
      <img
        src={member.avatar_url}
        alt={member.full_name ?? ''}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full object-cover"
      />
    )
  }
  return (
    <span
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
      className="flex shrink-0 items-center justify-center rounded-full bg-lm-neon/25 font-medium text-lm-neon"
    >
      {initialOf(member)}
    </span>
  )
}

export default function PersonCell({ value, onChange, variant = 'table', autoFocus }: Props) {
  const { data: members = [] } = useMembers()
  const selectedIds = useMemo<string[]>(
    () => (Array.isArray(value) ? (value as unknown[]).filter((v): v is string => typeof v === 'string') : []),
    [value],
  )
  const selected = selectedIds
    .map(id => members.find(m => m.id === id))
    .filter((m): m is Member => !!m)

  const [open, setOpen] = useState(!!autoFocus)
  const [term, setTerm] = useState('')
  const btnRef = useRef<HTMLButtonElement>(null)

  const q = term.trim().toLowerCase()
  const filtered = members.filter(m =>
    !q || (m.full_name ?? '').toLowerCase().includes(q) || (m.email ?? '').toLowerCase().includes(q),
  )

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id])
  }

  const chips = selected.map(m => (
    <span
      key={m.id}
      className="inline-flex max-w-full items-center gap-1 rounded-full bg-lm-card2 py-0.5 pl-0.5 pr-2 text-xs text-lm-primary"
    >
      <Avatar member={m} size={18} />
      <span className="truncate">{m.full_name ?? m.email ?? 'Sem nome'}</span>
      {variant !== 'card' && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggle(m.id) }}
          className="shrink-0 text-lm-subtle hover:text-lm-primary"
          aria-label="Remover pessoa"
        >
          <X size={11} />
        </button>
      )}
    </span>
  ))

  if (variant === 'card') {
    return <div className="flex flex-wrap gap-1 px-2 py-1">{chips}</div>
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full flex-wrap items-center gap-1 px-2 py-1 text-left hover:bg-lm-card2"
      >
        {selected.length === 0 ? <span className="text-sm text-lm-subtle">Vazio</span> : chips}
      </button>

      <Dropdown anchorRef={btnRef} open={open} onClose={() => setOpen(false)}>
        <div className="w-64">
          <div className="border-b border-lm-border p-2">
            <input
              autoFocus
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Buscar pessoa..."
              className="w-full rounded-lm-sm bg-lm-bg px-2 py-1.5 text-sm text-lm-primary outline-none placeholder:text-lm-subtle focus:ring-1 focus:ring-lm-neon/40"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filtered.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => toggle(m.id)}
                className="flex w-full items-center gap-2 rounded-lm-sm px-2 py-1.5 text-left hover:bg-lm-card2"
              >
                <Avatar member={m} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-lm-primary">{m.full_name ?? 'Sem nome'}</span>
                  {m.email && <span className="block truncate text-[11px] text-lm-subtle">{m.email}</span>}
                </span>
                {selectedIds.includes(m.id) && <Check size={13} className="shrink-0 text-lm-neon" />}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-2 py-3 text-center text-xs text-lm-subtle">Ninguem encontrado</div>
            )}
          </div>
        </div>
      </Dropdown>
    </>
  )
}
