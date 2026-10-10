import { cargoPayload, type CargoOption } from '../cargoOptions';
import { national } from '../numbers/numberPhone';
import type { DeactivatablePerson } from '@/features/users/deactivation/deactivationRules';
import type { TeamAccessMember } from '@/types/teamAccess';

/* As regras da ficha da pessoa, fora do JSX para terem teste.

   A régua de "quem mexe em quem" é a do servidor (Users::RoleAssignmentGuard):
   quem não é administrador só mexe em corretor ou em si mesmo. Aqui ela só
   decide se a ficha abre editável — a tela não oferece o que a API vai recusar.
   As frases são as mesmas do servidor, para a pessoa ler a mesma explicação
   nos dois lugares. */

export const TARGET_ADMIN_REFUSAL = 'Só o administrador mexe no cadastro de outro administrador.';
export const TARGET_AGENT_ONLY_REFUSAL = 'Seu cargo só mexe no cadastro de corretores.';
export const READ_ONLY_NOTE = 'Seu cargo permite só ver este cadastro.';
export const PHONE_TOO_SHORT = 'Informe o celular com DDD.';

const roleOf = (p: DeactivatablePerson) => p.chave_role ?? p.role?.chave_role ?? p.role?.key;
const isAdminRole = (role: string | undefined) => role === 'admin' || role === 'administrator';

/** Quem está na tela é administrador? (a Leal Mídia sempre é) */
export function viewerIsAdmin(viewer: DeactivatablePerson | null, isPlatformOwner: boolean): boolean {
  return isPlatformOwner || (!!viewer && isAdminRole(roleOf(viewer)));
}

/**
 * Por que quem está na tela NÃO mexe no cadastro desta pessoa — ou null quando
 * mexe. Só o cargo de quem vê e o de quem é visto; a permissão (users.update)
 * é conferida à parte.
 */
export function targetRefusal(
  viewer: DeactivatablePerson | null,
  target: Pick<TeamAccessMember, 'id' | 'role'>,
  isPlatformOwner: boolean,
): string | null {
  if (viewerIsAdmin(viewer, isPlatformOwner)) return null;
  if (viewer && viewer.id === target.id) return null;
  // O cargo escolhido (`key`, o slug) manda sobre o `chave_role`: quem tem o cargo próprio
  // "administrador" pode ter a chave antiga 'agent' sobrando, e a ficha dele tem
  // que abrir só leitura para quem não é admin.
  const slug = target.role?.key;
  if (isAdminRole(slug) || slug === 'administrador') return TARGET_ADMIN_REFUSAL;
  const role = target.role?.chave_role ?? target.role?.key;
  if (isAdminRole(role)) return TARGET_ADMIN_REFUSAL;
  if (role === 'agent' && slug !== 'gerente') return null;
  return TARGET_AGENT_ONLY_REFUSAL;
}

/** Celular vazio vale (tira o número); preenchido precisa de DDD. */
export function phoneIsValid(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 0 || digits.length >= 10;
}

export interface PersonDraft {
  name: string;
  phone: string;
  cargo: CargoOption | null;
}

/**
 * O PATCH /users/:id com SÓ o que mudou. Mandar o cargo sem mudança não é
 * recusado pelo servidor, mas ressincroniza o cargo de quem salva como
 * administrador — e mandar o celular sem mudança regravaria o número.
 */
export function buildUserPatch(
  member: Pick<TeamAccessMember, 'name' | 'whatsapp_number'>,
  draft: PersonDraft,
  initialCargoKey: string | null,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const name = draft.name.trim();
  if (name && name !== member.name.trim()) patch.name = name;
  // Compara pelos dígitos nacionais: o campo da ficha trabalha sem o 55, e o
  // cadastro pode tê-lo — sem isso, abrir e salvar regravaria o mesmo celular.
  const phone = national(draft.phone);
  if (phone !== national(member.whatsapp_number)) patch.whatsapp_number = phone;
  if (draft.cargo && draft.cargo.key !== initialCargoKey) Object.assign(patch, cargoPayload(draft.cargo));
  return patch;
}

/** Os números liberados que entram e saem, comparando com o que ela tinha. */
export function liberatedDiff(initial: string[], draft: string[]): { add: string[]; remove: string[] } {
  const antes = new Set(initial);
  const depois = new Set(draft);
  return {
    add: draft.filter(id => !antes.has(id)),
    remove: initial.filter(id => !depois.has(id)),
  };
}
