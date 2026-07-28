// DashNotion — editor de blocos (BlockNote). Duplicata adaptada de
// _internal/editor/NotionEditor.tsx: colaboracao pela edge (useDashCollaboration),
// upload pela action `upload`, mencao de pagina/pessoa via "@" sobre os dados do
// dash (useSpace/useMembers), autosave debounced -> page_save.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { filterSuggestionItems, type PartialBlock } from '@blocknote/core'
import { pt } from '@blocknote/core/locales'
import {
  useCreateBlockNote,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  type DefaultReactSuggestionItem,
} from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'
import { FileText, AtSign, Plus } from 'lucide-react'
import type * as Y from 'yjs'
import type { Awareness } from 'y-protocols/awareness'
import { notionSchema, extractMentionedPageIds } from '@/features/espaco/internal/editor/schema'
import '@/features/espaco/internal/editor/notion-editor.css'
import { useMembers, useSavePageContent, useSyncPageLinks, useSpace, useUploadFile } from './useDashNotion'
import { useDashCollaboration } from './useDashCollaboration'
import { useDashCtx } from './dashContext'

interface NotionEditorProps {
  pageId: string
  initialContent: unknown[]
  editable?: boolean
  smallText?: boolean
  onDirtyChange?: (dirty: boolean) => void
}

interface ColabEditor {
  fragment: Y.XmlFragment
  awareness: Awareness
  user: { name: string; color: string }
}

const AUTOSAVE_MS = 700

export default function DashNotionEditor(props: NotionEditorProps) {
  const podeColaborar = props.editable !== false
  const colab = useDashCollaboration(props.pageId, props.initialContent, podeColaborar)

  const colabEditor = useMemo<ColabEditor | undefined>(
    () => (colab.estado === 'pronto'
      ? { fragment: colab.fragment, awareness: colab.awareness, user: colab.user }
      : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colab.estado === 'pronto' ? colab.fragment : null],
  )

  if (colab.estado === 'carregando') {
    return (
      <div className="lm-notion-editor px-1 py-2 text-[11px] text-lm-subtle">
        Conectando a edicao em tempo real...
      </div>
    )
  }

  return (
    <>
      {colab.estado === 'pronto' && colab.peers.length > 0 && <PresencaBar peers={colab.peers} />}
      <EditorInterno {...props} colab={colabEditor} />
    </>
  )
}

function PresencaBar({ peers }: { peers: { id: string; name: string; color: string }[] }) {
  return (
    <div className="pointer-events-none fixed right-6 top-16 z-30 flex items-center -space-x-1.5">
      {peers.slice(0, 5).map(p => (
        <span
          key={p.id}
          title={`${p.name} esta aqui agora`}
          className="grid h-6 w-6 place-items-center rounded-full border-2 border-lm-card text-[10px] font-semibold text-white shadow-lm-sm"
          style={{ backgroundColor: p.color }}
        >
          {p.name.slice(0, 1).toUpperCase()}
        </span>
      ))}
    </div>
  )
}

