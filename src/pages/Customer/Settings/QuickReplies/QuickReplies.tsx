import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
} from '@/components/ui/ds';
import { Zap } from 'lucide-react';
import EmptyState from '@/components/base/EmptyState';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { quickRepliesService } from '@/services/quickReplies/quickRepliesService';
import type { QuickReply, QuickReplyFormData } from '@/types/knowledge';

import QuickRepliesHeader from '@/components/quickReplies/QuickRepliesHeader';
import QuickRepliesTable from '@/components/quickReplies/QuickRepliesTable';
import QuickReplyModal from '@/components/quickReplies/QuickReplyModal';

type SortCol = 'title' | 'created_at' | 'usage_count';

interface State {
  items: QuickReply[];
  selectedIds: string[];
  loading: boolean;
  creating: boolean;
  deleting: boolean;
  searchQuery: string;
  sortBy: SortCol;
  sortOrder: 'asc' | 'desc';
}

const INITIAL: State = {
  items: [],
  selectedIds: [],
  loading: false,
  creating: false,
  deleting: false,
  searchQuery: '',
  sortBy: 'title',
  sortOrder: 'asc',
};

export default function QuickReplies() {
  const { can, isReady: permissionsReady } = useUserPermissions();
  const [state, setState] = useState<State>(INITIAL);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [toDelete, setToDelete] = useState<QuickReply | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<QuickReply | null>(null);

  const load = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      const response = await quickRepliesService.getQuickReplies();
      setState(prev => ({ ...prev, items: response.data ?? [], loading: false }));
    } catch {
      toast.error('Erro ao carregar respostas rápidas');
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    if (!permissionsReady) return;
    load();
  }, [permissionsReady, load]);

  const filtered = state.items
    .filter(item => {
      if (!state.searchQuery.trim()) return true;
      const q = state.searchQuery.toLowerCase();
      return item.title.toLowerCase().includes(q) || item.content.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const col = state.sortBy;
      const dir = state.sortOrder === 'asc' ? 1 : -1;
      if (col === 'usage_count') return (a.usage_count - b.usage_count) * dir;
      if (col === 'created_at') return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
      return a.title.localeCompare(b.title) * dir;
    });

  const handleNew = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const handleEdit = (item: QuickReply) => {
    setEditing(item);
    setModalOpen(true);
  };

  const handleDelete = (item: QuickReply) => {
    setToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleBulkDelete = () => setBulkDeleteDialogOpen(true);

  const handleSort = (col: SortCol) => {
    setState(prev => ({
      ...prev,
      sortBy: col,
      sortOrder: prev.sortBy === col && prev.sortOrder === 'asc' ? 'desc' : 'asc',
    }));
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setState(prev => ({ ...prev, deleting: true }));
    try {
      await quickRepliesService.deleteQuickReply(toDelete.id);
      toast.success('Resposta excluída');
      load();
      setDeleteDialogOpen(false);
      setToDelete(null);
    } catch {
      toast.error('Erro ao excluir resposta');
    } finally {
      setState(prev => ({ ...prev, deleting: false }));
    }
  };

  const confirmBulkDelete = async () => {
    setState(prev => ({ ...prev, deleting: true }));
    try {
      await Promise.all(state.selectedIds.map(id => quickRepliesService.deleteQuickReply(id)));
      toast.success(`${state.selectedIds.length} respostas excluídas`);
      setState(prev => ({ ...prev, selectedIds: [] }));
      load();
      setBulkDeleteDialogOpen(false);
    } catch {
      toast.error('Erro ao excluir respostas');
    } finally {
      setState(prev => ({ ...prev, deleting: false }));
    }
  };

  const handleSubmit = async (data: QuickReplyFormData) => {
    setState(prev => ({ ...prev, creating: true }));
    try {
      if (editing) {
        await quickRepliesService.updateQuickReply(editing.id, data);
        toast.success('Resposta atualizada');
      } else {
        await quickRepliesService.createQuickReply(data);
        toast.success('Resposta criada');
      }
      load();
      setModalOpen(false);
      setEditing(null);
    } catch {
      toast.error(editing ? 'Erro ao atualizar resposta' : 'Erro ao criar resposta');
    } finally {
      setState(prev => ({ ...prev, creating: false }));
    }
  };

  const isAdmin = can('quick_replies', 'manage') || can('accounts', 'update');

  return (
    <div className="h-full flex flex-col p-4">
      <QuickRepliesHeader
        totalCount={filtered.length}
        selectedCount={state.selectedIds.length}
        searchValue={state.searchQuery}
        onSearchChange={q => setState(prev => ({ ...prev, searchQuery: q }))}
        onNew={handleNew}
        onBulkDelete={handleBulkDelete}
        onClearSelection={() => setState(prev => ({ ...prev, selectedIds: [] }))}
        showBulkActions={state.selectedIds.length > 0}
      />

      <div className="flex-1 overflow-auto mt-6">
        {state.loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Zap}
            title="Nenhuma resposta rápida"
            description="Crie respostas rápidas para agilizar o atendimento"
            action={{ label: 'Nova Resposta', onClick: handleNew }}
            className="h-full"
          />
        ) : (
          <QuickRepliesTable
            quickReplies={filtered}
            selectedQuickReplies={filtered.filter(i => state.selectedIds.includes(i.id))}
            loading={state.loading}
            onSelectionChange={items => setState(prev => ({ ...prev, selectedIds: items.map(i => i.id) }))}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onCreateQuickReply={handleNew}
            sortBy={state.sortBy}
            sortOrder={state.sortOrder}
            onSort={handleSort}
          />
        )}
      </div>

      {/* Delete single */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir resposta rápida</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir "{toDelete?.title}"? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={state.deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={state.deleting}>
              {state.deleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk delete */}
      <Dialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir respostas selecionadas</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir {state.selectedIds.length} respostas? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteDialogOpen(false)} disabled={state.deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmBulkDelete} disabled={state.deleting}>
              {state.deleting ? 'Excluindo...' : 'Excluir tudo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickReplyModal
        open={modalOpen}
        onOpenChange={open => { if (!open) { setModalOpen(false); setEditing(null); } }}
        quickReply={editing ?? undefined}
        isNew={!editing}
        loading={state.creating}
        onSubmit={handleSubmit}
        isAdmin={isAdmin}
      />
    </div>
  );
}
