import type { LogItem, LogPeriod } from '@/types/admin/logs';

const CATEGORIAS: Record<string, string> = {
  auth: 'Acesso', admin: 'Admin', contact: 'Contato', conversation: 'Conversa', lead: 'Lead',
  pipeline: 'Funil', channel: 'Número de WhatsApp', automation: 'Automação', request: 'Ação no sistema',
  message: 'Mensagem',
};

export const rotuloCategoria = (c: string): string => CATEGORIAS[c] ?? c;

export const OPCOES_PERIODO: { valor: LogPeriod; rotulo: string }[] = [
  { valor: '', rotulo: 'Todo o período' },
  { valor: '24h', rotulo: 'Últimas 24 horas' },
  { valor: '7d', rotulo: 'Últimos 7 dias' },
  { valor: '30d', rotulo: 'Últimos 30 dias' },
  { valor: '90d', rotulo: 'Últimos 90 dias' },
  { valor: '12m', rotulo: 'Últimos 12 meses' },
];

/** Quem fez: nome, senão e-mail, senão "Sistema" (evento sem pessoa). */
export function quemFez(i: Pick<LogItem, 'actor_name' | 'actor_email' | 'actor_type'>): string {
  if (i.actor_type === 'ChaveSaaS') return 'Chave SaaS';
  return i.actor_name || i.actor_email || 'Sistema';
}
