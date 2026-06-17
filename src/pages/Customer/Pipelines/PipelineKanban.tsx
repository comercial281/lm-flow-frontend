import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useLanguage } from '@/hooks/useLanguage';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Badge,
  Input,
} from '@evoapi/design-system';
import {
  ArrowLeft,
  Plus,
  MoreVertical,
  GripVertical,
  Edit,
  Trash2,
  Copy,
  ArrowUpDown,
  Phone,
  Mail,
  MessageSquare,
  User,
  CalendarClock,
  ListTodo,
  AlertCircle,
  Clock,
  CheckCircle2,
  Search,
  X,
  Download,
  Upload,
} from 'lucide-react';

import { pipelinesService } from '@/services/pipelines';
import { visitsService } from '@/services/visits/visitsService';
import {
  Pipeline,
  PipelineStage,
  PipelineItem,
  UpdatePipelineData,
  CreateStageData,
} from '@/types/analytics';
import PipelineSwitcher from '@/components/pipelines/PipelineSwitcher';
import EditPipelineModal from '@/components/pipelines/EditPipelineModal';
import CreateStageModal from '@/components/pipelines/CreateStageModal';
import AddItemModal from '@/components/pipelines/AddItemModal';
import ImportLeadsModal from '@/components/pipelines/ImportLeadsModal';
import RemoveItemModal from '@/components/pipelines/RemoveItemModal';
import EditItemModal from '@/components/pipelines/EditItemModal';
import EditStageModal from '@/components/pipelines/EditStageModal';
import DeleteStageModal from '@/components/pipelines/DeleteStageModal';
import DeletePipelineModal from '@/components/pipelines/DeletePipelineModal';
import ReorderStagesModal from '@/components/pipelines/ReorderStagesModal';
import { ScheduleActionModal } from '@/components/scheduledActions';

