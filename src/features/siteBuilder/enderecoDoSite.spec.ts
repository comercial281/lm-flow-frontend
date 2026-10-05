import { describe, expect, it } from 'vitest';
import { enderecoDoSite, enderecoNoGoogle, urlDaPrevia } from './enderecoDoSite';

const opts = { origin: 'https://imob.lmflow.com.br', tenant: 'imob' };

describe('enderecoDoSite', () => {
  it('com domínio ativo: o domínio, sem caminho', () => {
    expect(enderecoDoSite({ slug: 'x', domain: 'www.imob.com.br' }, opts))
      .toEqual({ url: 'https://www.imob.com.br', visivel: 'www.imob.com.br', noDominio: true });
  });

  it('domínio gravado com https://, barra e maiúscula sai limpo', () => {
    expect(enderecoDoSite({ domain: 'HTTPS://Imob.com.br/' }, opts).url).toBe('https://imob.com.br');
  });

  it('sem domínio: o endereço lmflow do cliente', () => {
    expect(enderecoDoSite({ slug: 'site', domain: null }, opts))
      .toEqual({ url: 'https://imob.lmflow.com.br/portal/imob', visivel: 'imob.lmflow.com.br/portal/imob', noDominio: false });
    expect(enderecoDoSite({ slug: 'site' }, { origin: 'http://localhost:5173', tenant: null }).url)
      .toBe('http://localhost:5173/portal/site');
  });
});

describe('urlDaPrevia', () => {
  it('põe o ?previa= codificado no domínio e no endereço lmflow', () => {
    expect(urlDaPrevia('https://www.imob.com.br', 'a+b/c==--1')).toBe('https://www.imob.com.br/?previa=a%2Bb%2Fc%3D%3D--1');
    expect(urlDaPrevia('https://imob.lmflow.com.br/portal/imob', 't1')).toBe('https://imob.lmflow.com.br/portal/imob?previa=t1');
  });
});

describe('enderecoNoGoogle', () => {
  it('o domínio ativo, ou <cliente>.lmflow.com.br; nunca app.lmflow.com.br', () => {
    expect(enderecoNoGoogle({ domain: 'imob.com.br' }, 'imob')).toBe('imob.com.br');
    expect(enderecoNoGoogle({ slug: 's', domain: null }, 'imob')).toBe('imob.lmflow.com.br');
    expect(enderecoNoGoogle({ slug: 's' }, null)).toBe('s.lmflow.com.br');
  });
});
