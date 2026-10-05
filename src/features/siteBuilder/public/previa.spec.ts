import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CHAVE_DA_PREVIA, cabecalhosDoSite, ehPrevia, esquecerPrevia, tokenDaPrevia } from './previa';

describe('prévia do site (?previa= → sessionStorage → X-Site-Preview)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    esquecerPrevia();
  });
  afterEach(() => {
    sessionStorage.clear();
    esquecerPrevia();
  });

  it('lê o ?previa= da URL e guarda em sessionStorage["lmf-previa"]', () => {
    expect(tokenDaPrevia({ search: '?previa=abc--123' })).toBe('abc--123');
    expect(sessionStorage.getItem(CHAVE_DA_PREVIA)).toBe('abc--123');
  });

  it('depois que a URL perde o ?previa= (navegação interna), segue com o guardado', () => {
    tokenDaPrevia({ search: '?previa=abc--123' });
    expect(tokenDaPrevia({ search: '?tab=sale' })).toBe('abc--123');
  });

  it('o token com + e / volta inteiro quando a URL foi montada com codificação', () => {
    const token = 'eyJ+a/b==--9f';
    expect(tokenDaPrevia({ search: `?previa=${encodeURIComponent(token)}` })).toBe(token);
  });

  it('sem token, nada', () => {
    expect(tokenDaPrevia({ search: '' })).toBeNull();
  });

  it('token com espaço ou quebra de linha é ignorado (não vira header torto)', () => {
    expect(tokenDaPrevia({ search: `?previa=${encodeURIComponent('a b')}` })).toBeNull();
    expect(tokenDaPrevia({ search: `?previa=${encodeURIComponent('a\nb')}` })).toBeNull();
  });

  it('cabeçalhos: X-Tenant sempre; X-Site-Preview só com token', () => {
    window.history.replaceState({}, '', '/portal/imob');
    expect(cabecalhosDoSite('imob')).toEqual({ 'X-Tenant': 'imob' });
    sessionStorage.setItem(CHAVE_DA_PREVIA, 'tok-1');
    expect(cabecalhosDoSite('imob', { 'Content-Type': 'application/json' })).toEqual({
      'Content-Type': 'application/json', 'X-Tenant': 'imob', 'X-Site-Preview': 'tok-1',
    });
  });

  it('só preview === true é prévia', () => {
    expect(ehPrevia({ preview: true })).toBe(true);
    expect(ehPrevia({ preview: false })).toBe(false);
    expect(ehPrevia({})).toBe(false);
    expect(ehPrevia(null)).toBe(false);
  });
});
