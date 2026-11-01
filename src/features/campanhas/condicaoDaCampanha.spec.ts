import { describe, expect, it } from 'vitest';
import { condicaoDaLinha, condicaoParaGravar, resumoDaCondicao, vazioDaCondicao, TETO_DA_OBSERVACAO } from './condicaoDaCampanha';

const imovel = { down_payment_from: 500, installment_from: 1000, min_income: 5000, payment_terms: 'Sinal + mensais' };

describe('condicaoDaLinha', () => {
  it('a linha vence o imóvel', () => {
    const r = condicaoDaLinha({ offer_condition: { down_payment_from: 300 } }, imovel);
    const entrada = r.find((c) => c.campo === 'down_payment_from')!;
    expect(entrada).toMatchObject({ valor: 'R$ 300', de: 'do anúncio' });
  });

  it('vazio na linha vem do imóvel', () => {
    const r = condicaoDaLinha({ offer_condition: { down_payment_from: 300 } }, imovel);
    expect(r.find((c) => c.campo === 'installment_from')).toMatchObject({ valor: 'R$ 1.000', de: 'do imóvel' });
    expect(r.find((c) => c.campo === 'payment_terms')).toMatchObject({ valor: 'Sinal + mensais', de: 'do imóvel' });
  });

  it('vazio nos dois é "não informado" e o corretor simula', () => {
    const r = condicaoDaLinha({ offer_condition: null }, null);
    expect(r).toHaveLength(4);
    r.forEach((c) => expect(c).toMatchObject({ valor: 'não informado', de: 'o corretor simula' }));
  });
});

describe('resumoDaCondicao', () => {
  it('vazia mostra "A do imóvel"', () => {
    expect(resumoDaCondicao(null)).toEqual(['A do imóvel']);
    expect(resumoDaCondicao({ down_payment_from: null, note: '  ' })).toEqual(['A do imóvel']);
  });
  it('lista só o que a linha preencheu', () => {
    expect(resumoDaCondicao({ down_payment_from: 300, payment_terms: 'x', note: 'Feirão' }))
      .toEqual(['Entrada R$ 300', 'Fluxo próprio', 'Observação']);
  });
});

describe('condicaoParaGravar', () => {
  it('tudo vazio vira nulo (sem condição)', () => {
    expect(condicaoParaGravar(vazioDaCondicao())).toBeNull();
  });
  it('converte dinheiro digitado e corta a observação no teto', () => {
    const r = condicaoParaGravar({ ...vazioDaCondicao(), down_payment_from: 'R$ 1.500', installment_from: '900', note: 'a'.repeat(400) });
    expect(r).toMatchObject({ down_payment_from: 1500, installment_from: 900, min_income: null, payment_terms: null });
    expect(r!.note).toHaveLength(TETO_DA_OBSERVACAO);
  });
});
