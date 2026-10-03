import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Bell, Play, Plus, Pencil, Loader2, MoreHorizontal, Trash2 } from 'lucide-react';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
import { useConfirmacao } from '@/hooks/useConfirmacao';
import NoAccessState from '@/components/permissions/NoAccessState';
import { isForbiddenError } from '@/services/core/forbidden';
import BaseHeader from '@/components/base/BaseHeader';
import EmptyState from '@/components/base/EmptyState';
import Chave from '@/components/base/Chave';
import IconActionButton from '@/components/base/IconActionButton';
import { PhoneInput } from '@/components/shared/PhoneInput';

// Tela piloto da Fase 3 (base de design e linguagem). O que mudou aqui é a
// referência pra fase 4 levar pras outras telas:
//   - cabeçalho da casa (BaseHeader), título igual ao nome da aba;
//   - "não carregou" é estado de erro com "Tentar de novo", nunca lista vazia;
//   - vazio ensina pra que serve, com exemplo;
//   - ligar/desligar na própria lista, com a Chave (salva na hora);
//   - dentro do formulário, "Ligado" é caixinha (espera o Criar/Salvar);
//   - Excluir mora no menu "…", nunca lixeira solta ao lado da ação principal.
// O que o lembrete MANDA no WhatsApp não mudou — só a tela.

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
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [items, setItems] = useState<WhatsappReminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WhatsappReminder | null>(null);
  const [form, setForm] = useState<CreateReminderData>(EMPTY_FORM);
  const [inboxes, setInboxes] = useState<InboxOption[]>([]);
  const [groups, setGroups] = useState<WhatsappReminderGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recusado, setRecusado] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setRecusado(false);
    setFalhou(false);
    try {
      const res = await whatsappRemindersService.list({ page: 1, per_page: 50 });
      setItems(res.data || []);
    } catch (e: any) {
      if (isForbiddenError(e)) {
        setRecusado(true);
      } else {
        console.error(e);
        setFalhou(true);
      }
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
        toast.error('Não foi possível listar grupos do número');
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
        toast.error('Dê um nome ao lembrete');
        return;
      }
      if (editing) {
        await whatsappRemindersService.update(editing.id, form);
        toast.success('Lembrete salvo');
      } else {
        await whatsappRemindersService.create(form);
        toast.success('Lembrete criado');
      }
      setModalOpen(false);
      load();
    } catch (e: any) {
      console.error(e);
      const details = e?.response?.data?.details || e?.response?.data?.message || 'Não deu pra salvar. Tente de novo.';
      toast.error(Array.isArray(details) ? details.join(', ') : details);
    } finally {
      setSaving(false);
    }
  };

  // A chave da lista grava SÓ o `enabled` (o servidor aceita o campo sozinho).
  // Se falhar, a Chave volta sozinha e avisa; a lista local só muda no sucesso.
  const ligarDesligar = async (r: WhatsappReminder, ligado: boolean) => {
    await whatsappRemindersService.update(r.id, { enabled: ligado });
    setItems(prev => prev.map(x => (x.id === r.id ? { ...x, enabled: ligado } : x)));
  };

  const remove = async (r: WhatsappReminder) => {
    if (
      !(await confirmar({
        titulo: 'Excluir lembrete',
        descricao: `O lembrete "${r.name}" será excluído. Esta ação não pode ser desfeita.`,
        rotuloDaAcao: 'Excluir',
        destrutivo: true,
      }))
    )
      return;
    try {
      await whatsappRemindersService.remove(r.id);
      toast.success('Lembrete excluído');
      load();
    } catch {
      toast.error('Não deu pra excluir. Tente de novo.');
    }
  };

  const runNow = async (r: WhatsappReminder) => {
    setExecuting(r.id);
    try {
      const res = await whatsappRemindersService.execute({ reminderId: r.id });
      if (res.status === 'sent') {
        toast.success('Lembrete enviado');
      } else {
        toast.error('O lembrete não saiu. Confira se o número de WhatsApp está conectado em Canais e tente de novo.');
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'O lembrete não saiu. Tente de novo.';
      toast.error(msg);
    } finally {
      setExecuting(null);
    }
  };
  const showNumberField = form.destination_type === 'number';
  const showGroupField = form.destination_type === 'group';
  const showDelayField = form.delivery_mode === 'delayed';
  const showCronField = form.delivery_mode === 'recurring';

  if (recusado) return <NoAccessState />;

  const conteudo = () => {
    if (loading) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
        </div>
      );
    }
    if (falhou) return <EmptyState tipo="erro" aoTentarDeNovo={load} />;
    if (items.length === 0) {
      return (
        <EmptyState
          icon={Bell}
          title="Nenhum lembrete ainda"
          description="Um lembrete manda uma mensagem no WhatsApp pra um número, um grupo, o lead ou o corretor responsável."
          exemplo="Avisar o comercial sobre um lead novo"
          action={{ label: 'Novo lembrete', onClick: openCreate }}
        />
      );
    }
    return (
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3">Nome</th>
              <th className="text-left p-3">Quando</th>
              <th className="text-left p-3">Para quem</th>
              <th className="text-left p-3">Número de WhatsApp</th>
              <th className="text-left p-3">Ligado</th>
              <th className="text-right p-3"><span className="sr-only">Ações</span></th>
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
                  <Chave
                    rotulo={`Lembrete ${r.name}`}
                    semRotuloVisivel
                    ligada={r.enabled}
                    aoMudar={v => ligarDesligar(r, v)}
                  />
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-1">
                    <IconActionButton
                      label="Mandar agora"
                      variant="ghost"
                      onClick={() => runNow(r)}
                      disabled={executing === r.id}
                      icon={executing === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    />
                    <IconActionButton label="Editar" variant="ghost" onClick={() => openEdit(r)} icon={<Pencil className="w-4 h-4" />} />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" aria-label={`Mais ações de ${r.name}`}>
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => remove(r)} className="text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <BaseHeader
        title="Lembretes"
        subtitle="Mensagens no WhatsApp pra um número, um grupo, o lead ou o corretor responsável."
        primaryAction={{ label: 'Novo lembrete', icon: <Plus className="w-4 h-4" />, onClick: openCreate }}
      />

      {conteudo()}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar lembrete' : 'Novo lembrete'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="lembrete-nome">Nome *</Label>
              <Input
                id="lembrete-nome"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: Avisar o comercial sobre um lead novo"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="lembrete-ligado"
                checked={form.enabled}
                onCheckedChange={v => setForm({ ...form, enabled: v === true })}
              />
              <Label htmlFor="lembrete-ligado">Ligado</Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Quando mandar</Label>
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
                    Por enquanto só o disparo manual funciona.
                  </p>
                )}
              </div>

              <div>
                <Label>Quando entregar</Label>
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
                    Por enquanto só a entrega na hora funciona.
                  </p>
                )}
              </div>
            </div>

            {showDelayField && (
              <div>
                <Label htmlFor="lembrete-espera">Esperar quantos minutos</Label>
                <Input
                  id="lembrete-espera"
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
                <Label htmlFor="lembrete-cron">Repetição (ex.: 0 9 * * * = todo dia às 9h)</Label>
                <Input
                  id="lembrete-cron"
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
                <Label>Número de WhatsApp que manda *</Label>
                <Select
                  value={form.inbox_id ? String(form.inbox_id) : ''}
                  onValueChange={v => setForm({ ...form, inbox_id: v ? parseInt(v, 10) : null })}
                >
                  <SelectTrigger><SelectValue placeholder="Escolha o número" /></SelectTrigger>
                  <SelectContent>
                    {inboxes.map(i => (
                      <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Para quem</Label>
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
                <Label htmlFor="lembrete-destino">Número de quem recebe</Label>
                <PhoneInput
                  id="lembrete-destino"
                  value={form.destination_value?.number || ''}
                  onChange={number => setForm({ ...form, destination_value: { number } })}
                  placeholder="(11) 99999-9999"
                  valueFormat="digits"
                />
              </div>
            )}

            {showGroupField && (
              <div>
                <Label>
                  Grupo do WhatsApp{' '}
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
                      placeholder={!form.inbox_id ? 'Escolha o número primeiro' : 'Escolha um grupo'}
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
                <Label htmlFor="lembrete-mensagem">Mensagem (use {'{{nome}}'}, {'{{telefone}}'}, {'{{cidade}}'}, {'{{tipo_pretensao}}'}…)</Label>
                <Textarea
                  id="lembrete-mensagem"
                  rows={5}
                  value={form.content_template || ''}
                  onChange={e => setForm({ ...form, content_template: e.target.value })}
                  placeholder="Olá {{nome}}, novo lead chegou! Telefone: {{telefone}}"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Pode usar: nome, nome_completo, telefone, email, tipo_pretensao, cidade, orcamento
                </p>
              </div>
            )}

            {form.content_mode === 'fixed_card' && (
              <div className="text-xs text-muted-foreground bg-muted/40 rounded p-3">
                Cartão pronto: manda nome, telefone, e-mail e cidade do lead.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {saving ? 'Salvando…' : editing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {dialogoDeConfirmacao}
    </div>
  );
}
