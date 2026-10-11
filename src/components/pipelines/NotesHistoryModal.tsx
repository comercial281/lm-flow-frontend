import { useEffect, useState } from 'react';
import { X, MessageCircle, Send } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@/components/ui/ds';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { notesService, Note } from '@/services/notes/notesService';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NotesHistoryModalProps {
  isOpen: boolean;
  contactId: string;
  contactName?: string;
  onClose: () => void;
}

export function NotesHistoryModal({ isOpen, contactId, contactName, onClose }: NotesHistoryModalProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [saving, setSaving] = useState(false);
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();

  useEffect(() => {
    if (isOpen && contactId) {
      loadNotes();
    }
  }, [isOpen, contactId]);

  const loadNotes = async () => {
    setLoading(true);
    try {
      const data = await notesService.getByContact(contactId);
      setNotes(data);
    } catch (error) {
      console.error('Erro ao carregar notas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newContent.trim()) return;

    setSaving(true);
    try {
      const newNote = await notesService.create(contactId, { content: newContent });
      setNotes([newNote, ...notes]);
      setNewContent('');
    } catch (error) {
      console.error('Erro ao criar nota:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!(await confirmar({ titulo: 'Remover esta nota?', rotuloDaAcao: 'Remover', destrutivo: true }))) return;

    try {
      await notesService.delete(contactId, noteId);
      setNotes(notes.filter(n => n.id !== noteId));
    } catch (error) {
      console.error('Erro ao deletar nota:', error);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={aberta => { if (!aberta) onClose(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" aria-hidden="true" />
              Histórico de Notas
            </DialogTitle>
            {contactName && <DialogDescription>{contactName}</DialogDescription>}
          </DialogHeader>

          <div className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : notes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma nota registrada ainda
              </div>
            ) : (
              notes.map(note => (
                <div key={note.id} className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{note.user?.name || 'Anônimo'}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(note.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                      {note.user?.email && (
                        <p className="text-xs text-muted-foreground">{note.user.email}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteNote(note.id)}
                      className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Remover nota"
                      title="Remover nota"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <div className="flex gap-3 sm:flex-1">
              <Input
                type="text"
                placeholder="Adicionar uma nota..."
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddNote();
                  }
                }}
                disabled={saving}
                className="flex-1"
              />
              <Button
                size="icon"
                onClick={handleAddNote}
                disabled={saving || !newContent.trim()}
                aria-label="Adicionar nota"
                title="Adicionar nota"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {dialogoDeConfirmacao}
    </>
  );
}
