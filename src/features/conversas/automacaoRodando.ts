import { dataCurta, hora, toDate } from '@/lib/formato';
import type { RunningFlow } from '@/services/flowAutomations/flowAutomationInstancesService';
import type { LeadFollowupState } from '@/services/leadFollowup/leadFollowupService';

/**
 * As linhas da faixa "tem mensagem automática programada pra este lead",
 * acima do campo de mensagem (03/10/2026). Fluxo do construtor e follow-up
 * aparecem juntos: pra quem atende é a mesma coisa.
 */
export interface LinhaAutomatica {
  key: string;
  tipo: 'fluxo' | 'followup';
  /** Fluxo: id da instância. Follow-up: vazio (para pelo lead). */
  id: string;
  texto: string;
  podeParar: boolean;
}

/** "14:32" hoje; "04/10 às 9:00" em outro dia. */
export function quando(valor: unknown, agora: Date = new Date()): string {
  const d = toDate(valor);
  if (!d) return '';
  const mesmoDia =
    d.getFullYear() === agora.getFullYear() && d.getMonth() === agora.getMonth() && d.getDate() === agora.getDate();
  return mesmoDia ? hora(d) : `${dataCurta(d)} às ${hora(d)}`;
}

export function linhaDoFluxo(fluxo: RunningFlow, agora: Date = new Date()): LinhaAutomatica {
  const nome = fluxo.flow_name ? `Fluxo "${fluxo.flow_name}"` : 'Fluxo';
  let fase = 'em andamento';
  if (fluxo.phase === 'waiting_reply') {
    fase = fluxo.until ? `aguardando resposta até ${quando(fluxo.until, agora)}` : 'aguardando resposta, sem limite';
  } else if (fluxo.phase === 'waiting') {
    fase = fluxo.until ? `esperando até ${quando(fluxo.until, agora)}` : 'esperando';
  }
  return { key: `fluxo-${fluxo.id}`, tipo: 'fluxo', id: fluxo.id, texto: `${nome} · ${fase}`, podeParar: fluxo.active };
}

export function linhaDoFollowup(estado: LeadFollowupState, agora: Date = new Date()): LinhaAutomatica | null {
  if (estado.status !== 'running' && estado.status !== 'paused') return null;
  const nome = estado.sequence?.name ? `Follow-up "${estado.sequence.name}"` : 'Follow-up';
  const fase =
    estado.status === 'paused'
      ? 'pausado'
      : estado.next_run_at
        ? `próxima mensagem ${quando(estado.next_run_at, agora).includes('às') ? 'em' : 'às'} ${quando(estado.next_run_at, agora)}`
        : 'em andamento';
  return { key: 'followup', tipo: 'followup', id: '', texto: `${nome} · ${fase}`, podeParar: estado.can_stop };
}

export function linhasAutomaticas(
  fluxos: RunningFlow[],
  followup: LeadFollowupState | null,
  agora: Date = new Date(),
): LinhaAutomatica[] {
  const linhas = fluxos.filter(f => f.active).map(f => linhaDoFluxo(f, agora));
  const fu = followup ? linhaDoFollowup(followup, agora) : null;
  return fu ? [...linhas, fu] : linhas;
}
