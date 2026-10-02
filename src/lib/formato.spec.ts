import { describe, it, expect } from 'vitest';
import { data, dataCurta, hora, dataHora, numero, porcentagem, dinheiro, dolar, plural, telefone, tempoDesde, quandoMudou, toDate, VAZIO, moedaValida } from './formato';

// Espaço não-quebrável: é o que o Intl põe entre "R$" e o número (não quebra linha).
const NB = ' ';

describe('datas', () => {
  const momento = new Date(2026, 8, 30, 14, 32, 10); // 30/09/2026 14:32:10, hora local

  it('formata no padrão brasileiro, hora sempre 24h', () => {
    expect(data(momento)).toBe('30/09/2026');
    expect(dataCurta(momento)).toBe('30/09');
    expect(hora(new Date(2026, 8, 30, 9, 5))).toBe('09:05');
    expect(hora(new Date(2026, 8, 30, 21, 0))).toBe('21:00');
    expect(dataHora(momento)).toBe('30/09/2026 às 14:32');
  });

  it('aceita epoch em segundos, em milissegundos e ISO', () => {
    const ms = momento.getTime();
    expect(data(ms)).toBe('30/09/2026');
    expect(data(Math.floor(ms / 1000))).toBe('30/09/2026');
    expect(data(String(Math.floor(ms / 1000)))).toBe('30/09/2026');
    expect(data(momento.toISOString())).toBe('30/09/2026');
  });

  it('"2026-09-30" puro é o dia 30, não o 29 (meia-noite UTC em São Paulo)', () => {
    expect(data('2026-09-30')).toBe('30/09/2026');
    expect(toDate('2026-09-30')?.getDate()).toBe(30);
  });

  it('vazio ou inválido vira travessão, nunca "Invalid date"', () => {
    for (const ruim of [null, undefined, '', 'amanhã', NaN, new Date('x')]) {
      expect(data(ruim)).toBe(VAZIO);
      expect(dataHora(ruim)).toBe(VAZIO);
      expect(hora(ruim)).toBe(VAZIO);
    }
  });
});

describe('números', () => {
  it('milhar com ponto, decimal com vírgula', () => {
    expect(numero(1234)).toBe('1.234');
    expect(numero(12.345, 1)).toBe('12,3');
    expect(numero('1234.5', 2)).toBe('1.234,5');
  });

  it('porcentagem recebe o valor já em porcento e nunca sai "0.0%"', () => {
    expect(porcentagem(12.5)).toBe('12,5%');
    expect(porcentagem(0)).toBe('0%');
    expect(porcentagem(33.333, 0)).toBe('33%');
    expect(porcentagem(null)).toBe(VAZIO);
  });
});

describe('dinheiro', () => {
  it('R$ com centavos por padrão', () => {
    expect(dinheiro(1234.56)).toBe(`R$${NB}1.234,56`);
    expect(dinheiro(0)).toBe(`R$${NB}0,00`);
    expect(dinheiro(-12.5)).toBe(`-R$${NB}12,50`);
  });

  it('sem centavos pra preço de imóvel', () => {
    expect(dinheiro(450000, { centavos: false })).toBe(`R$${NB}450.000`);
  });

  it('aceita o decimal que a API manda como texto', () => {
    expect(dinheiro('450000.00', { centavos: false })).toBe(`R$${NB}450.000`);
  });

  it('compacto pra painel', () => {
    expect(dinheiro(1_234_567, { compacto: true })).toBe(`R$${NB}1,2 mi`);
    expect(dinheiro(45_300, { compacto: true })).toBe(`R$${NB}45 mil`);
    expect(dinheiro(9_999.5, { compacto: true })).toBe(`R$${NB}9.999,50`);
    expect(dinheiro(-2_000_000, { compacto: true })).toBe(`-R$${NB}2 mi`);
  });

  it('outra moeda do item do funil sai com o símbolo certo, nunca "BRL 1.234,56"', () => {
    expect(dinheiro(1234.56, { moeda: 'USD' })).toBe(`US$${NB}1.234,56`);
    expect(dinheiro(1234.56, { moeda: 'EUR' })).toBe(`€${NB}1.234,56`);
    expect(dinheiro(1234.56, { moeda: 'BRL' })).toBe(`R$${NB}1.234,56`);
  });

  it('vazio, texto ruim e infinito viram travessão, nunca "R$ NaN"', () => {
    for (const ruim of [null, undefined, '', 'abc', Infinity]) expect(dinheiro(ruim)).toBe(VAZIO);
  });

  it('dólar só com formato brasileiro', () => {
    expect(dolar(0)).toBe(`US$${NB}0,00`);
    expect(dolar(1234.5)).toBe(`US$${NB}1.234,50`);
    expect(dolar(0.0012, 4)).toBe(`US$${NB}0,0012`);
    expect(dolar(null)).toBe(VAZIO);
  });

  it('moedaValida aceita só BRL/USD/EUR; qualquer outra coisa vira BRL', () => {
    expect(moedaValida('USD')).toBe('USD');
    expect(moedaValida('EUR')).toBe('EUR');
    expect(moedaValida('BRL')).toBe('BRL');
    expect(moedaValida('XYZ')).toBe('BRL');
    expect(moedaValida('')).toBe('BRL');
    expect(moedaValida(undefined)).toBe('BRL');
  });
});

