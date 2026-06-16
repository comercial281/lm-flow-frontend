import { useState, useEffect, useRef, useCallback } from 'react';
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
  Textarea,
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
} from '@evoapi/design-system';
import { Plus, Trash2, ChevronsUpDown, Check, User, Phone, Mail, History, Loader2, Tag, Shuffle, X, RefreshCw, Home, Settings2 } from 'lucide-react';
import { PipelineItem, PipelineStage, Pipeline, PipelineTask, CreateTaskData, UpdateTaskData, PipelineServiceDefinition } from '@/types/analytics';
import pipelineServiceDefinitionsService from '@/services/pipelines/pipelineServiceDefinitionsService';
import PipelineItemCustomAttributes from './PipelineItemCustomAttributes';
import PipelineTasksList, { PipelineTasksListRef } from './tasks/PipelineTasksList';
import CreateTaskModal from './tasks/CreateTaskModal';
import EditTaskModal from './tasks/EditTaskModal';
import CardConversationTab from './CardConversationTab';
import CardActionsPanel from './CardActionsPanel';
import CardPropertyInterests from './CardPropertyInterests';
import { conversationAPI } from '@/services/conversations/conversationService';
import { contactEventsService } from '@/services/contacts/contactEventsService';
import { labelsService } from '@/services/contacts/labelsService';
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
  loading: boolean;
}

export default function EditItemModal({
  open,
  onOpenChange,
  item,
  stages,
  pipeline,
  onSubmit,
  loading,
}: EditItemModalProps) {
  const { t } = useLanguage('pipelines');
  const { users } = useAccountUsers();
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

  // Roleta (round-robin index display — read only, informativo)
  const [rouletteUser, setRouletteUser] = useState<string | null>(null);

  // Tags/labels
  const [availableLabels, setAvailableLabels] = useState<LabelType[]>([]);
  const [activeLabels, setActiveLabels] = useState<string[]>([]);
  const [labelPopoverOpen, setLabelPopoverOpen] = useState(false);
  const [labelSearch, setLabelSearch] = useState('');
  const [savingLabel, setSavingLabel] = useState(false);

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

      // Roleta: mostra o próximo usuário na fila (round-robin simples baseado em id)
      if (users.length > 0) {
        const idx = (Number(item.id) || 0) % users.length;
        setRouletteUser(String(users[idx]?.id ?? ''));
      }

      // Labels ativas na conversa
      const convLabels = (item.conversation as any)?.labels ?? [];
      setActiveLabels(Array.isArray(convLabels)
        ? convLabels.map((l: any) => (typeof l === 'string' ? l : l?.title ?? ''))
        : []);

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

  const toggleLabel = useCallback(async (labelTitle: string) => {
    if (!item?.conversation?.id) return;
    setSavingLabel(true);
    try {
      const has = activeLabels.includes(labelTitle);
      if (has) {
        await conversationAPI.removeLabels(item.conversation.id, [labelTitle]);
        setActiveLabels(prev => prev.filter(l => l !== labelTitle));
      } else {
        await conversationAPI.addLabels(item.conversation.id, [labelTitle]);
        setActiveLabels(prev => [...prev, labelTitle]);
      }
    } catch { /* silent */ } finally {
      setSavingLabel(false);
    }
  }, [item, activeLabels]);

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

  const getItemDisplayName = () => {
    if (item.type === 'contact' || !item.conversation) return item.contact?.name || t('editItem.unknownUser');
    return item.conversation?.contact?.name || t('editItem.unknownUser');
  };

  const getItemDisplayId = () => {
    if (item.type === 'conversation' && item.conversation) return item.conversation.display_id;
    return item.id;
  };

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="shrink-0 pb-2 border-b border-border">
          <DialogTitle className="truncate text-base font-semibold">{getItemDisplayName()}</DialogTitle>
          <DialogDescription className="text-xs">#{getItemDisplayId()}</DialogDescription>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-5 shrink-0">
            <TabsTrigger value="overview">Detalhes</TabsTrigger>
            <TabsTrigger value="conversation">Conversa</TabsTrigger>
            <TabsTrigger value="properties" className="flex items-center gap-1">
              <Home className="h-3 w-3" />
              Imóveis
            </TabsTrigger>
            <TabsTrigger value="tasks" className="relative">
              {t('editItem.tabs.tasks')}
              {(pendingCount > 0 || overdueCount > 0) && (
                <span className="ml-1 px-1 py-0.5 text-xs font-medium rounded-full bg-primary text-primary-foreground">
                  {pendingCount + overdueCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="actions" className="flex items-center gap-1">
              <Settings2 className="h-3 w-3" />
              Ações
            </TabsTrigger>
          </TabsList>

          {/* Overview: split left=form right=history */}
          <TabsContent value="overview" className="flex-1 overflow-hidden mt-0 pt-3">
            <div className="grid grid-cols-2 gap-4 h-full overflow-hidden">
              {/* LEFT: details form */}
              <div className="space-y-4 overflow-y-auto pr-2">
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

                {/* Tags */}
                <div className="grid gap-1.5">
                  <Label className="flex items-center gap-1 text-xs">
                    <Tag className="h-3.5 w-3.5" />
                    Tags
                    {savingLabel && <Loader2 className="h-3 w-3 animate-spin" />}
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
                  {item.conversation?.id && (
                    <Popover open={labelPopoverOpen} onOpenChange={setLabelPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 text-xs w-full justify-start">
                          <Plus className="h-3 w-3 mr-1" /> Adicionar tag
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-52 p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar tag..." value={labelSearch} onValueChange={setLabelSearch} />
                          <CommandList>
                            <CommandEmpty>Nenhuma tag encontrada.</CommandEmpty>
                            <CommandGroup>
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

                {/* Roleta */}
                {users.length > 0 && (
                  <div className="grid gap-1.5">
                    <Label className="flex items-center gap-1 text-xs">
                      <Shuffle className="h-3.5 w-3.5" />
                      Roleta de atendimento
                    </Label>
                    <Select value={rouletteUser ?? ''} onValueChange={setRouletteUser}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Selecionar da roleta" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map(u => (
                          <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

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

                {/* Observações */}
                <div className="grid gap-1.5">
                  <Label className="text-xs">{t('editItem.notes')}</Label>
                  <Textarea
                    placeholder={t('editItem.notesPlaceholder')}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={3}
                    className="text-sm"
                  />
                </div>
              </div>

              {/* RIGHT: history */}
              <div className="flex flex-col overflow-hidden border-l border-border pl-4">
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
            </div>
          </TabsContent>

          {/* Conversa */}
          <TabsContent value="conversation" className="flex-1 overflow-y-auto mt-0 pt-3">
            {item && (
              <CardConversationTab
                item={item}
                onCreateReminder={() => { setActiveTab('tasks'); setShowCreateTaskModal(true); }}
              />
            )}
          </TabsContent>

          {/* Tarefas */}
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

          {/* Imóveis de interesse */}
          <TabsContent value="properties" className="flex-1 overflow-y-auto mt-0 pt-3">
            {item && (
              <CardPropertyInterests
                item={item}
              />
            )}
          </TabsContent>

          {/* Ações */}
          <TabsContent value="actions" className="flex-1 overflow-y-auto mt-0 pt-3">
            {item && (
              <CardActionsPanel
                item={item}
                stages={stages}
                onClose={() => onOpenChange(false)}
                onStageChanged={(newStageId) => setSelectedStageId(newStageId)}
              />
            )}
          </TabsContent>

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
    </Dialog>
  );
}
