// FAIXA "TERMINANDO NO FORMATO ANTIGO" (Automações · sprint 3, spec 03/10/2026, seção 1).
//
// Quem já estava na fila de um funil antigo termina nele: o funil continua
// ativo até a fila zerar (desativar cancelaria a fila). A aba Follow-up mostra,
// só pra ver, os funis que ainda têm mensagem programada. A contagem é o
// `queued_count` de cada funil em `GET /followup_sequences`. A faixa some
// quando a fila zera.

import { plural } from '@/lib/formato';

export interface LegacyQueue {
  id: string;
  name: string;
  pending: number;
}

export function legacyQueueLine(queue: LegacyQueue): string {
  return `${queue.name} — ${plural(queue.pending, 'mensagem programada', 'mensagens programadas')}`;
}

/** Só os funis com fila, do maior pro menor. */
export function legacyQueuesWithPending(queues: LegacyQueue[]): LegacyQueue[] {
  return queues.filter(q => q.pending > 0).sort((a, b) => b.pending - a.pending);
}
