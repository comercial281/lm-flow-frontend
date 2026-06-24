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
import { followupSequencesService } from '@/services/followupSequences/followupSequencesService';
import {
  messageFunnelsService,
  tenantTemplateVariablesService,
} from '@/services/messageFunnels/messageFunnelsService';
import type { MessageFunnel, MessageFunnelItem, TemplateVariable } from '@/types/messageFunnels';
import InboxesService from '@/services/channels/inboxesService';
import { contactsService } from '@/services/contacts';
import type { ScheduledAction, CreateScheduledAction } from '@/types/automation';
import type { Inbox } from '@/types/channels/inbox';
import type { Contact } from '@/types/contacts';
import { useLanguage } from '@/hooks/useLanguage';
import { Search, Loader2, Plus, Trash2, Save, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import MessageSequenceEditor, {
  type SequenceDraftItem,
  newSequenceItem,
} from '@/components/messaging/MessageSequenceEditor';
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

type DelayUnit = 'minutes' | 'hours' | 'days';

interface ScheduleBlock {
  items: SequenceDraftItem[];
  delayValue: number;
  delayUnit: DelayUnit;
}

const unitMin = (u: DelayUnit) => (u === 'minutes' ? 1 : u === 'hours' ? 60 : 1440);

function itemIsValid(it: SequenceDraftItem) {
  return it.kind === 'text' ? (it.text_content ?? '').trim() !== '' : !!it.media_url;
}

function draftFromFunnelItem(it: MessageFunnelItem): SequenceDraftItem {
  return {
    uiKey: crypto.randomUUID(),
    kind: it.kind,
    text_content: it.text_content,
    media_url: it.media_url,
    media_filename: it.media_filename,
    media_caption: it.media_caption,
    delay_seconds: it.delay_seconds,
    pendingFile: null,
  };
}

function toSeqPayload(items: SequenceDraftItem[]) {
  return items
    .filter(itemIsValid)
    .map((it, idx) => ({
      position: idx,
      kind: it.kind,
      text_content: it.text_content,
      media_url: it.media_url,
      media_caption: it.media_caption,
      media_filename: it.media_filename,
      delay_seconds: it.delay_seconds,
    }));
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

  // Sequência rica + agendamento por bloco (modal único).
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([
    { items: [newSequenceItem()], delayValue: 1, delayUnit: 'days' },
  ]);
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [funnelTemplates, setFunnelTemplates] = useState<MessageFunnel[]>([]);

  const isRichChannel = formData.channel !== '' && formData.channel !== 'email';

  const updateBlock = (i: number, patch: Partial<ScheduleBlock>) =>
    setBlocks(prev => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const addBlock = () =>
    setBlocks(prev => [...prev, { items: [newSequenceItem()], delayValue: 1, delayUnit: 'days' }]);
  const removeBlock = (i: number) =>
    setBlocks(prev => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));

  const uploadMedia = useCallback((file: File) => followupSequencesService.uploadMedia(file), []);

  useEffect(() => {
    if (!open) return;
    tenantTemplateVariablesService
      .list()
      .then(res =>
        setVariables([
          ...res.builtin,
          ...res.custom.map(v => ({
            token: v.token,
            placeholder: v.placeholder,
            label: v.label,
            description: v.description,
            builtin: false,
          })),
        ]),
      )
      .catch(() =>
        setVariables([
          { token: 'nome', placeholder: '{{nome}}', label: 'Nome', builtin: true },
          { token: 'telefone', placeholder: '{{telefone}}', label: 'Telefone', builtin: true },
          { token: 'email', placeholder: '{{email}}', label: 'E-mail', builtin: true },
        ]),
      );
    messageFunnelsService
      .list({ activeOnly: true })
      .then(setFunnelTemplates)
      .catch(() => setFunnelTemplates([]));
  }, [open]);

  const loadTemplateIntoBlock = async (blockIdx: number, funnelId: string) => {
    try {
      const funnel = await messageFunnelsService.get(funnelId);
      const items = funnel.items.length ? funnel.items.map(draftFromFunnelItem) : [newSequenceItem()];
      updateBlock(blockIdx, { items });
      toast.success(`Modelo "${funnel.name}" carregado`);
    } catch {
      toast.error('Não consegui carregar o modelo.');
    }
  };

  const saveBlockAsTemplate = async (blockIdx: number) => {
    const items = blocks[blockIdx]?.items.filter(itemIsValid) ?? [];
    if (!items.length) {
      toast.error('Monte a mensagem antes de salvar o modelo.');
      return;
    }
    const name = window.prompt('Nome do modelo:')?.trim();
    if (!name) return;
    try {
      await messageFunnelsService.create({
        name,
        category: 'geral',
        active: true,
        shared: true,
        items: toSeqPayload(items).map((it, idx) => ({
          position: idx,
          kind: it.kind,
          text_content: it.text_content,
          media_caption: it.media_caption,
          media_filename: it.media_filename,
          delay_seconds: it.delay_seconds,
        })),
      });
      toast.success('Modelo salvo na biblioteca.');
      setFunnelTemplates(await messageFunnelsService.list({ activeOnly: true }));
    } catch {
      toast.error('Não consegui salvar o modelo.');
    }
  };

  const channelOptions = useMemo<ChannelOption[]>(() => buildChannelOptions(availableInboxes, t), [availableInboxes, t]);

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
    if (!open || action || formData.channel || channelOptions.length === 0) return;
    setFormData(prev => ({ ...prev, channel: channelOptions[0].value }));
  }, [action, channelOptions, formData.channel, open]);

  useEffect(() => {
    if (action?.contact_id) {
      setSelectedContactId(action.contact_id);
      contactsService.getContact(action.contact_id).then(setSelectedContact).catch(() => {});
    } else if (initialContactId) {
      setSelectedContactId(initialContactId);
      contactsService.getContact(initialContactId).then(setSelectedContact).catch(() => {});
    }
  }, [action?.contact_id, initialContactId]);

  const searchContacts = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setContactSearchResults([]);
      return;
    }
    setLoadingContacts(true);
    try {
      const response = await contactsService.searchContacts({ q: query, page: 1, per_page: 10 });
      setContactSearchResults(response.data || []);
    } catch (error) {
      console.error('Error searching contacts:', error);
      setContactSearchResults([]);
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const timeoutId = setTimeout(() => {
      if (contactSearchQuery) searchContacts(contactSearchQuery);
      else setContactSearchResults([]);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [contactSearchQuery, open, searchContacts]);

  useEffect(() => {
    if (!open) {
      setContactSearchQuery('');
      setContactSearchResults([]);
      setShowContactDropdown(false);
      if (!initialContactId && !action) {
        setSelectedContactId(undefined);
        setSelectedContact(null);
      } else {
        setSelectedContactId(initialContactId || action?.contact_id);
      }
      setBlocks([{ items: [newSequenceItem()], delayValue: 1, delayUnit: 'days' }]);
    }
  }, [open, initialContactId, action]);

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
    const p = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}T${p(now.getHours())}:${p(now.getMinutes())}`;
  };

  useEffect(() => {
    if (action) {
      const sv = (value: unknown, def = ''): string => (typeof value === 'string' ? value : def);
      setFormData({
        action_type: action.action_type,
        scheduled_for: action.scheduled_for.slice(0, 16),
        channel: sv(action.payload.channel),
        message: sv(action.payload.message),
        subject: sv(action.payload.subject),
        body: sv(action.payload.body),
        webhook_url: sv(action.payload.webhook_url),
        webhook_method: sv(action.payload.webhook_method, 'POST'),
        task_title: sv(action.payload.task_title),
        task_description: sv(action.payload.task_description),
        recurrence_type: action.recurrence_type || 'once',
        media_type: sv(action.payload.media_type),
        media_url: sv(action.payload.media_url),
      });
      const fi = Array.isArray(action.payload.funnel_items)
        ? (action.payload.funnel_items as MessageFunnelItem[])
        : [];
      if (fi.length) {
        setBlocks([{ items: fi.map(draftFromFunnelItem), delayValue: 1, delayUnit: 'days' }]);
      } else if (sv(action.payload.message)) {
        setBlocks([
          {
            items: [{ ...newSequenceItem('text'), text_content: sv(action.payload.message) }],
            delayValue: 1,
            delayUnit: 'days',
          },
        ]);
      }
    } else if (!open) {
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

  const validateBase = () => {
    const e: Record<string, string> = {};
    if (!selectedContactId) e.contact_id = t('scheduledActions.validationRequired.contact');
    if (!formData.scheduled_for) {
      e.scheduled_for = t('scheduledActions.validationRequired.dateTime');
    } else if (new Date(formData.scheduled_for) <= new Date()) {
      e.scheduled_for = t('scheduledActions.validationRequired.dateTimeFuture');
    }
    return e;
  };

  const validateForm = () => {
    const newErrors = validateBase();
    switch (formData.action_type) {
      case 'send_message':
        if (!formData.channel || !isSupportedPayloadChannel(formData.channel)) {
          newErrors.channel = t('scheduledActions.validationRequired.channel');
        }
        if (!formData.message) newErrors.message = t('scheduledActions.validationRequired.message');
        break;
      case 'execute_webhook':
        if (!formData.webhook_url) newErrors.webhook_url = t('scheduledActions.validationRequired.webhookUrl');
        break;
      case 'create_task':
        if (!formData.task_title) newErrors.task_title = t('scheduledActions.validationRequired.taskTitle');
        break;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmitRich = async () => {
    const errs = validateBase();
    if (!formData.channel) errs.channel = t('scheduledActions.validationRequired.channel');
    const anyValid = blocks.some(b => b.items.some(itemIsValid));
    if (Object.keys(errs).length > 0 || !anyValid) {
      setErrors(errs);
      if (!anyValid) toast.error('Monte ao menos uma mensagem.');
      return;
    }
    setLoading(true);
    try {
      const startMs = new Date(formData.scheduled_for).getTime();
      let cum = 0;
      let created = 0;
      if (action) {
        const items = toSeqPayload(blocks[0].items);
        await scheduledActionsService.update(action.id, {
          contact_id: selectedContactId,
          action_type: 'send_message',
          scheduled_for: new Date(formData.scheduled_for).toISOString(),
          recurrence_type: formData.recurrence_type,
          payload: { channel: formData.channel, funnel_items: items },
        } as CreateScheduledAction);
        created = 1;
      } else {
        for (let i = 0; i < blocks.length; i++) {
          const b = blocks[i];
          cum += i === 0 ? 0 : unitMin(b.delayUnit) * Math.max(0, Math.round(b.delayValue));
          const items = toSeqPayload(b.items);
          if (!items.length) continue;
          const when = new Date(startMs + cum * 60000).toISOString();
          await scheduledActionsService.create({
            contact_id: selectedContactId,
            action_type: 'send_message',
            scheduled_for: when,
            recurrence_type: i === 0 ? formData.recurrence_type : 'once',
            payload: { channel: formData.channel, funnel_items: items },
          } as CreateScheduledAction);
          created += 1;
        }
      }
      toast.success(`${created} agendamento(s) criado(s).`);
      onClose();
    } catch (error) {
      console.error('Error scheduling rich blocks:', error);
      toast.error('Falha ao agendar.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.action_type === 'send_message' && isRichChannel) {
      void handleSubmitRich();
      return;
    }
    if (!validateForm()) return;
    setLoading(true);
    try {
      const payload: CreateScheduledAction = {
        contact_id: selectedContactId,
        action_type: formData.action_type,
        scheduled_for: new Date(formData.scheduled_for).toISOString(),
        payload: {},
        recurrence_type: formData.recurrence_type,
      };
      switch (formData.action_type) {
        case 'send_message':
          payload.payload = {
            channel: formData.channel,
            message: formData.message,
            ...(formData.subject ? { subject: formData.subject } : {}),
            ...(formData.media_url
              ? { media_url: formData.media_url, media_type: formData.media_type || 'image' }
              : {}),
          };
          break;
        case 'execute_webhook':
          payload.payload = { webhook_url: formData.webhook_url, webhook_method: formData.webhook_method };
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
        try {
          const errorData = JSON.parse(error.message);
          if (errorData.errors) setErrors(errorData.errors);
        } catch {
          /* ignore */
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{action ? t('scheduledActions.titleEdit') : t('scheduledActions.title')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
                          if (errors.contact_id) setErrors({ ...errors, contact_id: '' });
                        }}
                      >
                        <div className="font-medium">{contact.name}</div>
                        {contact.email && <div className="text-sm text-muted-foreground">{contact.email}</div>}
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

          <div className="space-y-2">
            <Label htmlFor="scheduled_for">{t('scheduledActions.dateTime')}</Label>
            <Input
              id="scheduled_for"
              type="datetime-local"
              value={formData.scheduled_for}
              min={getMinDateTime()}
              onChange={e => {
                setFormData({ ...formData, scheduled_for: e.target.value });
                if (errors.scheduled_for) setErrors({ ...errors, scheduled_for: '' });
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

          <div className="space-y-2">
            <Label htmlFor="action_type">{t('scheduledActions.actionType')}</Label>
            <Select
              value={formData.action_type}
              onValueChange={value =>
                setFormData({ ...formData, action_type: value, message: '', webhook_url: '', task_title: '' })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="send_message">{t('scheduledActions.actions.send_message')}</SelectItem>
                <SelectItem value="execute_webhook">{t('scheduledActions.actions.execute_webhook')}</SelectItem>
                <SelectItem value="create_task">{t('scheduledActions.actions.create_task')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
                      <div className="px-2 py-1.5 text-sm text-gray-500">No channels configured</div>
                    )}
                    {channelOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {channelOptions.length === 0 && !loadingInboxes && (
                  <p className="text-sm text-orange-600">{t('scheduledActions.messages.noChannelsConfigured')}</p>
                )}
                {errors.channel && <p className="text-sm text-red-500">{errors.channel}</p>}
              </div>

              {isRichChannel && (
                <div className="space-y-3">
                  {blocks.map((b, i) => (
                    <div key={i} className="rounded-lg border border-border p-3 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                          <CalendarClock className="h-3.5 w-3.5" /> Bloco {i + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          {funnelTemplates.length > 0 && (
                            <Select value="" onValueChange={v => loadTemplateIntoBlock(i, v)}>
                              <SelectTrigger className="h-7 w-40 text-xs">
                                <SelectValue placeholder="Usar modelo" />
                              </SelectTrigger>
                              <SelectContent>
                                {funnelTemplates.map(f => (
                                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          <button
                            type="button"
                            title="Salvar como modelo na biblioteca"
                            onClick={() => saveBlockAsTemplate(i)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Save className="h-3.5 w-3.5" />
                          </button>
                          {blocks.length > 1 && (
                            <button
                              type="button"
                              title="Remover bloco"
                              onClick={() => removeBlock(i)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {i === 0 ? (
                        <p className="text-[11px] text-muted-foreground">Dispara na data/hora marcada acima.</p>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-muted-foreground">Enviar</span>
                          <Input
                            type="number"
                            min={0}
                            value={b.delayValue}
                            onChange={e => updateBlock(i, { delayValue: Number(e.target.value) || 0 })}
                            className="h-7 w-16 text-xs"
                          />
                          <select
                            value={b.delayUnit}
                            onChange={e => updateBlock(i, { delayUnit: e.target.value as DelayUnit })}
                            className="h-7 rounded-md border border-border bg-background px-2 text-xs"
                          >
                            <option value="minutes">minutos</option>
                            <option value="hours">horas</option>
                            <option value="days">dias</option>
                          </select>
                          <span className="text-muted-foreground">depois do bloco anterior</span>
                        </div>
                      )}

                      <MessageSequenceEditor
                        items={b.items}
                        onChange={items => updateBlock(i, { items })}
                        variables={variables}
                        uploadMedia={uploadMedia}
                      />
                    </div>
                  ))}

                  {!action && (
                    <button
                      type="button"
                      onClick={addBlock}
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Adicionar bloco agendado
                    </button>
                  )}
                </div>
              )}

              {!isRichChannel && formData.channel === 'email' && (
                <div className="space-y-2">
                  <Label htmlFor="subject">Assunto</Label>
                  <Input
                    id="subject"
                    value={formData.subject}
                    onChange={e => setFormData({ ...formData, subject: e.target.value })}
                  />
                  <Label htmlFor="message">{t('scheduledActions.message')}</Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={e => {
                      setFormData({ ...formData, message: e.target.value });
                      if (errors.message) setErrors({ ...errors, message: '' });
                    }}
                    rows={5}
                    required
                    className={errors.message ? 'border-red-500' : ''}
                  />
                  {errors.message && <p className="text-sm text-red-500">{errors.message}</p>}
                </div>
              )}
            </>
          )}

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
                    if (errors.webhook_url) setErrors({ ...errors, webhook_url: '' });
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

          {formData.action_type === 'create_task' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="task_title">{t('scheduledActions.taskTitle')}</Label>
                <Input
                  id="task_title"
                  value={formData.task_title}
                  onChange={e => {
                    setFormData({ ...formData, task_title: e.target.value });
                    if (errors.task_title) setErrors({ ...errors, task_title: '' });
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
