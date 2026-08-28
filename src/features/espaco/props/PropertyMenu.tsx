// DashNotion — menu de configuracao de uma propriedade. Duplicata de
// _internal/props/PropertyMenu.tsx com os hooks do dash.
// Obs.: a edge `prop_update` nao aceita trocar `type`; a troca de tipo é
// enviada mesmo assim (no-op se o backend ignorar campos desconhecidos).

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, Copy, Plus, Trash2, X } from 'lucide-react'
import {
  NOTION_COLORS, PROPERTY_TYPE_LABELS, READONLY_TYPES,
  type NotionColor, type NotionProperty, type PropertyType,
  type RollupConfig, type SelectOption,
} from '@/features/espaco/internal/types'
import { PROPERTY_ICONS } from '@/features/espaco/internal/props/propertyIcons'
import {
  useDatabases, useProperties, useUpdateProperty, useDeleteProperty, useCreateProperty,
} from '../useDashNotion'

interface Props {
  property: NotionProperty
  onClose: () => void
  onDeleted?: () => void
}

const ALL_TYPES = Object.keys(PROPERTY_TYPE_LABELS) as PropertyType[]

const COLORS: NotionColor[] = [
  'default', 'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red',
]

const ROLLUP_FNS: { value: NonNullable<RollupConfig['fn']>; label: string }[] = [
  { value: 'count', label: 'Contar tudo' },
  { value: 'count_values', label: 'Contar valores' },
  { value: 'sum', label: 'Soma' },
  { value: 'avg', label: 'Media' },
  { value: 'min', label: 'Minimo' },
  { value: 'max', label: 'Maximo' },
  { value: 'range', label: 'Intervalo' },
  { value: 'percent_checked', label: 'Percentual marcado' },
  { value: 'show_original', label: 'Mostrar original' },
]

const FIELD =
  'w-full rounded-lm-sm border border-lm-border bg-lm-bg px-2 py-1.5 text-sm text-lm-primary outline-none focus:border-lm-neon/50'
const ROW =
  'flex w-full items-center gap-2 rounded-lm-sm px-2 py-1.5 text-left text-sm text-lm-primary hover:bg-lm-card2'