describe('plural', () => {
  it('escolhe a palavra pela quantidade, nunca "imóvel(is)"', () => {
    expect(plural(1, 'imóvel', 'imóveis')).toBe('1 imóvel');
    expect(plural(0, 'imóvel', 'imóveis')).toBe('0 imóveis');
    expect(plural(3, 'contato', 'contatos')).toBe('3 contatos');
    expect(plural(1234, 'imóvel', 'imóveis')).toBe('1.234 imóveis');
  });
});

describe('telefone', () => {
  it('brasileiro com ou sem 55, celular e fixo', () => {
    expect(telefone('+5511912341234')).toBe('(11) 91234-1234');
    expect(telefone('5511912341234')).toBe('(11) 91234-1234');
    expect(telefone('11912341234')).toBe('(11) 91234-1234');
    expect(telefone('+551133334444')).toBe('(11) 3333-4444');
  });

  it('estrangeiro e lixo voltam como vieram; vazio vira vazio', () => {
    expect(telefone('+1 415 555 0100')).toBe('+1 415 555 0100');
    expect(telefone('123')).toBe('123');
    expect(telefone('5511949329570@s.whatsapp.net')).toBe('(11) 94932-9570'); // o JID do WhatsApp também
    expect(telefone(null)).toBe('');
  });
});

describe('tempoDesde', () => {
  const agora = new Date(2026, 9, 2, 12, 0, 0);
  const atras = (s: number) => new Date(agora.getTime() - s * 1000);
  it('escolhe a unidade pelo tamanho do intervalo', () => {
    expect(tempoDesde(atras(30), agora)).toBe('agora');
    expect(tempoDesde(atras(5 * 60), agora)).toBe('há 5 min');
    expect(tempoDesde(atras(3 * 3600), agora)).toBe('há 3 h');
    expect(tempoDesde(atras(24 * 3600), agora)).toBe('há 1 dia');
    expect(tempoDesde(atras(4 * 86400), agora)).toBe('há 4 dias');
  });
  it('aceita segundos Unix e ISO', () => {
    expect(tempoDesde(Math.floor(atras(3 * 3600).getTime() / 1000), agora)).toBe('há 3 h');
    expect(tempoDesde(atras(5 * 60).toISOString(), agora)).toBe('há 5 min');
  });
  it('entrada inválida vira travessão', () => {
    expect(tempoDesde('lixo', agora)).toBe(VAZIO);
  });
});

describe('quandoMudou', () => {
  const agora = new Date(2026, 9, 2, 15, 0);
  it('hoje mostra a hora, ontem só a palavra', () => {
    expect(quandoMudou(new Date(2026, 9, 2, 9, 5), agora)).toBe('hoje 09:05');
    expect(quandoMudou(new Date(2026, 9, 1, 23, 59), agora)).toBe('ontem');
  });
  it('mesmo ano sem o ano; outro ano com o ano', () => {
    expect(quandoMudou(new Date(2026, 8, 28, 10, 0), agora)).toBe('28/09');
    expect(quandoMudou(new Date(2025, 8, 28, 10, 0), agora)).toBe('28/09/2025');
  });
  it('aceita segundos Unix e vazio vira travessão', () => {
    expect(quandoMudou(Math.floor(new Date(2026, 9, 2, 8, 0).getTime() / 1000), agora)).toBe('hoje 08:00');
    expect(quandoMudou(null, agora)).toBe(VAZIO);
  });
});
