import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
} from '@evoapi/design-system';
import {
  Rocket, Search, Plus, Edit2, Trash2, Type, Mic, Image as ImageIcon,
  Video, FileText, Pause,
} from 'lucide-react';
import EmptyState from '@/components/base/EmptyState';
import MessageFunnelEditor from '@/components/messageFunnels/MessageFunnelEditor';
import { messageFunnelsService } from '@/services/messageFunnels/messageFunnelsService';
import type { MessageFunnel, FunnelItemKind } from '@/types/messageFunnels';

const KIND_ICONS: Record<FunnelItemKind, typeof Type> = {
  text: Type, audio: Mic, image: ImageIcon, video: Video, document: FileText,
};
const KIND_COLORS: Record<FunnelItemKind, string> = {
  text: '#7c3aed', audio: '#00a884', image: '#3b82f6', video: '#f43f5e', document: '#f97316',
};

export default function MessageFunnels() {
  const [funnels, setFunnels] = useState<MessageFunnel[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<MessageFunnel | null>(null);
  const [toDelete, setToDelete] = useState<MessageFunnel | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await messageFunnelsService.list();
      setFunnels(list);
    } catch {
      toast.error('Erro ao carregar funis');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = search.trim()
    ? funnels.filter(f =>
        f.name.toLowerCase().includes(search.toLowerCase())
        || (f.description ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : funnels;

  const handleNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const handleEdit = (f: MessageFunnel) => {
    setEditing(f);
    setEditorOpen(true);
  };

  const handleDelete = (f: MessageFunnel) => {
    setToDelete(f);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await messageFunnelsService.destroy(toDelete.id);
      toast.success('Funil removido');
      await load();
      setToDelete(null);
    } catch {
      toast.error('Erro ao remover funil');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Rocket className="text-primary" size={22} />
            Funis de Mensagem
            <span className="text-sm font-normal text-muted-foreground">({filtered.length})</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sequências multi-step (texto + áudio + foto + vídeo) que o atendente dispara com 1 clique no chat.
          </p>
        </div>
        <Button onClick={handleNew} className="gap-2">
          <Plus size={16} /> Novo Funil
        </Button>
      </div>

      {/* Busca */}
      <div className="relative mb-4 max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome ou descrição..."
          className="pl-9"
        />
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Rocket}
            title="Nenhum funil de mensagem"
            description="Crie funis pra disparar sequências (texto + áudio + mídia) no chat com 1 clique."
            action={{ label: 'Novo Funil', onClick: handleNew }}
            className="h-full"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(funnel => (
              <FunnelCard
                key={funnel.id}
                funnel={funnel}
                onEdit={() => handleEdit(funnel)}
                onDelete={() => handleDelete(funnel)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Editor */}
      <MessageFunnelEditor
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setEditing(null); }}
        funnel={editing ?? undefined}
        onSaved={() => load()}
      />

      {/* Delete confirm */}
      <Dialog open={!!toDelete} onOpenChange={open => !open && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir funil</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>{toDelete?.name}</strong>? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────

interface FunnelCardProps {
  funnel: MessageFunnel;
  onEdit: () => void;
  onDelete: () => void;
}

function FunnelCard({ funnel, onEdit, onDelete }: FunnelCardProps) {
  return (
    <div className="border border-border rounded-lg p-4 hover:border-primary/40 transition-colors flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Rocket size={12} className="text-primary shrink-0" />
            <span className="font-semibold text-sm truncate">{funnel.name}</span>
            {!funnel.active && (
              <span className="text-xs text-muted-foreground inline-flex items-center gap-0.5">
                <Pause size={10} /> pausado
              </span>
            )}
          </div>
          {funnel.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{funnel.description}</p>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} aria-label="Editar">
            <Edit2 size={13} />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete} aria-label="Excluir">
            <Trash2 size={13} />
          </Button>
        </div>
      </div>

      {/* Items preview */}
      <div className="flex items-center gap-1 flex-wrap">
        {funnel.items.slice(0, 10).map(item => {
          const Icon = KIND_ICONS[item.kind];
          const color = KIND_COLORS[item.kind];
          return (
            <span
              key={item.id}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs"
              style={{ background: color + '15', color }}
              title={item.text_content?.slice(0, 60) ?? item.media_filename ?? item.kind}
            >
              <Icon size={10} />
              {item.delay_seconds > 0 && <span>·{item.delay_seconds}s</span>}
            </span>
          );
        })}
        {funnel.items.length > 10 && (
          <span className="text-xs text-muted-foreground">+{funnel.items.length - 10}</span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
        <span>{funnel.items.length} {funnel.items.length === 1 ? 'item' : 'items'}</span>
        {funnel.usage_count > 0 && <span>usado {funnel.usage_count}×</span>}
      </div>
    </div>
  );
}
