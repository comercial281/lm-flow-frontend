import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw, ShieldCheck, MessageCircle, UserPlus, UserX, UserCheck, Trash2, Link2, Smartphone } from 'lucide-react';
import { Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, Label as UILabel } from '@/components/ui/ds';
import { usersService } from '@/services/users';
import InboxMembersService from '@/services/channels/inboxMembersService';
import { teamAccessService } from '@/services/teamAccess/teamAccessService';
import customRolesService from '@/services/customRoles/customRolesService';
import InboxAccessList from '@/components/team/InboxAccessList';
import AddPersonWizard from './AddPersonWizard';
import { buildCargoOptions, cargoPayload, isCargoSelected, type CargoOption } from './cargoOptions';
// F1-T6: o "Convidar por e-mail" (BulkInviteModal) saiu do cabeçalho — o fluxo de
// várias pessoas de uma vez volta dentro do "Adicionar pessoa". O arquivo do
// modal continua no repositório até lá.
import PeopleList from './people/PeopleList';
// A janela que mostra o ESTRAGO antes de desativar (leads, conversas abertas,
// ofertas da roleta, roletas e o WhatsApp exclusivo). É a mesma de sempre: os
// botões é que estavam na tela errada.
import DeactivateUserDialog from '@/components/users/DeactivateUserDialog';
// A que apaga DE VERDADE — e só o cadastro que nunca foi usado. Quem decide é
// o servidor, na prévia; a janela nunca oferece apagar sem esse veredito.
import EraseUserDialog from '@/components/users/EraseUserDialog';
import { ROLE_REFUSAL, deactivationRefusal, resolveActor } from '@/features/users/deactivation/deactivationRules';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { useAuthStore } from '@/store/authStore';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { copyText } from '@/utils/clipboard';
import OwnedNumbersList from '@/components/numbers/OwnedNumbersList';
import numbersService from '@/services/numbers/numbersService';
import { useNumberOwnerRule } from '@/features/numbers/useNumberOwnerRule';
import {
  LIBERATED_TITLE, NOTICE_PHONE_LABEL, NO_OWNED_NUMBERS_OTHER, NUMBERS_TITLE, PRIMARY_DONE, PRIMARY_FAILED,
  PRIMARY_HINT_OTHER,
} from '@/features/numbers/numberTexts';
import type { CustomRole } from '@/types/customRoles';
import type { TeamAccessInbox, TeamAccessMember } from '@/types/teamAccess';

/* Aba "Pessoas" da tela de Equipe — o gestor controla, por pessoa e num lugar
   só: cadastrar, cargo, quais instâncias (WhatsApp) ela atende, enviar o acesso
   e DESATIVAR / REATIVAR.

   ⚠️ O antigo botão de REMOVER saiu daqui, e não é renomeação: ele chamava o excluir,
   que quase nunca apagava de verdade (qualquer lead atendido cria referência).
   O caminho de reserva renomeava o e-mail da pessoa, randomizava a senha e
   respondia "removido" — com ela ainda em todas as roletas, com acesso aos
   canais, dona dos leads e recebendo aviso no WhatsApp. Era um "desativar" por
   acidente: irreversível e incompleto. Quem faz isso direito é o *Desativar*,
   com a janela que mostra o que a pessoa carrega antes de confirmar.

   Duas coisas mudaram aqui e não devem ser desfeitas sem o dono pedir:

   1. O CARGO exibido vem do cargo de verdade, não de uma lista fixa. Enquanto a
      tela conhecia só os três de fábrica, quem tinha cargo próprio (ex.: "SDR")
      aparecia como "Corretor" — o rótulo mentia enquanto a permissão obedecia
      outro.
   2. As instâncias vêm separadas por ORIGEM (ver InboxAccessList). Misturar de
      novo o que o gestor liberou com o que o sistema liberou é o que fazia a
      tela dizer "3 instâncias" para quem tinha uma liberada. */

