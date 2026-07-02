import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Users, RefreshCw, ShieldCheck, MessageCircle, Search } from 'lucide-react';
import { Button, Input, Badge, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, Label as UILabel } from '@/components/ui/ds';
import { usersService } from '@/services/users';
import InboxesService from '@/services/channels/inboxesService';
import InboxMembersService from '@/services/channels/inboxMembersService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import type { User } from '@/types/users';
import type { Inbox } from '@/types/channels/inbox';

/* Painel "Equipe & Acessos" — o gestor controla, por pessoa e numa tela só:
   cargo, quais instâncias (WhatsApp) ela vê, e remover do time. Reusa as APIs
   que já existem (users, roles, inbox_members) — não muda a regra por baixo. */

const CARGOS: Array<{ key: 'admin' | 'manager' | 'agent'; label: string; desc: string }> = [
  { key: 'admin', label: 'Administrador', desc: 'Acesso total: configurações, equipe, todas as instâncias.' },
  { key: 'manager', label: 'Gerente', desc: 'Gerencia leads, funil e relatórios do time.' },
  { key: 'agent', label: 'Corretor', desc: 'Atende leads. Só vê as instâncias que você liberar.' },
];
const cargoLabel = (k?: string) => CARGOS.find((c) => c.key === k)?.label ?? 'Corretor';
const cargoColor = (k?: string) =>
  k === 'admin' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
  : k === 'manager' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';

export default function TeamAccessPage() {
  const { can } = useUserPermissions();
  const canManage = can('users', 'update');

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  // userId -> Set(inboxId) que a pessoa vê
  const [membership, setMembership] = useState<Record<string, Set<string>>>({});
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, inboxesRes] = await Promise.all([
        usersService.getUsers({ per_page: 200 }),
        InboxesService.list(),
      ]);
      const inboxList = inboxesRes.data ?? [];
      setUsers(usersRes.data ?? []);
      setInboxes(inboxList);

      // membros de cada inbox -> mapa userId -> inboxes
      const map: Record<string, Set<string>> = {};
      await Promise.all(
        inboxList.map(async (ib) => {
          try {
            const members = await InboxMembersService.get(String(ib.id));
            members.forEach((m) => {
              const uid = String(m.id);
              (map[uid] ??= new Set()).add(String(ib.id));
            });
          } catch { /* ignora inbox que falhar */ }
        }),
      );
      setMembership(map);
    } catch {
      toast.error('Erro ao carregar a equipe');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q));
  }, [users, search]);

  const changeCargo = async (user: User, chave: 'admin' | 'manager' | 'agent') => {
    setSaving(true);
    try {
      await usersService.updateUser(String(user.id), { chave_role: chave });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, chave_role: chave } : u)));
      setEditing((e) => (e && e.id === user.id ? { ...e, chave_role: chave } : e));
      toast.success('Cargo atualizado');
    } catch {
      toast.error('Erro ao mudar o cargo');
    } finally {
      setSaving(false);
    }
  };

  const toggleInbox = async (user: User, inboxId: string, on: boolean) => {
    const uid = String(user.id);
    setSaving(true);
    try {
      const current = await InboxMembersService.get(inboxId);
      const ids = new Set(current.map((m) => String(m.id)));
      if (on) ids.add(uid); else ids.delete(uid);
      await InboxMembersService.update(inboxId, Array.from(ids));
      setMembership((prev) => {
        const set = new Set(prev[uid] ?? []);
        if (on) set.add(inboxId); else set.delete(inboxId);
        return { ...prev, [uid]: set };
      });
    } catch {
      toast.error('Erro ao mudar a instância');
    } finally {
      setSaving(false);
    }
  };

  const removeUser = async (user: User) => {
    if (!window.confirm(`Remover ${user.name} do time? Ele perde o acesso ao CRM.`)) return;
    setSaving(true);
    try {
      await usersService.deleteUser(String(user.id));
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setEditing(null);
      toast.success('Removido do time');
    } catch {
      toast.error('Erro ao remover');
    } finally {
      setSaving(false);
    }
  };

  const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  const isAdmin = (u: User) => u.chave_role === 'admin';

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Users className="h-6 w-6 text-primary" /> Equipe & Acessos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Controle numa tela só quem faz parte do time, o cargo de cada um e quais instâncias vê.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail" className="pl-9" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Carregando equipe…
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Nenhuma pessoa encontrada.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => {
            const seen = membership[String(u.id)]?.size ?? 0;
            return (
              <div key={u.id} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
                <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {initials(u.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{u.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cargoColor(u.chave_role)}`}>{cargoLabel(u.chave_role)}</span>
                    {!u.confirmed && <Badge variant="outline" className="text-xs text-amber-600">Convite pendente</Badge>}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                </div>
                <div className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                  <MessageCircle className="h-3.5 w-3.5" />
                  {isAdmin(u) ? 'Todas as instâncias' : `${seen} de ${inboxes.length} instância${inboxes.length !== 1 ? 's' : ''}`}
                </div>
                <Button variant="outline" size="sm" onClick={() => setEditing(u)} disabled={!canManage}>
                  Gerenciar acesso
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal por pessoa */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>Acesso de {editing.name}</DialogTitle>
                <DialogDescription>{editing.email}</DialogDescription>
              </DialogHeader>

              {/* Cargo */}
              <div className="py-2">
                <UILabel className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                  <ShieldCheck className="h-4 w-4" /> Cargo
                </UILabel>
                <div className="space-y-2">
                  {CARGOS.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      disabled={saving}
                      onClick={() => changeCargo(editing, c.key)}
                      className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                        editing.chave_role === c.key ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <span className={`mt-0.5 h-4 w-4 flex-none rounded-full border-2 ${editing.chave_role === c.key ? 'border-primary bg-primary' : 'border-muted-foreground/40'}`} />
                      <span>
                        <span className="block text-sm font-medium">{c.label}</span>
                        <span className="block text-xs text-muted-foreground">{c.desc}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Instâncias */}
              <div className="border-t border-border py-3">
                <UILabel className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
                  <MessageCircle className="h-4 w-4" /> Instâncias que essa pessoa vê
                </UILabel>
                {isAdmin(editing) ? (
                  <p className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                    Administrador vê <strong>todas as instâncias</strong> automaticamente.
                  </p>
                ) : inboxes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma instância conectada ainda.</p>
                ) : (
                  <div className="space-y-1.5">
                    {inboxes.map((ib) => {
                      const on = membership[String(editing.id)]?.has(String(ib.id)) ?? false;
                      return (
                        <label key={ib.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-2.5 hover:bg-muted/30">
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={saving}
                            onChange={(e) => toggleInbox(editing, String(ib.id), e.target.checked)}
                            className="h-4 w-4 rounded"
                          />
                          <span className="flex-1 text-sm">{ib.name}</span>
                          <span className="text-xs text-muted-foreground">{ib.channel_type?.split('::')[1] || ''}</span>
                        </label>
                      );
                    })}
                    <p className="pt-1 text-xs text-muted-foreground">
                      Desmarcado = a pessoa não vê a instância nem as mensagens dela.
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => removeUser(editing)} disabled={saving}>
                  Remover do time
                </Button>
                <Button onClick={() => setEditing(null)} disabled={saving}>Concluir</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
