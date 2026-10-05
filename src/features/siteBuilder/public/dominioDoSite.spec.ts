import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  caminhoDoSite,
  dominioConfirmado,
  dominioDoSite,
  ehEnderecoDoSistema,
  esquecerDominio,
  rotaDaLandingNoDominio,
} from './dominioDoSite';

const janela = (hostname: string, site?: Window['__LMF_SITE__']) => ({ location: { hostname }, __LMF_SITE__: site });
const resposta = (status: number, body: unknown = {}) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

afterEach(() => { esquecerDominio(); });

describe('ehEnderecoDoSistema', () => {
  it.each([
    'lmflow.com.br', 'app.lmflow.com.br', 'imob.lmflow.com.br', 'APP.LMFLOW.COM.BR', 'imob.lmflow.com.br.',
    'lm-flow-frontend-git-x.vercel.app', 'localhost', 'localhost:5173', 'app.localhost',
    '127.0.0.1', '192.168.0.10', '10.0.0.1:8080', '[::1]', '[::1]:5173', '',
  ])('%s é do sistema', host => expect(ehEnderecoDoSistema(host)).toBe(true));

  it.each([
    'www.imobiliaria.com.br', 'imobiliaria.com.br', 'evil-lmflow.com.br', 'lmflow.com.br.evil.com', 'vercel.app.com',
  ])('%s não é do sistema', host => expect(ehEnderecoDoSistema(host)).toBe(false));
});

describe('dominioDoSite', () => {
  it('endereço do sistema responde na hora, sem perguntar, mesmo com __LMF_SITE__ no HTML', async () => {
    const fetchFn = vi.fn();
    const estado = await dominioDoSite({ win: janela('app.lmflow.com.br', { tenant: 'imob', slug: 'imob' }), fetchFn });
    expect(estado).toEqual({ tipo: 'sistema' });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(dominioConfirmado()).toBeNull();
  });

  it('lê window.__LMF_SITE__ e não chama o resolve', async () => {
    const fetchFn = vi.fn();
    const estado = await dominioDoSite({ win: janela('www.imob.com.br', { tenant: 'imob', slug: 'site-imob' }), fetchFn });
    expect(estado).toEqual({ tipo: 'site', site: { tenant: 'imob', slug: 'site-imob', host: 'www.imob.com.br' } });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(dominioConfirmado()).toEqual({ tenant: 'imob', slug: 'site-imob', host: 'www.imob.com.br' });
  });

  it('__LMF_SITE__ sem tenant não vale: pergunta ao servidor', async () => {
    const fetchFn = vi.fn(async () => resposta(404));
    await dominioDoSite({ win: janela('www.imob.com.br', { tenant: '' }), fetchFn, api: 'https://api.x' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('sem __LMF_SITE__, chama o resolve UMA vez com o host e guarda', async () => {
    const fetchFn = vi.fn(async () => resposta(200, { tenant: 'imob', site_slug: 'site-imob', domain: 'www.imob.com.br' }));
    const deps = { win: janela('WWW.Imob.com.br'), fetchFn, api: 'https://api.x/' };
    const [a, b] = await Promise.all([dominioDoSite(deps), dominioDoSite(deps)]);
    const c = await dominioDoSite(deps);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0][0]).toBe('https://api.x/api/public/v1/resolve?host=www.imob.com.br');
    expect(a).toEqual({ tipo: 'site', site: { tenant: 'imob', slug: 'site-imob', host: 'www.imob.com.br' } });
    expect(b).toEqual(a);
    expect(c).toEqual(a);
    expect(dominioConfirmado()?.tenant).toBe('imob');
  });

  it('404 vira "não encontrado" e fica guardado', async () => {
    const fetchFn = vi.fn(async () => resposta(404));
    const deps = { win: janela('www.sem-site.com.br'), fetchFn, api: 'https://api.x' };
    expect(await dominioDoSite(deps)).toEqual({ tipo: 'nao-encontrado' });
    expect(await dominioDoSite(deps)).toEqual({ tipo: 'nao-encontrado' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(dominioConfirmado()).toBeNull();
  });

  it('resposta 200 sem tenant também é "não encontrado"', async () => {
    const fetchFn = vi.fn(async () => resposta(200, { tenant: null }));
    expect(await dominioDoSite({ win: janela('www.x.com.br'), fetchFn, api: 'https://api.x' })).toEqual({ tipo: 'nao-encontrado' });
  });

  it('servidor fora (500 ou rede) é "erro" e não fica guardado: a próxima chamada pergunta de novo', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(resposta(500))
      .mockRejectedValueOnce(new Error('rede'))
      .mockResolvedValueOnce(resposta(200, { tenant: 'imob', site_slug: 'imob' }));
    const deps = { win: janela('www.imob.com.br'), fetchFn, api: 'https://api.x' };
    expect(await dominioDoSite(deps)).toEqual({ tipo: 'erro' });
    expect(await dominioDoSite(deps)).toEqual({ tipo: 'erro' });
    expect((await dominioDoSite(deps)).tipo).toBe('site');
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });
});

describe('caminhoDoSite', () => {
  const lmflow = { tenant: 'imob', dominio: false };
  const dominio = { tenant: 'imob', dominio: true };

  it.each([
    ['/', '/portal/imob', '/'],
    ['/#contato', '/portal/imob#contato', '/#contato'],
    ['/imoveis', '/portal/imob/imoveis', '/imoveis'],
    ['/imoveis?tab=rent&city=Campinas', '/portal/imob/imoveis?tab=rent&city=Campinas', '/imoveis?tab=rent&city=Campinas'],
    ['/imovel/AP0042', '/imovel/imob/AP0042', '/imovel/AP0042'],
    ['/imovel/AP0042?finalidade=locacao', '/imovel/imob/AP0042?finalidade=locacao', '/imovel/AP0042?finalidade=locacao'],
    ['/blog', '/portal/imob/blog', '/blog'],
    ['/blog/como-comprar', '/portal/imob/blog/como-comprar', '/blog/como-comprar'],
    ['/p/sobre', '/portal/imob/p/sobre', '/p/sobre'],
    ['/financiamento', '/portal/imob/financiamento', '/financiamento'],
    ['/anuncie', '/portal/imob/anuncie', '/anuncie'],
    ['/lp/lancamento-x', '/lp/imob/lancamento-x', '/lp/lancamento-x'],
    ['/lp/lancamento-x/obrigado', '/lp/imob/lancamento-x/obrigado', '/lp/lancamento-x/obrigado'],
  ])('%s → lmflow %s · domínio %s', (rota, noLmflow, noDominio) => {
    expect(caminhoDoSite(lmflow, rota)).toBe(noLmflow);
    expect(caminhoDoSite(dominio, rota)).toBe(noDominio);
  });
});

describe('rotaDaLandingNoDominio', () => {
  it.each([
    ['/lp/oferta', { slug: 'oferta' }],
    ['/lp/oferta/', { slug: 'oferta' }],
    ['/lp/oferta/obrigado', { slug: 'oferta', result: 'obrigado' }],
    ['/lp/oferta/desqualificado', { slug: 'oferta', result: 'desqualificado' }],
    ['/lp/imob/oferta', { redirecionar: '/lp/oferta' }],
    ['/lp/imob/oferta/obrigado', { redirecionar: '/lp/oferta/obrigado' }],
    ['/lp/imob/oferta/outra', null],
    ['/lp', null],
    ['/imoveis', null],
  ])('%s', (caminho, esperado) => expect(rotaDaLandingNoDominio(caminho)).toEqual(esperado));
});
