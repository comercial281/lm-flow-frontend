import type { DeactivationPreview, DeactivatePayload, DeactivationReason } from '@/types/users';

/**
 * Quem está CLICANDO, no formato das regras.
 *
 * A pessoa vem da lista da equipe quando ela está lá — é de onde sai o cargo de
 * verdade. Mas a **Leal Mídia não aparece na equipe de cliente nenhum**: o dono
 * da plataforma é plantado como administrador em TODO CRM e escondido da lista
 * de propósito (senão receberia aviso de lead de toda imobiliária).
 *
 * Sem este degrau quem clica simplesmente some, a régua responde "não pode" e o
 * botão *Desativar* nasce desligado justamente para quem pode tudo — que é o
 * defeito relatado no dia da estreia.
 */
export function resolveActor<T extends DeactivatablePerson>(
  currentUserId: string | null | undefined,
  members: T[],
  options: { isPlatformOwner?: boolean; name?: string } = {},
): DeactivatablePerson | null {
  const id = String(currentUserId ?? '').trim();
  if (!id) return null;

  const fromTeam = members.find(m => m.id === id);
  if (fromTeam) return fromTeam;

  // Fora da lista, o único caso legítimo é o dono da plataforma. Qualquer outro
  // "não achei" continua sendo não — inventar cargo para quem a lista não
  // conhece é o caminho de dar o botão a quem a API vai recusar.
  return options.isPlatformOwner ? { id, name: options.name || 'Leal Mídia', chave_role: 'admin' } : null;
}

/**
 * Quem pode ser desativado, pelo MÍNIMO que as regras precisam saber.
 *
 * Não é `User` de propósito: a tela onde os botões de fato moram (Equipe →
 * Pessoas) carrega o retrato da equipe, que é outro formato. Amarrar as regras
 * ao formato de uma das telas obrigaria a segunda a converter — e conversão de
 * formato no meio do caminho é onde "o cargo some" e o botão passa a aparecer
 * para quem não pode.
 */
export interface DeactivatablePerson {
  id: string;
  name: string;
  deactivated?: boolean;
  chave_role?: string;
  role?: { key?: string; chave_role?: string } | null;
}

/**
 * As regras da janela *Desativar corretor*.
 *
 * Moram em arquivo próprio, com teste, e não dentro da janela: a mais
 * importante delas — desconectar o WhatsApp EXIGE escolher quem fica com os
 * leads — é invisível na tela e, quando falha, o efeito não aparece em lugar
 * nenhum. Número desconectado não recebe mensagem: o lead que responder na
 * conversa antiga (e é o que ele vai fazer, é a conversa que ele conhece) cai
 * num número desligado e ninguém vê.
 *
 * A outra regra invisível: a opção de desconectar só existe para o número
 * EXCLUSIVO dele. Num compartilhado, desconectar derrubaria o WhatsApp da
 * imobiliária inteira.
 */

export const DEACTIVATION_REASONS: DeactivationReason[] = ['ferias', 'afastamento', 'saiu'];

export interface DeactivationChoice {
  reason: DeactivationReason;
  /** null = deixa os leads como estão, com quem está saindo. */
  transferToId: string | null;
  disconnectNumber: boolean;
}

/**
 * A opção de desconectar o WhatsApp só é oferecida quando ele tem número
 * exclusivo. Sem isto a tela ofereceria derrubar um número compartilhado.
 */
export function canOfferDisconnect(preview: DeactivationPreview | null): boolean {
  return Boolean(preview?.exclusive_number?.inbox_id || preview?.exclusive_number?.name);
}

/**
 * Ele tem carteira? Só quando tem é que o destino dos leads vira obrigatório
 * junto com o desconectar — cobrar destino de quem não tem lead nenhum seria uma
 * pergunta sem resposta possível.
 */
export function hasLeads(preview: DeactivationPreview | null): boolean {
  return (preview?.leads ?? 0) > 0 || (preview?.open_conversations ?? 0) > 0;
}

/**
 * O que impede confirmar. Devolve a frase que a tela mostra, ou null quando
 * está tudo certo — nunca um booleano solto: quem lê "não posso confirmar"
 * precisa saber por quê, no mesmo lugar.
 */
export function blockingReason(
  choice: DeactivationChoice,
  preview: DeactivationPreview | null,
): string | null {
  if (!DEACTIVATION_REASONS.includes(choice.reason)) {
    return 'Escolha o motivo da desativação.';
  }

  if (choice.disconnectNumber && !choice.transferToId && hasLeads(preview)) {
    return (
      'Para desconectar o WhatsApp dele, escolha quem fica com os leads: ' +
      'o lead que responder na conversa antiga cairia num número desligado.'
    );
  }

  return null;
}

/**
 * O que viaja para o servidor.
 *
 * `disconnect_number` só sai verdadeiro quando a opção era oferecida de fato:
 * a caixa pode ter ficado marcada de uma abertura anterior da janela, e mandar
 * "desconecta" para quem não tem número exclusivo é pedir ao servidor algo que
 * ele vai ignorar — silêncio dos dois lados.
 */
export function buildDeactivatePayload(
  choice: DeactivationChoice,
  preview: DeactivationPreview | null,
): DeactivatePayload {
  return {
    reason: choice.reason,
    transfer_to_id: choice.transferToId,
    disconnect_number: choice.disconnectNumber && canOfferDisconnect(preview),
  };
}

