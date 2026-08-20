// LM Notion — schema do editor: blocos padrao do BlockNote + inline content
// customizado para mencao de pagina (@pagina) e de pessoa (@pessoa).

import { BlockNoteSchema, defaultInlineContentSpecs } from '@blocknote/core'
import { createReactInlineContentSpec } from '@blocknote/react'
import { FileText, AtSign } from 'lucide-react'

/** Mencao de pagina. Vira link interno e alimenta os backlinks. */
export const PageMention = createReactInlineContentSpec(
  {
    type: 'pageMention',
    propSchema: {
      pageId: { default: '' },
      title: { default: 'Sem titulo' },
      icon: { default: '' },
    },
    content: 'none',
  },
  {
    render: (props) => (
      <span
        data-page-mention={props.inlineContent.props.pageId}
        className="inline-flex items-center gap-1 px-1 rounded cursor-pointer align-baseline
                   text-lm-primary underline decoration-white/25 underline-offset-2
                   hover:bg-violet-500/15"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          window.dispatchEvent(
            new CustomEvent('lm-notion:open-page', {
              detail: { pageId: props.inlineContent.props.pageId },
            }),
          )
        }}
      >
        <FileText size={13} className="opacity-70 shrink-0" />
        {props.inlineContent.props.title || 'Sem titulo'}
      </span>
    ),
  },
)

/** Mencao de pessoa. */
export const UserMention = createReactInlineContentSpec(
  {
    type: 'userMention',
    propSchema: {
      userId: { default: '' },
      name: { default: '' },
    },
    content: 'none',
  },
  {
    render: (props) => (
      <span
        data-user-mention={props.inlineContent.props.userId}
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded align-baseline
                   text-xs font-medium bg-violet-500/20 text-violet-200"
      >
        <AtSign size={11} className="shrink-0" />
        {props.inlineContent.props.name}
      </span>
    ),
  },
)

export const notionSchema = BlockNoteSchema.create({
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    pageMention: PageMention,
    userMention: UserMention,
  },
})

export type NotionEditorType = typeof notionSchema.BlockNoteEditor

/** Varre o documento e devolve os page_ids mencionados — usado pra sincronizar backlinks. */
export function extractMentionedPageIds(blocks: unknown[]): string[] {
  const ids: string[] = []
  const walk = (nodes: unknown[]) => {
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue
      const b = node as { content?: unknown; children?: unknown[] }
      if (Array.isArray(b.content)) {
        for (const inline of b.content) {
          const ic = inline as { type?: string; props?: { pageId?: string } }
          if (ic?.type === 'pageMention' && ic.props?.pageId) ids.push(ic.props.pageId)
        }
      }
      if (Array.isArray(b.children)) walk(b.children)
    }
  }
  walk(blocks)
  return [...new Set(ids)]
}
