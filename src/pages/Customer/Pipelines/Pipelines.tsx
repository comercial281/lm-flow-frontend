import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useLanguage } from '@/hooks/useLanguage';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@evoapi/design-system';
import { Grid3X3, List, GitBranch, Sparkles } from 'lucide-react';
import EmptyState from '@/components/base/EmptyState';
import { followupAdminService } from '@/services/followupSequences/followupSequencesService';

import { useUserPermissions } from '@/hooks/useUserPermissions';
import { pipelinesService } from '@/services/pipelines';
import {
  Pipeline,
  PipelinesState,
  PipelinesListParams,
  CreatePipelineData,
  UpdatePipelineData,
} from '@/types/analytics';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';

import {
  PipelinesHeader,
  PipelineCard,
  PipelinesTable,
  CreatePipelineModal,
  EditPipelineModal,
  DuplicatePipelineModal,
} from '@/components/pipelines/index';
import DeletePipelineModal from '@/components/pipelines/DeletePipelineModal';
import { PipelinesTour } from '@/tours';

const INITIAL_STATE: PipelinesState = {
  pipelines: [],
  selectedPipelineIds: [],
  meta: {
    pagination: {
      page: 1,
      page_size: DEFAULT_PAGE_SIZE,
      total: 0,
      total_pages: 0,
    },
  },
  loading: {
    list: false,
    create: false,
    update: false,
    delete: false,
    duplicate: false,
  },
  searchQuery: '',
  sortBy: 'name',
  sortOrder: 'asc',
};

type PipelineTypeTab = 'all' | 'sale' | 'rental';

const TYPE_TABS: { key: PipelineTypeTab; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'sale', label: 'Venda' },
  { key: 'rental', label: 'Locação' },
];

const REAL_ESTATE_TYPES = ['sale', 'rental'];

