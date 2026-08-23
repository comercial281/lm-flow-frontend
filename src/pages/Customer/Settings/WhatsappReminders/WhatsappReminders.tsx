import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Bell, Play, Plus, Trash2, Pencil, Loader2 } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea
} from '@/components/ui/ds';
import { whatsappRemindersService } from '@/services/whatsappReminders';
import {
  WhatsappReminder,
  WhatsappReminderGroup,
  CreateReminderData,
  ReminderTriggerType,
  ReminderDeliveryMode,
  ReminderDestinationType,
  ReminderContentMode,
  TRIGGER_LABELS,
  DELIVERY_LABELS,
  DESTINATION_LABELS,
  CONTENT_LABELS
} from '@/types/automation';
import api from '@/services/core/api';
import { extractData } from '@/utils/apiHelpers';

interface InboxOption {
  id: number;
  name: string;
  channel_type?: string;
}

const EMPTY_FORM: CreateReminderData = {
  name: '',
  enabled: true,
  trigger_type: 'manual_macro',
  trigger_config: {},
  delivery_mode: 'immediate',
  delivery_config: {},
  destination_type: 'number',
  destination_value: {},
  inbox_id: null,
  content_mode: 'editor_vars',
  content_template: 'Olá {{nome}}, lembrete do LM Flow.',
  content_card_layout: null
};

