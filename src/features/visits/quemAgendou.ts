import type { Visit } from '@/services/visits/visitsService';

export type QuemAgendou = { tipo: 'ia' | 'pessoa'; rotulo: string };

// Quem criou a visita. null = autor desconhecido (servidor antigo): sem ícone.
export function quemAgendou(v: Pick<Visit, 'booked_by' | 'created_by'>): QuemAgendou | null {
  if (v.booked_by === 'ia') return { tipo: 'ia', rotulo: 'Agendada pela IA Vendedora' };
  if (v.booked_by === 'pessoa') {
    const nome = v.created_by?.name?.trim();
    return { tipo: 'pessoa', rotulo: nome ? `Agendada por ${nome}` : 'Agendada por alguém do time' };
  }
  return null;
}
