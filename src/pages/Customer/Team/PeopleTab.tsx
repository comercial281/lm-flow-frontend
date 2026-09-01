import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw, ShieldCheck, MessageCircle, Search, Sparkles, UserPlus, Mails } from 'lucide-react';
import { Button, Input, Badge, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, Label as UILabel } from '@/components/ui/ds';
import IconActionButton from '@/components/base/IconActionButton';
import { usersService } from '@/services/users';
import InboxMembersService from '@/services/channels/inboxMembersService';
import { teamAccessService } from '@/services/teamAccess/teamAccessService';
import customRolesService from '@/services/customRoles/customRolesService';
import InboxAccessList from '@/components/team/InboxAccessList';
import AddPersonWizard from './AddPersonWizard';
import { buildCargoOptions, cargoPayload, isCargoSelected, type CargoOption } from './cargoOptions';
// Vem da tela antiga de Usuários: convidar vários por e-mail de uma vez era uma
// capacidade real dela, e unificar não pode significar perder função.
import BulkInviteModal from '@/components/users/BulkInviteModal';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import type { CustomRole } from '@/types/customRoles';
import type { TeamAccessInbox, TeamAccessMember } from '@/types/teamAccess';

import { useConfirmacao } from '@/hooks/useConfirmacao';
/* Aba "Pessoas" da tela de Equipe — o gestor controla, por pessoa e num lugar
   só: cadastrar, cargo, quais instâncias (WhatsApp) ela atende, enviar o acesso
   e remover do time.

   Duas coisas mudaram aqui e não devem ser desfeitas sem o dono pedir:

   1. O CARGO exibido vem do cargo de verdade, não de uma lista fixa. Enquanto a
      tela conhecia só os três de fábrica, quem tinha cargo próprio (ex.: "SDR")
      aparecia como "Corretor" — o rótulo mentia enquanto a permissão obedecia
      outro.
   2. As instâncias vêm separadas por ORIGEM (ver InboxAccessList). Misturar de
      novo o que o gestor liberou com o que o sistema liberou é o que fazia a
      tela dizer "3 instâncias" para quem tinha uma liberada. */

const cargoColor = (key?: string) =>
  key === 'admin' || key === 'administrador'
    ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
    : key === 'manager' || key === 'gerente'
      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';

