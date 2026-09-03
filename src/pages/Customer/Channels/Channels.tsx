import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Button,
  Skeleton,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@/components/ui/ds';
import { Trash2, Grid3X3, List, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/hooks/useLanguage';

import { useAppDataStore } from '@/store/appDataStore';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import InboxesService from '@/services/channels/inboxesService';
import { Inbox } from '@/types/channels/inbox';
import {
  ChannelsHeader,
  ChannelsTable,
  ChannelsPagination,
  ChannelCard,
} from '@/components/channels';
import EmptyState from '@/components/base/EmptyState';
// table types imported where needed in ChannelsTable
import { useNavigate } from 'react-router-dom';
import { ChannelsTour } from '@/tours';
import { useFeature } from '@/contexts/TenantFeaturesContext';

export default function Channels() {
  const { can, isReady: permissionsReady, loading: permissionsLoading } = useUserPermissions();
  const { t } = useLanguage('channels');
  const canConnect = useFeature('channels_connect');

  const { inboxes, isLoadingInboxes, fetchInboxes, removeInbox } = useAppDataStore();
  const [query, setQuery] = useState('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [perPage, setPerPage] = useState(24);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    channel: Inbox | null;
    confirmationText: string;
  }>({
    isOpen: false,
    channel: null,
    confirmationText: '',
  });
  const navigate = useNavigate();

  useEffect(() => {
    if (!permissionsReady || permissionsLoading) {
      return;
    }

    if (!can('channels', 'read')) {
      toast.error(t('permissions.viewDenied'));
      return;
    }
    fetchInboxes(true);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionsReady, permissionsLoading, fetchInboxes]);

  // O selo de conexão de cada card só vale se ele acompanhar a realidade
  // enquanto a tela está aberta. Sem isto, quem deixa Canais aberto vendo tudo
  // verde continuaria vendo tudo verde depois de uma instância cair — o oposto
  // do que o selo promete. A lista fica em cache por 15 minutos no app, então o
  // recarregamento aqui é forçado.
  //
  // Só com a aba à vista (aba em segundo plano não tem quem olhe) e sem piscar
  // a lista: o esqueleto de carregamento só aparece quando ainda não há nada
  // na tela.
  useEffect(() => {
    if (!permissionsReady || permissionsLoading || !can('channels', 'read')) {
      return;
    }

    const REFRESH_INTERVAL = 60_000;

    const refresh = () => {
      if (document.visibilityState === 'visible') {
        fetchInboxes(true).catch(() => {
          /* silencioso: é atualização de fundo, o erro já foi logado no store */
        });
      }
    };

    const interval = window.setInterval(refresh, REFRESH_INTERVAL);
    document.addEventListener('visibilitychange', refresh);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionsReady, permissionsLoading, fetchInboxes]);

  const { filteredInboxes, paginatedInboxes } = useMemo(() => {
    // First filter by search query
    const filtered = query
      ? inboxes.filter((i: Inbox) => {
          const q = query.toLowerCase();
          return i.name?.toLowerCase().includes(q) || i.channel_type?.toLowerCase().includes(q);
        })
      : inboxes;

    // Then paginate
    const startIndex = (currentPage - 1) * perPage;
    const endIndex = startIndex + perPage;
    const paginated = filtered.slice(startIndex, endIndex);

    return {
      filteredInboxes: filtered,
      paginatedInboxes: paginated,
    };
  }, [inboxes, query, currentPage, perPage]);

  // Update pagination stats when data changes
  useEffect(() => {
    setTotalCount(filteredInboxes.length);
    setTotalPages(Math.ceil(filteredInboxes.length / perPage));
  }, [filteredInboxes.length, perPage]);

  // `tab` é opcional: sem ela a tela abre nas Configurações básicas, como
  // sempre. O "Reconectar" do card caído manda a aba do QR Code — é o mesmo
  // atalho que o fluxo de criar canal já usava para parear o WhatsApp.
  const openChannelSettings = useCallback(
    (inbox: Inbox, tab?: string) => {
      const destino = `/channels/${inbox.id}/settings`;
      navigate(tab ? `${destino}?tab=${tab}` : destino);
    },
    [navigate],
  );

  const handleNewChannel = useCallback(() => {
    // Aguardar até que as permissões estejam carregadas
    if (permissionsLoading || !permissionsReady) {
      return;
    }

    if (!can('channels', 'create')) {
      toast.error(t('permissions.createDenied'));
      return;
    }
    navigate('/channels/new');
  }, [navigate, can, permissionsLoading, permissionsReady, t]);

  const openDeleteModal = (channel: Inbox) => {
    // Aguardar até que as permissões estejam carregadas
    if (permissionsLoading || !permissionsReady) {
      return;
    }

    if (!can('channels', 'delete')) {
      toast.error(t('permissions.deleteDenied'));
      return;
    }
    setDeleteModal({
      isOpen: true,
      channel,
      confirmationText: '',
    });
  };

  const closeDeleteModal = () => {
    setDeleteModal({
      isOpen: false,
      channel: null,
      confirmationText: '',
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.channel) return;

    const channelId = deleteModal.channel.id;
    setIsDeleting(channelId);

    try {
      await InboxesService.remove(channelId);

      // Optimistically remove from local state
      removeInbox(channelId);

      toast.success(t('success.removeSuccess'));
      closeDeleteModal();
    } catch (e: unknown) {
      console.error('Erro ao remover canal:', e);
      toast.error((e as Error)?.message || t('errors.removeError'));

      // Refresh list on error to restore correct state
      await fetchInboxes();
    } finally {
      setIsDeleting(null);
    }
  };

  const isDeleteConfirmationValid = deleteModal.confirmationText === deleteModal.channel?.name;

  // Esqueleto só na PRIMEIRA carga. A atualização periódica do estado das
  // instâncias também liga o "carregando" — trocar a lista inteira por
  // esqueletos a cada minuto faria a tela piscar sem parar.
  const isInitialLoading = isLoadingInboxes && inboxes.length === 0;

  // Columns moved to ChannelsTable

  return (
    <div className="h-full flex flex-col p-4">
      <ChannelsTour />
      <div data-tour="channels-header">
        <ChannelsHeader
          totalCount={totalCount}
          selectedCount={0}
          searchValue={query}
          onSearchChange={setQuery}
          onNewChannel={handleNewChannel}
          canCreate={canConnect}
          onClearSelection={() => {}}
        />
      </div>

      <div className="flex items-center justify-end mb-3" data-tour="channels-view-toggle">
        <div className="flex items-center border rounded-lg">
          <Button
            variant={viewMode === 'cards' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('cards')}
            className="border-0 rounded-r-none"
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('table')}
            className="border-0 rounded-l-none"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto" data-tour="channels-list">
        {isInitialLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <Skeleton key={idx} className="h-28" />
            ))}
          </div>
        ) : totalCount === 0 ? (
          <EmptyState
            icon={Layers}
            title={t('emptyState.title')}
            description={t('emptyState.description')}
            action={canConnect ? { label: t('emptyState.action'), onClick: handleNewChannel } : undefined}
            className="h-full"
          />
        ) : viewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {paginatedInboxes.map((inbox: Inbox) => (
              <ChannelCard
                key={inbox.id}
                inbox={inbox}
                isDeleting={isDeleting}
                onSettings={openChannelSettings}
                onDelete={openDeleteModal}
              />
            ))}
          </div>
        ) : (
          <ChannelsTable
            channels={paginatedInboxes}
            loading={isInitialLoading}
            onSettings={openChannelSettings}
            onDelete={openDeleteModal}
          />
        )}
      </div>

      {/* Pagination */}
      {totalCount > 0 && (
        <div data-tour="channels-pagination">
          <ChannelsPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            perPage={perPage}
            onPageChange={setCurrentPage}
            onPerPageChange={setPerPage}
            loading={isInitialLoading}
          />
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteModal.isOpen} onOpenChange={closeDeleteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Trash2 className="h-5 w-5" />
              {t('deleteDialog.title')}
            </DialogTitle>
            <DialogDescription className="text-sidebar-foreground/70">
              {t('deleteDialog.description', { name: deleteModal.channel?.name })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-sidebar-foreground">
                {t('deleteDialog.confirmLabel')}
              </label>
              <Input
                placeholder={deleteModal.channel?.name || t('deleteDialog.placeholder')}
                value={deleteModal.confirmationText}
                onChange={e =>
                  setDeleteModal(prev => ({
                    ...prev,
                    confirmationText: e.target.value,
                  }))
                }
                className="mt-2 bg-sidebar border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/50"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={closeDeleteModal}
              className="bg-sidebar border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent"
            >
              {t('deleteDialog.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={!isDeleteConfirmationValid || isDeleting === deleteModal.channel?.id}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting === deleteModal.channel?.id
                ? t('deleteDialog.deleting')
                : t('deleteDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
