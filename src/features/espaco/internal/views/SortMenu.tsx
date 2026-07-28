// LM Notion — regras de ordenacao da view (propriedade + direcao, reordenaveis).

import { useMemo } from 'react'
import { Plus, X, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import type { SortRule, NotionProperty } from '../types'
import { PROPERTY_ICONS } from '../props/propertyIcons'

interface SortMenuProps {
  properties: NotionProperty[]
  sorts: SortRule[]
  onChange: (sorts: SortRule[]) => void
  onClose: () => void
}

const selectCls =
  'h-7 rounded-lm-sm bg-lm-bg border border-lm-border px-2 text-xs text-lm-primary ' +
  'outline-none focus:border-lm-neon'

export default function SortMenu({ properties, sorts, onChange, onClose }: SortMenuProps) {
  const rules = sorts ?? []
  const byId = useMemo(() => new Map(properties.map(p => [p.id, p])), [properties])
  const used = new Set(rules.map(r => r.property_id))
  const available = properties.filter(p => !used.has(p.id))

  function add() {
    const next = available[0] ?? properties[0]
    if (!next) return
    onChange([...rules, { property_id: next.id, direction: 'asc' }])
  }

  function patch(index: number, next: Partial<SortRule>) {
    onChange(rules.map((r, i) => (i === index ? { ...r, ...next } : r)))
  }

  function remove(index: number) {
    onChange(rules.filter((_, i) => i !== index))
  }

  function move(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= rules.length) return
    const next = [...rules]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    onChange(next)
  }

  return (
    // Sem cartao proprio: fundo/borda/sombra vem do Popover que envolve.
    <div className="w-[420px]">
      <header className="flex items-center justify-between border-b border-lm-border px-3 py-2">
        <span className="text-xs font-medium text-heading">Ordenar</span>
        <div className="flex items-center gap-1">
          {rules.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="flex items-center gap-1 rounded-lm-sm px-2 py-1 text-xs text-lm-subtle hover:bg-lm-card2 hover:text-lm-primary"
            >
              <Trash2 className="h-3 w-3" />
              Limpar
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lm-sm p-1 text-lm-subtle hover:bg-lm-card2 hover:text-lm-primary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <div className="max-h-72 overflow-y-auto p-2">
        {rules.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-lm-subtle">
            Nenhuma ordenacao definida.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {rules.map((rule, index) => {
              const property = byId.get(rule.property_id)
              const Icon = property ? PROPERTY_ICONS[property.type] : null
              return (
                <li key={`${rule.property_id}-${index}`} className="flex items-center gap-1.5">
                  <div className="flex shrink-0 flex-col">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label="Mover para cima"
                      className="rounded-lm-sm px-1 text-lm-subtle hover:text-lm-primary disabled:opacity-30"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === rules.length - 1}
                      aria-label="Mover para baixo"
                      className="rounded-lm-sm px-1 text-lm-subtle hover:text-lm-primary disabled:opacity-30"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="relative flex-1">
                    {Icon && (
                      <Icon className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-lm-subtle" />
                    )}
                    <select
                      aria-label="Propriedade"
                      value={rule.property_id}
                      onChange={(e) => patch(index, { property_id: e.target.value })}
                      className={`${selectCls} w-full ${Icon ? 'pl-7' : ''}`}
                    >
                      {properties.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <select
                    aria-label="Direcao"
                    value={rule.direction}
                    onChange={(e) => patch(index, { direction: e.target.value as 'asc' | 'desc' })}
                    className={`${selectCls} w-32 shrink-0`}
                  >
                    <option value="asc">Crescente</option>
                    <option value="desc">Decrescente</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => remove(index)}
                    aria-label="Remover ordenacao"
                    className="shrink-0 rounded-lm-sm p-1 text-lm-subtle hover:bg-lm-card2 hover:text-lm-danger"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <footer className="border-t border-lm-border p-2">
        <button
          type="button"
          onClick={add}
          disabled={properties.length === 0}
          className="flex w-full items-center gap-1.5 rounded-lm-sm px-2 py-1.5 text-xs text-lm-muted hover:bg-lm-card2 hover:text-lm-primary disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar ordenacao
        </button>
      </footer>
    </div>
  )
}