export default function PeopleTab() {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const { can } = useUserPermissions();
  const canManage = can('users', 'update');
  const canCreate = can('users', 'create');
  const [adding, setAdding] = useState(false);
  const [bulkInviting, setBulkInviting] = useState(false);

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamAccessMember[]>([]);
  const [inboxes, setInboxes] = useState<TeamAccessInbox[]>([]);
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // O WhatsApp da pessoa, editável aqui.
  //
  // Até 2026-09-01 o único jeito de corrigir o número de alguém era o modal
  // "Enviar acesso" — que TROCA A SENHA junto. A tela que editava o campo
  // (a antiga de Usuários) virou código morto quando /settings/users passou a
  // redirecionar para cá. Agora a roleta avisa o corretor pelo número do
  // cadastro, então não poder corrigi-lo deixaria o corretor sem aviso e sem
  // saída.
  const [whatsappRascunho, setWhatsappRascunho] = useState('');
  const [salvandoWhatsapp, setSalvandoWhatsapp] = useState(false);

  // Enviar acesso por WhatsApp (1 clique por pessoa)
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendPhone, setSendPhone] = useState('');
  const [sendPwd, setSendPwd] = useState('');
  const [sendBusy, setSendBusy] = useState(false);

  // A pessoa aberta vem SEMPRE da lista, nunca de uma cópia no estado: com cópia,
  // trocar o cargo ou uma instância atualizava a linha e deixava o painel
  // mostrando o valor velho até fechar e abrir de novo.
  const editing = useMemo(() => members.find(m => m.id === editingId) ?? null, [members, editingId]);
  const sending = useMemo(() => members.find(m => m.id === sendingId) ?? null, [members, sendingId]);

  // Sempre traz os três de fábrica, mesmo quando o cliente não tem cargo nenhum
  // gravado no banco — que é o caso da maioria (ver cargoOptions).
  const cargoOptions = useMemo(() => buildCargoOptions(roles), [roles]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Uma chamada só para o retrato da equipe (antes eram 2 + uma por
      // instância) e outra para os cargos que existem neste cliente.
      const [overview, roleList] = await Promise.all([
        teamAccessService.overview(),
        customRolesService.list().catch(() => [] as CustomRole[]),
      ]);
      setMembers(overview.members);
      setInboxes(overview.inboxes);
      setRoles(roleList);
    } catch {
      toast.error('Erro ao carregar a equipe');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(m => `${m.name} ${m.email}`.toLowerCase().includes(q));
  }, [members, search]);

  const openSend = (member: TeamAccessMember) => {
    setSendingId(member.id);
    setSendPhone(member.whatsapp_number ?? '');
    // Vem a senha atual de propósito: digitar outra aqui TROCA a senha da pessoa
    // e derruba quem já estava usando a antiga. Reenviar o acesso não deveria
    // custar isso.
    setSendPwd(member.plain_password ?? '');
  };

  const doSend = async () => {
    if (!sending) return;
    if (sendPhone.replace(/\D/g, '').length < 10) { toast.error('Informe o WhatsApp com DDD.'); return; }
    if (sendPwd.trim().length < 6) { toast.error('Defina uma senha de ao menos 6 caracteres.'); return; }
    setSendBusy(true);
    try {
      const res = await usersService.sendAccess(sending.id, { whatsapp_number: sendPhone, password: sendPwd.trim() });
      const wa = res.whatsapp;
      const who = sending.name;
      setMembers(prev => prev.map(m => (m.id === sending.id ? { ...m, whatsapp_number: sendPhone } : m)));
      if (wa?.sent) {
        toast.success(`Acesso enviado no WhatsApp de ${who}${wa.instance ? ` (${wa.instance})` : ''}.`);
        setSendingId(null);
      } else if (wa?.error) {
        toast.error(`Acesso salvo, mas o WhatsApp falhou: ${wa.error}`);
      } else {
        toast.error(`Não enviou: ${wa?.skipped ?? 'motivo desconhecido'}`);
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Erro ao enviar o acesso.');
    } finally {
      setSendBusy(false);
    }
  };

  // O campo é semeado ao ABRIR a pessoa, e não a cada render: semear no render
  // apagaria o que o gestor está digitando a cada atualização da lista.
  const abrirPessoa = (id: string) => {
    setWhatsappRascunho(members.find(m => m.id === id)?.whatsapp_number ?? '');
    setEditingId(id);
  };

  const salvarWhatsapp = async (member: TeamAccessMember) => {
    const novo = whatsappRascunho.trim();
    if (novo === (member.whatsapp_number ?? '').trim()) return;

    setSalvandoWhatsapp(true);
    try {
      // Só o WhatsApp: mandar mais campos aqui reabriria a porta do "Enviar
      // acesso", que troca a senha sem a pessoa pedir.
      await usersService.updateUser(member.id, { whatsapp_number: novo });
      setMembers(prev => prev.map(m => (m.id === member.id ? { ...m, whatsapp_number: novo } : m)));
      toast.success(novo ? 'WhatsApp atualizado' : 'WhatsApp removido');
    } catch {
      toast.error('Não consegui salvar o WhatsApp');
    } finally {
      setSalvandoWhatsapp(false);
    }
  };

  const changeCargo = async (member: TeamAccessMember, option: CargoOption) => {
    setSaving(true);
    try {
      // Manda o cargo gravado quando ele existe; senão, o cargo legado (o
      // cliente pode não ter os cargos no banco — ver cargoOptions). O backend
      // sincroniza os dois lados, que é o que mantém lista e permissão contando
      // a mesma história.
      const updated: any = await usersService.updateUser(member.id, cargoPayload(option) as any);
      setMembers(prev => prev.map(m => (
        m.id === member.id
          ? {
            ...m,
            role: {
              key: updated?.role?.key ?? m.role.key,
              name: updated?.role?.name ?? option.label,
              color: updated?.role?.color ?? m.role.color,
              custom_role_id: updated?.custom_role_id ?? option.customRoleId ?? null,
              chave_role: updated?.chave_role ?? option.chaveRole ?? m.role.chave_role,
            },
            sees_all_inboxes: (updated?.chave_role ?? option.chaveRole ?? m.role.chave_role) === 'admin',
          }
          : m
      )));
      toast.success('Cargo atualizado');
    } catch {
      toast.error('Erro ao mudar o cargo');
    } finally {
      setSaving(false);
    }
  };

  const toggleInbox = async (member: TeamAccessMember, inboxId: string, on: boolean) => {
    setSaving(true);
    try {
      const current = await InboxMembersService.get(inboxId);
      const ids = new Set(current.map(m => String(m.id)));
      if (on) ids.add(member.id); else ids.delete(member.id);
      await InboxMembersService.update(inboxId, Array.from(ids));
      setMembers(prev => prev.map(m => {
        if (m.id !== member.id) return m;
        const granted = new Set(m.granted_inbox_ids.map(String));
        const auto = new Set(m.auto_inbox_ids.map(String));
        const autoAccess = { ...m.auto_access };
        if (on) {
          granted.add(inboxId);
          // Marcar um número de acesso automático é promovê-lo: o gestor está
          // dizendo "ela atende esse número", e ela entra na fila de leads novos.
          auto.delete(inboxId);
          delete autoAccess[inboxId];
        } else {
          granted.delete(inboxId);
        }
        return {
          ...m,
          granted_inbox_ids: Array.from(granted),
          auto_inbox_ids: Array.from(auto),
          auto_access: autoAccess,
        };
      }));
    } catch {
      toast.error('Erro ao mudar a instância');
    } finally {
      setSaving(false);
    }
  };

  const removeUser = async (member: TeamAccessMember) => {
    if (!(await confirmar({
      titulo: 'Remover do time',
      descricao: <>Remover <strong>{member.name}</strong> do time? A pessoa perde o acesso ao CRM.</>,
      rotuloDaAcao: 'Remover',
      destrutivo: true,
    }))) return;
    setSaving(true);
    try {
      await usersService.deleteUser(member.id);
      setMembers(prev => prev.filter(m => m.id !== member.id));
      setEditingId(null);
      toast.success('Removido do time');
    } catch {
      toast.error('Erro ao remover');
    } finally {
      setSaving(false);
    }
  };

  const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();

  /* "1 liberada · 2 automáticas" em vez de "3 de 5": o número sozinho misturava
     de novo as duas origens que o resto da tela agora separa. */
  const accessSummary = (member: TeamAccessMember) => {
    if (member.sees_all_inboxes) return 'Todas';
    const granted = member.granted_inbox_ids.length;
    const auto = member.auto_inbox_ids.length;
    if (granted === 0 && auto === 0) return 'Nenhuma';
    const parts = [];
    if (granted > 0) parts.push(`${granted} liberada${granted > 1 ? 's' : ''}`);
    if (auto > 0) parts.push(`${auto} automática${auto > 1 ? 's' : ''}`);
    return parts.join(' · ');
  };

  return (
    <>
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {members.length} pessoa{members.length !== 1 ? 's' : ''} · cargo e instâncias de cada um
        </p>
        <div className="flex items-center gap-2">
          <IconActionButton
            label="Atualizar"
            icon={<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}
            onClick={load}
            disabled={loading}
          />
          <Button variant="outline" onClick={() => setBulkInviting(true)} disabled={!canCreate} className="gap-1.5">
            <Mails className="h-4 w-4" /> Convidar por e-mail
          </Button>
          <Button onClick={() => setAdding(true)} disabled={!canCreate} className="gap-1.5">
            <UserPlus className="h-4 w-4" /> Adicionar pessoa
          </Button>
        </div>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail" className="pl-9" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Carregando equipe…
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Nenhuma pessoa encontrada.</div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="font-medium px-4 py-3">Membro</th>
                  <th className="font-medium px-4 py-3">Cargo</th>
                  <th className="font-medium px-4 py-3">Instâncias</th>
                  <th className="font-medium px-4 py-3">Status</th>
                  <th className="font-medium px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(member => (
                  <tr key={member.id} className="border-t border-border/60 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {initials(member.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{member.name}</div>
                          <div className="truncate text-xs text-muted-foreground">{member.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cargoColor(member.role.key)}`}>
                        {member.role.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        {member.auto_inbox_ids.length > 0 && !member.sees_all_inboxes
                          ? <Sparkles className="h-3.5 w-3.5" />
                          : <MessageCircle className="h-3.5 w-3.5" />}
                        {accessSummary(member)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {member.confirmed
                          ? <Badge variant="outline" className="text-xs text-emerald-500">Ativo</Badge>
                          : <Badge variant="outline" className="text-xs text-amber-600">Convite pendente</Badge>}
                        {/* Quem está sem número é justamente quem recebe lead
                            sorteado e não é avisado no WhatsApp. Precisa ser
                            visível sem abrir pessoa por pessoa. */}
                        {!(member.whatsapp_number ?? '').trim() && (
                          <Badge
                            variant="outline"
                            className="text-xs text-amber-600"
                            title="Sem WhatsApp no cadastro: os avisos da distribuição de leads não chegam por WhatsApp"
                          >
                            Sem WhatsApp
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openSend(member)}
                          disabled={!canManage}
                          className="h-8 gap-1 text-xs text-emerald-600 hover:text-emerald-700"
                          title="Enviar o acesso (link+login+senha) no WhatsApp da pessoa"
                        >
                          <MessageCircle className="h-3.5 w-3.5" /> Enviar acesso
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => abrirPessoa(member.id)} disabled={!canManage} className="h-8 text-xs">
                          Gerenciar acesso
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AddPersonWizard
        open={adding}
        roles={roles}
        inboxes={inboxes}
        onClose={() => setAdding(false)}
        onCreated={load}
      />

      <BulkInviteModal
        isOpen={bulkInviting}
        onClose={() => setBulkInviting(false)}
        onSuccess={load}
      />

      {/* Modal por pessoa */}
      <Dialog open={!!editing} onOpenChange={o => !o && setEditingId(null)}>
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
                  {cargoOptions.map(option => {
                    const selected = isCargoSelected(option, editing.role);
                    return (
                      <button
                        key={option.key}
                        type="button"
                        disabled={saving}
                        onClick={() => changeCargo(editing, option)}
                        className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                          selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <span className={`mt-0.5 h-4 w-4 flex-none rounded-full border-2 ${selected ? 'border-primary bg-primary' : 'border-muted-foreground/40'}`} />
                        <span>
                          <span className="block text-sm font-medium">{option.label}</span>
                          {option.description && (
                            <span className="block text-xs text-muted-foreground">{option.description}</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* WhatsApp da pessoa.
                  É por este número que a distribuição de leads avisa o corretor
                  ("chegou um lead pra você", com o link de aceite). Fica aqui —
                  e não só dentro de cada roleta — porque é o número DELA: antes,
                  quem estava em três roletas tinha o número digitado três vezes,
                  e corrigi-lo só era possível pelo "Enviar acesso", que troca a
                  senha junto. */}
              <div className="border-t border-border py-3">
                <UILabel className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </UILabel>
                <div className="flex gap-2">
                  <Input
                    value={whatsappRascunho}
                    onChange={e => setWhatsappRascunho(e.target.value)}
                    onBlur={() => salvarWhatsapp(editing)}
                    placeholder="Ex.: 11 94087 1974"
                    disabled={saving || salvandoWhatsapp}
                  />
                  <Button
                    variant="outline"
                    onClick={() => salvarWhatsapp(editing)}
                    disabled={saving || salvandoWhatsapp
                      || whatsappRascunho.trim() === (editing.whatsapp_number ?? '').trim()}
                  >
                    Salvar
                  </Button>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  É por aqui que a distribuição de leads avisa {editing.name} quando um lead cai
                  para ele. Sem número, ele recebe a oferta só pelo app.
                </p>
              </div>

              {/* Instâncias */}
              <div className="border-t border-border py-3">
                <UILabel className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                  <MessageCircle className="h-4 w-4" /> Instâncias
                </UILabel>
                <InboxAccessList
                  inboxes={inboxes}
                  grantedIds={editing.granted_inbox_ids}
                  autoAccess={editing.auto_access}
                  seesAll={editing.sees_all_inboxes}
                  disabled={saving}
                  onToggle={(inboxId, on) => toggleInbox(editing, inboxId, on)}
                />
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => removeUser(editing)} disabled={saving}>
                  Remover do time
                </Button>
                <Button onClick={() => setEditingId(null)} disabled={saving}>Concluir</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Enviar acesso por WhatsApp */}
      <Dialog open={!!sending} onOpenChange={o => !o && setSendingId(null)}>
        <DialogContent className="max-w-md">
          {sending && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-emerald-500" /> Enviar acesso no WhatsApp
                </DialogTitle>
                <DialogDescription>{sending.name} · {sending.email}</DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-1">
                <div>
                  <UILabel className="text-xs">WhatsApp (com DDD)</UILabel>
                  <Input value={sendPhone} onChange={e => setSendPhone(e.target.value)} placeholder="Ex: 11 94087 1974" className="mt-1" />
                </div>
                <div>
                  <UILabel className="text-xs">Senha que vai na mensagem</UILabel>
                  <Input value={sendPwd} onChange={e => setSendPwd(e.target.value)} placeholder="defina uma senha (min. 6)" className="mt-1" />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {sending.plain_password
                      ? 'Vem a senha atual. Se você mudar aqui, a senha de acesso da pessoa é trocada.'
                      : 'Sem senha salva — defina uma. Ela vira a senha de acesso da pessoa.'}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Envia link + login + senha pela instância operacional da Leal Mídia.
                </p>
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={() => setSendingId(null)} disabled={sendBusy}>Cancelar</Button>
                <Button onClick={doSend} disabled={sendBusy} className="gap-1">
                  {sendBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />} Enviar acesso
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
      {dialogoDeConfirmacao}
    </>
  );
}
