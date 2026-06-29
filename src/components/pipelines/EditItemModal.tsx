import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import { useAccountUsers } from '@/hooks/useAccountUsers';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Badge,
} from '@/components/ui/ds';
import { Plus, Trash2, ChevronsUpDown, Check, User, Phone, Mail, History, Loader2, Tag, Shuffle, X, RefreshCw, Home, Settings2, Link, MessageSquare, Megaphone, MessageCircle } from 'lucide-react';
import { PipelineItem, PipelineStage, Pipeline, PipelineTask, CreateTaskData, UpdateTaskData, PipelineServiceDefinition } from '@/types/analytics';
import pipelineServiceDefinitionsService from '@/services/pipelines/pipelineServiceDefinitionsService';
import PipelineItemCustomAttributes from './PipelineItemCustomAttributes';
import PipelineTasksList, { PipelineTasksListRef } from './tasks/PipelineTasksList';
import CreateTaskModal from './tasks/CreateTaskModal';
import EditTaskModal from './tasks/EditTaskModal';
import CardConversationTab from './CardConversationTab';
import CardActionsPanel from './CardActionsPanel';
import CardNotesTab from './CardNotesTab';
import CreateRoletaModal from './CreateRoletaModal';
import CardPropertyInterests from './CardPropertyInterests';
import { useFeature } from '@/contexts/TenantFeaturesContext';
import ContactAvatar from '@/components/chat/contact/ContactAvatar';
import { conversationAPI } from '@/services/conversations/conversationService';
import { contactEventsService } from '@/services/contacts/contactEventsService';
import { labelsService } from '@/services/contacts/labelsService';
import { contactsService } from '@/services/contacts/contactsService';
import { roletaConfigService, type RoletaConfig } from '@/services/roletaConfig/roletaConfigService';
import { toast } from 'sonner';
import type { ContactEvent } from '@/types/notifications/contact-events';
import type { Label as LabelType } from '@/types/settings';

interface Service {
  name: string;
  value: string;
}

interface EditItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PipelineItem | null;
  stages: PipelineStage[];
  pipeline?: Pipeline | null;
  onSubmit: (data: {
    notes: string;
    stage_id: string;
    services: Service[];
    currency: string;
    custom_attributes?: Record<string, unknown>;
  }) => void;
  // Move otimista no board (sem reload) quando a etapa muda pelas ações do card.
  onItemStageMoved?: (itemId: string, toStageId: string) => void;
  loading: boolean;
}

