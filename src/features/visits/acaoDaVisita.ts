// src/features/visits/acaoDaVisita.ts
import type { Visit } from '@/services/visits/visitsService';

/** Os diálogos da Agenda que agem sobre uma visita. */
export type AcaoDaVisita = 'complete' | 'cancel' | 'retorno';

/**
 * Qual diálogo abre quando a pessoa chega numa visita.
 *
 * - `clique`: clicou na pílula do calendário. Agendada/Confirmada/Em andamento
 *   abrem o resumo da visita, com Confirmar / Realizada / Cancelar (desde
 *   07/10: antes abria direto "realizada", e no calendário não havia como
 *   cancelar). Realizada abre "Dar retorno", senão a pendência "Visitas sem
 *   feedback" da Dashboard nunca baixa.
 * - `link`: veio pelo `?visita=` da Dashboard. O link MOSTRA a visita; só abre
 *   diálogo quando falta registrar algo: Agendada/Confirmada que já passou
 *   (realizada) ou Realizada (retorno). Visita futura nunca abre "realizada" por
 *   link: grava e dispara automação.
 *
 * `resumo` = o card da visita com os botões. `null` = nenhum diálogo (o clique
 * mostra o aviso com a situação).
 */
export function acaoDaVisita(
  visita: Pick<Visit, 'status' | 'scheduled_at'>,
  origem: 'clique' | 'link',
  agora: Date = new Date(),
): 'complete' | 'retorno' | 'resumo' | null {
  if (visita.status === 'completed') return 'retorno';
  if (origem === 'clique') {
    return ['scheduled', 'confirmed', 'in_progress'].includes(visita.status) ? 'resumo' : null;
  }
  const passou = new Date(visita.scheduled_at) < agora;
  return passou && (visita.status === 'scheduled' || visita.status === 'confirmed') ? 'complete' : null;
}

/** A visita já tem nota ou comentário (o que tira ela de "Visitas sem feedback"). */
export function temRetorno(visita: Pick<Visit, 'rating' | 'feedback_notes'>): boolean {
  return !!visita.rating || !!visita.feedback_notes?.trim();
}