export default function PeopleTab() {
  const { can } = useUserPermissions();
  const { currentUser } = useAuthStore();
  const isSuper = useIsSuperAdmin();
  const canManage = can('users', 'update');
  const canCreate = can('users', 'create');

  /* Desativar/reativar: o servidor deixa ADMINISTRADOR passar pelo cargo, fora
     do RBAC. Exigir só a chave aqui esconderia os dois botões justamente de quem
     a API sempre aceita — e é o recorte mais caro de errar: a tela oferecendo
     menos do que o servidor permite. */
  const podeUsarDesativacao = isSuper || can('users', 'deactivate');
  const [adding, setAdding] = useState(false);
  // F1-T4: quem está na janela "Criar número para {nome}". Por ora só guarda a
  // escolha; a janela é ligada na tarefa F1-T4.
  const [, setCreatingNumberFor] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamAccessMember[]>([]);
  const [inboxes, setInboxes] = useState<TeamAccessInbox[]>([]);
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Desativar corretor: o id de quem está na janela de confirmação.
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  // Excluir cadastro (apagar de verdade): o id de quem está na janela.
  const [erasingId, setErasingId] = useState<string | null>(null);

  // Fase 2b.1: a regra do dono vale neste cliente? O retrato da equipe traz a
  // resposta do servidor; sem ela (servidor antigo), vale a chave do cliente.
  const [ownerRuleEcho, setOwnerRuleEcho] = useState<boolean | null>(null);
  const numberOwnerRule = useNumberOwnerRule(ownerRuleEcho);
  // Qual número está virando o principal agora (o botão gira nele).
  const [primaryBusy, setPrimaryBusy] = useState<string | null>(null);

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
  const [sendBusy, setSendBusy] = useState(false);

  // A pessoa aberta vem SEMPRE da lista, nunca de uma cópia no estado: com cópia,
  // trocar o cargo ou uma instância atualizava a linha e deixava o painel
  // mostrando o valor velho até fechar e abrir de novo.
  const editing = useMemo(() => members.find(m => m.id === editingId) ?? null, [members, editingId]);
  const sending = useMemo(() => members.find(m => m.id === sendingId) ?? null, [members, sendingId]);
  const deactivating = useMemo(
    () => members.find(m => m.id === deactivatingId) ?? null,
    [members, deactivatingId],
  );
  const erasing = useMemo(() => members.find(m => m.id === erasingId) ?? null, [members, erasingId]);

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
      setOwnerRuleEcho(overview.number_owner_rule ?? null);
      setRoles(roleList);
    } catch {
      toast.error('Erro ao carregar a equipe');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openSend = (member: TeamAccessMember) => {
    setSendingId(member.id);
    setSendPhone(member.whatsapp_number ?? '');
  };

  const doSend = async () => {
    if (!sending) return;
    if (sendPhone.replace(/\D/g, '').length < 10) { toast.error('Informe o celular com DDD.'); return; }
    setSendBusy(true);
    try {
      // Sem senha no corpo: a mensagem leva um link, e quem cria a senha é a
      // própria pessoa ao abri-lo. Mandar senha aqui TROCARIA a de quem já
      // estava usando o CRM — reenviar o acesso não pode custar isso.
      const res = await usersService.sendAccess(sending.id, { whatsapp_number: sendPhone });
      const wa = res.whatsapp;
      const who = sending.name;
      setMembers(prev => prev.map(m => (m.id === sending.id ? { ...m, whatsapp_number: sendPhone } : m)));
      if (wa?.sent) {
        toast.success(`Acesso enviado no WhatsApp de ${who}${wa.instance ? ` (${wa.instance})` : ''}.`);
        setSendingId(null);
        load(); // traz o "Link enviado" da coluna Acesso
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

  // "Copiar link de acesso": gera um link novo de uso único (24h) e copia para
  // a área de transferência, sem passar pelo WhatsApp — para o gestor mandar
  // por onde quiser (e-mail, outro app de mensagem, à mão).
  const copiarLinkDeAcesso = async (member: TeamAccessMember) => {
    try {
      const { url } = await usersService.accessLink(member.id);
      if (await copyText(url)) toast.success('Link de acesso copiado. Ele vale uma vez só, por 24 horas.');
      else toast.message('Copie o link de acesso:', { description: url });
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Não consegui gerar o link de acesso.');
    }
  };

  // O principal de outra pessoa (users.update). Só desempate: é o número que o
  // sistema usa quando precisa escolher um dos números dela. O servidor devolve
  // a lista já na ordem nova.
  const escolherPrincipal = async (member: TeamAccessMember, inboxId: string) => {
    setPrimaryBusy(inboxId);
    try {
      const numbers = await numbersService.setUserPrimary(member.id, inboxId);
      setMembers(prev => prev.map(m => (m.id === member.id ? { ...m, numbers } : m)));
      toast.success(PRIMARY_DONE);
    } catch (e) {
      toast.error(apiErrorMessage(e, PRIMARY_FAILED));
    } finally {
      setPrimaryBusy(null);
    }
  };

  // O campo é semeado ao ABRIR a pessoa, e não a cada render: semear no render
  // apagaria o que o gestor está digitando a cada atualização da lista.
  const abrirPessoa = (id: string) => {
    setWhatsappRascunho(members.find(m => m.id === id)?.whatsapp_number ?? '');
    setEditingId(id);
  };

  // Ao fechar, recarrega: cargo, números liberados e celular mexidos aqui mudam
  // os chips e a coluna da lista, que vêm do retrato da equipe.
  const closeEditing = () => {
    setEditingId(null);
    load();
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
      toast.success(novo ? 'Celular atualizado' : 'Celular removido');
    } catch {
      toast.error('Não consegui salvar o celular');
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
      toast.error('Erro ao mudar o número');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Por que esta pessoa NÃO pode ser desativada — ou null quando pode. O gestor
   * desativa CORRETOR; gestor e administrador só o administrador desativa. A
   * mesma régua roda no servidor — esta existe para a tela não oferecer um
   * botão que a API vai recusar, e para dizer o motivo certo no botão.
   *
   * O último administrador continua protegido (sem ele ninguém religa ninguém),
   * EXCETO quando quem clica é a Leal Mídia: ela é administradora de todo CRM e
   * fica fora da lista de propósito, então com ela sempre há quem religue.
   */
  const motivoBloqueio = (member: TeamAccessMember): string | null => {
    if (!podeUsarDesativacao) return ROLE_REFUSAL;

    // Quem clica pode NÃO estar na lista: a Leal Mídia é administradora de todo
    // CRM e fica escondida da equipe do cliente de propósito.
    const actor = resolveActor(currentUser?.id, members, {
      isPlatformOwner: isSuper,
      name: String(currentUser?.name ?? ''),
    });
    return deactivationRefusal(actor, member, members, { actorIsPlatformOwner: isSuper });
  };
  const podeDesativar = (member: TeamAccessMember) => motivoBloqueio(member) === null;

  /**
   * A volta: devolve o acesso e os canais em que a pessoa atendia. NÃO a
   * recoloca nas roletas (quem religa a torneira é o gestor) e NÃO traz os leads
   * que foram passados.
   */
  const reativar = async (member: TeamAccessMember) => {
    setSaving(true);
    try {
      await usersService.reactivate(member.id);
      toast.success(`${member.name} voltou. Ele ainda está fora das roletas — ligue quando quiser.`);
      await load();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Não consegui reativar agora.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {members.length} pessoa{members.length !== 1 ? 's' : ''} · cargo e números de cada um
        </p>
        <Button onClick={() => setAdding(true)} disabled={!canCreate} className="gap-1.5">
          <UserPlus className="h-4 w-4" /> Adicionar pessoa
        </Button>
      </div>

      {loading && members.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Carregando equipe…
        </div>
      ) : (
        <PeopleList
          members={members}
          canCreateNumber={can('channels', 'create')}
          // F1-T3 troca isto pela ficha da pessoa. Até lá abre o "Gerenciar
          // acesso", onde seguem desativar, reativar, excluir, enviar acesso e
          // copiar link.
          onOpen={member => abrirPessoa(member.id)}
          onCreateNumber={member => setCreatingNumberFor(member.id)} // F1-T4
        />
      )}

      <AddPersonWizard
        open={adding}
        roles={roles}
        inboxes={inboxes}
        onClose={() => setAdding(false)}
        onCreated={load}
      />

      <DeactivateUserDialog
        open={!!deactivating}
        user={deactivating}
        users={members}
        onClose={() => setDeactivatingId(null)}
        onDone={() => {
          setDeactivatingId(null);
          setEditingId(null);
          load();
        }}
      />

      <EraseUserDialog
        open={!!erasing}
        user={erasing}
        onClose={() => setErasingId(null)}
        onDone={() => {
          setErasingId(null);
          setEditingId(null);
          load();
        }}
      />

      {/* Modal por pessoa */}
      <Dialog open={!!editing} onOpenChange={o => !o && closeEditing()}>
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
                  <MessageCircle className="h-4 w-4" /> {NOTICE_PHONE_LABEL}
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
                  O celular pessoal de {editing.name}: é por ele que chegam os avisos da distribuição de
                  leads e o link de acesso. Não é número de atendimento. Sem ele, a oferta chega só pelo app.
                </p>
              </div>

              {/* Números de atendimento (só com a regra do dono, fase 2b.1): os
                  números de que a pessoa é DONA — só leitura aqui, com o link
                  para Canais; quem tem mais de um tem o principal escolhido aqui. */}
              {numberOwnerRule && (
                <div className="border-t border-border py-3">
                  <UILabel className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                    <Smartphone className="h-4 w-4" /> {NUMBERS_TITLE}
                  </UILabel>
                  <OwnedNumbersList
                    numbers={editing.numbers ?? []}
                    canChoosePrimary={canManage}
                    busyId={primaryBusy}
                    onChoosePrimary={inboxId => escolherPrincipal(editing, inboxId)}
                    emptyText={NO_OWNED_NUMBERS_OTHER}
                    hint={PRIMARY_HINT_OTHER}
                  />
                </div>
              )}

              {/* Números liberados (o nome vale com ou sem a regra) */}
              <div className="border-t border-border py-3">
                <UILabel className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                  <MessageCircle className="h-4 w-4" /> {LIBERATED_TITLE}
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

              {/* O REGISTRO da desativação — a resposta para "para onde foi a
                  carteira do Fulano?", que é a pergunta que alguém faz uma
                  semana depois. Os leads passados não voltam com a reativação:
                  quem atendeu aquela carteira fez trabalho que não se desfaz
                  por efeito de um clique. */}
              {editing.deactivated && (
                <div className="space-y-1 rounded-md border border-border bg-muted/30 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Desativado em</span>
                    <span className="font-medium">
                      {editing.deactivated_at
                        ? new Date(editing.deactivated_at).toLocaleDateString('pt-BR')
                        : '—'}
                    </span>
                  </div>
                  {editing.deactivation_snapshot?.transfer_to_name && (
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-muted-foreground">Os leads dele foram para</span>
                      <span className="text-right font-medium">
                        {editing.deactivation_snapshot.transfer_to_name}
                      </span>
                    </div>
                  )}
                  {editing.deactivation_snapshot?.disconnect_number
                    && editing.deactivation_snapshot?.exclusive_number?.name && (
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-muted-foreground">WhatsApp desconectado</span>
                      <span className="text-right font-medium">
                        {editing.deactivation_snapshot.exclusive_number.name}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                <div className="flex flex-wrap items-center gap-1">
                  {/* Quem está fora não entra: mandar acesso a ele é convite que não funciona. */}
                  {!editing.deactivated && (
                    <>
                      <Button
                        variant="ghost"
                        className="gap-1.5 text-emerald-600 hover:text-emerald-700"
                        onClick={() => { setEditingId(null); openSend(editing); }}
                        disabled={saving || !canManage}
                        title="Enviar o acesso no celular da pessoa"
                      >
                        <MessageCircle className="h-4 w-4" /> Enviar acesso
                      </Button>
                      <Button
                        variant="ghost"
                        className="gap-1.5"
                        onClick={() => copiarLinkDeAcesso(editing)}
                        disabled={saving || !canManage}
                        title="Gera um link novo (vale uma vez, por 24h) para você mandar por onde quiser"
                      >
                        <Link2 className="h-4 w-4" /> Copiar link de acesso
                      </Button>
                    </>
                  )}
                  {editing.deactivated ? (
                    <Button
                      variant="ghost"
                      className="gap-1.5 text-emerald-600 hover:text-emerald-700"
                      onClick={() => reativar(editing)}
                      disabled={saving || !podeUsarDesativacao}
                    >
                      <UserCheck className="h-4 w-4" /> Reativar
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => setDeactivatingId(editing.id)}
                      disabled={saving || !podeDesativar(editing)}
                      title={motivoBloqueio(editing)
                        ?? 'Corta o acesso, tira das roletas e para os avisos. O perfil continua.'}
                    >
                      <UserX className="h-4 w-4" /> Desativar
                    </Button>
                  )}
                  {/* Apagar DE VERDADE: só o cadastro que nunca foi usado. A janela
                      pergunta ao servidor antes; aqui vale só a régua de "quem pode
                      mexer em quem", a mesma do Desativar. */}
                  <Button
                    variant="ghost"
                    className="gap-1.5 text-muted-foreground hover:text-destructive"
                    onClick={() => setErasingId(editing.id)}
                    disabled={saving || !podeDesativar(editing)}
                    title={motivoBloqueio(editing)
                      ?? 'Apaga o cadastro de verdade. Só para quem nunca atendeu ninguém.'}
                  >
                    <Trash2 className="h-4 w-4" /> Excluir cadastro
                  </Button>
                </div>
                <Button onClick={closeEditing} disabled={saving}>Concluir</Button>
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
                  <UILabel className="text-xs">{NOTICE_PHONE_LABEL} (com DDD)</UILabel>
                  <Input value={sendPhone} onChange={e => setSendPhone(e.target.value)} placeholder="Ex: 11 94087 1974" className="mt-1" />
                </div>
                <div className="rounded-md border border-emerald-500/25 bg-emerald-500/5 p-3">
                  <p className="text-xs text-muted-foreground">
                    A mensagem leva um <strong>link de acesso</strong>: {sending.name.split(' ')[0]} abre,
                    cria a senha que quiser e já entra no CRM. Nenhuma senha vai escrita na
                    conversa, e o link vale <strong>uma vez só, por 24 horas</strong>.
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    A senha de quem já usa o CRM não muda. Passado o prazo, é só enviar de novo.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Sai pelo número operacional da Leal Mídia.
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
    </>
  );
}
