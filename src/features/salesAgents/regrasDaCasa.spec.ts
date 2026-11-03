import { describe, expect, it } from 'vitest';
import { TETO_DE_OBJECOES, TETO_DE_REGRAS, avisoDeProduto, motivoDeRecusa } from './regrasDaCasa';

const FRASE = 'Regras da casa não aceita apresentação: quem a IA é fica na ficha, em Números e usuários.';

describe('regras da casa', () => {
  it('os tetos são os do servidor', () => {
    expect(TETO_DE_REGRAS).toBe(30);
    expect(TETO_DE_OBJECOES).toBe(10);
  });

  it.each([
    'Sou a Thaís, gerente da casa',
    'Fale com calma. Sou a gerente',
    'Meu nome é Ana',
    'meu nome e Ana',
    'Me chamo Ana',
    'Se apresente como consultora',
    'Fale como a Thaís',
  ])('recusa apresentação: %s', (linha) => {
    expect(motivoDeRecusa(linha)).toBe(FRASE);
  });

  it.each([
    'Não diga que sou robô',
    "Se o lead disser 'sou investidor', fale de renda",
    'Nunca prometa aprovação de financiamento',
    'Fale como um consultor, com calma',
  ])('deixa passar: %s', (linha) => {
    expect(motivoDeRecusa(linha)).toBeNull();
  });

  it('linha acima de 200 não passa', () => {
    expect(motivoDeRecusa('a'.repeat(200))).toBeNull();
    expect(motivoDeRecusa('a'.repeat(201))).toBe('Cada regra tem no máximo 200 caracteres.');
  });

  it('valor em reais e código de imóvel dão o aviso de produto', () => {
    const AVISO = 'Condição e imóvel moram no cadastro ou na campanha.';
    expect(avisoDeProduto('Entrada de R$ 500')).toBe(AVISO);
    expect(avisoDeProduto('Sempre ofereça o AB01 primeiro')).toBe(AVISO);
    expect(avisoDeProduto('Nunca fale de obra pronta')).toBeNull();
    expect(avisoDeProduto('Responda em até 2 minutos')).toBeNull();
  });
});
