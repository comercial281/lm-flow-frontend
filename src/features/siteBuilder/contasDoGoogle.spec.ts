import { describe, it, expect } from 'vitest';
import { lerContas, naoReconhecido, resolverGoogle } from './contasDoGoogle';

describe('lerContas', () => {
  it('Search Console: código puro ou a tag inteira', () => {
    expect(lerContas.searchConsole(' AbC123_-xyzQ ')).toBe('AbC123_-xyzQ');
    expect(lerContas.searchConsole('<meta name="google-site-verification" content="AbC123_-xyzQ" />')).toBe('AbC123_-xyzQ');
    expect(lerContas.searchConsole('<meta name="msvalidate.01" content="AbC123xyzQ1" />')).toBeNull();
    expect(lerContas.searchConsole('<script>alert(1)</script>')).toBeNull();
    expect(lerContas.searchConsole('curto')).toBeNull();
  });

  it('Bing: código puro ou a tag', () => {
    expect(lerContas.bing('0123456789ABCDEF0123456789ABCDEF')).toBe('0123456789ABCDEF0123456789ABCDEF');
    expect(lerContas.bing('<meta name="msvalidate.01" content="0123456789ABCDEF" />')).toBe('0123456789ABCDEF');
  });

  it('Clarity: id, script colado ou link', () => {
    expect(lerContas.clarity('ABCD1234ef')).toBe('abcd1234ef');
    expect(lerContas.clarity('(function(c,l,a,r,i,t,y){})(window, document, "clarity", "script", "abcd1234ef");')).toBe('abcd1234ef');
    expect(lerContas.clarity('https://www.clarity.ms/tag/abcd1234ef')).toBe('abcd1234ef');
    expect(lerContas.clarity('x"; alert(1)')).toBeNull();
  });

  it('Perfil da Empresa só aceita link http(s)', () => {
    expect(lerContas.perfil('https://g.page/imob')).toBe('https://g.page/imob');
    expect(lerContas.perfil('javascript:alert(1)')).toBeNull();
  });

  it('CRECI tira a palavra CRECI e recusa HTML', () => {
    expect(lerContas.creci('J-12345')).toBe('J-12345');
    expect(lerContas.creci('CRECI 12345-F')).toBe('12345-F');
    expect(lerContas.creci('creci: 98765')).toBe('98765');
    expect(lerContas.creci('<b>x</b>')).toBeNull();
  });
});

describe('resolverGoogle', () => {
  it('servidor velho (só indexable) vira o bloco inteiro, sem perder nada', () => {
    expect(resolverGoogle({ indexable: true })).toEqual({
      indexable: true, search_console: '', bing: '', clarity: '', business_profile_url: '', creci: '',
    });
    expect(resolverGoogle(null).indexable).toBe(false);
  });

  it('mantém o que veio', () => {
    expect(resolverGoogle({ indexable: false, creci: 'J-1', clarity: 'abc123' })).toMatchObject({ creci: 'J-1', clarity: 'abc123' });
  });
});

describe('naoReconhecido', () => {
  it('vazio não é erro; preenchido ilegível é', () => {
    expect(naoReconhecido('', lerContas.creci)).toBe(false);
    expect(naoReconhecido(null, lerContas.creci)).toBe(false);
    expect(naoReconhecido('<b>', lerContas.creci)).toBe(true);
    expect(naoReconhecido('J-12345', lerContas.creci)).toBe(false);
  });
});
