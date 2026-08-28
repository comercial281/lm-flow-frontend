import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

import {
  Plus, Loader2, Users, Trash2, Eye, EyeOff, RotateCw, KeyRound, Check, Copy, AlertTriangle,
  MessageCircle, XCircle,
} from 'lucide-react';
import {
  Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Input,
} from '@/components/ui/ds';
import clientInstancesService, {
  ClientInstance, TenantUser, CreateTenantUserPayload, CentralInstance, WhatsappSendResult,
} from '@/services/clientInstances/clientInstancesService';

interface Props {
  instance: ClientInstance;
  open: boolean;
  onClose: () => void;
}

function pickError(e: any): string {
  const d = e?.response?.data;
  return d?.error ?? d?.errors?.join?.(', ') ?? d?.message ?? e?.message ?? 'Erro inesperado';
}

function PasswordCell({
  instanceId, user, onChanged,
}: {
  instanceId: number;
  user: TenantUser;
  onChanged: () => void;
}) {
  const [revealed, setRevealed] = useState<string | null>(user.generated_password ?? null);
  const [stale, setStale]       = useState(user.password_stale);
  const [loading, setLoading]   = useState(false);
  const [copied, setCopied]     = useState(false);
  const [error, setError]       = useState('');
  const [setMode, setSetMode]   = useState(false);
  const [newPwd, setNewPwd]     = useState('');

  // Quando o user prop muda (refresh), reseta o revelado a menos que tenha vindo
  // generated_password novo no payload (reset/create).
  useEffect(() => {
    if (user.generated_password) {
      setRevealed(user.generated_password);
    }
    setStale(user.password_stale);
  }, [user.generated_password, user.password_stale]);

  const reveal = async () => {
    setLoading(true); setError('');
    try {
      const r = await clientInstancesService.revealMemberPassword(instanceId, user.id);
      if (r.data.data.password) {
        setRevealed(r.data.data.password);
        setStale(false);
      } else {
        setStale(true);
        setError(r.data.data.reason ?? 'sem senha armazenada');
      }
    } catch (e) { setError(pickError(e)); }
    finally { setLoading(false); }
  };

  const reset = async () => {
    // Continua sendo a caixinha do navegador de propósito: o substituto é um
    // Dialog do design system, e este componente já roda dentro de um.
    //
    // Dialog dentro de Dialog mexe com armadilha de foco e com empilhamento, e
    // isso não se confere lendo código: precisa de navegador. Numa tela onde a
    // confirmação guarda ação destrutiva em cliente pagante, confirmação
    // quebrada é pior que confirmação feia.
    if (!confirm(`Gerar nova senha temporária para ${user.email}? A atual será invalidada.`)) return;
    setLoading(true); setError('');
    try {
      const r = await clientInstancesService.resetMemberPassword(instanceId, user.id);
      setRevealed(r.data.data.generated_password ?? null);
      setStale(false);
      onChanged();
    } catch (e) { setError(pickError(e)); }
    finally { setLoading(false); }
  };

  const saveCustom = async () => {
    if (newPwd.length < 8) { setError('senha precisa de 8+ caracteres'); return; }
    setLoading(true); setError('');
    try {
      await clientInstancesService.setMemberPassword(instanceId, user.id, newPwd);
      setRevealed(newPwd);
      setStale(false);
      setSetMode(false);
      setNewPwd('');
      onChanged();
    } catch (e) { setError(pickError(e)); }
    finally { setLoading(false); }
  };

  const copy = () => {
    if (!revealed) return;
    navigator.clipboard.writeText(revealed);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-1">
      {revealed ? (
        <div className="flex items-center gap-1">
          <code className="text-xs font-mono bg-muted px-2 py-1 rounded border max-w-[180px] truncate">
            {revealed}
          </code>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={copy} title="Copiar">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setRevealed(null)} title="Ocultar">
            <EyeOff className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          {user.has_stored_password && !stale ? (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={loading} onClick={reveal}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />} Ver
            </Button>
          ) : stale ? (
            <span className="text-xs text-orange-700 dark:text-orange-400 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> cliente trocou
            </span>
          ) : (
            <span className="text-xs text-muted-foreground italic">não armazenada</span>
          )}
        </div>
      )}

      {setMode ? (
        <div className="flex items-center gap-1 pt-1">
          <Input
            type="text"
            value={newPwd}
            onChange={e => setNewPwd(e.target.value)}
            placeholder="nova senha (8+)"
            className="h-7 text-xs w-36"
          />
          <Button size="sm" variant="default" className="h-7 text-xs" disabled={loading} onClick={saveCustom}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Salvar'}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setSetMode(false); setNewPwd(''); setError(''); }}>
            Cancelar
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" disabled={loading} onClick={reset} title="Gerar senha temporária">
            <RotateCw className="h-3 w-3" /> Reset
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setSetMode(true)} title="Definir senha customizada">
            <KeyRound className="h-3 w-3" /> Definir
          </Button>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function pickInstance(list: CentralInstance[]): string {
  const op = list.find(i => i.name.startsWith('Operacional') && i.connected);
  if (op) return op.name;
  const conn = list.find(i => i.connected);
  return conn?.name ?? list[0]?.name ?? '';
}

function AddMemberRow({
  instanceId, onAdded,
}: {
  instanceId: number;
  onAdded: (created: TenantUser, whatsapp?: WhatsappSendResult) => void;
}) {
  const [open, setOpen]       = useState(false);
  const [form, setForm]       = useState<CreateTenantUserPayload>({ email: '', name: '', password: '', chave_role: 'agent', remember_password: true, whatsapp_number: '', send_whatsapp: true });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [instances, setInstances]   = useState<CentralInstance[]>([]);
  const [instance, setInstance]     = useState('');
  const [loadingInst, setLoadingInst] = useState(false);

  // Carrega as instancias remetentes ao abrir o form (1x).
  useEffect(() => {
    if (!open || instances.length > 0) return;
    setLoadingInst(true);
    clientInstancesService.centralInstances()
      .then(r => {
        const list = r.data.data ?? [];
        setInstances(list);
        setInstance(prev => prev || pickInstance(list));
      })
      .catch(() => setInstances([]))
      .finally(() => setLoadingInst(false));
  }, [open, instances.length]);

  const phone = form.whatsapp_number?.trim() ?? '';
  const willSend = !!phone && (form.send_whatsapp ?? true);

  const submit = async () => {
    if (!form.email || !form.name) return;
    setLoading(true); setError('');
    try {
      const r = await clientInstancesService.addMember(instanceId, { ...form, instance: instance || undefined });
      onAdded(r.data.data, r.data.whatsapp);
      setForm({ email: '', name: '', password: '', chave_role: 'agent', remember_password: true, whatsapp_number: '', send_whatsapp: true });
      setOpen(false);
    } catch (e) { setError(pickError(e)); }
    finally { setLoading(false); }
  };

  if (!open) {
    return (
      <div className="px-3 py-2 border-t">
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="h-8 text-xs gap-1">
          <Plus className="h-3.5 w-3.5" /> Adicionar acesso
        </Button>
      </div>
    );
  }

  return (
    <div className="px-3 py-3 border-t bg-muted/30 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder="Nome"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="h-8 text-sm"
        />
        <Input
          type="email"
          placeholder="email@cliente.com"
          value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          className="h-8 text-sm"
        />
        <Input
          type="text"
          placeholder="senha (vazio = gerar)"
          value={form.password}
          onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
          className="h-8 text-sm"
        />
        <select
          value={form.chave_role}
          onChange={e => setForm(f => ({ ...f, chave_role: e.target.value as any }))}
          className="h-8 text-sm border rounded px-2 bg-background"
        >
          <option value="agent">Corretor</option>
          <option value="manager">Gerente</option>
          <option value="admin">Administrador</option>
        </select>
        <Input
          type="tel"
          placeholder="WhatsApp com DDD (opcional)"
          value={form.whatsapp_number ?? ''}
          onChange={e => setForm(f => ({ ...f, whatsapp_number: e.target.value }))}
          className="h-8 text-sm col-span-2"
        />
      </div>

      {phone && (
        <div className="rounded border bg-background px-2.5 py-2 space-y-2">
          <label className="text-xs flex items-center gap-2 font-medium">
            <input
              type="checkbox"
              checked={form.send_whatsapp ?? true}
              onChange={e => setForm(f => ({ ...f, send_whatsapp: e.target.checked }))}
            />
            <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
            Enviar o acesso por WhatsApp (link + login + senha)
          </label>
          {willSend && (
            <div className="flex items-center gap-2 pl-6">
              <span className="text-xs text-muted-foreground">Enviar por:</span>
              <select
                value={instance}
                onChange={e => setInstance(e.target.value)}
                className="h-7 text-xs border rounded px-2 bg-background flex-1"
                disabled={loadingInst}
              >
                {loadingInst && <option value="">carregando instâncias...</option>}
                {!loadingInst && instances.length === 0 && <option value="">padrão (Operacional LM01)</option>}
                {instances.map(i => (
                  <option key={i.name} value={i.name}>
                    {i.name}{i.connected ? '' : ' (desconectada)'}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      <label className="text-xs flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.remember_password ?? true}
          onChange={e => setForm(f => ({ ...f, remember_password: e.target.checked }))}
        />
        Lembrar a senha no painel (criptografada — você poderá ver depois)
      </label>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setError(''); }} className="h-8 text-xs">Cancelar</Button>
        <Button size="sm" onClick={submit} disabled={loading || !form.email || !form.name} className="h-8 text-xs gap-1">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : willSend ? <MessageCircle className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {willSend ? 'Criar e enviar' : 'Criar acesso'}
        </Button>
      </div>
    </div>
  );
}

export default function MembersModal({ instance, open, onClose }: Props) {
  const [members, setMembers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [notice, setNotice]   = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await clientInstancesService.listMembers(instance.id);
      setMembers(r.data.data ?? []);
    } catch (e) { setError(pickError(e)); setMembers([]); }
    finally { setLoading(false); }
  }, [instance.id]);

  useEffect(() => {
    if (open) { setNotice(null); load(); }
  }, [open, load]);

  const handleAdded = (u: TenantUser, wa?: WhatsappSendResult) => {
    setMembers(prev => [...prev, u]);
    if (!wa || wa.skipped === 'sem telefone') { setNotice({ ok: true, text: `Acesso de ${u.name} criado.` }); return; }
    if (wa.sent) {
      setNotice({ ok: true, text: `Acesso de ${u.name} criado e enviado no WhatsApp${wa.instance ? ` (${wa.instance})` : ''}.` });
    } else if (wa.skipped) {
      setNotice({ ok: true, text: `Acesso de ${u.name} criado. WhatsApp não enviado: ${wa.skipped}.` });
    } else {
      setNotice({ ok: false, text: `Acesso de ${u.name} criado, mas o WhatsApp falhou: ${wa.error ?? `HTTP ${wa.http}`}.` });
    }
  };

  const handleRemove = async (u: TenantUser) => {
    // Continua sendo a caixinha do navegador de propósito: o substituto é um
    // Dialog do design system, e este componente já roda dentro de um.
    //
    // Dialog dentro de Dialog mexe com armadilha de foco e com empilhamento, e
    // isso não se confere lendo código: precisa de navegador. Numa tela onde a
    // confirmação guarda ação destrutiva em cliente pagante, confirmação
    // quebrada é pior que confirmação feia.
    if (!confirm(`Remover ${u.email} do CRM ${instance.name}? Essa ação é definitiva.`)) return;
    try {
      await clientInstancesService.removeMember(instance.id, u.id);
      setMembers(prev => prev.filter(m => m.id !== u.id));
    } catch (e) { toast.error(pickError(e)); }
  };

  const handleRoleChange = async (u: TenantUser, newRole: string) => {
    try {
      const r = await clientInstancesService.updateMember(instance.id, u.id, { chave_role: newRole });
      setMembers(prev => prev.map(m => (m.id === u.id ? { ...r.data.data, generated_password: m.generated_password } : m)));
    } catch (e) { toast.error(pickError(e)); }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-[820px] max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Membros — {instance.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          {notice && (
            <div className={`mb-3 flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${
              notice.ok
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-300'
                : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300'
            }`}>
              {notice.ok ? <MessageCircle className="h-4 w-4 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
              <span className="flex-1">{notice.text}</span>
              <button onClick={() => setNotice(null)} className="opacity-60 hover:opacity-100">✕</button>
            </div>
          )}
          <div className="border rounded-lg overflow-hidden bg-card">
            <div className="grid grid-cols-[1.4fr,1fr,0.8fr,1.4fr,0.3fr] gap-2 px-3 py-2 bg-muted/40 text-xs font-medium text-muted-foreground sticky top-0 z-10">
              <div>Email</div>
              <div>Nome</div>
              <div>Cargo</div>
              <div>Senha</div>
              <div></div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando membros...
              </div>
            ) : error ? (
              <div className="py-6 px-3 text-sm text-destructive bg-destructive/5">{error}</div>
            ) : members.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Nenhum membro neste CRM ainda.</div>
            ) : (
              members.map(m => (
                <div key={m.id} className="grid grid-cols-[1.4fr,1fr,0.8fr,1.4fr,0.3fr] gap-2 px-3 py-2 border-t items-center text-sm">
                  <div className="truncate" title={m.email}>{m.email}</div>
                  <div className="truncate">{m.name}</div>
                  <div>
                    <select
                      value={m.chave_role}
                      onChange={e => handleRoleChange(m, e.target.value)}
                      className="h-7 text-xs border rounded px-1 bg-background"
                    >
                      <option value="agent">Corretor</option>
                      <option value="manager">Gerente</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                  <div>
                    <PasswordCell instanceId={instance.id} user={m} onChanged={load} />
                  </div>
                  <div className="text-right">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => handleRemove(m)} title="Remover">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}

            <AddMemberRow instanceId={instance.id} onAdded={handleAdded} />
          </div>

          <p className="text-xs text-muted-foreground mt-3">
            Senha "armazenada" fica criptografada no banco do master e só é mostrada quando você clica em "Ver".
            Se o cliente trocar pela UI dele, o painel marca como "cliente trocou" e o botão Reset gera uma temporária nova.
          </p>
        </div>

        <DialogFooter className="px-6 py-3 border-t shrink-0">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
