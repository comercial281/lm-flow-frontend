// DashNotion — editor multi_select. Duplicata de
// _internal/props/editors/MultiSelectCell.tsx com useUpdateProperty do dash.

import { useMemo, useRef, useState } from 'react'
import { Check, Plus, Trash2, Palette } from 'lucide-react'
import { NOTION_COLORS, type NotionColor, type NotionProperty, type PropertyValue, type SelectOption } from '@/features/espaco/internal/types'
import Dropdown from '@/features/espaco/internal/Dropdown'
import { Pill } from './SelectCell'
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

function TagRow({ option, selecionada, onToggle, onCor, onExcluir }: {
  option: SelectOption
  selecionada: boolean
  onToggle: () => void
  onCor: (cor: NotionColor) => void
  onExcluir: () => void
}) {
  const [paleta, setPaleta] = useState(false)
  return (
    <div className="group rounded-lm-sm hover:bg-lm-card2">
      <div className="flex items-center gap-1 px-1.5 py-1">
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <Pill option={option} />
          {selecionada && <Check size={13} className="ml-auto shrink-0 text-lm-neon" />}
        </button>
        <button
          type="button"
          aria-label="Cor da tag"
          title="Trocar a cor"
          onClick={() => setPaleta(v => !v)}
          className="shrink-0 rounded p-1 text-lm-subtle opacity-0 hover:bg-lm-card hover:text-lm-primary group-hover:opacity-100"
        >
          <Palette size={13} />
        </button>
        <button
          type="button"
          aria-label="Excluir tag"
          title="Excluir tag"
          onClick={onExcluir}
          className="shrink-0 rounded p-1 text-lm-subtle opacity-0 hover:bg-lm-card hover:text-lm-danger group-hover:opacity-100"
        >
          <Trash2 size={13} />
        </button>
      </div>
      {paleta && (
        <div className="flex flex-wrap gap-1 px-2 pb-2">
          {PALETTE.map(c => (
            <button
              key={c}
              type="button"
              aria-label={`Cor ${c}`}
              onClick={() => { onCor(c); setPaleta(false) }}
              className={`h-5 w-5 rounded-full border transition ${NOTION_COLORS[c].dot} ${
                option.color === c ? 'border-lm-primary' : 'border-transparent hover:border-lm-border2'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function MultiSelectCell({ property, value, onChange, variant = 'table', autoFocus }: Props) {
  const options = useMemo<SelectOption[]>(() => property.config?.options ?? [], [property.config])
  const selectedIds = useMemo<string[]>(
    () => (Array.isArray(value) ? (value as unknown[]).filter((v): v is string => typeof v === 'string') : []),
    [value],
  )
  const selected = selectedIds
    .map(id => options.find(o => o.id === id))
    .filter((o): o is SelectOption => !!o)

  const [open, setOpen] = useState(!!autoFocus)
  const [term, setTerm] = useState('')
  const btnRef = useRef<HTMLButtonElement>(null)
  const updateProp = useUpdateProperty()

  const filtered = options.filter(o => o.name.toLowerCase().includes(term.trim().toLowerCase()))
  const exact = options.some(o => o.name.toLowerCase() === term.trim().toLowerCase())
  const canCreate = term.trim().length > 0 && !exact

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id])
  }

  async function createOption() {
    const name = term.trim()
    if (!name) return
    const next: SelectOption = { id: crypto.randomUUID(), name, color: PALETTE[options.length % PALETTE.length] }
    await updateProp.mutateAsync({
      id: property.id, database_id: property.database_id,
      config: { ...property.config, options: [...options, next] },
    })
    onChange([...selectedIds, next.id])
    setTerm('')
  }

  function mudarCor(id: string, cor: NotionColor) {
    void updateProp.mutateAsync({
      id: property.id, database_id: property.database_id,
      config: { ...property.config, options: options.map(o => (o.id === id ? { ...o, color: cor } : o)) },
    })
  }

  function excluirTag(id: string) {
    void updateProp.mutateAsync({
      id: property.id, database_id: property.database_id,
      config: { ...property.config, options: options.filter(o => o.id !== id) },
    })
    if (selectedIds.includes(id)) onChange(selectedIds.filter(x => x !== id))
  }

  if (variant === 'card') {
    return (
      <div className="flex flex-wrap gap-1 px-2 py-1">
        {selected.map(o => <Pill key={o.id} option={o} />)}
      </div>
    )
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full flex-wrap items-center gap-1 px-2 py-1 text-left hover:bg-lm-card2"
      >
        {selected.length === 0
          ? <span className="text-sm text-lm-subtle">Vazio</span>
          : selected.map(o => <Pill key={o.id} option={o} onRemove={() => toggle(o.id)} />)}
      </button>

      <Dropdown anchorRef={btnRef} open={open} onClose={() => setOpen(false)}>
        <div className="w-64">
          <div className="border-b border-lm-border p-2">
            <input
              autoFocus
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && canCreate) { e.preventDefault(); void createOption() } }}
              placeholder="Buscar ou criar tag..."
              className="w-full rounded-lm-sm bg-lm-bg px-2 py-1.5 text-sm text-lm-primary outline-none placeholder:text-lm-subtle focus:ring-1 focus:ring-lm-neon/40"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filtered.map(o => (
              <TagRow
                key={o.id}
                option={o}
                selecionada={selectedIds.includes(o.id)}
                onToggle={() => toggle(o.id)}
                onCor={(cor) => mudarCor(o.id, cor)}
                onExcluir={() => excluirTag(o.id)}
              />
            ))}
            {canCreate && (
              <button
                type="button"
                onClick={() => void createOption()}
                disabled={updateProp.isPending}
                className="flex w-full items-center gap-2 rounded-lm-sm px-2 py-1.5 text-left text-sm text-lm-primary hover:bg-lm-card2 disabled:opacity-50"
              >
                <Plus size={13} className="text-lm-neon" />
                Criar tag <span className="font-medium">{term.trim()}</span>
              </button>
            )}
            {!canCreate && filtered.length === 0 && (
              <div className="px-2 py-3 text-center text-xs text-lm-subtle">
                {options.length === 0 ? 'Digite pra criar a primeira tag' : 'Nenhuma tag'}
              </div>
            )}
          </div>
        </div>
      </Dropdown>
    </>
  )
}
