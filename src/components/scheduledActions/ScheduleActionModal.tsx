import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@evoapi/design-system';
import { scheduledActionsService } from '@/services/scheduledActions/scheduledActionsService';
import {
  scheduledTemplatesService,
  type MessageTemplate,
  type SequenceTemplate,
} from '@/services/scheduledActions/scheduledTemplatesService';
import { followupSequencesService } from '@/services/followupSequences/followupSequencesService';
import InboxesService from '@/services/channels/inboxesService';
import { contactsService } from '@/services/contacts';
import type { ScheduledAction, CreateScheduledAction } from '@/types/automation';
import type { Inbox } from '@/types/channels/inbox';
import type { Contact } from '@/types/contacts';
import { useLanguage } from '@/hooks/useLanguage';
import { Search, Loader2, Plus, Trash2, Save, ListOrdered } from 'lucide-react';
import { toast } from 'sonner';
import {
  buildChannelOptions,
  getMessagingInboxes,
  isSupportedPayloadChannel,
  type ChannelOption,
} from './scheduledActionChannelUtils';

interface ScheduleActionModalProps {
  open: boolean;
  onClose: () => void;
  contactId?: string;
  action?: ScheduledAction | null;
}

export function ScheduleActionModal({
  open,
  onClose,
  contactId: initialContactId,
  action,
}: ScheduleActionModalProps) {
  const { t } = useLanguage('contacts');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [availableInboxes, setAvailableInboxes] = useState<Inbox[]>([]);
  const [loadingInboxes, setLoadingInboxes] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | undefined>(initialContactId);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [contactSearchResults, setContactSearchResults] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [formData, setFormData] = useState({
    action_type: 'send_message',
    scheduled_for: '',
    channel: '',
    message: '',
    subject: '',
    body: '',
    webhook_url: '',
    webhook_method: 'POST',
    task_title: '',
    task_description: '',
    recurrence_type: 'once',
    media_type: '',
    media_url: '',
  });
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // ---- Sequência de mensagens (funil agendado) ----
  // Modo: false = 1 mensagem (comportamento original), true = vários disparos
  // a partir da data, cada passo com um delay relativo ao anterior.
  const [seqMode, setSeqMode] = useState(false);
  type SeqStep = { message: string; delayValue: number; delayUnit: 'minutes' | 'hours' | 'days' };
  const [steps, setSteps] = useState<SeqStep[]>([{ message: '', delayValue: 0, delayUnit: 'hours' }]);
  const [msgTemplates, setMsgTemplates] = useState<MessageTemplate[]>([]);
  const [seqTemplates, setSeqTemplates] = useState<SequenceTemplate[]>([]);
  const [savingTpl, setSavingTpl] = useState(false);

  const unitMin = (u: SeqStep['delayUnit']) => (u === 'minutes' ? 1 : u === 'hours' ? 60 : 1440);
  const stepDelayMin = useCallback(
    (s: SeqStep, i: number) => (i === 0 ? 0 : Math.max(0, Math.round(s.delayValue)) * unitMin(s.delayUnit)),
    [],
  );
  // Converte minutos salvos de volta pra valor+unidade mais "redondo".
  const minToStep = (m: number): { delayValue: number; delayUnit: SeqStep['delayUnit'] } => {
    if (m > 0 && m % 1440 === 0) return { delayValue: m / 1440, delayUnit: 'days' };
    if (m > 0 && m % 60 === 0) return { delayValue: m / 60, delayUnit: 'hours' };
    return { delayValue: m, delayUnit: 'minutes' };
  };

  const updateStep = (i: number, patch: Partial<SeqStep>) =>
    setSteps(prev => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const addStep = () =>
    setSteps(prev => [...prev, { message: '', delayValue: 1, delayUnit: 'days' }]);
  const removeStep = (i: number) =>
    setSteps(prev => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));

  // Carrega templates (mensagem + sequências) ao abrir.
  useEffect(() => {
    if (!open) return;
    scheduledTemplatesService.listMessages().then(setMsgTemplates).catch(() => setMsgTemplates([]));
    scheduledTemplatesService.listSequences().then(setSeqTemplates).catch(() => setSeqTemplates([]));
  }, [open]);

  const applyMsgTemplate = (i: number, tplId: string) => {
    const tpl = msgTemplates.find(t => t.id === tplId);
    if (tpl) updateStep(i, { message: tpl.message });
  };

  const saveStepAsTemplate = async (i: number) => {
    const msg = steps[i]?.message?.trim();
    if (!msg) {
      toast.error('Escreva a mensagem antes de salvar o template.');
      return;
    }
    const name = window.prompt('Nome do template de mensagem:')?.trim();
    if (!name) return;
    try {
      await scheduledTemplatesService.createMessage(name, msg);
      toast.success('Template de mensagem salvo.');
      setMsgTemplates(await scheduledTemplatesService.listMessages());
    } catch {
      toast.error('Não consegui salvar o template.');
    }
  };

  const saveSequence = async () => {
    const valid = steps.filter(s => s.message.trim());
    if (valid.length === 0) {
      toast.error('Escreva ao menos uma mensagem na sequência.');
      return;
    }
    const name = window.prompt('Nome da sequência salva:')?.trim();
    if (!name) return;
    setSavingTpl(true);
    try {
      await scheduledTemplatesService.createSequence(
        name,
        steps.map((s, i) => ({ message: s.message.trim(), delay_minutes: stepDelayMin(s, i) })),
      );
      toast.success('Sequência salva.');
      setSeqTemplates(await scheduledTemplatesService.listSequences());
    } catch {
      toast.error('Não consegui salvar a sequência.');
    } finally {
      setSavingTpl(false);
    }
  };

  const loadSequence = (tplId: string) => {
    const tpl = seqTemplates.find(t => t.id === tplId);
    if (!tpl || !tpl.steps.length) return;
    setSteps(
      tpl.steps.map(s => ({ message: s.message || '', ...minToStep(Number(s.delay_minutes) || 0) })),
    );
    setSeqMode(true);
  };

  const channelOptions = useMemo<ChannelOption[]>(() => buildChannelOptions(availableInboxes, t), [availableInboxes, t]);

  // Fetch available inboxes when modal opens
  useEffect(() => {
    const fetchInboxes = async () => {
      if (!open) return;

      setLoadingInboxes(true);
      try {
        const response = await InboxesService.list();
        const inboxes = response.data || [];
        setAvailableInboxes(getMessagingInboxes(inboxes));

      } catch (error) {
        console.error('Error fetching inboxes:', error);
      } finally {
        setLoadingInboxes(false);
      }
    };

    fetchInboxes();
  }, [open]);

  useEffect(() => {
    if (!open || action || formData.channel || channelOptions.length === 0) {
      return;
    }

    setFormData(prev => ({ ...prev, channel: channelOptions[0].value }));
  }, [action, channelOptions, formData.channel, open]);

  // Load contact when contactId is provided or when editing
  useEffect(() => {
    if (action?.contact_id) {
      setSelectedContactId(action.contact_id);
      // Try to load contact details if available
      contactsService
        .getContact(action.contact_id)
        .then(contact => setSelectedContact(contact))
        .catch(() => {
          // Contact might not exist, ignore error
        });
    } else if (initialContactId) {
      setSelectedContactId(initialContactId);
      contactsService
        .getContact(initialContactId)
        .then(contact => setSelectedContact(contact))
        .catch(() => {
          // Contact might not exist, ignore error
        });
    }
  }, [action?.contact_id, initialContactId]);

  // Search contacts with debounce
  const searchContacts = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setContactSearchResults([]);
      return;
    }

    setLoadingContacts(true);
    try {
      const response = await contactsService.searchContacts({
        q: query,
        page: 1,
        per_page: 10,
      });
      setContactSearchResults(response.data || []);
    } catch (error) {
      console.error('Error searching contacts:', error);
      setContactSearchResults([]);
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  // Debounce contact search
  useEffect(() => {
    if (!open) return;

    const timeoutId = setTimeout(() => {
      if (contactSearchQuery) {
        searchContacts(contactSearchQuery);
      } else {
        setContactSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [contactSearchQuery, open, searchContacts]);

  // Reset contact search when modal closes
  useEffect(() => {
    if (!open) {
      setContactSearchQuery('');
      setContactSearchResults([]);
      setShowContactDropdown(false);
      if (!initialContactId && !action) {
        setSelectedContactId(undefined);
        setSelectedContact(null);
      } else {
        // Reset to initial contactId if provided
        setSelectedContactId(initialContactId || action?.contact_id);
      }
    }
  }, [open, initialContactId, action]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showContactDropdown && !target.closest('.contact-selector-container')) {
        setShowContactDropdown(false);
      }
    };

    if (showContactDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showContactDropdown]);

  const getMinDateTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Validate contact_id is required
    if (!selectedContactId) {
      newErrors.contact_id = t('scheduledActions.validationRequired.contact');
    }

    if (!formData.scheduled_for) {
      newErrors.scheduled_for = t('scheduledActions.validationRequired.dateTime');
    } else {
      const selectedDate = new Date(formData.scheduled_for);
      const now = new Date();
      if (selectedDate <= now) {
        newErrors.scheduled_for = t('scheduledActions.validationRequired.dateTimeFuture');
      }
    }

    switch (formData.action_type) {
      case 'send_message':
        if (!formData.channel) newErrors.channel = t('scheduledActions.validationRequired.channel');
        if (formData.channel && !isSupportedPayloadChannel(formData.channel)) {
          newErrors.channel = t('scheduledActions.validationRequired.channel');
        }
        if (!formData.message) newErrors.message = t('scheduledActions.validationRequired.message');
        break;
      case 'execute_webhook':
        if (!formData.webhook_url)
          newErrors.webhook_url = t('scheduledActions.validationRequired.webhookUrl');
        break;
      case 'create_task':
        if (!formData.task_title)
          newErrors.task_title = t('scheduledActions.validationRequired.taskTitle');
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => {
    if (action) {
      const getStringValue = (value: unknown, defaultValue: string = ''): string => {
        return typeof value === 'string' ? value : defaultValue;
      };

      setFormData({
        action_type: action.action_type,
        scheduled_for: action.scheduled_for.slice(0, 16),
        channel: getStringValue(action.payload.channel),
        message: getStringValue(action.payload.message),
        subject: getStringValue(action.payload.subject),
        body: getStringValue(action.payload.body),
        webhook_url: getStringValue(action.payload.webhook_url),
        webhook_method: getStringValue(action.payload.webhook_method, 'POST'),
        task_title: getStringValue(action.payload.task_title),
        task_description: getStringValue(action.payload.task_description),
        recurrence_type: action.recurrence_type || 'once',
        media_type: getStringValue(action.payload.media_type),
        media_url: getStringValue(action.payload.media_url),
      });
    } else if (!open) {
      // Reset form when modal closes
      setFormData({
        action_type: 'send_message',
        scheduled_for: '',
        channel: '',
        message: '',
        subject: '',
        body: '',
        webhook_url: '',
        webhook_method: 'POST',
        task_title: '',
        task_description: '',
        recurrence_type: 'once',
        media_type: '',
        media_url: '',
      });
      setErrors({});
    }
  }, [action, open]);

  // Agenda uma SEQUÊNCIA: cria N ações "send_message" a partir da data, cada uma
  // no offset acumulado dos delays. Reusa o executor de scheduled_actions.
  const handleSubmitSequence = async () => {
    const errs: Record<string, string> = {};
    if (!formData.scheduled_for) errs.scheduled_for = t('scheduledActions.validationRequired.dateTime');
    if (!formData.channel) errs.channel = t('scheduledActions.validationRequired.channel');
    const valid = steps.filter(s => s.message.trim());
    if (Object.keys(errs).length > 0 || valid.length === 0) {
      setErrors(errs);
      if (valid.length === 0) toast.error('Escreva ao menos uma mensagem na sequência.');
      return;
    }
    setLoading(true);
    try {
      const startMs = new Date(formData.scheduled_for).getTime();
      let cum = 0;
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        cum += stepDelayMin(s, i);
        if (!s.message.trim()) continue;
        const when = new Date(startMs + cum * 60000).toISOString();
        await scheduledActionsService.create({
          contact_id: selectedContactId,
          action_type: 'send_message',
          scheduled_for: when,
          recurrence_type: 'once',
          payload: { channel: formData.channel, message: s.message.trim() },
        } as CreateScheduledAction);
      }
      toast.success(`${valid.length} mensagem(ns) agendada(s) na sequência.`);
      onClose();
    } catch (error) {
      console.error('Error scheduling sequence:', error);
      toast.error('Falha ao agendar a sequência.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Modo sequência só vale pra mensagem (vários disparos).
    if (seqMode && formData.action_type === 'send_message' && !action) {
      void handleSubmitSequence();
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const payload: CreateScheduledAction = {
        contact_id: selectedContactId,
        action_type: formData.action_type,
        scheduled_for: new Date(formData.scheduled_for).toISOString(),
        payload: {},
        recurrence_type: formData.recurrence_type,
      };

      // Build payload based on action type
      switch (formData.action_type) {
        case 'send_message':
          payload.payload = {
            channel: formData.channel,
            message: formData.message,
            ...(formData.media_url
              ? { media_url: formData.media_url, media_type: formData.media_type || 'image' }
              : {}),
          };
          break;
        case 'execute_webhook':
          payload.payload = {
            webhook_url: formData.webhook_url,
            webhook_method: formData.webhook_method,
          };
          break;
        case 'create_task':
          payload.payload = {
            task_title: formData.task_title,
            task_description: formData.task_description || undefined,
          };
          break;
      }

      if (action) {
        await scheduledActionsService.update(action.id, payload);
      } else {
        await scheduledActionsService.create(payload);
      }

      onClose();
    } catch (error) {
      console.error('Error saving scheduled action:', error);
      if (error instanceof Error && error.message.includes('422')) {
        const errorData = JSON.parse(error.message);
        if (errorData.errors) {
          setErrors(errorData.errors);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {action ? t('scheduledActions.titleEdit') : t('scheduledActions.title')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* CONTACT SELECTOR - Show when contactId is not provided and not editing */}
          {!initialContactId && !action?.contact_id && (
            <div className="space-y-2 contact-selector-container">
              <Label htmlFor="contact">{t('scheduledActions.contact')}</Label>
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="contact"
                    value={selectedContact ? selectedContact.name : contactSearchQuery}
                    onChange={e => {
                      setContactSearchQuery(e.target.value);
                      setShowContactDropdown(true);
                      if (selectedContact) {
                        setSelectedContact(null);
                        setSelectedContactId(undefined);
                      }
                    }}
                    onFocus={() => {
                      if (contactSearchQuery.length >= 2 || contactSearchResults.length > 0) {
                        setShowContactDropdown(true);
                      }
                    }}
                    placeholder={t('scheduledActions.contactPlaceholder')}
                    className={`pl-10 ${errors.contact_id ? 'border-red-500' : ''}`}
                  />
                  {loadingContacts && (
                    <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {selectedContact && !showContactDropdown && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedContact(null);
                        setSelectedContactId(undefined);
                        setContactSearchQuery('');
                      }}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </button>
                  )}
                </div>
                {showContactDropdown && contactSearchResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                    {contactSearchResults.map(contact => (
                      <div
                        key={contact.id}
                        className="px-4 py-2 hover:bg-accent cursor-pointer border-b border-border last:border-b-0"
                        onClick={() => {
                          setSelectedContact(contact);
                          setSelectedContactId(contact.id);
                          setContactSearchQuery('');
                          setShowContactDropdown(false);
                          if (errors.contact_id) {
                            setErrors({ ...errors, contact_id: '' });
                          }
                        }}
                      >
                        <div className="font-medium">{contact.name}</div>
                        {contact.email && (
                          <div className="text-sm text-muted-foreground">{contact.email}</div>
                        )}
                        {contact.phone_number && (
                          <div className="text-sm text-muted-foreground">{contact.phone_number}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {showContactDropdown && contactSearchQuery.length >= 2 && !loadingContacts && contactSearchResults.length === 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg p-4 text-sm text-muted-foreground">
                    {t('scheduledActions.noContactsFound')}
                  </div>
                )}
              </div>
              {errors.contact_id && <p className="text-sm text-red-500">{errors.contact_id}</p>}
            </div>
          )}

          {/* GENERAL SCHEDULE PARAMETERS - FIRST */}
          <div className="space-y-2">
            <Label htmlFor="scheduled_for">{t('scheduledActions.dateTime')}</Label>
            <Input
              id="scheduled_for"
              type="datetime-local"
              value={formData.scheduled_for}
              min={getMinDateTime()}
              onChange={e => {
                setFormData({ ...formData, scheduled_for: e.target.value });
                if (errors.scheduled_for) {
                  setErrors({ ...errors, scheduled_for: '' });
                }
              }}
              required
              className={errors.scheduled_for ? 'border-red-500' : ''}
            />
            {errors.scheduled_for && <p className="text-sm text-red-500">{errors.scheduled_for}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="recurrence_type">{t('scheduledActions.recurrence')}</Label>
            <Select
              value={formData.recurrence_type}
              onValueChange={value => setFormData({ ...formData, recurrence_type: value })}
            >
              <SelectTrigger id="recurrence_type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="once">{t('scheduledActions.recurrenceOnce')}</SelectItem>
                <SelectItem value="daily">{t('scheduledActions.recurrenceDaily')}</SelectItem>
                <SelectItem value="weekly">{t('scheduledActions.recurrenceWeekly')}</SelectItem>
                <SelectItem value="monthly">{t('scheduledActions.recurrenceMonthly')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ACTION TYPE - MIDDLE */}
          <div className="space-y-2">
            <Label htmlFor="action_type">{t('scheduledActions.actionType')}</Label>
            <Select
              value={formData.action_type}
              onValueChange={value =>
                setFormData({
                  ...formData,
                  action_type: value,
                  message: '',
                  webhook_url: '',
                            task_title: '',
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="send_message">
                  {t('scheduledActions.actions.send_message')}
                </SelectItem>
                <SelectItem value="execute_webhook">
                  {t('scheduledActions.actions.execute_webhook')}
                </SelectItem>
                <SelectItem value="create_task">
                  {t('scheduledActions.actions.create_task')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ACTION-SPECIFIC FIELDS - LAST */}
          {/* SEND MESSAGE - with channel selector */}
          {formData.action_type === 'send_message' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="channel">{t('scheduledActions.channel')}</Label>
                <Select
                  value={formData.channel}
                  onValueChange={value => setFormData({ ...formData, channel: value })}
                  disabled={loadingInboxes || channelOptions.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingInboxes ? 'Loading channels...' : 'Select a channel'} />
                  </SelectTrigger>
                  <SelectContent>
                    {channelOptions.length === 0 && !loadingInboxes && (
                      <div className="px-2 py-1.5 text-sm text-gray-500">
                        No channels configured
                      </div>
                    )}
                    {channelOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {channelOptions.length === 0 && !loadingInboxes && (
                  <p className="text-sm text-orange-600">
                    {t('scheduledActions.messages.noChannelsConfigured')}
                  </p>
                )}
                {errors.channel && <p className="text-sm text-red-500">{errors.channel}</p>}
              </div>

              {/* Modo: mensagem única (original) vs sequência (vários disparos) */}
              {!action && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={!seqMode ? 'default' : 'outline'}
                    onClick={() => setSeqMode(false)}
                  >
                    Mensagem única
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={seqMode ? 'default' : 'outline'}
                    onClick={() => setSeqMode(true)}
                  >
                    <ListOrdered className="h-3.5 w-3.5 mr-1" /> Sequência
                  </Button>
                  {seqMode && seqTemplates.length > 0 && (
                    <Select value="" onValueChange={loadSequence}>
                      <SelectTrigger className="h-8 w-44 text-xs">
                        <SelectValue placeholder="Carregar sequência salva" />
                      </SelectTrigger>
                      <SelectContent>
                        {seqTemplates.map(tpl => (
                          <SelectItem key={tpl.id} value={tpl.id}>{tpl.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {!seqMode && (
              <div className="space-y-2">
                <Label htmlFor="message">{t('scheduledActions.message')}</Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={e => {
                    setFormData({ ...formData, message: e.target.value });
                    if (errors.message) {
                      setErrors({ ...errors, message: '' });
                    }
                  }}
                  rows={5}
                  required
                  className={errors.message ? 'border-red-500' : ''}
                />
                <p className="text-xs text-muted-foreground">
                  Variáveis: <code>{'{{nome}}'}</code> <code>{'{{nome_completo}}'}</code>{' '}
                  <code>{'{{telefone}}'}</code> <code>{'{{email}}'}</code> — substituídas pelos dados do contato no envio.
                </p>
                {errors.message && <p className="text-sm text-red-500">{errors.message}</p>}

                {/* Mídia opcional (imagem/áudio/vídeo/documento) */}
                <div className="flex items-center gap-2 pt-1">
                  <select
                    value={formData.media_type}
                    onChange={e => setFormData({ ...formData, media_type: e.target.value })}
                    className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                  >
                    <option value="">Sem mídia</option>
                    <option value="image">Imagem</option>
                    <option value="audio">Áudio</option>
                    <option value="video">Vídeo</option>
                    <option value="document">Documento</option>
                  </select>
                  {formData.media_type && (
                    <label className="cursor-pointer text-xs text-primary underline">
                      {uploadingMedia
                        ? 'Enviando...'
                        : formData.media_url
                        ? 'Trocar arquivo'
                        : 'Anexar arquivo'}
                      <input
                        type="file"
                        className="hidden"
                        accept={
                          formData.media_type === 'image'
                            ? 'image/*'
                            : formData.media_type === 'audio'
                            ? 'audio/*'
                            : formData.media_type === 'video'
                            ? 'video/*'
                            : '.pdf,.doc,.docx,.xls,.xlsx,.txt,application/pdf'
                        }
                        onChange={async e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploadingMedia(true);
                          try {
                            const out = await followupSequencesService.uploadMedia(file);
                            setFormData(prev => ({ ...prev, media_url: out.url }));
                          } catch {
                            /* erro de upload tratado pelo toast do serviço */
                          } finally {
                            setUploadingMedia(false);
                            e.currentTarget.value = '';
                          }
                        }}
                      />
                    </label>
                  )}
                  {formData.media_url && (
                    <span className="text-xs text-emerald-600">anexado ✓</span>
                  )}
                </div>
              </div>
              )}

              {/* SEQUÊNCIA DE MENSAGENS — vários disparos a partir da data */}
              {seqMode && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm flex items-center gap-1.5">
                      <ListOrdered className="h-4 w-4" /> Mensagens da sequência
                    </Label>
                    <button
                      type="button"
                      onClick={saveSequence}
                      disabled={savingTpl}
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      <Save className="h-3.5 w-3.5" /> Salvar sequência
                    </button>
                  </div>

                  {steps.map((s, i) => (
                    <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground">Passo {i + 1}</span>
                        <div className="flex items-center gap-2">
                          {msgTemplates.length > 0 && (
                            <Select value="" onValueChange={v => applyMsgTemplate(i, v)}>
                              <SelectTrigger className="h-7 w-36 text-xs">
                                <SelectValue placeholder="Usar template" />
                              </SelectTrigger>
                              <SelectContent>
                                {msgTemplates.map(tpl => (
                                  <SelectItem key={tpl.id} value={tpl.id}>{tpl.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          <button
                            type="button"
                            title="Salvar esta mensagem como template"
                            onClick={() => saveStepAsTemplate(i)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Save className="h-3.5 w-3.5" />
                          </button>
                          {steps.length > 1 && (
                            <button
                              type="button"
                              title="Remover passo"
                              onClick={() => removeStep(i)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {i === 0 ? (
                        <p className="text-[11px] text-muted-foreground">
                          Dispara na data/hora escolhida acima.
                        </p>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-muted-foreground">Enviar</span>
                          <Input
                            type="number"
                            min={0}
                            value={s.delayValue}
                            onChange={e => updateStep(i, { delayValue: Number(e.target.value) || 0 })}
                            className="h-7 w-16 text-xs"
                          />
                          <select
                            value={s.delayUnit}
                            onChange={e => updateStep(i, { delayUnit: e.target.value as SeqStep['delayUnit'] })}
                            className="h-7 rounded-md border border-border bg-background px-2 text-xs"
                          >
                            <option value="minutes">minutos</option>
                            <option value="hours">horas</option>
                            <option value="days">dias</option>
                          </select>
                          <span className="text-muted-foreground">depois do passo anterior</span>
                        </div>
                      )}

                      <Textarea
                        value={s.message}
                        onChange={e => updateStep(i, { message: e.target.value })}
                        rows={3}
                        placeholder="Mensagem deste passo..."
                        className="text-sm"
                      />
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addStep}
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar mensagem
                  </button>
                  <p className="text-[11px] text-muted-foreground">
                    Variáveis: <code>{'{{nome}}'}</code> <code>{'{{telefone}}'}</code> etc. Cada passo vira um agendamento.
                  </p>
                </div>
              )}
            </>
          )}

          {/* EXECUTE WEBHOOK */}
          {formData.action_type === 'execute_webhook' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="webhook_url">{t('scheduledActions.webhookUrl')}</Label>
                <Input
                  id="webhook_url"
                  type="url"
                  value={formData.webhook_url}
                  onChange={e => {
                    setFormData({ ...formData, webhook_url: e.target.value });
                    if (errors.webhook_url) {
                      setErrors({ ...errors, webhook_url: '' });
                    }
                  }}
                  placeholder="https://example.com/webhook"
                  required
                  className={errors.webhook_url ? 'border-red-500' : ''}
                />
                {errors.webhook_url && <p className="text-sm text-red-500">{errors.webhook_url}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhook_method">{t('scheduledActions.webhookMethod')}</Label>
                <Select
                  value={formData.webhook_method}
                  onValueChange={value => setFormData({ ...formData, webhook_method: value })}
                >
                  <SelectTrigger id="webhook_method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* CREATE TASK */}
          {formData.action_type === 'create_task' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="task_title">{t('scheduledActions.taskTitle')}</Label>
                <Input
                  id="task_title"
                  value={formData.task_title}
                  onChange={e => {
                    setFormData({ ...formData, task_title: e.target.value });
                    if (errors.task_title) {
                      setErrors({ ...errors, task_title: '' });
                    }
                  }}
                  required
                  className={errors.task_title ? 'border-red-500' : ''}
                />
                {errors.task_title && <p className="text-sm text-red-500">{errors.task_title}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="task_description">{t('scheduledActions.taskDescription')}</Label>
                <Textarea
                  id="task_description"
                  value={formData.task_description}
                  onChange={e => setFormData({ ...formData, task_description: e.target.value })}
                  rows={4}
                />
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('scheduledActions.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={
                loading ||
                (formData.action_type === 'send_message' && channelOptions.length === 0) ||
                (!initialContactId && !selectedContactId)
              }
            >
              {loading ? t('scheduledActions.saving') : t('scheduledActions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
