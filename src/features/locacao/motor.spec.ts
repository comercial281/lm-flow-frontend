import { describe, expect, it } from 'vitest';
import { addDays, addMonths, aluguelEm, diff, extenso, fimContrato, fracao, periodoDe, prorataAluguel, proximoAniversario } from './motor';

describe('datas da locação', () => {
  it('soma meses sem estourar o fim do mês', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
    expect(addMonths('2026-03-10', -3)).toBe('2025-12-10');
  });

  it('soma dias e conta a diferença', () => {
    expect(addDays('2026-02-27', 3)).toBe('2026-03-02');
    expect(diff('2026-11-01', '2026-11-30')).toBe(29);
    expect(diff('2026-11-30', '2026-11-01')).toBe(-29);
  });

  it('o contrato termina um dia antes de completar os meses', () => {
    expect(fimContrato('2026-11-04', 30)).toBe('2029-05-03');
    expect(fimContrato('2026-01-01', 12)).toBe('2026-12-31');
  });

  it('o reajuste é um ano depois do início ou do último reajuste', () => {
    expect(proximoAniversario(null, '2026-03-10')).toBe('2027-03-10');
    expect(proximoAniversario('2027-03-10', '2026-03-10')).toBe('2028-03-10');
  });
});

describe('aluguel por dia', () => {
  const hist = [
    { desde: '2026-01-01', valor: 3000 },
    { desde: '2026-07-01', valor: 3300 },
  ];
  it('usa o valor que valia no dia', () => {
    expect(aluguelEm(hist, '2026-06-30')).toBe(3000);
    expect(aluguelEm(hist, '2026-07-01')).toBe(3300);
  });
  it('mês cheio dá o aluguel; meio mês dá a proporção dos dias', () => {
    expect(prorataAluguel([{ desde: '2026-11-01', valor: 3000 }], '2026-11-01', '2026-11-30')).toBe(3000);
    expect(prorataAluguel([{ desde: '2026-11-01', valor: 3000 }], '2026-11-16', '2026-11-30')).toBe(1500);
    expect(fracao('2026-11-01', '2026-11-30')).toBeCloseTo(1, 6);
  });
});

describe('período que o boleto cobra', () => {
  it('mês vencido: o boleto de dezembro cobra novembro', () => {
    expect(periodoDe({ inicio: '2026-01-01', cobranca: 'vencido' }, '2026-12')).toEqual({ ini: '2026-11-01', fim: '2026-11-30' });
  });
  it('mês adiantado: o boleto de dezembro cobra dezembro', () => {
    expect(periodoDe({ inicio: '2026-01-01', cobranca: 'antecipado' }, '2026-12')).toEqual({ ini: '2026-12-01', fim: '2026-12-31' });
  });
  it('começa no dia do início quando o contrato entra no meio do mês', () => {
    expect(periodoDe({ inicio: '2026-11-16', cobranca: 'vencido' }, '2026-12')).toEqual({ ini: '2026-11-16', fim: '2026-11-30' });
  });
  it('antes do início não há o que cobrar; depois da saída, corta', () => {
    expect(periodoDe({ inicio: '2026-11-16', cobranca: 'vencido' }, '2026-11')).toBeNull();
    expect(periodoDe({ inicio: '2026-01-01', cobranca: 'vencido', saida: '2026-11-10' }, '2026-12')).toEqual({ ini: '2026-11-01', fim: '2026-11-10' });
  });
});

describe('valor por extenso', () => {
  it('escreve reais e centavos', () => {
    expect(extenso(2800)).toBe('dois mil e oitocentos reais');
    expect(extenso(1)).toBe('um real');
    expect(extenso(1.5)).toBe('um real e cinquenta centavos');
    expect(extenso(100)).toBe('cem reais');
    expect(extenso(0)).toBe('zero real');
    expect(extenso(1250)).toBe('mil duzentos e cinquenta reais');
    expect(extenso(30)).toBe('trinta reais');
    expect(extenso(2000000)).toBe('dois milhões de reais');
  });
});
