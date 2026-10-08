// O ÚNICO sinal de urgência do card do quadro (spec funil §4.4), por ordem:
// tarefa atrasada > tarefa vence hoje > visita de hoje ou amanhã > "Nd sem
// contato". Card ganho ou perdido saiu dos alertas: não acusa "sem contato".
import { quandoAcontece } from '@/lib/formato';
import { situacaoDe } from '@/features/pipelines/situacao/situacao';
import type { PipelineItem } from '@/types/analytics';
import { lastContactMs } from '../pipelineItemHelpers';

export type TomDoSinal = 'perigo' | 'aviso' | 'info';
export type TipoDoSinal = 'tarefaAtrasada' | 'tarefaHoje' | 'visita' | 'semContato';
export interface SinalDoCard {
  tipo: TipoDoSinal;
  texto: string;
  tom: TomDoSinal;
}

const DIA_MS = 86_400_000;
const inicioDoDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function sinalDoCard(
  item: PipelineItem,
  visitsByContact: Record<string, string>,
  agora: Date = new Date(),
): SinalDoCard | null {
  const atrasadas = item.tasks_info?.overdue_count ?? 0;
  if (atrasadas > 0) {
    return { tipo: 'tarefaAtrasada', texto: atrasadas > 1 ? `${atrasadas} tarefas atrasadas` : 'Tarefa atrasada', tom: 'perigo' };
  }
  if ((item.tasks_info?.due_today_count ?? 0) > 0) return { tipo: 'tarefaHoje', texto: 'Tarefa vence hoje', tom: 'aviso' };

  const contatoId = item.contact?.id ?? item.conversation?.contact?.id;
  const visita = contatoId ? visitsByContact[contatoId] : undefined;
  if (visita) {
    const quando = new Date(visita);
    const hoje = inicioDoDia(agora);
    if (!Number.isNaN(quando.getTime()) && quando.getTime() >= hoje && quando.getTime() < hoje + 2 * DIA_MS) {
      const frase = quandoAcontece(quando, agora); // "Hoje às 14:30" / "Amanhã às 10:00"
      return { tipo: 'visita', texto: `Visita ${frase.charAt(0).toLowerCase()}${frase.slice(1)}`, tom: 'info' };
    }
  }

  if (situacaoDe(item) !== 'open') return null;
  const ms = lastContactMs(item);
  if (ms == null) return null;
  const dias = Math.floor((agora.getTime() - ms) / DIA_MS);
  if (dias < 3) return null;
  return { tipo: 'semContato', texto: `${dias}d sem contato`, tom: dias >= 7 ? 'perigo' : 'aviso' };
}
