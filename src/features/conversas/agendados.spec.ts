import { describe, expect, it, vi } from 'vitest';
import {
  EVENTO_AGENDADOS_MUDARAM,
  agendadosPendentes,
  avisarAgendadosMudaram,
  resumoDoAgendamento,
} from './agendados';
import type { ScheduledAction } from '@/types/automation';

const acao = (extra: Partial<ScheduledAction>): ScheduledAction =>
  ({
    id: 'a',
    action_type: 'send_message',
    status: 'scheduled',
    scheduled_for: '2026-10-05T09:00:00-03:00',
    payload: {},
    created_by: 'u',
    retry_count: 0,
    max_retries: 3,
    ...extra,
  }) as ScheduledAction;

describe('resumoDoAgendamento', () => {
  it('texto: os primeiros 60 caracteres, numa linha só', () => {
    const longo = 'Oi, João! Passando pra lembrar da visita ao apartamento\namanhã às 10h, tudo certo?';
    const r = resumoDoAgendamento(acao({ payload: { funnel_items: [{ kind: 'text', text_content: longo }] } }));
    expect(r.endsWith('…')).toBe(true);
    expect(r).not.toContain('\n');
    expect(r.length).toBeLessThanOrEqual(61);
    expect(r.startsWith('Oi, João! Passando pra lembrar')).toBe(true);
  });

  it('mídia vira o tipo, com a legenda quando há', () => {
    expect(resumoDoAgendamento(acao({ payload: { funnel_items: [{ kind: 'image' }] } }))).toBe('Imagem');
    expect(resumoDoAgendamento(acao({ payload: { funnel_items: [{ kind: 'audio' }] } }))).toBe('Áudio');
    expect(
      resumoDoAgendamento(acao({ payload: { funnel_items: [{ kind: 'video', media_caption: 'Tour do decorado' }] } })),
    ).toBe('Vídeo: Tour do decorado');
  });

  it('sequência ganha (+N) e espera não conta', () => {
    const r = resumoDoAgendamento(
      acao({
        payload: {
          funnel_items: [
            { kind: 'text', text_content: 'Bom dia!' },
            { kind: 'delay' },
            { kind: 'image' },
            { kind: 'audio' },
          ],
        },
      }),
    );
    expect(r).toBe('Bom dia! (+2)');
  });

  it('agendamento antigo (message solto) e vazio', () => {
    expect(resumoDoAgendamento(acao({ payload: { message: 'Oi' } }))).toBe('Oi');
    expect(resumoDoAgendamento(acao({ payload: { media_type: 'audio', media_url: 'x' } }))).toBe('Áudio');
    expect(resumoDoAgendamento(acao({ payload: {} }))).toBe('Mensagem');
  });
});

describe('agendadosPendentes', () => {
  it('só mensagem que ainda vai sair, a mais próxima primeiro', () => {
    const lista = [
      acao({ id: 'depois', scheduled_for: '2026-10-06T09:00:00-03:00' }),
      acao({ id: 'saiu', status: 'completed' }),
      acao({ id: 'cancelada', status: 'cancelled' }),
      acao({ id: 'tarefa', action_type: 'create_task' }),
      acao({ id: 'antes', scheduled_for: '2026-10-05T09:00:00-03:00' }),
    ];
    expect(agendadosPendentes(lista).map(a => a.id)).toEqual(['antes', 'depois']);
    expect(agendadosPendentes(null)).toEqual([]);
  });
});

describe('avisarAgendadosMudaram', () => {
  it('avisa no window com o contato', () => {
    const ouvinte = vi.fn();
    window.addEventListener(EVENTO_AGENDADOS_MUDARAM, ouvinte);
    avisarAgendadosMudaram(42);
    window.removeEventListener(EVENTO_AGENDADOS_MUDARAM, ouvinte);
    expect(ouvinte).toHaveBeenCalledTimes(1);
    expect((ouvinte.mock.calls[0][0] as CustomEvent).detail).toEqual({ contactId: '42' });
  });
});