export default function Pipelines() {
  const { t } = useLanguage('pipelines');
  const { can, isReady: permissionsReady } = useUserPermissions();
  const navigate = useNavigate();
  const [state, setState] = useState<PipelinesState>(INITIAL_STATE);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [activeTab, setActiveTab] = useState<PipelineTypeTab>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pipelineToDelete, setPipelineToDelete] = useState<Pipeline | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<Pipeline | null>(null);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [pipelineToDuplicate, setPipelineToDuplicate] = useState<Pipeline | null>(null);

  const [applyTemplateOpen, setApplyTemplateOpen] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState(false);

  const hasLoaded = useRef(false);

  const handleApplyTemplate = async () => {
    setApplyingTemplate(true);
    try {
      const result = await followupAdminService.reseedTemplate();
      toast.success(
        `Template aplicado: ${result.pipeline_name} (${result.stages_count} colunas, ${result.sequences.length} sequências, ${result.labels_count} etiquetas).`,
      );
      setApplyTemplateOpen(false);
      // Reload pipelines to show the new one
      loadPipelines();
    } catch (err) {
      console.error(err);
      toast.error('Falha ao aplicar template. Verifique se o tenant tem usuário admin.');
    } finally {
      setApplyingTemplate(false);
    }
  };

  // Load pipelines
  const loadPipelines = useCallback(
    async (params?: Partial<PipelinesListParams>) => {
      if (!can('pipelines', 'read')) {
        toast.error(t('messages.noPermissionRead'));
        return;
      }

      setState(prev => ({ ...prev, loading: { ...prev.loading, list: true } }));

      try {
        const requestParams: PipelinesListParams = {
          page: state.meta.pagination.page,
          per_page: state.meta.pagination.page_size,
          sort: 'name',
          order: 'asc',
          ...params,
        };

        const response = await pipelinesService.getPipelines(requestParams);

        setState(prev => ({
          ...prev,
          pipelines: response.data,
          meta: {
            pagination: {
              page: response.meta?.pagination?.page || 1,
              page_size: response.meta?.pagination?.page_size || DEFAULT_PAGE_SIZE,
              total: response.meta?.pagination?.total || 0,
              total_pages: response.meta?.pagination?.total_pages || 1,
              has_next_page: response.meta?.pagination?.has_next_page || false,
              has_previous_page: response.meta?.pagination?.has_previous_page || false,
            },
          },
          loading: { ...prev.loading, list: false },
        }));
      } catch (error) {
        console.error('Error loading pipelines:', error);
        toast.error(t('messages.loadError'));
        setState(prev => ({ ...prev, loading: { ...prev.loading, list: false } }));
      }
    },
    [state.meta.pagination.page, state.meta.pagination.page_size, can, t],
  );

  // Initial load
  useEffect(() => {
    if (!permissionsReady) {
      return;
    }

    if (!hasLoaded.current) {
      hasLoaded.current = true;
      loadPipelines();
    }
  }, [permissionsReady, loadPipelines]);

  // Handlers
  const handleSearchChange = (query: string) => {
    setState(prev => ({
      ...prev,
      searchQuery: query,
      meta: {
        pagination: {
          ...prev.meta.pagination,
          page: 1,
        },
      },
    }));

    // Reload with new search
    loadPipelines({ page: 1, q: query || undefined });
  };

  const handleCreatePipeline = () => {
    if (!can('pipelines', 'create')) {
      toast.error(t('messages.noPermissionCreate'));
      return;
    }
    setCreateModalOpen(true);
  };

  const handleEditPipeline = (pipeline: Pipeline) => {
    setEditingPipeline(pipeline);
    setEditModalOpen(true);
  };

  const handleDeletePipeline = (pipeline: Pipeline) => {
    setPipelineToDelete(pipeline);
    setDeleteDialogOpen(true);
  };

  const handleDuplicatePipeline = (pipeline: Pipeline) => {
    setPipelineToDuplicate(pipeline);
    setDuplicateModalOpen(true);
  };

  const handleToggleStatus = async (pipeline: Pipeline) => {
    try {
      await pipelinesService.togglePipelineStatus(pipeline.id, !pipeline.is_active);
      toast.success(
        pipeline.is_active ? t('messages.deactivateSuccess') : t('messages.activateSuccess'),
      );
      loadPipelines();
    } catch (error) {
      console.error('Error toggling pipeline status:', error);
      toast.error(t('messages.toggleError'));
    }
  };

  const handleSetAsDefault = async (pipeline: Pipeline) => {
    if (!can('pipelines', 'update')) {
      toast.error(t('messages.noPermissionUpdate'));
      return;
    }

    try {
      await pipelinesService.setAsDefault(pipeline.id);
      toast.success(t('messages.setAsDefaultSuccess'));
      loadPipelines();
    } catch (error) {
      console.error('Error setting pipeline as default:', error);
      toast.error(t('messages.setAsDefaultError'));
    }
  };

  const handleViewPipeline = (pipeline: Pipeline) => {
    navigate(`/pipelines/${pipeline.id}`);
  };

  // Create pipeline
  const handleCreatePipelineSubmit = async (data: CreatePipelineData) => {
    setState(prev => ({ ...prev, loading: { ...prev.loading, create: true } }));

    try {
      const response = await pipelinesService.createPipeline(data);
      toast.success(t('messages.createSuccess'));

      // Navigate to the new pipeline
      if (response.id) {
        navigate(`/pipelines/${response.id}`);
      } else {
        loadPipelines();
      }

      setCreateModalOpen(false);
    } catch (error) {
      console.error('Error creating pipeline:', error);
      toast.error(t('messages.createError'));
    } finally {
      setState(prev => ({ ...prev, loading: { ...prev.loading, create: false } }));
    }
  };

  // Update pipeline
  const handleUpdatePipelineSubmit = async (data: UpdatePipelineData) => {
    if (!editingPipeline) return;

    setState(prev => ({ ...prev, loading: { ...prev.loading, update: true } }));

    try {
      await pipelinesService.updatePipeline(editingPipeline.id, data);
      toast.success(t('messages.updateSuccess'));
      loadPipelines();
      setEditModalOpen(false);
      setEditingPipeline(null);
    } catch (error) {
      console.error('Error updating pipeline:', error);
      toast.error(t('messages.updateError'));
    } finally {
      setState(prev => ({ ...prev, loading: { ...prev.loading, update: false } }));
    }
  };

  // Delete pipeline
  const confirmDeletePipeline = async () => {
    if (!pipelineToDelete) return;

    const force = (pipelineToDelete.item_count || 0) > 0;

    setState(prev => ({ ...prev, loading: { ...prev.loading, delete: true } }));

    try {
      await pipelinesService.deletePipeline(pipelineToDelete.id, { force });
      toast.success(t('messages.deleteSuccess'));
      loadPipelines();
      setDeleteDialogOpen(false);
      setPipelineToDelete(null);
    } catch (error: unknown) {
      console.error('Error deleting pipeline:', error);
      const apiMessage =
        (error as { response?: { data?: { message?: string; error?: { message?: string } } } })
          ?.response?.data?.error?.message ||
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(apiMessage || t('messages.deleteError'));
    } finally {
      setState(prev => ({ ...prev, loading: { ...prev.loading, delete: false } }));
    }
  };

  // Duplicate pipeline
  const handleDuplicatePipelineSubmit = async (data: { name: string; description?: string }) => {
    if (!pipelineToDuplicate) return;

    setState(prev => ({ ...prev, loading: { ...prev.loading, duplicate: true } }));

    try {
      const response = await pipelinesService.duplicatePipeline(pipelineToDuplicate.id, data);
      toast.success(t('messages.duplicateSuccess'));

      // Navigate to the new pipeline
      if (response.id) {
        navigate(`/pipelines/${response.id}`);
      } else {
        loadPipelines();
      }

      setDuplicateModalOpen(false);
      setPipelineToDuplicate(null);
    } catch (error) {
      console.error('Error duplicating pipeline:', error);
      toast.error(t('messages.duplicateError'));
    } finally {
      setState(prev => ({ ...prev, loading: { ...prev.loading, duplicate: false } }));
    }
  };

  // Filter pipelines by type tab then by search
  const tabFilteredPipelines = state.pipelines.filter(pipeline => {
    if (activeTab === 'all') return true;
    return pipeline.pipeline_type === activeTab;
  });

  const filteredPipelines = state.searchQuery
    ? tabFilteredPipelines.filter(
        pipeline =>
          pipeline.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
          pipeline.description?.toLowerCase().includes(state.searchQuery.toLowerCase()),
      )
    : tabFilteredPipelines;

  const hasRealEstatePipelines = state.pipelines.some(p => REAL_ESTATE_TYPES.includes(p.pipeline_type));

  return (
    <div className="h-full flex flex-col p-4">
      <PipelinesTour />
      <div data-tour="pipelines-header">
        <PipelinesHeader
          totalCount={state.meta.pagination.total}
          searchValue={state.searchQuery}
          onSearchChange={handleSearchChange}
          onNewPipeline={handleCreatePipeline}
        />
      </div>

      {/* Type Tabs — only shown when real-estate pipelines exist */}
      {hasRealEstatePipelines && (
        <div className="flex gap-1 border-b border-border mb-4 mt-2">
          {TYPE_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              <span className="ml-1.5 text-xs">
                ({tab.key === 'all'
                  ? state.pipelines.length
                  : state.pipelines.filter(p => p.pipeline_type === tab.key).length})
              </span>
            </button>
          ))}
        </div>
      )}

      {/* View Mode Toggle */}
      <div className="flex items-center justify-between mb-3" data-tour="pipelines-view-toggle">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setApplyTemplateOpen(true)}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Aplicar template Leads (Marketing)
        </Button>
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

      {/* Content */}
      <div className="flex-1 overflow-auto" data-tour="pipelines-list">
        {state.loading.list ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-muted-foreground">{t('loading.pipelines')}</div>
          </div>
        ) : filteredPipelines.length === 0 ? (
          <EmptyState
            icon={GitBranch}
            title={state.searchQuery ? t('empty.noResults') : t('empty.noPipelines')}
            description={
              state.searchQuery
                ? t('empty.noResultsDescription')
                : t('empty.noPipelinesDescription')
            }
            action={
              !state.searchQuery
                ? {
                    label: t('empty.createPipeline'),
                    onClick: handleCreatePipeline,
                  }
                : undefined
            }
            className="h-full"
          />
        ) : viewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPipelines.map(pipeline => (
              <PipelineCard
                key={pipeline.id}
                pipeline={pipeline}
                onView={handleViewPipeline}
                onEdit={handleEditPipeline}
                onDelete={handleDeletePipeline}
                onDuplicate={handleDuplicatePipeline}
                onToggleStatus={handleToggleStatus}
                onSetAsDefault={handleSetAsDefault}
              />
            ))}
          </div>
        ) : (
          <PipelinesTable
            pipelines={filteredPipelines}
            loading={state.loading.list}
            onView={handleViewPipeline}
            onEdit={handleEditPipeline}
            onDelete={handleDeletePipeline}
            onDuplicate={handleDuplicatePipeline}
            onToggleStatus={handleToggleStatus}
            sortBy={state.sortBy}
            sortOrder={state.sortOrder}
            onSort={column => {
              const newOrder =
                state.sortBy === column && state.sortOrder === 'asc' ? 'desc' : 'asc';
              setState(prev => ({ ...prev, sortBy: column, sortOrder: newOrder }));
              loadPipelines({
                sort: column as 'name' | 'created_at' | 'conversations_count',
                order: newOrder,
              });
            }}
          />
        )}
      </div>

      {/* Delete Pipeline Modal */}
      <DeletePipelineModal
        open={deleteDialogOpen}
        onOpenChange={open => {
          setDeleteDialogOpen(open);
          if (!open) setPipelineToDelete(null);
        }}
        pipeline={pipelineToDelete}
        onConfirm={confirmDeletePipeline}
        loading={state.loading.delete}
      />

      {/* Create Pipeline Modal */}
      <CreatePipelineModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSubmit={handleCreatePipelineSubmit}
        loading={state.loading.create}
      />

      {/* Edit Pipeline Modal */}
      {editingPipeline && (
        <EditPipelineModal
          open={editModalOpen}
          onOpenChange={open => {
            if (!open) {
              setEditModalOpen(false);
              setEditingPipeline(null);
            }
          }}
          pipeline={editingPipeline}
          onSubmit={handleUpdatePipelineSubmit}
          loading={state.loading.update}
        />
      )}

      {/* Duplicate Pipeline Modal */}
      {pipelineToDuplicate && (
        <DuplicatePipelineModal
          open={duplicateModalOpen}
          onOpenChange={open => {
            if (!open) {
              setDuplicateModalOpen(false);
              setPipelineToDuplicate(null);
            }
          }}
          pipeline={pipelineToDuplicate}
          onSubmit={handleDuplicatePipelineSubmit}
          loading={state.loading.duplicate}
        />
      )}

      {/* Aplicar Template Leads (Marketing) — sprint Follow-up */}
      <Dialog open={applyTemplateOpen} onOpenChange={setApplyTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aplicar template Leads (Marketing)</DialogTitle>
            <DialogDescription>
              Cria (ou re-aplica, é idempotente) no tenant atual:
              <ul className="mt-2 list-inside list-disc text-sm">
                <li>Pipeline "Leads (Marketing)" com 4 colunas (Novo / Primeiro Contato / Follow-up Curto / Follow-up Longo)</li>
                <li>10 etiquetas coloridas (meta-ads, follow-up, follow-up1-6, recuperado-pelo-follow-up, keyword-trigger)</li>
                <li>2 sequências de mensagens com 6 passos editáveis cada</li>
                <li>3 regras de automacao (tag meta-ads → funil; palavra-chave → funil; lead recuperado → etiqueta + move coluna)</li>
              </ul>
              Nada é destruído; se já existe, mantém. Você pode editar tudo depois em Configurações → Follow-ups.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyTemplateOpen(false)} disabled={applyingTemplate}>
              Cancelar
            </Button>
            <Button onClick={handleApplyTemplate} disabled={applyingTemplate}>
              {applyingTemplate ? 'Aplicando...' : 'Aplicar template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
