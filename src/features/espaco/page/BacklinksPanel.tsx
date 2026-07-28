// DashNotion — paginas que mencionam esta. Duplicata de
// _internal/page/BacklinksPanel.tsx com useBacklinks do dash.

import { FileText } from 'lucide-react'
import { PageIcon } from '@/features/espaco/internal/page/IconPicker'
import { useBacklinks } from '../useDashNotion'

interface BacklinksPanelProps {
  pageId: string
  onOpenPage?: (pageId: string) => void
}

export default function BacklinksPanel({ pageId, onOpenPage }: BacklinksPanelProps) {
  const { data: links = [] } = useBacklinks(pageId)
  if (links.length === 0) return null

  return (
    <section className="mt-8 border-t border-lm-border pt-6">
      <h3 className="text-sm font-medium text-heading">Mencionado em</h3>
      <ul className="mt-2 flex flex-col gap-0.5">
        {links.map(p => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onOpenPage?.(p.id)}
              className="flex w-full items-center gap-2 rounded-lm-sm px-2 py-1.5 text-left text-sm text-lm-muted transition hover:bg-lm-card2 hover:text-lm-primary"
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                {p.icon ? <PageIcon icon={p.icon} size={14} /> : <FileText className="h-4 w-4" />}
              </span>
              <span className="truncate">{p.title || 'Sem titulo'}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
