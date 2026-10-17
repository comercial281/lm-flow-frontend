import { terminaPorVoltaDe } from '@/lib/formato';
import type { BroadcastPace } from '@/services/broadcasts/broadcastsService';

// Os 3 pacotes de ritmo do disparo (valores de intervalo, lote e pausa moram no servidor).

export const PACOTES: { valor: BroadcastPace; rotulo: string; descricao: string }[] = [
  { valor: 'fast', rotulo: 'Rápido', descricao: '30 a 50 segundos entre mensagens, pausa de 5 min a cada 10' },
  { valor: 'normal', rotulo: 'Normal', descricao: '1 a 2 minutos entre mensagens, pausa de 10 min a cada 10' },
  { valor: 'slow', rotulo: 'Devagar', descricao: '2 a 4 minutos entre mensagens, pausa de 20 min a cada 10' },
];

export const LISTA_GRANDE = 100;

export function rotuloDoPacote(pace: BroadcastPace): string {
  return PACOTES.find(p => p.valor === pace)?.rotulo ?? '';
}

/** "termina amanhã por volta das 15h" do pacote, ou null quando o servidor não mandou a previsão. */
export function previsaoDoPacote(eta: Partial<Record<BroadcastPace, string>>, pace: BroadcastPace): string | null {
  const iso = eta[pace];
  return iso ? terminaPorVoltaDe(iso) : null;
}
