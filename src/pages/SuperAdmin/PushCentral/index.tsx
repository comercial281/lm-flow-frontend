import { useCallback, useEffect, useState } from 'react';
import { Bell, Loader2, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
  Textarea,
} from '@/components/ui/ds';
import pushCentralService, {
  type PushAudience,
  type PushIndexData,
  type PushLog,
  type PushRule,
  type PushRulePayload,
  type PushTenantScope,
} from '@/services/push/pushCentralService';

/**
 * Central de Push (Área do Admin).
 *
 * Tudo que liga/desliga push nasce AQUI, na tela, com nome em PT-BR — nada de
 * regra escondida em código ou ENV. Três abas:
 *   Regras         -> CRUD do que dispara sozinho
 *   Disparo manual -> escrever e mandar agora
 *   Histórico      -> o que saiu, pra quem, e o que FALHOU
 */

type Tab = 'rules' | 'manual' | 'logs';

const EMPTY_FORM: PushRulePayload = {
  name: '',
  triggers: ['lead.novo'],
  tenant_scope: 'all',
  tenant_slugs: [],
  audience: 'admin',
  title: 'Lead novo em {{cliente}}',
  body: '{{nome_lead}} chegou as {{hora}} via {{origem}}',
  url: '',
  is_active: true,
};

const STATUS_CLASS: Record<PushLog['status'], string> = {
  sent: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  partial: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  failed: 'bg-red-500/15 text-red-300 border-red-500/30',
  no_subscription: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
};

