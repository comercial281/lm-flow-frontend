import { useEffect, useState } from 'react';
import { X, MessageCircle, Send } from 'lucide-react';
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
    // Continua sendo a caixinha do navegador de propósito: o substituto
    // (useConfirmacao) é um Dialog, e este componente já É o conteúdo de um.
    //
    // Dialog dentro de Dialog mexe com armadilha de foco e com empilhamento, e
    // isso não se confere lendo código: precisa de navegador. Numa ação que
    // apaga dado de cliente pagante, confirmação quebrada é pior que
    // confirmação feia.
    if (!confirm('Remover esta nota?')) return;

    try {
      await notesService.delete(contactId, noteId);
      setNotes(notes.filter(n => n.id !== noteId));
    } catch (error) {
      console.error('Erro ao deletar nota:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <MessageCircle size={20} className="text-purple-600" />
            <div>
              <h2 className="text-xl font-semibold">Histórico de Notas</h2>
              {contactName && <p className="text-sm text-gray-500">{contactName}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nenhuma nota registrada ainda
            </div>
          ) : (
            notes.map(note => (
              <div key={note.id} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{note.user?.name || 'Anônimo'}</span>
                      <span className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(note.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                    {note.user?.email && (
                      <p className="text-xs text-gray-400">{note.user.email}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="p-1 hover:bg-red-100 text-red-500 rounded transition-colors"
                    title="Remover nota"
                  >
                    <X size={16} />
                  </button>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <div className="border-t p-6 bg-gray-50">
          <div className="flex gap-3">
            <input
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
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
            />
            <button
              onClick={handleAddNote}
              disabled={saving || !newContent.trim()}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
