import { describe, expect, it } from 'vitest';
import { cardFechado, detalheDaSituacao, ehColunaDeGanho, mensagemDaRecusa, situacaoDe } from './situacao';

describe('situação do card', () => {
  // Ajuste de 08/10: a coluna Concluído é a de tipo "Concluída" — o nome não conta.
  it('a coluna do Ganho é a de tipo Concluída', () => {
    expect(ehColunaDeGanho({ stage_type: 'completed' })).toBe(true);
    expect(ehColunaDeGanho({ stage_type: 'active' })).toBe(false);
    expect(ehColunaDeGanho({ stage_type: undefined })).toBe(false);
    expect(ehColunaDeGanho(undefined)).toBe(false);
  });

  it('card sem o campo (payload guardado de antes) conta como aberto', () => {
    expect(situacaoDe({})).toBe('open');
    expect(situacaoDe(null)).toBe('open');
    expect(situacaoDe({ status: 'won' })).toBe('won');
    expect(cardFechado({ status: 'lost' })).toBe(true);
    expect(cardFechado({ status: 'open' })).toBe(false);
  });

  it('o selo explica quando e por quê', () => {
    expect(detalheDaSituacao({ status: 'open' })).toBeNull();
    expect(detalheDaSituacao({ status: 'won', won_at: '2026-10-06T15:00:00Z' })).toBe('Ganho em 06/10/2026');
    expect(
      detalheDaSituacao({ status: 'lost', lost_at: '2026-10-05T15:00:00Z', lost_reason: { id: 'm1', label: 'Adiou a compra' } }),
    ).toBe('Perdido em 05/10/2026 · Adiou a compra');
    expect(detalheDaSituacao({ status: 'lost' })).toBe('Perdido');
  });

  it('a recusa vem no envelope da casa (error.message); sem ela, a frase de reserva', () => {
    expect(mensagemDaRecusa({
      response: { status: 422, data: { success: false, error: { code: 'VALIDATION_ERROR', message: 'Esse motivo foi arquivado. Escolha outro.' } } },
    }, 'reserva')).toBe('Esse motivo foi arquivado. Escolha outro.');
    // Tolerância: corpo com a frase solta em `error` também é lido.
    expect(mensagemDaRecusa({ response: { data: { error: 'Card arquivado não muda de situação.' } } }, 'reserva'))
      .toBe('Card arquivado não muda de situação.');
    expect(mensagemDaRecusa(new Error('Network Error'), 'Não consegui mudar a situação do lead.'))
      .toBe('Não consegui mudar a situação do lead.');
  });
});
