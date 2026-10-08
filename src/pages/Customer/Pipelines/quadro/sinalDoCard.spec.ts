// src/pages/Customer/Pipelines/quadro/sinalDoCard.spec.ts
import { describe, expect, it } from 'vitest';
import type { PipelineItem } from '@/types/analytics';
import { sinalDoCard } from './sinalDoCard';

const AGORA = new Date(2026, 9, 7, 9, 0);
const DIA = 86_400_000;
const seg = (ms: number) => Math.floor(ms / 1000);

const card = (extra: Record<string, unknown> = {}) =>
  ({
    id: 'i1', status: 'open', contact: { id: 'c1', name: 'Maria' },
    tasks_info: { pending_count: 0, overdue_count: 0, due_soon_count: 0, completed_count: 0, total_count: 0 },
    ...extra,
  }) as unknown as PipelineItem;

const semContatoHa = (dias: number) => ({ conversation: { last_activity_at: seg(AGORA.getTime() - dias * DIA) } });
const visitaHoje = { c1: new Date(2026, 9, 7, 14, 30).toISOString() };
const visitaAmanha = { c1: new Date(2026, 9, 8, 10, 0).toISOString() };
const visitaDepois = { c1: new Date(2026, 9, 10, 10, 0).toISOString() };

describe('o único sinal do card do quadro', () => {
  it('prioridade: tarefa atrasada > vence hoje > visita > sem contato', () => {
    const tudo = card({ tasks_info: { overdue_count: 1, due_today_count: 2 }, ...semContatoHa(10) });
    expect(sinalDoCard(tudo, visitaHoje, AGORA)).toEqual({ tipo: 'tarefaAtrasada', texto: 'Tarefa atrasada', tom: 'perigo' });

    const hoje = card({ tasks_info: { overdue_count: 0, due_today_count: 1 }, ...semContatoHa(10) });
    expect(sinalDoCard(hoje, visitaHoje, AGORA)).toEqual({ tipo: 'tarefaHoje', texto: 'Tarefa vence hoje', tom: 'aviso' });

    expect(sinalDoCard(card(semContatoHa(10)), visitaHoje, AGORA)).toEqual({ tipo: 'visita', texto: 'Visita hoje às 14:30', tom: 'info' });
    expect(sinalDoCard(card(semContatoHa(10)), visitaAmanha, AGORA)?.texto).toBe('Visita amanhã às 10:00');
    expect(sinalDoCard(card(semContatoHa(10)), visitaDepois, AGORA)).toEqual({ tipo: 'semContato', texto: '10d sem contato', tom: 'perigo' });
  });

  it('várias tarefas atrasadas dizem quantas', () => {
    expect(sinalDoCard(card({ tasks_info: { overdue_count: 3 } }), {}, AGORA)?.texto).toBe('3 tarefas atrasadas');
  });

  it('sem contato: a partir de 3 dias; aviso até 6, perigo de 7 em diante', () => {
    expect(sinalDoCard(card(semContatoHa(2)), {}, AGORA)).toBeNull();
    expect(sinalDoCard(card(semContatoHa(4)), {}, AGORA)).toEqual({ tipo: 'semContato', texto: '4d sem contato', tom: 'aviso' });
  });

  it('card ganho ou perdido não acusa "sem contato" (saiu dos alertas)', () => {
    expect(sinalDoCard(card({ status: 'lost', ...semContatoHa(30) }), {}, AGORA)).toBeNull();
  });

  it('sem nada, sem sinal (e sem tasks_info também)', () => {
    expect(sinalDoCard(card({ tasks_info: undefined }), {}, AGORA)).toBeNull();
  });
});
