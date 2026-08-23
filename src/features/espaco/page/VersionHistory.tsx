// DashNotion — historico de versoes. Duplicata adaptada de
// _internal/page/VersionHistory.tsx com os hooks do dash. Restaurar snapshota o
// estado atual (version_snapshot) e grava a versao escolhida (page_save via
// useUpdatePage passando content).

import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import type { NotionPage, NotionPageVersion } from '@/features/espaco/internal/types'
import { relativeTime } from '@/features/espaco/internal/page/relativeTime'
import { useMembers, useSnapshotVersion, useUpdatePage, useVersions } from '../useDashNotion'

export function blocksToPlainText(content: unknown): string {
  const out: string[] = []
  const walkInline = (inline: unknown): string => {
    if (typeof inline === 'string') return inline
    if (Array.isArray(inline)) return inline.map(walkInline).join('')
    if (inline && typeof inline === 'object') {
      const o = inline as Record<string, unknown>
      if (typeof o.text === 'string') return o.text
      if (Array.isArray(o.content)) return walkInline(o.content)
    }
    return ''
  }
  const walkBlock = (block: unknown) => {
    if (!block || typeof block !== 'object') return
    const b = block as Record<string, unknown>
    const line = walkInline(b.content).trim()
    if (line) out.push(line)
    if (Array.isArray(b.children)) b.children.forEach(walkBlock)
  }
  if (Array.isArray(content)) content.forEach(walkBlock)
  return out.join('\n')
}

interface VersionHistoryProps {
  page: NotionPage
  open: boolean
  onClose: () => void
  onRestored?: () => void
}

export default function VersionHistory({ page, open, onClose, onRestored }: VersionHistoryProps) {
  const { data: versions = [] } = useVersions(open ? page.id : null)
  const { data: members = [] } = useMembers()
  const updatePage = useUpdatePage()
  const snapshot = useSnapshotVersion()

  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (open && !selectedId && versions.length > 0) setSelectedId(versions[0].id)
    if (!open) setSelectedId(null)
  }, [open, versions, selectedId])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const memberById = useMemo(() => new Map(members.map(m => [m.id, m])), [members])
  const selected: NotionPageVersion | undefined = versions.find(v => v.id === selectedId)
  const preview = useMemo(() => (selected ? blocksToPlainText(selected.content) : ''), [selected])

  async function restore(v: NotionPageVersion) {
    try {
      await snapshot.mutateAsync({ page_id: page.id })
      await updatePage.mutateAsync({ id: page.id, title: v.title, content: v.content })
      toast.success('Versao restaurada')
      onRestored?.()
      onClose()
    } catch { /* erro ja vira toast nos hooks */ }
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-[420px] flex-col border-l border-lm-border bg-lm-card shadow-lm-modal">
        <header className="flex items-center justify-between border-b border-lm-border px-4 py-3">
          <h3 className="text-sm font-medium text-heading">Historico de versoes</h3>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="rounded-lm-sm p-1 text-lm-muted transition hover:bg-lm-card2 hover:text-lm-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="max-h-[38%] shrink-0 overflow-y-auto border-b border-lm-border py-1">
          {versions.length === 0 && (
            <p className="px-4 py-3 text-sm text-lm-subtle">Nenhuma versao salva ainda.</p>
          )}
          {versions.map(v => {
            const author = v.member_id ? memberById.get(v.member_id) : undefined
            const active = v.id === selectedId
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedId(v.id)}
                className={`flex w-full flex-col items-start px-4 py-2 text-left transition hover:bg-lm-card2 ${
                  active ? 'bg-lm-card2' : ''
                }`}
              >
                <span className="text-sm text-lm-primary">{relativeTime(v.created_at)}</span>
                <span className="text-xs text-lm-subtle">
                  {author?.full_name ?? author?.email ?? 'Autor desconhecido'}
                </span>
              </button>
            )
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {selected ? (
            <>
              <p className="text-lg font-semibold text-heading">{selected.title || 'Sem titulo'}</p>
              <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm text-lm-muted">
                {preview || 'Sem conteudo de texto nesta versao.'}
              </pre>
            </>
          ) : (
            <p className="text-sm text-lm-subtle">Selecione uma versao para ver o conteudo.</p>
          )}
        </div>

        {selected && (
          <footer className="border-t border-lm-border p-3">
            <button
              type="button"
              onClick={() => restore(selected)}
              className="w-full rounded-lm-sm bg-lm-neon px-3 py-2 text-sm text-lm-inverse"
            >
              Restaurar esta versao
            </button>
          </footer>
        )}
      </aside>
    </>
  )
}