export default function PropertyMenu({ property, onClose, onDeleted }: Props) {
  const [panel, setPanel] = useState<'root' | 'type' | 'options'>('root')
  const [name, setName] = useState(property.name)
  const rootRef = useRef<HTMLDivElement>(null)

  const updateProp = useUpdateProperty()
  const deleteProp = useDeleteProperty()
  const createProp = useCreateProperty()
  const { data: databases = [] } = useDatabases()
  const { data: siblings = [] } = useProperties(property.database_id)

  const options = useMemo<SelectOption[]>(() => property.config?.options ?? [], [property.config])
  const hasOptions = property.type === 'select' || property.type === 'multi_select' || property.type === 'status'

  useEffect(() => { setName(property.name) }, [property.name])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  function patchConfig(patch: Record<string, unknown>) {
    updateProp.mutate({ id: property.id, database_id: property.database_id, config: { ...property.config, ...patch } })
  }

  function setOptions(next: SelectOption[]) {
    patchConfig({ options: next })
  }

  function commitName() {
    const next = name.trim()
    if (next && next !== property.name) updateProp.mutate({ id: property.id, database_id: property.database_id, name: next })
  }

  function changeType(type: PropertyType) {
    if (type === property.type) { setPanel('root'); return }
    updateProp.mutate({ id: property.id, database_id: property.database_id, type })
    setPanel('root')
  }

  function duplicate() {
    createProp.mutate({
      database_id: property.database_id,
      name: `${property.name} (copia)`,
      type: property.type,
      config: property.config,
      sort_order: property.sort_order + 1,
    })
    onClose()
  }

  function remove() {
    if (property.type === 'title') return
    // Continua sendo a caixinha do navegador de propósito, e aqui o motivo é
    // outro: este menu é um popover que se fecha ao clicar fora. Abrir um
    // Dialog por dentro dele pode desmontar justamente quem está esperando a
    // resposta — e aí a Promise nunca volta.
    //
    // Confirmar isso exige navegador. Numa ação que apaga propriedade de
    // banco de dados do cliente, confirmação quebrada é pior que confirmação
    // feia.
    if (!confirm(`Excluir a propriedade "${property.name}"?`)) return
    deleteProp.mutate(
      { id: property.id, database_id: property.database_id },
      { onSuccess: () => { onDeleted?.(); onClose() } },
    )
  }

  const Header = ({ title }: { title: string }) => (
    <div className="flex items-center gap-2 border-b border-lm-border px-2 py-2">
      <button
        type="button"
        onClick={() => setPanel('root')}
        className="rounded-lm-sm p-1 text-lm-subtle hover:bg-lm-card2 hover:text-lm-primary"
        aria-label="Voltar"
      >
        <ChevronLeft size={14} />
      </button>
      <span className="text-sm font-medium text-heading">{title}</span>
      <button
        type="button"
        onClick={onClose}
        className="ml-auto rounded-lm-sm p-1 text-lm-subtle hover:bg-lm-card2 hover:text-lm-primary"
        aria-label="Fechar"
      >
        <X size={14} />
      </button>
    </div>
  )

  const shell = 'w-72 rounded-lm-md border border-lm-border bg-lm-card shadow-lm-lg'

  if (panel === 'type') {
    return (
      <div ref={rootRef} className={shell}>
        <Header title="Tipo da propriedade" />
        <div className="max-h-80 overflow-y-auto p-1">
          {ALL_TYPES.map(t => {
            const Icon = PROPERTY_ICONS[t]
            return (
              <button key={t} type="button" onClick={() => changeType(t)} className={ROW}>
                <Icon size={14} className="shrink-0 text-lm-subtle" />
                <span className="flex-1 truncate">{PROPERTY_TYPE_LABELS[t]}</span>
                {t === property.type && <span className="text-xs text-lm-neon">atual</span>}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  if (panel === 'options') {
    return (
      <div ref={rootRef} className={shell}>
        <Header title="Opcoes" />
        <div className="max-h-80 space-y-1 overflow-y-auto p-2">
          {options.map((o, i) => (
            <div key={o.id} className="rounded-lm-sm border border-lm-border p-2">
              <div className="flex items-center gap-2">
                <input
                  value={o.name}
                  onChange={(e) => {
                    const next = [...options]
                    next[i] = { ...o, name: e.target.value }
                    setOptions(next)
                  }}
                  className={FIELD}
                />
                <button
                  type="button"
                  onClick={() => setOptions(options.filter(x => x.id !== o.id))}
                  className="shrink-0 rounded-lm-sm p-1 text-lm-subtle hover:bg-lm-card2 hover:text-lm-danger"
                  aria-label={`Remover ${o.name}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      const next = [...options]
                      next[i] = { ...o, color: c }
                      setOptions(next)
                    }}
                    className={[
                      'h-4 w-4 rounded-full ring-offset-1 ring-offset-lm-card',
                      NOTION_COLORS[c].dot,
                      o.color === c ? 'ring-2 ring-lm-neon' : '',
                    ].join(' ')}
                    aria-label={`Cor ${c}`}
                  />
                ))}
              </div>
              {property.type === 'status' && (
                <select
                  value={o.group ?? 'todo'}
                  onChange={(e) => {
                    const next = [...options]
                    next[i] = { ...o, group: e.target.value as SelectOption['group'] }
                    setOptions(next)
                  }}
                  className={`${FIELD} mt-2`}
                >
                  <option value="todo">A fazer</option>
                  <option value="doing">Em andamento</option>
                  <option value="done">Concluido</option>
                </select>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setOptions([
              ...options,
              {
                id: crypto.randomUUID(),
                name: `Opcao ${options.length + 1}`,
                color: COLORS[options.length % COLORS.length],
                ...(property.type === 'status' ? { group: 'todo' as const } : {}),
              },
            ])}
            className={ROW}
          >
            <Plus size={14} className="text-lm-neon" /> Adicionar opcao
          </button>
        </div>
      </div>
    )
  }

  const TypeIcon = PROPERTY_ICONS[property.type]
  const rollup: RollupConfig = property.config ?? {}
  const relationProps = siblings.filter(p => p.type === 'relation')
  const rollupSource = relationProps.find(p => p.id === rollup.relation_property_id)
  const targetDbId = rollupSource?.config?.target_database_id ?? null

  return (
    <div ref={rootRef} className={shell}>
      <div className="flex items-center gap-2 border-b border-lm-border p-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitName(); e.currentTarget.blur() }
          }}
          className={FIELD}
          placeholder="Nome da propriedade"
        />
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lm-sm p-1 text-lm-subtle hover:bg-lm-card2 hover:text-lm-primary"
          aria-label="Fechar"
        >
          <X size={14} />
        </button>
      </div>

      <div className="p-1">
        <button type="button" onClick={() => setPanel('type')} className={ROW}>
          <TypeIcon size={14} className="shrink-0 text-lm-subtle" />
          <span className="flex-1">Tipo</span>
          <span className="truncate text-xs text-lm-muted">{PROPERTY_TYPE_LABELS[property.type]}</span>
        </button>

        {hasOptions && (
          <button type="button" onClick={() => setPanel('options')} className={ROW}>
            <Plus size={14} className="shrink-0 text-lm-subtle" />
            <span className="flex-1">Opcoes</span>
            <span className="text-xs text-lm-muted">{options.length}</span>
          </button>
        )}
      </div>

      {property.type === 'formula' && (
        <div className="border-t border-lm-border p-2">
          <label className="mb-1 block text-xs text-lm-muted">Expressao</label>
          <textarea
            defaultValue={property.config?.expression ?? ''}
            onBlur={(e) => patchConfig({ expression: e.target.value })}
            rows={3}
            placeholder="prop('Valor') * 2"
            className={`${FIELD} resize-none font-mono text-xs`}
          />
        </div>
      )}

      {property.type === 'relation' && (
        <div className="border-t border-lm-border p-2">
          <label className="mb-1 block text-xs text-lm-muted">Base de destino</label>
          <select
            value={property.config?.target_database_id ?? ''}
            onChange={(e) => patchConfig({ target_database_id: e.target.value || null })}
            className={FIELD}
          >
            <option value="">Selecione...</option>
            {databases.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-lm-muted">
            <input
              type="checkbox"
              checked={property.config?.allow_multiple !== false}
              onChange={(e) => patchConfig({ allow_multiple: e.target.checked })}
              className="h-3.5 w-3.5 accent-lm-neon"
            />
            Permitir varias paginas
          </label>
        </div>
      )}

      {property.type === 'rollup' && (
        <div className="space-y-2 border-t border-lm-border p-2">
          <div>
            <label className="mb-1 block text-xs text-lm-muted">Relacao</label>
            <select
              value={rollup.relation_property_id ?? ''}
              onChange={(e) => patchConfig({ relation_property_id: e.target.value || null, target_property_id: null })}
              className={FIELD}
            >
              <option value="">Selecione...</option>
              {relationProps.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <RollupTargetSelect
            databaseId={targetDbId}
            value={rollup.target_property_id ?? ''}
            onChange={(v) => patchConfig({ target_property_id: v || null })}
          />
          <div>
            <label className="mb-1 block text-xs text-lm-muted">Funcao</label>
            <select
              value={rollup.fn ?? 'count'}
              onChange={(e) => patchConfig({ fn: e.target.value as RollupConfig['fn'] })}
              className={FIELD}
            >
              {ROLLUP_FNS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="border-t border-lm-border p-1">
        <button type="button" onClick={duplicate} className={ROW}>
          <Copy size={14} className="shrink-0 text-lm-subtle" /> Duplicar propriedade
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={property.type === 'title'}
          className={`${ROW} text-lm-danger disabled:cursor-not-allowed disabled:opacity-40`}
        >
          <Trash2 size={14} className="shrink-0" /> Excluir propriedade
        </button>
        {READONLY_TYPES.includes(property.type) && (
          <p className="px-2 py-1.5 text-[11px] text-lm-subtle">
            Valor calculado automaticamente — nao editavel na celula.
          </p>
        )}
      </div>
    </div>
  )
}

function RollupTargetSelect({
  databaseId, value, onChange,
}: { databaseId: string | null; value: string; onChange: (v: string) => void }) {
  const { data: props = [] } = useProperties(databaseId)
  return (
    <div>
      <label className="mb-1 block text-xs text-lm-muted">Propriedade alvo</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!databaseId}
        className={`${FIELD} disabled:opacity-50`}
      >
        <option value="">{databaseId ? 'Selecione...' : 'Escolha a relacao primeiro'}</option>
        {props.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </div>
  )
}
