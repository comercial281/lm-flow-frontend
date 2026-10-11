// Comentários por aula — lista + envio. Estilo área de membros.

import { useState } from 'react';
import { Send, Trash2, MessageSquare } from 'lucide-react';
import EmptyState from '@/components/base/EmptyState';
import {
  useComments,
  useCreateComment,
  useDeleteComment,
  getCurrentUserRef,
} from '@/hooks/useKnowledge';
import { Button } from '@/components/ui/ds';

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

interface Props {
  lessonId: string;
  canModerate: boolean;
}

export default function CommentsSection({ lessonId, canModerate }: Props) {
  const { data: comments = [], isLoading, error, refetch } = useComments(lessonId);
  const create = useCreateComment();
  const del = useDeleteComment();
  const [body, setBody] = useState('');
  const me = getCurrentUserRef();

  async function send() {
    const text = body.trim();
    if (!text) return;
    await create.mutateAsync({ lesson_id: lessonId, body: text });
    setBody('');
  }

  return (
    <div className="mt-8 max-w-3xl">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Comentários</h3>
        <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
          {comments.length}
        </span>
      </div>

      {/* Caixa de envio */}
      <div className="flex items-end gap-2 mb-6">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send();
          }}
          placeholder="Adicione um comentário..."
          rows={2}
          className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm resize-y"
        />
        <Button
          size="sm"
          onClick={send}
          disabled={create.isPending || !body.trim()}
          className="shrink-0"
          type="button"
        >
          <Send className="h-4 w-4" /> Enviar
        </Button>
      </div>

      {/* Lista */}
      {isLoading && <p className="text-xs text-muted-foreground">Carregando...</p>}
      {!isLoading && error && (
        <EmptyState tipo="erro" tamanho="compacto" aoTentarDeNovo={() => void refetch()} />
      )}
      {!isLoading && !error && comments.length === 0 && (
        <EmptyState tamanho="compacto" title="Nenhum comentário ainda." description="Seja o primeiro." />
      )}
      <div className="space-y-4">
        {comments.map((c) => {
          const mine = c.user_ref === me;
          return (
            <div key={c.id} className="flex items-start gap-3 group">
              <span className="shrink-0 w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[11px] font-bold">
                {initials(c.author_name)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{c.author_name}</span>
                  <span className="text-[10px] text-muted-foreground">{formatWhen(c.created_at)}</span>
                </div>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words mt-0.5">
                  {c.body}
                </p>
              </div>
              {(mine || canModerate) && (
                <button
                  onClick={() => del.mutate(c.id)}
                  className="opacity-70 group-hover:opacity-100 focus-visible:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all shrink-0"
                  title="Excluir comentário"
                  type="button"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
