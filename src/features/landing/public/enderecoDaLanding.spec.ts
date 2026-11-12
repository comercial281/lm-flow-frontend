import { describe, expect, it } from 'vitest';
import { enderecoDaLanding, enderecoDoCliente } from './enderecoDaLanding';

const BUSCA = '?utm_source=fb&utm_campaign=lan%C3%A7amento&fbclid=IwAR0abc';

describe('enderecoDaLanding', () => {
  it.each([
    // [host, tenant do caminho, resultado]
    ['renato.lmflow.com.br', 'renato', { tipo: 'montar' }],
    ['016-imoveis.lmflow.com.br', '016-imoveis', { tipo: 'montar' }],
    ['nova-27.lmflow.com.br', 'nova-27', { tipo: 'montar' }],
    ['Renato.LMFLOW.com.br.', 'renato', { tipo: 'montar' }],
    ['renato.lmflow.com.br', 'Renato', { tipo: 'montar' }],
    ['renato.lmflow.com.br:443', 'renato', { tipo: 'montar' }],
    // fora do lmflow: como sempre
    ['www.imobiliaria.com.br', 'renato', { tipo: 'montar' }],
    ['localhost', 'renato', { tipo: 'montar' }],
    ['127.0.0.1', 'renato', { tipo: 'montar' }],
    ['lm-flow-frontend-git-x.vercel.app', 'renato', { tipo: 'montar' }],
    ['lmflow.com.br.evil.com', 'renato', { tipo: 'montar' }],
  ])('%s com /lp/%s → %o', (hostname, tenant, esperado) => {
    expect(enderecoDaLanding({ hostname, pathname: `/lp/${tenant}/oferta` }, tenant)).toEqual(esperado);
  });

  it.each([
    ['outro.lmflow.com.br'],
    ['app.lmflow.com.br'],
    ['www.lmflow.com.br'],
    ['lmflow.com.br'],
    ['admin.lmflow.com.br'],
    ['x.renato.lmflow.com.br'],
  ])('%s → vai para o endereço do cliente, com busca e âncora', (hostname) => {
    expect(
      enderecoDaLanding({ hostname, pathname: '/lp/016-imoveis/oferta-x', search: BUSCA, hash: '#form' }, '016-imoveis'),
    ).toEqual({ tipo: 'redirecionar', url: `https://016-imoveis.lmflow.com.br/lp/016-imoveis/oferta-x${BUSCA}#form` });
  });

  it('página de resultado vai junto (obrigado/desqualificado)', () => {
    expect(enderecoDaLanding({ hostname: 'app.lmflow.com.br', pathname: '/lp/nova-27/oferta/obrigado', search: '?a=1' }, 'nova-27'))
      .toEqual({ tipo: 'redirecionar', url: 'https://nova-27.lmflow.com.br/lp/nova-27/oferta/obrigado?a=1' });
  });

  it('sem busca nem âncora: endereço limpo', () => {
    expect(enderecoDaLanding({ hostname: 'lmflow.com.br', pathname: '/lp/renato/oferta' }, 'renato'))
      .toEqual({ tipo: 'redirecionar', url: 'https://renato.lmflow.com.br/lp/renato/oferta' });
  });

  it('o destino nunca redireciona de novo (sem laço)', () => {
    const r = enderecoDaLanding({ hostname: 'app.lmflow.com.br', pathname: '/lp/Renato/oferta', search: BUSCA }, 'Renato');
    expect(r.tipo).toBe('redirecionar');
    const destino = new URL((r as { url: string }).url);
    expect(enderecoDaLanding(destino, 'Renato')).toEqual({ tipo: 'montar' });
  });

  it.each([
    ['app'], ['www'], ['api'], ['admin'], ['lmflow'], [''], ['a_b'], ['evil.com'], ['-x'], ['x-'], ['a/b'], ['x'.repeat(64)],
  ])('cliente sem endereço possível (%s): não monta nem redireciona no lmflow', (tenant) => {
    expect(enderecoDaLanding({ hostname: 'app.lmflow.com.br', pathname: `/lp/${tenant}/oferta` }, tenant)).toEqual({ tipo: 'indisponivel' });
    expect(enderecoDaLanding({ hostname: `${tenant || 'x'}.lmflow.com.br`, pathname: '/lp/x/oferta' }, tenant)).toEqual({ tipo: 'indisponivel' });
  });

  it('enderecoDoCliente', () => {
    expect(enderecoDoCliente('016-imoveis')).toBe('016-imoveis.lmflow.com.br');
    expect(enderecoDoCliente(' Nova-27 ')).toBe('nova-27.lmflow.com.br');
    expect(enderecoDoCliente('app')).toBeNull();
  });
});
