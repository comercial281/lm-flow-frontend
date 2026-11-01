import { describe, expect, it } from 'vitest';
import { numeroDoCampo, condicaoEmEdicao, condicaoDaLinha, condicaoParaGravar, resumoDaCondicao, vazioDaCondicao, TETO_DA_OBSERVACAO, dinheiro } from './condicaoDaCampanha';

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

describe('dinheiro', () => {
  it('mostra duas casas quando há centavos', () => {
    expect(dinheiro(899.9)).toBe('R$ 899,90');
    expect(dinheiro(1500)).toBe('R$ 1.500');
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
  it('tudo vazio vai com as chaves nulas, nunca null (o servidor descarta o null e a condição antiga ficaria)', () => {
    expect(condicaoParaGravar(vazioDaCondicao())).toEqual({
      down_payment_from: null, installment_from: null, min_income: null, payment_terms: null, note: null,
    });
  });
  it.each([899.9, 1500.5, 15000, 300])('volta completa: %s sai do servidor, passa pelo campo e volta igual', (v) => {
    const campo = condicaoEmEdicao({ installment_from: v });
    expect(condicaoParaGravar(campo).installment_from).toBe(v);
  });
  it('o campo mostra pt-BR (vírgula nos centavos, ponto no milhar)', () => {
    const c = condicaoEmEdicao({ installment_from: 899.9, down_payment_from: 15000, min_income: 1500.5 });
    expect(c).toMatchObject({ installment_from: '899,90', down_payment_from: '15.000', min_income: '1.500,50' });
  });
  it('lê pt-BR: ponto é milhar, vírgula é centavos', () => {
    expect(numeroDoCampo('R$ 1.500,50')).toBe(1500.5);
    expect(numeroDoCampo('15.000')).toBe(15000);
    expect(numeroDoCampo('899,9')).toBe(899.9);
  });
  it('converte dinheiro digitado e corta a observação no teto', () => {
    const r = condicaoParaGravar({ ...vazioDaCondicao(), down_payment_from: 'R$ 1.500', installment_from: '900', note: 'a'.repeat(400) });
    expect(r).toMatchObject({ down_payment_from: 1500, installment_from: 900, min_income: null, payment_terms: null });
    expect(r!.note).toHaveLength(TETO_DA_OBSERVACAO);
  });
});
