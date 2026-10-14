import { describe, expect, it } from 'vitest';
import { secaoTravada } from './travasDoSite';

const VRSYNC = ['title', 'description', 'sale_price', 'address_city', 'bedrooms', 'features', 'status', 'property_type', 'transaction_type'];

describe('seções travadas pelo site', () => {
  it('trava as seções com campo do site; deixa equipe, comissão e dados internos livres', () => {
    expect(secaoTravada('basico', VRSYNC)).toBe(true);
    expect(secaoTravada('valores', VRSYNC)).toBe(true);
    expect(secaoTravada('localizacao', VRSYNC)).toBe(true);
    expect(secaoTravada('composicao', VRSYNC)).toBe(true);
    expect(secaoTravada('caracteristicas', VRSYNC)).toBe(true);
    expect(secaoTravada('descricao', VRSYNC)).toBe(true);
    expect(secaoTravada('equipe', VRSYNC)).toBe(false);
    expect(secaoTravada('comissao', VRSYNC)).toBe(false);
    expect(secaoTravada('dadosInternos', VRSYNC)).toBe(false);
    expect(secaoTravada('tipologias', VRSYNC)).toBe(false);
  });
  it('sem campos travados (fonte desligada), nada trava', () => {
    expect(secaoTravada('basico', [])).toBe(false);
  });
  it('vídeo vindo do site trava Fotos e vídeos; financiamento trava Detalhes da venda', () => {
    expect(secaoTravada('midia', ['video_url'])).toBe(true);
    expect(secaoTravada('detalhesVenda', ['accepts_financing'])).toBe(true);
    expect(secaoTravada('midia', ['title'])).toBe(false);
  });
});
