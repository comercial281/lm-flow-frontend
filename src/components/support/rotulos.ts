import type { SupportKind, SupportStatus } from '@/services/support/supportService';

export const KIND_LABEL: Record<SupportKind, string> = {
  question: 'Dúvida',
  bug: 'Bug',
  suggestion: 'Sugestão',
};

/** O nome da situação muda de lado: "Aguardando você" pro cliente, "Aguardando cliente" pro time. */
export const STATUS_CLIENTE: Record<SupportStatus, string> = {
  open: 'Aberto',
  waiting_customer: 'Aguardando você',
  resolved: 'Resolvido',
};

export const STATUS_TIME: Record<SupportStatus, string> = {
  open: 'Aberto',
  waiting_customer: 'Aguardando cliente',
  resolved: 'Resolvido',
};

export function quandoFoi(iso: string, agora: Date = new Date()): string {
  const quando = new Date(iso);
  const min = Math.floor((agora.getTime() - quando.getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const mesmoDia = quando.toDateString() === agora.toDateString();
  if (mesmoDia) return `há ${Math.floor(min / 60)} h`;
  const ontem = new Date(agora);
  ontem.setDate(agora.getDate() - 1);
  if (quando.toDateString() === ontem.toDateString()) return 'ontem';
  return quando.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
