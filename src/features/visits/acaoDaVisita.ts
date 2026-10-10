// src/features/visits/acaoDaVisita.ts
import type { Visit } from '@/services/visits/visitsService';

/** Os diálogos da Agenda que agem sobre uma visita. */
export type AcaoDaVisita = 'complete' | 'cancel' | 'retorno';

/**
 * Qual diálogo abre quando a pessoa chega numa visita.
 *
 * - `clique`: clicou na pílula do calendário. Agendada/Confirmada/Em andamento
 *   (e Reagendada, desde 10/10) abrem o resumo da visita, com Confirmar / Realizada / Cancelar (desde
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
    return ['scheduled', 'confirmed', 'in_progress', 'rescheduled'].includes(visita.status) ? 'resumo' : null;
  }
  const passou = new Date(visita.scheduled_at) < agora;
  return passou && (visita.status === 'scheduled' || visita.status === 'confirmed') ? 'complete' : null;
}

/** A visita já tem nota ou comentário (o que tira ela de "Visitas sem feedback"). */
export function temRetorno(visita: Pick<Visit, 'rating' | 'feedback_notes'>): boolean {
  return !!visita.rating || !!visita.feedback_notes?.trim();
}

const ABERTAS = new Set(['scheduled', 'confirmed', 'in_progress', 'rescheduled']);

/** Momento da visita para os botões: antes do horário, depois (sem retorno) ou encerrada. */
export type FaseDaVisita = 'antes' | 'depois' | 'encerrada';

export function faseDaVisita(
  visita: Pick<Visit, 'status' | 'scheduled_at' | 'cancelled_at'>,
  agora: Date = new Date(),
): FaseDaVisita {
  if (!ABERTAS.has(visita.status) || visita.cancelled_at) return 'encerrada';
  return new Date(visita.scheduled_at) <= agora ? 'depois' : 'antes';
}

export type BotaoDaVisita = 'confirmar' | 'remarcar' | 'cancelar' | 'nao_compareceu' | 'realizada' | 'retorno';
export interface PodeNaVisita { confirmar: boolean; remarcar: boolean; cancelar: boolean; concluir: boolean }

/**
 * Botões da visita, na ordem da tela (desenho fechado com o Tony em 10/10):
 * antes do horário Remarcar | Cancelar (+ Confirmar); depois Não compareceu |
 * Remarcar + REALIZADA em destaque; encerrada só "Dar retorno" (realizada sem retorno).
 */
export function botoesDaVisita(
  visita: Pick<Visit, 'status' | 'scheduled_at' | 'cancelled_at' | 'rating' | 'feedback_notes'>,
  pode: PodeNaVisita,
  agora: Date = new Date(),
): BotaoDaVisita[] {
  const fase = faseDaVisita(visita, agora);
  const out: BotaoDaVisita[] = [];
  if (fase === 'antes') {
    if (pode.remarcar) out.push('remarcar');
    if (pode.cancelar) out.push('cancelar');
    if (pode.confirmar && (visita.status === 'scheduled' || visita.status === 'rescheduled')) out.push('confirmar');
  } else if (fase === 'depois') {
    if (pode.concluir) out.push('nao_compareceu');
    if (pode.remarcar) out.push('remarcar');
    if (pode.concluir) out.push('realizada');
  } else if (visita.status === 'completed' && pode.concluir && !temRetorno(visita)) {
    out.push('retorno');
  }
  return out;
}