export default function PipelineKanban() {
  const { t } = useLanguage('pipelines');
  const { pipelineId } = useParams<{ pipelineId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [allPipelines, setAllPipelines] = useState<Pipeline[]>([]);
  const [draggedItem, setDraggedItem] = useState<PipelineItem | null>(null);
  const isDraggingRef = useRef(false);
  const suppressClickUntilRef = useRef(0);

  // Modal states
  const [showEditPipelineModal, setShowEditPipelineModal] = useState(false);
  const [isUpdatingPipeline, setIsUpdatingPipeline] = useState(false);
  const [showCreateStageModal, setShowCreateStageModal] = useState(false);
  const [isCreatingStage, setIsCreatingStage] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [selectedStageForItem, setSelectedStageForItem] = useState<PipelineStage | null>(null);
  const [showRemoveItemModal, setShowRemoveItemModal] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<PipelineItem | null>(null);
  const [isRemovingItem, setIsRemovingItem] = useState(false);
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<PipelineItem | null>(null);
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [showEditStageModal, setShowEditStageModal] = useState(false);
  const [showDeleteStageModal, setShowDeleteStageModal] = useState(false);
  const [stageToEdit, setStageToEdit] = useState<PipelineStage | null>(null);
  const [stageToDelete, setStageToDelete] = useState<PipelineStage | null>(null);
  const [isEditingStage, setIsEditingStage] = useState(false);
  const [isDeletingStage, setIsDeletingStage] = useState(false);
  const [showDeletePipelineModal, setShowDeletePipelineModal] = useState(false);
  const [showReorderStagesModal, setShowReorderStagesModal] = useState(false);
  const [isDeletingPipeline, setIsDeletingPipeline] = useState(false);
  const [isReorderingStages, setIsReorderingStages] = useState(false);
  const [scheduleActionOpen, setScheduleActionOpen] = useState(false);
  const [selectedConversationForSchedule, setSelectedConversationForSchedule] =
    useState<PipelineItem | null>(null);
  const scheduleActionContactId =
    selectedConversationForSchedule?.conversation?.contact?.id ??
    selectedConversationForSchedule?.contact?.id;

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Load pipeline data
  const loadPipelineData = useCallback(async () => {
    if (!pipelineId) return;

    setLoading(true);
    try {
      // Load pipeline with all data (stages, items, tasks_info, services_info)
      const pipelineData = await pipelinesService.getPipeline(pipelineId);

      setPipeline(pipelineData);
      setStages(pipelineData.stages || []);
    } catch (error) {
      console.error('Error loading pipeline data:', error);
      toast.error(t('kanban.messages.loadDataError'));
    } finally {
      setLoading(false);
    }
  }, [pipelineId]);

  // Próximas visitas por contato (pra mostrar dia/hora no card).
  const [visitsByContact, setVisitsByContact] = useState<Record<string, string>>({});
  const loadUpcomingVisits = useCallback(async () => {
    try {
      const res = await visitsService.list({ upcoming: 'true', per_page: 500 });
      const map: Record<string, string> = {};
      (res.data || []).forEach(v => {
        if (!v.contact_id) return;
        // mantém a visita mais próxima por contato
        if (!map[v.contact_id] || new Date(v.scheduled_at) < new Date(map[v.contact_id])) {
          map[v.contact_id] = v.scheduled_at;
        }
      });
      setVisitsByContact(map);
    } catch {
      /* visitas são enriquecimento opcional do card */
    }
  }, []);

  // Load all pipelines for selector
  const loadAllPipelines = useCallback(async () => {
    try {
      const response = await pipelinesService.getPipelines();
      const pipelinesData = response.data || [];
      setAllPipelines(pipelinesData);
    } catch (error) {
      console.error('Error loading pipelines:', error);
    }
  }, []);

  useEffect(() => {
    loadPipelineData();
    loadAllPipelines();
    loadUpcomingVisits();
  }, [loadPipelineData, loadAllPipelines, loadUpcomingVisits]);

  // Auto-open card from ?card= URL param
  useEffect(() => {
    const cardId = searchParams.get('card');
    if (!cardId || loading) return;
    const allItems = stages.flatMap(s => s.items ?? []);
    const found = allItems.find(i => i.id === cardId);
    if (found) {
      setItemToEdit(found);
      setShowEditItemModal(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, stages, loading, setSearchParams]);

  // Handle pipeline change
  const handlePipelineChange = (newPipelineId: string) => {
    if (newPipelineId !== pipelineId) {
      navigate(`/pipelines/${newPipelineId}`);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (item: PipelineItem) => {
    setDraggedItem(item);
    isDraggingRef.current = true;
    suppressClickUntilRef.current = Date.now() + 200;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetStageId: string) => {
    e.preventDefault();

    if (!draggedItem) return;

    const fromStageId = draggedItem.stage_id;

    // Don't move if dropping on same stage
    if (fromStageId === targetStageId) {
      setDraggedItem(null);
      isDraggingRef.current = false;
      suppressClickUntilRef.current = Date.now() + 200;
      return;
    }

    // Optimistic update: move the card locally and keep a snapshot to revert on error.
    // Antes recarregava o board inteiro (loadPipelineData) — piscava a tela toda. Agora é instantâneo.
    const movedItem = { ...draggedItem, stage_id: targetStageId, pipeline_stage_id: targetStageId };
    const snapshot = stages;
    setStages(prev =>
      prev.map(s => {
        if (s.id === fromStageId) {
          return { ...s, items: (s.items || []).filter(i => i.id !== draggedItem.id) };
        }
        if (s.id === targetStageId) {
          return { ...s, items: [movedItem, ...(s.items || [])] };
        }
        return s;
      }),
    );
    setDraggedItem(null);
    isDraggingRef.current = false;
    suppressClickUntilRef.current = Date.now() + 200;

    try {
      await pipelinesService.moveItem({
        item_id: draggedItem.id,
        pipeline_id: pipelineId!,
        from_stage_id: fromStageId,
        to_stage_id: targetStageId,
      });
      toast.success(t('kanban.messages.itemMoved'));
    } catch (error) {
      console.error('Error moving item:', error);
      toast.error(t('kanban.messages.itemMoveError'));
      setStages(snapshot); // revert
    }
  };

  const handleDragEnd = () => {
    isDraggingRef.current = false;
    suppressClickUntilRef.current = Date.now() + 200;
  };

  // Calculate stage total value
  const calculateStageTotal = (items: PipelineItem[] = []) => {
    return items.reduce((total, item) => {
      return total + (item.value || 0);
    }, 0);
  };

  // Calculate pipeline total value
  const calculatePipelineTotal = () => {
    return stages.reduce((total, stage) => {
      return total + calculateStageTotal(stage.items);
    }, 0);
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Get contact color
  const getContactColor = (name?: string) => {
    if (!name) return '#6B7280';
    const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#F97316'];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  // Nome cru às vezes vem como o número de telefone (Evolution não manda pushName no 1º evento).
  // Resolve pro melhor candidato disponível, descartando nomes que são só dígitos/telefone.
  const isPhoneLikeName = (value?: string | null) => {
    if (!value) return true;
    return /^[+\d\s()\-@.]+$/.test(value.replace(/whatsapp|net|us|s\./gi, ''));
  };
  const resolveItemName = (item: PipelineItem): string => {
    const candidates = [item.contact?.name, item.conversation?.contact?.name];
    const good = candidates.find(c => c && !isPhoneLikeName(c));
    if (good) return good as string;
    // sem nome real: mostra o telefone formatado em vez de string crua tipo JID
    const phone =
      item.contact?.phone_number || item.conversation?.contact?.phone_number || candidates[0];
    return phone || t('kanban.conversation.unknownUser');
  };
  const resolveItemAvatar = (item: PipelineItem): string | undefined => {
    return item.contact?.avatar_url || item.conversation?.contact?.avatar_url || undefined;
  };
  // Data de chegada do lead no pipeline (quando o card entrou).
  const formatArrivalDate = (item: PipelineItem): string | null => {
    const raw = item.entered_at
      ? item.entered_at * 1000
      : item.created_at
      ? typeof item.created_at === 'number'
        ? item.created_at * 1000
        : new Date(item.created_at).getTime()
      : null;
    if (!raw) return null;
    return new Date(raw).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  };

  // Último contato com o lead medido pela CONVERSA da instância WhatsApp.
  // last_non_activity_message = última mensagem real (entrada OU saída), incluindo
  // mensagens que o corretor mandou pelo celular (persistidas via webhook Evolution).
  // NÃO é baseado em envios internos do LM Flow — é o timestamp da própria conversa.
  const lastContactMs = (item: PipelineItem): number | null => {
    const msg = item.conversation?.last_non_activity_message;
    if (msg?.created_at != null) {
      return typeof msg.created_at === 'number'
        ? msg.created_at * 1000
        : new Date(msg.created_at).getTime();
    }
    if (item.conversation?.last_activity_at) {
      return item.conversation.last_activity_at * 1000;
    }
    return null;
  };
  const lastContactDays = (item: PipelineItem): number | null => {
    const ms = lastContactMs(item);
    if (!ms) return null;
    return Math.floor((Date.now() - ms) / 86_400_000);
  };

  // Labels da conversa (vêm como string[] ou {title}[]).
  const itemLabels = (item: PipelineItem): string[] => {
    const raw = (item.conversation as any)?.labels ?? [];
    return Array.isArray(raw)
      ? raw.map((l: any) => (typeof l === 'string' ? l : l?.title ?? '')).filter(Boolean)
      : [];
  };
  const hasVisitScheduled = (item: PipelineItem) => itemLabels(item).includes('visita-agendada');
  // Dia/hora da próxima visita do lead (do mapa carregado de /visits).
  const itemVisitLabel = (item: PipelineItem): string | null => {
    const cid = item.contact?.id || item.conversation?.contact?.id;
    const when = cid ? visitsByContact[cid] : undefined;
    if (!when) return null;
    return new Date(when).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Pipeline management handlers
  const handleEditPipeline = () => {
    setShowEditPipelineModal(true);
  };

  const handleUpdatePipeline = async (data: UpdatePipelineData) => {
    if (!pipeline) return;

    setIsUpdatingPipeline(true);
    try {
      await pipelinesService.updatePipeline(pipeline.id, data);
      toast.success(t('messages.updateSuccess'));
      setShowEditPipelineModal(false);
      // Reload pipeline data to reflect changes
      await loadPipelineData();
    } catch (error) {
      console.error('Error updating pipeline:', error);
      toast.error(t('messages.updateError'));
    } finally {
      setIsUpdatingPipeline(false);
    }
  };

  const handleDeletePipeline = () => {
    setShowDeletePipelineModal(true);
  };

  const handleConfirmDeletePipeline = async () => {
    if (!pipeline) return;

    setIsDeletingPipeline(true);
    try {
      await pipelinesService.deletePipeline(pipeline.id);
      toast.success(t('messages.deleteSuccess'));
      setShowDeletePipelineModal(false);
      navigate('/pipelines');
    } catch (error) {
      console.error('Error deleting pipeline:', error);
      toast.error(t('messages.deleteError'));
    } finally {
      setIsDeletingPipeline(false);
    }
  };

  const handleReorderStages = () => {
    setShowReorderStagesModal(true);
  };

  const handleUpdateStageOrder = async (orderedStages: PipelineStage[]) => {
    if (!pipelineId) return;

    setIsReorderingStages(true);
    try {
      // Backend expects just an array of stage IDs in the correct order
      const stageOrders = orderedStages.map(stage => stage.id);

      await pipelinesService.reorderPipelineStages(pipelineId, stageOrders);

      toast.success(t('kanban.messages.stageReordered'));
      setShowReorderStagesModal(false);
      // Reload pipeline data to reflect changes
      await loadPipelineData();
    } catch (error) {
      console.error('Error reordering stages:', error);
      toast.error(t('kanban.messages.stageReorderError'));
    } finally {
      setIsReorderingStages(false);
    }
  };

  // Stage management handlers
  const handleCreateStage = async (data: CreateStageData) => {
    if (!pipeline) return;

    setIsCreatingStage(true);
    try {
      await pipelinesService.createPipelineStage(pipeline.id, data);
      toast.success(t('kanban.messages.stageCreated'));
      setShowCreateStageModal(false);
      // Reload pipeline data to show new stage
      await loadPipelineData();
    } catch (error) {
      console.error('Error creating stage:', error);
      toast.error(t('kanban.messages.stageCreateError'));
    } finally {
      setIsCreatingStage(false);
    }
  };

  // Item management handlers
  const handleAddItem = (stage?: PipelineStage) => {
    setSelectedStageForItem(stage || stages[0] || null);
    setShowAddItemModal(true);
  };

  const handleItemAdded = async () => {
    toast.success(t('kanban.messages.itemAdded'));
    // Reload pipeline data to show new item
    await loadPipelineData();
  };

  const handleRemoveItem = (item: PipelineItem) => {
    setItemToRemove(item);
    setShowRemoveItemModal(true);
  };

  const handleConfirmRemoveItem = async () => {
    if (!itemToRemove || !pipelineId) return;

    setIsRemovingItem(true);
    try {
      await pipelinesService.removeItemFromPipeline(pipelineId, itemToRemove.id);
      toast.success(t('kanban.messages.itemRemoved'));
      setShowRemoveItemModal(false);
      setItemToRemove(null);
      // Reload pipeline data to reflect changes
      await loadPipelineData();
    } catch (error) {
      console.error('Error removing item from pipeline:', error);
      toast.error(t('kanban.messages.itemRemoveError'));
    } finally {
      setIsRemovingItem(false);
    }
  };

  const handleEditItem = (item: PipelineItem) => {
    setItemToEdit(item);
    setShowEditItemModal(true);
  };

  const handleUpdateItem = async (data: {
    notes: string;
    stage_id: string;
    services: Array<{ name: string; value: string }>;
    currency: string;
    custom_attributes?: Record<string, unknown>;
  }) => {
    if (!itemToEdit || !pipelineId) return;

    setIsEditingItem(true);
    try {
      await pipelinesService.updateItemInPipeline(pipelineId, itemToEdit.id, {
        pipeline_stage_id: data.stage_id,
        notes: data.notes,
        custom_fields: {
          services: data.services,
          currency: data.currency,
          // Merge custom attributes into custom_fields (backend expects them here)
          ...(data.custom_attributes || {}),
        },
      });
      toast.success(t('kanban.messages.itemUpdated'));
      setShowEditItemModal(false);
      setItemToEdit(null);
      // Reload pipeline data to reflect changes
      await loadPipelineData();
    } catch (error) {
      console.error('Error updating item:', error);
      toast.error(t('kanban.messages.itemUpdateError'));
    } finally {
      setIsEditingItem(false);
    }
  };

  // Stage management handlers
  const handleEditStage = (stage: PipelineStage) => {
    setStageToEdit(stage);
    setShowEditStageModal(true);
  };

  const handleUpdateStage = async (data: {
    name: string;
    color: string;
    stage_type: string;
    automation_rules?: { description?: string };
    custom_fields?: Record<string, unknown>;
  }) => {
    if (!stageToEdit || !pipelineId) return;

    setIsEditingStage(true);
    try {
      await pipelinesService.updatePipelineStage(pipelineId, stageToEdit.id, {
        name: data.name,
        color: data.color,
        stage_type: data.stage_type,
        automation_rules: data.automation_rules,
        custom_fields: data.custom_fields,
      });
      toast.success(t('kanban.messages.stageUpdated'));
      setShowEditStageModal(false);
      setStageToEdit(null);
      // Reload pipeline data to reflect changes
      await loadPipelineData();
    } catch (error) {
      console.error('Error updating stage:', error);
      toast.error(t('kanban.messages.stageUpdateError'));
    } finally {
      setIsEditingStage(false);
    }
  };

  const handleDeleteStage = (stage: PipelineStage) => {
    setStageToDelete(stage);
    setShowDeleteStageModal(true);
  };

  const handleConfirmDeleteStage = async () => {
    if (!stageToDelete || !pipelineId) return;

    setIsDeletingStage(true);
    try {
      await pipelinesService.deletePipelineStage(pipelineId, stageToDelete.id);
      toast.success(t('kanban.messages.stageDeleted'));
      setShowDeleteStageModal(false);
      setStageToDelete(null);
      // Reload pipeline data to reflect changes
      await loadPipelineData();
    } catch (error) {
      console.error('Error deleting stage:', error);
      toast.error(t('kanban.messages.stageDeleteError'));
    } finally {
      setIsDeletingStage(false);
    }
  };

  // Filter stages by search query and date range
  const filteredStages = useMemo(() => {
    if (!searchQuery && !dateFrom && !dateTo) return stages;
    const q = searchQuery.toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : null;
    return stages.map(stage => ({
      ...stage,
      items: (stage.items || []).filter(item => {
        const matchesSearch =
          !q ||
          (item.contact?.name || '').toLowerCase().includes(q) ||
          (item.contact?.email || '').toLowerCase().includes(q) ||
          (item.contact?.phone_number || '').toLowerCase().includes(q);
        const enteredMs =
          typeof item.entered_at === 'number'
            ? item.entered_at * 1000
            : new Date(item.created_at).getTime();
        const matchesFrom = !from || enteredMs >= from;
        const matchesTo = !to || enteredMs <= to;
        return matchesSearch && matchesFrom && matchesTo;
      }),
    }));
  }, [stages, searchQuery, dateFrom, dateTo]);

  // Export leads as CSV
  const handleExportCSV = () => {
    const allItems = stages.flatMap(stage =>
      (stage.items || []).map(item => ({
        nome: item.contact?.name || '',
        email: item.contact?.email || '',
        telefone: item.contact?.phone_number || '',
        etapa: stage.name,
        valor: item.value || '',
        entrada: item.entered_at
          ? new Date(item.entered_at * 1000).toLocaleDateString('pt-BR')
          : new Date(item.created_at).toLocaleDateString('pt-BR'),
      })),
    );
    if (allItems.length === 0) {
      toast.error('Nenhum lead para exportar.');
      return;
    }
    const headers = ['nome', 'email', 'telefone', 'etapa', 'valor', 'entrada'];
    const rows = allItems.map(r => headers.map(h => `"${String((r as any)[h]).replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${pipeline?.name || 'pipeline'}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${allItems.length} leads exportados.`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex w-full h-full min-w-0 overflow-hidden">
      <div className="flex-1 h-full flex flex-col bg-muted/30 min-w-0">
        {/* Header */}
        <div className="flex-shrink-0 bg-background border-b border-border shadow-sm">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-3 py-3 lg:h-16 lg:flex-row lg:items-center lg:justify-between lg:py-0">
              {/* Navigation and Pipeline Info */}
              <div className="flex items-center gap-3 min-w-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/pipelines')}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>

                <div className="flex-1 min-w-0 max-w-full lg:max-w-2xl">
                  {/* Pipeline Selector */}
                  <PipelineSwitcher
                    pipelines={allPipelines}
                    selectedPipeline={pipeline}
                    onSwitchPipeline={handlePipelineChange}
                  />
                </div>
              </div>

              {/* Quick Stats and Actions */}
              <div className="flex w-full flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm lg:w-auto">
                {pipeline?.pipeline_type === 'sale' && (
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 border-0">
                    Venda
                  </Badge>
                )}
                {pipeline?.pipeline_type === 'rental' && (
                  <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400 border-0">
                    Locação
                  </Badge>
                )}
                <div className="text-center min-w-16">
                  <div className="font-semibold text-foreground">
                    {pipeline?.item_count || pipeline?.conversations_count || 0}
                  </div>
                  <div className="text-muted-foreground">{t('kanban.header.conversations')}</div>
                </div>
                <div className="text-center min-w-14">
                  <div className="font-semibold text-foreground">{stages.length}</div>
                  <div className="text-muted-foreground">{t('kanban.header.stages')}</div>
                </div>
                {calculatePipelineTotal() > 0 && (
                  <div className="text-center min-w-20">
                    <div className="font-semibold text-green-600 dark:text-green-400 whitespace-nowrap">
                      R$ {formatCurrency(calculatePipelineTotal())}
                    </div>
                    <div className="text-muted-foreground">{t('kanban.header.totalValue')}</div>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setImportModalOpen(true)}
                  className="whitespace-nowrap"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Importar
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCSV}
                  className="whitespace-nowrap"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Exportar
                </Button>

                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleAddItem()}
                  className="whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('kanban.header.addItem')}
                </Button>

                {/* Pipeline Options Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleEditPipeline}>
                      <Edit className="h-4 w-4 mr-2" />
                      {t('kanban.header.editPipeline')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={async () => {
                        if (!pipeline?.id) return;
                        await navigator.clipboard.writeText(String(pipeline.id));
                        toast.success(t('kanban.idCopied'));
                      }}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      {t('kanban.copyId')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleReorderStages}>
                      <ArrowUpDown className="h-4 w-4 mr-2" />
                      {t('kanban.header.reorderStages')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={handleDeletePipeline}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t('kanban.header.deletePipeline')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Search & date filter bar */}
            <div className="flex flex-wrap items-center gap-2 pb-3">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nome, email ou telefone"
                  className="pl-9 pr-8 h-9"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <Button
                variant={showDateFilter || dateFrom || dateTo ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowDateFilter(v => !v)}
                className="whitespace-nowrap"
              >
                <CalendarClock className="w-4 h-4 mr-2" />
                Período
              </Button>

              {showDateFilter && (
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="h-9 w-auto"
                  />
                  <span className="text-muted-foreground text-sm">até</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="h-9 w-auto"
                  />
                  {(dateFrom || dateTo) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDateFrom('');
                        setDateTo('');
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-x-auto overflow-y-hidden px-4 sm:px-6 lg:px-8 py-6">
            {/* Kanban Content */}
            <div
              className="flex gap-6 h-full pb-6"
              style={{ width: 'fit-content', minWidth: '100%' }}
            >
              {/* Stage Columns */}
              {filteredStages.map((stage: PipelineStage) => (
                <div key={stage.id} className="w-80 flex-shrink-0">
                  <div className="bg-background rounded-xl shadow-sm border border-border h-full flex flex-col">
                    {/* Stage Header */}
                    <div
                      className="flex-shrink-0 px-4 py-3 border-b border-border bg-muted/50 rounded-t-xl border-t-4"
                      style={{ borderTopColor: stage.color }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: stage.color }}
                          />
                          <h3 className="text-sm font-medium text-foreground">{stage.name}</h3>
                          <span className="bg-muted text-muted-foreground text-xs px-2 py-1 rounded-full">
                            {stage.items?.length || stage.item_count || 0}
                          </span>
                          {/* Stage Total Value */}
                          {calculateStageTotal(stage.items) > 0 && (
                            <span className="bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-xs px-2 py-1 rounded-full font-medium">
                              {t('kanban.stage.totalValue', {
                                value: formatCurrency(calculateStageTotal(stage.items)),
                              })}
                            </span>
                          )}
                        </div>

                        {/* Stage Options */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-auto p-1">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditStage(stage)}>
                              <Edit className="h-4 w-4 mr-2" />
                              {t('kanban.stage.editStage')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async () => {
                                await navigator.clipboard.writeText(String(stage.id));
                                toast.success(t('kanban.idCopied'));
                              }}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              {t('kanban.copyId')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDeleteStage(stage)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t('kanban.stage.deleteStage')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Items Drop Zone */}
                    <div
                      className="flex-1 overflow-y-auto p-4 space-y-3"
                      onDragOver={handleDragOver}
                      onDrop={e => handleDrop(e, stage.id)}
                    >
                      {/* Items */}
                      {(stage.items || []).map(item => (
                        <div
                          key={item.id}
                          className="group bg-background rounded-xl p-4 border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer select-none relative"
                          draggable
                          onDragStart={() => handleDragStart(item)}
                          onDragEnd={handleDragEnd}
                          onClick={() => {
                            if (!isDraggingRef.current && Date.now() > suppressClickUntilRef.current) {
                              handleEditItem(item);
                            }
                          }}
                        >
                          {/* Card Options Menu */}
                          <div
                            className="absolute top-2 right-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center space-x-1">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-1 hover:bg-muted"
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEditItem(item)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    {t('kanban.item.editItem')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      await navigator.clipboard.writeText(String(item.id));
                                      toast.success(t('kanban.idCopied'));
                                    }}
                                  >
                                    <Copy className="h-4 w-4 mr-2" />
                                    {t('kanban.copyId')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedConversationForSchedule(item);
                                      setScheduleActionOpen(true);
                                    }}
                                  >
                                    <CalendarClock className="h-4 w-4 mr-2" />
                                    {t('kanban.item.scheduleAction')}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => handleRemoveItem(item)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    {t('kanban.item.removeFromPipeline')}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              <GripVertical className="w-4 h-4 text-muted-foreground" />
                            </div>
                          </div>

                          {/* Contact Info Header */}
                          <div className="flex items-start space-x-3 mb-3">
                            <div className="relative">
                              {resolveItemAvatar(item) ? (
                                <img
                                  src={resolveItemAvatar(item)}
                                  alt={resolveItemName(item)}
                                  className="w-10 h-10 rounded-full object-cover shadow-sm bg-muted"
                                  onError={e => {
                                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                                    const fb = e.currentTarget
                                      .nextElementSibling as HTMLElement | null;
                                    if (fb) fb.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div
                                className="w-10 h-10 rounded-full items-center justify-center text-white text-sm font-bold shadow-sm"
                                style={{
                                  backgroundColor: getContactColor(resolveItemName(item)),
                                  display: resolveItemAvatar(item) ? 'none' : 'flex',
                                }}
                              >
                                {resolveItemName(item)?.[0]?.toUpperCase() || 'U'}
                              </div>
                              {/* Online indicator */}
                              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-background rounded-full" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                <h4 className="text-sm font-semibold text-foreground truncate">
                                  {resolveItemName(item)}
                                </h4>
                                <span className="text-xs text-muted-foreground font-medium">
                                  #{item.conversation?.display_id}
                                </span>
                              </div>
                              {/* Tempo sem contato (medido pela conversa da instância WhatsApp) */}
                              {(() => {
                                const d = lastContactDays(item);
                                if (d == null || d < 3) return null;
                                const tone =
                                  d >= 7
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
                                return (
                                  <span
                                    title={`Última mensagem há ${d} dias`}
                                    className={`inline-flex items-center gap-1 mb-1 px-1.5 py-0.5 rounded-md text-xs font-semibold ${tone}`}
                                  >
                                    <Clock className="w-3 h-3" />
                                    {d}d sem contato
                                  </span>
                                );
                              })()}
                              {/* Visita agendada — mostra dia/hora se houver visita carregada, senão só a tag */}
                              {(itemVisitLabel(item) || hasVisitScheduled(item)) && (
                                <span
                                  title="Visita agendada"
                                  className="inline-flex items-center gap-1 mb-1 ml-1 px-1.5 py-0.5 rounded-md text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                >
                                  <CalendarClock className="w-3 h-3" />
                                  {itemVisitLabel(item) ? `Visita ${itemVisitLabel(item)}` : 'Visita agendada'}
                                </span>
                              )}
                              {/* Contact details */}
                              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                                {item.contact?.phone_number && (
                                  <span className="flex items-center space-x-1">
                                    <Phone className="w-3 h-3" />
                                    <span className="truncate max-w-20">
                                      {item.contact.phone_number}
                                    </span>
                                  </span>
                                )}
                                {item.contact?.email && (
                                  <span className="flex items-center space-x-1">
                                    <Mail className="w-3 h-3" />
                                    <span className="truncate max-w-20">{item.contact?.email}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Last Message Preview */}
                          {item.conversation?.last_non_activity_message?.content && (
                            <div className="mb-3 p-3 bg-muted/50 rounded-lg border border-border">
                              <div className="flex items-start space-x-2">
                                <MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center space-x-2 mb-1">
                                    <span className="text-xs font-medium text-foreground">
                                      {item.conversation.last_non_activity_message.sender?.name ||
                                        t('kanban.conversation.system')}
                                    </span>
                                  </div>
                                  <p
                                    className="text-sm text-foreground line-clamp-2 leading-relaxed [&_p]:inline [&_br]:hidden"
                                    dangerouslySetInnerHTML={{
                                      __html:
                                        item.conversation.last_non_activity_message
                                          .processed_message_content ||
                                        item.conversation.last_non_activity_message.content || '',
                                    }}
                                  />
                                  <div className="flex items-center justify-between mt-2">
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(
                                        typeof item.conversation.last_non_activity_message
                                          .created_at === 'number'
                                          ? item.conversation.last_non_activity_message.created_at *
                                            1000
                                          : item.conversation.last_non_activity_message.created_at,
                                      ).toLocaleString('pt-BR', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                    {item.conversation.last_non_activity_message?.message_type !==
                                      undefined && (
                                      <span className="text-xs text-muted-foreground">
                                        {item.conversation.last_non_activity_message
                                          .message_type === 0
                                          ? t('kanban.conversation.incoming', 'Incoming')
                                          : item.conversation.last_non_activity_message
                                              .message_type === 1
                                          ? t('kanban.conversation.outgoing', 'Outgoing')
                                          : ''}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Inbox and Status Row */}
                          <div className="flex items-center justify-between mb-3">
                            {!item.is_lead && (
                              <div className="flex items-center space-x-2 text-xs">
                                <div className="flex items-center space-x-1 px-2 py-1 bg-muted/50 rounded-md">
                                  <div className="w-3 h-3 text-muted-foreground">
                                    <svg fill="currentColor" viewBox="0 0 20 20">
                                      <path
                                        fillRule="evenodd"
                                        d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  </div>
                                  <span className="text-foreground font-medium truncate max-w-16">
                                    {item.conversation?.inbox?.name ||
                                      t('kanban.conversation.noInbox')}
                                  </span>
                                </div>
                              </div>
                            )}
                            {!item.is_lead && (
                              <div className="flex items-center space-x-2">
                                {/* Status badge */}
                                <span
                                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                                    item.conversation?.status === 'open'
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                      : item.conversation?.status === 'resolved'
                                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                                      : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                                  }`}
                                >
                                  {item.conversation?.status === 'open'
                                    ? t('kanban.conversation.status.open')
                                    : item.conversation?.status === 'resolved'
                                    ? t('kanban.conversation.status.resolved')
                                    : item.conversation?.status ||
                                      t('kanban.conversation.status.unknown')}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Services Total Value */}
                          {item.services_info?.has_services &&
                            item.services_info.total_value > 0 && (
                              <div className="mb-3 pt-2 border-t border-border">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                                    <div className="w-3 h-3">
                                      <svg fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                                        <path
                                          fillRule="evenodd"
                                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.51-1.31c-.562-.649-1.413-1.076-2.353-1.253V5z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                    </div>
                                    <span className="font-medium">
                                      {t('kanban.conversation.valueLabel')}
                                    </span>
                                  </div>
                                  <div className="text-xs font-semibold text-green-600 dark:text-green-400">
                                    {item.services_info.formatted_total}
                                  </div>
                                </div>
                              </div>
                            )}

                          {/* Tasks Summary - Compact and Visual */}
                          {(item.tasks_info?.pending_count > 0 ||
                            item.tasks_info?.overdue_count > 0 ||
                            item.tasks_info?.due_soon_count > 0 ||
                            item.tasks_info?.completed_count > 0) && (
                            <div className="mb-3 flex items-center gap-1.5 flex-wrap">
                              <div className="text-sm">{t('tasks.title')}</div>
                              {/* Tasks vencidas - Prioridade máxima */}
                              {item.tasks_info?.overdue_count > 0 && (
                                <Badge
                                  title={t('tasks.status.overdue')}
                                  variant="destructive"
                                  className="h-5 px-1.5 text-xs"
                                >
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  {item.tasks_info.overdue_count}
                                </Badge>
                              )}

                              {/* Tasks próximas do vencimento */}
                              {item.tasks_info?.due_soon_count > 0 && (
                                <Badge
                                  title={t('tasks.status.dueSoon')}
                                  className="h-5 px-1.5 text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400"
                                >
                                  <Clock className="w-3 h-3 mr-1" />
                                  {item.tasks_info.due_soon_count}
                                </Badge>
                              )}

                              {/* Tasks pendentes (sem urgência) */}
                              {item.tasks_info?.pending_count > 0 &&
                                !item.tasks_info?.overdue_count &&
                                !item.tasks_info?.due_soon_count && (
                                  <Badge
                                    title={t('tasks.status.pending')}
                                    variant="secondary"
                                    className="h-5 px-1.5 text-xs"
                                  >
                                    <ListTodo className="w-3 h-3 mr-1" />
                                    {item.tasks_info.pending_count}
                                  </Badge>
                                )}

                              {/* Tasks concluídas */}
                              {item.tasks_info?.completed_count > 0 && (
                                <Badge
                                  title={t('tasks.status.completed')}
                                  className="h-5 px-1.5 text-xs bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                                >
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  {item.tasks_info.completed_count}
                                </Badge>
                              )}
                            </div>
                          )}

                          {/* Time and assignee info */}
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-1 text-muted-foreground">
                              <div className="w-3 h-3">
                                <svg fill="currentColor" viewBox="0 0 20 20">
                                  <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </div>
                              <span title={t('kanban.item.arrivedAt', 'Lead chegou em')}>
                                {formatArrivalDate(item) ||
                                  (item.conversation?.last_activity_at
                                    ? new Date(
                                        item.conversation.last_activity_at * 1000,
                                      ).toLocaleDateString('pt-BR')
                                    : '')}
                              </span>
                            </div>

                            {/* Assignee */}
                            {item.conversation?.assignee && (
                              <div className="flex items-center space-x-1 text-muted-foreground">
                                <User className="w-3 h-3" />
                                <span className="truncate max-w-20">
                                  {item.conversation.assignee.name}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Empty state */}
                      {(!stage.items || stage.items.length === 0) && (
                        <div className="text-center py-8 text-muted-foreground">
                          <div className="text-sm">{t('kanban.stage.noConversations')}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Add Stage Column */}
              <div className="w-80 flex-shrink-0">
                <div
                  className="bg-muted/50 rounded-xl p-6 h-full border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors cursor-pointer"
                  onClick={() => setShowCreateStageModal(true)}
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <Plus className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-sm font-medium mb-1">{t('kanban.stage.addStage')}</h3>
                  <p className="text-xs text-center">{t('kanban.stage.addStageDescription')}</p>
                </div>
              </div>

              {/* Empty state for no stages */}
              {stages.length === 0 && (
                <div className="flex items-center justify-center w-full h-full">
                  <div className="text-center">
                    <div className="text-muted-foreground text-sm">
                      {t('kanban.stage.noStages')}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Pipeline Modal */}
      {pipeline && (
        <EditPipelineModal
          open={showEditPipelineModal}
          onOpenChange={setShowEditPipelineModal}
          pipeline={pipeline}
          onSubmit={handleUpdatePipeline}
          loading={isUpdatingPipeline}
        />
      )}

      {/* Create Stage Modal */}
      <CreateStageModal
        open={showCreateStageModal}
        onOpenChange={setShowCreateStageModal}
        onSubmit={handleCreateStage}
        loading={isCreatingStage}
      />

      {/* Add Item Modal */}
      {pipeline && (
        <AddItemModal
          open={showAddItemModal}
          onOpenChange={setShowAddItemModal}
          pipelineId={pipeline.id}
          stages={stages}
          preselectedStage={selectedStageForItem}
          onItemAdded={handleItemAdded}
        />
      )}

      {/* Import Leads Modal */}
      {pipeline && (
        <ImportLeadsModal
          open={importModalOpen}
          onOpenChange={setImportModalOpen}
          pipelineId={pipeline.id}
          pipelineName={pipeline.name}
          stages={stages}
          onImported={loadPipelineData}
        />
      )}

      {/* Remove Item Modal */}
      <RemoveItemModal
        open={showRemoveItemModal}
        onOpenChange={setShowRemoveItemModal}
        item={itemToRemove}
        onConfirm={handleConfirmRemoveItem}
        loading={isRemovingItem}
      />

      {/* Edit Item Modal */}
      {itemToEdit && (
        <EditItemModal
          open={showEditItemModal}
          onOpenChange={setShowEditItemModal}
          item={itemToEdit}
          stages={stages}
          pipeline={pipeline}
          onSubmit={handleUpdateItem}
          loading={isEditingItem}
        />
      )}

      {/* Edit Stage Modal */}
      <EditStageModal
        open={showEditStageModal}
        onOpenChange={setShowEditStageModal}
        stage={stageToEdit}
        onSubmit={handleUpdateStage}
        loading={isEditingStage}
      />

      {/* Delete Stage Modal */}
      <DeleteStageModal
        open={showDeleteStageModal}
        onOpenChange={setShowDeleteStageModal}
        stage={stageToDelete}
        itemCount={stageToDelete?.item_count || 0}
        onConfirm={handleConfirmDeleteStage}
        loading={isDeletingStage}
      />

      {/* Delete Pipeline Modal */}
      {pipeline && (
        <DeletePipelineModal
          open={showDeletePipelineModal}
          onOpenChange={setShowDeletePipelineModal}
          pipeline={pipeline}
          onConfirm={handleConfirmDeletePipeline}
          loading={isDeletingPipeline}
        />
      )}

      {/* Reorder Stages Modal */}
      <ReorderStagesModal
        open={showReorderStagesModal}
        onOpenChange={setShowReorderStagesModal}
        stages={stages}
        onSubmit={handleUpdateStageOrder}
        loading={isReorderingStages}
      />

      {/* Schedule Action Modal */}
      {selectedConversationForSchedule && scheduleActionContactId && (
        <ScheduleActionModal
          open={scheduleActionOpen}
          onClose={() => {
            setScheduleActionOpen(false);
            setSelectedConversationForSchedule(null);
          }}
          contactId={scheduleActionContactId}
        />
      )}
    </div>
  );
}
