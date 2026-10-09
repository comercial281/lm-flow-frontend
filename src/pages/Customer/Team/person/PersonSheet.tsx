import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Link2, Loader2, MessageCircle, Plus, ShieldCheck, Smartphone, Star, Trash2, Undo2, UserCheck, UserRound, UserX, X,
} from 'lucide-react';
import {
  Badge, Button, Input, Label, Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
import IconActionButton from '@/components/base/IconActionButton';
import { autoAccessLabel } from '@/components/team/InboxAccessList';
// A janela que mostra o ESTRAGO antes de desativar (leads, conversas abertas,
// ofertas da roleta, roletas e o WhatsApp exclusivo). É a mesma de sempre: só
// mudou de casa, do "Gerenciar acesso" para a ficha.
import DeactivateUserDialog from '@/components/users/DeactivateUserDialog';
// A que apaga DE VERDADE — e só o cadastro que nunca foi usado. Quem decide é
// o servidor, na prévia; a janela nunca oferece apagar sem esse veredito.
import EraseUserDialog from '@/components/users/EraseUserDialog';
import { ROLE_REFUSAL, deactivationRefusal, resolveActor } from '@/features/users/deactivation/deactivationRules';
import {
  MAKE_PRIMARY, NO_PHONE, OWNER_TITLE, PRIMARY_DONE, PRIMARY_FAILED, PRIMARY_HINT_OTHER, PRINCIPAL, formatPhone,
} from '@/features/numbers/numberTexts';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { useAuthStore } from '@/store/authStore';
import { usersService } from '@/services/users';
import InboxMembersService from '@/services/channels/inboxMembersService';
import numbersService from '@/services/numbers/numbersService';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { copyText } from '@/utils/clipboard';
import { assignableCargoOptions, isCargoSelected, type CargoOption } from '../cargoOptions';
import { DOT_CLASS, STATE_TEXT } from '../people/NumberChip';
import { numberState } from '../people/peopleFilters';
import { accessStatus } from '../people/accessStatus';
import {
  PHONE_TOO_SHORT, READ_ONLY_NOTE, buildUserPatch, liberatedDiff, phoneIsValid, targetRefusal, viewerIsAdmin,
} from './personSheetRules';
import type { UserUpdateData } from '@/types/users';
import type { MemberNumber, TeamAccessInbox, TeamAccessMember } from '@/types/teamAccess';

/* A FICHA da pessoa (painel lateral), no lugar do antigo "Gerenciar acesso".

   Tudo o que se faz por pessoa mora aqui: nome, cargo, celular, números,
   acesso, desativar/reativar e excluir. Um Salvar só para o que é cadastro
   (nome, celular, cargo e números liberados), e ele manda SÓ o que mudou.
   Ações que não são cadastro — escolher o principal, mandar o link, copiar o
   link — acontecem na hora, como antes.

   Duas réguas decidem se a ficha abre editável, e as duas espelham o servidor:
   a permissão (users.update) e "quem mexe em quem" (quem não é administrador
   só mexe em corretor ou em si mesmo). Sem uma delas a ficha é só leitura — a
   tela não oferece o que a API vai recusar. O que o servidor recusar mesmo
   assim aparece com a frase dele, como veio. */

export interface PersonSheetProps {
  member: TeamAccessMember;
  /** A equipe inteira: a régua do Desativar (último administrador, quem clica) e o destino da carteira. */
  members: TeamAccessMember[];
  inboxes: TeamAccessInbox[];
  roles: CargoOption[];
  /** A regra do dono vale neste cliente? Sem ela não há "principal" para escolher. */
  numberOwnerRule: boolean;
  onClose: () => void;
  /** Algo mudou no servidor: a lista recarrega. */
  onChanged: () => void;
  onCreateNumber: (member: TeamAccessMember) => void;
}

const TONE_CLASS = {
  ok: 'text-emerald-600 dark:text-emerald-400',
  warn: 'text-amber-600 dark:text-amber-400',
  off: 'text-muted-foreground',
} as const;

function fromInbox(ib: TeamAccessInbox): MemberNumber {
  return {
    inbox_id: String(ib.id),
    name: ib.name,
    phone: ib.phone ?? null,
    connection: ib.connection ?? null,
    principal: false,
    never_connected: false,
    owner: false,
  };
}

function Bloco({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 border-t border-border px-4 py-4 first:border-t-0">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">{icon} {title}</h3>
      {children}
    </section>
  );
}

export default function PersonSheet({
  member, members, inboxes, roles, numberOwnerRule, onClose, onChanged, onCreateNumber,
}: PersonSheetProps) {
  const { can } = useUserPermissions();
  const { currentUser } = useAuthStore();
  const isSuper = useIsSuperAdmin();
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();

  // Quem clica pode NÃO estar na lista: a Leal Mídia é administradora de todo
  // CRM e fica escondida da equipe do cliente de propósito.
  const viewer = resolveActor(currentUser?.id, members, { isPlatformOwner: isSuper, name: String(currentUser?.name ?? '') });
  const refusal = targetRefusal(viewer, member, isSuper);
  const active = !member.deactivated;
  const canEdit = can('users', 'update') && !refusal;
  const canSend = active && !refusal && can('users', 'send_access');
  const canCopy = active && !refusal && can('users', 'update');
  const canCreateNumber = active && !refusal && !member.sees_all_inboxes && can('channels', 'create');
  // Liberar e tirar mexem numa pessoa só: POST e DELETE /inbox_members, e o
  // servidor cobra `inboxes.update` nos dois. Sem a chave, a ficha não oferece —
  // o servidor recusaria.
  const canGrant = canEdit && can('inboxes', 'update');
  const canRevoke = canGrant;

  /* Desativar/reativar: o servidor deixa ADMINISTRADOR passar pelo cargo, fora
     do RBAC. Exigir só a chave aqui esconderia os botões justamente de quem a
     API sempre aceita. A régua de quem desativa quem é a de sempre. */
  const podeUsarDesativacao = isSuper || can('users', 'deactivate');
  const motivoBloqueio = podeUsarDesativacao
    ? deactivationRefusal(viewer, member, members, { actorIsPlatformOwner: isSuper })
    : ROLE_REFUSAL;

  const initialCargoKey = useMemo(
    () => roles.find(o => isCargoSelected(o, member.role))?.key ?? null,
    [roles, member.role],
  );
  // Um booleano, e não o `viewer`: ele é um objeto novo a cada render quando
  // quem vê é a Leal Mídia, e o memo nunca guardaria nada.
  const isAdminViewer = viewerIsAdmin(viewer, isSuper);
  const cargoOptions = useMemo(
    () => assignableCargoOptions(roles, { viewerIsAdmin: isAdminViewer, currentKey: initialCargoKey }),
    [roles, isAdminViewer, initialCargoKey],
  );

  // O rascunho é semeado ao ABRIR (a ficha é montada por pessoa) e não a cada
  // recarga da lista: semear no render apagaria o que o gestor está digitando.
  const [name, setName] = useState(member.name);
  const [phone, setPhone] = useState(member.whatsapp_number ?? '');
  const [cargoKey, setCargoKey] = useState<string>(initialCargoKey ?? '');
  // Números: guarda só o que o gestor MUDOU. A base vem sempre da pessoa da
  // lista, então uma recarga no meio (depois de escolher o principal, por
  // exemplo) não desfaz a escolha nem a duplica.
  const [added, setAdded] = useState<string[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [primaryBusy, setPrimaryBusy] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [erasing, setErasing] = useState(false);

  const numbers = member.all_numbers ?? [];
  const owned = numbers.filter(n => n.owner);
  const liberated = numbers.filter(n => !n.owner);
  const baseLiberated = liberated.map(n => n.inbox_id);
  const draftLiberated = [...baseLiberated.filter(id => !removed.includes(id)), ...added];
  const diff = liberatedDiff(baseLiberated, draftLiberated);
  const addedNumbers = added
    .map(id => inboxes.find(ib => String(ib.id) === id))
    .filter((ib): ib is TeamAccessInbox => !!ib)
    .map(fromInbox);
  const known = new Set([...numbers.map(n => n.inbox_id), ...added]);
  const available = inboxes.filter(ib => !known.has(String(ib.id)));
  // Os que o sistema liberou sozinho (para ela abrir o próprio lead): não se
  // tiram por aqui — o servidor recusa —, então aparecem só com o motivo.
  const automatic = inboxes.filter(ib => member.auto_access?.[String(ib.id)] && !known.has(String(ib.id)));

  const cargo = roles.find(o => o.key === cargoKey) ?? null;
  const patch = buildUserPatch(member, { name, phone, cargo }, initialCargoKey);
  const dirty = Object.keys(patch).length > 0 || diff.add.length > 0 || diff.remove.length > 0;
  const status = accessStatus(member);
  const nomeDoNumero = (id: string) => inboxes.find(ib => String(ib.id) === id)?.name ?? 'o número';
  const podeEscolherPrincipal = canEdit && numberOwnerRule && owned.length > 1;

  const salvar = async () => {
    if (!phoneIsValid(phone)) { toast.error(PHONE_TOO_SHORT); return; }
    setSaving(true);
    try {
      if (Object.keys(patch).length > 0) {
        try {
          await usersService.updateUser(member.id, patch as UserUpdateData);
        } catch (e) {
          toast.error(apiErrorMessage(e, 'Não consegui salvar.'));
          return;
        }
      }
      // Números: só os que mudaram, e só ESTA pessoa em cada um. Nada de ler a
      // lista e regravá-la inteira: a leitura devolve [] quando falha (o PATCH
      // tiraria todo mundo do número) e traz quem só tem acesso automático (o
      // PATCH o promoveria à distribuição de leads).
      const falhas: string[] = [];
      for (const id of [...diff.add, ...diff.remove]) {
        try {
          if (diff.add.includes(id)) await InboxMembersService.add(id, [member.id]);
          else await InboxMembersService.remove(id, [member.id]);
        } catch (e) {
          falhas.push(apiErrorMessage(e, `Não consegui mudar ${nomeDoNumero(id)}.`));
        }
      }
      onChanged();
      if (falhas.length > 0) {
        falhas.forEach(f => toast.error(f));
        // A recarga traz o que ficou de verdade; o rascunho dos números recomeça dela.
        setAdded([]);
        setRemoved([]);
        return;
      }
      toast.success('Alterações salvas.');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  // O principal só desempata: é o número que o sistema usa quando precisa
  // escolher um dos números da pessoa. Acontece na hora, fora do Salvar.
  const escolherPrincipal = async (inboxId: string) => {
    setPrimaryBusy(inboxId);
    try {
      await numbersService.setUserPrimary(member.id, inboxId);
      toast.success(PRIMARY_DONE);
      onChanged();
    } catch (e) {
      toast.error(apiErrorMessage(e, PRIMARY_FAILED));
    } finally {
      setPrimaryBusy(null);
    }
  };

  // "Copiar link": gera um link novo de uso único (24h) e copia, sem passar pelo
  // WhatsApp — para o gestor mandar por onde quiser.
  const copiarLink = async () => {
    try {
      const { url } = await usersService.accessLink(member.id);
      if (await copyText(url)) toast.success('Link de acesso copiado. Ele vale uma vez só, por 24 horas.');
      else toast.message('Copie o link de acesso:', { description: url });
      onChanged();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não consegui gerar o link de acesso.'));
    }
  };

  // Manda o link para o celular DO CAMPO (o servidor grava esse celular junto).
  // Sem senha no corpo: quem cria a senha é a própria pessoa ao abrir o link, e
  // reenviar o acesso não pode trocar a senha de quem já usa o CRM.
  const enviarLink = async () => {
    if (phone.replace(/\D/g, '').length < 10) { toast.error(PHONE_TOO_SHORT); return; }
    // O servidor grava o celular do envio no cadastro: com o campo diferente do
    // gravado, isso acontece fora do Salvar — e a confirmação tem que dizer.
    const gravaCelular = phone.trim() !== (member.whatsapp_number ?? '').trim();
    const ok = await confirmar({
      titulo: `Enviar o link de acesso para ${member.name}?`,
      descricao: `Vai para ${formatPhone(phone) || phone}, pelo número operacional da Leal Mídia. `
        + (gravaCelular ? 'Esse celular fica gravado no cadastro. ' : '')
        + 'O link vale uma vez só, por 24 horas: a pessoa abre, cria a senha e entra. '
        + 'A senha de quem já usa o CRM não muda.',
      rotuloDaAcao: 'Enviar',
    });
    if (!ok) return;
    setSendBusy(true);
    try {
      const res = await usersService.sendAccess(member.id, { whatsapp_number: phone.trim() });
      const wa = res.whatsapp;
      if (wa?.sent) toast.success(`Link de acesso enviado no WhatsApp de ${member.name}.`);
      else if (wa?.error) toast.error(`Acesso salvo, mas o WhatsApp falhou: ${wa.error}`);
      else toast.error(`Não enviou: ${wa?.skipped ?? 'motivo desconhecido'}`);
      onChanged();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Erro ao enviar o acesso.'));
    } finally {
      setSendBusy(false);
    }
  };

  /**
   * A volta: devolve o acesso e os números em que a pessoa atendia. NÃO a
   * recoloca nas roletas (quem religa a torneira é o gestor) e NÃO traz os leads
   * que foram passados.
   */
  const reativar = async () => {
    setSaving(true);
    try {
      await usersService.reactivate(member.id);
      toast.success(`${member.name} voltou e continua fora das roletas. Ligue quando quiser.`);
      onChanged();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não consegui reativar agora.'));
    } finally {
      setSaving(false);
    }
  };

  // Esc, clique fora ou o X: com alteração por salvar, pergunta antes de perder.
  const fechar = async () => {
    if (dirty && !(await confirmar({
      titulo: 'Descartar alterações?',
      descricao: `O que você mudou na ficha de ${member.name} ainda não foi salvo.`,
      rotuloDaAcao: 'Descartar',
      rotuloDeCancelar: 'Continuar editando',
      destrutivo: true,
    }))) return;
    onClose();
  };

  const cartao = (n: MemberNumber, pendente: 'entra' | 'sai' | null) => {
    const state = numberState(n);
    // O liberado que ainda não foi salvo sai do rascunho sem pedir nada ao servidor.
    const podeTirar = !n.owner && (pendente === 'entra' ? canEdit : canRevoke);
    return (
      <li
        key={n.inbox_id}
        className={`flex flex-wrap items-center gap-2 rounded-lg border border-border p-2.5 text-sm ${pendente === 'sai' ? 'opacity-60' : ''}`}
      >
        <span className={`h-2.5 w-2.5 flex-none rounded-full ${DOT_CLASS[state]}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className={`truncate font-medium ${pendente === 'sai' ? 'line-through' : ''}`}>{n.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {`${formatPhone(n.phone) || NO_PHONE} · ${STATE_TEXT[state]}`}
          </div>
        </div>
        <Badge variant="outline" className="text-xs">{n.owner ? OWNER_TITLE : 'Atende as conversas'}</Badge>
        {pendente === 'entra' && <span className="text-xs text-primary">Entra ao salvar</span>}
        {numberOwnerRule && n.owner && owned.length > 1 && n.principal && (
          <Badge variant="outline" className="gap-1 text-xs text-violet-600">
            <Star className="h-3 w-3" aria-hidden="true" /> {PRINCIPAL}
          </Badge>
        )}
        {podeEscolherPrincipal && n.owner && !n.principal && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            disabled={!!primaryBusy}
            onClick={() => escolherPrincipal(n.inbox_id)}
          >
            {primaryBusy === n.inbox_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-label="Salvando" /> : MAKE_PRIMARY}
          </Button>
        )}
        {pendente === 'sai' ? (
          <>
            <span className="text-xs text-muted-foreground">Sai ao salvar</span>
            <IconActionButton
              label={`Desfazer: manter ${n.name}`}
              icon={<Undo2 className="h-4 w-4" />}
              variant="ghost"
              disabled={saving}
              onClick={() => setRemoved(prev => prev.filter(id => id !== n.inbox_id))}
            />
          </>
        ) : podeTirar && (
          <IconActionButton
            label={`Tirar ${n.name} de ${member.name}`}
            icon={<X className="h-4 w-4" />}
            variant="ghost"
            disabled={saving}
            onClick={() => (pendente === 'entra'
              ? setAdded(prev => prev.filter(id => id !== n.inbox_id))
              : setRemoved(prev => [...prev, n.inbox_id]))}
          />
        )}
      </li>
    );
  };

  const cargoAtual = cargo ?? roles.find(o => o.key === initialCargoKey) ?? null;

  return (
    <Sheet open onOpenChange={o => { if (!o) fechar(); }}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border pr-10">
          <SheetTitle>{member.name}</SheetTitle>
          <SheetDescription>{member.email}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {(refusal || !can('users', 'update')) && (
            <p className="mx-4 mt-4 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
              {refusal ?? READ_ONLY_NOTE}
            </p>
          )}

          {canEdit && (
            <Bloco icon={<UserRound className="h-4 w-4" aria-hidden="true" />} title="Nome">
              <Label htmlFor="person-name" className="sr-only">Nome</Label>
              <Input id="person-name" value={name} onChange={e => setName(e.target.value)} disabled={saving} />
            </Bloco>
          )}

          <Bloco icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />} title="Cargo">
            {canEdit ? (
              <>
                <Seletor
                  aria-label="Cargo"
                  value={cargoKey}
                  onChange={e => setCargoKey(e.target.value)}
                  disabled={saving}
                  className="w-full"
                >
                  {/* Cargo que a lista não conhece (cargos não carregaram): mostra o
                      nome de verdade em vez de a primeira opção fingir ser o cargo. */}
                  {!initialCargoKey && <option value="">{member.role.name}</option>}
                  {cargoOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                </Seletor>
                {cargoAtual?.description && <p className="text-xs text-muted-foreground">{cargoAtual.description}</p>}
              </>
            ) : (
              <p className="text-sm">{member.role.name}</p>
            )}
          </Bloco>

          {/* O celular PESSOAL: é por ele que chegam o link de acesso e os avisos
              de lead novo. Não é número de atendimento. */}
          <Bloco icon={<MessageCircle className="h-4 w-4" aria-hidden="true" />} title="Celular">
            {canEdit ? (
              <>
                <Label htmlFor="person-phone" className="sr-only">Celular</Label>
                <Input
                  id="person-phone"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="Ex.: 11 94087 1974"
                  disabled={saving}
                />
                {!phoneIsValid(phone) && <p className="text-xs text-destructive">{PHONE_TOO_SHORT}</p>}
              </>
            ) : (
              <p className="text-sm">{formatPhone(member.whatsapp_number) || 'Sem celular cadastrado'}</p>
            )}
            <p className="text-xs text-muted-foreground">Recebe o link de acesso e os avisos de lead novo.</p>
          </Bloco>

          <Bloco icon={<Smartphone className="h-4 w-4" aria-hidden="true" />} title="Números de WhatsApp">
            {member.sees_all_inboxes ? (
              <p className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                Administrador vê todos os números, sem precisar liberar.
              </p>
            ) : (
              <>
                {numbers.length + addedNumbers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum número ainda.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {owned.map(n => cartao(n, null))}
                    {liberated.map(n => cartao(n, removed.includes(n.inbox_id) ? 'sai' : null))}
                    {addedNumbers.map(n => cartao(n, 'entra'))}
                  </ul>
                )}
                {podeEscolherPrincipal && <p className="text-xs text-muted-foreground">{PRIMARY_HINT_OTHER}</p>}

                {canGrant && available.length > 0 && (
                  <Seletor
                    aria-label="Liberar outro número"
                    value=""
                    onChange={e => { const id = e.target.value; if (id) setAdded(prev => [...prev, id]); }}
                    disabled={saving}
                    className="w-full"
                  >
                    <option value="">Liberar outro número</option>
                    {available.map(ib => (
                      <option key={ib.id} value={String(ib.id)}>
                        {ib.phone ? `${ib.name} · ${formatPhone(ib.phone)}` : ib.name}
                      </option>
                    ))}
                  </Seletor>
                )}

                {canCreateNumber && (
                  <Button
                    variant="outline"
                    className="w-full gap-1.5 border-dashed"
                    onClick={() => onCreateNumber(member)}
                    disabled={saving}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" /> {`Criar número novo para ${member.name}`}
                  </Button>
                )}

                {automatic.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <p className="text-xs font-medium text-muted-foreground">Liberados pelo sistema, para abrir os próprios leads</p>
                    <ul className="space-y-0.5">
                      {automatic.map(ib => (
                        <li key={ib.id} className="text-xs text-muted-foreground">
                          {`${ib.name} — ${autoAccessLabel(member.auto_access[String(ib.id)])}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </Bloco>

          <Bloco icon={<Link2 className="h-4 w-4" aria-hidden="true" />} title="Acesso">
            <div>
              <div className={`text-sm font-medium ${TONE_CLASS[status.tone]}`}>{status.label}</div>
              {status.detail && <div className="text-xs text-muted-foreground">{status.detail}</div>}
            </div>
            {(canCopy || canSend) && (
              <div className="flex flex-wrap gap-2">
                {canCopy && (
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={copiarLink} disabled={saving}>
                    <Link2 className="h-4 w-4" aria-hidden="true" /> Copiar link
                  </Button>
                )}
                {canSend && (
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={enviarLink} disabled={saving || sendBusy}>
                    {sendBusy
                      ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      : <MessageCircle className="h-4 w-4" aria-hidden="true" />}
                    {member.last_seen_at || member.access_link_until ? 'Reenviar link' : 'Enviar link de acesso'}
                  </Button>
                )}
              </div>
            )}

            {/* O REGISTRO da desativação — a resposta para "para onde foi a
                carteira?", que é a pergunta que alguém faz uma semana depois. */}
            {member.deactivated && (
              <div className="space-y-1 rounded-md border border-border bg-muted/30 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Desativado em</span>
                  <span className="font-medium">
                    {member.deactivated_at ? new Date(member.deactivated_at).toLocaleDateString('pt-BR') : '—'}
                  </span>
                </div>
                {member.deactivation_snapshot?.transfer_to_name && (
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">Os leads foram para</span>
                    <span className="text-right font-medium">{member.deactivation_snapshot.transfer_to_name}</span>
                  </div>
                )}
                {member.deactivation_snapshot?.disconnect_number && member.deactivation_snapshot?.exclusive_number?.name && (
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">WhatsApp desconectado</span>
                    <span className="text-right font-medium">{member.deactivation_snapshot.exclusive_number.name}</span>
                  </div>
                )}
              </div>
            )}
          </Bloco>
        </div>

        <SheetFooter className="flex-row flex-wrap items-center justify-between gap-2 border-t border-border">
          <div className="flex flex-wrap items-center gap-1">
            {member.deactivated ? (
              <Button
                variant="ghost"
                className="gap-1.5 text-emerald-600 hover:text-emerald-700"
                onClick={reativar}
                disabled={saving || !podeUsarDesativacao}
              >
                <UserCheck className="h-4 w-4" aria-hidden="true" /> Reativar
              </Button>
            ) : (
              <Button
                variant="ghost"
                className="gap-1.5 text-destructive hover:text-destructive"
                onClick={() => setDeactivating(true)}
                disabled={saving || motivoBloqueio !== null}
                title={motivoBloqueio ?? 'Corta o acesso, tira das roletas e para os avisos. O perfil continua.'}
              >
                <UserX className="h-4 w-4" aria-hidden="true" /> Desativar pessoa
              </Button>
            )}
            {/* Apagar DE VERDADE: só o cadastro que nunca foi usado. A janela
                pergunta ao servidor antes; aqui vale só a régua de "quem pode
                mexer em quem", a mesma do Desativar. */}
            <Button
              variant="ghost"
              className="gap-1.5 text-muted-foreground hover:text-destructive"
              onClick={() => setErasing(true)}
              disabled={saving || motivoBloqueio !== null}
              title={motivoBloqueio ?? 'Apaga o cadastro de verdade. Só para quem nunca atendeu ninguém.'}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Excluir cadastro
            </Button>
          </div>
          {canEdit && (
            <Button onClick={salvar} disabled={saving || !dirty || !phoneIsValid(phone)} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Salvar
            </Button>
          )}
        </SheetFooter>

        <DeactivateUserDialog
          open={deactivating}
          user={member}
          users={members}
          onClose={() => setDeactivating(false)}
          onDone={() => { setDeactivating(false); onChanged(); onClose(); }}
        />
        <EraseUserDialog
          open={erasing}
          user={member}
          onClose={() => setErasing(false)}
          onDone={() => { setErasing(false); onChanged(); onClose(); }}
        />
        {dialogoDeConfirmacao}
      </SheetContent>
    </Sheet>
  );
}
