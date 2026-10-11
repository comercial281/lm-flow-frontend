// Materiais de apoio de uma aula: arquivo (PDF/img), link externo ou nota de
// texto. Aluno baixa/abre/lê; admin sobe, cola link, escreve texto e remove.

import { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Paperclip, FileText, Download, Trash2, Loader2, Plus, Link2, Type, ExternalLink, X,
} from 'lucide-react';
import {
  useAttachments,
  useUploadAttachment,
  useAddLinkAttachment,
  useAddTextAttachment,
  useDeleteAttachment,
  type KnowledgeAttachment,
} from '@/hooks/useKnowledge';
import { formatBytes } from './_lib';
import { toast } from 'sonner';
import { Button } from '@/components/ui/ds';

interface Props {
  lessonId: string;
  canEdit: boolean;
}

export default function LessonAttachments({ lessonId, canEdit }: Props) {
  const { data: attachments = [] } = useAttachments(lessonId);
  const upload = useUploadAttachment();
  const del = useDeleteAttachment();
  const inputRef = useRef<HTMLInputElement>(null);

  // Qual mini-form está aberto: 'link' | 'text' | null.
  const [adding, setAdding] = useState<'link' | 'text' | null>(null);

  async function handleFile(file: File | null) {
    if (!file) return;
    try {
      await upload.mutateAsync({ lesson_id: lessonId, file });
    } catch {
      /* toast do hook */
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  if (attachments.length === 0 && !canEdit) return null;

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Paperclip className="h-4 w-4" /> Materiais de apoio
        </h3>
        {canEdit && (
          <div className="flex items-center gap-1.5">
            <input ref={inputRef} type="file" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} className="hidden" />
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={upload.isPending}
            >
              {upload.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</> : <><Plus className="h-4 w-4" /> Arquivo</>}
            </Button>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setAdding(adding === 'link' ? null : 'link')}
              aria-expanded={adding === 'link'}
              className={adding === 'link' ? 'border-primary/40 text-primary' : undefined}
            >
              <Link2 className="h-4 w-4" /> Link
            </Button>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setAdding(adding === 'text' ? null : 'text')}
              aria-expanded={adding === 'text'}
              className={adding === 'text' ? 'border-primary/40 text-primary' : undefined}
            >
              <Type className="h-4 w-4" /> Texto
            </Button>
          </div>
        )}
      </div>

      {canEdit && adding === 'link' && (
        <LinkForm lessonId={lessonId} onDone={() => setAdding(null)} />
      )}
      {canEdit && adding === 'text' && (
        <TextForm lessonId={lessonId} onDone={() => setAdding(null)} />
      )}

      {attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum material nesta aula ainda.</p>
      ) : (
        <div className="space-y-2">
          {attachments.map((a) => (
            <AttachmentRow key={a.id} a={a} canEdit={canEdit} onDelete={() => del.mutate(a.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Uma linha de material, por tipo ──────────────────────────────────────────
function AttachmentRow({ a, canEdit, onDelete }: { a: KnowledgeAttachment; canEdit: boolean; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const isLink = a.kind === 'link';
  const isText = a.kind === 'text';

  const icon = isLink ? <Link2 className="h-4 w-4" /> : isText ? <Type className="h-4 w-4" /> : <FileText className="h-4 w-4" />;
  const iconWrap = isLink
    ? 'bg-sky-500/15 text-sky-500'
    : isText
      ? 'bg-violet-500/15 text-violet-500'
      : 'bg-red-500/15 text-red-500';

  return (
    <div className="rounded-lg border border-border bg-card/50">
      <div className="flex items-center gap-3 px-3 py-2">
        <div className={`w-9 h-9 shrink-0 rounded-md flex items-center justify-center ${iconWrap}`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{a.name}</p>
          {a.kind === 'file' && a.size_bytes > 0 && (
            <p className="text-[10px] text-muted-foreground">{formatBytes(a.size_bytes)}</p>
          )}
          {isLink && <p className="text-[10px] text-muted-foreground truncate">{a.url}</p>}
        </div>

        {isText ? (
          <Button variant="outline" size="sm" type="button" onClick={() => setOpen((v) => !v)}>
            {open ? 'Fechar' : 'Ler'}
          </Button>
        ) : isLink ? (
          <a href={a.url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-muted-foreground hover:text-primary rounded-md" title="Abrir link">
            <ExternalLink className="h-4 w-4" />
          </a>
        ) : (
          <a href={a.url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-muted-foreground hover:text-primary rounded-md" title="Baixar" download>
            <Download className="h-4 w-4" />
          </a>
        )}

        {canEdit && (
          <button type="button" onClick={onDelete} className="p-1.5 text-muted-foreground hover:text-red-400 rounded-md" title="Remover">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {isText && open && a.content && (
        <div className="border-t border-border px-3 py-3">
          <article className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{a.content}</ReactMarkdown>
          </article>
        </div>
      )}
    </div>
  );
}

// ── Mini-form: adicionar link ────────────────────────────────────────────────
function LinkForm({ lessonId, onDone }: { lessonId: string; onDone: () => void }) {
  const add = useAddLinkAttachment();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  async function submit() {
    if (!url.trim()) { toast.error('Cole a URL do link.'); return; }
    await add.mutateAsync({ lesson_id: lessonId, name, url });
    onDone();
  }

  return (
    <div className="mb-3 rounded-lg border border-border bg-background/60 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" /> Novo link</p>
        <button type="button" onClick={onDone} aria-label="Fechar" title="Fechar" className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
      </div>
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome (ex.: Planilha de metas)" className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs" />
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs" />
      <div className="flex justify-end">
        <Button size="sm" type="button" onClick={submit} disabled={add.isPending}>
          {add.isPending ? 'Salvando...' : 'Adicionar'}
        </Button>
      </div>
    </div>
  );
}

// ── Mini-form: adicionar nota de texto (markdown) ────────────────────────────
function TextForm({ lessonId, onDone }: { lessonId: string; onDone: () => void }) {
  const add = useAddTextAttachment();
  const [name, setName] = useState('');
  const [content, setContent] = useState('');

  async function submit() {
    if (!content.trim()) { toast.error('Escreva o texto.'); return; }
    await add.mutateAsync({ lesson_id: lessonId, name, content });
    onDone();
  }

  return (
    <div className="mb-3 rounded-lg border border-border bg-background/60 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold flex items-center gap-1.5"><Type className="h-3.5 w-3.5" /> Nova nota de texto</p>
        <button type="button" onClick={onDone} aria-label="Fechar" title="Fechar" className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
      </div>
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Título (ex.: Passo a passo)" className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs" />
      <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Escreva aqui (aceita markdown: **negrito**, listas, links)" rows={5} className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs resize-y" />
      <div className="flex justify-end">
        <Button size="sm" type="button" onClick={submit} disabled={add.isPending}>
          {add.isPending ? 'Salvando...' : 'Adicionar'}
        </Button>
      </div>
    </div>
  );
}