export default function WhatsappReminders() {
  const [items, setItems] = useState<WhatsappReminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WhatsappReminder | null>(null);
  const [form, setForm] = useState<CreateReminderData>(EMPTY_FORM);
  const [inboxes, setInboxes] = useState<InboxOption[]>([]);
  const [groups, setGroups] = useState<WhatsappReminderGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await whatsappRemindersService.list({ page: 1, per_page: 50 });
      setItems(res.data || []);
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao carregar lembretes');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInboxes = useCallback(async () => {
    try {
      const res = await api.get('/inboxes');
      const data = extractData<any>(res);
      const arr = Array.isArray(data) ? data : data?.data || [];
      const onlyWhats = arr.filter((i: any) =>
        String(i.channel_type || '').match(/whatsapp|api/i)
      );
      setInboxes(onlyWhats.map((i: any) => ({ id: i.id, name: i.name, channel_type: i.channel_type })));
    } catch (e) {
      console.error('inboxes load failed', e);
    }
  }, []);

  useEffect(() => {
    load();
    loadInboxes();
  }, [load, loadInboxes]);

  // Lazy load groups quando trocar pra destino=group e tiver inbox
  useEffect(() => {
    if (form.destination_type !== 'group' || !form.inbox_id) {
      setGroups([]);
      return;
    }
    setGroupsLoading(true);
    whatsappRemindersService
      .listGroups(form.inbox_id)
      .then(setGroups)
      .catch(e => {
        console.error(e);
        toast.error('Não foi possível listar grupos da instância');
      })
      .finally(() => setGroupsLoading(false));
  }, [form.destination_type, form.inbox_id]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, inbox_id: inboxes[0]?.id || null });
    setModalOpen(true);
  };

  const openEdit = (r: WhatsappReminder) => {
    setEditing(r);
    setForm({
      name: r.name,
      enabled: r.enabled,
      trigger_type: r.trigger_type,
      trigger_config: r.trigger_config || {},
      delivery_mode: r.delivery_mode,
      delivery_config: r.delivery_config || {},
      destination_type: r.destination_type,
      destination_value: r.destination_value || {},
      inbox_id: r.inbox_id,
      content_mode: r.content_mode,
      content_template: r.content_template,
      content_card_layout: r.content_card_layout
    });
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (!form.name?.trim()) {
        toast.error('Nome obrigatório');
        return;
      }
      if (editing) {
        await whatsappRemindersService.update(editing.id, form);
        toast.success('Lembrete atualizado');
      } else {
        await whatsappRemindersService.create(form);
        toast.success('Lembrete criado');
      }
      setModalOpen(false);
      load();
    } catch (e: any) {
      console.error(e);
      const details = e?.response?.data?.details || e?.response?.data?.message || 'Erro ao salvar';
      toast.error(Array.isArray(details) ? details.join(', ') : details);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: WhatsappReminder) => {
    if (!confirm(`Apagar lembrete "${r.name}"?`)) return;
    try {
      await whatsappRemindersService.remove(r.id);
      toast.success('Lembrete apagado');
      load();
    } catch {
      toast.error('Falha ao apagar');
    }
  };

  const runNow = async (r: WhatsappReminder) => {
    setExecuting(r.id);
    try {
      const res = await whatsappRemindersService.execute({ reminderId: r.id });
      if (res.status === 'sent') {
        toast.success('Lembrete disparado com sucesso');
      } else {
        toast.error(`Disparo retornou status ${res.status}`);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Falha no disparo';
      toast.error(msg);
    } finally {
      setExecuting(null);
    }
  };

  const requiresInbox = useMemo(() => true, []);
  const showNumberField = form.destination_type === 'number';
  const showGroupField = form.destination_type === 'group';
  const showDelayField = form.delivery_mode === 'delayed';
  const showCronField = form.delivery_mode === 'recurring';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Bell className="w-6 h-6 text-violet-600" /> Lembretes WhatsApp
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Dispare mensagens automáticas pra número, grupo, lead ou atendente.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" /> Novo lembrete
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
        </div>
      ) : items.length === 0 ? (
        <div className="border border-dashed rounded-lg p-12 text-center text-muted-foreground">
          <Bell className="w-10 h-10 mx-auto mb-3 opacity-50" />
          Nenhum lembrete criado ainda. Clique em <strong>Novo lembrete</strong>.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3">Nome</th>
                <th className="text-left p-3">Trigger</th>
                <th className="text-left p-3">Destino</th>
                <th className="text-left p-3">Instância</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map(r => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-medium">{r.name}</td>
                  <td className="p-3">{TRIGGER_LABELS[r.trigger_type]}</td>
                  <td className="p-3">{DESTINATION_LABELS[r.destination_type]}</td>
                  <td className="p-3">{r.inbox_name || '—'}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${r.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}
                    >
                      {r.enabled ? 'Ativo' : 'Pausado'}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => runNow(r)}
                      disabled={executing === r.id}
                      title="Executar agora"
                    >
                      {executing === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)} title="Editar">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(r)} title="Apagar">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar lembrete' : 'Novo lembrete'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Avisar comercial sobre novo lead"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.enabled}
                onCheckedChange={(v: boolean) => setForm({ ...form, enabled: v })}
              />
              <Label>Ativo</Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Quando disparar (trigger)</Label>
                <Select
                  value={form.trigger_type}
                  onValueChange={v => setForm({ ...form, trigger_type: v as ReminderTriggerType })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.trigger_type !== 'manual_macro' && (
                  <p className="text-xs text-amber-600 mt-1">
                    Trigger automático estará disponível na Fase 2. Por enquanto só "Manual" funciona.
                  </p>
                )}
              </div>

              <div>
                <Label>Modo de entrega</Label>
                <Select
                  value={form.delivery_mode}
                  onValueChange={v => setForm({ ...form, delivery_mode: v as ReminderDeliveryMode })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DELIVERY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.delivery_mode !== 'immediate' && (
                  <p className="text-xs text-amber-600 mt-1">
                    Delay/recorrente estará disponível na Fase 2.
                  </p>
                )}
              </div>
            </div>

            {showDelayField && (
              <div>
                <Label>Delay (minutos)</Label>
                <Input
                  type="number"
                  value={form.delivery_config?.delay_minutes || 0}
                  onChange={e =>
                    setForm({
                      ...form,
                      delivery_config: { ...(form.delivery_config || {}), delay_minutes: parseInt(e.target.value, 10) || 0 }
                    })
                  }
                />
              </div>
            )}

            {showCronField && (
              <div>
                <Label>Cron (ex: 0 9 * * * = todo dia 9h)</Label>
                <Input
                  value={form.delivery_config?.cron || ''}
                  onChange={e =>
                    setForm({ ...form, delivery_config: { ...(form.delivery_config || {}), cron: e.target.value } })
                  }
                  placeholder="0 9 * * *"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Instância (inbox WhatsApp) {requiresInbox && '*'}</Label>
                <Select
                  value={form.inbox_id ? String(form.inbox_id) : ''}
                  onValueChange={v => setForm({ ...form, inbox_id: v ? parseInt(v, 10) : null })}
                >
                  <SelectTrigger><SelectValue placeholder="Escolha a instância" /></SelectTrigger>
                  <SelectContent>
                    {inboxes.map(i => (
                      <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Tipo de destino</Label>
                <Select
                  value={form.destination_type}
                  onValueChange={v => setForm({ ...form, destination_type: v as ReminderDestinationType, destination_value: {} })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DESTINATION_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {showNumberField && (
              <div>
                <Label>Número WhatsApp (com DDI, só dígitos)</Label>
                <Input
                  value={form.destination_value?.number || ''}
                  onChange={e =>
                    setForm({ ...form, destination_value: { number: e.target.value.replace(/\D/g, '') } })
                  }
                  placeholder="5511949329570"
                />
              </div>
            )}

            {showGroupField && (
              <div>
                <Label>
                  Grupo WhatsApp{' '}
                  {groupsLoading && <Loader2 className="w-3 h-3 inline animate-spin ml-1" />}
                </Label>
                <Select
                  value={form.destination_value?.group_jid || ''}
                  onValueChange={v => {
                    const g = groups.find(x => x.id === v);
                    setForm({
                      ...form,
                      destination_value: { group_jid: v, group_name: g?.name || '' }
                    });
                  }}
                  disabled={!form.inbox_id || groupsLoading}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={!form.inbox_id ? 'Escolha uma instância primeiro' : 'Selecione um grupo'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map(g => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name} {g.participants_count ? `(${g.participants_count})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Conteúdo</Label>
              <Select
                value={form.content_mode}
                onValueChange={v => setForm({ ...form, content_mode: v as ReminderContentMode })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTENT_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.content_mode === 'editor_vars' && (
              <div>
                <Label>Template (use {'{{nome}}'}, {'{{telefone}}'}, {'{{cidade}}'}, {'{{tipo_pretensao}}'}...)</Label>
                <Textarea
                  rows={5}
                  value={form.content_template || ''}
                  onChange={e => setForm({ ...form, content_template: e.target.value })}
                  placeholder="Olá {{nome}}, novo lead chegou! Telefone: {{telefone}}"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Variáveis disponíveis: nome, nome_completo, telefone, email, tipo_pretensao, cidade, orcamento
                </p>
              </div>
            )}

            {form.content_mode === 'fixed_card' && (
              <div className="text-xs text-muted-foreground bg-muted/40 rounded p-3">
                Layout fixo: vai enviar nome, telefone, email, cidade do lead automaticamente.
                Customização de layouts é Fase 2.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {editing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
