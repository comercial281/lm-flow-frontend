// DashNotion — comentarios da pagina (respostas de 1 nivel). Duplicata adaptada
// de _internal/page/CommentsPanel.tsx. A edge share-notion tem comment_create,
// comment_resolve, comment_update e comment_delete. Sem auth: editar/excluir
// ficam liberados pra quem esta no dash (o backend valida escopo por cliente).

import { useMemo, useState } from 'react'
import { CheckCircle2, CornerDownRight, RotateCcw } from 'lucide-react'
import type { NotionComment } from '@/features/espaco/internal/types'
import { relativeTime } from '@/features/espaco/internal/page/relativeTime'
import {
  useComments, useCreateComment, useDeleteComment, useMembers, useUpdateComment,
} from '../useDashNotion'

type Member = { id: string; full_name: string | null; email: string | null; avatar_url: string | null }

function initials(m: Member | undefined): string {
  const base = m?.full_name || m?.email || '?'
  return base.trim().slice(0, 2).toUpperCase()
}

function Avatar({ member }: { member: Member | undefined }) {
  if (member?.avatar_url) {
    return <img src={member.avatar_url} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
  }
  return (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lm-card2 text-[10px] text-lm-muted">
      {initials(member)}
    </div>
  )
}

interface CommentsPanelProps { pageId: string }

export default function CommentsPanel({ pageId }: CommentsPanelProps) {
  const { data: comments = [] } = useComments(pageId)
  const { data: members = [] } = useMembers()

  const createComment = useCreateComment()
  const updateComment = useUpdateComment()
  const deleteComment = useDeleteComment()

  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')

  const memberById = useMemo(() => new Map(members.map(m => [m.id, m as Member])), [members])

  const { roots, repliesByParent } = useMemo(() => {
    const roots: NotionComment[] = []
    const repliesByParent = new Map<string, NotionComment[]>()
    for (const c of comments) {
      if (c.parent_comment_id) {
        const list = repliesByParent.get(c.parent_comment_id) ?? []
        list.push(c)
        repliesByParent.set(c.parent_comment_id, list)
      } else {
        roots.push(c)
      }
    }
    return { roots, repliesByParent }
  }, [comments])

  function submitRoot() {
    const body = draft.trim()
    if (!body) return
    createComment.mutate({ page_id: pageId, body })
    setDraft('')
  }

  function submitReply(parentId: string) {
    const body = replyDraft.trim()
    if (!body) return
    createComment.mutate({ page_id: pageId, body, parent_comment_id: parentId })
    setReplyDraft('')
    setReplyTo(null)
  }

  function saveEdit(c: NotionComment) {
    const body = editDraft.trim()
    if (!body) return
    updateComment.mutate({ id: c.id, page_id: pageId, body })
    setEditingId(null)
    setEditDraft('')
  }

  function renderComment(c: NotionComment, isReply: boolean) {
    const member = c.member_id ? memberById.get(c.member_id) : undefined
    const editing = editingId === c.id

    return (
      <div key={c.id} className={isReply ? 'mt-2 pl-8' : 'mt-4'}>
        <div className="flex gap-2">
          <Avatar member={member} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm text-lm-primary">{member?.full_name ?? member?.email ?? 'Alguem'}</span>
              <span className="text-xs text-lm-subtle">{relativeTime(c.created_at)}</span>
              {c.is_resolved && <span className="text-xs text-lm-success">Resolvido</span>}
            </div>

            {editing ? (
              <div className="mt-1">
                <textarea
                  value={editDraft}
                  onChange={e => setEditDraft(e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-lm-sm border border-lm-border bg-lm-bg px-2 py-1.5 text-sm text-lm-primary outline-none focus:border-lm-neon"
                />
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() => saveEdit(c)}
                    className="rounded-lm-sm bg-lm-neon px-2 py-1 text-xs text-lm-inverse"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingId(null); setEditDraft('') }}
                    className="rounded-lm-sm px-2 py-1 text-xs text-lm-subtle hover:text-lm-primary"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-lm-muted">{c.body}</p>
            )}

            {!editing && (
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-lm-subtle">
                {!isReply && (
                  <button
                    type="button"
                    onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyDraft('') }}
                    className="inline-flex items-center gap-1 hover:text-lm-primary"
                  >
                    <CornerDownRight className="h-3 w-3" />
                    Responder
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setEditingId(c.id); setEditDraft(c.body) }}
                  className="hover:text-lm-primary"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => deleteComment.mutate({ id: c.id, page_id: pageId })}
                  className="hover:text-lm-danger"
                >
                  Excluir
                </button>
                <button
                  type="button"
                  onClick={() => updateComment.mutate({ id: c.id, page_id: pageId, is_resolved: !c.is_resolved })}
                  className="inline-flex items-center gap-1 hover:text-lm-primary"
                >
                  {c.is_resolved
                    ? <><RotateCcw className="h-3 w-3" />Reabrir</>
                    : <><CheckCircle2 className="h-3 w-3" />Resolver</>}
                </button>
              </div>
            )}

            {replyTo === c.id && (
              <div className="mt-2">
                <textarea
                  value={replyDraft}
                  onChange={e => setReplyDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submitReply(c.id) }
                  }}
                  rows={2}
                  autoFocus
                  placeholder="Responder..."
                  className="w-full resize-none rounded-lm-sm border border-lm-border bg-lm-bg px-2 py-1.5 text-sm text-lm-primary outline-none placeholder:text-lm-subtle focus:border-lm-neon"
                />
                <button
                  type="button"
                  onClick={() => submitReply(c.id)}
                  disabled={!replyDraft.trim()}
                  className="mt-1 rounded-lm-sm bg-lm-neon px-2 py-1 text-xs text-lm-inverse disabled:opacity-50"
                >
                  Responder
                </button>
              </div>
            )}
          </div>
        </div>

        {!isReply && (repliesByParent.get(c.id) ?? []).map(r => renderComment(r, true))}
      </div>
    )
  }

  return (
    <section className="mt-10 border-t border-lm-border pt-6">
      <h3 className="text-sm font-medium text-heading">Comentarios</h3>

      {roots.length === 0 && <p className="mt-3 text-sm text-lm-subtle">Nenhum comentario ainda.</p>}

      {roots.map(c => renderComment(c, false))}

      <div className="mt-6">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submitRoot() }
          }}
          rows={2}
          placeholder="Adicionar um comentario..."
          className="w-full resize-none rounded-lm-sm border border-lm-border bg-lm-bg px-3 py-2 text-sm text-lm-primary outline-none placeholder:text-lm-subtle focus:border-lm-neon"
        />
        <button
          type="button"
          onClick={submitRoot}
          disabled={!draft.trim()}
          className="mt-2 rounded-lm-sm bg-lm-neon px-3 py-1.5 text-sm text-lm-inverse disabled:opacity-50"
        >
          Comentar
        </button>
      </div>
    </section>
  )
}
