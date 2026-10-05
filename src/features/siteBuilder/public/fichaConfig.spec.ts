import { describe, it, expect } from 'vitest';
import { FICHA_FABRICA, resolverFicha, resolverFichaDoAdmin } from './fichaConfig';

describe('resolverFicha', () => {
  it('fábrica: tudo ligado', () => {
    expect(FICHA_FABRICA).toEqual({
      resale: { map: true, popular_badge: true, values: true, similar: true },
      development: { map: true, popular_badge: true, stage_and_forecast: true, typologies: true, builder: true, similar: true, book_button: false },
      financing_badges: true,
    });
  });
  it('book_button nasce desligado e só liga com true explícito', () => {
    expect(FICHA_FABRICA.development.book_button).toBe(false);
    expect(resolverFicha({ development: { book_button: true } }).development.book_button).toBe(true);
    expect(resolverFicha({ development: { book_button: 'true' } }).development.book_button).toBe(false);
    expect(resolverFicha({ development: { map: false } }).development.book_button).toBe(false);
  });
  it('ausente (servidor velho) vira fábrica', () => {
    expect(resolverFicha(undefined)).toEqual(FICHA_FABRICA);
    expect(resolverFicha(null)).toEqual(FICHA_FABRICA);
  });
  it('lixo vira fábrica', () => {
    expect(resolverFicha([])).toEqual(FICHA_FABRICA);
    expect(resolverFicha('x')).toEqual(FICHA_FABRICA);
    expect(resolverFicha({ resale: 'x', development: [false], financing_badges: 'não' })).toEqual(FICHA_FABRICA);
  });
  it('chave booleana só é false se vier false', () => {
    const f = resolverFicha({ resale: { map: false, values: 0, similar: 'false', popular_badge: null } });
    expect(f.resale).toEqual({ map: false, popular_badge: true, values: true, similar: true });
  });
  it('chaves faltando usam a fábrica e o resto é mantido', () => {
    const f = resolverFicha({ development: { typologies: false }, financing_badges: false });
    expect(f.resale).toEqual(FICHA_FABRICA.resale);
    expect(f.development).toEqual({ ...FICHA_FABRICA.development, typologies: false });
    expect(f.financing_badges).toBe(false);
  });
  it('não carrega email_copy nem chave desconhecida', () => {
    const f = resolverFicha({ email_copy: ['a@b.com'], resale: { lixo: false }, outra: 1 });
    expect(f).toEqual(FICHA_FABRICA);
    expect('email_copy' in f).toBe(false);
  });
  it('fábrica não é mutável por quem recebe o resultado', () => {
    resolverFicha(undefined).resale.map = false;
    expect(FICHA_FABRICA.resale.map).toBe(true);
  });
});

describe('resolverFichaDoAdmin', () => {
  it('mantém email_copy (só textos) e cai em lista vazia sem ele', () => {
    expect(resolverFichaDoAdmin({ email_copy: ['a@b.com', 3, null, 'c@d.com'] }).email_copy).toEqual(['a@b.com', 'c@d.com']);
    expect(resolverFichaDoAdmin(undefined)).toEqual({ ...FICHA_FABRICA, email_copy: [] });
    expect(resolverFichaDoAdmin({ email_copy: 'a@b.com' }).email_copy).toEqual([]);
  });
});
