import type { BrokerAssignmentDetail } from '@/services/roletaConfig/brokerAssignmentsService';
import { minutesLeft } from './pendingOffersMatch';

// A roleta SEM prazo de aceite (desde 2026-09-16): a oferta fica com o
// corretor até ele aceitar ou recusar, e nunca expira sozinha.
//
// Como o servidor diz isso: `timeout_minutes === 0` na roleta e na oferta,
// `deadline` e `minutes_remaining` NULOS, e `no_deadline: true`. Quem
// comparasse `deadline` direto veria `new Date(null)` → NaN → "prazo esgotado"
// em todo selo — o oposto do que a chave promete. A tradução mora aqui, num
// lugar só, e nada de comparar zero/nulo espalhado no JSX.

export const SEM_PRAZO = 'sem prazo';

/** A roleta (ou o padrão) gravou "sem prazo"? Zero é a representação. */
export function isNoDeadline(timeoutMinutes: number | null | undefined): boolean {
  return timeoutMinutes != null && Number(timeoutMinutes) <= 0;
}

/** Esta oferta tem cronômetro para desenhar? */
export function hasDeadline(offer: Pick<BrokerAssignmentDetail, 'deadline' | 'no_deadline' | 'timeout_minutes'>): boolean {
  if (offer.no_deadline) return false;
  if (offer.deadline == null) return false;
  return !isNoDeadline(offer.timeout_minutes);
}

/** "12 min" | "prazo esgotado" | "sem prazo" — o sufixo do selo e da faixa. */
export function deadlineLabel(offer: BrokerAssignmentDetail, now: number = Date.now()): string {
  const left = minutesLeft(offer, now);
  if (left === null) return SEM_PRAZO;
  return left > 0 ? `${left} min` : 'prazo esgotado';
}

/** "30 min" | "sem prazo" — como o prazo aparece nos resumos da configuração. */
export function timeoutLabel(timeoutMinutes: number | null | undefined): string | null {
  if (timeoutMinutes == null) return null;
  return isNoDeadline(timeoutMinutes) ? SEM_PRAZO : `${timeoutMinutes} min`;
}
