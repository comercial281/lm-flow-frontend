import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { formatDateBR } from '@/utils/dateUtils';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useLanguage } from '@/hooks/useLanguage';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
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
  MessageCircle,
  Megaphone,
  Archive,
  Home,
  Tag,
  Columns3,
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
import BulkDispatchModal from '@/components/pipelines/BulkDispatchModal';
import { useFeature } from '@/contexts/TenantFeaturesContext';
import RemoveItemModal from '@/components/pipelines/RemoveItemModal';
import EditItemModal from '@/components/pipelines/EditItemModal';
import EditStageModal from '@/components/pipelines/EditStageModal';
import DeleteStageModal from '@/components/pipelines/DeleteStageModal';
import DeletePipelineModal from '@/components/pipelines/DeletePipelineModal';
import ReorderStagesModal from '@/components/pipelines/ReorderStagesModal';
import { ScheduleActionModal } from '@/components/scheduledActions';
import { NotesHistoryModal } from '@/components/pipelines/NotesHistoryModal';
import ArchivedLeadsModal from '@/components/pipelines/ArchivedLeadsModal';

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
  const [timePreset, setTimePreset] = useState<'all' | 'today' | '7d' | '30d' | 'custom'>('all');
  // Filtro por tags: nomes selecionados (vazio = todas).
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  // Filtro por colunas: ids de etapas ocultas (vazio = todas visíveis).
  const [hiddenStages, setHiddenStages] = useState<string[]>([]);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [disparoModalOpen, setDisparoModalOpen] = useState(false);
  const [archivedModalOpen, setArchivedModalOpen] = useState(false);

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

    if (!silent) setLoading(true);
    try {
      // Load pipeline with all data (stages, items, tasks_info, services_info)
      const pipelineData = await pipelinesService.getPipeline(pipelineId);

      setPipeline(pipelineData);
      setStages(pipelineData.stages || []);
    } catch (error) {
      console.error('Error loading pipeline data:', error);
      if (!silent) toast.error(t('kanban.messages.loadDataError'));
    } finally {
      if (!silent) setLoading(false);
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

  // Drag and drop handlers
  const handleDragStart = (item: PipelineItem) => {
    setDraggedItem(item);
    isDraggingRef.current = true;
    suppressClickUntilRef.current = Date.now() + 200;
    startAutoScroll();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Limpa o estado de arraste (reuso entre drop em coluna e em card).
  const finishDrag = () => {
    setDraggedItem(null);
    isDraggingRef.current = false;
    suppressClickUntilRef.current = Date.now() + 200;
    stopAutoScroll();
  };

  // Valor de ordenação do card: position quando existe, senão a chegada
  // (entered_at/created_at em epoch). Mesma escala em ambos (segundos).
  const itemPos = (it: PipelineItem): number =>
    typeof it.position === 'number'
      ? it.position
      : typeof it.entered_at === 'number'
      ? it.entered_at
      : new Date(it.created_at).getTime() / 1000;

  // Onde o cursor está sobre o card alvo (metade de cima = acima, baixo = abaixo).
  const dragOverPosRef = useRef<'above' | 'below'>('above');

  // Move/reordena o card arrastado para targetStageId na position newPos,
  // inserindo no índice insertIdx (no array já SEM o card arrastado).
  // Atualização otimista + persistência via /reorder.
  const commitReorder = async (targetStageId: string, newPos: number, insertIdx: number) => {
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
  };

  // Drop na área da coluna (fora de um card):
  // - outra coluna: lead vai pro TOPO da coluna destino.
  // - mesma coluna (área vazia abaixo dos cards): manda o card pro FUNDO.
  //   Sem isso, arrastar pro espaço vazio embaixo não fazia nada e dava a
  //   impressão de que o card "não desce".
  const handleDrop = (e: React.DragEvent, targetStageId: string) => {
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
  };

  // Marca acima/abaixo conforme a metade do card sob o cursor.
  const handleCardDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragOverPosRef.current = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
  };

  // Drop em cima de um card: insere acima/abaixo dele e grava a position no
  // ponto médio entre os vizinhos (ou topo+1 / fundo-1 nas pontas).
  const handleCardDrop = (e: React.DragEvent, targetItem: PipelineItem, targetStageId: string) => {
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
  };

  const handleDragEnd = () => {
    isDraggingRef.current = false;
    suppressClickUntilRef.current = Date.now() + 200;
    stopAutoScroll();
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
  // ID único do lead pro card. Usa o id do contato (a pessoa), não o número da
  // conversa: lead importado sem WhatsApp não tem conversa, então display_id caía
  // tudo no mesmo número. Contato é único por lead e estável.
  const resolveItemRef = (item: PipelineItem): string => {
    const id =
      item.contact?.id ||
      item.conversation?.contact?.id ||
      item.item_id ||
      item.id;
    return String(id).padStart(4, '0');
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

  // Tags do lead pro filtro: une as etiquetas do contato (as que aparecem no card,
  // ex "tráfego pago") com as labels da conversa. Retorna {name,color} sem repetir.
  const itemTagInfos = (item: PipelineItem): Array<{ name: string; color: string }> => {
    const out: Array<{ name: string; color: string }> = [];
    const seen = new Set<string>();
    const push = (name?: string | null, color?: string | null) => {
      const n = (name || '').trim();
      if (!n || seen.has(n)) return;
      seen.add(n);
      out.push({ name: n, color: color || '#7c3aed' });
    };
    const contactLabels = (item.contact as any)?.labels;
    if (Array.isArray(contactLabels)) {
      contactLabels.forEach((l: any) => push(l?.name || l?.title, l?.color));
    }
    itemLabels(item).forEach(n => push(n));
    return out;
  };
  const itemTagNames = (item: PipelineItem): string[] => itemTagInfos(item).map(t => t.name);

  // Todas as tags presentes no pipeline (pro menu do filtro).
  const allTags = useMemo(() => {
    const map = new Map<string, string>();
    stages.forEach(s =>
      (s.items || []).forEach(it =>
        itemTagInfos(it).forEach(({ name, color }) => {
          if (!map.has(name)) map.set(name, color);
        }),
      ),
    );
    return Array.from(map, ([name, color]) => ({ name, color })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stages]);
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

  const handleEditItem = (item: PipelineItem) => {
    setItemToEdit(item);
    setShowEditItemModal(true);
  };

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

  // Quantos filtros estão ativos (pro botão "Limpar" e badges).
  const activeFilterCount =
    (searchQuery ? 1 : 0) +
    (timePreset !== 'all' ? 1 : 0) +
    (selectedTags.length ? 1 : 0) +
    (hiddenStages.length ? 1 : 0);
  const clearAllFilters = () => {
    setSearchQuery('');
    setTimePreset('all');
    setDateFrom('');
    setDateTo('');
    setSelectedTags([]);
    setHiddenStages([]);
  };

  // Filtra etapas por colunas ocultas e itens por busca + tempo + tags.
  const filteredStages = useMemo(() => {
    const visible = stages.filter(s => !hiddenStages.includes(s.id));
    const q = searchQuery.toLowerCase();
    const { from, to } = timeRange;
    if (!q && !from && !to && selectedTags.length === 0) return visible;
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
        return matchesSearch && matchesFrom && matchesTo && matchesTags;
      }),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stages, searchQuery, timeRange, selectedTags, hiddenStages]);


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

              {/* Filtro por TEMPO (entrada do lead): atalhos + personalizado */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={timePreset !== 'all' ? 'default' : 'outline'}
                    size="sm"
                    className="whitespace-nowrap"
                  >
                    <CalendarClock className="w-4 h-4 mr-2" />
                    {timePreset === 'today'
                      ? 'Hoje'
                      : timePreset === '7d'
                      ? 'Últimos 7 dias'
                      : timePreset === '30d'
                      ? 'Últimos 30 dias'
                      : timePreset === 'custom'
                      ? 'Período personalizado'
                      : 'Tempo'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Filtrar por tempo</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setTimePreset('all')}>Todos</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTimePreset('today')}>Hoje</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTimePreset('7d')}>
                    Últimos 7 dias
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTimePreset('30d')}>
                    Últimos 30 dias
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTimePreset('custom')}>
                    Período personalizado…
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Filtro por TAGS (etiquetas do lead) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={selectedTags.length ? 'default' : 'outline'}
                    size="sm"
                    className="whitespace-nowrap"
                    disabled={allTags.length === 0}
                  >
                    <Tag className="w-4 h-4 mr-2" />
                    Tags
                    {selectedTags.length > 0 && (
                      <span className="ml-2 rounded-full bg-background/30 px-1.5 text-xs">
                        {selectedTags.length}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
                  <DropdownMenuLabel>Filtrar por tags</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {allTags.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma tag</div>
                  )}
                  {allTags.map(tag => (
                    <DropdownMenuCheckboxItem
                      key={tag.name}
                      checked={selectedTags.includes(tag.name)}
                      onCheckedChange={checked =>
                        setSelectedTags(prev =>
                          checked ? [...prev, tag.name] : prev.filter(t => t !== tag.name),
                        )
                      }
                      onSelect={e => e.preventDefault()}
                    >
                      <span
                        className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                  {selectedTags.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setSelectedTags([])}>
                        Limpar tags
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Filtro por COLUNAS (mostrar/ocultar etapas) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={hiddenStages.length ? 'default' : 'outline'}
                    size="sm"
                    className="whitespace-nowrap"
                  >
                    <Columns3 className="w-4 h-4 mr-2" />
                    Colunas
                    {hiddenStages.length > 0 && (
                      <span className="ml-2 rounded-full bg-background/30 px-1.5 text-xs">
                        {stages.length - hiddenStages.length}/{stages.length}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
                  <DropdownMenuLabel>Mostrar colunas</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {stages.map(stage => (
                    <DropdownMenuCheckboxItem
                      key={stage.id}
                      checked={!hiddenStages.includes(stage.id)}
                      onCheckedChange={checked =>
                        setHiddenStages(prev =>
                          checked ? prev.filter(id => id !== stage.id) : [...prev, stage.id],
                        )
                      }
                      onSelect={e => e.preventDefault()}
                    >
                      <span
                        className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      {stage.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                  {hiddenStages.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setHiddenStages([])}>
                        Mostrar todas
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="whitespace-nowrap text-muted-foreground"
                >
                  <X className="w-4 h-4 mr-1" />
                  Limpar filtros
                </Button>
              )}
            </div>

            {/* Faixa de datas personalizada (só quando "Período personalizado") */}
            {timePreset === 'custom' && (
              <div className="flex items-center gap-2 pb-3">
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
              </div>
            )}
          </div>
        </div>

        {/* Kanban Board */}
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
                      data-col-scroll
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
                          onDragOver={handleCardDragOver}
                          onDrop={e => handleCardDrop(e, item, stage.id)}
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
                                      const ref =
                                        item.contact?.id ||
                                        item.conversation?.contact?.id ||
                                        item.item_id ||
                                        item.id;
                                      await navigator.clipboard.writeText(String(ref));
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
                                  <DropdownMenuItem
                                    onClick={() => {
                                      const contactId = item.contact?.id ?? item.conversation?.contact?.id;
                                      const contactName = item.contact?.name ?? item.conversation?.contact?.name;
                                      if (contactId) {
                                        setSelectedContactForNotes({ id: contactId, name: contactName });
                                        setNotesModalOpen(true);
                                      }
                                    }}
                                  >
                                    <MessageCircle className="h-4 w-4 mr-2" />
                                    Ver Notas
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleArchiveItem(item)}>
                                    <Archive className="h-4 w-4 mr-2" />
                                    Arquivar
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
                                <span
                                  title={`#${resolveItemRef(item)}`}
                                  className="shrink-0 text-[10px] text-muted-foreground/60 font-medium"
                                >
                                  #{resolveItemRef(item).slice(0, 6)}
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
                              {/* Imóvel vinculado ao lead */}
                              {item.primary_property && (
                                <span
                                  title="Imóvel vinculado"
                                  className="inline-flex items-center gap-1 mb-1 ml-1 px-1.5 py-0.5 rounded-md text-xs font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 max-w-[180px]"
                                >
                                  <Home className="w-3 h-3 shrink-0" />
                                  <span className="truncate">
                                    {item.primary_property.title || item.primary_property.code || 'Imóvel'}
                                  </span>
                                </span>
                              )}
                              {/* Contact details */}
                              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                                {item.contact?.phone_number && (
                                  <span className="flex items-center space-x-1">
                                    <Phone className="w-3 h-3 shrink-0" />
                                    <span className="whitespace-nowrap">
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

                          {/* Etiquetas/Tags do contato (ex: tráfego pago) */}
                          {Array.isArray((item.contact as any)?.labels) && (item.contact as any).labels.length > 0 && (
                            <div className="mb-3 flex flex-wrap gap-1">
                              {(item.contact as any).labels.map((label: any, idx: number) => {
                                const color = label?.color || '#7c3aed';
                                const name = label?.name || label?.title;
                                if (!name) return null;
                                return (
                                  <span
                                    key={`${name}-${idx}`}
                                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                                    style={{ backgroundColor: `${color}22`, color }}
                                  >
                                    {name}
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {/* Preview da última mensagem removido do card a pedido
                              do Giovani: o card mostra só nome, ID curto, telefone
                              e as tags. O histórico fica no modal de detalhes. */}

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
                                    ? formatDateBR(item.conversation.last_activity_at * 1000,)
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

      {/* Disparo em Massa Modal */}
      {pipeline && (
        <BulkDispatchModal
          open={disparoModalOpen}
          onOpenChange={setDisparoModalOpen}
          pipelineId={pipeline.id}
          pipelineName={pipeline.name}
          stages={stages}
        />
      )}

      {/* Leads Arquivados Modal */}
      {pipeline && (
        <ArchivedLeadsModal
          open={archivedModalOpen}
          onClose={() => setArchivedModalOpen(false)}
          pipelineId={pipeline.id}
          onUnarchived={() => loadPipelineData(true)}
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
          onItemStageMoved={moveItemToStageLocal}
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

      {/* Notes History Modal */}
      {selectedContactForNotes && (
        <NotesHistoryModal
          isOpen={notesModalOpen}
          contactId={selectedContactForNotes.id}
          contactName={selectedContactForNotes.name}
          onClose={() => {
            setNotesModalOpen(false);
            setSelectedContactForNotes(null);
          }}
        />
      )}
    </div>
  );
}
