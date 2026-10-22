import { describe, it, expect } from 'vitest';
import { mensagemDaColunaDeFollowup } from './erroDeEtapa';

const erro = (details: unknown) => ({ response: { status: 422, data: { error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details } } } });

describe('mensagemDaColunaDeFollowup', () => {
  it('tira o nome do campo da frente da frase do servidor', () => {
    expect(mensagemDaColunaDeFollowup(erro([
      'Stage type Tem lead em follow-up nesta coluna. Pare os follow-ups ou mova os cards antes.',
    ]))).toBe('Tem lead em follow-up nesta coluna. Pare os follow-ups ou mova os cards antes.');
  });

  it('outro erro de validação ou erro sem details não vira essa frase', () => {
    expect(mensagemDaColunaDeFollowup(erro(["Name can't be blank"]))).toBeNull();
    expect(mensagemDaColunaDeFollowup(erro(undefined))).toBeNull();
    expect(mensagemDaColunaDeFollowup(new Error('rede'))).toBeNull();
  });
});
