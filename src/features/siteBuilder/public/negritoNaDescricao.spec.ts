import { describe, expect, it } from 'vitest';
import { paragrafosDaDescricao, trechosComNegrito } from './negritoNaDescricao';

/* A descrição do imóvel vem do cadastro (ou da Kenlo) com **negrito** escrito
   à mão: vira negrito de verdade, sem markdown completo e sem HTML. */

describe('trechosComNegrito', () => {
  it('**a** vira trecho em negrito', () => {
    expect(trechosComNegrito('Casa **reformada** e ampla')).toEqual([
      { texto: 'Casa ', negrito: false },
      { texto: 'reformada', negrito: true },
      { texto: ' e ampla', negrito: false },
    ]);
  });

  it('vários pares na mesma linha', () => {
    expect(trechosComNegrito('**3 quartos** e **2 vagas**').filter(t => t.negrito).map(t => t.texto)).toEqual(['3 quartos', '2 vagas']);
  });

  it('asterisco sem par fica como está', () => {
    expect(trechosComNegrito('Preço **especial')).toEqual([{ texto: 'Preço **especial', negrito: false }]);
    expect(trechosComNegrito('a ** b')).toEqual([{ texto: 'a ** b', negrito: false }]);
  });

  it('par vazio ou só de espaço não vira negrito', () => {
    expect(trechosComNegrito('a **** b')).toEqual([{ texto: 'a **** b', negrito: false }]);
    expect(trechosComNegrito('a **  ** b')).toEqual([{ texto: 'a **  ** b', negrito: false }]);
  });

  it('HTML sai como texto (quem desenha é o React)', () => {
    expect(trechosComNegrito('**<script>x</script>**')).toEqual([{ texto: '<script>x</script>', negrito: true }]);
  });

  it('um asterisco só (itálico do markdown) não é tratado', () => {
    expect(trechosComNegrito('*Oportunidade*')).toEqual([{ texto: '*Oportunidade*', negrito: false }]);
  });

  it('texto vazio: nada', () => {
    expect(trechosComNegrito('')).toEqual([]);
  });
});

describe('paragrafosDaDescricao', () => {
  it('linha em branco separa parágrafos; quebra simples fica no parágrafo', () => {
    expect(paragrafosDaDescricao('Um\nlinha dois\n\n\nDois\n  \nTrês')).toEqual(['Um\nlinha dois', 'Dois', 'Três']);
  });
});
