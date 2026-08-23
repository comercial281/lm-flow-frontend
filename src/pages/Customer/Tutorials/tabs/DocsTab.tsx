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

interface Props {
  categoryId: string | null;
  canEdit: boolean;
}

export default function DocsTab({ categoryId, canEdit }: Props) {
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
            <ArrowLeft size={14} /> Voltar
          </button>
          <div className="flex items-center gap-2">
            {canEdit && !editing && (
              <>
                <button
                  onClick={() => updateMut.mutate({ id: selected.id, pinned: !selected.pinned })}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-foreground border border-border hover:border-primary/40 rounded-lg transition-colors"
                  type="button"
                >
                  {selected.pinned ? <PinOff size={12} /> : <Pin size={12} />}
                  {selected.pinned ? 'Desafixar' : 'Fixar'}
                </button>
                <button
                  onClick={() => {
                    setEditing(true);
                    setDraftTitle(selected.titulo);
                    setDraftBody(selected.content_md);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-foreground border border-border hover:border-primary/40 rounded-lg transition-colors"
                  type="button"
                >
                  <Pencil size={12} /> Editar
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Excluir "${selected.titulo}"?`)) {
                      deleteMut.mutate(selected.id);
                      setSelected(null);
                    }
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-500 border border-red-500/30 hover:bg-red-500/10 rounded-lg transition-colors"
                  type="button"
                >
                  <Trash2 size={12} /> Excluir
                </button>
              </>
            )}
            {editing && (
              <>
                <button
                  onClick={() => setEditing(false)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-muted-foreground border border-border hover:text-foreground rounded-lg transition-colors"
                  type="button"
                >
                  <X size={12} /> Cancelar
                </button>
                <button
                  onClick={async () => {
                    await updateMut.mutateAsync({
                      id: selected.id,
                      titulo: draftTitle,
                      content_md: draftBody,
                    });
                    setSelected({ ...selected, titulo: draftTitle, content_md: draftBody });
                    setEditing(false);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-primary-foreground bg-primary hover:opacity-90 rounded-lg transition-colors"
                  type="button"
                >
                  <Save size={12} /> Salvar
                </button>
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
                placeholder="Escreva o conteudo em markdown"
                rows={20}
                className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm font-mono resize-y min-h-[400px]"
              />
            </div>
          ) : (
            <article className="prose prose-sm max-w-none dark:prose-invert">
              <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
                {selected.pinned && <Pin size={16} className="text-primary" />}
                {selected.titulo}
              </h1>
              <div className="text-sm leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {selected.content_md || '_Sem conteudo._'}
                </ReactMarkdown>
              </div>
            </article>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <span className="text-xs text-muted-foreground">
          {docs.length} doc{docs.length === 1 ? '' : 's'}
        </span>
        {canEdit && (
          <button
            onClick={() => {
              setCreating(true);
              setDraftTitle('');
              setDraftBody('');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-primary-foreground bg-primary hover:opacity-90 rounded-lg transition-colors"
            type="button"
          >
            <Plus size={12} /> Novo doc
          </button>
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
          <div className="mb-6 bg-card border border-border rounded-xl p-4 space-y-3">
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
              placeholder="Conteudo em markdown"
              rows={10}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm font-mono resize-y"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCreating(false)}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                type="button"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!draftTitle.trim()) return;
                  await createMut.mutateAsync({
                    category_id: categoryId,
                    titulo: draftTitle.trim(),
                    content_md: draftBody,
                  });
                  setCreating(false);
                }}
                className="px-3 py-1.5 text-xs text-primary-foreground bg-primary hover:opacity-90 rounded-lg"
                type="button"
              >
                Criar
              </button>
            </div>
          </div>
        )}
        <div className="space-y-2 max-w-3xl">
          {docs.map((doc) => (
            <button
              key={doc.id}
              onClick={() => setSelected(doc)}
              className="w-full text-left bg-card border border-border hover:border-primary/30 rounded-xl p-4 transition-colors"
              type="button"
            >
              <div className="flex items-start gap-2">
                {doc.pinned && <Pin size={12} className="text-primary mt-1 shrink-0" />}
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
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
