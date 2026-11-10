// Rótulos que a lista de Disparos e a monitoria de um disparo dividem.
import type { BroadcastCampaign } from '@/services/broadcasts/broadcastsService';
import { comecaEm, voltaQuando } from '@/components/pipelines/disparo/agenda';

export const STATUS_META: Record<BroadcastCampaign['status'], { label: string; cls: string }> = {
  running: { label: 'Enviando', cls: 'bg-primary/15 text-primary border-primary/40' },
  paused: { label: 'Pausado', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  completed: { label: 'Concluído', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  cancelled: { label: 'Cancelado', cls: 'bg-muted text-muted-foreground' },
  failed: { label: 'Falhou', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

export const PACOTE: Record<string, string> = { fast: 'Rápido', normal: 'Normal', slow: 'Devagar' };

export function rotuloDoModo(c: Pick<BroadcastCampaign, 'mode' | 'flow_name'>): string {
  if (c.mode === 'flow') return c.flow_name ? `Funil ${c.flow_name}` : 'Funil';
  if (c.mode === 'automation') return c.flow_name ? `Automação ${c.flow_name}` : 'Automação';
  if (c.mode === 'template') return 'Modelo oficial';
  return 'Mensagem';
}

// ── Agendar o início e limite por dia (10/11/2026) ──────────────────────────
// Backend antigo não manda os campos: sem campo, tudo como antes.

const AGENDADO = { label: 'Agendado', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' };

const ENCERRADO: string[] = ['completed', 'cancelled', 'failed'];

/** O selo do estado: "Agendado" enquanto espera o início (pausado fica Pausado); senão o de sempre. */
export function estadoDoDisparo(c: Pick<BroadcastCampaign, 'status' | 'scheduled'>): { label: string; cls: string } {
  if (c.scheduled && c.status !== 'paused' && !ENCERRADO.includes(c.status)) return AGENDADO;
  return STATUS_META[c.status] ?? STATUS_META.completed;
}

/** "começa 24/12 às 09:00" de um disparo que ainda não começou; null nos outros. */
export function linhaDoAgendamento(
  c: Pick<BroadcastCampaign, 'scheduled' | 'starts_at' | 'status'>,
  agora: Date = new Date(),
): string | null {
  if (!c.scheduled || !c.starts_at || ENCERRADO.includes(c.status)) return null;
  const quando = comecaEm(c.starts_at, agora);
  return quando ? `começa ${quando}` : null;
}

/** "Até 20 por dia", ou null sem limite. */
export function rotuloDoLimite(c: Pick<BroadcastCampaign, 'daily_limit'>): string | null {
  return c.daily_limit ? `Até ${c.daily_limit} por dia` : null;
}

/** "Limite de hoje atingido · volta amanhã às 8h", só com o disparo rodando e o limite batido. */
export function linhaDoLimiteBatido(
  c: Pick<BroadcastCampaign, 'daily_limit_reached' | 'status' | 'next_run_at' | 'scheduled'>,
  agora: Date = new Date(),
): string | null {
  if (!c.daily_limit_reached || c.status !== 'running' || c.scheduled) return null;
  const volta = c.next_run_at ? voltaQuando(c.next_run_at, agora) : null;
  return volta ? `Limite de hoje atingido · volta ${volta}` : 'Limite de hoje atingido';
}
