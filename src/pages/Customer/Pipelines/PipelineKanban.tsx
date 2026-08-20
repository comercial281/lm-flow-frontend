import { useState, useRef, useEffect, useCallback, useMemo, Suspense } from 'react';
import { formatDateBR } from '@/utils/dateUtils';
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
} from '@/components/ui/ds';
import {
  ArrowLeft,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  ArrowUpDown,
  Phone,
  User,
  Search,
  X,
  Download,
  Upload,
  Megaphone,
  Archive,
  LayoutGrid,
  List as ListIcon,
  ChevronRight,
  ArrowDown,
  ArrowUp,
  Shuffle,
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
// PipelineSwitcher e PipelineFiltersPopover ficam no header/toolbar, sempre
// visíveis de cara (não são modais) — seguem import estático de propósito
// (lazy aqui só adicionaria uma requisição inútil).
import PipelineSwitcher from '@/components/pipelines/PipelineSwitcher';
import { useFeature } from '@/contexts/TenantFeaturesContext';
import PipelineFiltersPopover, {
  type TimePreset,
  type AbandonedPreset,
} from '@/components/pipelines/PipelineFiltersPopover';
import { getCachedPipeline, setCachedPipeline } from './pipelinePayloadCache';
import { useOpenLeadConversation } from '@/hooks/useOpenLeadConversation';
import { lazyWithRetry } from '@/utils/chunkReload';
// Card do board, sempre visível de cara — import estático de propósito.
import PipelineItemCard from './PipelineItemCard';
import {
  itemPos,
  itemTagInfos,
  itemTagNames,
  calculateStageTotal,
  lastContactDays,
  resolveItemName,
  resolveItemAvatar,
  resolveItemRef,
  getContactColor,
  formatArrivalDate,
} from './pipelineItemHelpers';
import { useAppDataStore } from '@/store/appDataStore';

// Os modais abaixo só aparecem quando o usuário clica em algo pra abrir —
// código deles não precisa estar no bundle inicial da página de Pipelines.
const EditPipelineModal = lazyWithRetry(() => import('@/components/pipelines/EditPipelineModal'));
const CreateStageModal = lazyWithRetry(() => import('@/components/pipelines/CreateStageModal'));
const AddItemModal = lazyWithRetry(() => import('@/components/pipelines/AddItemModal'));
const ImportLeadsModal = lazyWithRetry(() => import('@/components/pipelines/ImportLeadsModal'));
const BulkDispatchModal = lazyWithRetry(() => import('@/components/pipelines/BulkDispatchModal'));
const RemoveItemModal = lazyWithRetry(() => import('@/components/pipelines/RemoveItemModal'));
const EditItemModal = lazyWithRetry(() => import('@/components/pipelines/EditItemModal'));
const EditStageModal = lazyWithRetry(() => import('@/components/pipelines/EditStageModal'));
const DeleteStageModal = lazyWithRetry(() => import('@/components/pipelines/DeleteStageModal'));
const DeletePipelineModal = lazyWithRetry(() => import('@/components/pipelines/DeletePipelineModal'));
const ReorderStagesModal = lazyWithRetry(() => import('@/components/pipelines/ReorderStagesModal'));
const ScheduleActionModal = lazyWithRetry(() =>
  import('@/components/scheduledActions').then(m => ({ default: m.ScheduleActionModal })),
);
const NotesHistoryModal = lazyWithRetry(() =>
  import('@/components/pipelines/NotesHistoryModal').then(m => ({ default: m.NotesHistoryModal })),
);
const ArchivedLeadsModal = lazyWithRetry(() => import('@/components/pipelines/ArchivedLeadsModal'));

export default function PipelineKanban() {
  const { t } = useLanguage('pipelines');
  const { pipelineId } = useParams<{ pipelineId: string }>();
  const navigate = useNavigate();
  const {
    openLeadConversation,
    startConversationModal,
    opening: openingConversation,
  } = useOpenLeadConversation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Catálogo COMPLETO de etiquetas da conta, pro filtro de Tags — não dá pra
  // derivar só dos leads já carregados no board (ver allTags abaixo).
  const { labels: accountLabels, fetchLabels } = useAppDataStore();
  useEffect(() => {
    fetchLabels();
  }, [fetchLabels]);

  const [loading, setLoading] = useState(true);
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [allPipelines, setAllPipelines] = useState<Pipeline[]>([]);
  const [draggedItem, setDraggedItem] = useState<PipelineItem | null>(null);
  const isDraggingRef = useRef(false);
  const suppressClickUntilRef = useRef(0);

  // Scroll horizontal do board — feito por arrastar-pra-rolar e roda do mouse
  // (ver handlers abaixo). O scroll nativo é pouco descobrível no desktop.
  const boardScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll enquanto arrasta um card: chegar perto da borda do board rola
  // na horizontal (pra alcançar coluna escondida); perto do topo/fundo de uma
  // coluna rola a lista de cards dela. Usa setInterval (não rAF) pra rodar
  // independente de a aba estar visível ou não. dragPointer guarda a última
  // posição do cursor capturada no onDragOver.
  const dragPointerRef = useRef({ x: 0, y: 0, active: false });
  const autoScrollRef = useRef<number | null>(null);
  const stopAutoScroll = useCallback(() => {
    if (autoScrollRef.current != null) {
      clearInterval(autoScrollRef.current);
      autoScrollRef.current = null;
    }
    dragPointerRef.current = { x: 0, y: 0, active: false };
  }, []);
  const startAutoScroll = useCallback(() => {
    if (autoScrollRef.current != null) return;
    const EDGE = 90; // zona de borda (px) que ativa o scroll
    const SPEED = 14; // px por tick
    autoScrollRef.current = window.setInterval(() => {
      const board = boardScrollRef.current;
      const p = dragPointerRef.current;
      if (!board || !p.active) return;
      const r = board.getBoundingClientRect();
      // horizontal
      if (p.x < r.left + EDGE) board.scrollLeft -= SPEED;
      else if (p.x > r.right - EDGE) board.scrollLeft += SPEED;
      // vertical: a lista de cards da coluna sob o cursor
      const col = (document.elementFromPoint(p.x, p.y) as HTMLElement | null)?.closest(
        '[data-col-scroll]',
      ) as HTMLElement | null;
      if (col) {
        const cr = col.getBoundingClientRect();
        if (p.y < cr.top + EDGE) col.scrollTop -= SPEED;
        else if (p.y > cr.bottom - EDGE) col.scrollTop += SPEED;
      }
    }, 16);
  }, []);
  // Captura a posição do cursor durante o arraste (dragover do board inteiro).
  const handleBoardDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    dragPointerRef.current = { x: e.clientX, y: e.clientY, active: true };
  };

  // Arrastar-pra-rolar (pan): clicar no fundo do board e arrastar move na
  // horizontal — scroll lateral natural no desktop, sem depender de seta nem da
  // barrinha. Não inicia se o clique foi num card/botão/input (deixa o drag do
  // card e os cliques funcionarem normal).
  const panRef = useRef({ active: false, startX: 0, startScroll: 0, moved: false });
  const handleBoardMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const el = boardScrollRef.current;
    if (!el) return;
    if (
      (e.target as HTMLElement).closest(
        '[draggable="true"], button, a, input, textarea, select, [role="button"], [data-no-pan]',
      )
    ) {
      return;
    }
    panRef.current = { active: true, startX: e.clientX, startScroll: el.scrollLeft, moved: false };
    el.style.cursor = 'grabbing';
  };
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const p = panRef.current;
      if (!p.active) return;
      const el = boardScrollRef.current;
      if (!el) return;
      const dx = e.clientX - p.startX;
      if (Math.abs(dx) > 3) p.moved = true;
      el.scrollLeft = p.startScroll - dx;
    };
    const onUp = () => {
      const p = panRef.current;
      if (!p.active) return;
      p.active = false;
      const el = boardScrollRef.current;
      if (el) el.style.cursor = '';
      // bloqueia o clique fantasma logo após um arraste real
      if (p.moved) suppressClickUntilRef.current = Date.now() + 200;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  // Roda do mouse vertical vira scroll horizontal quando o cursor está sobre o
  // board mas fora de uma lista de cards (colunas têm scroll vertical próprio).
  const handleBoardWheel = (e: React.WheelEvent) => {
    if (e.deltaY === 0 || e.shiftKey) return;
    const overColumnList = (e.target as HTMLElement).closest('[data-col-scroll]');
    if (overColumnList) return; // deixa a roda rolar os cards da coluna
    const el = boardScrollRef.current;
    if (!el) return;
    el.scrollLeft += e.deltaY;
  };

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

  // Notes modal state
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [selectedContactForNotes, setSelectedContactForNotes] = useState<{
    id: string;
    name?: string;
  } | null>(null);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // Filtro por tempo (entrada do lead): atalhos rápidos + faixa personalizada.
  const [timePreset, setTimePreset] = useState<TimePreset>('all');
  // Filtro por tags: nomes selecionados (vazio = todas).
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  // #13 Detector de lead largado: limiar de dias sem contato escolhível (era
  // fixo em 7 dias) — pedido do Giovani (20/08).
  const [abandonedPreset, setAbandonedPreset] = useState<AbandonedPreset>('off');
  const [abandonedCustomDays, setAbandonedCustomDays] = useState('');
  // Filtro por colunas: ids de etapas ocultas (vazio = todas visíveis).
  const [hiddenStages, setHiddenStages] = useState<string[]>([]);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [disparoModalOpen, setDisparoModalOpen] = useState(false);
  const [archivedModalOpen, setArchivedModalOpen] = useState(false);

  // Modo de visualização do funil: quadro (Kanban) ou lista (todos os leads,
  // por ordem de chegada, com foto/tags/coluna/data — mais rápido pra escanear
  // o funil inteiro sem ficar rolando colunas).
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [listSortOrder, setListSortOrder] = useState<'desc' | 'asc'>('desc');

  // Feature flags por cliente (super-admin liga/desliga no painel Clientes CRM).
  const canImport = useFeature('pipeline_import');
  const canExport = useFeature('pipeline_export');
  const canAddItem = useFeature('pipeline_add_item');
  const canBulkDispatch = useFeature('bulk_campaigns');

  // Load pipeline data
  // silent=true: atualiza em segundo plano sem o spinner de tela cheia (usado
  // pelo refresh automático ao voltar pra aba e no poll), pra lead novo aparecer
  // sozinho sem o usuário recarregar a página.
  const loadPipelineData = useCallback(async (silent = false) => {
    if (!pipelineId) return;

    // Reabrir um pipe já visitado renderiza NA HORA com o último payload do
    // servidor e revalida silencioso por trás (stale-while-revalidate).
    const cached = getCachedPipeline(pipelineId);
    const showSpinner = !silent && !cached;
    if (!silent && cached) {
      setPipeline(cached);
      setStages(cached.stages || []);
      setLoading(false);
    }

    if (showSpinner) setLoading(true);
    try {
      // Load pipeline with all data (stages, items, tasks_info, services_info)
      const pipelineData = await pipelinesService.getPipeline(pipelineId);

      setCachedPipeline(pipelineId, pipelineData);
      setPipeline(pipelineData);
      setStages(pipelineData.stages || []);
    } catch (error) {
      console.error('Error loading pipeline data:', error);
      if (showSpinner) toast.error(t('kanban.messages.loadDataError'));
    } finally {
      if (showSpinner) setLoading(false);
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
      // Seletor só precisa de nome/cor/etapas/contagem — modo enxuto (sem itens).
      const response = await pipelinesService.getPipelines({ include_items: false });
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

  // Atualização automática (sem recarregar a página): lead novo aparece sozinho.
  // - ao voltar o foco pra aba / aba ficar visível: refresh silencioso na hora.
  // - a cada 60s enquanto a aba está visível: refresh silencioso.
  // Pula enquanto arrasta um card (não atrapalhar a reordenação otimista).
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      if (isDraggingRef.current) return;
      loadPipelineData(true);
      loadUpcomingVisits();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    const interval = window.setInterval(refresh, 60_000);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(interval);
    };
  }, [loadPipelineData, loadUpcomingVisits]);

  // AO VIVO (websocket): lead/mensagem nova chega pelo evento global 'lmflow:realtime'
  // (re-emitido pela conexão WS do app em useGlobalWebSocket). Refresh silencioso
  // com debounce de 1.5s pra colapsar rajadas (conversation.created + message.created
  // chegam juntos). O poll de 60s acima fica de rede de segurança se o WS cair.
  useEffect(() => {
    let timer: number | undefined;
    const onRealtime = () => {
      if (document.visibilityState !== 'visible' || isDraggingRef.current) return;
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (isDraggingRef.current) return;
        loadPipelineData(true);
        loadUpcomingVisits();
      }, 1500);
    };
    window.addEventListener('lmflow:realtime', onRealtime);
    return () => {
      window.removeEventListener('lmflow:realtime', onRealtime);
      clearTimeout(timer);
    };
  }, [loadPipelineData, loadUpcomingVisits]);

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

  // Drag and drop handlers.
  // Viram useCallback (referência estável) porque handleDragStart/handleCardDragOver/
  // handleCardDrop/handleDragEnd são passados como prop pro PipelineItemCard
  // memoizado — sem isso, cada render do board recriava a função e quebrava o
  // memo (card inteiro re-renderizava mesmo sem o item mudar).
  const handleDragStart = useCallback((item: PipelineItem) => {
    setDraggedItem(item);
    isDraggingRef.current = true;
    suppressClickUntilRef.current = Date.now() + 200;
    startAutoScroll();
  }, [startAutoScroll]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // Limpa o estado de arraste (reuso entre drop em coluna e em card).
  const finishDrag = useCallback(() => {
    setDraggedItem(null);
    isDraggingRef.current = false;
    suppressClickUntilRef.current = Date.now() + 200;
    stopAutoScroll();
  }, [stopAutoScroll]);

  // Onde o cursor está sobre o card alvo (metade de cima = acima, baixo = abaixo).
  const dragOverPosRef = useRef<'above' | 'below'>('above');

  // Move/reordena o card arrastado para targetStageId na position newPos,
  // inserindo no índice insertIdx (no array já SEM o card arrastado).
  // Atualização otimista + persistência via /reorder.
  const commitReorder = useCallback(async (targetStageId: string, newPos: number, insertIdx: number) => {
    if (!draggedItem || !pipelineId) {
      finishDrag();
      return;
    }
    const fromStageId = draggedItem.stage_id;
    const previousStages = stages;
    const moved = {
      ...draggedItem,
      stage_id: targetStageId,
      pipeline_stage_id: targetStageId,
      position: newPos,
    };
    const next = stages.map(stage => {
      let items = (stage.items || []).filter(i => i.id !== draggedItem.id);
      if (stage.id === targetStageId) {
        items = [...items];
        const idx = Math.max(0, Math.min(insertIdx, items.length));
        items.splice(idx, 0, moved);
      }
      return { ...stage, items };
    });
    setStages(next);

    try {
      await pipelinesService.reorderItem(pipelineId, draggedItem.id, {
        position: newPos,
        ...(fromStageId !== targetStageId ? { new_stage_id: targetStageId } : {}),
      });
    } catch (error) {
      console.error('Error reordering item:', error);
      setStages(previousStages);
      toast.error(t('kanban.messages.itemMoveError'));
    } finally {
      finishDrag();
    }
  }, [draggedItem, pipelineId, stages, t, finishDrag]);

  // Drop na área da coluna (fora de um card):
  // - outra coluna: lead vai pro TOPO da coluna destino.
  // - mesma coluna (área vazia abaixo dos cards): manda o card pro FUNDO.
  //   Sem isso, arrastar pro espaço vazio embaixo não fazia nada e dava a
  //   impressão de que o card "não desce".
  const handleDrop = useCallback((e: React.DragEvent, targetStageId: string) => {
    e.preventDefault();
    if (!draggedItem) return;
    const targetStage = stages.find(s => s.id === targetStageId);
    const items = (targetStage?.items || []).filter(i => i.id !== draggedItem.id);
    if (draggedItem.stage_id === targetStageId) {
      // mesma coluna: já está sozinho na coluna → nada a fazer
      if (!items.length) {
        finishDrag();
        return;
      }
      // fundo da coluna: position menor que a do último card
      const newPos = itemPos(items[items.length - 1]) - 1;
      void commitReorder(targetStageId, newPos, items.length);
      return;
    }
    const newPos = items.length ? itemPos(items[0]) + 1 : Date.now() / 1000;
    void commitReorder(targetStageId, newPos, 0);
  }, [draggedItem, stages, commitReorder, finishDrag]);

  // Marca acima/abaixo conforme a metade do card sob o cursor.
  const handleCardDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragOverPosRef.current = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
  }, []);

  // Drop em cima de um card: insere acima/abaixo dele e grava a position no
  // ponto médio entre os vizinhos (ou topo+1 / fundo-1 nas pontas).
  const handleCardDrop = useCallback((e: React.DragEvent, targetItem: PipelineItem, targetStageId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem || draggedItem.id === targetItem.id) {
      finishDrag();
      return;
    }
    const where = dragOverPosRef.current;
    const targetStage = stages.find(s => s.id === targetStageId);
    if (!targetStage) {
      finishDrag();
      return;
    }
    const arr = (targetStage.items || []).filter(i => i.id !== draggedItem.id);
    const at = arr.findIndex(i => i.id === targetItem.id);
    if (at < 0) {
      finishDrag();
      return;
    }
    const insertIdx = where === 'above' ? at : at + 1;
    const above = arr[insertIdx - 1];
    const below = arr[insertIdx];
    let newPos: number;
    if (!above) newPos = itemPos(below) + 1;
    else if (!below) newPos = itemPos(above) - 1;
    else newPos = (itemPos(above) + itemPos(below)) / 2;
    void commitReorder(targetStageId, newPos, insertIdx);
  }, [draggedItem, stages, commitReorder, finishDrag]);

  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false;
    suppressClickUntilRef.current = Date.now() + 200;
    stopAutoScroll();
  }, [stopAutoScroll]);

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

  // Mesma data de chegada de formatArrivalDate, mas em epoch ms — pra ordenar
  // a Lista por ordem de chegada real (não confundir com `position`, que é a
  // ordem manual de arraste dentro da coluna do Kanban). Fica local: não é
  // usada pelo card extraído.
  const itemArrivalMs = (item: PipelineItem): number => {
    if (typeof item.entered_at === 'number') return item.entered_at * 1000;
    if (typeof item.created_at === 'number') return item.created_at * 1000;
    return item.created_at ? new Date(item.created_at).getTime() : 0;
  };

  // Todas as etiquetas da conta (catálogo completo — não só as que já aparecem
  // em algum card carregado neste pipeline; ver comentário acima em accountLabels).
  const allTags = useMemo(() => {
    return accountLabels
      .map(l => ({ name: l.title, color: l.color }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [accountLabels]);

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

  const handleRemoveItem = useCallback((item: PipelineItem) => {
    setItemToRemove(item);
    setShowRemoveItemModal(true);
  }, []);

  // Remove o card do board no estado (otimista), sem reload — usado ao arquivar.
  const removeItemFromBoardLocal = useCallback((itemId: string) => {
    setStages(prev =>
      prev.map(stage => ({
        ...stage,
        items: (stage.items || []).filter(i => String(i.id) !== String(itemId)),
      })),
    );
  }, []);

  // Arquivar = soft-hide: some do board na hora, fica em "Arquivados".
  const handleArchiveItem = useCallback(async (item: PipelineItem) => {
    if (!pipelineId) return;
    removeItemFromBoardLocal(item.id);
    try {
      await pipelinesService.archiveItem(pipelineId, item.id);
      toast.success('Lead arquivado');
    } catch {
      toast.error('Erro ao arquivar');
      loadPipelineData(true);
    }
  }, [pipelineId, removeItemFromBoardLocal, loadPipelineData]);

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

  const handleEditItem = useCallback((item: PipelineItem) => {
    setItemToEdit(item);
    setShowEditItemModal(true);
  }, []);

  // Ações do menu do card (extraídas do JSX inline pra referência estável — useCallback).
  const handleOpenScheduleAction = useCallback((item: PipelineItem) => {
    setSelectedConversationForSchedule(item);
    setScheduleActionOpen(true);
  }, []);

  const handleOpenNotesForItem = useCallback((item: PipelineItem) => {
    const contactId = item.contact?.id ?? item.conversation?.contact?.id;
    const contactName = item.contact?.name ?? item.conversation?.contact?.name;
    if (contactId) {
      setSelectedContactForNotes({ id: contactId, name: contactName });
      setNotesModalOpen(true);
    }
  }, []);

  // Move otimista do card pra outra etapa, SEM reload (fluido igual o arrastar).
  // Usado pelas ações do card no modal ("Mover para coluna", "Ganho/Perdido")
  // e pela mudança de Fase ao salvar. O card pula de coluna na hora; o refresh
  // de dados acontece em segundo plano (silencioso), sem piscar a tela.
  const moveItemToStageLocal = useCallback((itemId: string, toStageId: string) => {
    if (!toStageId) return;
    setStages(prev => {
      let moved: PipelineItem | undefined;
      const without = prev.map(stage => ({
        ...stage,
        items: (stage.items || []).filter(i => {
          if (String(i.id) === String(itemId)) {
            moved = { ...i, stage_id: toStageId, pipeline_stage_id: toStageId } as PipelineItem;
            return false;
          }
          return true;
        }),
      }));
      if (!moved) return prev;
      return without.map(stage =>
        String(stage.id) === String(toStageId)
          ? { ...stage, items: [moved as PipelineItem, ...(stage.items || [])] }
          : stage,
      );
    });
    // Mantém o card aberto coerente com a nova etapa.
    setItemToEdit(prev =>
      prev && String(prev.id) === String(itemId)
        ? ({ ...prev, stage_id: toStageId, pipeline_stage_id: toStageId } as PipelineItem)
        : prev,
    );
  }, []);

  const handleUpdateItem = async (data: {
    notes: string;
    stage_id: string;
    services: Array<{ name: string; value: string }>;
    currency: string;
    custom_attributes?: Record<string, unknown>;
  }) => {
    if (!itemToEdit || !pipelineId) return;

    const movedId = itemToEdit.id;
    const stageChanged = String(itemToEdit.stage_id) !== String(data.stage_id);

    setIsEditingItem(true);
    try {
      await pipelinesService.updateItemInPipeline(pipelineId, movedId, {
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
      // Move otimista na hora + refresh silencioso (sem o spinner de tela cheia
      // que dava a sensação de "recarregar a página").
      if (stageChanged) moveItemToStageLocal(movedId, data.stage_id);
      await loadPipelineData(true);
    } catch (error) {
      console.error('Error updating item:', error);
      toast.error(t('kanban.messages.itemUpdateError'));
      await loadPipelineData(true);
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

  // Faixa de tempo (entrada do lead) derivada do atalho escolhido.
  const timeRange = useMemo(() => {
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    switch (timePreset) {
      case 'today':
        return { from: startOfToday.getTime(), to: null as number | null };
      case '7d':
        return { from: now - 7 * 86_400_000, to: null as number | null };
      case '30d':
        return { from: now - 30 * 86_400_000, to: null as number | null };
      case 'custom':
        return {
          from: dateFrom ? new Date(dateFrom).getTime() : null,
          to: dateTo ? new Date(dateTo + 'T23:59:59').getTime() : null,
        };
      default:
        return { from: null as number | null, to: null as number | null };
    }
  }, [timePreset, dateFrom, dateTo]);

  // Limiar de dias sem contato pro filtro "Largados" — null = filtro desligado.
  const abandonedThresholdDays = useMemo(() => {
    if (abandonedPreset === 'off') return null;
    if (abandonedPreset === 'custom') {
      const n = parseInt(abandonedCustomDays, 10);
      return Number.isFinite(n) && n > 0 ? n : 7;
    }
    return parseInt(abandonedPreset, 10);
  }, [abandonedPreset, abandonedCustomDays]);

  // Quantos filtros estão ativos (pro botão "Limpar" e badges).
  const activeFilterCount =
    (searchQuery ? 1 : 0) +
    (timePreset !== 'all' ? 1 : 0) +
    (selectedTags.length ? 1 : 0) +
    (abandonedThresholdDays != null ? 1 : 0) +
    (hiddenStages.length ? 1 : 0);
  const clearAllFilters = () => {
    setSearchQuery('');
    setTimePreset('all');
    setDateFrom('');
    setDateTo('');
    setSelectedTags([]);
    setAbandonedPreset('off');
    setAbandonedCustomDays('');
    setHiddenStages([]);
  };

  // Filtra etapas por colunas ocultas e itens por busca + tempo + tags.
  const filteredStages = useMemo(() => {
    const visible = stages.filter(s => !hiddenStages.includes(s.id));
    const q = searchQuery.toLowerCase();
    const { from, to } = timeRange;
    if (!q && !from && !to && selectedTags.length === 0 && abandonedThresholdDays == null) return visible;
    return visible.map(stage => ({
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
        const tags = itemTagNames(item);
        const matchesTags =
          selectedTags.length === 0 || selectedTags.some(t => tags.includes(t));
        // Largado = sem contato há N+ dias (limiar escolhido no filtro).
        const d = lastContactDays(item);
        const matchesAbandoned = abandonedThresholdDays == null || (d != null && d >= abandonedThresholdDays);
        return matchesSearch && matchesFrom && matchesTo && matchesTags && matchesAbandoned;
      }),
    }));
  }, [stages, searchQuery, timeRange, selectedTags, hiddenStages, abandonedThresholdDays]);

  // Visão em Lista: todos os leads do funil (respeitando os mesmos filtros do
  // Kanban acima) numa lista única, por ordem de chegada, com a coluna atual
  // de cada um.
  const allListItems = useMemo(() => {
    const rows = filteredStages.flatMap(stage =>
      (stage.items || []).map(item => ({ item, stage })),
    );
    rows.sort((a, b) => {
      const diff = itemArrivalMs(a.item) - itemArrivalMs(b.item);
      return listSortOrder === 'asc' ? diff : -diff;
    });
    return rows;
  }, [filteredStages, listSortOrder]);

  // Garante que o auto-scroll do drag pare se o componente desmontar no meio.
  useEffect(() => stopAutoScroll, [stopAutoScroll]);

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
          ? formatDateBR(item.entered_at * 1000)
          : formatDateBR(item.created_at),
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
            <div className="flex flex-col gap-3 py-3 lg:min-h-16 lg:flex-row lg:items-center lg:justify-between lg:py-2">
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
              <div className="flex w-full flex-wrap items-center justify-end gap-1.5 sm:gap-2 lg:gap-3 text-xs sm:text-sm lg:w-auto xl:flex-nowrap">
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
                <div className="text-center">
                  <div className="font-semibold text-foreground leading-tight">
                    {pipeline?.item_count || pipeline?.conversations_count || 0}
                  </div>
                  <div className="hidden sm:block text-muted-foreground">{t('kanban.header.conversations')}</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-foreground leading-tight">{stages.length}</div>
                  <div className="hidden sm:block text-muted-foreground">{t('kanban.header.stages')}</div>
                </div>
                {calculatePipelineTotal() > 0 && (
                  <div className="hidden md:block text-center">
                    <div className="font-semibold text-green-600 dark:text-green-400 whitespace-nowrap leading-tight">
                      R$ {formatCurrency(calculatePipelineTotal())}
                    </div>
                    <div className="text-muted-foreground">{t('kanban.header.totalValue')}</div>
                  </div>
                )}
                {/* Botões secundários: só em telas largas (xl). Abaixo disso vão pro menu. */}
                {canImport && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setImportModalOpen(true)}
                    className="hidden xl:inline-flex whitespace-nowrap"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Importar
                  </Button>
                )}

                {canExport && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportCSV}
                    className="hidden xl:inline-flex whitespace-nowrap"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Exportar
                  </Button>
                )}

                {canBulkDispatch && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDisparoModalOpen(true)}
                    className="hidden xl:inline-flex whitespace-nowrap"
                  >
                    <Megaphone className="w-4 h-4 mr-2" />
                    Disparo em massa
                  </Button>
                )}

                {canAddItem && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleAddItem()}
                    className="whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">{t('kanban.header.addItem')}</span>
                  </Button>
                )}

                {/* Pipeline Options Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {/* Ações que somem da barra em telas < xl ficam acessíveis aqui */}
                    {canImport && (
                      <DropdownMenuItem className="xl:hidden" onClick={() => setImportModalOpen(true)}>
                        <Upload className="h-4 w-4 mr-2" />
                        Importar
                      </DropdownMenuItem>
                    )}
                    {canExport && (
                      <DropdownMenuItem className="xl:hidden" onClick={handleExportCSV}>
                        <Download className="h-4 w-4 mr-2" />
                        Exportar
                      </DropdownMenuItem>
                    )}
                    {canBulkDispatch && (
                      <DropdownMenuItem className="xl:hidden" onClick={() => setDisparoModalOpen(true)}>
                        <Megaphone className="h-4 w-4 mr-2" />
                        Disparo em massa
                      </DropdownMenuItem>
                    )}
                    {(canImport || canExport || canBulkDispatch) && <DropdownMenuSeparator className="xl:hidden" />}
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
                    <DropdownMenuItem onClick={() => setArchivedModalOpen(true)}>
                      <Archive className="h-4 w-4 mr-2" />
                      Leads arquivados
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

              {/* Filtros unificados: Tempo, Tags, Largados (limiar escolhível) e
                  Colunas num só popup — antes eram 4 botões brigando por
                  espaço na barra (pedido do Giovani, 20/08). */}
              <PipelineFiltersPopover
                timePreset={timePreset}
                onTimePresetChange={setTimePreset}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateFromChange={setDateFrom}
                onDateToChange={setDateTo}
                allTags={allTags}
                selectedTags={selectedTags}
                onSelectedTagsChange={setSelectedTags}
                abandonedPreset={abandonedPreset}
                onAbandonedPresetChange={setAbandonedPreset}
                abandonedCustomDays={abandonedCustomDays}
                onAbandonedCustomDaysChange={setAbandonedCustomDays}
                stages={stages.map(s => ({ id: s.id, name: s.name, color: s.color }))}
                hiddenStages={hiddenStages}
                onHiddenStagesChange={setHiddenStages}
                activeFilterCount={activeFilterCount}
                onClearAll={clearAllFilters}
              />

              {/* Alternar visualização: Quadro (Kanban) ou Lista (todos os leads) */}
              <div className="ml-auto flex items-center border rounded-lg">
                <Button
                  variant={viewMode === 'board' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('board')}
                  className="border-0 rounded-r-none whitespace-nowrap"
                  title="Visualização em quadro"
                >
                  <LayoutGrid className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Quadro</span>
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="border-0 rounded-l-none whitespace-nowrap"
                  title="Visualização em lista"
                >
                  <ListIcon className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Lista</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Kanban Board */}
        {viewMode === 'board' && (
        <div className="flex-1 overflow-hidden relative">
          <div
            ref={boardScrollRef}
            className="h-full overflow-x-auto overflow-y-hidden px-4 sm:px-6 lg:px-8 py-6 cursor-grab"
            onDragOver={handleBoardDragOver}
            onMouseDown={handleBoardMouseDown}
            onWheel={handleBoardWheel}
          >
            {/* Kanban Content */}
            <div
              className="flex gap-6 h-full pb-6"
              style={{ width: 'fit-content', minWidth: '100%' }}
            >
              {/* Stage Columns */}
              {filteredStages.map((stage: PipelineStage) => (
                <div key={stage.id} className="w-80 flex-shrink-0">
                  <div className="bg-muted/40 rounded-xl shadow-sm border border-border h-full flex flex-col">
                    {/* Stage Header */}
                    <div
                      className="flex-shrink-0 px-4 py-3 border-b border-border rounded-t-xl border-t-4"
                      style={{
                        borderTopColor: stage.color,
                        backgroundColor: stage.color?.startsWith('#')
                          ? `${stage.color}1f`
                          : undefined,
                      }}
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
                      data-col-scroll
                      className="flex-1 overflow-y-auto p-4 space-y-3"
                      onDragOver={handleDragOver}
                      onDrop={e => handleDrop(e, stage.id)}
                    >
                      {/* Items */}
                      {(stage.items || []).map(item => (
                        <PipelineItemCard
                          key={item.id}
                          item={item}
                          stageId={stage.id}
                          visitsByContact={visitsByContact}
                          isDraggingRef={isDraggingRef}
                          suppressClickUntilRef={suppressClickUntilRef}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                          onCardDragOver={handleCardDragOver}
                          onCardDrop={handleCardDrop}
                          onOpenItem={handleEditItem}
                          onEdit={handleEditItem}
                          onArchive={handleArchiveItem}
                          onRemove={handleRemoveItem}
                          onScheduleAction={handleOpenScheduleAction}
                          onNotesClick={handleOpenNotesForItem}
                          onOpenConversation={openLeadConversation}
                          openingConversation={openingConversation}
                        />
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
        )}

        {/* Lista: todos os leads do funil, por ordem de chegada */}
        {viewMode === 'list' && (
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
            {allListItems.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                {t('kanban.stage.noConversations')}
              </div>
            ) : (
              <div className="bg-background rounded-xl border border-border overflow-hidden">
                {/* Header da lista */}
                <div className="flex items-center gap-4 px-4 py-2.5 border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground">
                  <div className="flex-1 min-w-0">Lead</div>
                  <div className="hidden md:block w-40 shrink-0">Coluna</div>
                  <div className="hidden xl:block w-44 shrink-0">Responsável</div>
                  <div className="hidden lg:flex w-48 shrink-0 flex-wrap gap-1">Tags</div>
                  <button
                    type="button"
                    onClick={() => setListSortOrder(o => (o === 'asc' ? 'desc' : 'asc'))}
                    className="w-24 shrink-0 flex items-center gap-1 text-right justify-end hover:text-foreground"
                    title="Ordenar por data de chegada"
                  >
                    Chegou
                    {listSortOrder === 'asc' ? (
                      <ArrowUp className="w-3 h-3" />
                    ) : (
                      <ArrowDown className="w-3 h-3" />
                    )}
                  </button>
                  <div className="w-4 shrink-0" />
                </div>

                {/* Linhas */}
                <div className="divide-y divide-border">
                  {allListItems.map(({ item, stage }) => (
                    <div
                      key={item.id}
                      onClick={() => handleEditItem(item)}
                      className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors"
                    >
                      {/* Foto + nome + telefone */}
                      <div className="flex-1 min-w-0 flex items-center gap-3">
                        <div className="relative shrink-0">
                          {resolveItemAvatar(item) ? (
                            <img
                              src={resolveItemAvatar(item)}
                              alt={resolveItemName(item, t)}
                              className="w-9 h-9 rounded-full object-cover shadow-sm bg-muted"
                              onError={e => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                                const fb = e.currentTarget
                                  .nextElementSibling as HTMLElement | null;
                                if (fb) fb.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div
                            className="w-9 h-9 rounded-full items-center justify-center text-white text-xs font-bold shadow-sm"
                            style={{
                              backgroundColor: getContactColor(resolveItemName(item, t)),
                              display: resolveItemAvatar(item) ? 'none' : 'flex',
                            }}
                          >
                            {resolveItemName(item, t)?.[0]?.toUpperCase() || 'U'}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground truncate">
                              {resolveItemName(item, t)}
                            </span>
                            <span className="shrink-0 text-[10px] text-muted-foreground/60 font-medium">
                              #{resolveItemRef(item).slice(0, 6)}
                            </span>
                          </div>
                          {item.contact?.phone_number && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="w-3 h-3 shrink-0" />
                              <span className="truncate">{item.contact.phone_number}</span>
                            </div>
                          )}
                          {/* Coluna — visível só no mobile (colunas escondem a partir de md) */}
                          <div className="md:hidden mt-1">
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                              style={{ backgroundColor: `${stage.color}22`, color: stage.color }}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: stage.color }}
                              />
                              {stage.name}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Coluna atual */}
                      <div className="hidden md:block w-40 shrink-0">
                        <span
                          className="inline-flex items-center gap-1.5 max-w-full rounded-full px-2 py-1 text-xs font-medium"
                          style={{ backgroundColor: `${stage.color}22`, color: stage.color }}
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: stage.color }}
                          />
                          <span className="truncate">{stage.name}</span>
                        </span>
                      </div>

                      {/* Responsável + roleta de origem */}
                      <div className="hidden xl:block w-44 shrink-0 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          {(item.assignee ?? item.conversation?.assignee) ? (
                            <>
                              {(item.assignee ?? item.conversation?.assignee)?.avatar_url ? (
                                <img
                                  src={(item.assignee ?? item.conversation?.assignee)?.avatar_url}
                                  alt=""
                                  className="w-3.5 h-3.5 rounded-full object-cover shrink-0"
                                />
                              ) : (
                                <User className="w-3 h-3 shrink-0" />
                              )}
                              <span className="truncate">
                                {(item.assignee ?? item.conversation?.assignee)?.name}
                              </span>
                            </>
                          ) : (
                            <span className="text-muted-foreground/50">Sem responsável</span>
                          )}
                        </div>
                        {item.roleta?.inbox_name && (
                          <div className="flex items-center gap-1.5 text-muted-foreground/70 mt-0.5">
                            <Shuffle className="w-3 h-3 shrink-0" />
                            <span className="truncate" title={`Veio da roleta: ${item.roleta.inbox_name}`}>
                              {item.roleta.inbox_name}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Tags */}
                      <div className="hidden lg:flex w-48 shrink-0 flex-wrap gap-1">
                        {itemTagInfos(item).slice(0, 3).map(tag => (
                          <span
                            key={tag.name}
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                            style={{ backgroundColor: `${tag.color}22`, color: tag.color }}
                          >
                            {tag.name}
                          </span>
                        ))}
                        {itemTagInfos(item).length > 3 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{itemTagInfos(item).length - 3}
                          </span>
                        )}
                      </div>

                      {/* Data de chegada */}
                      <div className="w-24 shrink-0 text-right text-xs text-muted-foreground">
                        {formatArrivalDate(item) || '-'}
                      </div>

                      <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground/50" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Pipeline Modal */}
      {pipeline && (
        <Suspense fallback={null}>
          <EditPipelineModal
            open={showEditPipelineModal}
            onOpenChange={setShowEditPipelineModal}
            pipeline={pipeline}
            onSubmit={handleUpdatePipeline}
            loading={isUpdatingPipeline}
          />
        </Suspense>
      )}

      {/* Create Stage Modal */}
      <Suspense fallback={null}>
        <CreateStageModal
          open={showCreateStageModal}
          onOpenChange={setShowCreateStageModal}
          onSubmit={handleCreateStage}
          loading={isCreatingStage}
        />
      </Suspense>

      {/* Add Item Modal */}
      {pipeline && (
        <Suspense fallback={null}>
          <AddItemModal
            open={showAddItemModal}
            onOpenChange={setShowAddItemModal}
            pipelineId={pipeline.id}
            stages={stages}
            preselectedStage={selectedStageForItem}
            onItemAdded={handleItemAdded}
          />
        </Suspense>
      )}

      {/* Import Leads Modal */}
      {pipeline && (
        <Suspense fallback={null}>
          <ImportLeadsModal
            open={importModalOpen}
            onOpenChange={setImportModalOpen}
            pipelineId={pipeline.id}
            pipelineName={pipeline.name}
            stages={stages}
            onImported={loadPipelineData}
          />
        </Suspense>
      )}

      {/* Disparo em Massa Modal */}
      {pipeline && (
        <Suspense fallback={null}>
          <BulkDispatchModal
            open={disparoModalOpen}
            onOpenChange={setDisparoModalOpen}
            pipelineId={pipeline.id}
            pipelineName={pipeline.name}
            stages={stages}
          />
        </Suspense>
      )}

      {/* Leads Arquivados Modal */}
      {pipeline && (
        <Suspense fallback={null}>
          <ArchivedLeadsModal
            open={archivedModalOpen}
            onClose={() => setArchivedModalOpen(false)}
            pipelineId={pipeline.id}
            onUnarchived={() => loadPipelineData(true)}
          />
        </Suspense>
      )}

      {/* Remove Item Modal */}
      <Suspense fallback={null}>
        <RemoveItemModal
          open={showRemoveItemModal}
          onOpenChange={setShowRemoveItemModal}
          item={itemToRemove}
          onConfirm={handleConfirmRemoveItem}
          loading={isRemovingItem}
        />
      </Suspense>

      {/* Edit Item Modal */}
      {itemToEdit && (
        <Suspense fallback={null}>
          <EditItemModal
            open={showEditItemModal}
            onOpenChange={setShowEditItemModal}
            item={itemToEdit}
            stages={stages}
            pipeline={pipeline}
            onSubmit={handleUpdateItem}
            onItemStageMoved={moveItemToStageLocal}
            // Tag grava na hora: recarrega em silêncio pro selo do card refletir a
            // mudança mesmo que a pessoa feche o card sem salvar.
            onLabelsChanged={() => { void loadPipelineData(true); }}
            loading={isEditingItem}
          />
        </Suspense>
      )}

      {/* Iniciar conversa — só monta para lead que ainda não tem conversa */}
      {startConversationModal}

      {/* Edit Stage Modal */}
      <Suspense fallback={null}>
        <EditStageModal
          open={showEditStageModal}
          onOpenChange={setShowEditStageModal}
          stage={stageToEdit}
          onSubmit={handleUpdateStage}
          loading={isEditingStage}
        />
      </Suspense>

      {/* Delete Stage Modal */}
      <Suspense fallback={null}>
        <DeleteStageModal
          open={showDeleteStageModal}
          onOpenChange={setShowDeleteStageModal}
          stage={stageToDelete}
          itemCount={stageToDelete?.item_count || 0}
          onConfirm={handleConfirmDeleteStage}
          loading={isDeletingStage}
        />
      </Suspense>

      {/* Delete Pipeline Modal */}
      {pipeline && (
        <Suspense fallback={null}>
          <DeletePipelineModal
            open={showDeletePipelineModal}
            onOpenChange={setShowDeletePipelineModal}
            pipeline={pipeline}
            onConfirm={handleConfirmDeletePipeline}
            loading={isDeletingPipeline}
          />
        </Suspense>
      )}

      {/* Reorder Stages Modal */}
      <Suspense fallback={null}>
        <ReorderStagesModal
          open={showReorderStagesModal}
          onOpenChange={setShowReorderStagesModal}
          stages={stages}
          onSubmit={handleUpdateStageOrder}
          loading={isReorderingStages}
        />
      </Suspense>

      {/* Schedule Action Modal */}
      {selectedConversationForSchedule && scheduleActionContactId && (
        <Suspense fallback={null}>
          <ScheduleActionModal
            open={scheduleActionOpen}
            onClose={() => {
              setScheduleActionOpen(false);
              setSelectedConversationForSchedule(null);
            }}
            contactId={scheduleActionContactId}
          />
        </Suspense>
      )}

      {/* Notes History Modal */}
      {selectedContactForNotes && (
        <Suspense fallback={null}>
          <NotesHistoryModal
            isOpen={notesModalOpen}
            contactId={selectedContactForNotes.id}
            contactName={selectedContactForNotes.name}
            onClose={() => {
              setNotesModalOpen(false);
              setSelectedContactForNotes(null);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
