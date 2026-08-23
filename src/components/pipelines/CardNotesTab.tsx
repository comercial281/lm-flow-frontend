import { useEffect, useState, useCallback } from 'react';
import { Button, Textarea } from '@/components/ui/ds';
import { Loader2, Send, Trash2, MessageSquareText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { notesService, Note } from '@/services/notes/notesService';

interface CardNotesTabProps {
  contactId: string | null;
}

function initials(name?: string) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(p => p[0])
    .join('')
    .toUpperCase();
}

export default function CardNotesTab({ contactId }: CardNotesTabProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!contactId) return;
    setLoading(true);
    try {
      const data = await notesService.getByContact(contactId);
      setNotes(data);
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePost = useCallback(async () => {
    const text = content.trim();
    if (!text || !contactId) return;
    setSaving(true);
    try {
      const note = await notesService.create(contactId, { content: text });
      setNotes(prev => [note, ...prev]);
      setContent('');
    } catch {
      /* silent */
    } finally {
      setSaving(false);
    }
  }, [content, contactId]);

  const handleDelete = useCallback(async (noteId: string) => {
    if (!contactId) return;
    setDeletingId(noteId);
    try {
      await notesService.delete(contactId, noteId);
      setNotes(prev => prev.filter(n => n.id !== noteId));
    } catch {
      /* silent */
    } finally {
      setDeletingId(null);
    }
  }, [contactId]);

  if (!contactId) {
    return (
      <div className="text-sm text-muted-foreground py-12 text-center border border-dashed border-border rounded-lg">
        Sem contato vinculado para registrar comentários.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Composer */}
      <div className="shrink-0 space-y-2">
        <Textarea
          placeholder="Escreva um comentário e poste para a equipe..."
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={e => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              handlePost();
            }
          }}
          rows={3}
          className="text-sm resize-none"
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">Ctrl + Enter para postar</span>
          <Button size="sm" className="h-7 text-xs gap-1.5" onClick={handlePost} disabled={saving || !content.trim()}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Postar
          </Button>
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto mt-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : notes.length === 0 ? (
          <div className="text-sm text-muted-foreground py-12 text-center flex flex-col items-center gap-2">
            <MessageSquareText className="h-6 w-6 opacity-50" />
            Nenhum comentário ainda. Seja o primeiro a postar.
          </div>
        ) : (
          notes.map(note => (
            <div key={note.id} className="flex gap-2.5">
              <div className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-semibold">
                {initials(note.user?.name)}
              </div>
              <div className="flex-1 min-w-0 rounded-lg border border-border/60 bg-muted/20 p-2.5">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium truncate">{note.user?.name || 'Você'}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(note.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(note.id)}
                    disabled={deletingId === note.id}
                    className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                    title="Remover comentário"
                  >
                    {deletingId === note.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-foreground whitespace-pre-wrap break-words">{note.content}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
