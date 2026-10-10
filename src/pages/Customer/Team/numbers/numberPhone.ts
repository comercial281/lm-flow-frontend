import { usersService } from '@/services/users';
import { apiErrorMessage } from '@/utils/apiHelpers';
import type { LinkSent } from './NumberCreatedSummary';

/* Telefone e envio do link, compartilhados pelo "Criar número para {nome}" e pelo
   "Adicionar pessoa" — para a regra de normalização existir num lugar só. */

export const digitsOf = (v?: string | null) => (v ?? '').replace(/\D/g, '');

/** Tira o 55 do país: o campo e o envio do link trabalham com DDD + número. */
export const national = (v?: string | null) => {
  const d = digitsOf(v);
  return d.startsWith('55') && (d.length === 12 || d.length === 13) ? d.slice(2) : d;
};

export const validPhone = (v: string) => v.length === 10 || v.length === 11;

/** O que o servidor espera em `phone_number`: país + DDD + número. */
export const toApiPhone = (nationalPhone: string) => `55${nationalPhone}`;

export const qrPath = (inboxId: string) => `/channels/${inboxId}/settings?tab=configuration&connect=1`;

export interface LinkOutcome { state: LinkSent; error?: string }

/** Manda o link de acesso para o celular. Nunca lança: falha vira `error`. */
export async function sendAccessLink(userId: string, celular: string): Promise<LinkOutcome> {
  try {
    const res = await usersService.sendAccess(userId, { whatsapp_number: celular });
    const wa = res.whatsapp;
    if (wa?.sent) return { state: 'sent' };
    if (wa?.error) return { state: 'error', error: wa.error };
    return { state: 'skipped', error: wa?.skipped };
  } catch (e) {
    return { state: 'error', error: apiErrorMessage(e, 'Não consegui enviar o link agora.') };
  }
}