export default function EditItemModal({
  open,
  onOpenChange,
  item,
  stages,
  pipeline,
  onSubmit,
  onItemStageMoved,
  loading,
}: EditItemModalProps) {
  const { t } = useLanguage('pipelines');
  const navigate = useNavigate();
  const { users } = useAccountUsers();

  // Feature flags do tenant (ausente/ligada = true → preserva comportamento atual).
  const canNotes = useFeature('card_notes');
  const canTasks = useFeature('card_tasks');
  const canProperties = useFeature('card_property_interests');

  const [notes, setNotes] = useState('');
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [currency, setCurrency] = useState('BRL');
  const [customAttributes, setCustomAttributes] = useState<Record<string, unknown>>({});
  const [activeTab, setActiveTab] = useState('overview');
  const [catalogServices, setCatalogServices] = useState<PipelineServiceDefinition[]>([]);
  const [openServicePopover, setOpenServicePopover] = useState<number | null>(null);

  // Responsável
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | null>(null);
  const [assigningUser, setAssigningUser] = useState(false);

  // Roleta de atendimento — roletas REAIS cadastradas (por inbox), não mais
  // o round-robin fake. Escolher uma atribui o lead via sorteio ponderado.
  const [roletas, setRoletas] = useState<RoletaConfig[]>([]);
  const [assigningRoleta, setAssigningRoleta] = useState(false);
  const [showCreateRoleta, setShowCreateRoleta] = useState(false);

  // Tags/labels
  const [availableLabels, setAvailableLabels] = useState<LabelType[]>([]);
  const [activeLabels, setActiveLabels] = useState<string[]>([]);
  const [labelPopoverOpen, setLabelPopoverOpen] = useState(false);
  const [labelSearch, setLabelSearch] = useState('');
  const [savingLabel, setSavingLabel] = useState(false);
  const [creatingLabel, setCreatingLabel] = useState(false);

  // History
  const [historyEvents, setHistoryEvents] = useState<ContactEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Task modals state
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [showEditTaskModal, setShowEditTaskModal] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<PipelineTask | null>(null);
  const [parentTaskForSubtask, setParentTaskForSubtask] = useState<PipelineTask | null>(null);
  const [taskLoading, setTaskLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);

  const tasksListRef = useRef<PipelineTasksListRef>(null);

  useEffect(() => {
    const updateCounts = () => {
      if (tasksListRef.current) {
        setPendingCount(tasksListRef.current.pendingCount);
        setOverdueCount(tasksListRef.current.overdueCount);
      }
    };
    updateCounts();
    window.addEventListener('tasksCountChanged', updateCounts);
    return () => window.removeEventListener('tasksCountChanged', updateCounts);
  }, []);

  // Initialize form when modal opens
  useEffect(() => {
    let cancelled = false;
    if (open && item) {
      setNotes(item.notes || '');
      setSelectedStageId(item.stage_id);
      setServices(item.custom_fields?.services || []);
      setCurrency(item.custom_fields?.currency || 'BRL');
      const { services: _s, currency: _c, ...customAttrs } = item.custom_fields || {};
      setCustomAttributes(customAttrs);
      setActiveTab('overview');

      // Responsável
      const currentAssigneeId = item.conversation?.assignee?.id;
      setSelectedAssigneeId(currentAssigneeId ? String(currentAssigneeId) : null);

      // Roletas reais cadastradas (só as ativas) pra escolher no select.
      roletaConfigService.getAll()
        .then(list => { if (!cancelled) setRoletas((list || []).filter(r => r.is_active)); })
        .catch(() => { if (!cancelled) setRoletas([]); });

      // Labels ativas: da conversa (lead de WhatsApp) ou, na ausência de conversa
      // (lead de cadastro/formulário Meta), do contato — senão a tag do contato
      // ficava invisível no modal.
      // Prefere a lista NÃO-VAZIA (conversa OU contato). `??` falhava porque o
      // serializer pode mandar labels:[] (array vazio, que não é null) na conversa,
      // escondendo a tag do contato. E labels do contato vêm como {name}, da
      // conversa como {title} — por isso lemos title ?? name.
      const convLabels = (item.conversation as any)?.labels;
      const contactLabels = (item.contact as any)?.labels;
      const rawLabels =
        (Array.isArray(convLabels) && convLabels.length ? convLabels
          : Array.isArray(contactLabels) && contactLabels.length ? contactLabels
          : []);
      setActiveLabels(rawLabels
        .map((l: any) => (typeof l === 'string' ? l : (l?.title ?? l?.name ?? '')))
        .filter(Boolean));

      // Fetch catalog e labels disponíveis
      pipelineServiceDefinitionsService
        .getServiceDefinitions(item.pipeline_id)
        .then(data => { if (!cancelled) setCatalogServices(data); })
        .catch(() => { if (!cancelled) setCatalogServices([]); });

      labelsService.getLabels()
        .then(res => {
          if (!cancelled) setAvailableLabels(Array.isArray(res.data) ? res.data as LabelType[] : []);
        })
        .catch(() => { if (!cancelled) setAvailableLabels([]); });

      // Load history immediately on open
      loadHistory(item);

      // Auto-tag "meta" for Facebook/Meta leads
      const convId = item.conversation?.id ? String(item.conversation.id) : null;
      const existingLabels = Array.isArray((item.conversation as any)?.labels)
        ? ((item.conversation as any).labels as any[]).map((l: any) => typeof l === 'string' ? l : l?.title ?? '')
        : [];
      const contactAttrs = (item.contact as any)?.additional_attributes ?? {};
      const convAttrs = (item.conversation as any)?.additional_attributes ?? {};
      const allAttrs = { ...convAttrs, ...contactAttrs };
      const isMeta = ['campaign_source', 'utm_source', 'lead_source'].some(k =>
        String(allAttrs[k] ?? '').toLowerCase().includes('meta') ||
        String(allAttrs[k] ?? '').toLowerCase().includes('facebook')
      ) || String(allAttrs['campaign_medium'] ?? '').toLowerCase() === 'cpc';
      if (isMeta && convId && !existingLabels.includes('meta')) {
        conversationAPI.addLabels(convId, ['meta']).catch(() => {});
      }
    }
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id]);

  const loadHistory = useCallback(async (target?: PipelineItem | null) => {
    const src = target ?? item;
    const contactId = src?.contact?.id ?? (src?.conversation as any)?.contact?.id;
    if (!contactId) return;
    setHistoryLoading(true);
    try {
      const res = await contactEventsService.getContactEvents(String(contactId), { limit: 50 });
      setHistoryEvents(Array.isArray(res.data) ? res.data : []);
    } catch {
      setHistoryEvents([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [item]);

  const handleAssigneeChange = useCallback(async (userId: string) => {
    if (!item?.conversation?.id) return;
    setSelectedAssigneeId(userId === 'unassigned' ? null : userId);
    setAssigningUser(true);
    try {
      await conversationAPI.assignConversation(item.conversation.id, userId === 'unassigned' ? null : userId);
    } catch { /* silent */ } finally {
      setAssigningUser(false);
    }
  }, [item]);

  // Atribui o lead via uma roleta real (sorteio ponderado + notifica o corretor).
  const handleAssignViaRoleta = useCallback(async (roletaId: string) => {
    const contactId = item?.contact?.id ?? (item?.conversation as any)?.contact?.id;
    if (!contactId) { toast.error('Lead sem contato'); return; }
    setAssigningRoleta(true);
    try {
      const a = await roletaConfigService.assign(roletaId, {
        contact_id: String(contactId),
        conversation_id: item?.conversation?.id ? String(item.conversation.id) : undefined,
        pipeline_item_id: item?.id ? String(item.id) : undefined,
      });
      toast.success(`Atribuído pela roleta: ${a?.assigned_user?.name ?? 'corretor'}`);
    } catch {
      toast.error('Erro ao atribuir pela roleta (sem membros ativos?)');
    } finally {
      setAssigningRoleta(false);
    }
  }, [item]);

  // Alvo da tag: conversa (lead WhatsApp) OU, na ausência dela, o contato
  // (lead de formulário/cadastro não tem conversa). Sem isso, o lead de
  // formulário não recebia tag nenhuma pelo modal.
  const labelTargetConvId = item?.conversation?.id ? String(item.conversation.id) : null;
  const labelTargetContactId =
    item?.contact?.id ?? (item?.conversation as any)?.contact?.id ?? null;

  // Persiste a lista de tags no alvo certo. Conversa = add/remove incremental;
  // Contato = PATCH substitui a lista inteira (label_list no backend).
  const persistLabels = useCallback(
    async (nextLabels: string[], change: { added?: string; removed?: string }) => {
      if (labelTargetConvId) {
        if (change.added) await conversationAPI.addLabels(labelTargetConvId, [change.added]);
        if (change.removed) await conversationAPI.removeLabels(labelTargetConvId, [change.removed]);
        return;
      }
      if (labelTargetContactId) {
        await contactsService.updateContact(String(labelTargetContactId), { labels: nextLabels });
      }
    },
    [labelTargetConvId, labelTargetContactId],
  );

  const toggleLabel = useCallback(async (labelTitle: string) => {
    if (!labelTargetConvId && !labelTargetContactId) return;
    setSavingLabel(true);
    try {
      const has = activeLabels.includes(labelTitle);
      const next = has
        ? activeLabels.filter(l => l !== labelTitle)
        : [...activeLabels, labelTitle];
      await persistLabels(next, has ? { removed: labelTitle } : { added: labelTitle });
      setActiveLabels(next);
    } catch { /* silent */ } finally {
      setSavingLabel(false);
    }
  }, [activeLabels, persistLabels, labelTargetConvId, labelTargetContactId]);

  const createAndApplyLabel = useCallback(async (rawTitle: string) => {
    const title = rawTitle.trim();
    if (!title || (!labelTargetConvId && !labelTargetContactId)) return;
    setCreatingLabel(true);
    try {
      const created = await labelsService.createLabel({ title, color: '#7C3AED', show_on_sidebar: true });
      // O backend normaliza o título (minúsculo). Usa o título canônico retornado
      // pra a lista e o alvo baterem com o que ficou gravado.
      const canonical = (created as any)?.title ?? title.toLowerCase();
      setAvailableLabels(prev =>
        prev.some(l => l.title === canonical) ? prev : [...prev, created as unknown as LabelType]
      );
      if (!activeLabels.includes(canonical)) {
        const next = [...activeLabels, canonical];
        await persistLabels(next, { added: canonical });
        setActiveLabels(next);
      }
    } catch { /* silent */ } finally {
      setCreatingLabel(false);
      setLabelPopoverOpen(false);
      setLabelSearch('');
    }
  }, [activeLabels, persistLabels, labelTargetConvId, labelTargetContactId]);

  const handleSubmit = () => {
    if (!selectedStageId) return;
    onSubmit({ notes, stage_id: selectedStageId, services, currency, custom_attributes: customAttributes });
  };

  // Service management (kept for data compat)
  const addService = () => setServices([...services, { name: '', value: '' }]);
  const removeService = (index: number) => setServices(services.filter((_, i) => i !== index));
  const updateService = (index: number, field: 'name' | 'value', value: string) => {
    const updated = [...services];
    updated[index][field] = value;
    setServices(updated);
  };
  const selectCatalogService = (index: number, cs: PipelineServiceDefinition) => {
    const updated = [...services];
    updated[index] = { name: cs.name, value: cs.default_value.toString() };
    setServices(updated);
    setOpenServicePopover(null);
  };
  const calculateTotalValue = () => services.reduce((t, s) => t + (parseFloat(s.value) || 0), 0);
  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

  const canSubmit = selectedStageId !== null;

  if (!item) return null;

  // Nome cru às vezes vem como o telefone (Evolution não manda pushName no 1º evento).
  // Descarta nomes que são só dígitos/telefone e cai no melhor candidato.
  const isPhoneLikeName = (value?: string | null) => {
    if (!value) return true;
    return /^[+\d\s()\-@.]+$/.test(value.replace(/whatsapp|net|us|s\./gi, ''));
  };
  const getItemDisplayName = () => {
    const candidates = [item.contact?.name, (item.conversation as any)?.contact?.name];
    const good = candidates.find(c => c && !isPhoneLikeName(c));
    if (good) return good as string;
    const phone =
      item.contact?.phone_number || (item.conversation as any)?.contact?.phone_number;
    return phone || candidates[0] || t('editItem.unknownUser');
  };

  const getItemDisplayId = () => {
    if (item.type === 'conversation' && item.conversation) return item.conversation.display_id;
    return item.id;
  };

  // Contato unificado (card pode ter contact direto ou via conversa)
  const contactObj = (item.contact || (item.conversation as any)?.contact) as any;
  const avatarContact = contactObj
    ? {
        id: contactObj.id ? String(contactObj.id) : undefined,
        name: getItemDisplayName(),
        avatar_url: contactObj.avatar_url ?? null,
        thumbnail: contactObj.thumbnail ?? null,
      }
    : null;

  // Link direto pra conversa no WhatsApp (Web no desktop, app no celular)
  const rawPhone: string =
    item.contact?.phone_number || (item.conversation as any)?.contact?.phone_number || '';
  const whatsappDigits = rawPhone.replace(/\D/g, '');
  const whatsappUrl = whatsappDigits ? `https://wa.me/${whatsappDigits}` : null;

  const handleCreateTask = async (data: CreateTaskData) => {
    if (!tasksListRef.current) return;
    setTaskLoading(true);
    try {
      const result = await tasksListRef.current.createTask(data);
      if (result) setShowCreateTaskModal(false);
    } finally { setTaskLoading(false); }
  };

  const handleEditTask = async (taskId: string, data: UpdateTaskData) => {
    if (!tasksListRef.current) return;
    setTaskLoading(true);
    try {
      const result = await tasksListRef.current.updateTask(taskId, data);
      if (result) { setShowEditTaskModal(false); setTaskToEdit(null); }
    } finally { setTaskLoading(false); }
  };

  const handleCreateTaskModalClose = () => { setShowCreateTaskModal(false); setParentTaskForSubtask(null); };

  const filteredLabels = availableLabels.filter(l =>
    l.title.toLowerCase().includes(labelSearch.toLowerCase())
  );
  const trimmedLabelSearch = labelSearch.trim();
  const exactLabelExists = availableLabels.some(
    l => l.title.toLowerCase() === trimmedLabelSearch.toLowerCase()
  );
  const canCreateLabel = trimmedLabelSearch.length > 0 && !exactLabelExists;

  // Conta as abas visíveis pra ajustar o grid e não deixar buraco quando uma feature está off.
  // Fixas: Detalhes, Conversa, Origem. Opcionais: Imóveis, Retorno.
  // Observações saiu da barra de abas — agora vive no painel direito do Detalhes,
  // dividindo espaço com o Histórico.
  const visibleTabsCount = 3 + (canProperties ? 1 : 0) + (canTasks ? 1 : 0);
  const tabsGridClass = {
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
  }[visibleTabsCount] ?? 'grid-cols-6';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="shrink-0 pb-2 border-b border-border flex items-start justify-between gap-2">
          <div className="min-w-0 flex items-center gap-3">
            {avatarContact && (
              <ContactAvatar contact={avatarContact} size="md" showColoredFallback className="shrink-0" />
            )}
            <div className="min-w-0">
              <DialogTitle className="truncate text-base font-semibold">{getItemDisplayName()}</DialogTitle>
              <DialogDescription className="text-xs">#{getItemDisplayId()}</DialogDescription>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 mt-0.5">
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir conversa no WhatsApp"
                className="p-1.5 rounded-md text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
              >
                <MessageCircle className="h-3.5 w-3.5" />
              </a>
            )}
            {item.conversation?.id && (
              <button
                type="button"
                title="Ir para conversa no CRM"
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/conversations/${item.conversation!.id}`);
                }}
              >
                <MessageSquare className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              title="Copiar link do card"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              onClick={() => {
                const url = `${window.location.origin}/pipelines/${item.pipeline_id}?card=${item.id}`;
                navigator.clipboard.writeText(url).then(() => {
                  const el = document.createElement('div');
                  el.textContent = 'Link copiado!';
                  el.className = 'fixed bottom-4 right-4 z-[9999] bg-foreground text-background text-xs px-3 py-2 rounded-lg shadow-lg';
                  document.body.appendChild(el);
                  setTimeout(() => el.remove(), 2000);
                });
              }}
            >
              <Link className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden min-h-0">
          <TabsList className={`grid w-full ${tabsGridClass} shrink-0`}>
            <TabsTrigger value="overview">Detalhes</TabsTrigger>
            <TabsTrigger value="conversation">Conversa</TabsTrigger>
            {canProperties && (
              <TabsTrigger value="properties" className="flex items-center gap-1">
                <Home className="h-3 w-3" />
                Imóveis
              </TabsTrigger>
            )}
            <TabsTrigger value="origin" className="flex items-center gap-1">
              <Megaphone className="h-3 w-3" />
              Origem
            </TabsTrigger>
            {canTasks && (
              <TabsTrigger value="tasks" className="relative">
                Retorno
                {(pendingCount > 0 || overdueCount > 0) && (
                  <span className="ml-1 px-1 py-0.5 text-xs font-medium rounded-full bg-primary text-primary-foreground">
                    {pendingCount + overdueCount}
                  </span>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          {/* Overview: split left=form right=history */}
          <TabsContent value="overview" className="flex-1 overflow-hidden mt-0 pt-3 min-h-0 flex flex-col">
            <div className="grid grid-cols-2 gap-4 flex-1 overflow-hidden min-h-0">
              {/* LEFT: details form */}
              <div className="space-y-4 overflow-y-auto pr-2 min-h-0">
                {/* Contact info (read-only) */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input readOnly value={item.contact?.name || (item.conversation as any)?.contact?.name || ''} placeholder="Nome" className="bg-muted/40 cursor-default text-sm h-8" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input readOnly value={item.contact?.phone_number || (item.conversation as any)?.contact?.phone_number || ''} placeholder="Telefone" className="bg-muted/40 cursor-default text-sm h-8" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input readOnly value={item.contact?.email || (item.conversation as any)?.contact?.email || ''} placeholder="E-mail" className="bg-muted/40 cursor-default text-sm h-8" />
                  </div>
                </div>

                {/* Respostas do formulário (perguntas personalizadas da campanha) */}
                {(() => {
                  const ca = ((item.contact as any)?.custom_attributes) ?? {};
                  const HIDE = new Set(['empreendimento', 'imovel_codigo', 'origem_lead']);
                  const entries = Object.entries(ca).filter(([k, v]) => !HIDE.has(k) && v != null && v !== '');
                  if (entries.length === 0) return null;
                  return (
                    <div className="grid gap-1.5">
                      <Label className="flex items-center gap-1 text-xs">
                        <MessageSquare className="h-3.5 w-3.5" />
                        Respostas do lead
                      </Label>
                      <div className="rounded-lg border border-border/60 bg-muted/20 p-2 space-y-1.5">
                        {entries.map(([k, v]) => (
                          <div key={k} className="flex items-start justify-between gap-3 text-xs">
                            <span className="text-muted-foreground shrink-0 capitalize">{k.replace(/_/g, ' ')}</span>
                            <span className="text-right font-medium break-words">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Tags */}
                <div className="grid gap-1.5">
                  <Label className="flex items-center gap-1 text-xs">
                    <Tag className="h-3.5 w-3.5" />
                    Tags
                    {(savingLabel || creatingLabel) && <Loader2 className="h-3 w-3 animate-spin" />}
                  </Label>
                  <div className="flex flex-wrap gap-1 mb-1">
                    {activeLabels.map(l => (
                      <Badge key={l} variant="secondary" className="gap-1 text-xs h-5 px-1.5">
                        {l}
                        <button onClick={() => toggleLabel(l)} className="hover:text-destructive">
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  {(labelTargetConvId || labelTargetContactId) && (
                    <Popover open={labelPopoverOpen} onOpenChange={setLabelPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 text-xs w-full justify-start">
                          <Plus className="h-3 w-3 mr-1" /> Adicionar tag
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-52 p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar ou criar tag..." value={labelSearch} onValueChange={setLabelSearch} />
                          {/* max-h + overflow + onWheel stopPropagation: sem isso a roda
                              do mouse não rolava a lista dentro do popover/modal. */}
                          <CommandList
                            className="max-h-56 overflow-y-auto overscroll-contain"
                            onWheel={e => e.stopPropagation()}
                          >
                            <CommandEmpty>Digite o nome e clique em "Criar tag".</CommandEmpty>
                            {/* Criar nova tag: sempre visível no topo. Sem texto digitado,
                                fica desabilitado pedindo o nome; com texto, cria na hora. */}
                            <CommandGroup heading="Nova tag">
                              <CommandItem
                                value={`__create__${trimmedLabelSearch}`}
                                disabled={!canCreateLabel || creatingLabel}
                                onSelect={() => canCreateLabel && createAndApplyLabel(trimmedLabelSearch)}
                              >
                                {creatingLabel
                                  ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                  : <Plus className="mr-2 h-3.5 w-3.5" />}
                                {trimmedLabelSearch
                                  ? `Criar tag "${trimmedLabelSearch}"`
                                  : 'Digite acima pra criar uma nova tag'}
                              </CommandItem>
                            </CommandGroup>
                            <CommandGroup heading="Tags existentes">
                              {filteredLabels.map(l => (
                                <CommandItem key={l.id} value={l.title} onSelect={() => { toggleLabel(l.title); setLabelPopoverOpen(false); setLabelSearch(''); }}>
                                  <Check className={`mr-2 h-3.5 w-3.5 ${activeLabels.includes(l.title) ? 'opacity-100' : 'opacity-0'}`} />
                                  <span className="w-2.5 h-2.5 rounded-full mr-2 shrink-0 inline-block" style={{ backgroundColor: l.color }} />
                                  {l.title}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>

                {/* Responsável */}
                {item.conversation?.id && (
                  <div className="grid gap-1.5">
                    <Label className="flex items-center gap-1 text-xs">
                      Responsável
                      {assigningUser && <Loader2 className="h-3 w-3 animate-spin" />}
                    </Label>
                    <Select value={selectedAssigneeId ?? 'unassigned'} onValueChange={handleAssigneeChange} disabled={assigningUser}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Sem responsável" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Sem responsável</SelectItem>
                        {users.map(u => (
                          <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Roleta de atendimento — roletas REAIS cadastradas (por canal).
                    Sem nenhuma: atalho pra criar. Escolher uma atribui o lead. */}
                <div className="grid gap-1.5">
                  <Label className="flex items-center gap-1 text-xs">
                    <Shuffle className="h-3.5 w-3.5" />
                    Roleta de atendimento
                    {assigningRoleta && <Loader2 className="h-3 w-3 animate-spin" />}
                  </Label>
                  <Select
                    value=""
                    onValueChange={(v) => {
                      if (v === '__create__') { setShowCreateRoleta(true); return; }
                      handleAssignViaRoleta(v);
                    }}
                    disabled={assigningRoleta}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder={roletas.length ? 'Atribuir por uma roleta' : 'Nenhuma roleta — criar uma'} />
                    </SelectTrigger>
                    <SelectContent>
                      {roletas.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.inbox_name || 'Roleta'}</SelectItem>
                      ))}
                      <SelectItem value="__create__" className="text-primary font-medium">
                        + Criar roleta
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Fase */}
                <div className="grid gap-1.5">
                  <Label className="text-xs">{t('editItem.currentStage')}</Label>
                  <Select value={selectedStageId?.toString()} onValueChange={setSelectedStageId}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder={t('editItem.chooseStage')} />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map(stage => (
                        <SelectItem key={stage.id} value={stage.id.toString()}>
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                            {stage.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Ações do lead (movido da antiga aba Ações) */}
                <div className="grid gap-1.5 pt-1">
                  <Label className="flex items-center gap-1 text-xs">
                    <Settings2 className="h-3.5 w-3.5" />
                    Ações
                  </Label>
                  <CardActionsPanel
                    item={item}
                    stages={stages}
                    onClose={() => onOpenChange(false)}
                    onStageChanged={(newStageId) => {
                      setSelectedStageId(newStageId);
                      // Reflete o move no board na hora, sem reload.
                      if (item) onItemStageMoved?.(item.id, newStageId);
                    }}
                  />
                </div>
              </div>

              {/* RIGHT: histórico (em cima) + observações (embaixo), dividindo a altura */}
              <div className="flex flex-col overflow-hidden border-l border-border pl-4 min-h-0">
                {/* Histórico */}
                <div className={`flex flex-col overflow-hidden min-h-0 ${canNotes ? 'flex-1 pb-3' : 'flex-1'}`}>
                  <div className="flex items-center justify-between mb-3 shrink-0">
                    <h4 className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wide">
                      <History className="h-3.5 w-3.5" />
                      Histórico
                    </h4>
                    <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => loadHistory()} disabled={historyLoading}>
                      <RefreshCw className={`h-3 w-3 ${historyLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2">
                    {historyLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : historyEvents.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-12">
                        Nenhuma atividade registrada.
                      </p>
                    ) : (
                      historyEvents.map(ev => (
                        <div key={ev.id} className="flex gap-2 text-xs">
                          <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <span className="font-medium truncate">{ev.eventName}</span>
                              <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                                {new Date(ev.occurredAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            {ev.properties && Object.keys(ev.properties).length > 0 && (
                              <p className="text-muted-foreground truncate">
                                {Object.entries(ev.properties).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Observações (comentários da equipe) — dividindo o espaço, abaixo do histórico */}
                {canNotes && (
                  <div className="flex flex-col overflow-hidden min-h-0 flex-1 border-t border-border pt-3">
                    <h4 className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wide mb-3 shrink-0">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Observações
                    </h4>
                    <div className="flex-1 overflow-hidden min-h-0">
                      <CardNotesTab
                        contactId={item.contact?.id ? String(item.contact.id) : ((item.conversation as any)?.contact?.id ? String((item.conversation as any).contact.id) : null)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Conversa */}
          <TabsContent value="conversation" className="flex-1 overflow-y-auto mt-0 pt-3">
            {item && (
              <CardConversationTab
                item={item}
                onCreateReminder={() => { setShowCreateTaskModal(true); }}
              />
            )}
          </TabsContent>

          {/* Tarefas */}
          {canTasks && (
            <TabsContent value="tasks" className="flex-1 overflow-y-auto mt-0 pt-3">
              {item && (
                <PipelineTasksList
                  ref={tasksListRef}
                  pipelineId={item.pipeline_id}
                  pipelineItemId={item.id}
                  onCreateClick={() => setShowCreateTaskModal(true)}
                  onEditClick={(task: PipelineTask) => { setTaskToEdit(task); setShowEditTaskModal(true); }}
                  onAddSubtask={(parentTask: PipelineTask) => { setParentTaskForSubtask(parentTask); setShowCreateTaskModal(true); }}
                />
              )}
            </TabsContent>
          )}

          {/* Imóveis de interesse */}
          {canProperties && (
            <TabsContent value="properties" className="flex-1 overflow-y-auto mt-0 pt-3">
              {item && (
                <CardPropertyInterests
                  item={item}
                />
              )}
            </TabsContent>
          )}

          {/* Origem do lead (campanha / anúncio / tracking) */}
          <TabsContent value="origin" className="flex-1 overflow-y-auto mt-0 pt-3">
            {(() => {
              const ar = ((item.contact as any)?.additional_attributes?.ad_referral)
                ?? ((item.conversation as any)?.additional_attributes?.ad_referral) ?? {};
              const LABELS: Record<string, string> = {
                source: 'Origem', campaign_name: 'Campanha', adset_name: 'Conjunto', ad_name: 'Anúncio',
                campaign_id: 'ID da campanha', adset_id: 'ID do conjunto', ad_id: 'ID do anúncio',
                form_id: 'ID do formulário', page_id: 'ID da página', page_name: 'Página', leadgen_id: 'ID do lead (Meta)',
                lead_name: 'Nome', lead_email: 'E-mail', lead_phone: 'Telefone',
                lead_hour: 'Hora do lead', lead_weekday: 'Dia da semana',
                captured_at: 'Capturado em', fb_created_at: 'Criado no Facebook', lead_created_time: 'Data do lead',
                // Click-to-WhatsApp (anúncio FB/Instagram → zap)
                title: 'Anúncio', body: 'Descrição do anúncio', source_app: 'Plataforma',
                source_url: 'Link do anúncio', source_id: 'ID do anúncio', source_type: 'Tipo',
                ctwa_clid: 'ID do clique', thumbnail_url: 'Imagem do anúncio',
              };
              const HIDDEN = new Set(['thumbnail_url', 'source']);
              const source = (ar as any).source as string | undefined;
              const isCtwa = source === 'whatsapp_ctwa';
              const isForm = source === 'meta_lead_ads';
              const entries = Object.entries(ar).filter(([k, v]) => k !== 'extra_fields' && !HIDDEN.has(k) && v != null && v !== '');
              const extra = (ar as any).extra_fields && typeof (ar as any).extra_fields === 'object' ? (ar as any).extra_fields : null;
              if (entries.length === 0 && !extra) {
                return <div className="text-sm text-muted-foreground py-12 text-center border border-dashed border-border rounded-lg">Sem dados de origem para este lead.</div>;
              }
              return (
                <div className="space-y-4">
                  {(isCtwa || isForm) && (
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${isCtwa ? 'bg-green-500/15 text-green-600 dark:text-green-400' : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'}`}>
                      <span>{isCtwa ? '💬 WhatsApp Direto (CTWA)' : '📋 Formulário Meta Ads'}</span>
                    </div>
                  )}
                  <div className="grid gap-2">
                    {entries.map(([k, v]) => (
                      <div key={k} className="flex items-start justify-between gap-3 text-sm border-b border-border/50 pb-1.5">
                        <span className="text-muted-foreground shrink-0">{LABELS[k] ?? k.replace(/_/g, ' ')}</span>
                        <span className="text-right font-medium break-all">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                  {extra && Object.keys(extra).length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground mb-1.5">Respostas do formulário</h4>
                      <div className="grid gap-2">
                        {Object.entries(extra).map(([k, v]) => (
                          <div key={k} className="flex items-start justify-between gap-3 text-sm border-b border-border/50 pb-1.5">
                            <span className="text-muted-foreground shrink-0 capitalize">{k.replace(/_/g, ' ')}</span>
                            <span className="text-right font-medium break-all">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </TabsContent>

          {/* Observações saiu daqui: agora vive no painel direito da aba Detalhes. */}

          {/* Services Tab (hidden from tabs, kept for data compat) */}
          <TabsContent value="services" className="py-4 space-y-4 overflow-y-auto max-h-[60vh]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{t('editItem.services')}</h3>
              <Button type="button" size="sm" onClick={addService} className="h-8">
                <Plus className="w-4 h-4 mr-1" />{t('editItem.addService')}
              </Button>
            </div>
            {services.length === 0 ? (
              <div className="text-sm text-muted-foreground py-12 text-center border border-dashed border-border rounded-lg">{t('editItem.noServices')}</div>
            ) : (
              <div className="space-y-3">
                {services.map((service, index) => (
                  <div key={index} className="border border-border rounded-lg p-3">
                    <div className="flex gap-2 mb-2">
                      <Popover open={openServicePopover === index} onOpenChange={isOpen => setOpenServicePopover(isOpen ? index : null)}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" role="combobox" className="flex-1 justify-between font-normal">
                            <span className={service.name ? '' : 'text-muted-foreground'}>{service.name || t('editItem.serviceName')}</span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0" align="start">
                          <Command filter={(value, search) => { const cs = catalogServices.find(c => c.id === value); return cs?.name.toLowerCase().includes(search.toLowerCase()) ? 1 : 0; }}>
                            <CommandInput placeholder="Buscar ou digitar serviço..." value={service.name} onValueChange={v => updateService(index, 'name', v)} />
                            <CommandList>
                              <CommandEmpty>{service.name ? <button type="button" className="w-full px-2 py-1.5 text-sm text-left hover:bg-accent" onClick={() => setOpenServicePopover(null)}>{t('editItem.useCustomService', { name: service.name })}</button> : <span>{t('editItem.noServicesFound') || 'Nenhum encontrado'}</span>}</CommandEmpty>
                              {catalogServices.length > 0 && (
                                <CommandGroup heading="Catálogo">
                                  {catalogServices.map(cs => (
                                    <CommandItem key={cs.id} value={cs.id} onSelect={() => selectCatalogService(index, cs)}>
                                      <Check className={`mr-2 h-4 w-4 ${service.name === cs.name ? 'opacity-100' : 'opacity-0'}`} />
                                      <div className="flex flex-col"><span>{cs.name}</span><span className="text-xs text-muted-foreground">{cs.currency} {cs.formatted_default_value}</span></div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              )}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <Button type="button" variant="outline" size="sm" onClick={() => removeService(index)} className="px-2">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <Input type="number" placeholder={t('editItem.serviceValue')} value={service.value} onChange={e => updateService(index, 'value', e.target.value)} step="0.01" min="0" />
                  </div>
                ))}
                <div className="pt-3 border-t border-border">
                  <div className="flex justify-between items-center text-sm font-medium">
                    <span className="text-muted-foreground">{t('editItem.totalValue')}</span>
                    <span className="text-green-600 dark:text-green-400">{currency} {formatCurrency(calculateTotalValue())}</span>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Attributes Tab (hidden) */}
          <TabsContent value="attributes" className="py-4 overflow-y-auto max-h-[60vh]">
            <PipelineItemCustomAttributes
              attributes={customAttributes}
              onAttributesChange={setCustomAttributes}
              disabled={loading}
              pipelineId={item.pipeline_id}
              stageId={item.stage_id}
              itemId={item.id}
              pipelineCustomFields={pipeline?.custom_fields}
              stageCustomFields={stages.find(s => s.id === item.stage_id)?.custom_fields}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter className="shrink-0 border-t border-border pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t('editItem.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || loading}>
            {loading ? t('editItem.saving') : t('editItem.save')}
          </Button>
        </DialogFooter>
      </DialogContent>

      {item && (
        <>
          <CreateTaskModal
            open={showCreateTaskModal}
            onOpenChange={handleCreateTaskModalClose}
            onSubmit={handleCreateTask}
            loading={taskLoading}
            availableUsers={users}
            parentTask={parentTaskForSubtask}
          />
          <EditTaskModal
            open={showEditTaskModal}
            onOpenChange={setShowEditTaskModal}
            task={taskToEdit}
            onSubmit={handleEditTask}
            loading={taskLoading}
            availableUsers={users}
          />
        </>
      )}

      {/* Criação de roleta direto do card (sem ir pra Configurações) */}
      <CreateRoletaModal
        open={showCreateRoleta}
        onOpenChange={setShowCreateRoleta}
        users={users}
        onCreated={(roleta) => setRoletas(prev => [...prev, roleta])}
      />
    </Dialog>
  );
}
