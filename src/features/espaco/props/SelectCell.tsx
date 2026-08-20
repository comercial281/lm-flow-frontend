// DashNotion — editor de selecao unica (select/status). Duplicata de
// _internal/props/editors/SelectCell.tsx com useUpdateProperty do dash.

import { useMemo, useRef, useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import {
  NOTION_COLORS,
  type NotionColor, type NotionProperty, type PropertyValue, type SelectOption,
} from '@/features/espaco/internal/types'
import Dropdown from '@/features/espaco/internal/Dropdown'
import { useUpdateProperty } from '../useDashNotion'

interface Props {
  property: NotionProperty
  value: PropertyValue
  onChange: (v: PropertyValue) => void
  variant?: 'table' | 'panel' | 'card'
  autoFocus?: boolean
}

const PALETTE: NotionColor[] = [
  'default', 'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red',
]

const GROUP_LABELS: Record<'todo' | 'doing' | 'done', string> = {
  todo: 'A fazer', doing: 'Em andamento', done: 'Concluido',
}

export function Pill({ option, onRemove }: { option: SelectOption; onRemove?: () => void }) {
  const c = NOTION_COLORS[option.color] ?? NOTION_COLORS.default
  return (
    <span className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs ${c.bg} ${c.text}`}>
      <span className="truncate">{option.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="shrink-0 opacity-60 hover:opacity-100"
          aria-label={`Remover ${option.name}`}
        >
          <X size={11} />
        </button>
      )}
    </span>
  )
}

export default function SelectCell({ property, value, onChange, variant = 'table', autoFocus }: Props) {
  const options = useMemo<SelectOption[]>(() => property.config?.options ?? [], [property.config])
  const selectedId = typeof value === 'string' ? value : null
  const selected = options.find(o => o.id === selectedId) ?? null

  const [open, setOpen] = useState(!!autoFocus)
  const [term, setTerm] = useState('')
  const btnRef = useRef<HTMLButtonElement>(null)
  const updateProp = useUpdateProperty()

  const filtered = options.filter(o => o.name.toLowerCase().includes(term.trim().toLowerCase()))
  const exact = options.some(o => o.name.toLowerCase() === term.trim().toLowerCase())
  const canCreate = term.trim().length > 0 && !exact

  async function createOption() {
    const name = term.trim()
    if (!name) return
    const next: SelectOption = {
      id: crypto.randomUUID(),
      name,
      color: PALETTE[options.length % PALETTE.length],
      ...(property.type === 'status' ? { group: 'todo' as const } : {}),
    }
    await updateProp.mutateAsync({
      id: property.id, database_id: property.database_id,
      config: { ...property.config, options: [...options, next] },
    })
    onChange(next.id)
    setTerm('')
    setOpen(false)
  }

  function pick(id: string) {
    onChange(selectedId === id ? null : id)
    setOpen(false)
    setTerm('')
  }

  if (variant === 'card') {
    return <div className="px-2 py-1">{selected ? <Pill option={selected} /> : null}</div>
  }

  const grouped: [string, SelectOption[]][] = property.type === 'status'
    ? (['todo', 'doing', 'done'] as const)
        .map(g => [GROUP_LABELS[g], filtered.filter(o => (o.group ?? 'todo') === g)] as [string, SelectOption[]])
        .filter(([, list]) => list.length > 0)
    : [['', filtered]]

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center px-2 py-1 text-left hover:bg-lm-card2"
      >
        {selected ? <Pill option={selected} /> : <span className="text-sm text-lm-subtle">Vazio</span>}
      </button>

      <Dropdown anchorRef={btnRef} open={open} onClose={() => setOpen(false)}>
        <div className="w-64">
          <div className="border-b border-lm-border p-2">
            <input
              autoFocus
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && canCreate) { e.preventDefault(); void createOption() } }}
              placeholder="Buscar ou criar..."
              className="w-full rounded-lm-sm bg-lm-bg px-2 py-1.5 text-sm text-lm-primary outline-none placeholder:text-lm-subtle focus:ring-1 focus:ring-lm-neon/40"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {grouped.map(([label, list]) => (
              <div key={label || 'all'}>
                {label && (
                  <div className="px-2 pb-1 pt-2 text-[11px] uppercase tracking-wide text-lm-subtle">{label}</div>
                )}
                {list.map(o => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => pick(o.id)}
                    className="flex w-full items-center gap-2 rounded-lm-sm px-2 py-1.5 text-left hover:bg-lm-card2"
                  >
                    <Pill option={o} />
                    {selectedId === o.id && <Check size={13} className="ml-auto shrink-0 text-lm-neon" />}
                  </button>
                ))}
              </div>
            ))}
            {canCreate && (
              <button
                type="button"
                onClick={() => void createOption()}
                disabled={updateProp.isPending}
                className="flex w-full items-center gap-2 rounded-lm-sm px-2 py-1.5 text-left text-sm text-lm-primary hover:bg-lm-card2 disabled:opacity-50"
              >
                <Plus size={13} className="text-lm-neon" />
                Criar <span className="font-medium">{term.trim()}</span>
              </button>
            )}
            {!canCreate && filtered.length === 0 && (
              <div className="px-2 py-3 text-center text-xs text-lm-subtle">
                {options.length === 0 ? 'Digite pra criar a primeira opcao' : 'Nenhuma opcao'}
              </div>
            )}
          </div>
        </div>
      </Dropdown>
    </>
  )
}