/**
 * Quem pode aparecer como destino da carteira: gente ativa, que não seja a
 * própria pessoa que está saindo. Oferecer alguém já desativado passaria a
 * carteira para outro silêncio.
 */
export function transferCandidates<T extends DeactivatablePerson>(
  users: T[],
  leaving: DeactivatablePerson | null,
): T[] {
  return users.filter(u => u.id !== leaving?.id && !u.deactivated);
}

/**
 * Quem este cargo pode desativar. O gestor desativa CORRETOR; gestor e
 * administrador só o administrador desativa.
 *
 * A mesma régua roda no servidor — esta aqui existe para a tela não oferecer um
 * botão que a API vai recusar, que é o defeito mais caro deste tipo de recorte.
 */
export function canDeactivate(
  actor: DeactivatablePerson | null,
  target: DeactivatablePerson | null,
): boolean {
  if (!actor || !target) return false;
  if (actor.id === target.id) return false;

  const actorRole = actor.chave_role ?? actor.role?.chave_role ?? actor.role?.key;
  const targetRole = target.chave_role ?? target.role?.chave_role ?? target.role?.key;

  if (actorRole === 'admin' || actorRole === 'administrator') return true;

  return targetRole === 'agent';
}

const roleOf = (p: DeactivatablePerson) => p.chave_role ?? p.role?.chave_role ?? p.role?.key;
const isAdminRole = (role: string | undefined) => role === 'admin' || role === 'administrator';

/**
 * Esta pessoa é o ÚLTIMO administrador ativo da equipe?
 *
 * A proteção existe por um motivo só: sem administrador, ninguém religa
 * ninguém. Mas ela contava só quem está NA LISTA — e a Leal Mídia é
 * administradora de todo CRM, escondida da lista de propósito. Resultado: no
 * cliente com um administrador só (a maioria), NINGUÉM conseguia desativá-lo,
 * nem a Leal Mídia, e a tela ainda dizia "seu cargo não permite". Com a Leal
 * Mídia clicando, sempre há outro administrador para religar: a proteção não
 * se aplica.
 *
 * Para o administrador do cliente a régua continua: ele não desativa o único
 * outro administrador sem promover alguém antes.
 */
export function isLastActiveAdmin(
  target: DeactivatablePerson,
  members: DeactivatablePerson[],
  options: { actorIsPlatformOwner?: boolean } = {},
): boolean {
  if (options.actorIsPlatformOwner) return false;
  if (!isAdminRole(roleOf(target))) return false;
  // Quem já está desativado não é "o último ativo" de nada: contá-lo aqui
  // barraria o *Excluir cadastro* de um administrador desativado por engano.
  if (target.deactivated) return false;

  const admins = members.filter(m => isAdminRole(roleOf(m)) && !m.deactivated);
  return admins.length <= 1;
}

export const ROLE_REFUSAL = 'Seu cargo não permite desativar esta pessoa.';
export const SELF_REFUSAL = 'Você não pode desativar o seu próprio acesso.';
export const LAST_ADMIN_REFUSAL =
  'É o único administrador ativo: sem ele ninguém religa ninguém. Promova outra pessoa a administrador antes.';

/**
 * Por que o botão *Desativar* está desligado para esta pessoa — ou null quando
 * ela pode ser desativada.
 *
 * Devolve a FRASE, não um booleano: a tela mostrava "seu cargo não permite"
 * para todo bloqueio, inclusive o do último administrador, e mandava procurar o
 * problema no cargo errado.
 */
export function deactivationRefusal(
  actor: DeactivatablePerson | null,
  target: DeactivatablePerson | null,
  members: DeactivatablePerson[],
  options: { actorIsPlatformOwner?: boolean } = {},
): string | null {
  if (!actor || !target) return ROLE_REFUSAL;
  if (actor.id === target.id) return SELF_REFUSAL;
  if (!canDeactivate(actor, target)) return ROLE_REFUSAL;
  if (isLastActiveAdmin(target, members, options)) return LAST_ADMIN_REFUSAL;
  return null;
}

export const ERASE_UNKNOWN =
  'O servidor ainda não sabe dizer se este cadastro pode ser apagado. Tente de novo em alguns minutos.';

/**
 * O *Excluir cadastro* apaga DE VERDADE, e só o cadastro que nunca foi usado.
 * Quem sabe se ele foi usado é o SERVIDOR (ele conta leads, conversas,
 * mensagens, ofertas…); a tela só traduz o veredito.
 *
 * Sem veredito (servidor antigo, prévia que falhou) a resposta é NÃO. Oferecer
 * o botão no escuro e deixar o servidor recusar no clique seria aceitável;
 * oferecer e o servidor antigo APAGAR alguém com histórico, não — e é isso
 * que a versão antiga do endpoint fazia.
 */
export function eraseVerdict(preview: DeactivationPreview | null): { allowed: boolean; reason: string | null } {
  const verdict = preview?.erase;
  if (!verdict) return { allowed: false, reason: ERASE_UNKNOWN };
  if (verdict.allowed) return { allowed: true, reason: null };
  return { allowed: false, reason: verdict.reason || 'Este cadastro já foi usado e não pode ser apagado. Use Desativar.' };
}
