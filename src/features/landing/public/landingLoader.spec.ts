import { describe, expect, it, vi } from 'vitest';
import { landingEndpoint, loadLanding, parseLandingPath, takeEarlyLanding } from './landingLoader';

const ok = (data: unknown) =>
  ({ ok: true, status: 200, json: async () => ({ data }) }) as unknown as Response;
const notFound = () => ({ ok: false, status: 404, json: async () => ({}) }) as unknown as Response;

describe('parseLandingPath', () => {
  it('lê tenant e slug de /lp/:tenant/:slug', () => {
    expect(parseLandingPath('/lp/aptopremium/lp-bonfiglioli')).toEqual({ tenant: 'aptopremium', slug: 'lp-bonfiglioli' });
    expect(parseLandingPath('/lp/aptopremium/lp-bonfiglioli/')).toEqual({ tenant: 'aptopremium', slug: 'lp-bonfiglioli' });
  });

  it('lê a página de resultado', () => {
    expect(parseLandingPath('/lp/aptopremium/lp-bonfiglioli/obrigado')).toEqual({
      tenant: 'aptopremium', slug: 'lp-bonfiglioli', result: 'obrigado',
    });
  });

  it('decodifica segmentos codificados na URL', () => {
    expect(parseLandingPath('/lp/imob%20teste/lan%C3%A7amento')).toEqual({ tenant: 'imob teste', slug: 'lançamento' });
  });

  it('fora do formato devolve null', () => {
    expect(parseLandingPath('/lp/aptopremium')).toBeNull();
    expect(parseLandingPath('/imovel/x/y')).toBeNull();
    expect(parseLandingPath('/lp/a/b/c/d')).toBeNull();
  });
});

describe('landingEndpoint', () => {
  it('monta o endereço público, sem barra dupla e com o slug codificado', () => {
    expect(landingEndpoint('https://api.lmflow.com.br/', 'lp x')).toBe('https://api.lmflow.com.br/api/public/v1/landing/lp%20x');
  });
});

describe('takeEarlyLanding', () => {
  it('só entrega a busca antecipada da MESMA landing, e uma vez só', () => {
    const promise = Promise.resolve(ok({}));
    const w = { __lmLanding: { tenant: 't', slug: 's', promise } } as Pick<Window, '__lmLanding'>;
    expect(takeEarlyLanding('t', 's', w)?.promise).toBe(promise);
    expect(w.__lmLanding).toBeUndefined();
    expect(takeEarlyLanding('t', 's', w)).toBeNull();
  });

  it('busca antecipada de OUTRA landing é descartada', () => {
    const w = { __lmLanding: { tenant: 't', slug: 'outra', promise: Promise.resolve(ok({})) } } as Pick<Window, '__lmLanding'>;
    expect(takeEarlyLanding('t', 's', w)).toBeNull();
    expect(w.__lmLanding).toBeUndefined();
  });
});

describe('loadLanding', () => {
  it('usa a resposta que o HTML já pediu, sem buscar de novo', async () => {
    const fetchImpl = vi.fn();
    const dto = { title: 'Campanha', content_blocks: [] };
    const early = { tenant: 't', slug: 's', promise: Promise.resolve(ok(dto)) };
    const data = await loadLanding({ tenant: 't', slug: 's', base: 'https://api', fetchImpl, early });
    expect(data).toEqual(dto);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sem busca antecipada, busca pelo caminho normal com o X-Tenant', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok({ title: 'X', content_blocks: [] }));
    const data = await loadLanding({ tenant: 't', slug: 's', base: 'https://api', fetchImpl, early: null });
    expect(data?.title).toBe('X');
    expect(fetchImpl).toHaveBeenCalledWith('https://api/api/public/v1/landing/s', { headers: { 'X-Tenant': 't' } });
  });

  it('busca antecipada que caiu na rede tenta de novo pelo caminho normal', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok({ title: 'X', content_blocks: [] }));
    const early = { tenant: 't', slug: 's', promise: Promise.reject(new Error('rede')) };
    const data = await loadLanding({ tenant: 't', slug: 's', base: 'https://api', fetchImpl, early });
    expect(data?.title).toBe('X');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('404 e erro de rede viram null (a página mostra "não disponível")', async () => {
    expect(await loadLanding({ tenant: 't', slug: 's', base: 'https://api', fetchImpl: vi.fn().mockResolvedValue(notFound()), early: null })).toBeNull();
    expect(await loadLanding({ tenant: 't', slug: 's', base: 'https://api', fetchImpl: vi.fn().mockRejectedValue(new Error('x')), early: null })).toBeNull();
  });
});