function useAppTheme(): 'light' | 'dark' {
  // LM Flow controla tema pela classe `.dark` no <html> (Tailwind v4
  // @custom-variant dark), não por data-theme como o LM Hub.
  const read = () =>
    (document.documentElement.classList.contains('dark') ? 'dark' : 'light')
  const [theme, setTheme] = useState<'light' | 'dark'>(read)
  useEffect(() => {
    const obs = new MutationObserver(() => setTheme(read()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return theme
}

function EditorInterno({
  pageId, initialContent, editable = true, smallText = false, onDirtyChange, colab,
}: NotionEditorProps & { colab?: ColabEditor }) {
  const { call } = useDashCtx()
  const { data: members = [] } = useMembers()
  const { data: space } = useSpace()
  const uploadFile = useUploadFile()
  const appTheme = useAppTheme()
  const saveContent = useSavePageContent()
  const syncLinks = useSyncPageLinks()
  const [status, setStatus] = useState<'salvo' | 'salvando' | 'erro'>('salvo')

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSaved = useRef<string>('')
  const sujo = useRef(false)

  const initial = useMemo(() => {
    const c = Array.isArray(initialContent) ? initialContent : []
    return c.length > 0 ? (c as PartialBlock[]) : undefined
  }, [initialContent])

  const editor = useCreateBlockNote({
    schema: notionSchema,
    dictionary: pt,
    ...(colab
      ? {
          collaboration: {
            fragment: colab.fragment,
            user: colab.user,
            provider: { awareness: colab.awareness },
            showCursorLabels: 'activity' as const,
          },
        }
      : { initialContent: initial }),
    uploadFile: async (file: File) => uploadFile(file),
  }, [pageId, colab])

  const flush = useCallback(async () => {
    const blocks = editor.document as unknown[]
    const serialized = JSON.stringify(blocks)
    if (serialized === lastSaved.current) {
      sujo.current = false
      setStatus('salvo')
      onDirtyChange?.(false)
      return
    }
    setStatus('salvando')
    try {
      await saveContent.mutateAsync({ id: pageId, content: blocks })
      lastSaved.current = serialized
      sujo.current = false
      setStatus('salvo')
      onDirtyChange?.(false)
      await syncLinks.mutateAsync({
        from_page_id: pageId,
        to_page_ids: extractMentionedPageIds(blocks),
      })
    } catch {
      setStatus('erro')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, pageId])

  useEffect(() => {
    lastSaved.current = JSON.stringify(editor.document)
    sujo.current = false
    setStatus('salvo')
  }, [editor])

  useEffect(() => {
    const onLeave = () => {
      if (timer.current) clearTimeout(timer.current)
      if (sujo.current || JSON.stringify(editor.document) !== lastSaved.current) void flush()
    }
    window.addEventListener('beforeunload', onLeave)
    return () => {
      window.removeEventListener('beforeunload', onLeave)
      onLeave()
    }
  }, [flush, editor])

  const handleChange = useCallback(() => {
    if (JSON.stringify(editor.document) === lastSaved.current) return
    sujo.current = true
    onDirtyChange?.(true)
    setStatus('salvando')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void flush() }, AUTOSAVE_MS)
  }, [flush, onDirtyChange, editor])

  // ── Menu "@" ────────────────────────────────────────────────────────────
  const getMentionItems = useCallback(async (query: string): Promise<DefaultReactSuggestionItem[]> => {
    const items: DefaultReactSuggestionItem[] = []

    for (const m of members) {
      const nome = m.full_name ?? m.email ?? 'Sem nome'
      items.push({
        title: nome,
        subtext: m.email ?? undefined,
        icon: <AtSign size={16} />,
        group: 'Pessoas',
        onItemClick: () => {
          editor.insertInlineContent([
            { type: 'userMention', props: { userId: m.id, name: nome } },
            ' ',
          ])
        },
      })
    }

    const term = query.trim().toLowerCase()
    if (term.length >= 1) {
      const paginas = (space?.pages ?? [])
        .filter(p => !p.is_archived && p.id !== pageId && (p.title || '').toLowerCase().includes(term))
        .slice(0, 10)

      for (const p of paginas) {
        items.push({
          title: p.title || 'Sem titulo',
          icon: <FileText size={16} />,
          group: 'Paginas',
          onItemClick: () => {
            editor.insertInlineContent([
              { type: 'pageMention', props: { pageId: p.id, title: p.title || 'Sem titulo', icon: p.icon ?? '' } },
              ' ',
            ])
          },
        })
      }

      items.push({
        title: `Criar pagina "${query.trim()}"`,
        icon: <Plus size={16} />,
        group: 'Paginas',
        onItemClick: () => {
          void (async () => {
            try {
              const r = await call<{ ok: boolean; page: { id: string } }>('page_create', { title: query.trim() })
              if (r?.page?.id) {
                editor.insertInlineContent([
                  { type: 'pageMention', props: { pageId: r.page.id, title: query.trim(), icon: '' } },
                  ' ',
                ])
              }
            } catch { /* ignora */ }
          })()
        },
      })
    }

    return items
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, space, pageId, editor])

  return (
    <div className={`lm-notion-editor ${smallText ? 'lm-notion-small' : ''} relative`}>
      <BlockNoteView
        editor={editor}
        editable={editable}
        theme={appTheme}
        onChange={handleChange}
        slashMenu={false}
      >
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query: string) =>
            filterSuggestionItems(getDefaultReactSlashMenuItems(editor), query)
          }
        />
        <SuggestionMenuController triggerCharacter="@" getItems={getMentionItems} />
      </BlockNoteView>

      <div
        className={`pointer-events-none fixed bottom-4 right-6 text-[11px] transition-opacity ${
          status === 'salvo' ? 'opacity-0' : 'opacity-100'
        } ${status === 'erro' ? 'text-red-400' : 'text-lm-subtle'}`}
      >
        {status === 'salvando' ? 'Salvando...' : status === 'erro' ? 'Falha ao salvar' : 'Salvo'}
      </div>
    </div>
  )
}
