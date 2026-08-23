// DashNotion — construtor de filtros. Duplicata de _internal/views/FilterMenu.tsx
// com useMembers do dash (seletor de pessoa).

import { useMemo } from 'react'
import { Plus, X, Trash2 } from 'lucide-react'
import type { FilterGroup, FilterCondition, NotionProperty, FilterOperator } from '@/features/espaco/internal/types'
import { PROPERTY_ICONS } from '@/features/espaco/internal/props/propertyIcons'
import { operatorsFor, operatorNeedsValue, OPERATOR_LABELS } from '@/features/espaco/internal/views/viewLib'
import { useMembers } from '../useDashNotion'

interface FilterMenuProps {
  properties: NotionProperty[]
  filters: FilterGroup
  onChange: (filters: FilterGroup) => void
  onClose: () => void
}

const EMPTY: FilterGroup = { operator: 'and', conditions: [] }

const selectCls =
  'h-7 rounded-lm-sm bg-lm-bg border border-lm-border px-2 text-xs text-lm-primary ' +
  'outline-none focus:border-lm-neon'

export default function FilterMenu({ properties, filters, onChange, onClose }: FilterMenuProps) {
  const group = filters ?? EMPTY
  const conditions = group.conditions ?? []
  const byId = useMemo(() => new Map(properties.map(p => [p.id, p])), [properties])

  function update(next: Partial<FilterGroup>) {
    onChange({ operator: group.operator ?? 'and', conditions, ...next })
  }

  function addCondition() {
    const first = properties[0]
    if (!first) return
    const condition: FilterCondition = {
      id: crypto.randomUUID(),
      property_id: first.id,
      operator: operatorsFor(first.type)[0],
      value: '',
    }
    update({ conditions: [...conditions, condition] })
  }

  function patch(id: string, next: Partial<FilterCondition>) {
    update({ conditions: conditions.map(c => (c.id === id ? { ...c, ...next } : c)) })
  }

  function changeProperty(condition: FilterCondition, propertyId: string) {
    const property = byId.get(propertyId)
    if (!property) return
    const allowed = operatorsFor(property.type)
    const operator = allowed.includes(condition.operator) ? condition.operator : allowed[0]
    patch(condition.id, { property_id: propertyId, operator, value: '' })
  }

  function remove(id: string) {
    update({ conditions: conditions.filter(c => c.id !== id) })
  }

  return (
    <div className="w-[520px]">
      <header className="flex items-center justify-between border-b border-lm-border px-3 py-2">
        <span className="text-xs font-medium text-heading">Filtros</span>
        <div className="flex items-center gap-1">
          {conditions.length > 0 && (
            <button
              type="button"
              onClick={() => update({ conditions: [] })}
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

      <div className="max-h-80 overflow-y-auto p-2">
        {conditions.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-lm-subtle">Nenhum filtro aplicado.</p>
        ) : (
          <ul className="space-y-1.5">
            {conditions.map((condition, index) => {
              const property = byId.get(condition.property_id)
              const Icon = property ? PROPERTY_ICONS[property.type] : null
              const allowed = property ? operatorsFor(property.type) : []
              return (
                <li key={condition.id} className="flex items-center gap-1.5">
                  <div className="w-14 shrink-0">
                    {index === 0 ? (
                      <span className="pl-1 text-xs text-lm-subtle">Onde</span>
                    ) : index === 1 ? (
                      <select
                        aria-label="Conector"
                        value={group.operator ?? 'and'}
                        onChange={(e) => update({ operator: e.target.value as 'and' | 'or' })}
                        className={`${selectCls} w-full`}
                      >
                        <option value="and">E</option>
                        <option value="or">Ou</option>
                      </select>
                    ) : (
                      <span className="pl-1 text-xs text-lm-subtle">
                        {(group.operator ?? 'and') === 'or' ? 'Ou' : 'E'}
                      </span>
                    )}
                  </div>

                  <div className="relative flex-1">
                    {Icon && (
                      <Icon className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-lm-subtle" />
                    )}
                    <select
                      aria-label="Propriedade"
                      value={condition.property_id}
                      onChange={(e) => changeProperty(condition, e.target.value)}
                      className={`${selectCls} w-full ${Icon ? 'pl-7' : ''}`}
                    >
                      {properties.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <select
                    aria-label="Operador"
                    value={condition.operator}
                    onChange={(e) => patch(condition.id, { operator: e.target.value as FilterOperator, value: '' })}
                    className={`${selectCls} w-36 shrink-0`}
                  >
                    {allowed.map(op => (
                      <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
                    ))}
                  </select>

                  <div className="w-40 shrink-0">
                    {operatorNeedsValue(condition.operator) && property && (
                      <ValueInput
                        property={property}
                        value={condition.value}
                        onChange={(value) => patch(condition.id, { value })}
                      />
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(condition.id)}
                    aria-label="Remover filtro"
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
          onClick={addCondition}
          disabled={properties.length === 0}
          className="flex w-full items-center gap-1.5 rounded-lm-sm px-2 py-1.5 text-xs text-lm-muted hover:bg-lm-card2 hover:text-lm-primary disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar condicao
        </button>
      </footer>
    </div>
  )
}

function ValueInput({ property, value, onChange }: {
  property: NotionProperty; value: unknown; onChange: (v: unknown) => void
}) {
  const cls = `${selectCls} w-full`
  const text = value === null || value === undefined ? '' : String(value)

  if (property.type === 'select' || property.type === 'status' || property.type === 'multi_select') {
    const options = property.config?.options ?? []
    return (
      <select aria-label="Valor" value={text} onChange={(e) => onChange(e.target.value)} className={cls}>
        <option value="">Selecione</option>
        {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    )
  }

  if (property.type === 'person') {
    return <SeletorPessoa value={text} onChange={onChange} cls={cls} />
  }

  const inputType =
    property.type === 'number' || property.type === 'auto_number' ? 'number'
      : property.type === 'date' || property.type === 'created_time' || property.type === 'last_edited_time' ? 'date'
        : 'text'

  return (
    <input
      aria-label="Valor"
      type={inputType}
      value={text}
      placeholder="Valor"
      onChange={(e) => onChange(e.target.value)}
      className={`${cls} placeholder:text-lm-disabled`}
    />
  )
}

function SeletorPessoa({ value, onChange, cls }: {
  value: string; onChange: (v: unknown) => void; cls: string
}) {
  const { data: members = [] } = useMembers()
  return (
    <select aria-label="Valor" value={value} onChange={(e) => onChange(e.target.value)} className={cls}>
      <option value="">Selecione</option>
      {members.map(m => (
        <option key={m.id} value={m.id}>{m.full_name ?? m.email}</option>
      ))}
    </select>
  )
}
