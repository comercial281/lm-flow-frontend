// DashNotion — editor de relacao. Duplicata de _internal/props/editors/RelationCell.tsx.
// Busca as paginas do database alvo pela action `db_rows` (nao supabase direto).

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, FileText, X } from 'lucide-react'
import type { RelationConfig } from '@/features/espaco/internal/types'
import { useDashCtx } from '../dashContext'

interface Props {
  config: RelationConfig
  relations: string[]
  onRelationChange: (pageIds: string[]) => void
  variant?: 'table' | 'panel' | 'card'
  autoFocus?: boolean
}

type TargetPage = { id: string; title: string; icon: string | null }

function useTargetPages(targetDatabaseId: string | null | undefined) {
  const { token, call } = useDashCtx()
  return useQuery({
    queryKey: ['dash_notion', 'relation_targets', token, targetDatabaseId],
    enabled: !!targetDatabaseId,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { rows } = await call<{ rows: TargetPage[] }>('db_rows', { database_id: targetDatabaseId })
      return (rows ?? []).map(r => ({ id: r.id, title: r.title, icon: r.icon }))
    },
  })
}

export default function RelationCell({
  config, relations, onRelationChange, variant = 'table', autoFocus,
}: Props) {
  const { data: pages = [] } = useTargetPages(config.target_database_id)
  const [open, setOpen] = useState(!!autoFocus)
  const [term, setTerm] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const selected = relations
    .map(id => pages.find(p => p.id === id))
    .filter((p): p is TargetPage => !!p)

  const q = term.trim().toLowerCase()
  const filtered = pages.filter(p => !q || p.title.toLowerCase().includes(q))

  function toggle(id: string) {
    const allowMultiple = config.allow_multiple !== false
    if (relations.includes(id)) {
      onRelationChange(relations.filter(x => x !== id))
      return
    }
    onRelationChange(allowMultiple ? [...relations, id] : [id])
    if (!allowMultiple) setOpen(false)
  }

  const chips = selected.map(p => (
    <span
      key={p.id}
      className="inline-flex max-w-full items-center gap-1 rounded-lm-sm bg-lm-card2 px-1.5 py-0.5 text-xs text-lm-primary"
    >
      {p.icon ? <span className="shrink-0">{p.icon}</span> : <FileText size={11} className="shrink-0 text-lm-subtle" />}
      <span className="truncate">{p.title || 'Sem titulo'}</span>
      {variant !== 'card' && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggle(p.id) }}
          className="shrink-0 text-lm-subtle hover:text-lm-primary"
          aria-label="Remover relacao"
        >
          <X size={11} />
        </button>
      )}
    </span>
  ))

  if (variant === 'card') {
    return <div className="flex flex-wrap gap-1 px-2 py-1">{chips}</div>
  }

  if (!config.target_database_id) {
    return <span className="block px-2 py-1 text-xs text-lm-subtle">Sem base de destino</span>
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full flex-wrap items-center gap-1 px-2 py-1 text-left hover:bg-lm-card2"
      >
        {selected.length === 0 ? <span className="text-sm text-lm-subtle">Vazio</span> : chips}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lm-md border border-lm-border bg-lm-card shadow-lm-lg">
          <div className="border-b border-lm-border p-2">
            <input
              autoFocus
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Buscar pagina..."
              className="w-full rounded-lm-sm bg-lm-bg px-2 py-1.5 text-sm text-lm-primary outline-none placeholder:text-lm-subtle focus:ring-1 focus:ring-lm-neon/40"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filtered.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                className="flex w-full items-center gap-2 rounded-lm-sm px-2 py-1.5 text-left hover:bg-lm-card2"
              >
                {p.icon
                  ? <span className="shrink-0 text-sm">{p.icon}</span>
                  : <FileText size={13} className="shrink-0 text-lm-subtle" />}
                <span className="min-w-0 flex-1 truncate text-sm text-lm-primary">{p.title || 'Sem titulo'}</span>
                {relations.includes(p.id) && <Check size={13} className="shrink-0 text-lm-neon" />}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-2 py-3 text-center text-xs text-lm-subtle">Nenhuma pagina</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
