// Aba Docs — lista de docs da categoria + editor markdown (textarea simples).
// Links: digitar `[texto](https://...)` no markdown. Render via react-markdown.

import { useState } from 'react';
import { formatDateBR } from '@/utils/dateUtils';
import { Plus, Pin, PinOff, Pencil, Trash2, ArrowLeft, X, Save } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  useDocs,
  useCreateDoc,
  useUpdateDoc,
  useDeleteDoc,
  type KnowledgeDoc,
} from '@/hooks/useKnowledge';

import { useConfirmacao } from '@/hooks/useConfirmacao';
import { Card, Button } from '@/components/ui/ds';
interface Props {
  categoryId: string | null;
  canEdit: boolean;
}

export default function DocsTab({ categoryId, canEdit }: Props) {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const { data: docs = [], isLoading } = useDocs(categoryId);
  const createMut = useCreateDoc();
  const updateMut = useUpdateDoc();
  const deleteMut = useDeleteDoc();

  const [selected, setSelected] = useState<KnowledgeDoc | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [creating, setCreating] = useState(false);

  if (!categoryId) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Selecione uma categoria a esquerda para ver os docs.
      </div>
    );
  }

  if (selected) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border">
          <button
            onClick={() => {
              setSelected(null);
              setEditing(false);
            }}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            type="button"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar
          </button>
          <div className="flex items-center gap-2">
            {canEdit && !editing && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateMut.mutate({ id: selected.id, pinned: !selected.pinned })}
                  type="button"
                >
                  {selected.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  {selected.pinned ? 'Desafixar' : 'Fixar'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(true);
                    setDraftTitle(selected.titulo);
                    setDraftBody(selected.content_md);
                  }}
                  type="button"
                >
                  <Pencil className="h-4 w-4" /> Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (await confirmar({
                      titulo: 'Excluir documento',
                      descricao: <>Excluir <strong>{selected.titulo}</strong>?</>,
                      rotuloDaAcao: 'Excluir',
                      destrutivo: true,
                    })) {
                      deleteMut.mutate(selected.id);
                      setSelected(null);
                    }
                  }}
                  className="text-destructive hover:text-destructive"
                  type="button"
                >
                  <Trash2 className="h-4 w-4" /> Excluir
                </Button>
              </>
            )}
            {editing && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(false)}
                  type="button"
                >
                  <X className="h-4 w-4" /> Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={async () => {
                    await updateMut.mutateAsync({
                      id: selected.id,
                      titulo: draftTitle,
                      content_md: draftBody,
                    });
                    setSelected({ ...selected, titulo: draftTitle, content_md: draftBody });
                    setEditing(false);
                  }}
                  type="button"
                >
                  <Save className="h-4 w-4" /> Salvar
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
          {editing ? (
            <div className="space-y-4">
              <input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="Titulo"
                className="w-full bg-transparent text-2xl font-bold border-b border-border focus:border-primary outline-none pb-2"
              />
              <p className="text-[11px] text-muted-foreground">
                Markdown suportado: <code>**negrito**</code>, <code>*italico*</code>,{' '}
                <code>### Heading</code>, <code>- item</code>,{' '}
                <code>[texto](https://link)</code>
              </p>
              <textarea
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                placeholder="Escreva o conteúdo em markdown"
                rows={20}
                className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm font-mono resize-y min-h-[400px]"
              />
            </div>
          ) : (
            <article className="prose prose-sm max-w-none dark:prose-invert">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                {selected.pinned && <Pin className="h-4 w-4 text-primary" />}
                {selected.titulo}
              </h2>
              <div className="text-sm leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {selected.content_md || '_Sem conteúdo._'}
                </ReactMarkdown>
              </div>
            </article>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <span className="text-xs text-muted-foreground">
          {docs.length} doc{docs.length === 1 ? '' : 's'}
        </span>
        {canEdit && (
          <Button
            size="sm"
            onClick={() => {
              setCreating(true);
              setDraftTitle('');
              setDraftBody('');
            }}
            type="button"
          >
            <Plus className="h-4 w-4" /> Novo doc
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading && <p className="text-xs text-muted-foreground">Carregando...</p>}
        {!isLoading && docs.length === 0 && !creating && (
          <p className="text-xs text-muted-foreground text-center py-12">
            Nenhum doc nesta categoria ainda.
          </p>
        )}
        {creating && (
          <Card className="mb-6 gap-3 p-4">
            <input
              autoFocus
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="Titulo do doc"
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Markdown suportado: <code>**negrito**</code>, <code>*italico*</code>,{' '}
              <code>### Heading</code>, <code>[texto](https://link)</code>
            </p>
            <textarea
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              placeholder="Conteúdo em markdown"
              rows={10}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm font-mono resize-y"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreating(false)}
                type="button"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  if (!draftTitle.trim()) return;
                  await createMut.mutateAsync({
                    category_id: categoryId,
                    titulo: draftTitle.trim(),
                    content_md: draftBody,
                  });
                  setCreating(false);
                }}
                type="button"
              >
                Criar
              </Button>
            </div>
          </Card>
        )}
        <div className="space-y-2 max-w-3xl">
          {docs.map((doc) => (
            <button
              key={doc.id}
              onClick={() => setSelected(doc)}
              className="group block w-full rounded-xl text-left"
              type="button"
            >
              <Card className="gap-0 p-4 transition-colors group-hover:border-primary/30">
              <div className="flex items-start gap-2">
                {doc.pinned && <Pin className="h-3.5 w-3.5 text-primary mt-1 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{doc.titulo}</p>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">
                    {doc.content_md.replace(/[#*_>`-]/g, '').slice(0, 160) || '— sem texto —'}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 mt-2">
                    Atualizado em {formatDateBR(doc.updated_at)}
                  </p>
                </div>
              </div>
            </Card>
            </button>
          ))}
        </div>
      </div>
    </div>
      {dialogoDeConfirmacao}
    </>
  );
}
