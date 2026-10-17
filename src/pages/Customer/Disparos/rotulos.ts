// Rótulos que a lista de Disparos e a monitoria de um disparo dividem.
import type { BroadcastCampaign } from '@/services/broadcasts/broadcastsService';

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
  if (c.mode === 'template') return 'Modelo oficial';
  return 'Mensagem';
}