export default function PushCentral() {
  const [tab, setTab] = useState<Tab>('rules');
  const [data, setData] = useState<PushIndexData | null>(null);
  const [logs, setLogs] = useState<PushLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<PushRule | null>(null);
  const [form, setForm] = useState<PushRulePayload>(EMPTY_FORM);
  const [open, setOpen] = useState(false);

  const [manual, setManual] = useState({
    audience: 'admin' as PushAudience,
    tenant_slug: '',
    title: 'Aviso da Leal Midia',
    body: '',
  });
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await pushCentralService.list();
      setData(res.data.data);
    } catch {
      toast.error('Erro ao carregar a Central de Push');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      const res = await pushCentralService.logs({ limit: 100 });
      setLogs(res.data.data);
    } catch {
      toast.error('Erro ao carregar o histórico');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab === 'logs') loadLogs();
  }, [tab, loadLogs]);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (rule: PushRule) => {
    setEditing(rule);
    setForm({
      name: rule.name,
      triggers: rule.triggers?.length ? rule.triggers : rule.trigger ? [rule.trigger] : [],
      tenant_scope: rule.tenant_scope,
      tenant_slugs: rule.tenant_slugs || [],
      audience: rule.audience,
      title: rule.title,
      body: rule.body,
      url: rule.url || '',
      is_active: rule.is_active,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error('Dê um nome pra regra');
    if (form.triggers.length === 0) return toast.error('Escolha pelo menos um gatilho');
    if (!form.body.trim()) return toast.error('Escreva a mensagem');
    if (form.tenant_scope === 'selected' && form.tenant_slugs.length === 0) {
      return toast.error('Escolha pelo menos um cliente');
    }

    setSaving(true);
    try {
      if (editing) {
        await pushCentralService.update(editing.id, form);
        toast.success('Regra atualizada');
      } else {
        await pushCentralService.create(form);
        toast.success('Regra criada');
      }
      setOpen(false);
      await load();
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Erro ao salvar a regra');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (rule: PushRule) => {
    // Otimista: vira na hora e volta atrás se o backend recusar.
    setData(prev =>
      prev
        ? { ...prev, rules: prev.rules.map(r => (r.id === rule.id ? { ...r, is_active: !r.is_active } : r)) }
        : prev,
    );
    try {
      await pushCentralService.toggle(rule.id);
    } catch {
      toast.error('Não consegui ligar/desligar a regra');
      await load();
    }
  };

  const remove = async (rule: PushRule) => {
    if (!window.confirm(`Excluir a regra "${rule.name}"?`)) return;
    try {
      await pushCentralService.remove(rule.id);
      toast.success('Regra excluída');
      await load();
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  const sendManual = async () => {
    if (!manual.body.trim()) return toast.error('Escreva a mensagem');
    if (manual.audience === 'client' && !manual.tenant_slug) return toast.error('Escolha o cliente');

    setSending(true);
    try {
      const res = await pushCentralService.sendNow({
        audience: manual.audience,
        title: manual.title,
        body: manual.body,
        tenant_slug: manual.tenant_slug || undefined,
      });
      const log = res.data.data;
      if (log?.status === 'no_subscription') {
        toast.error('Ninguém com push ligado (Modo Plantão desligado)');
      } else if (log?.status === 'failed') {
        toast.error(`Falhou: ${log.error || 'erro desconhecido'}`);
      } else {
        toast.success(`Enviado para ${log?.devices ?? 0} aparelho(s)`);
      }
      setManual(m => ({ ...m, body: '' }));
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Erro ao disparar');
    } finally {
      setSending(false);
    }
  };

  const options = data?.options;

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 shrink-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Central de Push
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Avisos no celular quando acontece algo nos clientes. Você escolhe o gatilho, de quais
              clientes e pra quem vai.
            </p>
          </div>
          {tab === 'rules' && (
            <Button onClick={openNew}>
              <Plus className="w-4 h-4 mr-2" />
              Nova regra
            </Button>
          )}
        </div>

        {data && !data.push_ready && (
          <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            As chaves VAPID não estão configuradas no servidor. Nada será entregue até isso ser
            resolvido.
          </div>
        )}

        <div className="flex gap-6 border-b mt-4">
          {([
            ['rules', 'Regras'],
            ['manual', 'Disparo manual'],
            ['logs', 'Histórico'],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`pb-2 text-sm transition-colors border-b-2 -mb-px ${
                tab === key
                  ? 'border-violet-500 text-violet-300'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4 min-h-0">
        {loading && (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}

        {/* ── REGRAS ── */}
        {!loading && tab === 'rules' && (
          <div className="grid gap-3 max-w-4xl">
            {data?.rules.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhuma regra ainda. Crie a primeira em "Nova regra".
              </p>
            )}
            {data?.rules.map(rule => (
              <div
                key={rule.id}
                className="rounded-lg border p-4 flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{rule.name}</span>
                    {(rule.triggers_labels?.length ? rule.triggers_labels : [rule.trigger_label]).map(
                      label => (
                        <Badge key={label} variant="outline">
                          {label}
                        </Badge>
                      ),
                    )}
                    <Badge variant="outline">{rule.audience_label}</Badge>
                    <Badge variant="outline">
                      {rule.tenant_scope === 'all'
                        ? 'Todos os clientes'
                        : `${rule.tenant_slugs.length} cliente(s)`}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 break-words">
                    <span className="font-medium text-foreground">{rule.title}</span> — {rule.body}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={rule.is_active} onCheckedChange={() => toggle(rule)} />
                  <Button variant="ghost" size="sm" onClick={() => openEdit(rule)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(rule)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── DISPARO MANUAL ── */}
        {!loading && tab === 'manual' && (
          <div className="max-w-xl space-y-4">
            <div>
              <Label>Para quem</Label>
              <select
                className="mt-1 w-full h-9 rounded-md border bg-transparent px-3 text-sm"
                value={manual.audience}
                onChange={e => setManual(m => ({ ...m, audience: e.target.value as PushAudience }))}
              >
                {options?.audiences.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {manual.audience === 'client' && (
              <div>
                <Label>Cliente</Label>
                <select
                  className="mt-1 w-full h-9 rounded-md border bg-transparent px-3 text-sm"
                  value={manual.tenant_slug}
                  onChange={e => setManual(m => ({ ...m, tenant_slug: e.target.value }))}
                >
                  <option value="">Escolha o cliente</option>
                  {options?.tenants.map(t => (
                    <option key={t.slug} value={t.slug}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <Label>Título</Label>
              <Input
                className="mt-1"
                value={manual.title}
                onChange={e => setManual(m => ({ ...m, title: e.target.value }))}
              />
            </div>

            <div>
              <Label>Mensagem</Label>
              <Textarea
                className="mt-1"
                rows={3}
                value={manual.body}
                onChange={e => setManual(m => ({ ...m, body: e.target.value }))}
                placeholder="O que você quer avisar agora"
              />
            </div>

            <Button onClick={sendManual} disabled={sending}>
              {sending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Disparar agora
            </Button>
          </div>
        )}

        {/* ── HISTÓRICO ── */}
        {!loading && tab === 'logs' && (
          <div className="grid gap-2 max-w-4xl">
            {logs.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nada disparado ainda.
              </p>
            )}
            {logs.map(log => (
              <div key={log.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className={`px-2 py-0.5 rounded border text-xs ${STATUS_CLASS[log.status]}`}>
                      {log.status_label}
                    </span>
                    <span className="font-medium truncate">{log.rule_name}</span>
                    {log.tenant_name && (
                      <span className="text-muted-foreground">· {log.tenant_name}</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(log.created_at).toLocaleString('pt-BR')}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 break-words">
                  {log.title} — {log.body}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {log.devices} aparelho(s) · {log.recipients} pessoa(s)
                </p>
                {log.error && (
                  <p className="text-xs text-red-300 mt-1 break-words">Erro: {log.error}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── MODAL DE REGRA ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar regra' : 'Nova regra'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label>Nome da regra</Label>
              <Input
                className="mt-1"
                autoFocus
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex.: Lead de trafego chegou"
              />
            </div>

            <div>
              <Label>Quando disparar</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Marque um ou mais. A regra dispara quando qualquer um acontecer.
              </p>
              <div className="mt-1 rounded-md border p-3 space-y-2 max-h-44 overflow-auto">
                {options?.triggers.map(o => (
                  <label key={o.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.triggers.includes(o.value)}
                      onChange={e =>
                        setForm(f => ({
                          ...f,
                          triggers: e.target.checked
                            ? [...f.triggers, o.value]
                            : f.triggers.filter(v => v !== o.value),
                        }))
                      }
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label>De quais clientes</Label>
              <select
                className="mt-1 w-full h-9 rounded-md border bg-transparent px-3 text-sm"
                value={form.tenant_scope}
                onChange={e =>
                  setForm(f => ({ ...f, tenant_scope: e.target.value as PushTenantScope }))
                }
              >
                {options?.tenant_scopes.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {form.tenant_scope === 'selected' && (
              <div className="rounded-md border p-3 space-y-2 max-h-40 overflow-auto">
                {options?.tenants.map(t => (
                  <label key={t.slug} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.tenant_slugs.includes(t.slug)}
                      onChange={e =>
                        setForm(f => ({
                          ...f,
                          tenant_slugs: e.target.checked
                            ? [...f.tenant_slugs, t.slug]
                            : f.tenant_slugs.filter(s => s !== t.slug),
                        }))
                      }
                    />
                    {t.name}
                  </label>
                ))}
              </div>
            )}

            <div>
              <Label>Para quem</Label>
              <select
                className="mt-1 w-full h-9 rounded-md border bg-transparent px-3 text-sm"
                value={form.audience}
                onChange={e => setForm(f => ({ ...f, audience: e.target.value as PushAudience }))}
              >
                {options?.audiences.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>Título do aviso</Label>
              <Input
                className="mt-1"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>

            <div>
              <Label>Mensagem</Label>
              <Textarea
                className="mt-1"
                rows={3}
                value={form.body}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Variáveis: {options?.variables.join(' · ')}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <Label>Regra ligada</Label>
              <Switch
                checked={!!form.is_active}
                onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
