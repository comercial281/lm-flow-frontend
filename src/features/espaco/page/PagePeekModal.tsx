// DashNotion — modal de espiada (peek). Duplicata de _internal/page/PagePeekModal.tsx
// com usePage/PageView/PageHeaderMenu/VersionHistory do dash.

import { useEffect, useState } from 'react'
import { Maximize2, X } from 'lucide-react'
import { usePage } from '../useDashNotion'
import PageView from './PageView'
import PageHeaderMenu from './PageHeaderMenu'
import VersionHistory from './VersionHistory'

interface PagePeekModalProps {
  pageId: string
  onClose: () => void
  onExpand: () => void
  onOpenPage?: (pageId: string) => void
}

export default function PagePeekModal({ pageId, onClose, onExpand, onOpenPage }: PagePeekModalProps) {
  const { data: page } = usePage(pageId)
  const [showVersions, setShowVersions] = useState(false)
  const [editorKey, setEditorKey] = useState(0)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && !showVersions) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, showVersions])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
        className="flex w-full max-w-[900px] flex-col overflow-hidden rounded-lm-xl border border-lm-border bg-lm-deep shadow-lm-modal"
        style={{ height: '88vh' }}
      >
        <header className="flex shrink-0 items-center gap-1 border-b border-lm-border px-3 py-2">
          <button
            type="button"
            aria-label="Abrir em pagina cheia"
            onClick={onExpand}
            className="rounded-lm-sm p-1.5 text-lm-muted transition hover:bg-lm-card2 hover:text-lm-primary"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <div className="flex-1" />
          {page && (
            <PageHeaderMenu page={page} onOpenVersions={() => setShowVersions(true)} onArchived={onClose} />
          )}
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="rounded-lm-sm p-1.5 text-lm-muted transition hover:bg-lm-card2 hover:text-lm-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <PageView key={`${pageId}:${editorKey}`} pageId={pageId} mode="peek" onClose={onClose} onOpenPage={onOpenPage} />
        </div>
      </div>

      {page && (
        <VersionHistory
          page={page}
          open={showVersions}
          onClose={() => setShowVersions(false)}
          onRestored={() => setEditorKey(k => k + 1)}
        />
      )}
    </div>
  )
}
