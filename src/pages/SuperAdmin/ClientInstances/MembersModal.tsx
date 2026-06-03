import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Loader2, Users, Trash2, Eye, EyeOff, RotateCw, KeyRound, Check, Copy, AlertTriangle,
} from 'lucide-react';
import {
  Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Input,
} from '@evoapi/design-system';
import clientInstancesService, {
  ClientInstance, TenantUser, CreateTenantUserPayload,
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
            <span className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
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

function AddMemberRow({
  instanceId, onAdded,
}: {
  instanceId: number;
  onAdded: (created: TenantUser) => void;
}) {
  const [open, setOpen]       = useState(false);
  const [form, setForm]       = useState<CreateTenantUserPayload>({ email: '', name: '', password: '', chave_role: 'agent', remember_password: true });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const submit = async () => {
    if (!form.email || !form.name) return;
    setLoading(true); setError('');
    try {
      const r = await clientInstancesService.addMember(instanceId, form);
      onAdded(r.data.data);
      setForm({ email: '', name: '', password: '', chave_role: 'agent', remember_password: true });
      setOpen(false);
    } catch (e) { setError(pickError(e)); }
    finally { setLoading(false); }
  };

  if (!open) {
    return (
      <div className="px-3 py-2 border-t">
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="h-8 text-xs gap-1">
          <Plus className="h-3.5 w-3.5" /> Adicionar membro
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
      </div>
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
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Adicionar
        </Button>
      </div>
    </div>
  );
}

export default function MembersModal({ instance, open, onClose }: Props) {
  const [members, setMembers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await clientInstancesService.listMembers(instance.id);
      setMembers(r.data.data ?? []);
    } catch (e) { setError(pickError(e)); setMembers([]); }
    finally { setLoading(false); }
  }, [instance.id]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleAdded = (u: TenantUser) => {
    setMembers(prev => [...prev, u]);
  };

  const handleRemove = async (u: TenantUser) => {
    if (!confirm(`Remover ${u.email} do CRM ${instance.name}? Essa ação é definitiva.`)) return;
    try {
      await clientInstancesService.removeMember(instance.id, u.id);
      setMembers(prev => prev.filter(m => m.id !== u.id));
    } catch (e) { alert(pickError(e)); }
  };

  const handleRoleChange = async (u: TenantUser, newRole: string) => {
    try {
      const r = await clientInstancesService.updateMember(instance.id, u.id, { chave_role: newRole });
      setMembers(prev => prev.map(m => (m.id === u.id ? { ...r.data.data, generated_password: m.generated_password } : m)));
    } catch (e) { alert(pickError(e)); }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-[820px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Membros — {instance.name}
          </DialogTitle>
        </DialogHeader>

        <div className="border rounded-lg overflow-hidden bg-card">
          <div className="grid grid-cols-[1.4fr,1fr,0.8fr,1.4fr,0.3fr] gap-2 px-3 py-2 bg-muted/40 text-xs font-medium text-muted-foreground">
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

        <p className="text-xs text-muted-foreground mt-2">
          Senha "armazenada" fica criptografada no banco do master e só é mostrada quando você clica em "Ver".
          Se o cliente trocar pela UI dele, o painel marca como "cliente trocou" e o botão Reset gera uma temporária nova.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
