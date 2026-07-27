// Anexos de uma aula (PDF/arquivos). Aluno baixa; admin sobe/remove.

import { useRef } from 'react';
import { Paperclip, FileText, Download, Trash2, Loader2, Plus } from 'lucide-react';
import {
  useAttachments,
  useUploadAttachment,
  useDeleteAttachment,
} from '@/hooks/useKnowledge';
import { formatBytes } from './_lib';

interface Props {
  lessonId: string;
  canEdit: boolean;
}

export default function LessonAttachments({ lessonId, canEdit }: Props) {
  const { data: attachments = [] } = useAttachments(lessonId);
  const upload = useUploadAttachment();
  const del = useDeleteAttachment();
  const inputRef = useRef<HTMLInputElement>(null);

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
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Paperclip size={15} /> Anexos
        </h3>
        {canEdit && (
          <>
            <input ref={inputRef} type="file" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} className="hidden" />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={upload.isPending}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-lg border border-border hover:border-primary/40 disabled:opacity-50"
            >
              {upload.isPending ? (
                <><Loader2 size={12} className="animate-spin" /> Enviando...</>
              ) : (
                <><Plus size={12} /> Anexo</>
              )}
            </button>
          </>
        )}
      </div>

      {attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum anexo nesta aula.</p>
      ) : (
        <div className="space-y-2">
          {attachments.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-lg border border-border bg-card/50 px-3 py-2">
              <div className="w-9 h-9 shrink-0 rounded-md bg-red-500/15 text-red-500 flex items-center justify-center">
                <FileText size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{a.name}</p>
                {a.size_bytes > 0 && <p className="text-[10px] text-muted-foreground">{formatBytes(a.size_bytes)}</p>}
              </div>
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-muted-foreground hover:text-primary rounded-md"
                title="Baixar"
                download
              >
                <Download size={15} />
              </a>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => del.mutate(a.id)}
                  className="p-1.5 text-muted-foreground hover:text-red-400 rounded-md"
                  title="Remover anexo"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
