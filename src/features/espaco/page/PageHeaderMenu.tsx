// DashNotion — menu "..." do cabecalho da pagina. Duplicata adaptada de
// _internal/page/PageHeaderMenu.tsx: sem favoritos e sem template (a edge nao
// tem essas actions); copiar link aponta pra URL atual do dash.

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  MoreHorizontal, Link2, Copy, MoveHorizontal, Type, Lock, Unlock, History, Trash2,
  LayoutTemplate,
} from 'lucide-react'
import type { NotionPage } from '@/features/espaco/internal/types'
import { useArchivePage, useDuplicatePage, useSetTemplate, useUpdatePage } from '../useDashNotion'

interface PageHeaderMenuProps {
  page: NotionPage
  onOpenVersions: () => void
  onArchived?: () => void
}

export default function PageHeaderMenu({ page, onOpenVersions, onArchived }: PageHeaderMenuProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const updatePage = useUpdatePage()
  const duplicate = useDuplicatePage()
  const setTemplate = useSetTemplate()
  const archive = useArchivePage()

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function close() { setOpen(false) }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('Link copiado')
    } catch {
      toast.error('Nao foi possivel copiar o link')
    }
    close()
  }

  const items: { key: string; label: string; icon: typeof Copy; onClick: () => void; danger?: boolean }[] = [
    { key: 'link', label: 'Copiar link', icon: Link2, onClick: () => { void copyLink() } },
    { key: 'dup', label: 'Duplicar', icon: Copy, onClick: () => { duplicate.mutate(page); close() } },
    {
      key: 'width', label: page.full_width ? 'Largura padrao' : 'Largura total', icon: MoveHorizontal,
      onClick: () => { updatePage.mutate({ id: page.id, full_width: !page.full_width }); close() },
    },
    {
      key: 'small', label: page.small_text ? 'Texto padrao' : 'Texto pequeno', icon: Type,
      onClick: () => { updatePage.mutate({ id: page.id, small_text: !page.small_text }); close() },
    },
    {
      key: 'lock', label: page.is_locked ? 'Desbloquear pagina' : 'Bloquear pagina', icon: page.is_locked ? Unlock : Lock,
      onClick: () => { updatePage.mutate({ id: page.id, is_locked: !page.is_locked }); close() },
    },
    { key: 'versions', label: 'Historico de versoes', icon: History, onClick: () => { onOpenVersions(); close() } },
    // So faz sentido em linha de database: template e modelo de linha nova.
    ...(page.database_id ? [{
      key: 'template',
      label: page.is_template ? 'Deixar de ser template' : 'Salvar como template',
      icon: LayoutTemplate,
      onClick: () => {
        setTemplate.mutate({
          id: page.id,
          database_id: page.database_id as string,
          is_template: !page.is_template,
        })
        close()
      },
    }] : []),
    {
      key: 'trash', label: 'Mover para lixeira', icon: Trash2, danger: true,
      onClick: () => {
        archive.mutate({ id: page.id, database_id: page.database_id, archived: true }, { onSuccess: () => onArchived?.() })
        close()
      },
    },
  ]

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-label="Mais opcoes"
        onClick={() => setOpen(o => !o)}
        className="rounded-lm-sm p-1.5 text-lm-muted transition hover:bg-lm-card2 hover:text-lm-primary"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lm-md border border-lm-border bg-lm-card py-1 shadow-lm-modal">
          {items.map(it => {
            const Ico = it.icon
            return (
              <button
                key={it.key}
                type="button"
                onClick={it.onClick}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition hover:bg-lm-card2 ${
                  it.danger ? 'text-lm-danger' : 'text-lm-primary'
                }`}
              >
                <Ico className="h-4 w-4 shrink-0" />
                {it.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
